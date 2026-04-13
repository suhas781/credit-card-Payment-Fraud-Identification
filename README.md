# FraudSense

Production-oriented fraud detection UI and API: XGBoost scoring, SHAP explanations, and MongoDB logging.

## Prerequisites

- Python 3.10+
- Node.js 18+
- MongoDB on `mongodb://localhost:27017` (for example `mongod --dbpath ~/data/db`)

Without MongoDB, the **dashboard** still loads (`GET /stats` returns empty metrics). **Predict** and **batch** routes still need MongoDB to log transactions.

## Model artifacts

Training script: `notebooks/train_model.py` (reads `data/creditcard.csv` or `../fraud_project/creditcard.csv`). It writes to `model/`:

- `xgb_model.pkl`, `shap_explainer.pkl`, `scaler.pkl`, `feature_names.pkl`, `threshold.pkl`, `sample_payload.json`

Run:

```bash
cd fraud-sense
pip install -r backend/requirements.txt
python notebooks/train_model.py
```

## Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Copy `backend/.env` (defaults: `MONGO_URI`, `DB_NAME`, `MODEL_PATH=../model`) and start:

```bash
uvicorn main:app --reload --port 8000
```

## Frontend

```bash
cd frontend
npm install
```

Copy `frontend/.env` with `VITE_API_URL=http://localhost:8000`, then:

```bash
npm run dev
```

Open `http://localhost:5173`.

## API

- `POST /predict` — JSON body: `V1`–`V28`, `Amount`, `Time` (raw); response includes `threshold_used`, `transaction_id`, top-5 SHAP with `direction`.
- `POST /batch-predict` — CSV with the same columns. Scoring is **vectorized** (no SHAP per row); Mongo inserts are chunked. Very large result JSONs may be heavy on the browser — the UI previews the first ~2500 rows; use **Download CSV** for the full file.
- `GET /stats` — Aggregates and recent rows.
- `GET /health` — `{ status, model_loaded }`.

## Docker (optional)

With Docker Desktop: `docker compose up --build` from `fraud-sense/`. The UI is served on port 80 with `/api` proxied to the API.
