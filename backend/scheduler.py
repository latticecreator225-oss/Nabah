"""
Nabah · Notification Scheduler

Single in-process APScheduler that:
  • Recomputes each user's daily send-window queue at 00:30 local-tz (UTC for now)
  • Every minute, dispatches due payloads to recipients via Firebase Cloud Messaging
  • Logs every sent (or attempted) push to `db.notifications_feed` so the
    in-app Notifications Center can replay them.

The scheduler is started from server.py's `@app.on_event("startup")` hook.
"""
from __future__ import annotations
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from notifications import (
    fard_payload, pre_adhan_payload, adhkar_payload,
    tahajjud_payload, contextual_sunnah_payload, observance_payload,
)
from push_fcm import fcm

# Hijri conversion (Umm al-Qura) for calendar-anchored observances. Optional —
# if unavailable, observances that depend on the Hijri date are simply skipped.
try:
    from hijridate import Gregorian  # maintained package
except Exception:  # pragma: no cover
    try:
        from hijri_converter import Gregorian  # legacy alias
    except Exception:
        Gregorian = None  # type: ignore

logger = logging.getLogger("nabah.scheduler")

_UTC = timezone.utc


def _safe_zone(tz_name: Optional[str]) -> ZoneInfo:
    """Resolve an IANA timezone string to a ZoneInfo, falling back to UTC.

    A user's stored timezone (e.g. "Asia/Kolkata") anchors every reminder to
    their local clock. A missing or invalid value must never crash the plan
    build — we degrade to UTC and log it.
    """
    if not tz_name:
        return ZoneInfo("UTC")
    try:
        return ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, ValueError, KeyError):
        logger.warning("Unknown timezone %r — falling back to UTC.", tz_name)
        return ZoneInfo("UTC")

# Singleton — assigned by start_scheduler()
_scheduler: Optional[AsyncIOScheduler] = None
_db = None


# ───── prayer-times (computed locally, offline) ─────
_PT_CACHE: Dict[str, Dict[str, Any]] = {}


async def _day_times(lat: float, lng: float, when_local: datetime) -> Optional[Dict[str, str]]:
    """Prayer times for the user's local day — computed locally, no network.

    `when_local` must be tz-aware in the user's zone; the returned HH:MM strings
    are in that zone. Uses the region-appropriate calculation method.
    """
    key = f"{lat:.3f},{lng:.3f}:{when_local.date().isoformat()}"
    if key in _PT_CACHE:
        return _PT_CACHE[key]
    try:
        from prayer_engine import compute_times
        from prayer_methods import pick_method
        method_id, _ = pick_method(lat, lng)
        tz = when_local.tzinfo or _UTC
        data = compute_times(lat, lng, when_local.date(), tz, method_id, 0)
        _PT_CACHE[key] = data
        return data
    except Exception as e:
        logger.warning(f"prayer computation failed for {key}: {e}")
        return None


def _hhmm_to_dt(today: datetime, hhmm: str) -> datetime:
    h, m = map(int, hhmm.split(":"))
    return today.replace(hour=h, minute=m, second=0, microsecond=0)


# ───── enqueue plan for one user-day ─────
async def _compute_plan(user_id: str, prefs: dict, lat: float, lng: float,
                        when_local: datetime) -> List[dict]:
    """Build one user's send tasks for a local calendar day.

    `when_local` must be a timezone-aware datetime in the *user's* timezone.
    Aladhan returns prayer times in the location's local clock, so anchoring
    hh:mm onto `when_local` yields the correct local instant; each task's
    `scheduled_at` is later converted to UTC for storage/dispatch.

    Returns a list of {scheduled_at (tz-aware datetime), category, key}.
    """
    times = await _day_times(lat, lng, when_local)
    if not times:
        return []
    when = when_local  # local, tz-aware
    plan: List[dict] = []

    # Fard
    fard_map = {
        "Fajr": "prayer_fajr", "Dhuhr": "prayer_dhuhr", "Asr": "prayer_asr",
        "Maghrib": "prayer_maghrib", "Isha": "prayer_isha",
    }
    for name, pref_key in fard_map.items():
        if not prefs.get(pref_key, True):
            continue
        if name not in times:
            continue
        at = _hhmm_to_dt(when, times[name])
        plan.append({"scheduled_at": at, "category": "fard", "key": name})

        pre_min = int(prefs.get("pre_adhan_minutes", 0) or 0)
        if pre_min > 0:
            plan.append({
                "scheduled_at": at - timedelta(minutes=pre_min),
                "category": "pre_adhan", "key": name, "minutes": pre_min,
            })

    # Adhkar
    if prefs.get("adhkar_morning", True) and "Sunrise" in times:
        plan.append({
            "scheduled_at": _hhmm_to_dt(when, times["Sunrise"]) + timedelta(minutes=30),
            "category": "adhkar", "key": "morning",
        })
    if prefs.get("adhkar_evening", True) and "Asr" in times:
        plan.append({
            "scheduled_at": _hhmm_to_dt(when, times["Asr"]) + timedelta(minutes=15),
            "category": "adhkar", "key": "evening",
        })
    if prefs.get("adhkar_sleep", True):
        plan.append({
            "scheduled_at": when.replace(hour=22, minute=0, second=0, microsecond=0),
            "category": "adhkar", "key": "sleep",
        })

    # Tahajjud — last-third of night (between Isha and next-day Fajr)
    if prefs.get("tahajjud", False) and "Isha" in times and "Fajr" in times:
        isha = _hhmm_to_dt(when, times["Isha"])
        next_fajr = _hhmm_to_dt(when + timedelta(days=1), times["Fajr"])
        night_len = next_fajr - isha
        last_third = isha + night_len * 2 // 3
        plan.append({
            "scheduled_at": last_third,
            "category": "tahajjud", "key": None,
        })

    # Contextual Sunnahs — household at 12:00, public at 09:00, work at 14:00
    sunnah_anchors = [
        ("sunnah_household", "household", 12),
        ("sunnah_public",    "public",    9),
        ("sunnah_work",      "work",      14),
    ]
    for pref_key, cat, hour in sunnah_anchors:
        if not prefs.get(pref_key, True):
            continue
        plan.append({
            "scheduled_at": when.replace(hour=hour, minute=0, second=0, microsecond=0),
            "category": "sunnah", "key": cat,
        })

    # Calendar-anchored observances (Surah al-Mulk / al-Kahf, fasts, Eid, …)
    plan.extend(_observance_tasks(prefs, when, times))

    return plan


def _observance_tasks(prefs: dict, when: datetime,
                      times: Optional[Dict[str, str]] = None) -> List[dict]:
    """Reminders tied to the weekday or the Hijri date.

    `when` is the user's local, tz-aware day. Fasting reminders fire the evening
    *before* so there's time to make the intention (suhoor); reading/Eid
    reminders fire on the day.

    `times` is the day's prayer-time map (hh:mm, local clock). It is optional
    because most observances are anchored to the calendar alone; only the
    Jumuʿah hour of response needs Maghrib. When it is absent, that one is
    skipped and the rest still schedule.
    """
    tasks: List[dict] = []
    weekday = when.weekday()  # Mon=0 … Sun=6

    def at(hour: int, minute: int = 0) -> datetime:
        return when.replace(hour=hour, minute=minute, second=0, microsecond=0)

    def add(key: str, dt: datetime):
        tasks.append({"scheduled_at": dt, "category": "observance", "key": key})

    # Surah al-Mulk — every night before sleep.
    if prefs.get("reminder_surah_mulk", True):
        add("surah_mulk", at(21, 30))

    # Surah al-Kahf — on Jumuʿah (Friday).
    if prefs.get("reminder_surah_kahf", True) and weekday == 4:
        add("surah_kahf", at(9, 0))

    # The hour of response (sāʿat al-ijābah) — the last hour of Jumuʿah, ending
    # at Maghrib. Anchored to the day's real Maghrib rather than a fixed clock
    # time so it tracks the season. Clamped to ʿAsr: where the ʿAsr→Maghrib gap
    # is shorter than an hour (high latitudes, or a late ʿAsr under the Hanafi
    # calculation) the reminder must not fire before ʿAsr has entered, since the
    # window it announces begins there.
    if prefs.get("reminder_jumuah_hour", True) and weekday == 4 and times:
        maghrib = times.get("Maghrib")
        if maghrib:
            start = _hhmm_to_dt(when, maghrib) - timedelta(hours=1)
            asr = times.get("Asr")
            if asr:
                start = max(start, _hhmm_to_dt(when, asr))
            add("jumuah_hour", start)

    # Mondays & Thursdays fast — remind the evening before (Sun / Wed).
    if prefs.get("reminder_mon_thu", False) and weekday in (6, 2):
        add("fast_mon_thu", at(19, 30))

    # Hijri-date observances.
    if Gregorian is not None:
        try:
            hij = Gregorian(when.year, when.month, when.day).to_hijri()
            h_month, h_day = hij.month, hij.day
        except Exception as e:
            logger.warning(f"hijri conversion failed: {e}")
            h_month = h_day = None

        if h_day is not None:
            # Ayyamul Bidh (white days 13–15) — remind the evening before each.
            if prefs.get("reminder_ayyamul_bidh", True) and h_day in (12, 13, 14):
                add("ayyamul_bidh", at(19, 30))
            # Day of Arafah (9 Dhul-Hijjah) — remind the day before.
            if prefs.get("reminder_arafah", True) and h_month == 12 and h_day == 8:
                add("arafah", at(19, 0))
            # ʿAshura (10 Muharram, plus the 9th) — remind on the 8th and 9th.
            if prefs.get("reminder_ashura", True) and h_month == 1 and h_day in (8, 9):
                add("ashura", at(19, 0))
            # Eid al-Fitr (1 Shawwal) and Eid al-Adha (10 Dhul-Hijjah).
            if prefs.get("reminder_eid", True) and h_month == 10 and h_day == 1:
                add("eid_fitr", at(7, 0))
            if prefs.get("reminder_eid", True) and h_month == 12 and h_day == 10:
                add("eid_adha", at(7, 0))

    return tasks


async def _build_daily_plan():
    """Build today's send queue for every user, in each user's own timezone.

    Run hourly (plus on boot): every user's plan is keyed by *their* local
    calendar date, so whichever hour their local midnight falls on, the plan is
    (idempotently) materialised within the hour — well before Fajr. Anchoring to
    UTC alone would fire reminders on the wrong local day for anyone east/west of
    UTC; this is the core timezone fix.
    """
    assert _db is not None
    now_utc = datetime.now(_UTC)
    # Recomputed fresh each build; clearing bounds the cache (one entry per
    # user-location-day would otherwise accumulate forever).
    _PT_CACHE.clear()

    users = await _db.users.find({}, {"_id": 0}).to_list(2000)
    users_by_id = {u["id"]: u for u in users}

    prefs_list = await _db.notif_prefs.find({}, {"_id": 0}).to_list(2000)
    inserted = 0
    for prefs in prefs_list:
        uid = prefs["user_id"]
        user = users_by_id.get(uid)
        if not user:
            continue
        lat = user.get("location_lat")
        lng = user.get("location_lng")
        if lat is None or lng is None:
            continue

        tz = _safe_zone(user.get("timezone"))
        local_now = now_utc.astimezone(tz)
        today_key = local_now.date().isoformat()

        plan = await _compute_plan(uid, prefs, float(lat), float(lng), local_now)
        for t in plan:
            await _db.notif_queue.update_one(
                {
                    "user_id": uid,
                    "date": today_key,
                    "category": t["category"],
                    "key": t["key"],
                },
                {
                    "$set": {
                        "scheduled_at": t["scheduled_at"].astimezone(_UTC).isoformat(),
                        "minutes": t.get("minutes"),
                    },
                    # Only initialise `sent` on first insert — the hourly rebuild
                    # must never flip an already-dispatched reminder back to unsent
                    # (that would re-send it).
                    "$setOnInsert": {"sent": False},
                },
                upsert=True,
            )
            inserted += 1
    await _cleanup_old()
    logger.info(f"Nabah scheduler: built daily plan — {inserted} sends queued.")


async def _cleanup_old() -> None:
    """Bound unbounded growth. The queue only needs the current (and previous,
    for idempotency safety) local day; the feed keeps a month of history."""
    assert _db is not None
    now = datetime.now(_UTC)
    queue_cutoff = (now - timedelta(days=2)).date().isoformat()  # 'YYYY-MM-DD' sorts lexically
    feed_cutoff = (now - timedelta(days=30)).isoformat()
    try:
        await _db.notif_queue.delete_many({"date": {"$lt": queue_cutoff}})
        await _db.notifications_feed.delete_many({"sent_at": {"$lt": feed_cutoff}})
    except Exception as e:
        logger.warning(f"scheduler cleanup failed (non-fatal): {e}")


def _payload_for(category: str, key: Optional[str], minutes: Optional[int] = None) -> Dict[str, str]:
    if category == "fard":
        return fard_payload(key or "Fajr")
    if category == "pre_adhan":
        # Use the user's configured lead time, not a hardcoded value, so the
        # body ("N minutes") matches when the reminder actually fires.
        return pre_adhan_payload(key or "Dhuhr", int(minutes) if minutes else 15)
    if category == "adhkar":
        return adhkar_payload(key or "morning")
    if category == "tahajjud":
        return tahajjud_payload()
    if category == "sunnah":
        return contextual_sunnah_payload(key or "household")
    if category == "observance":
        return observance_payload(key or "surah_mulk")
    return {"title": "Nabah", "message": "It is time."}


# A reminder that is due is only worth sending for a short window. After that
# the moment has passed (the prayer entered, the adhkar hour closed), so a late
# push — e.g. after the server was down, or after a long dispatch backlog —
# would be noise. We mark such tasks handled without delivering them.
_DISPATCH_GRACE = timedelta(minutes=30)


async def _dispatch_due():
    """Run every minute — send any payload whose scheduled_at <= now (UTC),
    unless it is more than the grace window late."""
    assert _db is not None
    now = datetime.now(_UTC)
    cursor = _db.notif_queue.find({
        "sent": False,
        "scheduled_at": {"$lte": now.isoformat()},
    }, {"_id": 0}).limit(200)

    async for task in cursor:
        uid = task["user_id"]

        # Skip (but mark handled) reminders that are too stale to be useful.
        try:
            sched_at = datetime.fromisoformat(task["scheduled_at"])
            too_late = sched_at < now - _DISPATCH_GRACE
        except (ValueError, KeyError):
            too_late = False
        if too_late:
            await _db.notif_queue.update_one(
                {"user_id": uid, "date": task["date"], "category": task["category"], "key": task.get("key")},
                {"$set": {"sent": True, "sent_at": now.isoformat(), "skipped": "stale"}},
            )
            continue

        data = _payload_for(task["category"], task.get("key"), task.get("minutes"))

        # Log to feed regardless of delivery result
        feed_doc = {
            "user_id": uid,
            "category": task["category"],
            "key": task.get("key"),
            "title": data.get("title", ""),
            "message": data.get("message", ""),
            "action_url": data.get("action_url"),
            "sent_at": now.isoformat(),
            "delivery": "unknown",
        }

        try:
            feed_doc["delivery"] = await fcm.send_to_user(uid, data)
        except Exception as e:
            feed_doc["delivery"] = f"error({type(e).__name__})"

        await _db.notifications_feed.insert_one(dict(feed_doc))
        await _db.notif_queue.update_one(
            {"user_id": uid, "date": task["date"], "category": task["category"], "key": task.get("key")},
            {"$set": {"sent": True, "sent_at": now.isoformat()}},
        )


def start_scheduler(db) -> AsyncIOScheduler:
    """Called from server startup. Idempotent."""
    global _scheduler, _db
    if _scheduler is not None:
        return _scheduler
    _db = db
    sched = AsyncIOScheduler(timezone="UTC")
    # Plan build runs hourly so each user's local-midnight rollover is picked up
    # within the hour (the build is idempotent and keyed by local date). Dispatch
    # checks every minute for due sends.
    sched.add_job(_build_daily_plan, "cron", minute=5, id="plan-hourly")
    sched.add_job(_dispatch_due, "interval", minutes=1, id="dispatch")
    sched.start()
    # Build once on boot so even fresh installs get today's plan
    asyncio.create_task(_build_daily_plan())
    logger.info("Nabah scheduler: started (plan-hourly + dispatch every 1min).")
    _scheduler = sched
    return sched


def shutdown_scheduler():
    global _scheduler
    if _scheduler is not None:
        try:
            _scheduler.shutdown(wait=False)
        except Exception:
            pass
        _scheduler = None
