"""Sample rows from creditcard.csv for live WebSocket simulation."""

from __future__ import annotations

import os
from pathlib import Path

import pandas as pd

import predict as pred

_RAW = [f"V{i}" for i in range(1, 29)] + ["Amount", "Time"]
_df: pd.DataFrame | None = None


def _data_path() -> Path:
    root = Path(__file__).resolve().parent.parent
    env = os.environ.get("SIMULATE_DATA_PATH")
    if env:
        return Path(env)
    for p in (
        root / "data" / "creditcard.csv",
        root.parent / "fraud_project" / "creditcard.csv",
    ):
        if p.is_file():
            return p
    raise FileNotFoundError(
        "creditcard.csv not found. Set SIMULATE_DATA_PATH or place data under data/."
    )


def _ensure_loaded() -> pd.DataFrame:
    global _df
    if _df is not None:
        return _df
    path = _data_path()
    _df = pd.read_csv(path)
    need = [c for c in _RAW if c not in _df.columns]
    if need:
        raise ValueError(f"CSV missing columns: {need}")
    return _df


def sample_row_dict() -> dict[str, float]:
    df = _ensure_loaded()
    row = df.sample(n=1, random_state=None).iloc[0]
    return {k: float(row[k]) for k in _RAW}


def build_simulation_message() -> dict:
    """One prediction with SHAP for WebSocket clients."""
    raw = sample_row_dict()
    pred.load_artifacts()
    (
        is_fraud,
        confidence,
        _thr,
        shap_items,
        transaction_id,
        _features,
        risk_level,
    ) = pred.predict_one(raw)
    from datetime import datetime, timezone

    return {
        "transaction_id": transaction_id,
        "is_fraud": is_fraud,
        "confidence": confidence,
        "risk_level": risk_level,
        "Amount": raw["Amount"],
        "shap_values": [s.model_dump() for s in shap_items],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
