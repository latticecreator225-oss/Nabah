"""
Nabah · Rhythms & Reminders — Notification Engine

Poetic, time-anchored push payload templates for the five categories:
  1. Fard (the five prayers)
  2. Pre-Adhan nudge
  3. Adhkar at honoured hours (morning / evening / sleep)
  4. The Night Vigil (Tahajjud — last third)
  5. Contextual Sunnahs

Each payload is a flat dict delivered as an FCM message (notification + data):
  { title: str, message: str, action_url: str (deeplink), subtext?: str }

The title is the call. The body is the breath. Never preachy, never an emoji.
"""
from __future__ import annotations
import random
from typing import Dict, List, Optional


# ─────────────────────────── 1. FARD ─────────────────────────────
FARD_PAYLOADS: Dict[str, List[Dict[str, str]]] = {
    "Fajr": [
        {
            "title": "Fajr · فجر",
            "message": "The first whisper of dawn. Stand, while the world is still asleep.",
            "subtext": "Allah is closest to you now.",
        },
        {
            "title": "Fajr · فجر",
            "message": "A line of light along the sky. Meet Him before the day claims you.",
            "subtext": "Two rak'ah of Sunnah are dearer to Him than the world.",
        },
        {
            "title": "Fajr · فجر",
            "message": "The angels of the night are still in your house. Pray, and they will witness.",
        },
    ],
    "Dhuhr": [
        {
            "title": "Dhuhr · ظهر",
            "message": "The sun has reached its summit. Pause — set down what you are carrying.",
        },
        {
            "title": "Dhuhr · ظهر",
            "message": "Mid-day. The doors of the heavens open. A small turning of the heart suffices.",
        },
        {
            "title": "Dhuhr · ظهر",
            "message": "A few minutes is all He asks. Return, and He returns more.",
        },
    ],
    "Asr": [
        {
            "title": "Asr · عصر",
            "message": "The shadow lengthens. Do not let this prayer slip — it is the middle one.",
            "subtext": "“Whoever misses ʿAsr, it is as if he lost his family and wealth.” — Bukhari & Muslim",
        },
        {
            "title": "Asr · عصر",
            "message": "The afternoon is the test of the steadfast. Stand for Him while others are tired.",
        },
        {
            "title": "Asr · عصر",
            "message": "Half the day behind you. He sees that you are still walking.",
        },
    ],
    "Maghrib": [
        {
            "title": "Maghrib · مغرب",
            "message": "The first star. The breaking fast. The horizon softens — and so should your heart.",
        },
        {
            "title": "Maghrib · مغرب",
            "message": "Sunset is brief. So is the chance. Hurry — He waits at this door only a moment.",
        },
        {
            "title": "Maghrib · مغرب",
            "message": "The day folds itself away. Place its weight at His feet, not yours.",
        },
    ],
    "Isha": [
        {
            "title": "Isha · عشاء",
            "message": "The night has fallen. Let the last words of your day be His.",
        },
        {
            "title": "Isha · عشاء",
            "message": "The hush before sleep. Stand once more — He is closer than the silence.",
        },
        {
            "title": "Isha · عشاء",
            "message": "Lock the day with the seal of remembrance. The night is His to give.",
        },
    ],
}


# ─────────────────────────── 2. PRE-ADHAN NUDGE ─────────────────────
PRE_ADHAN_PAYLOADS: List[Dict[str, str]] = [
    {
        "title": "{prayer} approaches",
        "message": "{minutes} minutes. A breath of wudu, a quieting of the room.",
    },
    {
        "title": "{prayer} · {minutes} min",
        "message": "Begin to soften. The adhan is on its way.",
    },
    {
        "title": "Soon · {prayer}",
        "message": "A small turning — set down the screen, let the heart prepare.",
    },
]


# ─────────────────────────── 3. ADHKAR ─────────────────────
ADHKAR_PAYLOADS: Dict[str, List[Dict[str, str]]] = {
    "morning": [
        {
            "title": "Morning Adhkar · أذكار الصباح",
            "message": "Open the day the way the Prophet ﷺ did — with the names of the One who carries it.",
        },
        {
            "title": "Morning Adhkar",
            "message": "The fortress is built once each dawn. Will you set its stones?",
        },
        {
            "title": "Ṣabāḥ · صباح",
            "message": "Begin in His remembrance, and the unseen will tend the rest.",
        },
    ],
    "evening": [
        {
            "title": "Evening Adhkar · أذكار المساء",
            "message": "The shadows lengthen. Seal the day in the words that protect.",
        },
        {
            "title": "Evening Adhkar",
            "message": "Before the lamps are lit, light the heart. The fortress stands again.",
        },
        {
            "title": "Masāʾ · مساء",
            "message": "He kept you through the day. Thank Him in the manner He taught.",
        },
    ],
    "sleep": [
        {
            "title": "Before sleep · قبل النوم",
            "message": "Lay down on the right side. The last words are His name, and the soul is in His hand.",
        },
        {
            "title": "The Soul in His Hand",
            "message": "If you wake — to Him is the return. If you sleep — His protection is enough.",
        },
        {
            "title": "Sleep Adhkar",
            "message": "Three short surahs into your palms. Pass them over your body. He keeps the night.",
        },
    ],
}


# ─────────────────────────── 4. TAHAJJUD — THE NIGHT VIGIL ─────────────────────
TAHAJJUD_PAYLOADS: List[Dict[str, str]] = [
    {
        "title": "The night is still",
        "message": "The time for Tahajjud has entered. He descends now and asks: who will call upon Me?",
        "subtext": "The last third of the night — قيام الليل",
    },
    {
        "title": "Qiyām al-Layl · قيام الليل",
        "message": "Two rak'ah in the dark are heavier than the world. Rise — He is waiting.",
    },
    {
        "title": "He descends · ينزل ربنا",
        "message": "The quietest hour. The conversation He initiates. Will you answer?",
    },
    {
        "title": "The Last Third",
        "message": "What you cannot ask in daylight, ask now. He turns no one away at this hour.",
    },
    {
        "title": "Tahajjud",
        "message": "The world sleeps. Heaven leans low. Stand, even for a moment — He records it.",
    },
]


# ─────────────────────────── 5. CONTEXTUAL SUNNAHS ─────────────────────
CONTEXTUAL_SUNNAH_PAYLOADS: Dict[str, List[Dict[str, str]]] = {
    "household": [
        {
            "title": "Entering home",
            "message": "Say Bismillah at the threshold. The whispered enemy is turned away from your dwelling.",
        },
        {
            "title": "At the table",
            "message": "Begin in His name. Eat with the right hand. Eat what is near to you — a forgotten gentleness.",
        },
        {
            "title": "Guests in the house",
            "message": "Hospitality is from the Sunnah. A smile, a small thing offered — these are heavy on the scale.",
        },
        {
            "title": "When you return",
            "message": "Greet those at home — even if the house is empty, say salām. Mercy descends with the word.",
        },
    ],
    "public": [
        {
            "title": "The greeting",
            "message": "Be the first to say salām. The Prophet ﷺ said: the closer one to Allah is the first to greet.",
        },
        {
            "title": "The lowered gaze",
            "message": "What the eye does not seize, the heart does not chase. Guard the glance — He guards more.",
        },
        {
            "title": "A small charity",
            "message": "Even half a date. Even a kind word. The Sunnah is not in the size — it is in the giving.",
        },
        {
            "title": "Speech",
            "message": "The Prophet ﷺ said: let one who believes in Allah and the Last Day speak good — or be silent.",
        },
    ],
    "work": [
        {
            "title": "Before you begin",
            "message": "Bismillah. Then ihsan — work as though you see Him, for if you do not, He sees you.",
        },
        {
            "title": "The intention",
            "message": "Renew the niyyah. A task done for His sake becomes worship. A task for the self stays small.",
        },
        {
            "title": "When the task is hard",
            "message": "Ḥasbunallāhu wa niʿma al-wakīl. He is enough — and the most excellent guardian.",
        },
        {
            "title": "When the task is done",
            "message": "Alḥamdulillāh. The mind tires; gratitude restores it.",
        },
    ],
}


# ─────────────────── 6. SACRED OBSERVANCES ──────────────────────
# Calendar-anchored reminders: weekly recitations, the white-day & sunnah fasts,
# Arafah, ʿAshura, and the two Eids. One template each — these are occasional.
OBSERVANCE_PAYLOADS: Dict[str, Dict[str, str]] = {
    "surah_mulk": {
        "title": "Sūrat al-Mulk · تبارك",
        "message": "Before you sleep, let the Mulk be recited — it pleads for its companion until they are forgiven.",
        "action_url": "nabah:///home?open=quran&surah=67",
    },
    "surah_kahf": {
        "title": "Sūrat al-Kahf · الجمعة",
        "message": "It is Jumuʿah. Read al-Kahf — a light kindled for you between this Friday and the next.",
        "action_url": "nabah:///home?open=quran&surah=18",
    },
    "jumuah_hour": {
        "title": "The Hour of Response · ساعة الإجابة",
        "message": "The last hour of Jumuʿah has begun — an hour in which no servant asks Allah for something except that He gives it to him. Ask Him now.",
        "action_url": "nabah:///home?open=duas",
    },
    "ayyamul_bidh": {
        "title": "The White Days · الأيام البيض",
        "message": "Tomorrow is one of the white days. Intend to fast — the Prophet ﷺ would never leave them.",
        "action_url": "nabah:///home?open=prayers",
    },
    "fast_mon_thu": {
        "title": "A day He fasted",
        "message": "Tomorrow the deeds are raised. Fast as the Prophet ﷺ did on Mondays and Thursdays.",
        "action_url": "nabah:///home?open=prayers",
    },
    "arafah": {
        "title": "The Day of Arafah · عرفة",
        "message": "Tomorrow is Arafah. For the one not on Hajj, fasting it erases the year before and the year after.",
        "action_url": "nabah:///home?open=prayers",
    },
    "ashura": {
        "title": "ʿĀshūrāʾ · عاشوراء",
        "message": "Fast the 9th and 10th of Muharram — the Day of ʿAshura expiates the year that passed.",
        "action_url": "nabah:///home?open=prayers",
    },
    "eid_fitr": {
        "title": "Eid al-Fitr · عيد الفطر",
        "message": "Eid Mubarak. The takbir, the ghusl, a sweet before the prayer — and gratitude for a month of fasting.",
        "action_url": "nabah:///home?open=prayers",
    },
    "eid_adha": {
        "title": "Eid al-Adha · عيد الأضحى",
        "message": "Eid Mubarak. The greatest of days — the takbir, the prayer, and the sacrifice that draws you near.",
        "action_url": "nabah:///home?open=prayers",
    },
}


# ─────────────────── HELPER: pick a payload ──────────────────────
def observance_payload(key: str) -> Dict[str, str]:
    payload = OBSERVANCE_PAYLOADS.get(key)
    if not payload:
        return {"title": "Nabah", "message": "A sacred day approaches.",
                "action_url": "nabah:///home"}
    return dict(payload)


def fard_payload(prayer: str) -> Dict[str, str]:
    pool = FARD_PAYLOADS.get(prayer, [])
    if not pool:
        return {"title": prayer, "message": "It is time."}
    payload = dict(random.choice(pool))
    payload["action_url"] = "nabah:///home?open=prayers"
    return payload


def pre_adhan_payload(prayer: str, minutes: int) -> Dict[str, str]:
    template = random.choice(PRE_ADHAN_PAYLOADS)
    return {
        "title": template["title"].format(prayer=prayer, minutes=minutes),
        "message": template["message"].format(prayer=prayer, minutes=minutes),
        "action_url": "nabah:///home?open=prayers",
    }


def adhkar_payload(window: str) -> Dict[str, str]:
    """window: 'morning' | 'evening' | 'sleep'"""
    pool = ADHKAR_PAYLOADS.get(window, [])
    if not pool:
        return {"title": "Adhkar", "message": "The fortress is built each day. Will you set its stones?"}
    payload = dict(random.choice(pool))
    payload["action_url"] = f"nabah:///home?open=azkar&section={window}"
    return payload


def tahajjud_payload() -> Dict[str, str]:
    payload = dict(random.choice(TAHAJJUD_PAYLOADS))
    payload["action_url"] = "nabah:///home?open=prayers&intent=tahajjud"
    return payload


def contextual_sunnah_payload(category: str, sunnah_id: Optional[str] = None) -> Dict[str, str]:
    pool = CONTEXTUAL_SUNNAH_PAYLOADS.get(category, [])
    if not pool:
        return {"title": "A Sunnah", "message": "Revive a forgotten thread today."}
    payload = dict(random.choice(pool))
    url = "nabah:///home?open=sunnah"
    if sunnah_id:
        url += f"&id={sunnah_id}"
    payload["action_url"] = url
    return payload


# ─────────────────── PREVIEW: all templates ──────────────────────
def all_payloads_preview() -> Dict[str, list]:
    """Returns a preview of all notification templates — used by /api/notifications/preview."""
    return {
        "fard": FARD_PAYLOADS,
        "pre_adhan": PRE_ADHAN_PAYLOADS,
        "adhkar": ADHKAR_PAYLOADS,
        "tahajjud": TAHAJJUD_PAYLOADS,
        "contextual_sunnah": CONTEXTUAL_SUNNAH_PAYLOADS,
        "observance": OBSERVANCE_PAYLOADS,
    }
