"""
Nabah · Shared backend dependencies.
Imported by every router module so server.py stays thin.
"""
import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("nabah")


def _require_env(name: str) -> str:
    """Fetch a required env var, failing fast with an actionable message."""
    val = os.environ.get(name)
    if not val:
        raise RuntimeError(
            f"Missing required environment variable {name!r}. "
            f"Copy backend/.env.example to backend/.env and fill it in "
            f"(see README.md → Backend setup)."
        )
    return val


# ─────────── Mongo ───────────
_mongo_url = _require_env("MONGO_URL")
_db_name = _require_env("DB_NAME")
client = AsyncIOMotorClient(_mongo_url)
db = client[_db_name]

# ─────────── LLM (Anthropic, direct) ───────────
# Powers the emotion → ayah reflection. If unset, the app uses its hand-written
# static fallbacks (grounded-or-static policy). Model is overridable; defaults to
# the latest Opus.
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-8")
if not ANTHROPIC_API_KEY:
    logger.warning(
        "ANTHROPIC_API_KEY is not set — emotion/ayah reflections use static "
        "fallbacks."
    )

# ─────────── Reminders ───────────
# Reminders are scheduled on the device as local notifications — there is no
# push transport, scheduler, or Firebase/FCM anywhere in the backend.


async def close_clients() -> None:
    """Tear down on shutdown."""
    client.close()
