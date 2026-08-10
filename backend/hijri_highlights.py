"""
Nabah · Hijri Highlights

Returns a contextually-rich "Daily Revival" highlight when the current
Hijri date corresponds to a sacred or recommended day. Poetic copy,
written in the same tone as the Notification Engine.

Order of precedence (only the highest-priority match wins):
  1. Laylat al-Qadr window (last 10 odd nights of Ramadan)
  2. First 9 of Dhul-Hijjah / Day of Arafah (9) / Eid al-Adha (10)
  3. Day of Ashura (10 Muharram) + Tasu'a (9 Muharram)
  4. White Days (13, 14, 15 of any Hijri month)
  5. Sha'ban 15 — Mid Sha'ban
  6. Friday (Jumu'ah) — weekly
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional, Dict, Any


def _white_days_payload(day: int) -> Dict[str, Any]:
    return {
        "id": "white_days",
        "rank": "MUSTAHABB",
        "title": "The White Days",
        "subtitle": f"The {day}th — أيام البيض",
        "ar": "أَيَّامُ الْبِيض",
        "body": (
            "The Prophet ﷺ never abandoned the fast of the 13th, 14th, and 15th — "
            "the nights of the full moon. A light fast for a heart drawn nearer."
        ),
        "source": "Sunan an-Nasa'i 2424",
        "cta": "Mark the fast",
    }


def hijri_highlight(hijri_day: int, hijri_month: int, gregorian_weekday: int) -> Optional[Dict[str, Any]]:
    """
    hijri_month: 1=Muharram, 2=Safar, 3=Rabi al-Awwal, 4=Rabi al-Thani,
                 5=Jumada al-Awwal, 6=Jumada al-Thani, 7=Rajab, 8=Sha'ban,
                 9=Ramadan, 10=Shawwal, 11=Dhul-Qa'dah, 12=Dhul-Hijjah.
    gregorian_weekday: Python weekday() — Monday=0 ... Sunday=6. Friday=4.
    """
    # 1. Laylat al-Qadr window — last 10 nights of Ramadan, especially odd
    if hijri_month == 9 and hijri_day >= 21:
        is_odd = hijri_day % 2 == 1
        return {
            "id": "laylat_al_qadr",
            "rank": "GREATEST OF NIGHTS" if is_odd else "LAST TEN",
            "title": "Seek the Night of Power" if is_odd else "The Last Ten",
            "subtitle": f"Ramadan {hijri_day} — ليلة القدر",
            "ar": "لَيْلَةُ ٱلْقَدْر",
            "body": (
                "Better than a thousand months. Tonight could be the night the "
                "angels descend — every decree carried in their hands."
                if is_odd else
                "The Prophet ﷺ would seek it in the odd nights. Be awake. "
                "Be quiet. Be insistent."
            ),
            "source": "Surah al-Qadr · القدر",
            "cta": "Begin qiyam",
        }

    # 2. Dhul-Hijjah — first 10 days
    if hijri_month == 12 and 1 <= hijri_day <= 10:
        if hijri_day == 9:
            return {
                "id": "arafah",
                "rank": "DAY OF ARAFAH",
                "title": "The Day He Forgives",
                "subtitle": "9 Dhul-Hijjah — عرفة",
                "ar": "يَوْمُ عَرَفَة",
                "body": (
                    "He boasts about the people of Arafah to His angels. "
                    "Fast today — the sins of the year past and the year to come are wiped clean."
                ),
                "source": "Sahih Muslim 1162",
                "cta": "Renew the fast",
            }
        if hijri_day == 10:
            return {
                "id": "eid_adha",
                "rank": "EID",
                "title": "Eid al-Adha · عيد الأضحى",
                "subtitle": "The Feast of Sacrifice",
                "ar": "عِيدُ ٱلْأَضْحَى",
                "body": (
                    "Allahu Akbar, Allahu Akbar, lā ilāha illā Allah. "
                    "Take the path to prayer one way, and return another — as he ﷺ did."
                ),
                "source": "Sahih al-Bukhari 986",
                "cta": "Takbir",
            }
        return {
            "id": "dhul_hijjah_ten",
            "rank": "THE BEST DAYS",
            "title": "No days are dearer to Him",
            "subtitle": f"{hijri_day} Dhul-Hijjah — العشر",
            "ar": "ٱلْعَشْرُ مِنْ ذِي ٱلْحِجَّة",
            "body": (
                "“There are no days in which righteous deeds are more beloved to Allah "
                "than these ten.” Multiply takbir, sadaqah, and fasting today."
            ),
            "source": "Sahih al-Bukhari 969",
            "cta": "Multiply your dhikr",
        }

    # 3. Ashura (Muharram)
    if hijri_month == 1:
        if hijri_day == 10:
            return {
                "id": "ashura",
                "rank": "DAY OF ASHURA",
                "title": "The fast Moses kept",
                "subtitle": "10 Muharram — عاشوراء",
                "ar": "يَوْمُ عَاشُورَاء",
                "body": (
                    "The Prophet ﷺ said: it expiates the sins of the year past. "
                    "Fast today — and if you can, fast tomorrow with it, to differ from the people of the Book."
                ),
                "source": "Sahih Muslim 1162",
                "cta": "Mark the fast",
            }
        if hijri_day == 9:
            return {
                "id": "tasua",
                "rank": "TASU'A — THE EVE",
                "title": "Tomorrow, the fast of Moses",
                "subtitle": "9 Muharram — تاسوعاء",
                "ar": "تَاسُوعَاء",
                "body": (
                    "Pair tomorrow's fast with today's — the Prophet ﷺ intended to do so "
                    "had he lived to see the next year."
                ),
                "source": "Sahih Muslim 1134",
                "cta": "Prepare to fast",
            }
        if hijri_day == 11:
            return {
                "id": "ashura_after",
                "rank": "DAY AFTER",
                "title": "One more, to keep the gift",
                "subtitle": "11 Muharram",
                "ar": "ٱلْحَادِي عَشَر",
                "body": (
                    "Some scholars hold that fasting the day after Ashura completes the pairing. "
                    "Either way — the door is still open."
                ),
                "source": "Ahmad",
                "cta": "Optional fast",
            }

    # 4. Mid Sha'ban
    if hijri_month == 8 and hijri_day == 15:
        return {
            "id": "mid_shaban",
            "rank": "MID-SHA'BAN",
            "title": "The deeds are raised",
            "subtitle": "15 Sha'ban — ليلة النصف من شعبان",
            "ar": "نِصْفُ شَعْبَان",
            "body": (
                "“Sha'ban is the month in which deeds are raised to the Lord of the worlds — "
                "and I love that my deeds be raised while I am fasting.” — Prophet ﷺ"
            ),
            "source": "Sunan an-Nasa'i 2357",
            "cta": "Fast tomorrow",
        }

    # 5. White Days — any month
    if hijri_day in (13, 14, 15):
        return _white_days_payload(hijri_day)

    # 6. Friday — weekly highlight
    if gregorian_weekday == 4:  # Friday
        return {
            "id": "jumuah",
            "rank": "JUMU'AH",
            "title": "The best of days",
            "subtitle": "Friday — يوم الجمعة",
            "ar": "يَوْمُ ٱلْجُمُعَة",
            "body": (
                "Read Surah al-Kahf. Send abundant salawat upon the Prophet ﷺ. "
                "There is an hour in this day when no servant asks for good but receives it."
            ),
            "source": "Sahih Muslim 854",
            "cta": "Begin Surah al-Kahf",
        }

    return None


# Helper: convert month name (en) back to month index
HIJRI_MONTH_INDEX = {
    "Muharram": 1, "Safar": 2, "Rabi al-Awwal": 3, "Rabi' al-awwal": 3,
    "Rabi al-Thani": 4, "Rabi' al-thani": 4,
    "Jumada al-Awwal": 5, "Jumada al-awwal": 5,
    "Jumada al-Thani": 6, "Jumada al-thani": 6,
    "Rajab": 7, "Sha'ban": 8, "Shaban": 8,
    "Ramadan": 9, "Shawwal": 10,
    "Dhul-Qa'dah": 11, "Dhul-Qadah": 11, "Dhu al-Qa'dah": 11,
    "Dhul-Hijjah": 12, "Dhu al-Hijjah": 12,
}
