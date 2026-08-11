from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field, field_validator


# ---------- Auth ----------
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


# ---------- Answer Option ----------
class AnswerOptionCreate(BaseModel):
    content: str = ""
    is_correct: bool = False
    media_type: str = "NONE"
    media_url: Optional[str] = None
    order_index: int = 0


class AnswerOptionUpdate(BaseModel):
    content: Optional[str] = None
    is_correct: Optional[bool] = None
    media_type: Optional[str] = None
    media_url: Optional[str] = None
    order_index: Optional[int] = None


class AnswerOptionOut(BaseModel):
    id: int
    question_id: int
    content: str
    is_correct: bool
    media_type: str
    media_url: Optional[str] = None
    order_index: int

    model_config = {"from_attributes": True}


class AnswerOptionPublic(BaseModel):
    """Student-facing option without is_correct."""

    id: int
    content: str
    media_type: str
    media_url: Optional[str] = None
    order_index: int

    model_config = {"from_attributes": True}


# ---------- Question ----------
class QuestionCreate(BaseModel):
    exam_id: int
    content: str
    question_type: str = "MULTIPLE_CHOICE"
    order_index: int = 0
    media_type: str = "NONE"
    media_url: Optional[str] = None
    media_position: str = "BEFORE"
    points: int = Field(default=10, ge=1, le=100)
    input_mode: str = "TEXT"
    blocks_json: Optional[str] = None
    options: List[AnswerOptionCreate] = []


class QuestionUpdate(BaseModel):
    content: Optional[str] = None
    question_type: Optional[str] = None
    order_index: Optional[int] = None
    media_type: Optional[str] = None
    media_url: Optional[str] = None
    media_position: Optional[str] = None
    points: Optional[int] = Field(default=None, ge=1, le=100)
    input_mode: Optional[str] = None
    blocks_json: Optional[str] = None
    options: Optional[List[AnswerOptionCreate]] = None


class QuestionOut(BaseModel):
    id: int
    exam_id: int
    content: str
    question_type: str
    order_index: int
    media_type: str
    media_url: Optional[str] = None
    media_position: str
    points: int = 10
    input_mode: str = "TEXT"
    blocks_json: Optional[str] = None
    options: List[AnswerOptionOut] = []

    model_config = {"from_attributes": True}


class QuestionPublic(BaseModel):
    id: int
    content: str
    question_type: str
    order_index: int
    media_type: str
    media_url: Optional[str] = None
    media_position: str
    points: int = 10
    input_mode: str = "TEXT"
    options: List[AnswerOptionPublic] = []
    pieces: Optional[List[dict]] = None
    time_per_question: int = 15
    question_number: int = 1
    total_questions: int = 1
    ends_at: Optional[str] = None
    remaining_seconds: Optional[float] = None

    model_config = {"from_attributes": True}


# ---------- Exam ----------
class ExamCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    time_per_question: int = Field(default=15, ge=5, le=300)


class ExamUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    time_per_question: Optional[int] = Field(default=None, ge=5, le=300)


class ExamOut(BaseModel):
    id: int
    title: str
    description: str
    time_per_question: int
    created_at: datetime
    updated_at: datetime
    question_count: int = 0

    model_config = {"from_attributes": True}


class ExamDetail(ExamOut):
    questions: List[QuestionOut] = []


# ---------- Room ----------
class RoomCreate(BaseModel):
    exam_id: int


class PlayerOut(BaseModel):
    id: int
    player_id: str
    name: str
    score: int
    correct_count: int = 0
    joined_at: datetime

    model_config = {"from_attributes": True}


class RoomOut(BaseModel):
    id: int
    room_code: str
    exam_id: int
    exam_title: str = ""
    status: str
    current_question_id: Optional[int] = None
    current_question_index: int = -1
    question_answered: bool = False
    player_count: int = 0
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    join_url: str = ""
    time_per_question: int = 15

    model_config = {"from_attributes": True}


class JoinRoomRequest(BaseModel):
    name: str = Field(min_length=1, max_length=50)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Tên không được để trống")
        return v


class JoinRoomResponse(BaseModel):
    player_id: str
    name: str
    room_code: str
    score: int = 0


class SubmitAnswerRequest(BaseModel):
    player_id: str
    question_id: int
    answer_id: Optional[int] = None
    answer_text: Optional[str] = None


class GradeEssayRequest(BaseModel):
    is_correct: bool
    points: int = Field(default=10, ge=0, le=10)


class DashboardStats(BaseModel):
    total_exams: int
    total_questions: int
    active_rooms: int
    active_players: int


class RankingEntry(BaseModel):
    rank: int
    player_id: str
    name: str
    score: int
    correct_count: int
    total_answer_time_ms: float


class ResultsOut(BaseModel):
    room_code: str
    status: str
    rankings: List[RankingEntry]
    winner: Optional[RankingEntry] = None


class SettingUpdate(BaseModel):
    sound_enabled: Optional[bool] = None
    admin_display_name: Optional[str] = None


class SettingsOut(BaseModel):
    sound_enabled: bool = True
    admin_display_name: str = "Thầy Phú Anex"


# ---------- Question Bank ----------
class BankOptionCreate(BaseModel):
    content: str = ""
    is_correct: bool = False
    media_type: str = "NONE"
    media_url: Optional[str] = None
    order_index: int = 0


class BankOptionOut(BaseModel):
    id: int
    question_id: int
    content: str
    is_correct: bool
    media_type: str
    media_url: Optional[str] = None
    order_index: int

    model_config = {"from_attributes": True}


class BankQuestionCreate(BaseModel):
    content: str
    question_type: str = "MULTIPLE_CHOICE"
    media_type: str = "NONE"
    media_url: Optional[str] = None
    media_position: str = "BEFORE"
    tags: str = ""
    points: int = Field(default=10, ge=1, le=100)
    blocks_json: Optional[str] = None
    options: List[BankOptionCreate] = []


class BankQuestionUpdate(BaseModel):
    content: Optional[str] = None
    question_type: Optional[str] = None
    media_type: Optional[str] = None
    media_url: Optional[str] = None
    media_position: Optional[str] = None
    tags: Optional[str] = None
    points: Optional[int] = Field(default=None, ge=1, le=100)
    blocks_json: Optional[str] = None
    options: Optional[List[BankOptionCreate]] = None


class BankQuestionOut(BaseModel):
    id: int
    content: str
    question_type: str
    media_type: str
    media_url: Optional[str] = None
    media_position: str
    tags: str = ""
    points: int = 10
    blocks_json: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    options: List[BankOptionOut] = []

    model_config = {"from_attributes": True}


class BankQuestionListOut(BaseModel):
    items: List[BankQuestionOut]
    total: int
    page: int
    page_size: int


class AddBankToExamRequest(BaseModel):
    bank_question_ids: List[int] = Field(min_length=1)

