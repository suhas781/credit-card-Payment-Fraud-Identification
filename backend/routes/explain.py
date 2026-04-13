"""POST /explain — full local SHAP explanation (no DB write by default)."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException

from predict import explain_raw_transaction, validate_raw_transaction
from schemas import ExplainFeatureItem, ExplainResponse, TransactionInput

router = APIRouter(tags=["explain"])


@router.post("/explain", response_model=ExplainResponse)
async def explain(tx: TransactionInput) -> ExplainResponse:
    raw = tx.model_dump()

    def _run() -> dict:
        validate_raw_transaction(raw)
        return explain_raw_transaction(raw, top_k=15)

    try:
        data = await asyncio.to_thread(_run)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    tops = [ExplainFeatureItem(**x) for x in data["top_features"]]
    return ExplainResponse(
        expected_value_fraud_class=float(data["expected_value_fraud_class"]),
        top_features=tops,
        reason_codes=list(data["reason_codes"]),
        reason_summary=str(data["reason_summary"]),
    )
