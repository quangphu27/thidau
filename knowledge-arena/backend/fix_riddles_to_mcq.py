# -*- coding: utf-8 -*-
"""Convert cat/family riddles from ESSAY to MULTIPLE_CHOICE."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.database import SessionLocal, init_db
from app.models import Exam, Question, AnswerOption, MediaType, QuestionType

UPDATES = [
    {
        "match": "3 con mèo bắt được 3 con chuột",
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
        "match": "6 anh em trai",
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
            print("EXAM_NOT_FOUND")
            return

        for item in UPDATES:
            q = (
                db.query(Question)
                .filter(
                    Question.exam_id == exam.id,
                    Question.content.contains(item["match"]),
                )
                .first()
            )
            if not q:
                # create if missing
                q = Question(
                    exam_id=exam.id,
                    content=item["content"],
                    question_type=QuestionType.MULTIPLE_CHOICE.value,
                    order_index=db.query(Question).filter(Question.exam_id == exam.id).count(),
                    media_type=MediaType.NONE.value,
                )
                db.add(q)
                db.flush()
            else:
                q.content = item["content"]
                q.question_type = QuestionType.MULTIPLE_CHOICE.value
                for old in list(q.options):
                    db.delete(old)
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
            print(f"OK qid={q.id} -> MCQ")

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
