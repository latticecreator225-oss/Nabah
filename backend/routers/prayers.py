from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException

from deps import logger
from hijri_highlights import hijri_highlight, HIJRI_MONTH_INDEX
from prayer_methods import pick_method, METHOD_NAMES
from prayer_engine import compute_times, safe_zone

try:
    from hijridate import Gregorian
except Exception:  # pragma: no cover
    Gregorian = None  # type: ignore

router = APIRouter(prefix="/api", tags=["prayers"])


def _local_hijri(day: date) -> dict:
    """aladhan-shaped hijri block computed locally (Umm al-Qura)."""
    if Gregorian is None:
        return {}
    try:
        h = Gregorian(day.year, day.month, day.day).to_hijri()
        return {
            "hijri": {
                "day": str(h.day),
                "year": str(h.year),
                "month": {"number": h.month, "en": h.month_name("en")},
            }
        }
    except Exception:
        return {}


@router.get("/hijri-date")
async def hijri_date():
    try:
        import requests
        today = date.today().strftime("%d-%m-%Y")
        r = requests.get(f"https://api.aladhan.com/v1/gToH/{today}", timeout=10)
        r.raise_for_status()
        data = r.json().get("data", {}).get("hijri", {})
        return {
            "day": data.get("day"),
            "month_en": data.get("month", {}).get("en"),
            "month_ar": data.get("month", {}).get("ar"),
            "year": data.get("year"),
            "weekday_en": data.get("weekday", {}).get("en"),
            "formatted": f"{data.get('day')} {data.get('month', {}).get('en')} {data.get('year')}",
        }
    except Exception as e:
        logger.warning(f"Hijri date fetch failed: {e}")
        return {"day": "", "month_en": "", "year": "", "formatted": ""}


@router.get("/hijri-highlight")
async def hijri_highlight_endpoint(month: Optional[int] = None, day: Optional[int] = None):
    weekday = datetime.now(timezone.utc).weekday()
    h_day: Optional[int] = day
    h_month: Optional[int] = month

    if h_day is None or h_month is None:
        try:
            import requests
            today_str = date.today().strftime("%d-%m-%Y")
            r = requests.get(f"https://api.aladhan.com/v1/gToH/{today_str}", timeout=8)
            r.raise_for_status()
            hijri = r.json().get("data", {}).get("hijri", {})
            h_day = int(hijri.get("day", 0))
            month_en = hijri.get("month", {}).get("en", "")
            h_month = (
                hijri.get("month", {}).get("number")
                or HIJRI_MONTH_INDEX.get(month_en, 0)
            )
        except Exception as e:
            logger.warning(f"hijri-highlight: hijri lookup failed: {e}")
            return {"highlight": None}

    if not h_day or not h_month:
        return {"highlight": None}

    payload = hijri_highlight(int(h_day), int(h_month), weekday)
    return {"highlight": payload, "hijri_day": h_day, "hijri_month": h_month}


@router.get("/prayer-times")
async def prayer_times(
    lat: float,
    lng: float,
    method: Optional[int] = None,
    school: int = 0,
    date_str: Optional[str] = None,
    tz: Optional[str] = None,
):
    """Prayer times, computed locally (offline astronomical engine).

    `tz` is the caller's IANA timezone (the device is at the location, so its
    zone is correct). Without it we approximate from longitude. aladhan.com is
    only used as a last-resort fallback if local computation fails.
    """
    if method is None:
        method, method_name = pick_method(lat, lng)
    else:
        method_name = METHOD_NAMES.get(method, f"Method {method}")

    if date_str:
        try:
            day = datetime.strptime(date_str, "%d-%m-%Y").date()
        except ValueError:
            day = date.today()
    else:
        day = date.today()

    try:
        timings = compute_times(lat, lng, day, safe_zone(tz, lng), method, school)
        return {
            "timings": timings,
            "date": _local_hijri(day),
            "method": method,
            "method_name": method_name,
            "school": school,
        }
    except Exception as e:
        logger.warning(f"local prayer computation failed, trying aladhan: {e}")

    # Fallback: the old aladhan proxy path.
    try:
        import requests
        r = requests.get(
            f"https://api.aladhan.com/v1/timings/{day.strftime('%d-%m-%Y')}",
            params={"latitude": lat, "longitude": lng, "method": method, "school": school},
            timeout=8,
        )
        r.raise_for_status()
        data = r.json().get("data", {})
        return {
            "timings": data.get("timings", {}),
            "date": data.get("date", {}),
            "method": method,
            "method_name": method_name,
            "school": school,
        }
    except Exception as e:
        logger.warning(f"prayer-times fetch failed: {e}")
        raise HTTPException(502, "Could not fetch prayer times")
