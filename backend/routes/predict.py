"""Prediction routes: /predict, /batch-predict."""

from __future__ import annotations

import asyncio
import io
import uuid
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from db import insert_model_log, insert_transaction, insert_transactions_bulk
from predict import (
    build_batch_mongo_docs,
    predict_batch_fast,
    predict_one,
    validate_raw_transaction,
)
from risk import confidence_to_risk_level
from schemas import BatchPredictResponse, BatchResultRow, PredictResponse, TransactionInput

router = APIRouter(tags=["predict"])

RAW_COLS = [f"V{i}" for i in range(1, 29)] + ["Amount", "Time"]


def _client_meta(request: Request) -> tuple[str | None, str | None, str | None]:
    rid = request.headers.get("X-Request-Id") or request.headers.get("X-Request-ID")
    uid = request.headers.get("X-User-Id") or request.headers.get("X-User-ID")
    sid = request.headers.get("X-Session-Id") or request.headers.get("X-Session-ID")
    return rid, uid, sid


@router.post("/predict", response_model=PredictResponse)
async def predict_single(request: Request, tx: TransactionInput) -> PredictResponse:
    db = request.app.state.db
    raw = tx.model_dump()
    request_id, user_id, session_id = _client_meta(request)
    if not request_id:
        request_id = str(uuid.uuid4())

    try:

        def _run():
            validate_raw_transaction(raw)
            return predict_one(raw)

        (
            is_fraud,
            confidence,
            threshold_used,
            shap_items,
            transaction_id,
            features,
            risk_level,
            predicted_class,
            reason_codes,
            reason_summary,
        ) = await asyncio.to_thread(_run)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    ts = datetime.now(timezone.utc)
    ts_str = ts.isoformat()
    shap_top5 = [s.model_dump() for s in shap_items]
    input_payload = {k: float(raw[k]) for k in RAW_COLS}
    await insert_transaction(
        db,
        transaction_id=transaction_id,
        features=features,
        raw_amount=float(raw["Amount"]),
        raw_time=float(raw["Time"]),
        prediction=predicted_class,
        confidence=confidence,
        is_fraud=is_fraud,
        risk_level=risk_level,
        shap_top5=shap_top5,
        input_payload=input_payload,
        request_id=request_id,
        user_id=user_id,
        session_id=session_id,
        threshold_used=threshold_used,
    )

    return PredictResponse(
        is_fraud=is_fraud,
        predicted_class=predicted_class,
        fraud_probability=confidence,
        confidence=confidence,
        threshold_used=threshold_used,
        risk_level=risk_level,  # type: ignore[arg-type]
        shap_values=shap_items,
        reason_codes=reason_codes,
        reason_summary=reason_summary,
        transaction_id=transaction_id,
        timestamp=ts_str,
    )


@router.post("/batch-predict", response_model=BatchPredictResponse)
async def batch_predict_route(
    request: Request, file: UploadFile = File(...)
) -> BatchPredictResponse:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a .csv file")

    raw_bytes = await file.read()
    request_id, user_id, session_id = _client_meta(request)
    batch_rid = request_id or str(uuid.uuid4())

    def _parse_score_and_docs():
        df = pd.read_csv(io.BytesIO(raw_bytes))
        missing = [c for c in RAW_COLS if c not in df.columns]
        if missing:
            raise ValueError(f"Missing columns: {missing}")
        mat = df[RAW_COLS].astype(float).to_numpy()
        if not np.isfinite(mat).all():
            raise ValueError("CSV contains non-finite values (NaN or Inf)")
        rows = df[RAW_COLS].astype(float).to_dict("records")
        X, probas, is_fraud = predict_batch_fast(rows)
        docs = build_batch_mongo_docs(
            rows,
            X,
            probas,
            is_fraud,
            request_id=batch_rid,
            user_id=user_id,
            session_id=session_id,
        )
        return rows, probas, is_fraud, docs, len(rows)

    try:
        rows, probas, is_fraud, docs, n_rows = await asyncio.to_thread(
            _parse_score_and_docs
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    db = request.app.state.db
    await insert_transactions_bulk(db, docs)

    try:
        await insert_model_log(
            db,
            event="batch_predict",
            detail={
                "rows": n_rows,
                "filename": file.filename,
                "request_id": batch_rid,
            },
        )
    except Exception:
        pass

    out_rows: list[BatchResultRow] = []
    fraud_count = 0
    total_fraud_amount = 0.0
    for i, raw in enumerate(rows):
        fraud = bool(is_fraud[i])
        conf = float(probas[i])
        if fraud:
            fraud_count += 1
            total_fraud_amount += float(raw["Amount"])
        out_rows.append(
            BatchResultRow(
                row_index=i,
                is_fraud=fraud,
                confidence=conf,
                Amount=float(raw["Amount"]),
                risk_level=confidence_to_risk_level(conf),  # type: ignore[arg-type]
            )
        )

    total = len(out_rows)
    legit_count = total - fraud_count
    fraud_rate = (fraud_count / total) if total else 0.0

    return BatchPredictResponse(
        total=total,
        fraud_count=fraud_count,
        legit_count=legit_count,
        fraud_rate=fraud_rate,
        total_fraud_amount=total_fraud_amount,
        results=out_rows,
    )
