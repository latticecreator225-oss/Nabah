"""
Nabah · Classical tafsir grounding

Fetches the classical exegesis (Tafsir Ibn Kathir, English) for a given ayah
from the open spa5k/tafsir_api dataset and caches it in-process. Used to ground
the LLM "reflection" in the Feelings feature: the model is only allowed to
contextualize this text — never to invent meanings of its own.

If the tafsir cannot be obtained, callers must fall back to the static
reflections (grounded-or-static policy; no free-form generation).
"""
import re
from typing import Dict, Optional, Tuple

import requests

from deps import logger

TAFSIR_EDITION = "en-tafisr-ibn-kathir"  # (sic — the dataset spells it this way)
TAFSIR_NAME = "Tafsir Ibn Kathir"
_CDN = "https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir"

# Keep prompts bounded — Ibn Kathir entries can run to many pages.
MAX_CHARS = 1800

_CACHE: Dict[Tuple[int, int], Optional[str]] = {}


def parse_ref(ref: str) -> Optional[Tuple[int, int]]:
    """'93:5' → (93, 5). Tolerates surrounding text; None if unparseable."""
    m = re.search(r"(\d{1,3})\s*:\s*(\d{1,3})", ref or "")
    if not m:
        return None
    surah, ayah = int(m.group(1)), int(m.group(2))
    if not (1 <= surah <= 114):
        return None
    return surah, ayah


def _truncate(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= MAX_CHARS:
        return text
    cut = text[:MAX_CHARS]
    # end on a sentence boundary where possible
    dot = cut.rfind(". ")
    return (cut[: dot + 1] if dot > MAX_CHARS // 2 else cut) + " …"


def get_tafsir(surah: int, ayah: int) -> Optional[str]:
    """Blocking — call via asyncio.to_thread. Returns None on any failure."""
    key = (surah, ayah)
    if key in _CACHE:
        return _CACHE[key]
    try:
        r = requests.get(f"{_CDN}/{TAFSIR_EDITION}/{surah}/{ayah}.json", timeout=10)
        r.raise_for_status()
        text = (r.json() or {}).get("text") or ""
        result = _truncate(text) if text.strip() else None
    except Exception as e:
        logger.warning(f"tafsir fetch failed for {surah}:{ayah}: {e}")
        result = None
    _CACHE[key] = result
    return result
