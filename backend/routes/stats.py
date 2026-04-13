"""Statistics routes: /stats and granular /stats/*."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query, Request
from pymongo.errors import PyMongoError

from db import (
    empty_stats_payload,
    fetch_stats,
    fetch_stats_by_hour,
    fetch_stats_fraud_rate,
    fetch_stats_recent_only,
    fetch_stats_total,
)
from schemas import (
    StatsByHourResponse,
    StatsFraudRateResponse,
    StatsRecentResponse,
    StatsResponse,
    StatsTotalResponse,
)

router = APIRouter(tags=["stats"])
logger = logging.getLogger(__name__)


@router.get("/stats/total", response_model=StatsTotalResponse)
async def stats_total(request: Request) -> StatsTotalResponse:
    db = request.app.state.db
    try:
        data = await fetch_stats_total(db)
    except PyMongoError as e:
        logger.warning("MongoDB unavailable for /stats/total: %s", e)
        return StatsTotalResponse(total_transactions=0)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return StatsTotalResponse(**data)


@router.get("/stats/fraud-rate", response_model=StatsFraudRateResponse)
async def stats_fraud_rate(request: Request) -> StatsFraudRateResponse:
    db = request.app.state.db
    try:
        data = await fetch_stats_fraud_rate(db)
    except PyMongoError as e:
        logger.warning("MongoDB unavailable for /stats/fraud-rate: %s", e)
        return StatsFraudRateResponse(
            total_transactions=0,
            fraud_count=0,
            legit_count=0,
            fraud_rate=0.0,
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return StatsFraudRateResponse(**data)


@router.get("/stats/recent", response_model=StatsRecentResponse)
async def stats_recent(
    request: Request, limit: int = Query(20, ge=1, le=200)
) -> StatsRecentResponse:
    db = request.app.state.db
    try:
        data = await fetch_stats_recent_only(db, limit=limit)
    except PyMongoError as e:
        logger.warning("MongoDB unavailable for /stats/recent: %s", e)
        return StatsRecentResponse(recent_transactions=[], limit=limit)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return StatsRecentResponse(**data)


@router.get("/stats/by-hour", response_model=StatsByHourResponse)
async def stats_by_hour(request: Request) -> StatsByHourResponse:
    db = request.app.state.db
    try:
        data = await fetch_stats_by_hour(db)
    except PyMongoError as e:
        logger.warning("MongoDB unavailable for /stats/by-hour: %s", e)
        empty = empty_stats_payload()
        return StatsByHourResponse(
            fraud_over_time=empty["fraud_over_time"],
            fraud_by_hour_of_day=empty["fraud_by_hour_of_day"],
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return StatsByHourResponse(**data)


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
