"""Transaction history with filters."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request

from db import fetch_history
from schemas import HistoryResponse

router = APIRouter(tags=["history"])


@router.get("/history", response_model=HistoryResponse)
async def history(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    is_fraud: bool | None = None,
    risk_level: str | None = None,
    min_amount: float | None = None,
    max_amount: float | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> HistoryResponse:
    db = request.app.state.db
    try:
        data = await fetch_history(
            db,
            page=page,
            limit=limit,
            is_fraud=is_fraud,
            risk_level=risk_level,
            min_amount=min_amount,
            max_amount=max_amount,
            date_from=date_from,
            date_to=date_to,
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return HistoryResponse(**data)
