# -*- coding: utf-8 -*-
"""Add cat/family riddles as MULTIPLE_CHOICE (idempotent)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.database import SessionLocal, init_db
from app.models import Exam, Question, AnswerOption, MediaType, QuestionType

RIDDLES = [
    {
        "content": (
            "Câu đố: Nếu 3 con mèo bắt được 3 con chuột trong 3 phút, "
            "thì cần bao nhiêu con mèo để bắt 100 con chuột trong 100 phút?"
        ),
        "options": [
            ("1 con mèo", False),
            ("3 con mèo", True),
            ("33 con mèo", False),
            ("100 con mèo", False),
        ],
    },
    {
        "content": (
            "Một gia đình có 6 anh em trai, mỗi người anh em trai đó đều có một em gái. "
            "Hỏi gia đình đó có tất cả bao nhiêu người?"
        ),
        "options": [
            ("7 người", False),
            ("8 người", False),
            ("9 người", True),
            ("12 người", False),
        ],
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
                time_per_question=30,
            )
            db.add(exam)
            db.flush()

        existing = {
            (q.content or "").strip()
            for q in db.query(Question).filter(Question.exam_id == exam.id).all()
        }
        order = db.query(Question).filter(Question.exam_id == exam.id).count()
        added = 0
        for i, item in enumerate(RIDDLES):
            if item["content"].strip() in existing:
                continue
            q = Question(
                exam_id=exam.id,
                content=item["content"],
                question_type=QuestionType.MULTIPLE_CHOICE.value,
                order_index=order + i,
                media_type=MediaType.NONE.value,
            )
            db.add(q)
            db.flush()
            for oi, (text, correct) in enumerate(item["options"]):
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
        print(f"OK added={added}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
