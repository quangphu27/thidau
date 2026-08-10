from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, List, Optional, Set

from fastapi import WebSocket


class ConnectionInfo:
    def __init__(
        self,
        websocket: WebSocket,
        role: str = "student",
        player_id: Optional[str] = None,
    ):
        self.websocket = websocket
        self.role = role  # student | admin | presentation
        self.player_id = player_id


class WebSocketManager:
    def __init__(self):
        # room_code -> list of ConnectionInfo
        self.rooms: Dict[str, List[ConnectionInfo]] = {}
        self._lock = asyncio.Lock()

    async def connect(
        self,
        room_code: str,
        websocket: WebSocket,
        role: str = "student",
        player_id: Optional[str] = None,
    ) -> ConnectionInfo:
        await websocket.accept()
        info = ConnectionInfo(websocket, role=role, player_id=player_id)
        async with self._lock:
            self.rooms.setdefault(room_code, []).append(info)
        return info

    async def disconnect(self, room_code: str, websocket: WebSocket):
        async with self._lock:
            conns = self.rooms.get(room_code, [])
            self.rooms[room_code] = [c for c in conns if c.websocket is not websocket]
            if not self.rooms[room_code]:
                del self.rooms[room_code]

    async def broadcast(
        self,
        room_code: str,
        event: dict,
        exclude_player_id: Optional[str] = None,
        roles: Optional[Set[str]] = None,
    ):
        payload = json.dumps(event, default=str, ensure_ascii=False)
        async with self._lock:
            conns = list(self.rooms.get(room_code, []))
        dead: List[ConnectionInfo] = []
        for conn in conns:
            if exclude_player_id and conn.player_id == exclude_player_id:
                continue
            if roles and conn.role not in roles:
                continue
            try:
                await conn.websocket.send_text(payload)
            except Exception:
                dead.append(conn)
        if dead:
            async with self._lock:
                current = self.rooms.get(room_code, [])
                self.rooms[room_code] = [c for c in current if c not in dead]

    async def send_to_player(self, room_code: str, player_id: str, event: dict):
        payload = json.dumps(event, default=str, ensure_ascii=False)
        async with self._lock:
            conns = list(self.rooms.get(room_code, []))
        for conn in conns:
            if conn.player_id == player_id:
                try:
                    await conn.websocket.send_text(payload)
                except Exception:
                    pass

    async def send_to_connection(self, websocket: WebSocket, event: dict):
        payload = json.dumps(event, default=str, ensure_ascii=False)
        try:
            await websocket.send_text(payload)
        except Exception:
            pass

    def get_connection_count(self, room_code: str) -> int:
        return len(self.rooms.get(room_code, []))

    async def close_room(self, room_code: str, event: Optional[dict] = None):
        """Notify clients and drop all connections for a room."""
        if event:
            await self.broadcast(room_code, event)
        async with self._lock:
            conns = list(self.rooms.pop(room_code, []))
        for conn in conns:
            try:
                await conn.websocket.close()
            except Exception:
                pass


ws_manager = WebSocketManager()
