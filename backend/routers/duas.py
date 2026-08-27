"""
Nabah · Duas router

Serves the curated supplication collection from duas_data.py. Static content —
no database needed.
"""
from fastapi import APIRouter, HTTPException

from duas_data import DUA_CATEGORIES, categories_summary, category_by_id

router = APIRouter(prefix="/api", tags=["duas"])


def _with_source(dua: dict) -> dict:
    """Differentiates duas the way classical collections (e.g. Hisn al-Muslim)
    do: whether the wording is Qur'anic revelation or a Prophetic supplication
    — a real, meaningful distinction, not a cosmetic label. Derived from the
    existing `reference` text rather than hand-tagging every entry, so it
    can't drift out of sync with it.
    """
    ref = (dua.get("reference") or "")
    source = "quran" if ref.strip().lower().startswith(("qur'an", "quran", "al-qur")) else "hadith"
    return {**dua, "source": source}


def _with_sources(cat: dict) -> dict:
    return {**cat, "duas": [_with_source(d) for d in cat.get("duas", [])]}


@router.get("/duas/categories")
async def duas_categories():
    return categories_summary()


@router.get("/duas/all")
async def duas_all():
    return [_with_sources(c) for c in DUA_CATEGORIES]


@router.get("/duas/{category_id}")
async def duas_in_category(category_id: str):
    cat = category_by_id(category_id)
    if not cat:
        raise HTTPException(404, "Category not found")
    return _with_sources(cat)
