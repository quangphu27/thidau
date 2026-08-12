# -*- coding: utf-8 -*-
"""Add essay riddles to bank + create Scratch quiz exam (idempotent)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.content_pack import sync_content_pack
from app.database import SessionLocal, init_db
from app.models import (
    AnswerOption,
    BankAnswerOption,
    BankQuestion,
    Exam,
    Question,
    Room,
    Submission,
)

EXAM_TITLE = "Kiểm tra Scratch"

# Logic / math essays from teacher
LOGIC_ESSAYS = [
    {
        "content": "Tìm số hạng tiếp theo của dãy 2, 6, 12, 20, 30, ?",
        "answers": ["42"],
        "tags": "tự luận, dãy số, tư duy",
    },
    {
        "content": (
            "Một con ốc sên leo lên cây cao 10m. Ban ngày leo 3m, ban đêm tụt 2m. "
            "Hỏi sau bao nhiêu ngày lên đến đỉnh?"
        ),
        "answers": ["8", "8 ngày"],
        "tags": "tự luận, logic, tư duy",
    },
    {
        "content": (
            "Có 3 con vịt đi thành hàng.\n\n"
            "Con thứ nhất nói:\n"
            "“Sau tôi có 2 con vịt.”\n\n"
            "Con thứ hai nói:\n"
            "“Trước tôi có 1 con, sau tôi có 1 con.”\n\n"
            "Con thứ ba nói:\n"
            "“Trước tôi có 2 con.”\n\n"
            "Hỏi có bao nhiêu con vịt?"
        ),
        "answers": ["3", "3 con"],
        "tags": "tự luận, logic, vịt",
    },
    {
        "content": (
            "Một chiếc balo giá 20 nghìn được giảm 20%. Hỏi phải trả bao nhiêu tiền?"
        ),
        "answers": ["16", "16 nghìn", "16000"],
        "tags": "tự luận, phần trăm, toán",
    },
    {
        "content": (
            "Một lớp có 37 học sinh. Mỗi bàn ngồi được 2 học sinh. "
            "Cần ít nhất bao nhiêu bàn?"
        ),
        "answers": ["19", "19 bàn"],
        "tags": "tự luận, làm tròn, toán",
    },
    {
        "content": (
            "Một cửa hàng có chương trình: cứ 3 vỏ chai nước rỗng thì đổi được 1 chai nước mới.\n\n"
            "Bạn muốn uống ít nhất 50 chai nước. Sau khi uống, bạn giữ lại tất cả vỏ chai "
            "để tiếp tục đổi nước.\n\n"
            "Hỏi bạn cần mua ít nhất bao nhiêu chai nước ban đầu?"
        ),
        "answers": ["35", "35 chai"],
        "tags": "tự luận, logic, vỏ chai",
    },
]

# Scratch essay (number input) — no MCQ, no block puzzle
SCRATCH_ESSAYS = [
    {
        "content": (
            "Trong Scratch:\n\n"
            "• Lặp 5 lần\n"
            "• Mỗi lần lặp lại «di chuyển 2 bước» 4 lần\n\n"
            "Tổng cộng nhân vật đi bao nhiêu bước?"
        ),
        "answers": ["40", "40 bước"],
        "tags": "scratch, tự luận, lặp",
    },
    {
        "content": (
            "Trong Scratch:\n\n"
            "• Có 1 nhân vật gốc\n"
            "• Tạo thêm 3 bản sao (clone)\n\n"
            "Có tất cả bao nhiêu nhân vật?"
        ),
        "answers": ["4", "4 nhân vật"],
        "tags": "scratch, tự luận, clone",
    },
    {
        "content": (
            "Trong Scratch:\n\n"
            "• Xoay phải 15°\n"
            "• Lặp lại khối đó 24 lần\n\n"
            "Nhân vật quay được bao nhiêu độ?"
        ),
        "answers": ["360", "360 độ"],
        "tags": "scratch, tự luận, xoay",
    },
    {
        "content": (
            "Trong Scratch:\n\n"
            "• Ban đầu có 1 nhân vật\n"
            "• Lặp 2 lần, mỗi lần tạo 1 bản sao (clone)\n\n"
            "Sau khi chạy xong có tất cả bao nhiêu nhân vật?"
        ),
        "answers": ["3", "3 nhân vật"],
        "tags": "scratch, tự luận, clone",
    },
    {
        "content": (
            "Trong Scratch:\n\n"
            "• Lặp 3 lần\n"
            "• Mỗi lần: di chuyển 4 bước\n\n"
            "Tổng cộng đi bao nhiêu bước?"
        ),
        "answers": ["12", "12 bước"],
        "tags": "scratch, tự luận, lặp",
    },
    {
        "content": (
            "Vẽ hình vuông cạnh 50 trong Scratch:\n\n"
            "• Lặp 4 lần\n"
            "• Mỗi lần: di chuyển 50 bước → xoay 90°\n\n"
            "Tổng quãng đường nhân vật đi bao nhiêu bước?"
        ),
        "answers": ["200", "200 bước"],
        "tags": "scratch, tự luận, hình vuông",
    },
    {
        "content": (
            "Trong Scratch:\n\n"
            "• Lặp «di chuyển 8 bước» 4 lần\n\n"
            "Tổng bao nhiêu bước?"
        ),
        "answers": ["32", "32 bước"],
        "tags": "scratch, tự luận, lặp",
    },
    {
        "content": (
            "Trò chơi bắt sao trong Scratch:\n\n"
            "• Điểm ban đầu = 5\n"
            "• Mỗi lần chạm sao: +2 điểm\n"
            "• Chạm sao 3 lần\n\n"
            "Điểm cuối cùng là bao nhiêu?"
        ),
        "answers": ["11", "11 điểm"],
        "tags": "scratch, tự luận, biến",
    },
    {
        "content": (
            "Game né vật cản trong Scratch:\n\n"
            "• Điểm ban đầu = 20\n"
            "• Chạm vật cản 3 lần\n"
            "• Mỗi lần chạm: trừ 5 điểm\n\n"
            "Điểm còn lại bao nhiêu?"
        ),
        "answers": ["5", "5 điểm"],
        "tags": "scratch, tự luận, biến",
    },
    {
        "content": (
            "Trong Scratch, muốn vẽ hình tròn bằng cách:\n\n"
            "• Mỗi lần xoay phải 1 độ rồi di chuyển một chút\n\n"
            "Cần lặp lại bao nhiêu lần để quay đủ một vòng?"
        ),
        "answers": ["360", "360 lần"],
        "tags": "scratch, tự luận, hình tròn",
    },
]


def _upsert_bank_essay(db, item):
    content = item["content"].strip()
    existing = db.query(BankQuestion).filter(BankQuestion.content == content).first()
    if existing:
        existing.question_type = "ESSAY"
        existing.points = 20
        existing.input_mode = "NUMBER"
        existing.tags = item["tags"]
        for old in list(existing.options):
            db.delete(old)
        db.flush()
        for i, ans in enumerate(item["answers"]):
            db.add(
                BankAnswerOption(
                    question_id=existing.id,
                    content=ans,
                    is_correct=True,
                    media_type="NONE",
                    order_index=i,
                )
            )
        return False

    bq = BankQuestion(
        content=content,
        question_type="ESSAY",
        tags=item["tags"],
        points=20,
        input_mode="NUMBER",
    )
    db.add(bq)
    db.flush()
    for i, ans in enumerate(item["answers"]):
        db.add(
            BankAnswerOption(
                question_id=bq.id,
                content=ans,
                is_correct=True,
                media_type="NONE",
                order_index=i,
            )
        )
    return True


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


def _add_essay_to_exam(db, exam_id, order, item):
    q = Question(
        exam_id=exam_id,
        content=item["content"].strip(),
        question_type="ESSAY",
        order_index=order,
        points=20,
        input_mode="NUMBER",
    )
    db.add(q)
    db.flush()
    for i, ans in enumerate(item["answers"]):
        db.add(
            AnswerOption(
                question_id=q.id,
                content=ans,
                is_correct=True,
                media_type="NONE",
                order_index=i,
            )
        )


def _interleave(logic, scratch):
    """Xen kẽ tư duy / Scratch: L S L S ... rồi phần còn lại."""
    out = []
    i = j = 0
    while i < len(logic) or j < len(scratch):
        if i < len(logic):
            out.append(logic[i])
            i += 1
        if j < len(scratch):
            out.append(scratch[j])
            j += 1
    return out


def main():
    init_db()
    db = SessionLocal()
    try:
        all_for_bank = LOGIC_ESSAYS + SCRATCH_ESSAYS
        bank_added = 0
        for item in all_for_bank:
            if _upsert_bank_essay(db, item):
                bank_added += 1
        db.commit()

        exam_order = _interleave(LOGIC_ESSAYS, SCRATCH_ESSAYS)

        exam = db.query(Exam).filter(Exam.title == EXAM_TITLE).first()
        created = False
        if not exam:
            exam = Exam(
                title=EXAM_TITLE,
                description="Bài kiểm tra: tư duy xen kẽ Scratch tự luận (nhập số)",
                time_per_question=45,
            )
            db.add(exam)
            db.flush()
            created = True
        else:
            exam.description = "Bài kiểm tra: tư duy xen kẽ Scratch tự luận (nhập số)"
            exam.time_per_question = 45
            _clear_exam_questions(db, exam.id)

        for i, item in enumerate(exam_order):
            _add_essay_to_exam(db, exam.id, i, item)

        db.commit()
        sync_content_pack(db)
        n = db.query(Question).filter(Question.exam_id == exam.id).count()
        print(f"Bank essays added: {bank_added}")
        print(
            f"Exam '{EXAM_TITLE}' {'created' if created else 'updated'}: "
            f"{n} questions (interleaved)"
        )
        for i, item in enumerate(exam_order):
            kind = "TƯ DUY" if item in LOGIC_ESSAYS else "SCRATCH"
            print(f"  {i+1}. [{kind}] {item['content'][:42].replace(chr(10), ' ')}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
