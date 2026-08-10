from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class RoomStatus(str, Enum):
    WAITING = "WAITING"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    FINISHED = "FINISHED"


class QuestionType(str, Enum):
    MULTIPLE_CHOICE = "MULTIPLE_CHOICE"
    ESSAY = "ESSAY"


class MediaType(str, Enum):
    NONE = "NONE"
    IMAGE = "IMAGE"
    AUDIO = "AUDIO"
    VIDEO = "VIDEO"


class MediaPosition(str, Enum):
    BEFORE = "BEFORE"
    AFTER = "AFTER"


class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class Exam(Base):
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    time_per_question = Column(Integer, default=15)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    questions = relationship(
        "Question",
        back_populates="exam",
        cascade="all, delete-orphan",
        order_by="Question.order_index",
    )
    rooms = relationship("Room", back_populates="exam")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    question_type = Column(String(30), default=QuestionType.MULTIPLE_CHOICE.value)
    order_index = Column(Integer, default=0)
    media_type = Column(String(20), default=MediaType.NONE.value)
    media_url = Column(String(500), nullable=True)
    media_position = Column(String(20), default=MediaPosition.BEFORE.value)
    created_at = Column(DateTime, default=utcnow)

    exam = relationship("Exam", back_populates="questions")
    options = relationship(
        "AnswerOption",
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="AnswerOption.order_index",
    )


class AnswerOption(Base):
    __tablename__ = "answer_options"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(
        Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )
    content = Column(Text, default="")
    is_correct = Column(Boolean, default=False)
    media_type = Column(String(20), default=MediaType.NONE.value)
    media_url = Column(String(500), nullable=True)
    order_index = Column(Integer, default=0)

    question = relationship("Question", back_populates="options")


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    room_code = Column(String(20), unique=True, nullable=False, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    status = Column(String(20), default=RoomStatus.WAITING.value)
    current_question_id = Column(Integer, ForeignKey("questions.id"), nullable=True)
    current_question_index = Column(Integer, default=-1)
    question_started_at = Column(DateTime, nullable=True)
    question_ends_at = Column(DateTime, nullable=True)
    question_answered = Column(Boolean, default=False)
    first_answer_player_id = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=utcnow)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)

    exam = relationship("Exam", back_populates="rooms")
    current_question = relationship("Question", foreign_keys=[current_question_id])
    players = relationship(
        "Player", back_populates="room", cascade="all, delete-orphan"
    )
    submissions = relationship(
        "Submission", back_populates="room", cascade="all, delete-orphan"
    )


class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False)
    player_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    score = Column(Integer, default=0)
    correct_count = Column(Integer, default=0)
    total_answer_time_ms = Column(Float, default=0.0)
    joined_at = Column(DateTime, default=utcnow)

    room = relationship("Room", back_populates="players")
    submissions = relationship("Submission", back_populates="player")


class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (
        UniqueConstraint("room_id", "question_id", "player_id", name="uq_player_question"),
        Index("ix_submission_room_question", "room_id", "question_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    player_id = Column(String(50), ForeignKey("players.player_id"), nullable=False)
    answer_id = Column(Integer, ForeignKey("answer_options.id"), nullable=True)
    answer_text = Column(Text, nullable=True)
    is_correct = Column(Boolean, default=False)
    is_first = Column(Boolean, default=False)
    submitted_at = Column(DateTime, default=utcnow)
    points = Column(Integer, default=0)
    response_time_ms = Column(Float, default=0.0)
    essay_graded = Column(Boolean, default=False)

    room = relationship("Room", back_populates="submissions")
    player = relationship("Player", back_populates="submissions")


class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Text, default="")


class BankQuestion(Base):
    """Independent question bank — copy into exams when needed."""

    __tablename__ = "bank_questions"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    question_type = Column(String(30), default=QuestionType.MULTIPLE_CHOICE.value)
    media_type = Column(String(20), default=MediaType.NONE.value)
    media_url = Column(String(500), nullable=True)
    media_position = Column(String(20), default=MediaPosition.BEFORE.value)
    tags = Column(String(200), default="")  # free text, e.g. "toán, lớp 3"
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    options = relationship(
        "BankAnswerOption",
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="BankAnswerOption.order_index",
    )


class BankAnswerOption(Base):
    __tablename__ = "bank_answer_options"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(
        Integer, ForeignKey("bank_questions.id", ondelete="CASCADE"), nullable=False
    )
    content = Column(Text, default="")
    is_correct = Column(Boolean, default=False)
    media_type = Column(String(20), default=MediaType.NONE.value)
    media_url = Column(String(500), nullable=True)
    order_index = Column(Integer, default=0)

    question = relationship("BankQuestion", back_populates="options")
