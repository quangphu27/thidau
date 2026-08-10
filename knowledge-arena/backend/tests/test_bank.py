"""Tests for question bank."""
from fastapi.testclient import TestClient

from app.main import app


def _headers(client):
    r = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_bank_crud_search_and_add_to_exam():
    client = TestClient(app)
    headers = _headers(client)

    r = client.post(
        "/api/bank/questions",
        headers=headers,
        json={
            "content": "Ngân hàng test: 5+5=?",
            "question_type": "MULTIPLE_CHOICE",
            "tags": "toán, cộng",
            "options": [
                {"content": "9", "is_correct": False, "order_index": 0},
                {"content": "10", "is_correct": True, "order_index": 1},
                {"content": "11", "is_correct": False, "order_index": 2},
                {"content": "12", "is_correct": False, "order_index": 3},
            ],
        },
    )
    assert r.status_code == 200, r.text
    bank_id = r.json()["id"]

    r = client.get("/api/bank/questions", headers=headers, params={"q": "5+5"})
    assert r.status_code == 200
    assert r.json()["total"] >= 1
    assert any(i["id"] == bank_id for i in r.json()["items"])

    r = client.get("/api/bank/questions", headers=headers, params={"q": "toán"})
    assert any(i["id"] == bank_id for i in r.json()["items"])

    r = client.post(
        "/api/exams",
        headers=headers,
        json={"title": "Exam from bank test", "time_per_question": 15},
    )
    assert r.status_code == 200
    exam_id = r.json()["id"]

    r = client.post(
        f"/api/bank/questions/add-to-exam/{exam_id}",
        headers=headers,
        json={"bank_question_ids": [bank_id]},
    )
    assert r.status_code == 200, r.text
    assert len(r.json()) == 1
    assert r.json()[0]["content"].startswith("Ngân hàng test")

    detail = client.get(f"/api/exams/{exam_id}", headers=headers)
    assert detail.json()["question_count"] >= 1
