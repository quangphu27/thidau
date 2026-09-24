# -*- coding: utf-8 -*-
"""Tạo đề Trung thu: 8 TN Scratch cũ + câu đố + video chú Cuội."""
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.content_pack import sync_content_pack
from app.database import SessionLocal, UPLOAD_DIR, init_db
from app.models import (
    AnswerOption,
    BankAnswerOption,
    BankQuestion,
    Exam,
    MediaType,
    Question,
    QuestionType,
    Room,
    Submission,
)

EXAM_TITLE = "Trung thu vui vẻ"
VIDEO_NAME = "su_tich_chu_cuoi_trung_thu.mp4"
BGM_NAME = "amthanh.mp3"
VIDEO_URL = f"/media/videos/{VIDEO_NAME}"
BGM_URL = f"/media/videos/{BGM_NAME}"

ROOT = Path(__file__).resolve().parent
SCRATCH8_PATH = ROOT / "_scratch8.json"


def _mc(content, options, points=10):
    """options: list of (text, is_correct)."""
    return {
        "content": content.strip(),
        "question_type": QuestionType.MULTIPLE_CHOICE.value,
        "media_type": MediaType.NONE.value,
        "media_url": None,
        "media_position": "BEFORE",
        "points": points,
        "input_mode": "TEXT",
        "options": [
            {"content": t, "is_correct": c, "order_index": i}
            for i, (t, c) in enumerate(options)
        ],
    }


def _essay(content, answers, points=20, input_mode="TEXT"):
    return {
        "content": content.strip(),
        "question_type": QuestionType.ESSAY.value,
        "media_type": MediaType.NONE.value,
        "media_url": None,
        "media_position": "BEFORE",
        "points": points,
        "input_mode": input_mode,
        "options": [
            {"content": a, "is_correct": True, "order_index": i}
            for i, a in enumerate(answers)
        ],
    }


def _load_scratch8():
    if SCRATCH8_PATH.exists():
        data = json.loads(SCRATCH8_PATH.read_text(encoding="utf-8"))
        out = []
        for item in data[:8]:
            out.append(
                {
                    "content": item["content"].strip(),
                    "question_type": QuestionType.MULTIPLE_CHOICE.value,
                    "media_type": MediaType.NONE.value,
                    "media_url": None,
                    "media_position": "BEFORE",
                    "points": int(item.get("points") or 10),
                    "input_mode": "TEXT",
                    "options": [
                        {
                            "content": o["content"],
                            "is_correct": bool(o["is_correct"]),
                            "order_index": int(o.get("order_index") or i),
                        }
                        for i, o in enumerate(item["options"])
                    ],
                }
            )
        return out

    # Fallback: đọc từ đề cũ trong DB
    db = SessionLocal()
    try:
        e = db.query(Exam).filter(Exam.title == "Ai thông minh hơn học sinh lớp 3").first()
        if not e:
            raise SystemExit("Không tìm thấy đề Scratch cũ và thiếu _scratch8.json")
        skip = ("thầy phú", "vịt donald", "gia đình có 6")
        picked = []
        for q in (
            db.query(Question)
            .filter(
                Question.exam_id == e.id,
                Question.question_type == QuestionType.MULTIPLE_CHOICE.value,
            )
            .order_by(Question.order_index)
        ):
            c = (q.content or "").strip()
            if any(k in c.lower() for k in skip):
                continue
            opts = sorted(q.options, key=lambda o: o.order_index or 0)
            picked.append(
                {
                    "content": c,
                    "question_type": QuestionType.MULTIPLE_CHOICE.value,
                    "media_type": MediaType.NONE.value,
                    "media_url": None,
                    "media_position": "BEFORE",
                    "points": q.points or 10,
                    "input_mode": "TEXT",
                    "options": [
                        {
                            "content": o.content,
                            "is_correct": bool(o.is_correct),
                            "order_index": i,
                        }
                        for i, o in enumerate(opts)
                    ],
                }
            )
            if len(picked) >= 8:
                break
        return picked
    finally:
        db.close()


def _riddle_questions():
    return [
        _mc(
            "Con gì bỏ đuôi thành ngựa?",
            [
                ("Con chó", False),
                ("Con mèo", True),
                ("Con ngựa", False),
                ("Con hổ", False),
            ],
            points=10,
        ),
        _mc(
            (
                "Ba công tắc 💡\n\n"
                "Bên ngoài một căn phòng có 3 công tắc. Trong phòng có 3 bóng đèn. "
                "Mỗi công tắc điều khiển một bóng. Bạn chỉ được vào phòng đúng 1 lần.\n\n"
                "Cách nào đúng để biết công tắc nào điều khiển bóng nào?"
            ),
            [
                (
                    "Bật lần lượt cả 3 công tắc rồi vào phòng nhìn bóng nào sáng",
                    False,
                ),
                (
                    "Bật công tắc 1 một lúc rồi tắt, bật công tắc 2, vào phòng: "
                    "bóng nóng = 1, bóng sáng = 2, bóng tối lạnh = 3",
                    True,
                ),
                (
                    "Chỉ bật công tắc 3 rồi vào phòng",
                    False,
                ),
                (
                    "Không thể biết nếu chỉ vào phòng 1 lần",
                    False,
                ),
            ],
            points=15,
        ),
        _mc(
            (
                "Có 3 con gà đứng trước 3 con gà, 3 con gà đứng sau 3 con gà "
                "và 3 con gà đứng giữa 3 con gà. Hỏi có ít nhất bao nhiêu con gà?"
            ),
            [
                ("3 con", False),
                ("6 con", True),
                ("9 con", False),
                ("12 con", False),
            ],
            points=10,
        ),
        _mc(
            (
                "Bạn đang chạy đua. Bạn vượt qua người đang đứng thứ 2. "
                "Hỏi bây giờ bạn đứng thứ mấy?\n\n"
                "A. Thứ 1\n"
                "B. Thứ 2\n"
                "C. Thứ 3\n"
                "D. Không xác định"
            ),
            [
                ("Thứ 1", False),
                ("Thứ 2", True),
                ("Thứ 3", False),
                ("Không xác định", False),
            ],
            points=10,
        ),
        _mc(
            (
                "Một người đi dưới trời mưa rất lớn nhưng không mang ô, không đội mũ. "
                "Quần áo ướt hết nhưng tóc không hề ướt.\n\nTại sao?"
            ),
            [
                ("Người đó đứng trong nhà", False),
                ("Người đó bị hói", True),
                ("Mưa không rơi lên đầu", False),
                ("Người đó đội mũ vô hình", False),
            ],
            points=10,
        ),
        _mc(
            (
                "Có 2 người cha và 2 người con đi câu cá. Mỗi người bắt được 1 con cá. "
                "Tổng cộng chỉ có 3 con cá.\n\nTại sao?"
            ),
            [
                ("Một người không bắt được cá", False),
                ("Họ gồm 3 người: ông, bố và con", True),
                ("Đếm nhầm số cá", False),
                ("Có cá bị thả lại", False),
            ],
            points=10,
        ),
        {
            "content": (
                "Trong sự tích chú Cuội cung trăng, cuối cùng chú Cuội ở đâu?"
            ).strip(),
            "question_type": QuestionType.MULTIPLE_CHOICE.value,
            "media_type": MediaType.NONE.value,
            "media_url": None,
            "media_position": "BEFORE",
            "points": 15,
            "input_mode": "TEXT",
            "options": [
                {"content": "Dưới đáy biển", "is_correct": False, "order_index": 0},
                {"content": "Cung trăng (ngồi gốc cây đa)", "is_correct": True, "order_index": 1},
                {"content": "Hang cọp trong rừng", "is_correct": False, "order_index": 2},
                {"content": "Nhà vua ở kinh thành", "is_correct": False, "order_index": 3},
            ],
        },
        _mc(
            "Chúc các bạn một mùa Trung thu thật vui vẻ! 🥮🏮\n\nCây thuốc quý của chú Cuội có phép gì?",
            [
                ("Bay lên mặt trời", False),
                ("Cải tử hoàn sinh (cứu sống người)", True),
                ("Đổi vàng lấy đá", False),
                ("Làm mưa suốt năm", False),
            ],
            points=10,
        ),
    ]


def _ensure_media_file(name: str) -> Path:
    """Đảm bảo file có trong uploads/videos và seed_data/media/videos."""
    seed = ROOT / "seed_data" / "media" / "videos" / name
    dest_dir = UPLOAD_DIR / "videos"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / name
    if seed.exists():
        if not dest.exists() or dest.stat().st_size != seed.stat().st_size:
            shutil.copy2(seed, dest)
    elif dest.exists():
        seed.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(dest, seed)
    else:
        raise SystemExit(f"Thiếu media: {seed} (hoặc {dest})")
    return dest


def _ensure_video():
    _ensure_media_file(VIDEO_NAME)
    _ensure_media_file(BGM_NAME)
    return VIDEO_URL


def _clear_exam_questions(db, exam_id):
    qids = [r[0] for r in db.query(Question.id).filter(Question.exam_id == exam_id).all()]
    if not qids:
        return
    db.query(Room).filter(Room.current_question_id.in_(qids)).update(
        {Room.current_question_id: None}, synchronize_session=False
    )
    db.query(Submission).filter(Submission.question_id.in_(qids)).update(
        {Submission.answer_id: None}, synchronize_session=False
    )
    db.query(Submission).filter(Submission.question_id.in_(qids)).delete(
        synchronize_session=False
    )
    db.query(AnswerOption).filter(AnswerOption.question_id.in_(qids)).delete(
        synchronize_session=False
    )
    db.query(Question).filter(Question.id.in_(qids)).delete(synchronize_session=False)
    db.commit()


def _add_question(db, exam_id, order, item):
    q = Question(
        exam_id=exam_id,
        content=item["content"],
        question_type=item["question_type"],
        order_index=order,
        points=item.get("points") or 10,
        input_mode=item.get("input_mode") or "TEXT",
        media_type=item.get("media_type") or MediaType.NONE.value,
        media_url=item.get("media_url"),
        media_position=item.get("media_position") or "BEFORE",
    )
    db.add(q)
    db.flush()
    for o in item["options"]:
        db.add(
            AnswerOption(
                question_id=q.id,
                content=o["content"],
                is_correct=bool(o["is_correct"]),
                order_index=int(o.get("order_index") or 0),
                media_type=MediaType.NONE.value,
            )
        )


def _upsert_bank(db, item, tags):
    content = item["content"]
    existing = db.query(BankQuestion).filter(BankQuestion.content == content).first()
    if existing:
        existing.question_type = item["question_type"]
        existing.points = item.get("points") or 10
        existing.input_mode = item.get("input_mode") or "TEXT"
        existing.media_type = item.get("media_type") or MediaType.NONE.value
        existing.media_url = item.get("media_url")
        existing.media_position = item.get("media_position") or "BEFORE"
        existing.tags = tags
        for old in list(existing.options):
            db.delete(old)
        db.flush()
        bq = existing
    else:
        bq = BankQuestion(
            content=content,
            question_type=item["question_type"],
            tags=tags,
            points=item.get("points") or 10,
            input_mode=item.get("input_mode") or "TEXT",
            media_type=item.get("media_type") or MediaType.NONE.value,
            media_url=item.get("media_url"),
            media_position=item.get("media_position") or "BEFORE",
        )
        db.add(bq)
        db.flush()
    for o in item["options"]:
        db.add(
            BankAnswerOption(
                question_id=bq.id,
                content=o["content"],
                is_correct=bool(o["is_correct"]),
                order_index=int(o.get("order_index") or 0),
                media_type=MediaType.NONE.value,
            )
        )


def main():
    init_db()
    video_url = _ensure_video()
    scratch = _load_scratch8()
    assert len(scratch) == 8, f"Cần đúng 8 câu Scratch, có {len(scratch)}"
    riddles = _riddle_questions()
    questions = scratch + riddles
    db = SessionLocal()
    try:
        for item in questions:
            tag = (
                "trung thu, scratch"
                if item in scratch
                else "trung thu, câu đố"
            )
            _upsert_bank(db, item, tag)
        db.commit()

        exam = db.query(Exam).filter(Exam.title == EXAM_TITLE).first()
        desc = (
            "Trung thu: 8 câu trắc nghiệm Scratch + câu đố tư duy. "
            "Video tổng kết Sự tích chú Cuội (toàn màn hình) khi kết thúc phòng."
        )
        if not exam:
            exam = Exam(
                title=EXAM_TITLE,
                description=desc,
                time_per_question=60,
            )
            db.add(exam)
            db.flush()
            created = True
        else:
            exam.description = desc
            exam.time_per_question = 60
            _clear_exam_questions(db, exam.id)
            created = False

        for i, item in enumerate(questions):
            _add_question(db, exam.id, i, item)
        db.commit()
        sync_content_pack(db)
        n = db.query(Question).filter(Question.exam_id == exam.id).count()
        print(f"Exam '{EXAM_TITLE}' {'created' if created else 'updated'}: {n} questions")
        print(f"Summary video ready: {video_url}")
        for i, item in enumerate(questions):
            kind = item["question_type"]
            preview = item["content"].replace("\n", " ")[:64]
            print(f"  {i+1:02d}. [{kind}] {preview}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
