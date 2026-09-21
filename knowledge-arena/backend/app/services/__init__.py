from __future__ import annotations

import asyncio
import random
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models import (
    AnswerOption,
    Exam,
    Player,
    Question,
    Room,
    RoomMode,
    RoomStatus,
    Submission,
    QuestionType,
)
from app.scratch_blocks import match_script, parse_blocks_json, public_pieces, student_script_from_payload
from app.utils import (
    RetryCooldown,
    generate_player_id,
    generate_room_code,
    match_essay_answer,
    match_numeric_answer,
)
from app.websocket import ws_manager


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _as_naive(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


class GameService:
    """Core game logic with race-condition-safe answer locking."""

    # After correct answer: zoom + sequential Solo kills, then countdown, then auto next
    CORRECT_ZOOM_MS = 600
    CORRECT_PER_KILL_MS = 800
    CORRECT_SETTLE_MS = 1000  # pause before countdown
    CORRECT_COUNTDOWN_SEC = 3
    WRONG_RETRY_SEC = 10
    BUZZER_ANSWER_SEC = 10

    def correct_effect_ms(self, victim_count: int) -> int:
        n = max(0, int(victim_count))
        if n <= 0:
            return self.CORRECT_ZOOM_MS + 700 + self.CORRECT_SETTLE_MS
        return self.CORRECT_ZOOM_MS + n * self.CORRECT_PER_KILL_MS + self.CORRECT_SETTLE_MS

    def __init__(self):
        self._room_locks: Dict[str, asyncio.Lock] = {}
        self._meta_lock = asyncio.Lock()
        self._auto_next_tasks: Dict[str, asyncio.Task] = {}
        self._lobby_history: Dict[str, List[dict]] = {}
        self._lobby_positions: Dict[str, Dict[str, dict]] = {}
        # (room_code, player_id, question_id) -> unix timestamp when retry is allowed
        self._wrong_retry_at: Dict[tuple, float] = {}
        # (room_code, question_id) -> set of eliminated (wrong) option ids
        self._eliminated_options: Dict[tuple, set] = {}
        # room_code -> seconds remaining when paused
        self._paused_remaining: Dict[str, float] = {}
        # Buzzer duel in-memory state per room
        self._buzzer: Dict[str, dict] = {}
        self._buzzer_spawn_tasks: Dict[str, asyncio.Task] = {}

    def is_buzzer_mode(self, room: Room) -> bool:
        return (getattr(room, "mode", None) or RoomMode.QUIZ.value) == RoomMode.BUZZER.value

    def clear_buzzer_state(self, room_code: str) -> None:
        task = self._buzzer_spawn_tasks.pop(room_code, None)
        if task and not task.done():
            task.cancel()
        self._buzzer.pop(room_code, None)

    def get_buzzer_state(self, room_code: str) -> dict:
        state = self._buzzer.get(room_code) or {
            "phase": "READING",
            "revealed": False,
            "claimer_id": None,
            "claimer_name": None,
            "excluded_ids": [],
            "x": 50.0,
            "y": 50.0,
            "question_id": None,
            "answer_ends_at": None,
        }
        ends = state.get("answer_ends_at")
        ends_iso = None
        answer_remaining = None
        if ends:
            if isinstance(ends, datetime):
                ends_iso = ends.isoformat() + "Z"
                answer_remaining = max(0.0, (ends - _utcnow()).total_seconds())
            elif isinstance(ends, str):
                ends_iso = ends if ends.endswith("Z") else ends + "Z"
        return {
            "phase": state.get("phase") or "READING",
            "revealed": bool(state.get("revealed")),
            "claimer_id": state.get("claimer_id"),
            "claimer_name": state.get("claimer_name"),
            "excluded_ids": list(state.get("excluded_ids") or []),
            "x": float(state.get("x") or 50),
            "y": float(state.get("y") or 50),
            "question_id": state.get("question_id"),
            "answer_ends_at": ends_iso,
            "answer_remaining_seconds": answer_remaining,
            "answer_seconds": self.BUZZER_ANSWER_SEC,
        }

    def reset_buzzer_for_question(self, room_code: str, question_id: int) -> None:
        self.clear_buzzer_state(room_code)
        self._buzzer[room_code] = {
            "phase": "READING",
            "revealed": False,
            "claimer_id": None,
            "claimer_name": None,
            "excluded_ids": [],
            "x": 50.0,
            "y": 50.0,
            "question_id": question_id,
            "answer_ends_at": None,
        }

    def schedule_buzzer_spawn(
        self, room_code: str, question_id: int, delay: Optional[float] = None
    ) -> None:
        """Spawn buzzer after random delay at random position (only after reveal)."""
        old = self._buzzer_spawn_tasks.pop(room_code, None)
        if old and not old.done():
            old.cancel()

        async def _spawn():
            try:
                wait = delay if delay is not None else random.uniform(0.6, 2.5)
                await asyncio.sleep(wait)
                state = self._buzzer.get(room_code)
                if not state or state.get("question_id") != question_id:
                    return
                if not state.get("revealed"):
                    return
                if state.get("phase") not in ("IDLE", "RESET"):
                    return
                # Random point inside the right empty lane (0–100 mapped by UI)
                x = round(random.uniform(18, 82), 1)
                y = round(random.uniform(18, 82), 1)
                state["phase"] = "VISIBLE"
                state["claimer_id"] = None
                state["claimer_name"] = None
                state["answer_ends_at"] = None
                state["x"] = x
                state["y"] = y
                await ws_manager.broadcast(
                    room_code,
                    {
                        "type": "buzzer_spawn",
                        "x": x,
                        "y": y,
                        "question_id": question_id,
                        "excluded_ids": list(state.get("excluded_ids") or []),
                        "revealed": True,
                    },
                )
            except asyncio.CancelledError:
                return
            finally:
                self._buzzer_spawn_tasks.pop(room_code, None)

        self._buzzer_spawn_tasks[room_code] = asyncio.create_task(_spawn())

    async def reveal_buzzer(self, db: Session, room_code: str) -> dict:
        """Admin finished reading: reveal question text and spawn the buzzer."""
        lock = await self.get_room_lock(room_code)
        async with lock:
            room = self.get_room(db, room_code)
            if not room:
                raise ValueError("ROOM_NOT_FOUND")
            if not self.is_buzzer_mode(room):
                raise ValueError("NOT_ALLOWED")
            if room.status != RoomStatus.RUNNING.value:
                raise ValueError("ROOM_NOT_RUNNING")
            if room.question_answered:
                raise ValueError("QUESTION_ALREADY_ANSWERED")
            if not room.current_question_id:
                raise ValueError("GAME_NOT_STARTED")

            state = self._buzzer.get(room_code)
            if not state or state.get("question_id") != room.current_question_id:
                self.reset_buzzer_for_question(room_code, room.current_question_id)
                state = self._buzzer[room_code]
            if state.get("revealed"):
                raise ValueError("ALREADY_REVEALED")

            state["revealed"] = True
            state["phase"] = "IDLE"
            state["answer_ends_at"] = None
            payload = {
                "type": "buzzer_revealed",
                "question_id": room.current_question_id,
                "revealed": True,
                "buzzer": self.get_buzzer_state(room_code),
            }
            await ws_manager.broadcast(room_code, payload)
            self.schedule_buzzer_spawn(room_code, room.current_question_id)
            return payload

    def push_lobby_event(self, room_code: str, event: dict) -> None:
        hist = self._lobby_history.setdefault(room_code, [])
        hist.append(event)
        if len(hist) > 80:
            del hist[:-80]

    def get_lobby_history(self, room_code: str) -> List[dict]:
        return list(self._lobby_history.get(room_code, []))

    def clear_lobby(self, room_code: str) -> None:
        self._lobby_history.pop(room_code, None)
        self._lobby_positions.pop(room_code, None)
        self._paused_remaining.pop(room_code, None)
        self.clear_buzzer_state(room_code)
        for key in list(self._eliminated_options):
            if key[0] == room_code:
                self._eliminated_options.pop(key, None)
        for key in list(self._wrong_retry_at):
            if key[0] == room_code:
                self._wrong_retry_at.pop(key, None)

    def mark_option_eliminated(
        self, room_code: str, question_id: int, option_id: int
    ) -> list:
        key = (room_code, int(question_id))
        bucket = self._eliminated_options.setdefault(key, set())
        bucket.add(int(option_id))
        return sorted(bucket)

    def get_eliminated_option_ids(self, room_code: str, question_id: int) -> list:
        return sorted(self._eliminated_options.get((room_code, int(question_id)), set()))

    def clear_eliminated_options(self, room_code: str, question_id: int | None = None) -> None:
        if question_id is None:
            for key in list(self._eliminated_options):
                if key[0] == room_code:
                    self._eliminated_options.pop(key, None)
            return
        self._eliminated_options.pop((room_code, int(question_id)), None)

    def set_lobby_position(
        self, room_code: str, player_id: str, x: float, y: float
    ) -> dict:
        x = max(5.0, min(95.0, float(x)))
        y = max(35.0, min(92.0, float(y)))
        room_pos = self._lobby_positions.setdefault(room_code, {})
        room_pos[player_id] = {"x": round(x, 1), "y": round(y, 1)}
        return room_pos[player_id]

    def remove_lobby_position(self, room_code: str, player_id: str) -> None:
        room_pos = self._lobby_positions.get(room_code)
        if room_pos:
            room_pos.pop(player_id, None)

    def get_lobby_positions(self, room_code: str) -> dict:
        return dict(self._lobby_positions.get(room_code, {}))

    async def get_room_lock(self, room_code: str) -> asyncio.Lock:
        async with self._meta_lock:
            if room_code not in self._room_locks:
                self._room_locks[room_code] = asyncio.Lock()
            return self._room_locks[room_code]

    def create_room(self, db: Session, exam_id: int, mode: str = "QUIZ") -> Room:
        exam = db.query(Exam).filter(Exam.id == exam_id).first()
        if not exam:
            raise ValueError("EXAM_NOT_FOUND")
        questions = (
            db.query(Question)
            .filter(Question.exam_id == exam_id)
            .order_by(Question.order_index)
            .all()
        )
        if not questions:
            raise ValueError("NO_QUESTIONS")

        mode_val = (mode or RoomMode.QUIZ.value).upper()
        if mode_val not in (RoomMode.QUIZ.value, RoomMode.BUZZER.value):
            mode_val = RoomMode.QUIZ.value

        for _ in range(20):
            code = generate_room_code()
            exists = db.query(Room).filter(Room.room_code == code).first()
            if not exists:
                room = Room(
                    room_code=code,
                    exam_id=exam_id,
                    mode=mode_val,
                    status=RoomStatus.WAITING.value,
                )
                db.add(room)
                db.commit()
                db.refresh(room)
                return room
        raise ValueError("NOT_ALLOWED")

    def join_room(self, db: Session, room_code: str, name: str) -> Player:
        room = db.query(Room).filter(Room.room_code == room_code).first()
        if not room:
            raise ValueError("ROOM_NOT_FOUND")
        if room.status == RoomStatus.FINISHED.value:
            raise ValueError("ROOM_FINISHED")
        name = name.strip()
        if not name:
            raise ValueError("NAME_REQUIRED")
        if len(name) > 50:
            raise ValueError("NAME_TOO_LONG")

        player = Player(
            room_id=room.id,
            player_id=generate_player_id(),
            name=name,
            score=0,
        )
        db.add(player)
        db.commit()
        db.refresh(player)
        return player

    def get_player(self, db: Session, player_id: str) -> Optional[Player]:
        return db.query(Player).filter(Player.player_id == player_id).first()

    def get_room(self, db: Session, room_code: str) -> Optional[Room]:
        return (
            db.query(Room)
            .options(joinedload(Room.exam), joinedload(Room.players))
            .filter(Room.room_code == room_code)
            .first()
        )

    def get_exam_questions(self, db: Session, exam_id: int) -> List[Question]:
        return (
            db.query(Question)
            .options(joinedload(Question.options))
            .filter(Question.exam_id == exam_id)
            .order_by(Question.order_index, Question.id)
            .all()
        )

    def room_state_payload(self, db: Session, room: Room) -> dict:
        players = (
            db.query(Player)
            .filter(Player.room_id == room.id)
            .order_by(Player.joined_at)
            .all()
        )
        exam = db.query(Exam).filter(Exam.id == room.exam_id).first()
        questions = self.get_exam_questions(db, room.exam_id)
        from app.models import Setting

        host_row = (
            db.query(Setting).filter(Setting.key == "admin_display_name").first()
        )
        host_name = (host_row.value if host_row and host_row.value else "") or "Thầy Phú Anex"
        payload: Dict[str, Any] = {
            "type": "room_updated",
            "room_code": room.room_code,
            "status": room.status,
            "mode": getattr(room, "mode", None) or RoomMode.QUIZ.value,
            "exam_title": exam.title if exam else "",
            "host_name": host_name,
            "time_per_question": exam.time_per_question if exam else 15,
            "current_question_id": room.current_question_id,
            "current_question_index": room.current_question_index,
            "question_answered": room.question_answered,
            "first_answer_player_id": room.first_answer_player_id,
            "player_count": len(players),
            "total_questions": len(questions),
            "players": [
                {
                    "player_id": p.player_id,
                    "name": p.name,
                    "score": p.score,
                    "correct_count": p.correct_count,
                }
                for p in players
            ],
            "rankings": self.compute_rankings(players),
            "buzzer": self.get_buzzer_state(room.room_code)
            if self.is_buzzer_mode(room)
            else None,
        }
        if room.question_started_at:
            payload["question_started_at"] = room.question_started_at.isoformat() + "Z"
        if room.question_ends_at:
            ends = _as_naive(room.question_ends_at)
            payload["question_ends_at"] = ends.isoformat() + "Z"
            if (
                room.status == RoomStatus.PAUSED.value
                and room.room_code in self._paused_remaining
            ):
                remaining = float(self._paused_remaining[room.room_code])
            else:
                remaining = (ends - _utcnow()).total_seconds()
            payload["remaining_seconds"] = max(0, remaining)
        return payload

    def question_public_payload(
        self, db: Session, room: Room, question: Question
    ) -> dict:
        exam = db.query(Exam).filter(Exam.id == room.exam_id).first()
        questions = self.get_exam_questions(db, room.exam_id)
        remaining = None
        ends_at = None
        if room.question_ends_at:
            ends = _as_naive(room.question_ends_at)
            ends_at = ends.isoformat() + "Z"
            remaining = max(0, (ends - _utcnow()).total_seconds())

        options = sorted(question.options, key=lambda o: o.order_index)
        # Never send accepted essay answers to students
        public_options = []
        if question.question_type not in (
            QuestionType.ESSAY.value,
            QuestionType.BLOCK_PUZZLE.value,
        ):
            public_options = [
                {
                    "id": o.id,
                    "content": o.content,
                    "media_type": o.media_type,
                    "media_url": o.media_url,
                    "order_index": o.order_index,
                }
                for o in options
            ]
        return {
            "type": "question_started",
            "question": {
                "id": question.id,
                "content": question.content,
                "question_type": question.question_type,
                "order_index": question.order_index,
                "media_type": question.media_type,
                "media_url": question.media_url,
                "media_position": question.media_position,
                "points": int(getattr(question, "points", None) or 10),
                "input_mode": (getattr(question, "input_mode", None) or "TEXT"),
                "options": public_options,
                "pieces": (
                    public_pieces(parse_blocks_json(getattr(question, "blocks_json", None)))
                    if question.question_type == QuestionType.BLOCK_PUZZLE.value
                    else None
                ),
                "time_per_question": exam.time_per_question if exam else 15,
                "question_number": room.current_question_index + 1,
                "total_questions": len(questions),
                "ends_at": ends_at,
                "remaining_seconds": remaining,
                "eliminated_option_ids": self.get_eliminated_option_ids(
                    room.room_code, question.id
                ),
            },
            "question_answered": room.question_answered,
            "eliminated_option_ids": self.get_eliminated_option_ids(
                room.room_code, question.id
            ),
        }

    async def start_game(self, db: Session, room_code: str) -> dict:
        room = self.get_room(db, room_code)
        if not room:
            raise ValueError("ROOM_NOT_FOUND")
        if room.status == RoomStatus.FINISHED.value:
            raise ValueError("ROOM_FINISHED")
        if room.status == RoomStatus.RUNNING.value:
            raise ValueError("ROOM_ALREADY_STARTED")

        questions = self.get_exam_questions(db, room.exam_id)
        if not questions:
            raise ValueError("NO_QUESTIONS")

        room.status = RoomStatus.RUNNING.value
        room.started_at = _utcnow()
        room.current_question_index = 0
        first_q = questions[0]
        room.current_question_id = first_q.id
        exam = db.query(Exam).filter(Exam.id == room.exam_id).first()
        duration = exam.time_per_question if exam else 15
        now = _utcnow()
        room.question_started_at = now
        room.question_ends_at = now + timedelta(seconds=duration)
        room.question_answered = False
        room.first_answer_player_id = None
        self._paused_remaining.pop(room_code, None)
        db.commit()
        db.refresh(room)

        self.clear_lobby(room_code)

        await ws_manager.broadcast(
            room_code, {"type": "game_started", **self.room_state_payload(db, room)}
        )
        payload = self.question_public_payload(db, room, first_q)
        await ws_manager.broadcast(room_code, payload)
        if self.is_buzzer_mode(room):
            self.reset_buzzer_for_question(room_code, first_q.id)
            await ws_manager.broadcast(
                room_code,
                {
                    "type": "buzzer_reading",
                    "question_id": first_q.id,
                    "revealed": False,
                    "buzzer": self.get_buzzer_state(room_code),
                    "message": "Admin đang đọc câu hỏi — hãy lắng nghe!",
                },
            )
        return payload

    async def next_question(self, db: Session, room_code: str) -> dict:
        self.cancel_auto_next(room_code)
        self.clear_eliminated_options(room_code)
        room = self.get_room(db, room_code)
        if not room:
            raise ValueError("ROOM_NOT_FOUND")
        if room.status == RoomStatus.FINISHED.value:
            raise ValueError("ROOM_FINISHED")
        if room.status == RoomStatus.WAITING.value:
            raise ValueError("GAME_NOT_STARTED")
        if room.status == RoomStatus.PAUSED.value:
            raise ValueError("ROOM_PAUSED")

        questions = self.get_exam_questions(db, room.exam_id)
        next_idx = room.current_question_index + 1
        if next_idx >= len(questions):
            return await self.finish_game(db, room_code)

        await ws_manager.broadcast(
            room_code,
            {
                "type": "question_finished",
                "question_id": room.current_question_id,
                "question_index": room.current_question_index,
            },
        )

        q = questions[next_idx]
        exam = db.query(Exam).filter(Exam.id == room.exam_id).first()
        duration = exam.time_per_question if exam else 15
        now = _utcnow()
        room.current_question_index = next_idx
        room.current_question_id = q.id
        room.question_started_at = now
        room.question_ends_at = now + timedelta(seconds=duration)
        room.question_answered = False
        self._paused_remaining.pop(room_code, None)
        room.first_answer_player_id = None
        room.status = RoomStatus.RUNNING.value
        db.commit()
        db.refresh(room)

        payload = self.question_public_payload(db, room, q)
        await ws_manager.broadcast(room_code, payload)
        await ws_manager.broadcast(room_code, self.room_state_payload(db, room))
        if self.is_buzzer_mode(room):
            self.reset_buzzer_for_question(room_code, q.id)
            await ws_manager.broadcast(
                room_code,
                {
                    "type": "buzzer_reading",
                    "question_id": q.id,
                    "revealed": False,
                    "buzzer": self.get_buzzer_state(room_code),
                    "message": "Admin đang đọc câu hỏi — hãy lắng nghe!",
                },
            )
        return payload

    async def pause_game(self, db: Session, room_code: str) -> dict:
        room = self.get_room(db, room_code)
        if not room:
            raise ValueError("ROOM_NOT_FOUND")
        if room.status != RoomStatus.RUNNING.value:
            raise ValueError("ROOM_NOT_RUNNING")
        remaining = 0.0
        if room.question_ends_at:
            ends = _as_naive(room.question_ends_at)
            remaining = max(0.0, (ends - _utcnow()).total_seconds())
        self._paused_remaining[room_code] = remaining
        # Anchor ends_at so clients that re-read ends_at see the frozen remaining
        room.question_ends_at = _utcnow() + timedelta(seconds=remaining)
        room.status = RoomStatus.PAUSED.value
        db.commit()
        payload = {
            "type": "room_updated",
            "status": room.status,
            **self.room_state_payload(db, room),
        }
        await ws_manager.broadcast(room_code, payload)
        return payload

    async def resume_game(self, db: Session, room_code: str) -> dict:
        room = self.get_room(db, room_code)
        if not room:
            raise ValueError("ROOM_NOT_FOUND")
        if room.status != RoomStatus.PAUSED.value:
            raise ValueError("NOT_ALLOWED")
        remaining = self._paused_remaining.pop(room_code, None)
        if remaining is None:
            remaining = 0.0
            if room.question_ends_at:
                ends = _as_naive(room.question_ends_at)
                remaining = max(0.0, (ends - _utcnow()).total_seconds())
        if remaining <= 0:
            exam = db.query(Exam).filter(Exam.id == room.exam_id).first()
            remaining = float(exam.time_per_question if exam else 15)
        now = _utcnow()
        room.question_ends_at = now + timedelta(seconds=remaining)
        room.status = RoomStatus.RUNNING.value
        db.commit()
        payload = self.room_state_payload(db, room)
        await ws_manager.broadcast(room_code, payload)
        if room.current_question_id:
            q = (
                db.query(Question)
                .options(joinedload(Question.options))
                .filter(Question.id == room.current_question_id)
                .first()
            )
            if q:
                await ws_manager.broadcast(
                    room_code, self.question_public_payload(db, room, q)
                )
        return payload

    async def adjust_question_time(
        self, db: Session, room_code: str, delta_seconds: int
    ) -> dict:
        """Add/remove seconds from the current question timer (+/-5 typical)."""
        room = self.get_room(db, room_code)
        if not room:
            raise ValueError("ROOM_NOT_FOUND")
        if room.status not in (RoomStatus.RUNNING.value, RoomStatus.PAUSED.value):
            raise ValueError("ROOM_NOT_RUNNING")
        if not room.current_question_id:
            raise ValueError("GAME_NOT_STARTED")

        delta = int(delta_seconds)
        if delta == 0:
            raise ValueError("INVALID_ANSWER")

        if room.status == RoomStatus.PAUSED.value:
            remaining = float(self._paused_remaining.get(room_code, 0.0))
            if room_code not in self._paused_remaining and room.question_ends_at:
                ends = _as_naive(room.question_ends_at)
                remaining = max(0.0, (ends - _utcnow()).total_seconds())
            remaining = max(1.0, remaining + delta)
            self._paused_remaining[room_code] = remaining
            room.question_ends_at = _utcnow() + timedelta(seconds=remaining)
        else:
            if not room.question_ends_at:
                raise ValueError("GAME_NOT_STARTED")
            ends = _as_naive(room.question_ends_at) + timedelta(seconds=delta)
            if (ends - _utcnow()).total_seconds() < 1:
                ends = _utcnow() + timedelta(seconds=1)
            room.question_ends_at = ends

        db.commit()
        ends = _as_naive(room.question_ends_at)
        remaining = max(0.0, (ends - _utcnow()).total_seconds())
        if room.status == RoomStatus.PAUSED.value:
            remaining = float(self._paused_remaining.get(room_code, remaining))

        payload = {
            "type": "timer_adjusted",
            "question_id": room.current_question_id,
            "ends_at": ends.isoformat() + "Z",
            "remaining_seconds": remaining,
            "delta_seconds": delta,
            **self.room_state_payload(db, room),
        }
        await ws_manager.broadcast(room_code, payload)
        return payload

    async def finish_game(self, db: Session, room_code: str) -> dict:
        self.cancel_auto_next(room_code)
        self.clear_buzzer_state(room_code)
        room = self.get_room(db, room_code)
        if not room:
            raise ValueError("ROOM_NOT_FOUND")
        room.status = RoomStatus.FINISHED.value
        room.finished_at = _utcnow()
        db.commit()
        players = db.query(Player).filter(Player.room_id == room.id).all()
        rankings = self.compute_rankings(players)
        winner = rankings[0] if rankings else None
        payload = {
            "type": "game_finished",
            "room_code": room_code,
            "rankings": rankings,
            "winner": winner,
        }
        await ws_manager.broadcast(room_code, payload)
        return payload

    async def handle_buzz(self, db: Session, room_code: str, player_id: str) -> dict:
        """First valid buzz claims the right to answer verbally."""
        lock = await self.get_room_lock(room_code)
        async with lock:
            room = self.get_room(db, room_code)
            if not room:
                raise ValueError("ROOM_NOT_FOUND")
            if not self.is_buzzer_mode(room):
                raise ValueError("NOT_ALLOWED")
            if room.status != RoomStatus.RUNNING.value:
                raise ValueError("ROOM_NOT_RUNNING")
            if room.question_answered:
                raise ValueError("QUESTION_ALREADY_ANSWERED")
            player = self.get_player(db, player_id)
            if not player or player.room_id != room.id:
                raise ValueError("PLAYER_NOT_FOUND")

            state = self._buzzer.setdefault(
                room_code,
                {
                    "phase": "IDLE",
                    "claimer_id": None,
                    "claimer_name": None,
                    "excluded_ids": [],
                    "x": 50.0,
                    "y": 50.0,
                    "question_id": room.current_question_id,
                },
            )
            excluded = set(state.get("excluded_ids") or [])
            if player_id in excluded:
                raise ValueError("BUZZER_EXCLUDED")
            if state.get("phase") != "VISIBLE":
                raise ValueError("BUZZER_NOT_READY")
            if state.get("claimer_id"):
                raise ValueError("BUZZER_ALREADY_CLAIMED")

            state["phase"] = "CLAIMED"
            state["claimer_id"] = player_id
            state["claimer_name"] = player.name
            answer_ends = _utcnow() + timedelta(seconds=self.BUZZER_ANSWER_SEC)
            state["answer_ends_at"] = answer_ends
            payload = {
                "type": "buzzer_claimed",
                "player_id": player_id,
                "player_name": player.name,
                "question_id": room.current_question_id,
                "excluded_ids": list(excluded),
                "answer_ends_at": answer_ends.isoformat() + "Z",
                "answer_seconds": self.BUZZER_ANSWER_SEC,
                "revealed": True,
            }
            await ws_manager.broadcast(room_code, payload)
            return payload

    async def judge_buzzer(
        self, db: Session, room_code: str, correct: bool
    ) -> dict:
        """Admin marks the current buzzer claimer correct or wrong."""
        lock = await self.get_room_lock(room_code)
        async with lock:
            room = self.get_room(db, room_code)
            if not room:
                raise ValueError("ROOM_NOT_FOUND")
            if not self.is_buzzer_mode(room):
                raise ValueError("NOT_ALLOWED")
            if room.status not in (RoomStatus.RUNNING.value, RoomStatus.PAUSED.value):
                raise ValueError("ROOM_NOT_RUNNING")
            if room.question_answered:
                raise ValueError("QUESTION_ALREADY_ANSWERED")

            state = self._buzzer.get(room_code) or {}
            claimer_id = state.get("claimer_id")
            if state.get("phase") != "CLAIMED" or not claimer_id:
                raise ValueError("NO_CLAIMER")

            player = self.get_player(db, claimer_id)
            if not player or player.room_id != room.id:
                raise ValueError("PLAYER_NOT_FOUND")

            question = (
                db.query(Question)
                .filter(Question.id == room.current_question_id)
                .first()
            )
            if not question:
                raise ValueError("GAME_NOT_STARTED")

            q_points = int(getattr(question, "points", None) or 10)

            if correct:
                # Award points; lock question; auto-advance
                points = q_points
                player.score += points
                player.correct_count += 1
                room.question_answered = True
                room.first_answer_player_id = player.player_id

                # Record submission (verbal — no answer text)
                existing = (
                    db.query(Submission)
                    .filter(
                        Submission.room_id == room.id,
                        Submission.question_id == question.id,
                        Submission.player_id == player.player_id,
                    )
                    .first()
                )
                if not existing:
                    db.add(
                        Submission(
                            room_id=room.id,
                            question_id=question.id,
                            player_id=player.player_id,
                            answer_text="[buzzer]",
                            is_correct=True,
                            is_first=True,
                            points=points,
                            response_time_ms=0,
                            essay_graded=True,
                        )
                    )
                db.commit()

                players = db.query(Player).filter(Player.room_id == room.id).all()
                rankings = self.compute_rankings(players)
                judged = {
                    "type": "buzzer_judged",
                    "correct": True,
                    "player_id": player.player_id,
                    "player_name": player.name,
                    "points_awarded": points,
                    "score": player.score,
                    "question_id": question.id,
                }
                await ws_manager.broadcast(room_code, judged)
                await ws_manager.broadcast(
                    room_code,
                    {
                        "type": "answer_correct",
                        "player_name": player.name,
                        "player_id": player.player_id,
                        "points": points,
                        "score": player.score,
                        "answer_display": "Chuông",
                        "question_locked": True,
                        "question_type": question.question_type,
                        "question_id": question.id,
                        "effect_ms": 1200,
                        "countdown_seconds": self.CORRECT_COUNTDOWN_SEC,
                        "auto_next": True,
                        "message": f"🎉 {player.name} trả lời đúng! +{points} điểm",
                    },
                )
                await ws_manager.broadcast(
                    room_code,
                    {
                        "type": "score_updated",
                        "rankings": rankings,
                        "question_answered": True,
                        "first_answer_player_id": player.player_id,
                    },
                )
                self.schedule_auto_next_after_correct(
                    room_code, int(question.id), 1200
                )
                return judged

            # Wrong: −10 points, exclude claimer, reset buzzer for others
            penalty = -10
            player.score += penalty
            excluded = set(state.get("excluded_ids") or [])
            excluded.add(claimer_id)
            state["excluded_ids"] = list(excluded)
            state["phase"] = "IDLE"
            state["claimer_id"] = None
            state["claimer_name"] = None
            state["answer_ends_at"] = None
            state["revealed"] = True

            existing = (
                db.query(Submission)
                .filter(
                    Submission.room_id == room.id,
                    Submission.question_id == question.id,
                    Submission.player_id == player.player_id,
                )
                .first()
            )
            if not existing:
                db.add(
                    Submission(
                        room_id=room.id,
                        question_id=question.id,
                        player_id=player.player_id,
                        answer_text="[buzzer]",
                        is_correct=False,
                        is_first=False,
                        points=penalty,
                        response_time_ms=0,
                        essay_graded=True,
                    )
                )
            else:
                existing.is_correct = False
                existing.points = (existing.points or 0) + penalty
                existing.essay_graded = True

            db.commit()

            players = db.query(Player).filter(Player.room_id == room.id).all()
            rankings = self.compute_rankings(players)
            judged = {
                "type": "buzzer_judged",
                "correct": False,
                "player_id": player.player_id,
                "player_name": player.name,
                "points_awarded": penalty,
                "score": player.score,
                "question_id": question.id,
                "excluded_ids": list(excluded),
            }
            await ws_manager.broadcast(room_code, judged)
            await ws_manager.broadcast(
                room_code,
                {
                    "type": "score_updated",
                    "rankings": rankings,
                    "question_answered": False,
                },
            )
            await ws_manager.broadcast(
                room_code,
                {
                    "type": "buzzer_reset",
                    "excluded_ids": list(excluded),
                    "player_id": player.player_id,
                    "player_name": player.name,
                    "question_id": question.id,
                    "revealed": True,
                    "points": penalty,
                    "message": (
                        f"❌ {player.name} sai! {penalty} điểm. "
                        "Người khác dành quyền trả lời."
                    ),
                },
            )
            self.schedule_buzzer_spawn(room_code, question.id, delay=random.uniform(0.8, 2.2))
            return judged

    def compute_rankings(self, players: List[Player]) -> List[dict]:
        """Tie-break: higher score → more correct → lower answer time → earlier join."""
        sorted_players = sorted(
            players,
            key=lambda p: (
                -p.score,
                -p.correct_count,
                p.total_answer_time_ms,
                p.joined_at or _utcnow(),
            ),
        )
        result = []
        for i, p in enumerate(sorted_players):
            result.append(
                {
                    "rank": i + 1,
                    "player_id": p.player_id,
                    "name": p.name,
                    "score": p.score,
                    "correct_count": p.correct_count,
                    "total_answer_time_ms": p.total_answer_time_ms,
                }
            )
        return result

    async def submit_answer(
        self,
        db: Session,
        room_code: str,
        player_id: str,
        question_id: int,
        answer_id: Optional[int] = None,
        answer_text: Optional[str] = None,
    ) -> dict:
        """
        Each player submits once per question (MCQ / text essay).
        Numeric fill-in: wrong answers do not lock; 10s cooldown then retry.
        Wrong MCQ: -10, question stays open.
        Correct: +points and locks question for others (first correct wins).
        """
        lock = await self.get_room_lock(room_code)
        async with lock:
            return self._submit_answer_sync(
                db, room_code, player_id, question_id, answer_id, answer_text
            )

    def _submit_answer_sync(
        self,
        db: Session,
        room_code: str,
        player_id: str,
        question_id: int,
        answer_id: Optional[int],
        answer_text: Optional[str],
    ) -> dict:
        room = db.query(Room).filter(Room.room_code == room_code).first()
        if not room:
            raise ValueError("ROOM_NOT_FOUND")
        if self.is_buzzer_mode(room):
            raise ValueError("NOT_ALLOWED")
        if room.status == RoomStatus.FINISHED.value:
            raise ValueError("ROOM_FINISHED")
        if room.status == RoomStatus.WAITING.value:
            raise ValueError("GAME_NOT_STARTED")
        if room.status == RoomStatus.PAUSED.value:
            raise ValueError("ROOM_PAUSED")
        if room.status != RoomStatus.RUNNING.value:
            raise ValueError("ROOM_NOT_RUNNING")
        if room.current_question_id != question_id:
            raise ValueError("WRONG_QUESTION")
        # True = someone already answered CORRECTLY
        if room.question_answered:
            raise ValueError("QUESTION_ALREADY_ANSWERED")

        now = _utcnow()
        if room.question_ends_at:
            ends = _as_naive(room.question_ends_at)
            if now > ends:
                raise ValueError("QUESTION_EXPIRED")

        player = (
            db.query(Player)
            .filter(Player.player_id == player_id, Player.room_id == room.id)
            .first()
        )
        if not player:
            raise ValueError("PLAYER_NOT_FOUND")

        question = (
            db.query(Question)
            .options(joinedload(Question.options))
            .filter(Question.id == question_id)
            .first()
        )
        if not question:
            raise ValueError("QUESTION_NOT_FOUND")

        is_numeric = (
            question.question_type == QuestionType.ESSAY.value
            and str(getattr(question, "input_mode", None) or "TEXT").upper() == "NUMBER"
        )
        is_puzzle = question.question_type == QuestionType.BLOCK_PUZZLE.value
        award = int(getattr(question, "points", None) or 10)

        if is_numeric or is_puzzle:
            key = (room_code, player_id, question_id)
            until = self._wrong_retry_at.get(key)
            now_ts = time.time()
            if until and now_ts < until:
                raise RetryCooldown(until - now_ts)

        existing = (
            db.query(Submission)
            .filter(
                Submission.room_id == room.id,
                Submission.question_id == question_id,
                Submission.player_id == player_id,
            )
            .first()
        )
        if existing:
            raise ValueError("ALREADY_SUBMITTED")

        is_correct = False
        points = 0
        display_answer = ""
        answer_letter = ""

        if question.question_type == QuestionType.MULTIPLE_CHOICE.value:
            if answer_id is None:
                raise ValueError("INVALID_ANSWER")
            option = (
                db.query(AnswerOption)
                .filter(
                    AnswerOption.id == answer_id,
                    AnswerOption.question_id == question_id,
                )
                .first()
            )
            if not option:
                raise ValueError("INVALID_ANSWER")
            if int(answer_id) in set(
                self.get_eliminated_option_ids(room_code, question_id)
            ):
                raise ValueError("OPTION_ELIMINATED")
            is_correct = bool(option.is_correct)
            answer_letter = chr(65 + (option.order_index or 0))
            display_answer = (
                f"{answer_letter}. {option.content}".strip()
                if option.content
                else answer_letter
            )
            points = award if is_correct else -10
        elif is_puzzle:
            if not answer_text or not str(answer_text).strip():
                raise ValueError("INVALID_ANSWER")
            display_answer = "ghép khối Scratch"
            solution = parse_blocks_json(getattr(question, "blocks_json", None))
            student = student_script_from_payload(answer_text)
            is_correct = match_script(solution, student)
            points = award if is_correct else 0
        else:
            # Essay — auto-check against accepted answer list
            if not answer_text or not answer_text.strip():
                raise ValueError("INVALID_ANSWER")
            display_answer = answer_text.strip()[:200]
            accepted = [o.content for o in question.options if (o.content or "").strip()]
            if is_numeric:
                is_correct = match_numeric_answer(answer_text, accepted)
            else:
                is_correct = match_essay_answer(answer_text, accepted)
            points = award if is_correct else (0 if is_numeric else -10)

        # Numeric / puzzle: wrong = cooldown, no permanent submit / no score hit
        if (is_numeric or is_puzzle) and not is_correct:
            self._wrong_retry_at[(room_code, player_id, question_id)] = (
                time.time() + self.WRONG_RETRY_SEC
            )
            return {
                "ok": True,
                "player_id": player_id,
                "player_name": player.name,
                "question_id": question_id,
                "is_correct": False,
                "points": 0,
                "score": player.score,
                "answer_display": display_answer,
                "answer_letter": "",
                "question_type": question.question_type,
                "response_time_ms": 0,
                "question_locked": False,
                "is_first": False,
                "can_retry": True,
                "retry_after": self.WRONG_RETRY_SEC,
            }

        if (is_numeric or is_puzzle) and is_correct:
            self._wrong_retry_at.pop((room_code, player_id, question_id), None)

        prior_count = (
            db.query(Submission)
            .filter(
                Submission.room_id == room.id,
                Submission.question_id == question_id,
            )
            .count()
        )
        is_first = prior_count == 0

        started = _as_naive(room.question_started_at) or now
        response_time_ms = max(0.0, (now - started).total_seconds() * 1000)

        submission = Submission(
            room_id=room.id,
            question_id=question_id,
            player_id=player_id,
            answer_id=answer_id,
            answer_text=answer_text,
            is_correct=is_correct,
            is_first=is_first,
            submitted_at=now,
            points=points,
            response_time_ms=response_time_ms,
            essay_graded=True,
        )

        try:
            db.add(submission)
            if is_correct:
                room.question_answered = True
                room.first_answer_player_id = player_id
                player.score += points
                player.correct_count += 1
            else:
                player.score += points  # -10
                if is_first:
                    room.first_answer_player_id = player_id
            player.total_answer_time_ms += response_time_ms
            db.commit()
            db.refresh(player)
            db.refresh(submission)
        except IntegrityError:
            db.rollback()
            raise ValueError("ALREADY_SUBMITTED")

        eliminated_ids = self.get_eliminated_option_ids(room_code, question_id)
        if (
            not is_correct
            and question.question_type == QuestionType.MULTIPLE_CHOICE.value
            and answer_id is not None
        ):
            eliminated_ids = self.mark_option_eliminated(
                room_code, question_id, int(answer_id)
            )

        return {
            "ok": True,
            "player_id": player_id,
            "player_name": player.name,
            "question_id": question_id,
            "is_correct": is_correct,
            "points": points,
            "score": player.score,
            "answer_display": display_answer,
            "answer_letter": answer_letter,
            "answer_id": answer_id,
            "eliminated_option_ids": eliminated_ids,
            "question_type": question.question_type,
            "response_time_ms": response_time_ms,
            "question_locked": is_correct,
            "is_first": is_first,
        }

    def cancel_auto_next(self, room_code: str) -> None:
        task = self._auto_next_tasks.pop(room_code, None)
        if task and not task.done():
            task.cancel()

    def schedule_auto_next_after_correct(
        self, room_code: str, question_id: int, effect_ms: int | None = None
    ) -> None:
        """After Solo-kill FX + countdown, advance to the next question."""
        self.cancel_auto_next(room_code)
        fx = (
            int(effect_ms)
            if effect_ms is not None
            else self.correct_effect_ms(0)
        )
        delay = (fx / 1000.0) + float(self.CORRECT_COUNTDOWN_SEC)

        async def _run():
            try:
                await asyncio.sleep(delay)
                from app.database import SessionLocal

                db = SessionLocal()
                try:
                    room = self.get_room(db, room_code)
                    if not room:
                        return
                    if room.current_question_id != question_id:
                        return
                    if not room.question_answered:
                        return
                    if room.status not in (
                        RoomStatus.RUNNING.value,
                        RoomStatus.PAUSED.value,
                    ):
                        return
                    # Resume if paused so next_question is allowed
                    if room.status == RoomStatus.PAUSED.value:
                        room.status = RoomStatus.RUNNING.value
                        db.commit()
                    await self.next_question(db, room_code)
                except Exception:
                    pass
                finally:
                    db.close()
            except asyncio.CancelledError:
                return
            finally:
                self._auto_next_tasks.pop(room_code, None)

        self._auto_next_tasks[room_code] = asyncio.create_task(_run())

    async def broadcast_answer_result(self, db: Session, room_code: str, result: dict):
        players = (
            db.query(Player).join(Room).filter(Room.room_code == room_code).all()
        )
        rankings = self.compute_rankings(players)

        if result["is_correct"]:
            room = self.get_room(db, room_code)
            question_id = result.get("question_id") or (
                room.current_question_id if room else None
            )
            victim_count = max(0, len(players) - 1)
            effect_ms = self.correct_effect_ms(victim_count)
            await ws_manager.broadcast(
                room_code,
                {
                    "type": "answer_correct",
                    "player_name": result["player_name"],
                    "player_id": result["player_id"],
                    "points": result["points"],
                    "score": result["score"],
                    "answer_display": result["answer_display"],
                    "question_locked": True,
                    "question_type": result["question_type"],
                    "question_id": question_id,
                    "answer_id": result.get("answer_id"),
                    "eliminated_option_ids": result.get("eliminated_option_ids") or [],
                    "effect_ms": effect_ms,
                    "countdown_seconds": self.CORRECT_COUNTDOWN_SEC,
                    "auto_next": True,
                    "message": f"🎉 Bạn {result['player_name']} đã trả lời đúng!",
                },
            )
            if question_id:
                self.schedule_auto_next_after_correct(
                    room_code, int(question_id), effect_ms
                )
        else:
            can_retry = bool(result.get("can_retry"))
            retry_after = int(result.get("retry_after") or self.WRONG_RETRY_SEC)
            if can_retry:
                msg = (
                    f"❌ Sai rồi! Đợi {retry_after} giây rồi nhập lại."
                )
            else:
                msg = (
                    f"❌ Rất tiếc! Bạn đã trả lời sai ({result['answer_display']}). "
                    f"{result['points']} điểm."
                )
            await ws_manager.send_to_player(
                room_code,
                result["player_id"],
                {
                    "type": "answer_wrong",
                    "player_id": result["player_id"],
                    "player_name": result["player_name"],
                    "points": result["points"],
                    "score": result["score"],
                    "answer_display": result["answer_display"],
                    "question_locked": False,
                    "can_retry": can_retry,
                    "retry_after": retry_after if can_retry else 0,
                    "answer_id": result.get("answer_id"),
                    "eliminated_option_ids": result.get("eliminated_option_ids") or [],
                    "message": msg,
                },
            )
            await ws_manager.broadcast(
                room_code,
                {
                    "type": "answer_received",
                    "player_name": result["player_name"],
                    "player_id": result["player_id"],
                    "is_correct": False,
                    "points": result["points"],
                    "answer_display": result["answer_display"],
                    "answer_letter": result.get("answer_letter", ""),
                    "answer_id": result.get("answer_id"),
                    "eliminated_option_ids": result.get("eliminated_option_ids") or [],
                    "question_locked": False,
                    "question_type": result["question_type"],
                    "can_retry": can_retry,
                    "message": (
                        f"⚡ {result['player_name']} nhập «{result['answer_display']}» — SAI"
                        + (
                            f" (đợi {retry_after}s rồi thử lại)."
                            if can_retry
                            else f" ({result['points']} điểm). Người khác vẫn có thể trả lời!"
                        )
                    ),
                },
                exclude_player_id=result["player_id"],
            )

        await ws_manager.broadcast(
            room_code,
            {
                "type": "score_updated",
                "rankings": rankings,
                "question_answered": bool(result.get("question_locked")),
                "first_answer_player_id": (
                    result["player_id"] if result.get("is_first") else None
                ),
            },
        )

    def grade_essay(
        self,
        db: Session,
        room_code: str,
        submission_id: int,
        is_correct: bool,
        points: int = 10,
    ) -> dict:
        room = self.get_room(db, room_code)
        if not room:
            raise ValueError("ROOM_NOT_FOUND")
        sub = (
            db.query(Submission)
            .filter(Submission.id == submission_id, Submission.room_id == room.id)
            .first()
        )
        if not sub:
            raise ValueError("NOT_ALLOWED")
        player = db.query(Player).filter(Player.player_id == sub.player_id).first()
        if not player:
            raise ValueError("PLAYER_NOT_FOUND")

        if sub.essay_graded and sub.points:
            player.score -= sub.points
            if sub.is_correct:
                player.correct_count = max(0, player.correct_count - 1)

        sub.is_correct = is_correct
        sub.points = (points if points else 10) if is_correct else -10
        sub.essay_graded = True
        player.score += sub.points
        if is_correct:
            player.correct_count += 1
        db.commit()
        return {
            "submission_id": sub.id,
            "player_id": player.player_id,
            "player_name": player.name,
            "is_correct": is_correct,
            "points": sub.points,
            "score": player.score,
        }

    def player_has_submitted(
        self, db: Session, room_id: int, question_id: int, player_id: str
    ) -> bool:
        return (
            db.query(Submission)
            .filter(
                Submission.room_id == room_id,
                Submission.question_id == question_id,
                Submission.player_id == player_id,
            )
            .first()
            is not None
        )

    def get_admin_question_stats(self, db: Session, room: Room) -> dict:
        players = db.query(Player).filter(Player.room_id == room.id).all()
        answered = 0
        if room.current_question_id:
            answered = (
                db.query(Submission)
                .filter(
                    Submission.room_id == room.id,
                    Submission.question_id == room.current_question_id,
                )
                .count()
            )
        return {
            "player_count": len(players),
            "answered_count": answered,
            "pending_count": max(0, len(players) - answered),
            "question_answered": room.question_answered,
        }


game_service = GameService()
