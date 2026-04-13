"""Load ML artifacts (joblib), scale features, XGBoost + SHAP inference."""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Literal, cast

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
    _threshold = float(joblib.load(paths["threshold"]))
    _artifacts_loaded = True


def artifacts_loaded() -> bool:
    return _artifacts_loaded


def _ensure_loaded() -> None:
    if not _artifacts_loaded or _model is None:
        load_artifacts()


def raw_dict_to_matrix(raw: dict[str, float]) -> tuple[np.ndarray, dict[str, float]]:
    """Build 1×30 feature matrix: V1–V28, Amount_scaled, Time_scaled."""
    _ensure_loaded()
    assert _scaler is not None and _feature_names is not None

    v = np.array([[float(raw[f"V{i}"]) for i in range(1, 29)]], dtype=np.float64)
    amt = float(raw["Amount"])
    tm = float(raw["Time"])
    scaled = _scaler.transform(np.array([[amt, tm]], dtype=np.float64))
    amount_s = float(scaled[0, 0])
    time_s = float(scaled[0, 1])

    X = np.hstack([v, np.array([[amount_s, time_s]], dtype=np.float64)])

    features_dict: dict[str, float] = {}
    for i, name in enumerate(_feature_names):
        features_dict[name] = float(X[0, i])
    return X, features_dict


def top5_shap(X: np.ndarray) -> list[ShapValueItem]:
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
    out: list[ShapValueItem] = []
    for feat, val in pairs[:5]:
        v = float(val)
        direction = cast(
            Literal["fraud", "legit"], "fraud" if v > 0 else "legit"
        )
        out.append(ShapValueItem(feature=feat, value=v, direction=direction))
    return out


def predict_one(
    raw: dict[str, float],
) -> tuple[bool, float, float, list[ShapValueItem], str, dict[str, float], str]:
    """Returns is_fraud, confidence, threshold, shap, tx_id, features, risk_level."""
    _ensure_loaded()
    assert _model is not None and _threshold is not None

    X, features_dict = raw_dict_to_matrix(raw)
    proba = float(_model.predict_proba(X)[0, 1])
    is_fraud = proba >= _threshold
    shap_items = top5_shap(X)
    tx_id = str(uuid.uuid4())
    risk = confidence_to_risk_level(proba)
    return is_fraud, proba, float(_threshold), shap_items, tx_id, features_dict, risk


def raw_rows_to_matrix(rows: list[dict[str, float]]) -> np.ndarray:
    """N×30 design matrix: V1–V28, Amount_scaled, Time_scaled."""
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
    return np.hstack([v, scaled])


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
) -> list[dict]:
    """One Mongo document per row; shap_top5 empty (batch does not compute SHAP)."""
    from datetime import datetime, timezone

    _ensure_loaded()
    assert _feature_names is not None
    docs: list[dict] = []
    n = len(rows)
    for i in range(n):
        features = {
            name: float(X[i, j]) for j, name in enumerate(_feature_names)
        }
        raw = rows[i]
        conf = float(probas[i])
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
            }
        )
    return docs
