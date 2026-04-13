"""FraudSense FastAPI application entry point."""

from __future__ import annotations

import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from db import close_mongo, ensure_indexes, get_database, init_mongo, insert_model_log, ping_db
from predict import artifacts_loaded, load_artifacts
from routes.explain import router as explain_router
from routes.history import router as history_router
from routes.model_info import router as model_info_router
from routes.predict import router as predict_router
from routes.simulate import router as simulate_router, simulation_worker
from routes.stats import router as stats_router
from schemas import HealthResponse

load_dotenv(Path(__file__).resolve().parent / ".env")

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("fraudsense")


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
        await ensure_indexes(app.state.db)
    except Exception as e:
        logger.warning("Index setup skipped: %s", e)
    try:
        await asyncio.to_thread(load_artifacts)
        try:
            await insert_model_log(
                app.state.db,
                event="model_artifacts_loaded",
                detail={"status": "ok"},
            )
        except Exception:
            pass
    except FileNotFoundError as e:
        logger.warning("Model artifacts: %s", e)
        try:
            await insert_model_log(
                app.state.db,
                event="model_artifacts_loaded",
                detail={"status": "missing", "error": str(e)},
            )
        except Exception:
            pass
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
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,http://localhost,http://127.0.0.1",
)


@app.middleware("http")
async def optional_api_key(request: Request, call_next):
    key = os.environ.get("API_KEY", "").strip()
    if not key:
        return await call_next(request)
    path = request.url.path
    if path in ("/health", "/docs", "/openapi.json", "/redoc", "/favicon.ico"):
        return await call_next(request)
    if path.startswith("/ws/"):
        return await call_next(request)
    if request.method == "OPTIONS":
        return await call_next(request)
    provided = request.headers.get("X-API-Key", "")
    auth = request.headers.get("Authorization", "")
    if not provided and auth.startswith("Bearer "):
        provided = auth[7:].strip()
    if provided != key:
        return JSONResponse(
            status_code=401, content={"detail": "Invalid or missing API key"}
        )
    return await call_next(request)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (time.perf_counter() - start) * 1000
        logger.exception(
            "request_failed method=%s path=%s %.2fms",
            request.method,
            request.url.path,
            duration_ms,
        )
        raise
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "%s %s -> %s %.2fms",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


# Registered last so it runs first on the request (outermost) and decorates all responses with CORS headers.
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
app.include_router(explain_router)


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
