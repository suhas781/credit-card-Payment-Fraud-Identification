"""Async MongoDB access via Motor."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from risk import confidence_to_risk_level

_client: AsyncIOMotorClient | None = None


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


async def ping_db(db: AsyncIOMotorDatabase) -> bool:
    try:
        await db.command("ping")
        return True
    except Exception:
        return False


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
) -> None:
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
        "timestamp": datetime.now(timezone.utc),
    }
    await db["transactions"].insert_one(doc)


async def insert_transactions_bulk(
    db: AsyncIOMotorDatabase,
    docs: list[dict[str, Any]],
    chunk_size: int = 4000,
) -> None:
    if not docs:
        return
    coll = db["transactions"]
    for i in range(0, len(docs), chunk_size):
        chunk = docs[i : i + chunk_size]
        await coll.insert_many(chunk, ordered=False)


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
    coll = db["transactions"]
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
    coll = db["transactions"]
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


async def close_mongo() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
