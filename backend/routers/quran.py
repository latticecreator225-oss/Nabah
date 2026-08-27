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
    # English
    "en.sahih": "Saheeh International",
    "en.asad": "Muhammad Asad",
    "en.pickthall": "Pickthall",
    "en.yusufali": "Yusuf Ali",
    # Other languages — real published translations, selected by the app's
    # interface language (see frontend src/i18n/types.ts `quranEdition`).
    "ur.jalandhry": "Fateh Muhammad Jalandhry",
    "id.indonesian": "Indonesian Ministry of Religious Affairs",
    "bn.bengali": "Muhiuddin Khan",
    "tr.diyanet": "Diyanet İşleri",
    "fr.hamidullah": "Muhammad Hamidullah",
    "ms.basmeih": "Abdullah Muhammad Basmeih",
    "ru.kuliev": "Elmir Kuliev",
    "hi.hindi": "Suhel Farooq Khan & Saifur Rahman Nadwi",
    "fa.fooladvand": "Mohammad Mahdi Fooladvand",
    "es.cortes": "Julio Cortés",
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


# alquran.cloud's Uthmani edition prefixes the Basmala onto ayah 1 of every
# surah except Al-Fatiha (where it *is* ayah 1) and At-Tawbah (which has none).
# The reader already renders a standalone Basmala header above the ayah list, so
# left as-is every surah showed it twice. The Indo-Pak source does not do this,
# which is why switching script silently changed the behaviour.
#
# Matching is done on the *consonant skeleton* (diacritics and alef variants
# removed) rather than a literal string: the Uthmani text uses alef-wasla
# (U+0671), superscript alef (U+0670) and other marks that differ between
# editions, and a hardcoded literal silently fails to match any of them.
_ARABIC_MARKS = dict.fromkeys(
    [*range(0x064B, 0x0653), 0x0670, 0x0640, *range(0x06D6, 0x06EE), 0xFEFF]
)
_ALEF_FORMS = str.maketrans({c: "ا" for c in "ٱآأإ"})

# ب س م   ا ل ل ه   ا ل ر ح م ن   ا ل ر ح ي م
_BASMALA_SKELETON = (
    "بسم"
    "الله"
    "الرحمن"
    "الرحيم"
)


def _skeleton(s: str) -> str:
    """Consonants only: no diacritics, no tatweel, alef variants unified."""
    return s.translate(_ARABIC_MARKS).translate(_ALEF_FORMS).replace(" ", "")


def _strip_leading_basmala(text: str, surah: int, ayah_no: int) -> str:
    """Remove a duplicated Basmala prefix from ayah 1. Never touches Al-Fatiha
    (1) — its first ayah genuinely is the Basmala — nor At-Tawbah (9)."""
    cleaned = text.lstrip("﻿").strip()
    if ayah_no != 1 or surah in (1, 9):
        return cleaned
    # Walk forward until the consonants seen so far cover the Basmala, then cut
    # the original string (with its diacritics) at that point.
    seen = 0
    target = len(_BASMALA_SKELETON)
    for i, ch in enumerate(cleaned):
        sk = _skeleton(ch)
        if sk:
            if sk != _BASMALA_SKELETON[seen:seen + len(sk)]:
                return cleaned  # not a Basmala prefix — leave untouched
            seen += len(sk)
            if seen == target:
                # The final consonant carries its own vowel mark (and possibly
                # Quranic annotation marks) *after* it — consume those too, or
                # they survive as a stray diacritic at the head of the ayah.
                j = i + 1
                while j < len(cleaned) and (ord(cleaned[j]) in _ARABIC_MARKS or cleaned[j] == " "):
                    j += 1
                return cleaned[j:].strip()
    return cleaned


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
            arabic_text = _strip_leading_basmala(arabic_text, number, num_in_surah)
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


# ─────────────────────────── Mushaf (page view) ───────────────────────────
# The standard 604-page Madani Mushaf layout, reproduced pixel-for-pixel
# rather than re-flowed. quran.com's API carries the real per-word line
# placement used in the printed Mushaf (`line_number`, page-relative) plus a
# `code_v2` glyph code per word — a single character in the King Fahd
# Complex's QCF v2 font, where each *word* is one pre-shaped ligature glyph
# designed by the Complex's typesetters to fill that exact line the way the
# print page does. Rendering `code_v2` in that page's own font (one font
# file per page, hosted by the Quran Foundation's own font CDN — NOT the
# older `quran.com-images` GitHub mirror, whose fonts predate the `code_v2`
# codepoint scheme and render as blank glyphs if paired with it) reproduces
# the page as-is; no layout code of ours decides line breaks or spacing.
# Word-by-word translation/transliteration still comes from the same
# payload for the tap-to-reveal meaning overlay.
# Tajweed colour-coding for these glyphs would need a color-font format
# (COLRv1) that React Native's native text rendering doesn't reliably
# support, so it isn't attempted here — see MushafView.tsx.
# The Indo-Pak line breaks are NOT independently modelled: `text_indopak`
# renders in the *same* line/page grouping as the Uthmani text (the only
# pagination quran.com exposes for it), and it has no QCF glyph font, so it
# stays plain shaped text rather than pixel-perfect print layout.
QURAN_COM = "https://api.quran.com/api/v4"
TOTAL_MUSHAF_PAGES = 604
_MUSHAF_CACHE: Dict[Tuple[int, str], dict] = {}
MUSHAF_SCRIPTS = {"uthmani", "indopak"}
QCF_FONT_BASE = "https://verses.quran.foundation/fonts/quran/hafs/v2/ttf"


def _qcf_font_url(page: int) -> str:
    return f"{QCF_FONT_BASE}/p{page}.ttf"


@router.get("/quran/mushaf/{page}")
async def quran_mushaf_page(page: int, script: str = "uthmani"):
    """One Mushaf page: its lines, each a left-to-right list of words in the
    order they're set on that printed line, each word carrying its own
    translation + transliteration for a word-by-word reading. When
    `script=uthmani`, each word also carries a `glyph` (QCF v2 code point)
    to be rendered in that page's `font_url`/`font_family` for a pixel-
    accurate reproduction of the print layout. `first_ayah` flags the word
    that opens a new surah, so the client can draw a surah-header band +
    Bismillah there."""
    if page < 1 or page > TOTAL_MUSHAF_PAGES:
        raise HTTPException(404, "Page not found (1-604)")
    if script not in MUSHAF_SCRIPTS:
        script = "uthmani"
    cache_key = (page, script)
    if cache_key in _MUSHAF_CACHE:
        return _MUSHAF_CACHE[cache_key]
    try:
        word_fields = "line_number,char_type_name," + (
            "text_uthmani,code_v2" if script == "uthmani" else "text_indopak"
        )
        r = requests.get(
            f"{QURAN_COM}/verses/by_page/{page}",
            params={"words": "true", "word_fields": word_fields, "fields": "text_uthmani"},
            timeout=15,
        )
        r.raise_for_status()
        verses = r.json().get("verses", [])

        lines: Dict[int, List[dict]] = {}
        surah_numbers: List[int] = []
        juz = None
        for v in verses:
            juz = v.get("juz_number", juz)
            surah_num, ayah_num = v["verse_key"].split(":")
            surah_num = int(surah_num)
            if surah_num not in surah_numbers:
                surah_numbers.append(surah_num)
            for i, w in enumerate(v.get("words", [])):
                ln = w.get("line_number")
                if ln is None:
                    continue
                if script == "uthmani":
                    arabic = w.get("text_uthmani") or w.get("text")
                    glyph = w.get("code_v2")
                else:
                    arabic = w.get("text_indopak") or w.get("text")
                    glyph = None
                lines.setdefault(ln, []).append({
                    "arabic": arabic,
                    "glyph": glyph,
                    "translation": (w.get("translation") or {}).get("text"),
                    "transliteration": (w.get("transliteration") or {}).get("text"),
                    "verse_key": v["verse_key"],
                    "is_end": w.get("char_type_name") == "end",
                    "first_ayah": ayah_num == "1" and i == 0,
                })

        surahs = await quran_surahs()
        by_num = {s["number"]: s for s in surahs} if isinstance(surahs, list) else {}
        out = {
            "page": page,
            "total_pages": TOTAL_MUSHAF_PAGES,
            "juz": juz,
            "script": script,
            "font_url": _qcf_font_url(page) if script == "uthmani" else None,
            "font_family": f"qcf-p{page}" if script == "uthmani" else None,
            "surahs": [
                {"number": n, "name": by_num[n]["name"], "englishName": by_num[n]["englishName"]}
                for n in surah_numbers if n in by_num
            ],
            "lines": [{"line": k, "words": lines[k]} for k in sorted(lines.keys())],
        }
        _MUSHAF_CACHE[cache_key] = out
        return out
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"mushaf page {page} fetch failed: {e}")
        raise HTTPException(502, "Could not load this page")
