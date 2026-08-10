import json
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import joinedload

from app.database import SessionLocal
from app.models import Question, Room, RoomStatus
from app.services import game_service
from app.websocket import ws_manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/room/{room_code}")
async def websocket_room(
    websocket: WebSocket,
    room_code: str,
    role: str = Query(default="student"),
    player_id: Optional[str] = Query(default=None),
):
    room_code = room_code.upper()
    db = SessionLocal()
    try:
        room = game_service.get_room(db, room_code)
        if not room:
            await websocket.accept()
            await websocket.send_text(
                json.dumps({"type": "error", "code": "ROOM_NOT_FOUND"})
            )
            await websocket.close()
            return

        # Validate player on reconnect
        if player_id:
            player = game_service.get_player(db, player_id)
            if not player or player.room_id != room.id:
                player_id = None

        if role not in ("student", "admin", "presentation"):
            role = "student"

        await ws_manager.connect(room_code, websocket, role=role, player_id=player_id)

        # Send current state on connect / reconnect
        state = game_service.room_state_payload(db, room)
        state["type"] = "room_updated"
        if player_id:
            state["your_player_id"] = player_id
            player = game_service.get_player(db, player_id)
            if player:
                state["your_score"] = player.score
                state["your_name"] = player.name
                if room.current_question_id:
                    state["already_submitted"] = game_service.player_has_submitted(
                        db, room.id, room.current_question_id, player_id
                    )
        await ws_manager.send_to_connection(websocket, state)

        # Lobby history + positions when waiting
        if room.status == RoomStatus.WAITING.value:
            history = game_service.get_lobby_history(room_code)
            if history:
                await ws_manager.send_to_connection(
                    websocket, {"type": "lobby_history", "items": history}
                )
            positions = game_service.get_lobby_positions(room_code)
            await ws_manager.send_to_connection(
                websocket, {"type": "lobby_positions", "positions": positions}
            )

        if room.current_question_id and room.status in (
            RoomStatus.RUNNING.value,
            RoomStatus.PAUSED.value,
        ):
            q = (
                db.query(Question)
                .options(joinedload(Question.options))
                .filter(Question.id == room.current_question_id)
                .first()
            )
            if q:
                payload = game_service.question_public_payload(db, room, q)
                if player_id:
                    payload["already_submitted"] = game_service.player_has_submitted(
                        db, room.id, room.current_question_id, player_id
                    )
                await ws_manager.send_to_connection(websocket, payload)

        if room.status == RoomStatus.FINISHED.value:
            players = room.players
            rankings = game_service.compute_rankings(list(players))
            await ws_manager.send_to_connection(
                websocket,
                {
                    "type": "game_finished",
                    "room_code": room_code,
                    "rankings": rankings,
                    "winner": rankings[0] if rankings else None,
                },
            )

        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await ws_manager.send_to_connection(
                    websocket, {"type": "error", "code": "INVALID_ANSWER"}
                )
                continue

            msg_type = data.get("type")

            if msg_type == "join_room":
                # Optional WS join — prefer REST join then reconnect with player_id
                name = (data.get("name") or "").strip()
                if not name:
                    await ws_manager.send_to_connection(
                        websocket, {"type": "error", "code": "NAME_REQUIRED"}
                    )
                    continue
                try:
                    # Need fresh session for write
                    db.close()
                    db = SessionLocal()
                    player = game_service.join_room(db, room_code, name)
                    player_id = player.player_id
                    # Update connection info
                    async with ws_manager._lock:
                        for c in ws_manager.rooms.get(room_code, []):
                            if c.websocket is websocket:
                                c.player_id = player_id
                    room = game_service.get_room(db, room_code)
                    await ws_manager.send_to_connection(
                        websocket,
                        {
                            "type": "joined",
                            "player_id": player.player_id,
                            "name": player.name,
                            "score": player.score,
                        },
                    )
                    await ws_manager.broadcast(
                        room_code,
                        {
                            "type": "player_joined",
                            "player": {
                                "player_id": player.player_id,
                                "name": player.name,
                                "score": 0,
                            },
                            **game_service.room_state_payload(db, room),
                        },
                    )
                except ValueError as e:
                    await ws_manager.send_to_connection(
                        websocket, {"type": "error", "code": str(e)}
                    )

            elif msg_type == "submit_answer":
                pid = data.get("player_id") or player_id
                qid = data.get("question_id")
                answer_id = data.get("answer_id")
                answer_text = data.get("answer_text")
                if not pid or not qid:
                    await ws_manager.send_to_connection(
                        websocket, {"type": "error", "code": "INVALID_ANSWER"}
                    )
                    continue
                try:
                    db.close()
                    db = SessionLocal()
                    result = await game_service.submit_answer(
                        db,
                        room_code,
                        pid,
                        int(qid),
                        answer_id=int(answer_id) if answer_id is not None else None,
                        answer_text=answer_text,
                    )
                    await game_service.broadcast_answer_result(db, room_code, result)
                except ValueError as e:
                    await ws_manager.send_to_connection(
                        websocket, {"type": "error", "code": str(e)}
                    )

            elif msg_type == "ping":
                await ws_manager.send_to_connection(
                    websocket, {"type": "pong", "server_time": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()}
                )

            elif msg_type in ("lobby_chat", "lobby_announce", "lobby_action", "lobby_move"):
                db.close()
                db = SessionLocal()
                room = game_service.get_room(db, room_code)
                if not room:
                    await ws_manager.send_to_connection(
                        websocket, {"type": "error", "code": "ROOM_NOT_FOUND"}
                    )
                    continue
                if room.status != RoomStatus.WAITING.value:
                    await ws_manager.send_to_connection(
                        websocket, {"type": "error", "code": "LOBBY_CLOSED"}
                    )
                    continue

                if msg_type == "lobby_chat":
                    text = (data.get("text") or "").strip()[:200]
                    if not text:
                        continue
                    if role == "admin":
                        from app.models import Setting

                        host_row = (
                            db.query(Setting)
                            .filter(Setting.key == "admin_display_name")
                            .first()
                        )
                        sender_name = (
                            (host_row.value if host_row and host_row.value else "")
                            or "Thầy Phú Anex"
                        )
                        sender_id = "admin"
                    else:
                        pid = data.get("player_id") or player_id
                        player = game_service.get_player(db, pid) if pid else None
                        if not player or player.room_id != room.id:
                            await ws_manager.send_to_connection(
                                websocket, {"type": "error", "code": "NOT_ALLOWED"}
                            )
                            continue
                        sender_name = player.name
                        sender_id = player.player_id
                    event = {
                        "type": "lobby_chat",
                        "id": f"c-{__import__('time').time_ns()}",
                        "player_id": sender_id,
                        "player_name": sender_name,
                        "text": text,
                        "is_admin": role == "admin",
                        "at": __import__("datetime").datetime.now(
                            __import__("datetime").timezone.utc
                        ).isoformat(),
                    }
                    game_service.push_lobby_event(room_code, event)
                    await ws_manager.broadcast(room_code, event)

                elif msg_type == "lobby_announce":
                    if role != "admin":
                        await ws_manager.send_to_connection(
                            websocket, {"type": "error", "code": "NOT_ALLOWED"}
                        )
                        continue
                    text = (data.get("text") or "").strip()[:300]
                    if not text:
                        continue
                    event = {
                        "type": "lobby_announce",
                        "id": f"a-{__import__('time').time_ns()}",
                        "text": text,
                        "at": __import__("datetime").datetime.now(
                            __import__("datetime").timezone.utc
                        ).isoformat(),
                    }
                    game_service.push_lobby_event(room_code, event)
                    await ws_manager.broadcast(room_code, event)

                elif msg_type == "lobby_action":
                    action = (data.get("action") or "").strip().lower()
                    if action not in ("brick", "brawl"):
                        await ws_manager.send_to_connection(
                            websocket, {"type": "error", "code": "NOT_ALLOWED"}
                        )
                        continue

                    from app.models import Setting

                    host_row = (
                        db.query(Setting)
                        .filter(Setting.key == "admin_display_name")
                        .first()
                    )
                    host_name = (
                        (host_row.value if host_row and host_row.value else "")
                        or "Thầy Phú Anex"
                    )

                    if role == "admin":
                        from_id = "admin"
                        from_name = host_name
                    else:
                        pid = data.get("player_id") or player_id
                        player = game_service.get_player(db, pid) if pid else None
                        if not player or player.room_id != room.id:
                            await ws_manager.send_to_connection(
                                websocket, {"type": "error", "code": "NOT_ALLOWED"}
                            )
                            continue
                        from_id = player.player_id
                        from_name = player.name

                    target_id = data.get("target_id")
                    target_name = None
                    if action in ("brick", "brawl"):
                        players = list(room.players or [])
                        # Virtual host character + students
                        candidates = []
                        if from_id != "admin":
                            candidates.append(
                                {"player_id": "admin", "name": host_name}
                            )
                        for p in players:
                            if p.player_id != from_id:
                                candidates.append(
                                    {"player_id": p.player_id, "name": p.name}
                                )

                        if target_id:
                            target = next(
                                (
                                    c
                                    for c in candidates
                                    if c["player_id"] == target_id
                                ),
                                None,
                            )
                        else:
                            target = None
                            if candidates:
                                import random

                                target = random.choice(candidates)
                        if not target:
                            continue
                        target_id = target["player_id"]
                        target_name = target["name"]

                    event = {
                        "type": "lobby_action",
                        "id": f"x-{__import__('time').time_ns()}",
                        "action": action,
                        "from_id": from_id,
                        "from_name": from_name,
                        "target_id": target_id,
                        "target_name": target_name,
                        "at": __import__("datetime").datetime.now(
                            __import__("datetime").timezone.utc
                        ).isoformat(),
                    }
                    game_service.push_lobby_event(room_code, event)
                    await ws_manager.broadcast(room_code, event)

                elif msg_type == "lobby_move":
                    from app.models import Setting

                    host_row = (
                        db.query(Setting)
                        .filter(Setting.key == "admin_display_name")
                        .first()
                    )
                    host_name = (
                        (host_row.value if host_row and host_row.value else "")
                        or "Thầy Phú Anex"
                    )
                    if role == "admin":
                        pid = "admin"
                        pname = host_name
                    else:
                        pid = data.get("player_id") or player_id
                        player = game_service.get_player(db, pid) if pid else None
                        if not player or player.room_id != room.id:
                            await ws_manager.send_to_connection(
                                websocket, {"type": "error", "code": "NOT_ALLOWED"}
                            )
                            continue
                        pname = player.name
                    try:
                        x = float(data.get("x", 50))
                        y = float(data.get("y", 60))
                    except (TypeError, ValueError):
                        continue
                    pos = game_service.set_lobby_position(room_code, pid, x, y)
                    await ws_manager.broadcast(
                        room_code,
                        {
                            "type": "lobby_move",
                            "player_id": pid,
                            "player_name": pname,
                            "x": pos["x"],
                            "y": pos["y"],
                        },
                    )

            else:
                await ws_manager.send_to_connection(
                    websocket, {"type": "error", "code": "NOT_ALLOWED"}
                )

    except WebSocketDisconnect:
        await ws_manager.disconnect(room_code, websocket)
        if player_id:
            game_service.remove_lobby_position(room_code, player_id)
            await ws_manager.broadcast(
                room_code,
                {"type": "player_left", "player_id": player_id},
            )
    except Exception:
        await ws_manager.disconnect(room_code, websocket)
        if player_id:
            game_service.remove_lobby_position(room_code, player_id)
    finally:
        db.close()
