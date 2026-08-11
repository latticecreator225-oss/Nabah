from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from deps import db, logger
from auth import current_user_id, assert_owner
from push_fcm import fcm
from notifications import (
    fard_payload, pre_adhan_payload, adhkar_payload,
    tahajjud_payload, contextual_sunnah_payload, observance_payload,
    all_payloads_preview,
)

router = APIRouter(prefix="/api", tags=["notifications"])


# ─────────── Notification preferences ───────────
class NotifPrefs(BaseModel):
    user_id: str
    prayer_fajr: bool = True
    prayer_dhuhr: bool = True
    prayer_asr: bool = True
    prayer_maghrib: bool = True
    prayer_isha: bool = True
    pre_adhan_minutes: int = 0
    adhkar_morning: bool = True
    adhkar_evening: bool = True
    adhkar_sleep: bool = True
    tahajjud: bool = False
    sunnah_household: bool = True
    sunnah_public: bool = True
    sunnah_work: bool = True
    # Sacred observances (calendar-anchored)
    reminder_surah_mulk: bool = True
    reminder_surah_kahf: bool = True
    reminder_jumuah_hour: bool = True
    reminder_ayyamul_bidh: bool = True
    reminder_mon_thu: bool = False
    reminder_arafah: bool = True
    reminder_ashura: bool = True
    reminder_eid: bool = True


@router.get("/notif-prefs/{user_id}")
async def get_notif_prefs(user_id: str, auth_id: str = Depends(current_user_id)):
    assert_owner(user_id, auth_id)
    doc = await db.notif_prefs.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        defaults = NotifPrefs(user_id=user_id).dict()
        await db.notif_prefs.insert_one(dict(defaults))
        defaults.pop("_id", None)
        return defaults
    return doc


@router.put("/notif-prefs")
async def save_notif_prefs(payload: NotifPrefs, auth_id: str = Depends(current_user_id)):
    assert_owner(payload.user_id, auth_id)
    body = payload.dict()
    await db.notif_prefs.update_one(
        {"user_id": payload.user_id}, {"$set": body}, upsert=True
    )
    return body


# ─────────── Emergent Push (register & trigger) ───────────
class RegisterPushBody(BaseModel):
    user_id: str
    platform: str  # "android" | "ios"
    device_token: str


@router.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody, auth_id: str = Depends(current_user_id)):
    assert_owner(body.user_id, auth_id)
    # Direct FCM: the device token is all we need \u2014 store it and send to it later.
    # There is no third-party relay to register with anymore.
    await db.push_tokens.update_one(
        {"user_id": body.user_id, "platform": body.platform},
        {"$set": {"device_token": body.device_token, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"status": "registered"}


# ─────────── In-app feed ───────────
@router.get("/notifications/feed/{user_id}")
async def notifications_feed(user_id: str, limit: int = 50, auth_id: str = Depends(current_user_id)):
    assert_owner(user_id, auth_id)
    rows = await db.notifications_feed.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("sent_at", -1).to_list(min(limit, 200))
    return rows


@router.post("/notifications/feed/read/{user_id}")
async def notifications_feed_mark_read(user_id: str, auth_id: str = Depends(current_user_id)):
    assert_owner(user_id, auth_id)
    await db.notifications_feed.update_many(
        {"user_id": user_id, "read": {"$ne": True}},
        {"$set": {"read": True}},
    )
    return {"marked": True}


@router.get("/notifications/feed/{user_id}/unread-count")
async def notifications_feed_unread_count(user_id: str, auth_id: str = Depends(current_user_id)):
    assert_owner(user_id, auth_id)
    cnt = await db.notifications_feed.count_documents(
        {"user_id": user_id, "read": {"$ne": True}}
    )
    return {"unread": cnt}


# ─────────── Preview / sample / test ───────────
@router.get("/notifications/preview")
async def notifications_preview():
    return all_payloads_preview()


def _resolve_payload(category: str, key: Optional[str]) -> dict:
    if category == "fard":
        return fard_payload(key or "Fajr")
    if category == "pre_adhan":
        return pre_adhan_payload(key or "Dhuhr", 15)
    if category == "adhkar":
        return adhkar_payload(key or "morning")
    if category == "tahajjud":
        return tahajjud_payload()
    if category == "sunnah":
        return contextual_sunnah_payload(key or "household")
    if category == "observance":
        return observance_payload(key or "surah_mulk")
    raise HTTPException(400, "Unknown category")


@router.get("/notifications/sample")
async def notifications_sample(category: str, key: Optional[str] = None):
    return _resolve_payload(category, key)


class TestPushBody(BaseModel):
    user_id: str
    category: str = "fard"
    key: Optional[str] = None


@router.post("/notifications/test")
async def notifications_test(body: TestPushBody, auth_id: str = Depends(current_user_id)):
    assert_owner(body.user_id, auth_id)
    data = _resolve_payload(body.category, body.key)

    now_iso = datetime.now(timezone.utc).isoformat()
    detail: Optional[str] = None
    try:
        delivery = await fcm.send_to_user(body.user_id, data)
    except Exception as e:
        delivery = f"error({type(e).__name__})"; detail = str(e)

    await db.notifications_feed.insert_one({
        "user_id": body.user_id,
        "category": body.category,
        "key": body.key,
        "title": data.get("title", ""),
        "message": data.get("message", ""),
        "action_url": data.get("action_url"),
        "sent_at": now_iso,
        "delivery": delivery,
        "source": "test",
    })

    if delivery == "no_device" and not detail:
        detail = "No device registered for push on this account."
    return {
        "status": "sent" if delivery == "sent" else "pending",
        "delivery": delivery,
        "payload": data,
        **({"detail": detail} if detail else {}),
    }
