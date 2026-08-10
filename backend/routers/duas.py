"""
Nabah · Duas router

Serves the curated supplication collection from duas_data.py. Static content —
no database needed.
"""
from fastapi import APIRouter, HTTPException

from duas_data import DUA_CATEGORIES, categories_summary, category_by_id

router = APIRouter(prefix="/api", tags=["duas"])


@router.get("/duas/categories")
async def duas_categories():
    return categories_summary()


@router.get("/duas/all")
async def duas_all():
    return DUA_CATEGORIES


@router.get("/duas/{category_id}")
async def duas_in_category(category_id: str):
    cat = category_by_id(category_id)
    if not cat:
        raise HTTPException(404, "Category not found")
    return cat
