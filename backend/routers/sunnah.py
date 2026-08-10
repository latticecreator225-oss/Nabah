from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from deps import db
from auth import current_user_id, optional_user_id, assert_owner
from sunnah_data import SUNNAHS, SUNNAH_CATEGORIES, sunnah_of_the_hour

router = APIRouter(prefix="/api", tags=["sunnah"])


class ReviveBody(BaseModel):
    user_id: str
    sunnah_id: str
    revived: bool = True


@router.get("/sunnahs/categories")
async def get_sunnah_categories():
    counts: dict = {}
    for s in SUNNAHS:
        counts[s["category"]] = counts.get(s["category"], 0) + 1
    return [{**c, "count": counts.get(c["id"], 0)} for c in SUNNAH_CATEGORIES]


@router.get("/sunnahs")
async def list_sunnahs(
    category: Optional[str] = None,
    demographic: Optional[str] = None,
    user_id: Optional[str] = None,
    auth_id: Optional[str] = Depends(optional_user_id),
):
    items = SUNNAHS
    if category:
        items = [s for s in items if s["category"] == category]
    if demographic:
        items = [
            s for s in items if s["demographic"] in ("general", demographic)
            or (demographic == "household" and s["demographic"] in ("household", "married"))
            or (demographic == "married" and s["demographic"] in ("married", "household"))
        ]
    # "revived today" is personal state; only surface it for the authenticated
    # caller's own id. A mismatched/absent token yields the public list.
    revived = set()
    if user_id and user_id == auth_id:
        today = date.today().isoformat()
        doc = await db.sunnah_revivals.find_one(
            {"user_id": user_id, "date": today}, {"_id": 0}
        )
        revived = set((doc or {}).get("revived", []))
    return [{**s, "revived_today": s["id"] in revived} for s in items]


@router.get("/sunnahs/of-the-hour")
async def get_sunnah_of_the_hour(hour: int = 12):
    return sunnah_of_the_hour(hour)


@router.post("/sunnahs/revive")
async def revive_sunnah(payload: ReviveBody, auth_id: str = Depends(current_user_id)):
    assert_owner(payload.user_id, auth_id)
    today = date.today().isoformat()
    if payload.revived:
        await db.sunnah_revivals.update_one(
            {"user_id": payload.user_id, "date": today},
            {"$addToSet": {"revived": payload.sunnah_id}},
            upsert=True,
        )
    else:
        await db.sunnah_revivals.update_one(
            {"user_id": payload.user_id, "date": today},
            {"$pull": {"revived": payload.sunnah_id}},
        )
    return {"ok": True}
