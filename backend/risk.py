"""Map fraud probability (confidence) to UI risk level."""

from __future__ import annotations

from typing import Literal

RiskLevel = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


def confidence_to_risk_level(confidence: float) -> RiskLevel:
    """Higher confidence in fraud → higher risk tier."""
    if confidence < 0.3:
        return "LOW"
    if confidence < 0.6:
        return "MEDIUM"
    if confidence < 0.85:
        return "HIGH"
    return "CRITICAL"
