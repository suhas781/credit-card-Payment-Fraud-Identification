"""Statistics route: /stats."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request
from pymongo.errors import PyMongoError

from db import empty_stats_payload, fetch_stats
from schemas import StatsResponse

router = APIRouter(tags=["stats"])
logger = logging.getLogger(__name__)


@router.get("/stats", response_model=StatsResponse)
async def stats(request: Request) -> StatsResponse:
    db = request.app.state.db
    try:
        data = await fetch_stats(db)
    except PyMongoError as e:
        logger.warning("MongoDB unavailable for /stats, returning empty stats: %s", e)
        data = empty_stats_payload()
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return StatsResponse(**data)
