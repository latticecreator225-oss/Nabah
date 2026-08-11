"""
Nabah · FastAPI entry point.

Server.py stays thin: app setup, CORS, router wiring. All business logic lives
in /app/backend/routers/.

Reminders are scheduled on the device (local notifications) — there is no
server-side notification engine or push transport here.
"""
import os

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from deps import close_clients
from routers import routers as api_routers

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


@app.on_event("shutdown")
async def _shutdown():
    await close_clients()
