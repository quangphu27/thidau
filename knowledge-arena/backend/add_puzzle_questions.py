# -*- coding: utf-8 -*-
"""Add puzzle questions (idempotent)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.database import SessionLocal, init_db
from app.models import Exam, Question, AnswerOption, MediaType, QuestionType


QUESTIONS = [
    {
        "content": "1, 3, 6, 10, 15, ?",
        "options": [("18", False), ("20", False), ("21", True), ("25", False)],
    },
    {
        "content": "Hỏi 10 con vịt donald và 20 con chó đốm có tổng bao nhiêu chân?",
        "options": [("80", False), ("90", False), ("100", True), ("120", False)],
    },
    {
        "content": (
            "Tuổi mẹ gấp 3 lần tuổi con. Sau 10 năm nữa, tuổi mẹ gấp đôi tuổi con.\n\n"
            "Hỏi hiện nay người con bao nhiêu tuổi?"
        ),
        "options": [("8", False), ("10", True), ("12", False), ("15", False)],
    },
]


def main():
    init_db()
    db = SessionLocal()
    try:
        exam = db.query(Exam).filter(Exam.title == "Toán tư duy - câu đố").first()
        if not exam:
            exam = Exam(
                title="Toán tư duy - câu đố",
                description="Các câu hỏi tư duy số học và logic dành cho học sinh",
                time_per_question=20,
            )
            db.add(exam)
            db.flush()

        existing = {
            (q.content or "").strip()
            for q in db.query(Question).filter(Question.exam_id == exam.id).all()
        }
        # Also remove incomplete duplicates from partial run
        for q in list(db.query(Question).filter(Question.exam_id == exam.id).all()):
            opts = list(q.options) if q.options is not None else []
            if q.question_type == QuestionType.MULTIPLE_CHOICE.value and len(opts) < 2:
                db.delete(q)
                existing.discard((q.content or "").strip())
        db.flush()

        existing = {
            (q.content or "").strip()
            for q in db.query(Question).filter(Question.exam_id == exam.id).all()
        }
        base_order = db.query(Question).filter(Question.exam_id == exam.id).count()
        added = 0
        for i, qd in enumerate(QUESTIONS):
            key = qd["content"].strip()
            if key in existing:
                continue
            q = Question(
                exam_id=exam.id,
                content=qd["content"],
                question_type=QuestionType.MULTIPLE_CHOICE.value,
                order_index=base_order + i,
                media_type=MediaType.NONE.value,
            )
            db.add(q)
            db.flush()
            for oi, (text, correct) in enumerate(qd["options"]):
                db.add(
                    AnswerOption(
                        question_id=q.id,
                        content=text,
                        is_correct=correct,
                        order_index=oi,
                        media_type=MediaType.NONE.value,
                    )
                )
            added += 1

        db.commit()
        total = db.query(Question).filter(Question.exam_id == exam.id).count()
        print(f"OK exam_id={exam.id} added={added} total={total}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
