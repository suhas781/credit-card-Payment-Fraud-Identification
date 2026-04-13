"""WebSocket live simulation + toggle."""

from __future__ import annotations

import asyncio
import os
from typing import Any

from fastapi import APIRouter, Request, WebSocket
from starlette.websockets import WebSocketDisconnect

from db import insert_user_action
from schemas import SimulateToggleBody
from simulator import build_simulation_message

router = APIRouter(tags=["simulate"])


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.connections:
            self.connections.remove(ws)

    async def broadcast(self, message: dict[str, Any]) -> None:
        stale: list[WebSocket] = []
        for ws in self.connections:
            try:
                await ws.send_json(message)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self.disconnect(ws)


manager = ConnectionManager()


async def simulation_worker(app: Any) -> None:
    interval_ms = int(os.environ.get("SIMULATE_INTERVAL_MS", "1500"))
    while True:
        await asyncio.sleep(interval_ms / 1000.0)
        if not getattr(app.state, "simulation_active", False):
            continue
        if not manager.connections:
            continue
        try:
            msg = await asyncio.to_thread(build_simulation_message)
            await manager.broadcast(msg)
        except Exception:
            pass


@router.websocket("/ws/simulate")
async def websocket_simulate(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=60.0)
            except asyncio.TimeoutError:
                continue
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)


@router.get("/simulate/status")
async def simulate_status(request: Request) -> dict[str, bool]:
    return {"active": bool(getattr(request.app.state, "simulation_active", False))}


@router.post("/simulate/toggle")
async def simulate_toggle(request: Request, body: SimulateToggleBody) -> dict[str, bool]:
    request.app.state.simulation_active = body.active
    try:
        await insert_user_action(
            request.app.state.db,
            action="simulate_toggle",
            detail={"active": body.active},
            request_id=request.headers.get("X-Request-Id")
            or request.headers.get("X-Request-ID"),
            client_ip=request.client.host if request.client else None,
        )
    except Exception:
        pass
    return {"active": bool(request.app.state.simulation_active)}
