"""Import Scratch questions JSON into the question bank (no images)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.content_pack import sync_content_pack
from app.database import SessionLocal, init_db
from app.models import BankAnswerOption, BankQuestion

SRC = Path(__file__).resolve().parent / "seed_data" / "scratch_questions.json"


def main():
    init_db()
    payload = json.loads(SRC.read_text(encoding="utf-8"))
    course = payload.get("course") or "Scratch"
    questions = payload.get("questions") or []

    db = SessionLocal()
    try:
        existing = {q.content for q in db.query(BankQuestion).all()}
        added = 0
        skipped = 0
        for item in questions:
            content = (item.get("cau_hoi") or "").strip()
            if not content:
                continue
            if content in existing:
                skipped += 1
                continue

            level = item.get("level") or ""
            category = item.get("category") or ""
            tags = ", ".join(
                p for p in [course, level, category.replace("_", " ")] if p
            )

            correct = (item.get("dap_an_dung") or "").strip()
            options = item.get("dap_an") or []
            if correct not in options:
                print(f"! Bỏ qua STT {item.get('stt')}: đáp án đúng không khớp danh sách")
                continue

            bq = BankQuestion(
                content=content,
                question_type="MULTIPLE_CHOICE",
                media_type="NONE",
                media_url=None,
                media_position="BEFORE",
                tags=tags,
            )
            db.add(bq)
            db.flush()
            for i, text in enumerate(options):
                db.add(
                    BankAnswerOption(
                        question_id=bq.id,
                        content=text,
                        is_correct=(text == correct),
                        media_type="NONE",
                        media_url=None,
                        order_index=i,
                    )
                )
            existing.add(content)
            added += 1

        db.commit()
        sync_content_pack(db)
        print(f"✓ Đã thêm {added} câu Scratch vào ngân hàng (bỏ qua trùng: {skipped})")
        print(f"✓ Tổng câu trong ngân hàng: {db.query(BankQuestion).count()}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
