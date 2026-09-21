# -*- coding: utf-8 -*-
"""Tạo đề Scratch vui cho học sinh lớp 5–6 (tự luận nhập số)."""
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

EXAM_TITLE = "Scratch lớp 5-6"
OLD_EXAM_TITLES = ("Scratch Game khó", "Scratch lớp 5-6")

# 20 câu NUMBER — ngôn ngữ dễ, toán lớp 5–6, không dùng FPS/MIDI/...
QUESTIONS = [
    # ---------- Mèo bắt chuột (1–5) ----------
    {
        "content": (
            "Trò chơi «Mèo bắt chuột» trong Scratch:\n\n"
            "• Mỗi lần chạy, mèo tiến thêm 5 bước\n"
            "• Mèo chạy liên tục 6 lần\n\n"
            "Hỏi: mèo đã đi tất cả bao nhiêu bước?"
        ),
        "answers": ["30", "30 bước"],
        "tags": "scratch, lớp 5-6, mèo bắt chuột",
        "theme": "meo",
    },
    {
        "content": (
            "Trò chơi «Mèo bắt chuột»:\n\n"
            "• Điểm ban đầu = 0\n"
            "• Mỗi lần bắt được chuột: được thêm 10 điểm\n"
            "• Mèo bắt được 4 lần\n"
            "• Sau đó bị trừ 5 điểm vì để chuột chạy thoát\n\n"
            "Điểm cuối cùng của mèo là bao nhiêu?"
        ),
        "answers": ["35", "35 điểm"],
        "tags": "scratch, lớp 5-6, mèo bắt chuột, biến điểm",
        "theme": "meo",
    },
    {
        "content": (
            "Trong Scratch, mèo dùng vòng lặp «lặp lại 10 lần»:\n\n"
            "• Mỗi lần lặp: điểm tăng thêm 3\n"
            "• Điểm ban đầu = 0\n\n"
            "Sau khi vòng lặp chạy xong, điểm bằng bao nhiêu?"
        ),
        "answers": ["30", "30 điểm"],
        "tags": "scratch, lớp 5-6, mèo bắt chuột, vòng lặp",
        "theme": "meo",
    },
    {
        "content": (
            "Trò chơi tạo thêm chuột bằng nhân bản (clone):\n\n"
            "• Lúc bắt đầu: tạo 4 chuột clone\n"
            "• Sau đó tạo thêm 3 chuột clone nữa\n"
            "• Không xóa clone nào\n\n"
            "Tổng số chuột clone trên sân là bao nhiêu?"
        ),
        "answers": ["7", "7 clone", "7 chuột"],
        "tags": "scratch, lớp 5-6, mèo bắt chuột, clone",
        "theme": "meo",
    },
    {
        "content": (
            "Chuột có biến «mạng»:\n\n"
            "• Ban đầu mạng = 3\n"
            "• Mỗi lần bị mèo chạm: mạng giảm 1\n"
            "• Chuột bị chạm đúng 3 lần\n\n"
            "Lúc này biến «mạng» bằng bao nhiêu?"
        ),
        "answers": ["0"],
        "tags": "scratch, lớp 5-6, mèo bắt chuột, biến",
        "theme": "meo",
    },
    # ---------- Cá lớn nuốt cá bé (6–10) ----------
    {
        "content": (
            "Trò chơi «Cá lớn nuốt cá bé»:\n\n"
            "• Kích thước cá của bạn ban đầu = 40%\n"
            "• Mỗi lần nuốt cá bé: kích thước tăng thêm 10%\n"
            "• Bạn nuốt được 3 con cá bé\n\n"
            "Kích thước cuối cùng là bao nhiêu phần trăm?"
        ),
        "answers": ["70", "70%", "70 phần trăm"],
        "tags": "scratch, lớp 5-6, cá lớn nuốt cá bé",
        "theme": "ca",
    },
    {
        "content": (
            "Trong trò «Cá lớn nuốt cá bé»:\n\n"
            "• Mỗi lần nuốt được 1 cá bé: được 5 điểm\n"
            "• Bạn nuốt được 6 con\n"
            "• Không bị trừ điểm\n\n"
            "Tổng điểm là bao nhiêu?"
        ),
        "answers": ["30", "30 điểm"],
        "tags": "scratch, lớp 5-6, cá lớn nuốt cá bé, điểm",
        "theme": "ca",
    },
    {
        "content": (
            "Tạo cá địch bằng clone:\n\n"
            "• Gửi tin nhắn «tạo cá» đúng 3 lần\n"
            "• Mỗi lần nhận tin nhắn: tạo 4 clone cá\n"
            "• Không xóa clone nào\n\n"
            "Tổng số clone cá được tạo là bao nhiêu?"
        ),
        "answers": ["12", "12 clone"],
        "tags": "scratch, lớp 5-6, cá lớn nuốt cá bé, clone",
        "theme": "ca",
    },
    {
        "content": (
            "Cá của bạn chỉ nuốt được cá nhỏ hơn mình:\n\n"
            "• Cá bạn có kích thước 50\n"
            "• Gặp lần lượt các cá: 30, 60, 20, 45, 70\n"
            "• Nuốt được khi số của đối thủ nhỏ hơn 50\n\n"
            "Bạn nuốt được bao nhiêu con?"
        ),
        "answers": ["3", "3 con"],
        "tags": "scratch, lớp 5-6, cá lớn nuốt cá bé, điều kiện",
        "theme": "ca",
    },
    {
        "content": (
            "Cá di chuyển bằng phím mũi tên:\n\n"
            "• Ban đầu tọa độ x = 0\n"
            "• Mỗi lần ấn phải: x tăng 10\n"
            "• Mỗi lần ấn trái: x giảm 10\n"
            "• Ấn phải 5 lần, rồi ấn trái 2 lần\n\n"
            "Tọa độ x lúc cuối bằng bao nhiêu?"
        ),
        "answers": ["30"],
        "tags": "scratch, lớp 5-6, cá lớn nuốt cá bé, tọa độ",
        "theme": "ca",
    },
    # ---------- Đàn piano (11–15) ----------
    {
        "content": (
            "Dự án «Đàn piano» trong Scratch:\n\n"
            "• Mỗi nốt phát trong 1 giây\n"
            "• Bạn chơi liên tiếp 4 nốt (không nghỉ giữa các nốt)\n\n"
            "Tổng thời gian phát nhạc là bao nhiêu giây?"
        ),
        "answers": ["4", "4 giây"],
        "tags": "scratch, lớp 5-6, đàn piano",
        "theme": "piano",
    },
    {
        "content": (
            "Piano dùng biến «số_nốt»:\n\n"
            "• Ban đầu số_nốt = 1\n"
            "• Mỗi lần bấm phím: số_nốt tăng thêm 1\n"
            "• Bạn bấm phím đúng 7 lần\n\n"
            "Giá trị biến số_nốt sau cùng là bao nhiêu?"
        ),
        "answers": ["8"],
        "tags": "scratch, lớp 5-6, đàn piano, biến",
        "theme": "piano",
    },
    {
        "content": (
            "Tạo các phím piano bằng clone:\n\n"
            "• Ban đầu biến i = 0\n"
            "• Lặp 5 lần: tạo 1 clone, rồi tăng i thêm 1\n"
            "• Mỗi clone đặt vị trí x = 20 × i\n\n"
            "Clone cuối (khi i = 4) có tọa độ x bằng bao nhiêu?"
        ),
        "answers": ["80"],
        "tags": "scratch, lớp 5-6, đàn piano, clone",
        "theme": "piano",
    },
    {
        "content": (
            "Khối «phát âm thanh … cho đến khi kết thúc» kéo dài 2 giây.\n\n"
            "• Đặt khối này trong vòng lặp «lặp 3 lần»\n"
            "• Không có khối chờ nào khác\n\n"
            "Chương trình mất bao nhiêu giây để chạy xong vòng lặp?"
        ),
        "answers": ["6", "6 giây"],
        "tags": "scratch, lớp 5-6, đàn piano, âm thanh",
        "theme": "piano",
    },
    {
        "content": (
            "Nhân vật «Nhạc trưởng» gửi tin nhắn «chơi»:\n\n"
            "• Gửi tin nhắn đúng 5 lần\n"
            "• Mỗi lần nhận tin, nhân vật «Phím» tăng biến «đếm» thêm 1\n"
            "• Ban đầu đếm = 0\n\n"
            "Sau khi nhận đủ tin nhắn, biến đếm bằng bao nhiêu?"
        ),
        "answers": ["5"],
        "tags": "scratch, lớp 5-6, đàn piano, tin nhắn",
        "theme": "piano",
    },
    # ---------- Vẽ hoa sen (16–20) ----------
    {
        "content": (
            "Vẽ hoa sen bằng bút trong Scratch:\n\n"
            "• Hoa có 6 cánh\n"
            "• Mỗi cánh dùng khối «di chuyển 50» đúng 2 lần\n\n"
            "Tổng số lần dùng khối «di chuyển 50» là bao nhiêu?"
        ),
        "answers": ["12", "12 lần"],
        "tags": "scratch, lớp 5-6, vẽ hoa sen",
        "theme": "hoa",
    },
    {
        "content": (
            "Vẽ vòng tròn nhụy hoa:\n\n"
            "• Mỗi lần: di chuyển một chút rồi xoay phải 30 độ\n"
            "• Muốn xoay đủ 1 vòng tròn (360 độ)\n\n"
            "Cần lặp bao nhiêu lần?"
        ),
        "answers": ["12", "12 lần"],
        "tags": "scratch, lớp 5-6, vẽ hoa sen, vòng lặp",
        "theme": "hoa",
    },
    {
        "content": (
            "Vẽ hoa sen 2 lớp:\n\n"
            "• Lớp ngoài: 8 cánh\n"
            "• Lớp trong: 5 cánh\n"
            "• Mỗi cánh tính là 1 nét vẽ\n\n"
            "Tổng số cánh (nét vẽ) là bao nhiêu?"
        ),
        "answers": ["13", "13 cánh", "13 nét"],
        "tags": "scratch, lớp 5-6, vẽ hoa sen",
        "theme": "hoa",
    },
    {
        "content": (
            "Đổi màu bút khi vẽ hoa:\n\n"
            "• Biến màu ban đầu = 0\n"
            "• Mỗi cánh: tăng màu thêm 10 rồi mới vẽ\n"
            "• Vẽ đúng 5 cánh\n\n"
            "Sau cánh cuối, biến màu bằng bao nhiêu?"
        ),
        "answers": ["50"],
        "tags": "scratch, lớp 5-6, vẽ hoa sen, màu",
        "theme": "hoa",
    },
    {
        "content": (
            "Vẽ 3 lá sen:\n\n"
            "• Mỗi lá: lặp 10 lần khối «di chuyển 4»\n"
            "• Vẽ đủ 3 lá\n\n"
            "Tổng số lần chạy khối «di chuyển 4» là bao nhiêu?"
        ),
        "answers": ["30", "30 lần"],
        "tags": "scratch, lớp 5-6, vẽ hoa sen, lá sen",
        "theme": "hoa",
    },
]


def _upsert_bank(db, item):
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


def _add_to_exam(db, exam_id, order, item):
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


def _cleanup_old_bank(db):
    """Xóa bank cũ của gói Scratch này (tránh còn câu FPS / khó)."""
    rows = (
        db.query(BankQuestion)
        .filter(
            (BankQuestion.tags.ilike("%mèo bắt chuột%"))
            | (BankQuestion.tags.ilike("%cá lớn nuốt cá bé%"))
            | (BankQuestion.tags.ilike("%đàn piano%"))
            | (BankQuestion.tags.ilike("%vẽ hoa sen%"))
            | (BankQuestion.tags.ilike("%FPS%"))
            | (BankQuestion.tags.ilike("%lớp 5-6%"))
        )
        .all()
    )
    for bq in rows:
        for opt in list(bq.options):
            db.delete(opt)
        db.delete(bq)
    db.flush()


def main():
    assert len(QUESTIONS) == 20, len(QUESTIONS)
    # Chặn thuật ngữ không phù hợp lớp 5–6
    banned = ("FPS", "MIDI", "khung hình", "sprite", "wave", "random(")
    for item in QUESTIONS:
        low = item["content"] + " " + item["tags"]
        for bad in banned:
            assert bad.lower() not in low.lower(), f"Banned term {bad!r} in: {item['content'][:40]}"

    init_db()
    db = SessionLocal()
    try:
        _cleanup_old_bank(db)
        added = 0
        for item in QUESTIONS:
            if _upsert_bank(db, item):
                added += 1
        db.commit()

        exam = None
        for title in OLD_EXAM_TITLES:
            exam = db.query(Exam).filter(Exam.title == title).first()
            if exam:
                break

        created = False
        desc = (
            "20 câu Scratch vui cho lớp 5–6: mèo bắt chuột, cá lớn nuốt cá bé, "
            "đàn piano, vẽ hoa sen (tự luận nhập số)"
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
            exam.title = EXAM_TITLE
            exam.description = desc
            exam.time_per_question = 60
            _clear_exam_questions(db, exam.id)

        for i, item in enumerate(QUESTIONS):
            _add_to_exam(db, exam.id, i, item)

        db.commit()
        sync_content_pack(db)
        n = db.query(Question).filter(Question.exam_id == exam.id).count()
        labels = {
            "meo": "Mèo–chuột",
            "ca": "Cá lớn–bé",
            "piano": "Piano",
            "hoa": "Hoa sen",
        }
        print(f"Bank added: {added}")
        print(f"Exam '{EXAM_TITLE}' {'created' if created else 'updated'}: {n} questions")
        for i, item in enumerate(QUESTIONS):
            preview = item["content"].replace("\n", " ")[:56]
            print(f"  {i+1:02d}. [{labels[item['theme']]}] {preview}...")
            print(f"      -> {item['answers'][0]}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
