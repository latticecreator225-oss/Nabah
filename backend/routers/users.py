from datetime import datetime, timezone
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from deps import db, logger
from auth import new_token, current_user_id, assert_owner

router = APIRouter(prefix="/api", tags=["users"])

MAX_NAME_LEN = 60

# Every Mongo collection that stores rows keyed by `user_id`. Used by account
# deletion so a "delete me" wipes everything, leaving nothing behind.
USER_SCOPED_COLLECTIONS = [
    "notif_prefs",
    "saved_ayahs",
    "notifications_feed",
    "notif_queue",
    "push_tokens",
    "azkar_progress",
    "sunnah_revivals",
]


def _validate_name(name: Optional[str]) -> str:
    name = (name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Name must not be empty.")
    if len(name) > MAX_NAME_LEN:
        raise HTTPException(status_code=422, detail=f"Name must be at most {MAX_NAME_LEN} characters.")
    return name


def _validate_coords(lat: Optional[float], lng: Optional[float]) -> None:
    if lat is not None and not (-90.0 <= lat <= 90.0):
        raise HTTPException(status_code=422, detail="Latitude must be between -90 and 90.")
    if lng is not None and not (-180.0 <= lng <= 180.0):
        raise HTTPException(status_code=422, detail="Longitude must be between -180 and 180.")


class UserCreate(BaseModel):
    name: str
    gender: str = "unspecified"  # "male" | "female" | "unspecified"
    married: bool = False
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    timezone: Optional[str] = "UTC"


class UserUpdate(BaseModel):
    name: Optional[str] = None
    gender: Optional[str] = None
    married: Optional[bool] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    timezone: Optional[str] = None
    calculation_method: Optional[int] = None
    asr_method: Optional[int] = None


class User(BaseModel):
    id: str
    name: str
    gender: str = "unspecified"
    married: bool = False
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    timezone: str = "UTC"
    calculation_method: int = 2
    asr_method: int = 0
    created_at: str


class UserWithToken(User):
    # Returned exactly once, at creation. The client stores it and sends it as
    # `Authorization: Bearer <token>`; the server keeps only its hash.
    token: str


def doc_to_user(doc: dict) -> dict:
    return {
        "id": doc.get("id"),
        "name": doc.get("name"),
        "gender": doc.get("gender", "unspecified"),
        "married": bool(doc.get("married", False)),
        "location_lat": doc.get("location_lat"),
        "location_lng": doc.get("location_lng"),
        "timezone": doc.get("timezone", "UTC"),
        "calculation_method": doc.get("calculation_method", 2),
        "asr_method": doc.get("asr_method", 0),
        "created_at": doc.get("created_at"),
    }


@router.get("/")
async def root():
    return {"app": "Nabah", "name_ar": "نَبَأ"}


@router.post("/users", response_model=UserWithToken)
async def create_user(payload: UserCreate):
    name = _validate_name(payload.name)
    _validate_coords(payload.location_lat, payload.location_lng)

    user_id = str(uuid.uuid4())
    token, token_hash = new_token()
    doc = {
        "id": user_id,
        "name": name,
        "gender": (payload.gender or "unspecified").lower(),
        "married": bool(payload.married),
        "location_lat": payload.location_lat,
        "location_lng": payload.location_lng,
        "timezone": payload.timezone or "UTC",
        "calculation_method": 2,
        "asr_method": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "token_hash": token_hash,
    }
    await db.users.insert_one(doc)
    return UserWithToken(**doc_to_user(doc), token=token)


@router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str, auth_id: str = Depends(current_user_id)):
    assert_owner(user_id, auth_id)
    doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**doc_to_user(doc))


@router.patch("/users/{user_id}", response_model=User)
async def update_user(user_id: str, payload: UserUpdate, auth_id: str = Depends(current_user_id)):
    assert_owner(user_id, auth_id)
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if "name" in updates:
        updates["name"] = _validate_name(updates["name"])
    _validate_coords(updates.get("location_lat"), updates.get("location_lng"))
    if not updates:
        doc = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="User not found")
        return User(**doc_to_user(doc))
    result = await db.users.find_one_and_update(
        {"id": user_id}, {"$set": updates}, return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**doc_to_user(result))


@router.delete("/users/{user_id}", status_code=200)
async def delete_user(user_id: str, auth_id: str = Depends(current_user_id)):
    """Permanently delete the account and every row keyed to it.

    Satisfies Google Play's account-deletion requirement: one call removes the
    user document and cascades across all user-scoped collections so no PII
    (name, gender, coordinates, prefs, bookmarks) survives.
    """
    assert_owner(user_id, auth_id)
    res = await db.users.delete_one({"id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    deleted = {}
    for coll in USER_SCOPED_COLLECTIONS:
        try:
            r = await db[coll].delete_many({"user_id": user_id})
            deleted[coll] = r.deleted_count
        except Exception as e:  # never let one collection failure abort the wipe
            logger.warning(f"delete_user: failed to clear {coll} for {user_id}: {e}")
    logger.info(f"delete_user: wiped {user_id} — {deleted}")
    return {"deleted": True, "collections": deleted}
