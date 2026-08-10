"""
Nabah · Shared backend dependencies.
Imported by every router module so server.py stays thin.
"""
import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import httpx

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

# ─────────── LLM key (Emergent universal) ───────────
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
if not EMERGENT_LLM_KEY:
    logger.warning(
        "EMERGENT_LLM_KEY is not set — emotion/ayah generation will fall back "
        "to static responses where available."
    )

# ─────────── Emergent Push (SuprSend relay) ───────────
PUSH_BASE_URL = "https://integrations.emergentagent.com"
EMERGENT_PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")
if EMERGENT_PUSH_KEY == "placeholder":
    logger.warning(
        "EMERGENT_PUSH_KEY is using the placeholder value — push registration and "
        "delivery run in preview/no-op mode until a real key is configured."
    )
push_client = httpx.AsyncClient(
    base_url=PUSH_BASE_URL,
    headers={"X-Push-Key": EMERGENT_PUSH_KEY},
    timeout=10.0,
)


async def close_clients() -> None:
    """Tear down on shutdown."""
    try:
        await push_client.aclose()
    except Exception:
        pass
    client.close()
