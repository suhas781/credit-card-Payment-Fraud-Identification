"""FraudSense FastAPI application entry point."""

from __future__ import annotations

import asyncio
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import close_mongo, get_database, init_mongo, ping_db
from predict import artifacts_loaded, load_artifacts
from routes.history import router as history_router
from routes.model_info import router as model_info_router
from routes.predict import router as predict_router
from routes.simulate import router as simulate_router, simulation_worker
from routes.stats import router as stats_router
from schemas import HealthResponse

load_dotenv(Path(__file__).resolve().parent / ".env")


@asynccontextmanager
async def lifespan(app: FastAPI):
    mongo_uri = os.environ.get("MONGO_URI") or os.environ.get(
        "MONGODB_URI", "mongodb://localhost:27017"
    )
    db_name = os.environ.get("DB_NAME", "fraudsense")
    init_mongo(mongo_uri)
    app.state.db = get_database(db_name)
    app.state.start_time = time.time()
    app.state.simulation_active = False
    try:
        await asyncio.to_thread(load_artifacts)
    except FileNotFoundError as e:
        print(f"Warning: model artifacts: {e}")
    sim_task = asyncio.create_task(simulation_worker(app))
    yield
    sim_task.cancel()
    try:
        await sim_task
    except asyncio.CancelledError:
        pass
    await close_mongo()


app = FastAPI(title="FraudSense API", version="1.0.0", lifespan=lifespan)

_origins = os.environ.get(
    "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict_router)
app.include_router(stats_router)
app.include_router(history_router)
app.include_router(model_info_router)
app.include_router(simulate_router)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    loaded = artifacts_loaded()
    if not loaded:
        try:
            await asyncio.to_thread(load_artifacts)
            loaded = True
        except FileNotFoundError:
            loaded = False

    db_ok = False
    try:
        db_ok = await ping_db(app.state.db)
    except Exception:
        db_ok = False

    uptime = time.time() - getattr(app.state, "start_time", time.time())
    return HealthResponse(
        status="ok",
        model_loaded=loaded,
        db_connected=db_ok,
        uptime_seconds=round(uptime, 3),
    )
