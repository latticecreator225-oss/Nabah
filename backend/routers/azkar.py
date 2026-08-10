from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from deps import db
from auth import current_user_id, assert_owner
from ayah_data import AZKAR_SECTIONS

router = APIRouter(prefix="/api", tags=["azkar"])


class AzkarProgressUpdate(BaseModel):
    user_id: str
    section_id: str
    item_index: int
    done: bool


@router.get("/azkar")
async def get_azkar():
    return AZKAR_SECTIONS


@router.post("/azkar/progress")
async def update_azkar_progress(payload: AzkarProgressUpdate, auth_id: str = Depends(current_user_id)):
    assert_owner(payload.user_id, auth_id)
    today = date.today().isoformat()
    key = f"{payload.section_id}:{payload.item_index}"
    if payload.done:
        await db.azkar_progress.update_one(
            {"user_id": payload.user_id, "date": today},
            {"$addToSet": {"completed": key}},
            upsert=True,
        )
    else:
        await db.azkar_progress.update_one(
            {"user_id": payload.user_id, "date": today},
            {"$pull": {"completed": key}},
        )
    return {"ok": True}


@router.get("/azkar/progress/{user_id}")
async def get_azkar_progress(user_id: str, auth_id: str = Depends(current_user_id)):
    assert_owner(user_id, auth_id)
    today = date.today().isoformat()
    doc = await db.azkar_progress.find_one(
        {"user_id": user_id, "date": today}, {"_id": 0}
    )
    return {"completed": (doc or {}).get("completed", [])}
