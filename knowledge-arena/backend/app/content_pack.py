"""Export / import exams, questions, and media so git clone keeps content intact."""
from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.database import UPLOAD_DIR, SessionLocal, init_db
from app.models import (
    AnswerOption,
    BankAnswerOption,
    BankQuestion,
    Exam,
    MediaType,
    Question,
    Setting,
)

SEED_DIR = Path(__file__).resolve().parent.parent / "seed_data"
CONTENT_FILE = SEED_DIR / "content.json"
MEDIA_DIR = SEED_DIR / "media"
PACK_HASH_KEY = "content_pack_sha256"


def content_file_hash() -> str | None:
    if not CONTENT_FILE.is_file():
        return None
    return hashlib.sha256(CONTENT_FILE.read_bytes()).hexdigest()


def _get_setting(db: Session, key: str) -> str | None:
    row = db.query(Setting).filter(Setting.key == key).first()
    return row.value if row else None


def _set_setting(db: Session, key: str, value: str) -> None:
    row = db.query(Setting).filter(Setting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(Setting(key=key, value=value))


def _add_options(db: Session, question_id: int, options: list) -> None:
    for o_data in options or []:
        db.add(
            AnswerOption(
                question_id=question_id,
                content=o_data.get("content") or "",
                is_correct=bool(o_data.get("is_correct")),
                media_type=o_data.get("media_type") or MediaType.NONE.value,
                media_url=o_data.get("media_url"),
                order_index=int(o_data.get("order_index") or 0),
            )
        )


def _replace_exam_questions(db: Session, exam: Exam, exam_data: dict[str, Any]) -> None:
    """Keep exam.id (rooms still work); replace all questions from seed."""
    from app.models import Room, Submission

    exam_id = exam.id
    exam.description = exam_data.get("description") or ""
    exam.time_per_question = int(exam_data.get("time_per_question") or 15)
    qids = [
        row[0]
        for row in db.query(Question.id).filter(Question.exam_id == exam_id).all()
    ]
    if qids:
        db.query(Room).filter(Room.current_question_id.in_(qids)).update(
            {Room.current_question_id: None},
            synchronize_session=False,
        )
        db.query(Submission).filter(Submission.question_id.in_(qids)).update(
            {Submission.answer_id: None},
            synchronize_session=False,
        )
        db.query(Submission).filter(Submission.question_id.in_(qids)).delete(
            synchronize_session=False
        )
        db.query(AnswerOption).filter(AnswerOption.question_id.in_(qids)).delete(
            synchronize_session=False
        )
        db.query(Question).filter(Question.id.in_(qids)).delete(synchronize_session=False)
    # Commit deletes so identity map cannot resurrect old Question/Option rows
    db.commit()

    for q_data in exam_data.get("questions") or []:
        q = Question(
            exam_id=exam_id,
            content=q_data.get("content") or "",
            question_type=q_data.get("question_type") or "MULTIPLE_CHOICE",
            order_index=int(q_data.get("order_index") or 0),
            media_type=q_data.get("media_type") or MediaType.NONE.value,
            media_url=q_data.get("media_url"),
            media_position=q_data.get("media_position") or "BEFORE",
            points=int(q_data.get("points") or 10),
            input_mode=(q_data.get("input_mode") or "TEXT"),
            blocks_json=q_data.get("blocks_json"),
        )
        db.add(q)
        db.flush()
        _add_options(db, q.id, q_data.get("options") or [])
    db.commit()


def sync_exams_from_seed(db: Session, *, force: bool = False) -> bool:
    """
    When seed_data/content.json changes (git pull), update exams with the same title.
    Preserves exam.id so existing rooms keep working.
    """
    digest = content_file_hash()
    if not digest or not CONTENT_FILE.is_file():
        return False
    stored = _get_setting(db, PACK_HASH_KEY)
    if not force and stored == digest:
        return False

    payload = json.loads(CONTENT_FILE.read_text(encoding="utf-8"))
    exams = payload.get("exams") or []
    bank_questions = payload.get("bank_questions") or []
    updated = 0
    created = 0

    for exam_data in exams:
        title = (exam_data.get("title") or "Untitled").strip()
        # Do not eager-load questions/options — stale instances break FK after bulk delete
        exam = db.query(Exam).filter(Exam.title == title).first()
        if exam:
            _replace_exam_questions(db, exam, exam_data)
            updated += 1
        else:
            exam = Exam(
                title=title,
                description=exam_data.get("description") or "",
                time_per_question=int(exam_data.get("time_per_question") or 15),
            )
            db.add(exam)
            db.flush()
            _replace_exam_questions(db, exam, exam_data)
            created += 1

    existing_contents = {b.content for b in db.query(BankQuestion).all()}
    bank_added = 0
    for q_data in bank_questions:
        content = q_data.get("content") or ""
        if not content or content in existing_contents:
            continue
        bq = BankQuestion(
            content=content,
            question_type=q_data.get("question_type") or "MULTIPLE_CHOICE",
            media_type=q_data.get("media_type") or MediaType.NONE.value,
            media_url=q_data.get("media_url"),
            media_position=q_data.get("media_position") or "BEFORE",
            tags=q_data.get("tags") or "",
            points=int(q_data.get("points") or 10),
            blocks_json=q_data.get("blocks_json"),
        )
        db.add(bq)
        db.flush()
        for o_data in q_data.get("options") or []:
            db.add(
                BankAnswerOption(
                    question_id=bq.id,
                    content=o_data.get("content") or "",
                    is_correct=bool(o_data.get("is_correct")),
                    media_type=o_data.get("media_type") or MediaType.NONE.value,
                    media_url=o_data.get("media_url"),
                    order_index=int(o_data.get("order_index") or 0),
                )
            )
        existing_contents.add(content)
        bank_added += 1

    _set_setting(db, PACK_HASH_KEY, digest)
    db.commit()
    print(
        f"Synced seed pack: {updated} exams updated, {created} exams created, "
        f"{bank_added} bank questions added"
    )
    return True


def _media_rel_from_url(url: str | None) -> str | None:
    """'/media/images/a.png' -> 'images/a.png'."""
    if not url:
        return None
    prefix = "/media/"
    if url.startswith(prefix):
        return url[len(prefix) :].lstrip("/")
    return None


def _collect_media_urls(payload: dict[str, Any]) -> set[str]:
    urls: set[str] = set()

    def add_from_questions(questions: list) -> None:
        for q in questions:
            if q.get("media_url"):
                urls.add(q["media_url"])
            for opt in q.get("options", []):
                if opt.get("media_url"):
                    urls.add(opt["media_url"])

    for exam in payload.get("exams", []):
        add_from_questions(exam.get("questions") or [])
    add_from_questions(payload.get("bank_questions") or [])
    return urls


def _serialize_question(q, *, include_order: bool = False) -> dict[str, Any]:
    options_out = [
        {
            "content": o.content or "",
            "is_correct": bool(o.is_correct),
            "media_type": o.media_type or MediaType.NONE.value,
            "media_url": o.media_url,
            "order_index": o.order_index,
        }
        for o in sorted(q.options, key=lambda x: x.order_index)
    ]
    data: dict[str, Any] = {
        "content": q.content,
        "question_type": q.question_type,
        "media_type": q.media_type or MediaType.NONE.value,
        "media_url": q.media_url,
        "media_position": q.media_position or "BEFORE",
        "points": int(getattr(q, "points", None) or 10),
        "input_mode": getattr(q, "input_mode", None) or "TEXT",
        "blocks_json": getattr(q, "blocks_json", None),
        "options": options_out,
    }
    if include_order:
        data["order_index"] = q.order_index
    if hasattr(q, "tags"):
        data["tags"] = q.tags or ""
    return data


def export_content(db: Session | None = None, *, quiet: bool = False) -> Path:
    """Dump all exams/questions/options + copy referenced media into seed_data/."""
    own_session = db is None
    if own_session:
        init_db()
        db = SessionLocal()
    assert db is not None
    try:
        SEED_DIR.mkdir(parents=True, exist_ok=True)
        MEDIA_DIR.mkdir(parents=True, exist_ok=True)

        exams_out: list[dict[str, Any]] = []
        for exam in db.query(Exam).order_by(Exam.id).all():
            questions_out = [
                _serialize_question(q, include_order=True)
                for q in sorted(exam.questions, key=lambda x: x.order_index)
            ]
            exams_out.append(
                {
                    "title": exam.title,
                    "description": exam.description or "",
                    "time_per_question": exam.time_per_question or 15,
                    "questions": questions_out,
                }
            )

        bank_out = [
            _serialize_question(q)
            for q in db.query(BankQuestion).order_by(BankQuestion.id).all()
        ]

        payload = {"version": 2, "exams": exams_out, "bank_questions": bank_out}
        CONTENT_FILE.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        # Mirror media into seed_data/media so git clone keeps images
        copied = 0
        for url in _collect_media_urls(payload):
            rel = _media_rel_from_url(url)
            if not rel:
                continue
            src = UPLOAD_DIR / rel
            if not src.is_file():
                if not quiet:
                    print(f"! Thiếu file media: {src}")
                continue
            dest = MEDIA_DIR / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            if not dest.exists() or dest.stat().st_mtime < src.stat().st_mtime:
                shutil.copy2(src, dest)
                copied += 1

        if not quiet:
            print(
                f"Exported {len(exams_out)} exams + {len(bank_out)} bank questions -> {CONTENT_FILE}"
            )
            print(f"Copied {copied} media files -> {MEDIA_DIR}")
        return CONTENT_FILE
    finally:
        if own_session:
            db.close()


def sync_content_pack(db: Session | None = None) -> None:
    """Best-effort export after admin edits (keeps seed_data ready for git push)."""
    try:
        export_content(db, quiet=True)
        # Remember hash so next startup won't overwrite local admin edits with old seed
        if db is not None:
            digest = content_file_hash()
            if digest:
                _set_setting(db, PACK_HASH_KEY, digest)
                db.commit()
    except Exception:
        pass


def ensure_content_on_startup() -> None:
    """Called from app lifespan: restore media; import if empty; sync when seed pack changes."""
    init_db()
    _restore_media_files()
    db = SessionLocal()
    try:
        if db.query(Exam).count() == 0 or db.query(BankQuestion).count() == 0:
            import_content(db, only_if_empty=True)
            digest = content_file_hash()
            if digest:
                _set_setting(db, PACK_HASH_KEY, digest)
                db.commit()
        else:
            # git pull updated seed_data → refresh exams with same titles
            sync_exams_from_seed(db)
        ensure_scratch_practice(db)
    finally:
        db.close()


def _restore_media_files() -> int:
    """Copy seed_data/media → uploads so /media/... URLs work after clone."""
    if not MEDIA_DIR.exists():
        return 0
    count = 0
    for src in MEDIA_DIR.rglob("*"):
        if not src.is_file() or src.name == ".gitkeep":
            continue
        rel = src.relative_to(MEDIA_DIR)
        dest = UPLOAD_DIR / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.exists() or dest.stat().st_size != src.stat().st_size:
            shutil.copy2(src, dest)
            count += 1
    return count


def import_content(
    db: Session | None = None,
    *,
    only_if_empty: bool = True,
    replace_existing: bool = False,
) -> bool:
    """
    Import exams + bank questions from seed_data/content.json.
    Returns True if import ran.
    """
    if not CONTENT_FILE.is_file():
        return False

    own_session = db is None
    if own_session:
        init_db()
        db = SessionLocal()
    assert db is not None
    try:
        exam_count = db.query(Exam).count()
        bank_count = db.query(BankQuestion).count()
        payload = json.loads(CONTENT_FILE.read_text(encoding="utf-8"))
        exams = payload.get("exams") or []
        bank_questions = payload.get("bank_questions") or []

        need_exams = (not only_if_empty or exam_count == 0 or replace_existing) and bool(exams)
        need_bank = (not only_if_empty or bank_count == 0 or replace_existing) and bool(
            bank_questions
        )

        if only_if_empty and not replace_existing and exam_count > 0 and bank_count > 0:
            restored = _restore_media_files()
            if restored:
                print(f"• Đã khôi phục {restored} file media từ seed_data")
            return False

        if not need_exams and not need_bank and exam_count > 0:
            # Still allow bank-only import when exams exist but bank empty
            if bank_count > 0 or not bank_questions:
                restored = _restore_media_files()
                if restored:
                    print(f"• Đã khôi phục {restored} file media từ seed_data")
                return False
            need_bank = True

        if not exams and not bank_questions:
            return False

        restored = _restore_media_files()
        if restored:
            print(f"✓ Khôi phục {restored} file media vào uploads/")

        created = 0
        bank_created = 0

        if need_exams:
            if replace_existing and exam_count > 0:
                for exam in db.query(Exam).all():
                    db.delete(exam)
                db.flush()

            existing_titles = (
                {e.title for e in db.query(Exam).all()} if not replace_existing else set()
            )

            for exam_data in exams:
                title = exam_data.get("title") or "Untitled"
                if title in existing_titles:
                    continue
                exam = Exam(
                    title=title,
                    description=exam_data.get("description") or "",
                    time_per_question=int(exam_data.get("time_per_question") or 15),
                )
                db.add(exam)
                db.flush()
                for q_data in exam_data.get("questions") or []:
                    q = Question(
                        exam_id=exam.id,
                        content=q_data.get("content") or "",
                        question_type=q_data.get("question_type") or "MULTIPLE_CHOICE",
                        order_index=int(q_data.get("order_index") or 0),
                        media_type=q_data.get("media_type") or MediaType.NONE.value,
                        media_url=q_data.get("media_url"),
                        media_position=q_data.get("media_position") or "BEFORE",
                        points=int(q_data.get("points") or 10),
                        input_mode=(q_data.get("input_mode") or "TEXT"),
                        blocks_json=q_data.get("blocks_json"),
                    )
                    db.add(q)
                    db.flush()
                    for o_data in q_data.get("options") or []:
                        db.add(
                            AnswerOption(
                                question_id=q.id,
                                content=o_data.get("content") or "",
                                is_correct=bool(o_data.get("is_correct")),
                                media_type=o_data.get("media_type") or MediaType.NONE.value,
                                media_url=o_data.get("media_url"),
                                order_index=int(o_data.get("order_index") or 0),
                            )
                        )
                created += 1

        if need_bank:
            if replace_existing and bank_count > 0:
                for bq in db.query(BankQuestion).all():
                    db.delete(bq)
                db.flush()

            # Skip exact content duplicates when merging
            existing_contents = (
                {b.content for b in db.query(BankQuestion).all()}
                if not replace_existing
                else set()
            )
            for q_data in bank_questions:
                content = q_data.get("content") or ""
                if content in existing_contents:
                    continue
                bq = BankQuestion(
                    content=content,
                    question_type=q_data.get("question_type") or "MULTIPLE_CHOICE",
                    media_type=q_data.get("media_type") or MediaType.NONE.value,
                    media_url=q_data.get("media_url"),
                    media_position=q_data.get("media_position") or "BEFORE",
                    tags=q_data.get("tags") or "",
                    points=int(q_data.get("points") or 10),
                    blocks_json=q_data.get("blocks_json"),
                )
                db.add(bq)
                db.flush()
                for o_data in q_data.get("options") or []:
                    db.add(
                        BankAnswerOption(
                            question_id=bq.id,
                            content=o_data.get("content") or "",
                            is_correct=bool(o_data.get("is_correct")),
                            media_type=o_data.get("media_type") or MediaType.NONE.value,
                            media_url=o_data.get("media_url"),
                            order_index=int(o_data.get("order_index") or 0),
                        )
                    )
                bank_created += 1

        db.commit()
        if created:
            print(f"✓ Đã import {created} đề thi từ seed_data/content.json")
        if bank_created:
            print(f"✓ Đã import {bank_created} câu hỏi ngân hàng")
        return created > 0 or bank_created > 0 or restored > 0
    finally:
        if own_session:
            db.close()


def ensure_scratch_practice(db: Session) -> None:
    """Add circle-drawing BLOCK_PUZZLE to existing Scratch 1 exam / bank if missing."""
    from app.scratch_blocks import SAMPLE_CIRCLE_CONTENT, SAMPLE_CIRCLE_SCRIPT, dumps_script

    blocks = dumps_script(SAMPLE_CIRCLE_SCRIPT)
    exam = db.query(Exam).filter(Exam.title == "Scratch 1").first()
    if exam:
        exists = (
            db.query(Question)
            .filter(
                Question.exam_id == exam.id,
                Question.question_type == "BLOCK_PUZZLE",
            )
            .first()
        )
        if not exists:
            n = db.query(Question).filter(Question.exam_id == exam.id).count()
            db.add(
                Question(
                    exam_id=exam.id,
                    content=SAMPLE_CIRCLE_CONTENT,
                    question_type="BLOCK_PUZZLE",
                    order_index=n,
                    points=20,
                    blocks_json=blocks,
                )
            )
            if int(exam.time_per_question or 0) < 60:
                exam.time_per_question = 90
            db.commit()
    bank_exists = (
        db.query(BankQuestion)
        .filter(BankQuestion.question_type == "BLOCK_PUZZLE")
        .first()
    )
    if not bank_exists:
        db.add(
            BankQuestion(
                content=SAMPLE_CIRCLE_CONTENT,
                question_type="BLOCK_PUZZLE",
                points=20,
                tags="scratch, thực hành, hình tròn",
                blocks_json=blocks,
            )
        )
        db.commit()


# ensure_content_on_startup is defined above (near sync_content_pack)
