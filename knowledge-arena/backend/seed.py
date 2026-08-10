"""Seed sample data for Đấu Trường Kiến Thức."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.content_pack import CONTENT_FILE, import_content
from app.database import SessionLocal, init_db
from app.models import Admin, AnswerOption, Exam, Question, QuestionType, MediaType
from app.utils import hash_password


def seed():
    init_db()
    db = SessionLocal()
    try:
        admin = db.query(Admin).filter(Admin.username == "admin").first()
        if not admin:
            db.add(Admin(username="admin", password_hash=hash_password("admin123")))
            print("✓ Tạo admin: admin / admin123")
        else:
            print("• Admin đã tồn tại")

        # Prefer portable pack (survives git clone)
        if CONTENT_FILE.is_file():
            db.commit()
            import_content(only_if_empty=True)
            db.expire_all()
            if db.query(Exam).count() > 0:
                print("• Đã dùng seed_data/content.json")
                return

        existing = db.query(Exam).first()
        if existing:
            print("• Đã có đề thi, bỏ qua seed mẫu.")
            db.commit()
            return

        # Exam 1: Python cơ bản
        exam1 = Exam(
            title="Python cơ bản",
            description="Bài thi đấu về kiến thức Python dành cho học sinh lớp 7-9",
            time_per_question=15,
        )
        db.add(exam1)
        db.flush()

        questions_data = [
            {
                "content": "Python dùng hàm nào để in dữ liệu ra màn hình?",
                "type": "MULTIPLE_CHOICE",
                "options": [
                    ("input()", False),
                    ("print()", True),
                    ("output()", False),
                    ("display()", False),
                ],
            },
            {
                "content": "Kiểu dữ liệu nào dùng để lưu chuỗi ký tự trong Python?",
                "type": "MULTIPLE_CHOICE",
                "options": [
                    ("int", False),
                    ("float", False),
                    ("str", True),
                    ("bool", False),
                ],
            },
            {
                "content": "Cú pháp nào đúng để tạo một list trong Python?",
                "type": "MULTIPLE_CHOICE",
                "options": [
                    ("list = (1, 2, 3)", False),
                    ("list = [1, 2, 3]", True),
                    ("list = {1, 2, 3}", False),
                    ("list = <1, 2, 3>", False),
                ],
            },
            {
                "content": "Toán tử nào dùng để lấy phần dư của phép chia?",
                "type": "MULTIPLE_CHOICE",
                "options": [
                    ("/", False),
                    ("//", False),
                    ("%", True),
                    ("**", False),
                ],
            },
            {
                "content": "Hàm nào dùng để lấy độ dài của một list?",
                "type": "MULTIPLE_CHOICE",
                "options": [
                    ("size()", False),
                    ("length()", False),
                    ("len()", True),
                    ("count()", False),
                ],
            },
            {
                "content": "Câu lệnh nào đúng để kiểm tra điều kiện trong Python?",
                "type": "MULTIPLE_CHOICE",
                "options": [
                    ("if x == 5:", True),
                    ("if x = 5 then", False),
                    ("if (x == 5)", False),
                    ("when x == 5:", False),
                ],
            },
            {
                "content": "Vòng lặp for nào đúng để duyệt từ 0 đến 4?",
                "type": "MULTIPLE_CHOICE",
                "options": [
                    ("for i in range(5):", True),
                    ("for i in range(0, 4):", False),
                    ("for i = 0 to 4:", False),
                    ("foreach i in 5:", False),
                ],
            },
            {
                "content": "Kết quả của biểu thức: 2 ** 3 là bao nhiêu?",
                "type": "MULTIPLE_CHOICE",
                "options": [
                    ("5", False),
                    ("6", False),
                    ("8", True),
                    ("9", False),
                ],
            },
            {
                "content": "Hãy viết một dòng lệnh Python in ra chữ 'Xin chào'.",
                "type": "ESSAY",
                "options": [
                    ('print("Xin chào")', True),
                    ("print('Xin chào')", True),
                    ('print("Xin chao")', True),
                    ("print('Xin chao')", True),
                ],
            },
            {
                "content": "Từ khóa nào dùng để định nghĩa hàm trong Python?",
                "type": "ESSAY",
                "options": [
                    ("def", True),
                    ("DEF", True),
                ],
            },
        ]

        for idx, qd in enumerate(questions_data):
            q = Question(
                exam_id=exam1.id,
                content=qd["content"],
                question_type=qd["type"],
                order_index=idx,
                media_type=MediaType.NONE.value,
            )
            db.add(q)
            db.flush()
            for oi, item in enumerate(qd["options"]):
                if isinstance(item, tuple):
                    text, correct = item
                else:
                    text, correct = item, True
                db.add(
                    AnswerOption(
                        question_id=q.id,
                        content=text,
                        is_correct=correct if qd["type"] != "ESSAY" else True,
                        order_index=oi,
                        media_type=MediaType.NONE.value,
                    )
                )

        # Exam 2: Tin học phổ thông
        exam2 = Exam(
            title="Tin học phổ thông",
            description="Câu hỏi kiến thức tin học tổng quát",
            time_per_question=20,
        )
        db.add(exam2)
        db.flush()

        exam2_qs = [
            {
                "content": "1 Byte bằng bao nhiêu Bit?",
                "options": [("4", False), ("8", True), ("16", False), ("32", False)],
            },
            {
                "content": "Phím tắt Copy trên Windows là gì?",
                "options": [
                    ("Ctrl + X", False),
                    ("Ctrl + C", True),
                    ("Ctrl + V", False),
                    ("Ctrl + Z", False),
                ],
            },
            {
                "content": "HTML là viết tắt của?",
                "options": [
                    ("Hyper Text Markup Language", True),
                    ("High Tech Modern Language", False),
                    ("Home Tool Markup Language", False),
                    ("Hyperlinks and Text Markup Language", False),
                ],
            },
            {
                "content": "Thiết bị nào dùng để lưu trữ dữ liệu lâu dài?",
                "options": [
                    ("RAM", False),
                    ("CPU", False),
                    ("Ổ cứng (HDD/SSD)", True),
                    ("Cache", False),
                ],
            },
            {
                "content": "Đơn vị đo tốc độ mạng phổ biến là?",
                "options": [
                    ("Hz", False),
                    ("Mbps", True),
                    ("Pixel", False),
                    ("Watt", False),
                ],
            },
        ]
        for idx, qd in enumerate(exam2_qs):
            q = Question(
                exam_id=exam2.id,
                content=qd["content"],
                question_type=QuestionType.MULTIPLE_CHOICE.value,
                order_index=idx,
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

        # Exam 3: Toán tư duy - câu đố
        exam3 = Exam(
            title="Toán tư duy - câu đố",
            description="Các câu hỏi tư duy số học và logic dành cho học sinh",
            time_per_question=20,
        )
        db.add(exam3)
        db.flush()

        exam3_qs = [
            {
                "content": "1, 3, 6, 10, 15, ?",
                "type": "MULTIPLE_CHOICE",
                "options": [("18", False), ("20", False), ("21", True), ("25", False)],
            },
            {
                "content": "Hỏi 10 con vịt donald và 20 con chó đốm có tổng bao nhiêu chân?",
                "type": "MULTIPLE_CHOICE",
                "options": [("80", False), ("90", False), ("100", True), ("120", False)],
            },
            {
                "content": (
                    "Tuổi mẹ gấp 3 lần tuổi con. Sau 10 năm nữa, tuổi mẹ gấp đôi tuổi con.\n\n"
                    "Hỏi hiện nay người con bao nhiêu tuổi?"
                ),
                "type": "MULTIPLE_CHOICE",
                "options": [("8", False), ("10", True), ("12", False), ("15", False)],
            },
            {
                "content": (
                    "Câu đố: Nếu 3 con mèo bắt được 3 con chuột trong 3 phút, "
                    "thì cần bao nhiêu con mèo để bắt 100 con chuột trong 100 phút?"
                ),
                "type": "MULTIPLE_CHOICE",
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
                "type": "MULTIPLE_CHOICE",
                "options": [
                    ("7 người", False),
                    ("8 người", False),
                    ("9 người", True),
                    ("12 người", False),
                ],
            },
        ]
        for idx, qd in enumerate(exam3_qs):
            q = Question(
                exam_id=exam3.id,
                content=qd["content"],
                question_type=qd.get("type", QuestionType.MULTIPLE_CHOICE.value),
                order_index=idx,
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

        db.commit()
        print("✓ Đã tạo 3 bài thi mẫu với câu hỏi")
        print("✓ Exam 1: Python cơ bản (10 câu, có tự luận tự chấm)")
        print("✓ Exam 2: Tin học phổ thông (5 câu)")
        print("✓ Exam 3: Toán tư duy - câu đố (5 câu)")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
