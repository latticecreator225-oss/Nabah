"""
Nabah · Offline prayer-engine tests (no network).

Sanity-checks the local astronomical computation against known references and
verifies the method/madhab mapping behaves.
"""
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from prayer_engine import compute_times, safe_zone

MAKKAH = (21.4225, 39.8262)
DELHI = (28.6139, 77.2090)


def _mins(hhmm: str) -> int:
    h, m = map(int, hhmm.split(":"))
    return h * 60 + m


def test_makkah_matches_aladhan_reference():
    """aladhan (Umm al-Qura) returned Fajr 04:14 for Makkah on 2026-06-29."""
    t = compute_times(*MAKKAH, date(2026, 6, 29), ZoneInfo("Asia/Riyadh"), method_id=4)
    assert abs(_mins(t["Fajr"]) - _mins("04:14")) <= 3
    # Dhuhr near solar noon for Makkah (~12:24 AST in late June)
    assert abs(_mins(t["Dhuhr"]) - _mins("12:24")) <= 5


def test_all_seven_keys_present():
    t = compute_times(*MAKKAH, date(2026, 6, 29), ZoneInfo("Asia/Riyadh"), method_id=3)
    assert set(t) == {"Fajr", "Sunrise", "Dhuhr", "Asr", "Sunset", "Maghrib", "Isha"}
    assert t["Sunset"] == t["Maghrib"]


def test_hanafi_asr_is_later():
    tz = ZoneInfo("Asia/Kolkata")
    shafi = compute_times(*DELHI, date(2026, 6, 29), tz, method_id=1, school=0)
    hanafi = compute_times(*DELHI, date(2026, 6, 29), tz, method_id=1, school=1)
    assert _mins(hanafi["Asr"]) > _mins(shafi["Asr"])


def test_custom_angle_method_differs_from_mwl():
    """JAKIM (20°/18°) must produce a different Fajr than MWL (18°/17°)."""
    tz = ZoneInfo("Asia/Kuala_Lumpur")
    kl = (3.139, 101.687)
    jakim = compute_times(*kl, date(2026, 6, 29), tz, method_id=17)
    mwl = compute_times(*kl, date(2026, 6, 29), tz, method_id=3)
    assert jakim["Fajr"] != mwl["Fajr"]
    assert _mins(jakim["Fajr"]) < _mins(mwl["Fajr"])  # deeper angle → earlier


def test_interval_isha_gulf_is_maghrib_plus_90():
    tz = ZoneInfo("Asia/Dubai")
    t = compute_times(25.2, 55.3, date(2026, 6, 29), tz, method_id=8)
    assert (_mins(t["Isha"]) - _mins(t["Maghrib"])) % (24 * 60) == 90


def test_unknown_method_falls_back_to_mwl():
    tz = ZoneInfo("Asia/Riyadh")
    unknown = compute_times(*MAKKAH, date(2026, 6, 29), tz, method_id=999)
    mwl = compute_times(*MAKKAH, date(2026, 6, 29), tz, method_id=3)
    assert unknown == mwl


def test_safe_zone_prefers_iana_and_approximates_from_lng():
    assert safe_zone("Asia/Kolkata", 0).key == "Asia/Kolkata"
    z = safe_zone(None, 39.8)  # Makkah lng → ~UTC+3
    off = datetime(2026, 6, 29, tzinfo=z).utcoffset()
    assert off == timedelta(hours=3)
