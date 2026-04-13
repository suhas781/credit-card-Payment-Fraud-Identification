"""Async MongoDB access via Motor."""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from risk import confidence_to_risk_level

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None

# Logical collection names (operational + audit)
COL_TRANSACTIONS = "transactions"
COL_PREDICTIONS = "predictions"
COL_MODEL_LOGS = "model_logs"
COL_USER_ACTIONS = "user_actions"


def init_mongo(uri: str) -> None:
    global _client
    _client = AsyncIOMotorClient(
        uri,
        serverSelectionTimeoutMS=5000,
    )


def get_client() -> AsyncIOMotorClient:
    assert _client is not None
    return _client


def get_database(db_name: str) -> AsyncIOMotorDatabase:
    return get_client()[db_name]


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create indexes for analytics and audit queries (idempotent)."""
    try:
        await db[COL_TRANSACTIONS].create_index([("timestamp", -1)])
        await db[COL_TRANSACTIONS].create_index("transaction_id", unique=True)
        await db[COL_PREDICTIONS].create_index([("timestamp", -1)])
        await db[COL_PREDICTIONS].create_index("transaction_id", unique=True)
        await db[COL_PREDICTIONS].create_index("request_id")
        await db[COL_MODEL_LOGS].create_index([("timestamp", -1)])
        await db[COL_USER_ACTIONS].create_index([("timestamp", -1)])
        await db[COL_USER_ACTIONS].create_index("action")
    except Exception as e:
        logger.warning("ensure_indexes: %s", e)


async def ping_db(db: AsyncIOMotorDatabase) -> bool:
    try:
        await db.command("ping")
        return True
    except Exception:
        return False


async def insert_prediction_record(
    db: AsyncIOMotorDatabase,
    *,
    transaction_id: str,
    input_payload: dict[str, Any],
    scaled_features: dict[str, float],
    prediction: int,
    fraud_probability: float,
    threshold_used: float,
    is_fraud: bool,
    risk_level: str,
    shap_top5: list[dict[str, Any]],
    request_id: str | None,
    user_id: str | None,
    session_id: str | None,
) -> None:
    """ML audit trail: raw input + outputs + client metadata."""
    doc = {
        "transaction_id": transaction_id,
        "input_payload": input_payload,
        "scaled_features": scaled_features,
        "prediction": prediction,
        "fraud_probability": fraud_probability,
        "threshold_used": threshold_used,
        "is_fraud": is_fraud,
        "risk_level": risk_level,
        "shap_top5": shap_top5,
        "timestamp": datetime.now(timezone.utc),
        "request_id": request_id,
        "user_id": user_id,
        "session_id": session_id,
    }
    await db[COL_PREDICTIONS].insert_one(doc)


async def insert_model_log(
    db: AsyncIOMotorDatabase,
    *,
    event: str,
    detail: dict[str, Any],
) -> None:
    await db[COL_MODEL_LOGS].insert_one(
        {
            "event": event,
            "detail": detail,
            "timestamp": datetime.now(timezone.utc),
        }
    )


async def insert_user_action(
    db: AsyncIOMotorDatabase,
    *,
    action: str,
    detail: dict[str, Any],
    request_id: str | None = None,
    client_ip: str | None = None,
) -> None:
    await db[COL_USER_ACTIONS].insert_one(
        {
            "action": action,
            "detail": detail,
            "request_id": request_id,
            "client_ip": client_ip,
            "timestamp": datetime.now(timezone.utc),
        }
    )


async def insert_transaction(
    db: AsyncIOMotorDatabase,
    *,
    transaction_id: str,
    features: dict[str, float],
    raw_amount: float,
    raw_time: float,
    prediction: int,
    confidence: float,
    is_fraud: bool,
    risk_level: str,
    shap_top5: list[dict[str, Any]],
    input_payload: dict[str, Any] | None = None,
    request_id: str | None = None,
    user_id: str | None = None,
    session_id: str | None = None,
    threshold_used: float | None = None,
) -> None:
    ts = datetime.now(timezone.utc)
    doc = {
        "transaction_id": transaction_id,
        "features": features,
        "raw_amount": raw_amount,
        "raw_time": raw_time,
        "prediction": prediction,
        "confidence": confidence,
        "is_fraud": is_fraud,
        "risk_level": risk_level,
        "shap_top5": shap_top5,
        "timestamp": ts,
        "input_payload": input_payload,
        "request_id": request_id,
        "user_id": user_id,
        "session_id": session_id,
        "threshold_used": threshold_used,
    }
    await db[COL_TRANSACTIONS].insert_one(doc)

    await insert_prediction_record(
        db,
        transaction_id=transaction_id,
        input_payload=input_payload or {},
        scaled_features=features,
        prediction=prediction,
        fraud_probability=confidence,
        threshold_used=float(threshold_used or 0.5),
        is_fraud=is_fraud,
        risk_level=risk_level,
        shap_top5=shap_top5,
        request_id=request_id,
        user_id=user_id,
        session_id=session_id,
    )


def _transaction_doc_to_prediction(doc: dict[str, Any]) -> dict[str, Any]:
    """Mirror a transactions row into predictions collection shape."""
    return {
        "transaction_id": doc["transaction_id"],
        "input_payload": doc.get("input_payload") or {},
        "scaled_features": doc.get("features") or {},
        "prediction": doc.get("prediction", 0),
        "fraud_probability": float(doc.get("confidence", 0.0)),
        "threshold_used": float(doc.get("threshold_used", 0.5)),
        "is_fraud": bool(doc.get("is_fraud", False)),
        "risk_level": str(doc.get("risk_level", "LOW")),
        "shap_top5": doc.get("shap_top5") or [],
        "timestamp": doc["timestamp"],
        "request_id": doc.get("request_id"),
        "user_id": doc.get("user_id"),
        "session_id": doc.get("session_id"),
    }


async def insert_transactions_bulk(
    db: AsyncIOMotorDatabase,
    docs: list[dict[str, Any]],
    chunk_size: int = 4000,
) -> None:
    if not docs:
        return
    coll = db[COL_TRANSACTIONS]
    pred_coll = db[COL_PREDICTIONS]
    for i in range(0, len(docs), chunk_size):
        chunk = docs[i : i + chunk_size]
        await coll.insert_many(chunk, ordered=False)
        pred_docs = [_transaction_doc_to_prediction(d) for d in chunk]
        await pred_coll.insert_many(pred_docs, ordered=False)


def _ts_iso(ts: Any) -> str:
    if hasattr(ts, "isoformat"):
        return ts.isoformat()
    return str(ts)


def _doc_risk(doc: dict[str, Any]) -> str:
    rl = doc.get("risk_level")
    if rl:
        return str(rl)
    return confidence_to_risk_level(float(doc.get("confidence", 0.0)))


def empty_stats_payload() -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    since = (now - timedelta(hours=24)).replace(minute=0, second=0, microsecond=0)
    fraud_over_time = [
        {"hour": (since + timedelta(hours=i)).strftime("%Y-%m-%d %H:00"), "count": 0}
        for i in range(24)
    ]
    fraud_by_hour = [{"hour": h, "count": 0} for h in range(24)]
    return {
        "total_transactions": 0,
        "fraud_count": 0,
        "legit_count": 0,
        "fraud_rate": 0.0,
        "total_fraud_amount": 0.0,
        "avg_confidence_fraud": 0.0,
        "avg_confidence_legit": 0.0,
        "recent_transactions": [],
        "fraud_over_time": fraud_over_time,
        "fraud_by_hour_of_day": fraud_by_hour,
        "fraud_by_risk_level": {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0},
        "amount_ranges": {"0-100": 0, "100-500": 0, "500-1000": 0, "1000+": 0},
    }


async def fetch_stats(db: AsyncIOMotorDatabase) -> dict[str, Any]:
    coll = db[COL_TRANSACTIONS]
    total = await coll.count_documents({})
    fraud_count = await coll.count_documents({"is_fraud": True})
    legit_count = max(0, total - fraud_count)
    fraud_rate = (fraud_count / total) if total else 0.0

    pipeline_sum = [
        {"$match": {"is_fraud": True}},
        {"$group": {"_id": None, "sum": {"$sum": "$raw_amount"}}},
    ]
    agg = await coll.aggregate(pipeline_sum).to_list(1)
    total_fraud_amount = float(agg[0]["sum"]) if agg else 0.0

    pipeline_avg_f = [
        {"$match": {"is_fraud": True}},
        {"$group": {"_id": None, "avg": {"$avg": "$confidence"}}},
    ]
    af = await coll.aggregate(pipeline_avg_f).to_list(1)
    avg_confidence_fraud = float(af[0]["avg"]) if af and af[0].get("avg") is not None else 0.0

    pipeline_avg_l = [
        {"$match": {"is_fraud": False}},
        {"$group": {"_id": None, "avg": {"$avg": "$confidence"}}},
    ]
    al = await coll.aggregate(pipeline_avg_l).to_list(1)
    avg_confidence_legit = float(al[0]["avg"]) if al and al[0].get("avg") is not None else 0.0

    fraud_by_risk = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    cursor_r = coll.find({"is_fraud": True}, {"risk_level": 1, "confidence": 1})
    for doc in await cursor_r.to_list(500_000):
        rl = _doc_risk(doc)
        if rl in fraud_by_risk:
            fraud_by_risk[rl] += 1

    amount_ranges = {"0-100": 0, "100-500": 0, "500-1000": 0, "1000+": 0}
    cursor_a = coll.find({"is_fraud": True}, {"raw_amount": 1})
    for doc in await cursor_a.to_list(500_000):
        amt = float(doc.get("raw_amount", 0.0))
        if amt < 100:
            amount_ranges["0-100"] += 1
        elif amt < 500:
            amount_ranges["100-500"] += 1
        elif amt < 1000:
            amount_ranges["500-1000"] += 1
        else:
            amount_ranges["1000+"] += 1

    cursor = coll.find().sort("timestamp", -1).limit(20)
    recent_docs = await cursor.to_list(20)
    recent_transactions = [
        {
            "transaction_id": str(doc.get("transaction_id", "")),
            "is_fraud": bool(doc.get("is_fraud", False)),
            "confidence": float(doc.get("confidence", 0.0)),
            "Amount": float(doc.get("raw_amount", 0.0)),
            "timestamp": _ts_iso(doc["timestamp"]),
            "risk_level": _doc_risk(doc),
        }
        for doc in recent_docs
    ]

    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=24)
    since = since.replace(minute=0, second=0, microsecond=0)

    match = {"is_fraud": True, "timestamp": {"$gte": since}}
    fraud_cursor = coll.find(match)
    fraud_docs = await fraud_cursor.to_list(100_000)
    by_hour: defaultdict[str, int] = defaultdict(int)
    for doc in fraud_docs:
        ts = doc["timestamp"]
        if getattr(ts, "tzinfo", None) is None:
            ts = ts.replace(tzinfo=timezone.utc)
        key = ts.astimezone(timezone.utc).strftime("%Y-%m-%d %H:00")
        by_hour[key] += 1

    fraud_over_time: list[dict[str, Any]] = []
    for i in range(24):
        bucket = since + timedelta(hours=i)
        hour_label = bucket.strftime("%Y-%m-%d %H:00")
        fraud_over_time.append({"hour": hour_label, "count": by_hour.get(hour_label, 0)})

    hod: defaultdict[int, int] = defaultdict(int)
    cursor_hod = coll.find({"is_fraud": True}, {"timestamp": 1})
    for doc in await cursor_hod.to_list(500_000):
        ts = doc["timestamp"]
        if getattr(ts, "tzinfo", None) is None:
            ts = ts.replace(tzinfo=timezone.utc)
        hod[int(ts.astimezone(timezone.utc).hour)] += 1
    fraud_by_hour_of_day = [{"hour": h, "count": hod.get(h, 0)} for h in range(24)]

    return {
        "total_transactions": total,
        "fraud_count": fraud_count,
        "legit_count": legit_count,
        "fraud_rate": fraud_rate,
        "total_fraud_amount": total_fraud_amount,
        "avg_confidence_fraud": avg_confidence_fraud,
        "avg_confidence_legit": avg_confidence_legit,
        "recent_transactions": recent_transactions,
        "fraud_over_time": fraud_over_time,
        "fraud_by_hour_of_day": fraud_by_hour_of_day,
        "fraud_by_risk_level": fraud_by_risk,
        "amount_ranges": amount_ranges,
    }


async def fetch_history(
    db: AsyncIOMotorDatabase,
    *,
    page: int,
    limit: int,
    is_fraud: bool | None,
    risk_level: str | None,
    min_amount: float | None,
    max_amount: float | None,
    date_from: str | None,
    date_to: str | None,
) -> dict[str, Any]:
    coll = db[COL_TRANSACTIONS]
    q: dict[str, Any] = {}
    if is_fraud is not None:
        q["is_fraud"] = is_fraud
    if risk_level is not None:
        q["risk_level"] = risk_level
    if min_amount is not None or max_amount is not None:
        ar: dict[str, Any] = {}
        if min_amount is not None:
            ar["$gte"] = min_amount
        if max_amount is not None:
            ar["$lte"] = max_amount
        q["raw_amount"] = ar
    if date_from is not None or date_to is not None:
        tr: dict[str, Any] = {}
        if date_from:
            tr["$gte"] = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
        if date_to:
            tr["$lte"] = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
        q["timestamp"] = tr

    total = await coll.count_documents(q)
    skip = (page - 1) * limit
    cursor = (
        coll.find(q).sort("timestamp", -1).skip(skip).limit(limit)
    )
    docs = await cursor.to_list(limit)
    pages = max(1, (total + limit - 1) // limit) if total else 1

    transactions = []
    for doc in docs:
        transactions.append(
            {
                "transaction_id": str(doc.get("transaction_id", "")),
                "is_fraud": bool(doc.get("is_fraud", False)),
                "confidence": float(doc.get("confidence", 0.0)),
                "Amount": float(doc.get("raw_amount", 0.0)),
                "timestamp": _ts_iso(doc["timestamp"]),
                "risk_level": _doc_risk(doc),
                "shap_top5": doc.get("shap_top5") or [],
            }
        )

    return {
        "transactions": transactions,
        "total": total,
        "page": page,
        "pages": pages,
    }


async def fetch_stats_total(db: AsyncIOMotorDatabase) -> dict[str, Any]:
    coll = db[COL_TRANSACTIONS]
    total = await coll.count_documents({})
    return {"total_transactions": total}


async def fetch_stats_fraud_rate(db: AsyncIOMotorDatabase) -> dict[str, Any]:
    coll = db[COL_TRANSACTIONS]
    total = await coll.count_documents({})
    fraud_count = await coll.count_documents({"is_fraud": True})
    legit_count = max(0, total - fraud_count)
    fraud_rate = (fraud_count / total) if total else 0.0
    return {
        "total_transactions": total,
        "fraud_count": fraud_count,
        "legit_count": legit_count,
        "fraud_rate": fraud_rate,
    }


async def fetch_stats_recent_only(
    db: AsyncIOMotorDatabase, *, limit: int = 20
) -> dict[str, Any]:
    coll = db[COL_TRANSACTIONS]
    limit = max(1, min(limit, 200))
    cursor = coll.find().sort("timestamp", -1).limit(limit)
    recent_docs = await cursor.to_list(limit)
    recent_transactions = [
        {
            "transaction_id": str(doc.get("transaction_id", "")),
            "is_fraud": bool(doc.get("is_fraud", False)),
            "confidence": float(doc.get("confidence", 0.0)),
            "Amount": float(doc.get("raw_amount", 0.0)),
            "timestamp": _ts_iso(doc["timestamp"]),
            "risk_level": _doc_risk(doc),
        }
        for doc in recent_docs
    ]
    return {"recent_transactions": recent_transactions, "limit": limit}


async def fetch_stats_by_hour(db: AsyncIOMotorDatabase) -> dict[str, Any]:
    coll = db[COL_TRANSACTIONS]
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=24)
    since = since.replace(minute=0, second=0, microsecond=0)
    match = {"is_fraud": True, "timestamp": {"$gte": since}}
    fraud_docs = await coll.find(match).to_list(100_000)
    by_hour: defaultdict[str, int] = defaultdict(int)
    for doc in fraud_docs:
        ts = doc["timestamp"]
        if getattr(ts, "tzinfo", None) is None:
            ts = ts.replace(tzinfo=timezone.utc)
        key = ts.astimezone(timezone.utc).strftime("%Y-%m-%d %H:00")
        by_hour[key] += 1
    fraud_over_time: list[dict[str, Any]] = []
    for i in range(24):
        bucket = since + timedelta(hours=i)
        hour_label = bucket.strftime("%Y-%m-%d %H:00")
        fraud_over_time.append({"hour": hour_label, "count": by_hour.get(hour_label, 0)})
    hod: defaultdict[int, int] = defaultdict(int)
    cursor_hod = coll.find({"is_fraud": True}, {"timestamp": 1})
    for doc in await cursor_hod.to_list(500_000):
        ts = doc["timestamp"]
        if getattr(ts, "tzinfo", None) is None:
            ts = ts.replace(tzinfo=timezone.utc)
        hod[int(ts.astimezone(timezone.utc).hour)] += 1
    fraud_by_hour_of_day = [{"hour": h, "count": hod.get(h, 0)} for h in range(24)]
    return {
        "fraud_over_time": fraud_over_time,
        "fraud_by_hour_of_day": fraud_by_hour_of_day,
    }


async def close_mongo() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
