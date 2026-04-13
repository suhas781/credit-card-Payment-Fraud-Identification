"""Load ML artifacts (joblib), scale features, XGBoost + SHAP inference."""

from __future__ import annotations

import math
import os
import uuid
from pathlib import Path
from typing import Any, Literal, cast

import joblib
import numpy as np
import shap
import xgboost as xgb
from sklearn.preprocessing import RobustScaler

from risk import confidence_to_risk_level
from schemas import ShapValueItem

_RAW_KEYS = [f"V{i}" for i in range(1, 29)] + ["Amount", "Time"]

_model: xgb.XGBClassifier | None = None
_explainer: shap.TreeExplainer | None = None
_scaler: RobustScaler | None = None
_feature_names: list[str] | None = None
_threshold: float = 0.5
_artifacts_loaded: bool = False


def _model_dir() -> Path:
    base = Path(__file__).resolve().parent.parent
    return Path(os.environ.get("MODEL_PATH", str(base / "model"))).resolve()


def get_model_dir() -> Path:
    """Public path to model artifacts (same as MODEL_PATH env)."""
    return _model_dir()


def load_artifacts() -> None:
    """Load all joblib artifacts once; raises FileNotFoundError if missing."""
    global _model, _explainer, _scaler, _feature_names, _threshold, _artifacts_loaded

    if _artifacts_loaded and _model is not None:
        return

    d = _model_dir()
    paths = {
        "model": d / "xgb_model.pkl",
        "explainer": d / "shap_explainer.pkl",
        "scaler": d / "scaler.pkl",
        "features": d / "feature_names.pkl",
        "threshold": d / "threshold.pkl",
    }
    for name, p in paths.items():
        if not p.is_file():
            raise FileNotFoundError(f"Missing artifact {name}: {p}")

    _model = joblib.load(paths["model"])
    _explainer = joblib.load(paths["explainer"])
    _scaler = joblib.load(paths["scaler"])
    _feature_names = list(joblib.load(paths["features"]))
    if len(_feature_names) != 30:
        raise ValueError(
            f"feature_names.pkl must list 30 columns, got {len(_feature_names)}"
        )
    _threshold = float(joblib.load(paths["threshold"]))
    _artifacts_loaded = True


def artifacts_loaded() -> bool:
    return _artifacts_loaded


def _ensure_loaded() -> None:
    if not _artifacts_loaded or _model is None:
        load_artifacts()


def raw_dict_to_matrix(raw: dict[str, float]) -> tuple[np.ndarray, dict[str, float]]:
    """Build 1×30 matrix with column order exactly as in feature_names.pkl."""
    _ensure_loaded()
    assert _scaler is not None and _feature_names is not None

    v = np.array([[float(raw[f"V{i}"]) for i in range(1, 29)]], dtype=np.float64)
    amt = float(raw["Amount"])
    tm = float(raw["Time"])
    scaled = _scaler.transform(np.array([[amt, tm]], dtype=np.float64))
    amount_s = float(scaled[0, 0])
    time_s = float(scaled[0, 1])
    value_by_name: dict[str, float] = {
        **{f"V{i}": float(raw[f"V{i}"]) for i in range(1, 29)},
        "Amount_scaled": amount_s,
        "Time_scaled": time_s,
    }
    try:
        row = [value_by_name[name] for name in _feature_names]
    except KeyError as e:
        raise ValueError(
            f"feature_names.pkl contains unknown column {e!s}; expected V1–V28 + Amount_scaled/Time_scaled keys"
        ) from e
    X = np.array([row], dtype=np.float64)
    features_dict = {name: float(X[0, i]) for i, name in enumerate(_feature_names)}
    return X, features_dict


def shap_row_all(X: np.ndarray) -> tuple[np.ndarray, list[tuple[str, float]]]:
    """SHAP values for one row; returns raw array and (feature, value) sorted by |shap|."""
    _ensure_loaded()
    assert _explainer is not None and _feature_names is not None
    sv = _explainer.shap_values(X)
    if isinstance(sv, list):
        sv = sv[1]
    row = np.asarray(sv)
    if row.ndim > 1:
        row = row[0]
    pairs = list(zip(_feature_names, row.tolist()))
    pairs.sort(key=lambda x: -abs(x[1]))
    return row, pairs


def top5_shap(X: np.ndarray) -> list[ShapValueItem]:
    _ensure_loaded()
    _row, pairs = shap_row_all(X)
    out: list[ShapValueItem] = []
    for feat, val in pairs[:5]:
        v = float(val)
        direction = cast(
            Literal["fraud", "legit"], "fraud" if v > 0 else "legit"
        )
        out.append(ShapValueItem(feature=feat, value=v, direction=direction))
    return out


def reason_codes_from_shap(items: list[ShapValueItem]) -> list[str]:
    """Human-readable reason strings for audit / UI."""
    out: list[str] = []
    for s in items:
        direction = "fraud" if s.direction == "fraud" else "legit"
        out.append(
            f"{s.feature}: SHAP {s.value:+.4f} ({direction})"
        )
    return out


def reason_summary_from_shap(items: list[ShapValueItem]) -> str:
    if not items:
        return "No local feature attributions available."
    fraud_feats = [s.feature for s in items if s.direction == "fraud"]
    legit_feats = [s.feature for s in items if s.direction == "legit"]
    parts = []
    if fraud_feats:
        parts.append(
            "Strongest drivers toward fraud: " + ", ".join(fraud_feats[:3]) + "."
        )
    if legit_feats:
        parts.append(
            "Features leaning legit: " + ", ".join(legit_feats[:3]) + "."
        )
    return " ".join(parts)


def predict_one(
    raw: dict[str, float],
) -> tuple[
    bool,
    float,
    float,
    list[ShapValueItem],
    str,
    dict[str, float],
    str,
    int,
    list[str],
    str,
]:
    """Returns is_fraud, proba, threshold, shap, tx_id, features, risk_level, predicted_class, reason_codes, reason_summary."""
    _ensure_loaded()
    assert _model is not None and _threshold is not None

    X, features_dict = raw_dict_to_matrix(raw)
    proba = float(_model.predict_proba(X)[0, 1])
    is_fraud = proba >= _threshold
    predicted_class = 1 if is_fraud else 0
    shap_items = top5_shap(X)
    tx_id = str(uuid.uuid4())
    risk = confidence_to_risk_level(proba)
    rc = reason_codes_from_shap(shap_items)
    rs = reason_summary_from_shap(shap_items)
    return (
        is_fraud,
        proba,
        float(_threshold),
        shap_items,
        tx_id,
        features_dict,
        risk,
        predicted_class,
        rc,
        rs,
    )


def explain_raw_transaction(raw: dict[str, float], top_k: int = 15) -> dict[str, Any]:
    """Full local explanation: top-K |SHAP| features + expected value (TreeExplainer)."""
    _ensure_loaded()
    assert _explainer is not None
    X, _features_dict = raw_dict_to_matrix(raw)
    _row, pairs = shap_row_all(X)
    top_k = max(1, min(top_k, 30))
    top = pairs[:top_k]
    shap_list = [
        {"feature": f, "shap_value": float(v), "direction": ("fraud" if v > 0 else "legit")}
        for f, v in top
    ]
    base = getattr(_explainer, "expected_value", None)
    if isinstance(base, np.ndarray):
        base_val = float(np.ravel(base)[-1])
    else:
        base_val = float(base) if base is not None else 0.0
    items_for_summary = [
        ShapValueItem(
            feature=str(f),
            value=float(v),
            direction=cast(Literal["fraud", "legit"], "fraud" if v > 0 else "legit"),
        )
        for f, v in pairs[:5]
    ]
    return {
        "expected_value_fraud_class": base_val,
        "top_features": shap_list,
        "reason_summary": reason_summary_from_shap(items_for_summary),
        "reason_codes": reason_codes_from_shap(items_for_summary),
    }


def raw_rows_to_matrix(rows: list[dict[str, float]]) -> np.ndarray:
    """N×30 design matrix; column order matches feature_names.pkl."""
    _ensure_loaded()
    assert _scaler is not None and _feature_names is not None
    n = len(rows)
    if n == 0:
        return np.zeros((0, 30), dtype=np.float64)
    v = np.array(
        [[float(r[f"V{i}"]) for i in range(1, 29)] for r in rows],
        dtype=np.float64,
    )
    amt_time = np.array(
        [[float(r["Amount"]), float(r["Time"])] for r in rows],
        dtype=np.float64,
    )
    scaled = _scaler.transform(amt_time)
    value_map: dict[str, np.ndarray] = {
        **{f"V{i}": v[:, i - 1] for i in range(1, 29)},
        "Amount_scaled": scaled[:, 0],
        "Time_scaled": scaled[:, 1],
    }
    try:
        return np.column_stack([value_map[name] for name in _feature_names])
    except KeyError as e:
        raise ValueError(
            f"feature_names.pkl contains unknown column {e!s}"
        ) from e


def predict_batch_fast(
    rows: list[dict[str, float]],
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Vectorized batch scoring (no SHAP). Returns X, proba (fraud class), is_fraud mask.
    """
    _ensure_loaded()
    assert _model is not None and _threshold is not None
    X = raw_rows_to_matrix(rows)
    if X.shape[0] == 0:
        return X, np.array([]), np.array([])
    proba = _model.predict_proba(X)[:, 1]
    mask = proba >= _threshold
    return X, proba, mask


def build_batch_mongo_docs(
    rows: list[dict[str, float]],
    X: np.ndarray,
    probas: np.ndarray,
    is_fraud: np.ndarray,
    *,
    request_id: str | None = None,
    user_id: str | None = None,
    session_id: str | None = None,
) -> list[dict]:
    """One Mongo document per row; shap_top5 empty (batch does not compute SHAP)."""
    from datetime import datetime, timezone

    _ensure_loaded()
    assert _feature_names is not None
    thr = float(_threshold)
    docs: list[dict] = []
    n = len(rows)
    for i in range(n):
        features = {
            name: float(X[i, j]) for j, name in enumerate(_feature_names)
        }
        raw = rows[i]
        conf = float(probas[i])
        input_payload = {k: float(raw[k]) for k in _RAW_KEYS}
        docs.append(
            {
                "transaction_id": str(uuid.uuid4()),
                "features": features,
                "raw_amount": float(raw["Amount"]),
                "raw_time": float(raw["Time"]),
                "prediction": 1 if is_fraud[i] else 0,
                "confidence": conf,
                "is_fraud": bool(is_fraud[i]),
                "risk_level": confidence_to_risk_level(conf),
                "shap_top5": [],
                "timestamp": datetime.now(timezone.utc),
                "input_payload": input_payload,
                "request_id": request_id,
                "user_id": user_id,
                "session_id": session_id,
                "threshold_used": thr,
            }
        )
    return docs


def validate_raw_transaction(raw: dict[str, float]) -> None:
    """Reject non-finite values and missing keys before inference."""
    for k in _RAW_KEYS:
        if k not in raw:
            raise ValueError(f"Missing key: {k}")
        x = float(raw[k])
        if not math.isfinite(x):
            raise ValueError(f"Non-finite value for {k}")
