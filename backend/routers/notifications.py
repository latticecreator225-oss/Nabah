"""
Nabah · Notification preferences + reminder content.

Reminders fire on the device as local notifications (see the client's
reminderSchedule.ts) — there is no server-side push transport here. This module
keeps the user's notification *preferences* (which the client reads to decide
what to schedule) and serves the reminder *content* templates (preview/sample)
that the UI shows.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from deps import db
from auth import current_user_id, assert_owner
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


# ─────────── Reminder content (preview / sample) ───────────
@router.get("/notifications/preview")
async def notifications_preview():
    return all_payloads_preview()


def _resolve_payload(category: str, key: Optional[str], minutes: int = 15) -> dict:
    if category == "fard":
        return fard_payload(key or "Fajr")
    if category == "pre_adhan":
        return pre_adhan_payload(key or "Dhuhr", minutes)
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
