"""
Nabah · The Two Sahihs

Browse the complete Sahih al-Bukhari and Sahih Muslim, by book, with Arabic +
English and an authenticity grade. Source: the open hadith-api dataset on
jsdelivr (no key). Every narration in these two collections is Ṣaḥīḥ by the
consensus of the scholars — the dataset leaves their per-hadith grade empty, so
we surface "Sahih" with the collection as the authority. (Where a dataset does
carry an explicit grade, we use it.)

Each full collection (~7.5k narrations) is fetched once and cached in-process;
the network fetch runs off the event loop so it never blocks other requests.
"""
import asyncio
from typing import Dict, List, Optional

import requests
from fastapi import APIRouter, HTTPException

from deps import logger

router = APIRouter(prefix="/api", tags=["hadith"])

CDN = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions"

COLLECTIONS: Dict[str, dict] = {
    "bukhari": {
        "name": "Sahih al-Bukhari",
        "name_ar": "صحيح البخاري",
        "authority": "al-Bukhari",
        "blurb": "The most rigorously authenticated collection — every chain Ṣaḥīḥ.",
    },
    "muslim": {
        "name": "Sahih Muslim",
        "name_ar": "صحيح مسلم",
        "authority": "Muslim",
        "blurb": "The second of the two Sahihs — meticulous, fully authentic.",
    },
}

# _CACHE[coll] = {"hadiths": [...], "sections": [...], "total": int}
_CACHE: Dict[str, dict] = {}
_LOCKS: Dict[str, asyncio.Lock] = {}


def _fetch_json(url: str):
    r = requests.get(url, timeout=45)
    r.raise_for_status()
    return r.json()


def _build_collection(coll: str) -> dict:
    """Blocking — runs in a worker thread. Fetch eng+ara, merge, index by book."""
    eng = _fetch_json(f"{CDN}/eng-{coll}.min.json")
    ara = _fetch_json(f"{CDN}/ara-{coll}.min.json")
    ara_by_num = {h.get("hadithnumber"): h.get("text", "") for h in ara.get("hadiths", [])}
    section_names: Dict[str, str] = eng.get("metadata", {}).get("sections", {}) or {}

    hadiths: List[dict] = []
    counts: Dict[int, int] = {}
    for h in eng.get("hadiths", []):
        num = h.get("hadithnumber")
        ref = h.get("reference") or {}
        book = ref.get("book")
        grades = h.get("grades") or []
        grade = None
        if grades and isinstance(grades[0], dict):
            grade = grades[0].get("grade")
        hadiths.append({
            "number": num,
            "book": book,
            "in_book": ref.get("hadith"),
            "arabic": ara_by_num.get(num, ""),
            "english": (h.get("text") or "").strip(),
            "grade": grade or "Sahih",
        })
        if isinstance(book, int):
            counts[book] = counts.get(book, 0) + 1

    sections: List[dict] = []
    for k, name in section_names.items():
        if not name:
            continue
        try:
            bnum = int(k)
        except (TypeError, ValueError):
            continue
        c = counts.get(bnum, 0)
        if c == 0:
            continue
        sections.append({"number": bnum, "name": name, "count": c})
    sections.sort(key=lambda s: s["number"])

    return {"hadiths": hadiths, "sections": sections, "total": len(hadiths)}


async def _get_collection(coll: str) -> dict:
    if coll in _CACHE:
        return _CACHE[coll]
    lock = _LOCKS.setdefault(coll, asyncio.Lock())
    async with lock:
        if coll in _CACHE:  # built while we waited
            return _CACHE[coll]
        try:
            data = await asyncio.to_thread(_build_collection, coll)
        except Exception as e:
            logger.warning(f"hadith build failed for {coll}: {e}")
            raise HTTPException(502, "Could not load this hadith collection")
        _CACHE[coll] = data
        return data


@router.get("/hadith/collections")
async def hadith_collections():
    """The two Sahihs (lightweight — totals appear once a collection is opened)."""
    out = []
    for cid, meta in COLLECTIONS.items():
        cached = _CACHE.get(cid)
        out.append({
            "id": cid,
            **meta,
            "total": cached["total"] if cached else None,
            "section_count": len(cached["sections"]) if cached else None,
        })
    return out


@router.get("/hadith/{coll}/sections")
async def hadith_sections(coll: str):
    if coll not in COLLECTIONS:
        raise HTTPException(404, "Unknown collection")
    data = await _get_collection(coll)
    return {
        "id": coll,
        **COLLECTIONS[coll],
        "total": data["total"],
        "sections": data["sections"],
    }


@router.get("/hadith/{coll}")
async def hadith_list(
    coll: str,
    section: Optional[int] = None,
    page: int = 0,
    limit: int = 15,
    q: Optional[int] = None,
):
    """Paginated narrations. Filter by `section` (book number) or jump to `q` (hadith number)."""
    if coll not in COLLECTIONS:
        raise HTTPException(404, "Unknown collection")
    data = await _get_collection(coll)
    items = data["hadiths"]

    if q is not None:
        items = [h for h in items if h["number"] == q]
    elif section is not None:
        items = [h for h in items if h["book"] == section]

    limit = max(1, min(limit, 50))
    page = max(0, page)
    start = page * limit
    page_items = items[start:start + limit]

    return {
        "id": coll,
        "authority": COLLECTIONS[coll]["authority"],
        "section": section,
        "page": page,
        "limit": limit,
        "total": len(items),
        "has_more": start + limit < len(items),
        "hadiths": page_items,
    }
