"""Model metadata and training metrics."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import joblib
from fastapi import APIRouter, HTTPException

from predict import _model_dir, load_artifacts
from schemas import ModelInfoResponse

router = APIRouter(tags=["model"])


def _build_model_info() -> ModelInfoResponse:
    load_artifacts()
    d = _model_dir()
    metrics_path = d / "training_metrics.json"
    if not metrics_path.is_file():
        raise FileNotFoundError("training_metrics.json missing")

    with open(metrics_path, encoding="utf-8") as f:
        tm = json.load(f)

    model = joblib.load(d / "xgb_model.pkl")
    names: list[str] = list(joblib.load(d / "feature_names.pkl"))
    threshold = float(joblib.load(d / "threshold.pkl"))

    fi = getattr(model, "feature_importances_", None)
    if fi is None:
        top_features: list[dict[str, float]] = []
    else:
        pairs = sorted(zip(names, fi), key=lambda x: -x[1])[:15]
        top_features = [{"feature": a, "importance": float(b)} for a, b in pairs]

    training_metrics = {
        "auc_roc": float(tm.get("auc_roc", 0)),
        "avg_precision": float(tm.get("avg_precision", 0)),
        "f1_score": float(tm.get("f1_score", 0)),
    }

    dataset_info = {
        "total_samples": int(tm.get("dataset_total_samples", 0)),
        "fraud_samples": int(tm.get("dataset_fraud_samples", 0)),
        "fraud_rate": float(tm.get("dataset_fraud_rate", 0)),
    }

    return ModelInfoResponse(
        model_type="XGBoostClassifier",
        features_count=len(names),
        threshold=threshold,
        training_metrics=training_metrics,
        top_features=top_features,
        dataset_info=dataset_info,
    )


@router.get("/model-info", response_model=ModelInfoResponse)
async def model_info() -> ModelInfoResponse:
    try:
        return await asyncio.to_thread(_build_model_info)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
