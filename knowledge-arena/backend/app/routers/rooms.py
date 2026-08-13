import socket
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Admin, Exam, Player, Room, RoomStatus, Submission
from app.schemas import (
    GradeEssayRequest,
    JoinRoomRequest,
    JoinRoomResponse,
    PlayerOut,
    RankingEntry,
    ResultsOut,
    RoomCreate,
    RoomOut,
)
from app.services import game_service
from app.utils.deps import get_current_admin
from app.websocket import ws_manager

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


def _detect_lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def _room_out(room: Room, request: Optional[Request] = None) -> RoomOut:
    exam_title = room.exam.title if room.exam else ""
    time_per = room.exam.time_per_question if room.exam else 15
    host = _detect_lan_ip()
    # Prefer request host if available
    if request:
        client_host = request.headers.get("host", "").split(":")[0]
        # frontend port from referer or default 5173
        pass
    join_url = f"http://{host}:5173/join/{room.room_code}"
    return RoomOut(
        id=room.id,
        room_code=room.room_code,
        exam_id=room.exam_id,
        exam_title=exam_title,
        status=room.status,
        current_question_id=room.current_question_id,
        current_question_index=room.current_question_index,
        question_answered=room.question_answered,
        player_count=len(room.players) if room.players else 0,
        created_at=room.created_at,
        started_at=room.started_at,
        finished_at=room.finished_at,
        join_url=join_url,
        time_per_question=time_per,
    )


@router.post("", response_model=RoomOut)
def create_room(
    body: RoomCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    try:
        room = game_service.create_room(db, body.exam_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    room = (
        db.query(Room)
        .options(joinedload(Room.exam), joinedload(Room.players))
        .filter(Room.id == room.id)
        .first()
    )
    return _room_out(room, request)


@router.get("", response_model=List[RoomOut])
def list_rooms(
    request: Request,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    rooms = (
        db.query(Room)
        .options(joinedload(Room.exam), joinedload(Room.players))
        .order_by(Room.created_at.desc())
        .all()
    )
    return [_room_out(r, request) for r in rooms]


@router.get("/{code}", response_model=RoomOut)
def get_room(code: str, request: Request, db: Session = Depends(get_db)):
    room = (
        db.query(Room)
        .options(joinedload(Room.exam), joinedload(Room.players))
        .filter(Room.room_code == code.upper())
        .first()
    )
    if not room:
        raise HTTPException(status_code=404, detail="ROOM_NOT_FOUND")
    return _room_out(room, request)


@router.delete("/{code}")
async def delete_room(
    code: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    room = (
        db.query(Room)
        .options(joinedload(Room.players))
        .filter(Room.room_code == code.upper())
        .first()
    )
    if not room:
        raise HTTPException(status_code=404, detail="ROOM_NOT_FOUND")
    room_code = room.room_code
    await ws_manager.close_room(
        room_code,
        {"type": "room_deleted", "room_code": room_code, "message": "Phòng đã bị xóa"},
    )
    game_service.clear_lobby(room_code)
    db.delete(room)
    db.commit()
    return {"ok": True, "room_code": room_code}


@router.post("/{code}/join", response_model=JoinRoomResponse)
async def join_room(code: str, body: JoinRoomRequest, db: Session = Depends(get_db)):
    try:
        player = game_service.join_room(db, code.upper(), body.name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    room = game_service.get_room(db, code.upper())
    await ws_manager.broadcast(
        code.upper(),
        {
            "type": "player_joined",
            "player": {
                "player_id": player.player_id,
                "name": player.name,
                "score": player.score,
            },
            **game_service.room_state_payload(db, room),
        },
    )
    return JoinRoomResponse(
        player_id=player.player_id,
        name=player.name,
        room_code=code.upper(),
        score=player.score,
    )


@router.post("/{code}/start")
async def start_room(
    code: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    try:
        return await game_service.start_game(db, code.upper())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{code}/next")
async def next_question(
    code: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    try:
        return await game_service.next_question(db, code.upper())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{code}/pause")
async def pause_room(
    code: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    try:
        return await game_service.pause_game(db, code.upper())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{code}/resume")
async def resume_room(
    code: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    try:
        return await game_service.resume_game(db, code.upper())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{code}/adjust-time")
async def adjust_time(
    code: str,
    delta_seconds: int = 5,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Adjust current question timer by delta_seconds (e.g. +5 or -5)."""
    try:
        return await game_service.adjust_question_time(
            db, code.upper(), int(delta_seconds)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{code}/finish")
async def finish_room(
    code: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    try:
        return await game_service.finish_game(db, code.upper())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{code}/players", response_model=List[PlayerOut])
def list_players(code: str, db: Session = Depends(get_db)):
    room = game_service.get_room(db, code.upper())
    if not room:
        raise HTTPException(status_code=404, detail="ROOM_NOT_FOUND")
    players = (
        db.query(Player)
        .filter(Player.room_id == room.id)
        .order_by(Player.joined_at)
        .all()
    )
    return [PlayerOut.model_validate(p) for p in players]


@router.get("/{code}/results", response_model=ResultsOut)
def get_results(code: str, db: Session = Depends(get_db)):
    room = game_service.get_room(db, code.upper())
    if not room:
        raise HTTPException(status_code=404, detail="ROOM_NOT_FOUND")
    players = db.query(Player).filter(Player.room_id == room.id).all()
    rankings_raw = game_service.compute_rankings(players)
    rankings = [RankingEntry(**r) for r in rankings_raw]
    return ResultsOut(
        room_code=room.room_code,
        status=room.status,
        rankings=rankings,
        winner=rankings[0] if rankings else None,
    )


@router.get("/{code}/state")
def get_room_state(code: str, db: Session = Depends(get_db)):
    room = game_service.get_room(db, code.upper())
    if not room:
        raise HTTPException(status_code=404, detail="ROOM_NOT_FOUND")
    state = game_service.room_state_payload(db, room)
    stats = game_service.get_admin_question_stats(db, room)
    state["stats"] = stats
    if room.current_question_id and room.status in (
        RoomStatus.RUNNING.value,
        RoomStatus.PAUSED.value,
    ):
        from app.models import Question

        q = (
            db.query(Question)
            .options(joinedload(Question.options))
            .filter(Question.id == room.current_question_id)
            .first()
        )
        if q:
            state["current_question"] = game_service.question_public_payload(db, room, q)[
                "question"
            ]
    return state


@router.get("/{code}/submissions")
def list_submissions(
    code: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    room = game_service.get_room(db, code.upper())
    if not room:
        raise HTTPException(status_code=404, detail="ROOM_NOT_FOUND")
    subs = (
        db.query(Submission)
        .filter(Submission.room_id == room.id)
        .order_by(Submission.submitted_at.desc())
        .all()
    )
    players = {p.player_id: p.name for p in room.players}
    return [
        {
            "id": s.id,
            "question_id": s.question_id,
            "player_id": s.player_id,
            "player_name": players.get(s.player_id, ""),
            "answer_id": s.answer_id,
            "answer_text": s.answer_text,
            "is_correct": s.is_correct,
            "points": s.points,
            "essay_graded": s.essay_graded,
            "submitted_at": s.submitted_at,
        }
        for s in subs
    ]


@router.post("/{code}/grade/{submission_id}")
async def grade_essay(
    code: str,
    submission_id: int,
    body: GradeEssayRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    try:
        result = game_service.grade_essay(
            db, code.upper(), submission_id, body.is_correct, body.points
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    room = game_service.get_room(db, code.upper())
    players = db.query(Player).filter(Player.room_id == room.id).all()
    rankings = game_service.compute_rankings(players)
    if result["is_correct"]:
        await ws_manager.broadcast(
            code.upper(),
            {
                "type": "answer_correct",
                "player_name": result["player_name"],
                "player_id": result["player_id"],
                "points": result["points"],
                "score": result["score"],
                "message": f"🎉 Bạn {result['player_name']} đã trả lời đúng!",
            },
        )
    await ws_manager.broadcast(
        code.upper(),
        {"type": "score_updated", "rankings": rankings},
    )
    return result
