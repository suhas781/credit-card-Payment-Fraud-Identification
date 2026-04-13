"""
Train FraudSense XGBoost with SMOTE, RobustScaler (Amount, Time), save all artifacts.

Outputs under ../model/:
  xgb_model.pkl, shap_explainer.pkl, scaler.pkl, feature_names.pkl,
  threshold.pkl, sample_payload.json

Requires: creditcard.csv in ../data/ or ../../fraud_project/
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
import xgboost as xgb
from imblearn.over_sampling import SMOTE
from sklearn.metrics import f1_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import RobustScaler

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

RAW_COLS = [f"V{i}" for i in range(1, 29)] + ["Amount", "Time"]
# Model feature order after scaling
FEATURE_NAMES = [f"V{i}" for i in range(1, 29)] + ["Amount_scaled", "Time_scaled"]


def _find_csv() -> Path:
    for p in (
        ROOT / "data" / "creditcard.csv",
        ROOT.parent / "fraud_project" / "creditcard.csv",
    ):
        if p.is_file():
            return p
    raise FileNotFoundError("Place creditcard.csv in fraud-sense/data/")


def optimal_threshold(y_true: np.ndarray, y_score: np.ndarray) -> float:
    best_t, best_f = 0.5, 0.0
    for t in np.linspace(0.01, 0.99, 199):
        f = f1_score(y_true, y_score >= t, zero_division=0)
        if f > best_f:
            best_f, best_t = f, t
    return float(best_t)


def main() -> None:
    csv_path = _find_csv()
    df = pd.read_csv(csv_path)

    if not os.environ.get("FULL_TRAIN"):
        n = min(120_000, len(df))
        df = df.sample(n=n, random_state=42)
        print(f"Sampled {n} rows (FULL_TRAIN=1 for all data)")

    y = df["Class"].astype(int).values

    X_raw = df[RAW_COLS].astype(np.float64)
    scaler = RobustScaler()
    amt_time = X_raw[["Amount", "Time"]].values
    scaled = scaler.fit_transform(amt_time)

    v = X_raw[[f"V{i}" for i in range(1, 29)]].values
    X = np.hstack([v, scaled])

    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.3, random_state=42, stratify=y
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp
    )

    scale_weight = (y_train == 0).sum() / max(1, (y_train == 1).sum())

    smote = SMOTE(sampling_strategy=0.1, random_state=42)
    X_res, y_res = smote.fit_resample(X_train, y_train)

    clf = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.9,
        colsample_bytree=0.9,
        scale_pos_weight=float(scale_weight),
        random_state=42,
        eval_metric="aucpr",
        tree_method="hist",
    )
    clf.fit(X_res, y_res)

    val_proba = clf.predict_proba(X_val)[:, 1]
    thr = optimal_threshold(y_val, val_proba)
    print(f"Validation F1 at chosen threshold: {f1_score(y_val, val_proba >= thr):.4f}")

    test_proba = clf.predict_proba(X_test)[:, 1]
    print("Test ROC-AUC-like summary — fraud rate:", y_test.mean())

    explainer = shap.TreeExplainer(clf)

    out = ROOT / "model"
    out.mkdir(parents=True, exist_ok=True)

    joblib.dump(clf, out / "xgb_model.pkl")
    joblib.dump(explainer, out / "shap_explainer.pkl")
    joblib.dump(scaler, out / "scaler.pkl")
    joblib.dump(FEATURE_NAMES, out / "feature_names.pkl")
    joblib.dump(thr, out / "threshold.pkl")

    # Sample raw transaction for demo (first row of original df order)
    sample_row = df.iloc[0]
    sample_payload = {k: float(sample_row[k]) for k in RAW_COLS}
    with open(out / "sample_payload.json", "w", encoding="utf-8") as f:
        json.dump(sample_payload, f, indent=2)

    print(f"Artifacts written to {out}")


if __name__ == "__main__":
    main()
