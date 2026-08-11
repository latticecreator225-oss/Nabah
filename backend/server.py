"""
Nabah · FastAPI entry point.

Server.py stays thin: app setup, CORS, scheduler lifecycle, router wiring.
All business logic lives in /app/backend/routers/.
"""
import os

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from deps import db, logger, close_clients
from push_fcm import fcm
from routers import routers as api_routers
from scheduler import start_scheduler, shutdown_scheduler

# Set DISABLE_SCHEDULER=1 to run the API without the notification engine — useful
# for local/dev or tests where MongoDB isn't available (Quran, Duas, prayer
# times and other read-only endpoints don't need a database).
SCHEDULER_DISABLED = os.environ.get("DISABLE_SCHEDULER") == "1"

app = FastAPI(title="Nabah API")

for r in api_routers:
    app.include_router(r)

# CORS is an allow-list, never "*". A wildcard combined with credentials makes
# Starlette reflect *any* Origin — so a malicious page could drive the API on a
# signed-in user's behalf. Native mobile clients don't send an Origin and are
# unaffected by CORS; this list only matters for web builds. Configure the
# production web origin(s) via ALLOWED_ORIGINS (comma-separated); dev defaults
# cover the Expo web/localhost ports.
_origins_env = os.environ.get("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = [o.strip() for o in _origins_env.split(",") if o.strip()] or [
    "http://localhost:8081",
    "http://localhost:19006",
    "http://127.0.0.1:8081",
]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,  # auth is a Bearer header, not cookies
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    if SCHEDULER_DISABLED:
        logger.info("Scheduler disabled (DISABLE_SCHEDULER=1).")
        return
    try:
        start_scheduler(db)
    except Exception as e:
        logger.warning(f"Scheduler boot failed (non-fatal): {e}")


@app.on_event("shutdown")
async def _shutdown():
    if not SCHEDULER_DISABLED:
        shutdown_scheduler()
    await fcm.aclose()
    await close_clients()
