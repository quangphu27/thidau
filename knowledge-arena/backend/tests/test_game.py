"""
Tests for Đấu Trường Kiến Thức — including race-condition safety.
"""
import asyncio
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import Base, get_db
from app.main import app
from app.models import Admin, AnswerOption, Exam, Question, Room, Player, Submission
from app.services import game_service
from app.utils import hash_password

SQLALCHEMY_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    # seed admin + exam
    admin = Admin(username="admin", password_hash=hash_password("admin123"))
    db.add(admin)
    exam = Exam(title="Test Exam", description="desc", time_per_question=30)
    db.add(exam)
    db.flush()
    q = Question(
        exam_id=exam.id,
        content="2 + 2 = ?",
        question_type="MULTIPLE_CHOICE",
        order_index=0,
    )
    db.add(q)
    db.flush()
    for i, (text, correct) in enumerate(
        [("3", False), ("4", True), ("5", False), ("6", False)]
    ):
        db.add(
            AnswerOption(
                question_id=q.id, content=text, is_correct=correct, order_index=i
            )
        )
    q2 = Question(
        exam_id=exam.id,
        content="Viết Hello",
        question_type="ESSAY",
        order_index=1,
    )
    db.add(q2)
    db.commit()

    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _login(client):
    r = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200
    return r.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_create_room(client):
    token = _login(client)
    r = client.post("/api/rooms", json={"exam_id": 1}, headers=_auth(token))
    assert r.status_code == 200
    data = r.json()
    assert "room_code" in data
    assert data["status"] == "WAITING"


def test_join_room(client):
    token = _login(client)
    room = client.post("/api/rooms", json={"exam_id": 1}, headers=_auth(token)).json()
    r = client.post(
        f"/api/rooms/{room['room_code']}/join", json={"name": "Nguyễn Văn A"}
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Nguyễn Văn A"
    assert r.json()["player_id"]


def test_multiple_join(client):
    token = _login(client)
    room = client.post("/api/rooms", json={"exam_id": 1}, headers=_auth(token)).json()
    code = room["room_code"]
    names = ["An", "Bình", "Cường", "Dũng"]
    for n in names:
        r = client.post(f"/api/rooms/{code}/join", json={"name": n})
        assert r.status_code == 200
    players = client.get(f"/api/rooms/{code}/players").json()
    assert len(players) == 4


def test_start_and_next(client, db):
    token = _login(client)
    room = client.post("/api/rooms", json={"exam_id": 1}, headers=_auth(token)).json()
    code = room["room_code"]
    client.post(f"/api/rooms/{code}/join", json={"name": "An"})
    r = client.post(f"/api/rooms/{code}/start", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["type"] == "question_started"
    r2 = client.post(f"/api/rooms/{code}/next", headers=_auth(token))
    assert r2.status_code == 200


def test_submit_correct(client, db):
    token = _login(client)
    room = client.post("/api/rooms", json={"exam_id": 1}, headers=_auth(token)).json()
    code = room["room_code"]
    p = client.post(f"/api/rooms/{code}/join", json={"name": "An"}).json()
    client.post(f"/api/rooms/{code}/start", headers=_auth(token))
    # correct answer id = 2 (4)
    result = asyncio.get_event_loop().run_until_complete(
        game_service.submit_answer(db, code, p["player_id"], 1, answer_id=2)
    )
    assert result["is_correct"] is True
    assert result["points"] == 10


def test_submit_wrong(client, db):
    token = _login(client)
    room = client.post("/api/rooms", json={"exam_id": 1}, headers=_auth(token)).json()
    code = room["room_code"]
    p = client.post(f"/api/rooms/{code}/join", json={"name": "An"}).json()
    client.post(f"/api/rooms/{code}/start", headers=_auth(token))
    result = asyncio.get_event_loop().run_until_complete(
        game_service.submit_answer(db, code, p["player_id"], 1, answer_id=1)
    )
    assert result["is_correct"] is False
    assert result["points"] == -10
    assert result["score"] == -10
    assert result["question_locked"] is False


def test_wrong_then_other_can_answer(client, db):
    token = _login(client)
    room = client.post("/api/rooms", json={"exam_id": 1}, headers=_auth(token)).json()
    code = room["room_code"]
    p1 = client.post(f"/api/rooms/{code}/join", json={"name": "A"}).json()
    p2 = client.post(f"/api/rooms/{code}/join", json={"name": "B"}).json()
    client.post(f"/api/rooms/{code}/start", headers=_auth(token))
    wrong = asyncio.get_event_loop().run_until_complete(
        game_service.submit_answer(db, code, p1["player_id"], 1, answer_id=1)
    )
    assert wrong["points"] == -10
    correct = asyncio.get_event_loop().run_until_complete(
        game_service.submit_answer(db, code, p2["player_id"], 1, answer_id=2)
    )
    assert correct["is_correct"] is True
    assert correct["points"] == 10
    assert correct["score"] == 10


def test_submit_twice(client, db):
    token = _login(client)
    room = client.post("/api/rooms", json={"exam_id": 1}, headers=_auth(token)).json()
    code = room["room_code"]
    p = client.post(f"/api/rooms/{code}/join", json={"name": "An"}).json()
    client.post(f"/api/rooms/{code}/start", headers=_auth(token))
    asyncio.get_event_loop().run_until_complete(
        game_service.submit_answer(db, code, p["player_id"], 1, answer_id=2)
    )
    with pytest.raises(ValueError, match="ALREADY_SUBMITTED|QUESTION_ALREADY_ANSWERED"):
        asyncio.get_event_loop().run_until_complete(
            game_service.submit_answer(db, code, p["player_id"], 1, answer_id=2)
        )


def test_race_condition_two_correct(client, db):
    """Only one correct answer may lock the question."""
    token = _login(client)
    room = client.post("/api/rooms", json={"exam_id": 1}, headers=_auth(token)).json()
    code = room["room_code"]
    p1 = client.post(f"/api/rooms/{code}/join", json={"name": "A"}).json()
    p2 = client.post(f"/api/rooms/{code}/join", json={"name": "B"}).json()
    client.post(f"/api/rooms/{code}/start", headers=_auth(token))

    async def race():
        return await asyncio.gather(
            game_service.submit_answer(db, code, p1["player_id"], 1, answer_id=2),
            game_service.submit_answer(db, code, p2["player_id"], 1, answer_id=2),
            return_exceptions=True,
        )

    results = asyncio.get_event_loop().run_until_complete(race())
    oks = [r for r in results if isinstance(r, dict) and r.get("ok")]
    errs = [r for r in results if isinstance(r, Exception)]
    assert len(oks) == 1
    assert len(errs) == 1
    assert "QUESTION_ALREADY_ANSWERED" in str(errs[0]) or "ALREADY_SUBMITTED" in str(
        errs[0]
    )


def test_finish_and_ranking(client, db):
    token = _login(client)
    room = client.post("/api/rooms", json={"exam_id": 1}, headers=_auth(token)).json()
    code = room["room_code"]
    p1 = client.post(f"/api/rooms/{code}/join", json={"name": "Champion"}).json()
    p2 = client.post(f"/api/rooms/{code}/join", json={"name": "Runner"}).json()
    client.post(f"/api/rooms/{code}/start", headers=_auth(token))
    asyncio.get_event_loop().run_until_complete(
        game_service.submit_answer(db, code, p1["player_id"], 1, answer_id=2)
    )
    client.post(f"/api/rooms/{code}/finish", headers=_auth(token))
    results = client.get(f"/api/rooms/{code}/results").json()
    assert results["status"] == "FINISHED"
    assert results["winner"]["name"] == "Champion"
    assert results["winner"]["score"] == 10
    assert results["rankings"][1]["name"] == "Runner"


def test_essay_auto_grade(client, db):
    from app.models import AnswerOption, Question

    token = _login(client)
    # Add accepted answers to essay question id=2
    q2 = db.query(Question).filter(Question.id == 2).first()
    assert q2 is not None
    q2.question_type = "ESSAY"
    q2.content = "Từ khóa định nghĩa hàm?"
    for old in list(q2.options):
        db.delete(old)
    db.flush()
    db.add(AnswerOption(question_id=2, content="def", is_correct=True, order_index=0))
    db.add(AnswerOption(question_id=2, content="DEF", is_correct=True, order_index=1))
    db.commit()

    room = client.post("/api/rooms", json={"exam_id": 1}, headers=_auth(token)).json()
    code = room["room_code"]
    p1 = client.post(f"/api/rooms/{code}/join", json={"name": "A"}).json()
    p2 = client.post(f"/api/rooms/{code}/join", json={"name": "B"}).json()
    client.post(f"/api/rooms/{code}/start", headers=_auth(token))
    # skip to question 2
    client.post(f"/api/rooms/{code}/next", headers=_auth(token))

    wrong = asyncio.get_event_loop().run_until_complete(
        game_service.submit_answer(
            db, code, p1["player_id"], 2, answer_text="function"
        )
    )
    assert wrong["is_correct"] is False
    assert wrong["points"] == -10

    ok = asyncio.get_event_loop().run_until_complete(
        game_service.submit_answer(db, code, p2["player_id"], 2, answer_text="  Def  ")
    )
    assert ok["is_correct"] is True
    assert ok["points"] == 10


def test_normalize_match():
    from app.utils import match_essay_answer, match_numeric_answer

    assert match_essay_answer('print("Hi")', ['print("Hi")', "print('Hi')"])
    assert match_essay_answer("  DEF ", ["def"])
    assert not match_essay_answer("print", ['print("Hi")'])
    assert match_numeric_answer("9", ["9 người", "9"])
    assert match_numeric_answer("9 người", ["9"])
    assert match_numeric_answer("21", ["21"])
    assert not match_numeric_answer("20", ["21"])


def test_empty_name_rejected(client):
    token = _login(client)
    room = client.post("/api/rooms", json={"exam_id": 1}, headers=_auth(token)).json()
    r = client.post(f"/api/rooms/{room['room_code']}/join", json={"name": "   "})
    assert r.status_code == 422 or r.status_code == 400


def test_join_finished_room(client, db):
    token = _login(client)
    room = client.post("/api/rooms", json={"exam_id": 1}, headers=_auth(token)).json()
    code = room["room_code"]
    client.post(f"/api/rooms/{code}/start", headers=_auth(token))
    client.post(f"/api/rooms/{code}/finish", headers=_auth(token))
    r = client.post(f"/api/rooms/{code}/join", json={"name": "Late"})
    assert r.status_code == 400
    assert r.json()["detail"] == "ROOM_FINISHED"


def test_lobby_positions_admin_and_clamp():
    code = "LOBBY1"
    game_service.clear_lobby(code)

    admin_pos = game_service.set_lobby_position(code, "admin", 50, 46)
    assert admin_pos == {"x": 50.0, "y": 46.0}

    clamped = game_service.set_lobby_position(code, "p1", -10, 200)
    assert clamped["x"] == 5.0
    assert clamped["y"] == 92.0

    all_pos = game_service.get_lobby_positions(code)
    assert "admin" in all_pos and "p1" in all_pos

    game_service.remove_lobby_position(code, "p1")
    assert "p1" not in game_service.get_lobby_positions(code)
    assert "admin" in game_service.get_lobby_positions(code)

    game_service.clear_lobby(code)
    assert game_service.get_lobby_positions(code) == {}
    assert game_service.get_lobby_history(code) == []


def test_correct_effect_ms_scales_with_victims():
    assert game_service.correct_effect_ms(0) == 600 + 700 + 1000
    assert game_service.correct_effect_ms(1) == 600 + 800 + 1000
    assert game_service.correct_effect_ms(3) == 600 + 3 * 800 + 1000
