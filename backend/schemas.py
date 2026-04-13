"""Pydantic v2 models for FraudSense API."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

RiskLevel = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


class TransactionInput(BaseModel):
    """Raw transaction: V1–V28, Amount, Time (unscaled)."""

    model_config = ConfigDict(extra="forbid")

    V1: float
    V2: float
    V3: float
    V4: float
    V5: float
    V6: float
    V7: float
    V8: float
    V9: float
    V10: float
    V11: float
    V12: float
    V13: float
    V14: float
    V15: float
    V16: float
    V17: float
    V18: float
    V19: float
    V20: float
    V21: float
    V22: float
    V23: float
    V24: float
    V25: float
    V26: float
    V27: float
    V28: float
    Amount: float
    Time: float


class ShapValueItem(BaseModel):
    feature: str
    value: float
    direction: Literal["fraud", "legit"]


class PredictResponse(BaseModel):
    is_fraud: bool
    confidence: float
    threshold_used: float
    risk_level: RiskLevel
    shap_values: list[ShapValueItem]
    transaction_id: str
    timestamp: str


class BatchResultRow(BaseModel):
    row_index: int
    is_fraud: bool
    confidence: float
    Amount: float = Field(description="Raw Amount from CSV row")
    risk_level: RiskLevel


class BatchPredictResponse(BaseModel):
    total: int
    fraud_count: int
    legit_count: int
    fraud_rate: float
    total_fraud_amount: float
    results: list[BatchResultRow]


class RecentTransactionItem(BaseModel):
    transaction_id: str
    is_fraud: bool
    confidence: float
    Amount: float
    timestamp: str
    risk_level: RiskLevel | None = None


class FraudOverTimePoint(BaseModel):
    hour: str
    count: int


class HourOfDayPoint(BaseModel):
    hour: int = Field(ge=0, le=23)
    count: int


class StatsResponse(BaseModel):
    total_transactions: int
    fraud_count: int
    legit_count: int
    fraud_rate: float
    total_fraud_amount: float
    avg_confidence_fraud: float
    avg_confidence_legit: float
    recent_transactions: list[RecentTransactionItem]
    fraud_over_time: list[FraudOverTimePoint]
    fraud_by_hour_of_day: list[HourOfDayPoint]
    fraud_by_risk_level: dict[str, int]
    amount_ranges: dict[str, int]


class HistoryQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)
    is_fraud: bool | None = None
    risk_level: RiskLevel | None = None
    min_amount: float | None = None
    max_amount: float | None = None
    date_from: str | None = None
    date_to: str | None = None


class HistoryTransaction(BaseModel):
    transaction_id: str
    is_fraud: bool
    confidence: float
    Amount: float
    timestamp: str
    risk_level: RiskLevel | None = None
    shap_top5: list[dict] = Field(default_factory=list)


class HistoryResponse(BaseModel):
    transactions: list[HistoryTransaction]
    total: int
    page: int
    pages: int


class TopFeatureItem(BaseModel):
    feature: str
    importance: float


class ModelInfoResponse(BaseModel):
    model_type: str
    features_count: int
    threshold: float
    training_metrics: dict[str, float]
    top_features: list[TopFeatureItem]
    dataset_info: dict[str, float | int]


class SimulateToggleBody(BaseModel):
    active: bool


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    db_connected: bool
    uptime_seconds: float
