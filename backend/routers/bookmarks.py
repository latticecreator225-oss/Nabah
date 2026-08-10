from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from deps import db
from auth import current_user_id, assert_owner

router = APIRouter(prefix="/api", tags=["bookmarks"])


class SavedAyahCreate(BaseModel):
    user_id: str
    emotion: str
    arabic: str
    english: str
    surah: str
    reference: str


@router.post("/saved-ayahs")
async def save_ayah(payload: SavedAyahCreate, auth_id: str = Depends(current_user_id)):
    assert_owner(payload.user_id, auth_id)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": payload.user_id,
        "emotion": payload.emotion,
        "arabic": payload.arabic,
        "english": payload.english,
        "surah": payload.surah,
        "reference": payload.reference,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.saved_ayahs.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/saved-ayahs/{user_id}")
async def get_saved_ayahs(user_id: str, auth_id: str = Depends(current_user_id)):
    assert_owner(user_id, auth_id)
    rows = await db.saved_ayahs.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return rows


@router.delete("/saved-ayahs/{user_id}/{ayah_id}", status_code=200)
async def delete_saved_ayah(user_id: str, ayah_id: str, auth_id: str = Depends(current_user_id)):
    assert_owner(user_id, auth_id)
    res = await db.saved_ayahs.delete_one({"user_id": user_id, "id": ayah_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"deleted": True}
