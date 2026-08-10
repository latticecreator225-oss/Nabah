"""
Nabah · Offline prayer-time engine

Computes prayer times locally (adhanpy — a port of the Batoul Apps Adhan
library) instead of calling aladhan.com at runtime. Fully offline and
deterministic; the aladhan HTTP call survives only as a fallback in the router.

Method IDs remain aladhan's (see prayer_methods.py) so the app contract does
not change. Methods adhanpy ships natively are mapped directly; the rest are
expressed as custom fajr/isha parameters using the authorities' published
angles. Maghrib = sunset (standard Sunni convention) throughout.
"""
from datetime import datetime, date as date_t
from typing import Dict, Optional
from zoneinfo import ZoneInfo

from adhanpy.PrayerTimes import PrayerTimes
from adhanpy.calculation.CalculationMethod import CalculationMethod
from adhanpy.calculation.CalculationParameters import CalculationParameters
from adhanpy.calculation.HighLatitudeRule import HighLatitudeRule
from adhanpy.calculation.Madhab import Madhab

# Beyond the polar circles the sun may not cross the horizon (or the twilight
# angle) at all, so the astronomical solution is undefined and adhanpy raises.
# The accepted jurisprudential workaround is "Aqrab al-Bilād" (nearest
# latitude): compute the times as if the observer were at a temperate latitude,
# keeping their real longitude and timezone. 48° is the conventional cut-off.
_NEAREST_LATITUDE = 48.0

# aladhan method id → adhanpy built-in method
_BUILTIN = {
    1: CalculationMethod.KARACHI,
    2: CalculationMethod.NORTH_AMERICA,
    3: CalculationMethod.MUSLIM_WORLD_LEAGUE,
    4: CalculationMethod.UMM_AL_QURA,
    5: CalculationMethod.EGYPTIAN,
    9: CalculationMethod.KUWAIT,
    10: CalculationMethod.QATAR,
    11: CalculationMethod.SINGAPORE,
    12: CalculationMethod.UOIF,
    15: CalculationMethod.MOON_SIGHTING_COMMITTEE,
    16: CalculationMethod.DUBAI,
}

# aladhan method id → (fajr_angle, isha_angle, isha_interval_minutes)
# for authorities adhanpy has no enum for; angles per aladhan's method docs.
_CUSTOM = {
    7:  (17.7, 14.0, None),   # Tehran (Inst. of Geophysics)
    8:  (19.5, None, 90),     # Gulf Region (isha = maghrib + 90 min)
    13: (18.0, 17.0, None),   # Turkey (Diyanet)
    14: (16.0, 15.0, None),   # Russia
    17: (20.0, 18.0, None),   # Malaysia (JAKIM)
    18: (18.0, 18.0, None),   # Tunisia
    19: (18.0, 17.0, None),   # Algeria
    20: (20.0, 18.0, None),   # Indonesia (Kemenag)
    21: (19.0, 17.0, None),   # Morocco
    22: (18.0, None, 77),     # Portugal (Lisboa; isha = maghrib + 77 min)
    23: (18.0, 18.0, None),   # Jordan Awqaf
}


def _params_for(method_id: int, school: int) -> CalculationParameters:
    if method_id in _BUILTIN:
        params = CalculationParameters(method=_BUILTIN[method_id])
    elif method_id in _CUSTOM:
        fajr, isha, interval = _CUSTOM[method_id]
        if interval is not None:
            params = CalculationParameters(fajr_angle=fajr, isha_interval=interval)
        else:
            params = CalculationParameters(fajr_angle=fajr, isha_angle=isha)
    else:  # unknown id → MWL, the accepted global default
        params = CalculationParameters(method=CalculationMethod.MUSLIM_WORLD_LEAGUE)
    params.madhab = Madhab.HANAFI if school == 1 else Madhab.SHAFI
    # Bound Fajr/Isha where the twilight angle is never reached in summer/winter.
    params.high_latitude_rule = HighLatitudeRule.SEVENTH_OF_THE_NIGHT
    return params


def _raw_times(lat: float, lng: float, day: date_t, tz: ZoneInfo,
               method_id: int, school: int) -> Dict[str, str]:
    pt = PrayerTimes(
        (lat, lng),
        datetime(day.year, day.month, day.day),
        calculation_parameters=_params_for(method_id, school),
    )

    def fmt(d) -> str:
        if d is None:
            raise ValueError("undefined prayer time")
        return d.astimezone(tz).strftime("%H:%M")

    return {
        "Fajr": fmt(pt.fajr),
        "Sunrise": fmt(pt.sunrise),
        "Dhuhr": fmt(pt.dhuhr),
        "Asr": fmt(pt.asr),
        "Sunset": fmt(pt.maghrib),
        "Maghrib": fmt(pt.maghrib),
        "Isha": fmt(pt.isha),
    }


def compute_times(
    lat: float,
    lng: float,
    day: date_t,
    tz: ZoneInfo,
    method_id: int,
    school: int = 0,
) -> Dict[str, str]:
    """Local prayer times for a calendar day, as {'Fajr': 'HH:MM', ...} in `tz`.

    Returns the same seven keys aladhan does (Sunset mirrors Maghrib). At
    extreme latitudes, where the sun may never rise/set or reach the twilight
    angle, the astronomical solution is undefined; rather than fail we recompute
    at the nearest temperate latitude (Aqrab al-Bilād) so the user always gets a
    usable, jurisprudentially-recognised time.
    """
    try:
        return _raw_times(lat, lng, day, tz, method_id, school)
    except Exception:
        if abs(lat) <= _NEAREST_LATITUDE:
            raise  # not a high-latitude problem — let the caller handle it
        fallback_lat = _NEAREST_LATITUDE if lat > 0 else -_NEAREST_LATITUDE
        return _raw_times(fallback_lat, lng, day, tz, method_id, school)


def safe_zone(tz_name: Optional[str], lng: float) -> ZoneInfo:
    """Resolve an IANA tz; if absent/invalid, approximate from longitude.

    The longitude fallback (UTC offset = round(lng/15)) ignores DST and
    political borders — callers should always try to send a real timezone.
    """
    if tz_name:
        try:
            return ZoneInfo(tz_name)
        except Exception:
            pass
    offset = max(-12, min(14, round(lng / 15.0)))
    sign = "-" if offset >= 0 else "+"  # Etc/GMT signs are inverted by design
    return ZoneInfo(f"Etc/GMT{sign}{abs(offset)}")
