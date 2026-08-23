"""
Nabah · Quran reader

Thin proxy over alquran.cloud that merges the editions a reader needs — Arabic
(Uthmani script), English transliteration, and a translation — with
verse-by-verse recitation audio built directly from everyayah.com (chosen by
`reciter`), into one ayah list, so the app makes a single call per surah.
Responses are cached in-process (the text never changes).
"""
import asyncio
from typing import Dict, List, Optional, Tuple

import requests
from fastapi import APIRouter, HTTPException

from deps import logger

router = APIRouter(prefix="/api", tags=["quran"])

ALQURAN = "https://api.alquran.cloud/v1"

# Translations the client may request. Transliteration is fixed.
TRANSLATIONS = {
    "en.sahih": "Saheeh International",
    "en.asad": "Muhammad Asad",
    "en.pickthall": "Pickthall",
    "en.yusufali": "Yusuf Ali",
}
DEFAULT_TRANSLATION = "en.sahih"

# Verse-by-verse recitation audio, built directly from everyayah.com — one
# uniform URL pattern covers every reciter, unlike alquran.cloud's audio
# editions, which are missing several of these (notably Al-Dosari and
# Al-Ghamdi). URL: https://everyayah.com/data/{folder}/{surah:03}{ayah:03}.mp3
RECITERS: Dict[str, str] = {
    "alafasy": "Alafasy_128kbps",
    "sudais": "Abdurrahmaan_As-Sudais_192kbps",
    "muaiqly": "MaherAlMuaiqly128kbps",
    "dosari": "Yasser_Ad-Dussary_128kbps",
    "shuraim": "Saood_ash-Shuraym_128kbps",
    "ghamdi": "Ghamadi_40kbps",
}
RECITER_NAMES: Dict[str, str] = {
    "alafasy": "Mishary Alafasy",
    "sudais": "Abdul Rahman Al-Sudais",
    "muaiqly": "Maher Al Muaiqly",
    "dosari": "Yasser Al-Dosari",
    "shuraim": "Saud Al-Shuraim",
    "ghamdi": "Saad Al-Ghamdi",
}
DEFAULT_RECITER = "alafasy"
EVERYAYAH = "https://everyayah.com/data"


def _audio_url(reciter: str, surah: int, ayah: int) -> str:
    folder = RECITERS.get(reciter, RECITERS[DEFAULT_RECITER])
    return f"{EVERYAYAH}/{folder}/{surah:03d}{ayah:03d}.mp3"

# Arabic script style. "uthmani" = the Madinah/Saudi Mushaf (default), served by
# alquran.cloud. "indopak" = the Indo-Pak orthography, sourced from the Saudi
# Quran-complex Indo-Pak edition and merged over the Uthmani text by verse.
SCRIPTS = {"uthmani", "indopak"}
DEFAULT_SCRIPT = "uthmani"
INDOPAK_URL = "https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ara-quranindopak.min.json"

_SURAHS_CACHE: Optional[List[dict]] = None
_SURAH_CACHE: Dict[str, dict] = {}
_INDOPAK: Optional[Dict[Tuple[int, int], str]] = None
_INDOPAK_LOCK = asyncio.Lock()


def _fetch_indopak() -> Dict[Tuple[int, int], str]:
    """Blocking — runs in a worker thread. Whole-Quran Indo-Pak text by verse."""
    r = requests.get(INDOPAK_URL, timeout=45)
    r.raise_for_status()
    data = r.json().get("quran", [])
    return {(a["chapter"], a["verse"]): a.get("text", "") for a in data}


async def _get_indopak() -> Dict[Tuple[int, int], str]:
    global _INDOPAK
    if _INDOPAK is not None:
        return _INDOPAK
    async with _INDOPAK_LOCK:
        if _INDOPAK is not None:
            return _INDOPAK
        _INDOPAK = await asyncio.to_thread(_fetch_indopak)
        return _INDOPAK


@router.get("/quran/surahs")
async def quran_surahs():
    """The 114 surahs with their metadata (for the index list)."""
    global _SURAHS_CACHE
    if _SURAHS_CACHE is not None:
        return _SURAHS_CACHE
    try:
        r = requests.get(f"{ALQURAN}/surah", timeout=10)
        r.raise_for_status()
        data = r.json().get("data", [])
        out = [
            {
                "number": s["number"],
                "name": s["name"],
                "englishName": s["englishName"],
                "englishNameTranslation": s["englishNameTranslation"],
                "numberOfAyahs": s["numberOfAyahs"],
                "revelationType": s["revelationType"],
            }
            for s in data
        ]
        if out:
            _SURAHS_CACHE = out
        return out
    except Exception as e:
        logger.warning(f"quran surahs fetch failed: {e}")
        raise HTTPException(502, "Could not load the surah list")


@router.get("/quran/translations")
async def quran_translations():
    return [{"id": k, "name": v} for k, v in TRANSLATIONS.items()]


@router.get("/quran/reciters")
async def quran_reciters():
    return [{"id": k, "name": v} for k, v in RECITER_NAMES.items()]


@router.get("/quran/surah/{number}")
async def quran_surah(
    number: int,
    translation: str = DEFAULT_TRANSLATION,
    script: str = DEFAULT_SCRIPT,
    reciter: str = DEFAULT_RECITER,
):
    """One surah: Arabic + transliteration + translation + audio, merged per ayah.

    `script` selects the Arabic orthography: "uthmani" (the Madinah/Saudi Mushaf,
    default) or "indopak". `reciter` selects verse-by-verse recitation audio
    (see RECITERS); text/translation are unaffected by it.
    """
    if number < 1 or number > 114:
        raise HTTPException(404, "Surah not found")
    if translation not in TRANSLATIONS:
        translation = DEFAULT_TRANSLATION
    if script not in SCRIPTS:
        script = DEFAULT_SCRIPT
    if reciter not in RECITERS:
        reciter = DEFAULT_RECITER

    cache_key = f"{number}:{translation}:{script}:{reciter}"
    if cache_key in _SURAH_CACHE:
        return _SURAH_CACHE[cache_key]

    # Indo-Pak text is overlaid on the Uthmani structure (same verse alignment).
    indopak: Optional[Dict[Tuple[int, int], str]] = None
    if script == "indopak":
        try:
            indopak = await _get_indopak()
        except Exception as e:
            logger.warning(f"indopak load failed, falling back to uthmani: {e}")
            indopak = None

    editions = f"quran-uthmani,en.transliteration,{translation}"
    try:
        r = requests.get(f"{ALQURAN}/surah/{number}/editions/{editions}", timeout=12)
        r.raise_for_status()
        eds = r.json().get("data", [])
        if len(eds) < 3:
            raise ValueError("unexpected editions payload")
        arabic, translit, english = eds[0], eds[1], eds[2]

        ar_ayahs = arabic.get("ayahs", [])
        tl_ayahs = translit.get("ayahs", [])
        en_ayahs = english.get("ayahs", [])

        ayahs = []
        for i, a in enumerate(ar_ayahs):
            num_in_surah = a.get("numberInSurah")
            arabic_text = a.get("text", "")
            if indopak is not None:
                arabic_text = indopak.get((number, num_in_surah), arabic_text)
            ayahs.append({
                "number": num_in_surah,
                "arabic": arabic_text,
                "transliteration": tl_ayahs[i].get("text", "") if i < len(tl_ayahs) else "",
                "english": en_ayahs[i].get("text", "") if i < len(en_ayahs) else "",
                "audio": _audio_url(reciter, number, num_in_surah),
                "juz": a.get("juz"),
                "page": a.get("page"),
                "sajda": bool(a.get("sajda")),
            })

        out = {
            "number": arabic.get("number"),
            "name": arabic.get("name"),
            "englishName": arabic.get("englishName"),
            "englishNameTranslation": arabic.get("englishNameTranslation"),
            "revelationType": arabic.get("revelationType"),
            "numberOfAyahs": arabic.get("numberOfAyahs"),
            "translation": translation,
            "translation_name": TRANSLATIONS[translation],
            "script": script,
            "reciter": reciter,
            "reciter_name": RECITER_NAMES[reciter],
            "ayahs": ayahs,
        }
        _SURAH_CACHE[cache_key] = out
        return out
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"quran surah {number} fetch failed: {e}")
        raise HTTPException(502, "Could not load this surah")
