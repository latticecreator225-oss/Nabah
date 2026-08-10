"""
Nabah · Scheduler unit tests.

These cover the reminder engine's most error-prone logic — timezone handling and
daily plan generation — WITHOUT a live server or database. `_day_times` is
stubbed so the tests are deterministic and offline.

Run from the backend/ directory:
    pytest tests/test_scheduler.py
"""
import asyncio
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import scheduler

# Fixed prayer times (local clock for the user's coordinates), as aladhan returns.
FAKE_TIMES = {
    "Fajr": "04:30",
    "Sunrise": "05:50",
    "Dhuhr": "12:15",
    "Asr": "15:45",
    "Maghrib": "19:05",
    "Isha": "20:30",
}


async def _fake_times(lat, lng, date):  # signature matches scheduler._day_times
    return dict(FAKE_TIMES)


def _compute(prefs, when_local, lat=28.61, lng=77.20):
    return asyncio.run(scheduler._compute_plan("u1", prefs, lat, lng, when_local))


# ─────────────────────────── _safe_zone ───────────────────────────
def test_safe_zone_valid():
    assert scheduler._safe_zone("Asia/Kolkata").key == "Asia/Kolkata"


def test_safe_zone_none_falls_back_to_utc():
    assert scheduler._safe_zone(None).key == "UTC"


def test_safe_zone_invalid_falls_back_to_utc():
    assert scheduler._safe_zone("Not/ARealZone").key == "UTC"


# ─────────────────────────── _hhmm_to_dt ───────────────────────────
def test_hhmm_to_dt_keeps_timezone():
    base = datetime(2026, 6, 25, 9, 0, tzinfo=ZoneInfo("UTC"))
    d = scheduler._hhmm_to_dt(base, "05:30")
    assert (d.hour, d.minute) == (5, 30)
    assert d.tzinfo is base.tzinfo


# ─────────────────── timezone-aware plan generation ───────────────────
def test_compute_plan_localizes_to_user_timezone(monkeypatch):
    """A "12:15" Dhuhr in Asia/Kolkata (UTC+5:30) must store as 06:45 UTC."""
    monkeypatch.setattr(scheduler, "_day_times", _fake_times)
    tz = ZoneInfo("Asia/Kolkata")
    when_local = datetime(2026, 6, 25, 9, 0, tzinfo=tz)

    plan = _compute({}, when_local)
    dhuhr = next(t for t in plan if t["category"] == "fard" and t["key"] == "Dhuhr")

    # scheduled_at must remain tz-aware and carry the user's offset.
    assert dhuhr["scheduled_at"].utcoffset() == timedelta(hours=5, minutes=30)
    utc = dhuhr["scheduled_at"].astimezone(timezone.utc)
    assert (utc.hour, utc.minute) == (6, 45)


def test_same_local_time_differs_by_timezone(monkeypatch):
    """Identical local prayer times in two zones must NOT collapse to one UTC instant."""
    monkeypatch.setattr(scheduler, "_day_times", _fake_times)
    kolkata = _compute({}, datetime(2026, 6, 25, 9, 0, tzinfo=ZoneInfo("Asia/Kolkata")))
    london = _compute({}, datetime(2026, 6, 25, 9, 0, tzinfo=ZoneInfo("Europe/London")))

    k_dhuhr = next(t for t in kolkata if t["key"] == "Dhuhr")["scheduled_at"].astimezone(timezone.utc)
    l_dhuhr = next(t for t in london if t["key"] == "Dhuhr")["scheduled_at"].astimezone(timezone.utc)
    # London is BST (+1) in June, Kolkata is +5:30 → 4.5h apart.
    assert (l_dhuhr - k_dhuhr) == timedelta(hours=4, minutes=30)


def test_compute_plan_default_categories(monkeypatch):
    monkeypatch.setattr(scheduler, "_day_times", _fake_times)
    tz = ZoneInfo("Asia/Kolkata")
    plan = _compute({}, datetime(2026, 6, 25, 9, 0, tzinfo=tz))

    fard = {t["key"] for t in plan if t["category"] == "fard"}
    assert fard == {"Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"}
    # default prefs: 3 adhkar windows, no pre-adhan (0 min), no tahajjud (off).
    assert {t["key"] for t in plan if t["category"] == "adhkar"} == {"morning", "evening", "sleep"}
    assert not any(t["category"] == "pre_adhan" for t in plan)
    assert not any(t["category"] == "tahajjud" for t in plan)


def test_disabled_pref_drops_task(monkeypatch):
    monkeypatch.setattr(scheduler, "_day_times", _fake_times)
    tz = ZoneInfo("Asia/Kolkata")
    plan = _compute({"prayer_fajr": False}, datetime(2026, 6, 25, 9, 0, tzinfo=tz))
    assert not any(t["category"] == "fard" and t["key"] == "Fajr" for t in plan)
    # other prayers remain
    assert any(t["category"] == "fard" and t["key"] == "Dhuhr" for t in plan)


def test_pre_adhan_offset(monkeypatch):
    monkeypatch.setattr(scheduler, "_day_times", _fake_times)
    tz = ZoneInfo("Asia/Kolkata")
    plan = _compute({"pre_adhan_minutes": 15}, datetime(2026, 6, 25, 9, 0, tzinfo=tz))

    dhuhr = next(t for t in plan if t["category"] == "fard" and t["key"] == "Dhuhr")
    pre = next(t for t in plan if t["category"] == "pre_adhan" and t["key"] == "Dhuhr")
    assert dhuhr["scheduled_at"] - pre["scheduled_at"] == timedelta(minutes=15)


def test_tahajjud_last_third(monkeypatch):
    """Isha 20:30 → next Fajr 04:30 is an 8h night; last third starts at 01:50 local."""
    monkeypatch.setattr(scheduler, "_day_times", _fake_times)
    tz = ZoneInfo("Asia/Kolkata")
    plan = _compute({"tahajjud": True}, datetime(2026, 6, 25, 9, 0, tzinfo=tz))

    tah = next(t for t in plan if t["category"] == "tahajjud")
    local = tah["scheduled_at"].astimezone(tz)
    assert (local.month, local.day) == (6, 26)  # spills into the next morning
    assert (local.hour, local.minute) == (1, 50)


# ─────────────────── sacred observances ───────────────────
_TZ = ZoneInfo("Asia/Kolkata")


def _obs(prefs, dt, times=None):
    return {t["key"] for t in scheduler._observance_tasks(prefs, dt, times)}


def _next_weekday(dt, wd):
    while dt.weekday() != wd:
        dt = dt + timedelta(days=1)
    return dt


def test_surah_mulk_is_nightly():
    keys = _obs({}, datetime(2026, 6, 28, 9, 0, tzinfo=_TZ))
    assert "surah_mulk" in keys


def test_surah_kahf_only_on_friday():
    friday = _next_weekday(datetime(2026, 6, 28, 9, 0, tzinfo=_TZ), 4)
    monday = _next_weekday(datetime(2026, 6, 28, 9, 0, tzinfo=_TZ), 0)
    assert "surah_kahf" in _obs({}, friday)
    assert "surah_kahf" not in _obs({}, monday)


def test_jumuah_hour_only_on_friday():
    times = {"Asr": "16:00", "Maghrib": "18:40"}
    friday = _next_weekday(datetime(2026, 6, 28, 9, 0, tzinfo=_TZ), 4)
    thursday = _next_weekday(datetime(2026, 6, 28, 9, 0, tzinfo=_TZ), 3)
    assert "jumuah_hour" in _obs({}, friday, times)
    assert "jumuah_hour" not in _obs({}, thursday, times)


def test_jumuah_hour_starts_one_hour_before_maghrib():
    friday = _next_weekday(datetime(2026, 6, 28, 9, 0, tzinfo=_TZ), 4)
    tasks = scheduler._observance_tasks({}, friday, {"Asr": "16:00", "Maghrib": "18:40"})
    hour = next(t for t in tasks if t["key"] == "jumuah_hour")
    assert (hour["scheduled_at"].hour, hour["scheduled_at"].minute) == (17, 40)
    assert hour["scheduled_at"].utcoffset() == timedelta(hours=5, minutes=30)


def test_jumuah_hour_never_precedes_asr():
    # A compressed ʿAsr→Maghrib gap (35 min) must clamp the reminder to ʿAsr
    # rather than announcing the window before it has begun.
    friday = _next_weekday(datetime(2026, 6, 28, 9, 0, tzinfo=_TZ), 4)
    tasks = scheduler._observance_tasks({}, friday, {"Asr": "18:05", "Maghrib": "18:40"})
    hour = next(t for t in tasks if t["key"] == "jumuah_hour")
    assert (hour["scheduled_at"].hour, hour["scheduled_at"].minute) == (18, 5)


def test_jumuah_hour_skipped_without_times():
    friday = _next_weekday(datetime(2026, 6, 28, 9, 0, tzinfo=_TZ), 4)
    assert "jumuah_hour" not in _obs({}, friday)
    assert "surah_kahf" in _obs({}, friday)  # calendar observances still schedule


def test_jumuah_hour_can_be_disabled():
    times = {"Asr": "16:00", "Maghrib": "18:40"}
    friday = _next_weekday(datetime(2026, 6, 28, 9, 0, tzinfo=_TZ), 4)
    assert "jumuah_hour" not in _obs({"reminder_jumuah_hour": False}, friday, times)


def test_ayyamul_bidh_on_white_day_eve():
    # 2026-06-28 is Hijri Muharram 13 — within the white-day reminder window.
    keys = _obs({}, datetime(2026, 6, 28, 9, 0, tzinfo=_TZ))
    assert "ayyamul_bidh" in keys


def test_mon_thu_off_by_default():
    sunday = _next_weekday(datetime(2026, 6, 28, 9, 0, tzinfo=_TZ), 6)
    assert "fast_mon_thu" not in _obs({}, sunday)               # default False
    assert "fast_mon_thu" in _obs({"reminder_mon_thu": True}, sunday)


def test_observance_can_be_disabled():
    keys = _obs({"reminder_surah_mulk": False}, datetime(2026, 6, 28, 9, 0, tzinfo=_TZ))
    assert "surah_mulk" not in keys


def test_eid_fitr_on_first_of_shawwal():
    from hijridate import Hijri
    g = Hijri(1448, 10, 1).to_gregorian()  # 1 Shawwal
    keys = _obs({}, datetime(g.year, g.month, g.day, 9, 0, tzinfo=_TZ))
    assert "eid_fitr" in keys


def test_observance_scheduled_at_is_local_tzaware():
    tasks = scheduler._observance_tasks({}, datetime(2026, 6, 28, 9, 0, tzinfo=_TZ))
    mulk = next(t for t in tasks if t["key"] == "surah_mulk")
    # 21:30 local, tz-aware
    assert mulk["scheduled_at"].utcoffset() == timedelta(hours=5, minutes=30)
    assert (mulk["scheduled_at"].hour, mulk["scheduled_at"].minute) == (21, 30)
