from datetime import datetime, timedelta, timezone
from typing import Optional
import secrets
import string

from jose import JWTError, jwt
from passlib.context import CryptContext

SECRET_KEY = "knowledge-arena-secret-change-in-production-2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


def generate_room_code(length: int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    # Avoid ambiguous chars
    alphabet = alphabet.replace("O", "").replace("0", "").replace("I", "").replace("1", "")
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_player_id() -> str:
    return secrets.token_hex(16)


ERROR_MESSAGES = {
    "ROOM_NOT_FOUND": "Không tìm thấy phòng thi",
    "ROOM_ALREADY_STARTED": "Phòng thi đã bắt đầu",
    "ROOM_FINISHED": "Phòng thi đã kết thúc",
    "ROOM_NOT_RUNNING": "Phòng thi chưa đang chạy",
    "ROOM_PAUSED": "Phòng thi đang tạm dừng",
    "ALREADY_SUBMITTED": "Bạn đã trả lời câu hỏi này rồi",
    "QUESTION_ALREADY_ANSWERED": "Đã có người trả lời câu hỏi này",
    "QUESTION_EXPIRED": "Đã hết thời gian trả lời",
    "INVALID_ANSWER": "Đáp án không hợp lệ",
    "NOT_ALLOWED": "Không được phép thực hiện",
    "PLAYER_NOT_FOUND": "Không tìm thấy người chơi",
    "EXAM_NOT_FOUND": "Không tìm thấy bài thi",
    "EXAM_IN_USE": "Không thể sửa bài thi đang được sử dụng trong phòng đang chạy",
    "QUESTION_NOT_FOUND": "Không tìm thấy câu hỏi",
    "NO_QUESTIONS": "Bài thi chưa có câu hỏi",
    "INVALID_CREDENTIALS": "Sai tên đăng nhập hoặc mật khẩu",
    "NAME_REQUIRED": "Vui lòng nhập tên",
    "NAME_TOO_LONG": "Tên quá dài (tối đa 50 ký tự)",
    "WRONG_QUESTION": "Đây không phải câu hỏi hiện tại",
    "GAME_NOT_STARTED": "Cuộc thi chưa bắt đầu",
    "NO_MORE_QUESTIONS": "Đã hết câu hỏi",
}


def normalize_answer(text: str) -> str:
    """Normalize for essay auto-check: trim, lower, collapse whitespace."""
    if not text:
        return ""
    return " ".join(str(text).strip().lower().split())


def match_essay_answer(student_text: str, accepted: list[str]) -> bool:
    """Return True if student answer matches any accepted answer (normalized)."""
    target = normalize_answer(student_text)
    if not target:
        return False
    for ans in accepted:
        if normalize_answer(ans) == target:
            return True
    return False

