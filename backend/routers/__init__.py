"""Nabah route modules.

Each module exports `router` (an APIRouter prefixed with /api).
server.py imports them and mounts them on the FastAPI app.
"""
from . import (
    users,
    emotions,
    azkar,
    bookmarks,
    sunnah,
    prayers,
    quran,
    duas,
    hadith,
    notifications as notifications_routes,
)

routers = [
    users.router,
    emotions.router,
    azkar.router,
    bookmarks.router,
    sunnah.router,
    prayers.router,
    quran.router,
    duas.router,
    hadith.router,
    notifications_routes.router,
]
