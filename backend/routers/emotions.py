import asyncio
import hashlib
import random
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from deps import db, ANTHROPIC_API_KEY, ANTHROPIC_MODEL, logger
from auth import optional_user_id
from ayah_data import EMOTION_LABELS, EMOTION_AYAH_POOL, DAILY_REMINDERS
from routers.users import doc_to_user
from tafsir import get_tafsir, parse_ref, TAFSIR_NAME

router = APIRouter(prefix="/api", tags=["emotions"])

# Lazy Anthropic client (created once, only if a key is configured).
_anthropic_client = None


def _get_anthropic():
    global _anthropic_client
    if _anthropic_client is None:
        from anthropic import AsyncAnthropic

        _anthropic_client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    return _anthropic_client


class EmotionRequest(BaseModel):
    emotion: str
    user_id: Optional[str] = None
    refresh: bool = False
    seen: Optional[list[int]] = None  # indices already shown this cycle (rotation)


def _daily_index(n: int) -> int:
    today_str = date.today().isoformat()
    h = int(hashlib.md5(today_str.encode()).hexdigest(), 16)
    return h % n


def _pick_ayah(
    emotion: str, refresh: bool, user_id: Optional[str], seen: Optional[list] = None
) -> dict:
    pool = EMOTION_AYAH_POOL.get(emotion, [])
    if not pool:
        return None

    cycle_reset = False
    if refresh:
        # Rotate: pick a verse not yet shown this cycle. Once every verse has
        # been seen, start a fresh cycle — but never immediately repeat the last
        # one if the pool is larger than 1.
        seen_set = {i for i in (seen or []) if 0 <= i < len(pool)}
        remaining = [i for i in range(len(pool)) if i not in seen_set]
        if not remaining:
            cycle_reset = True
            last = (seen or [])[-1] if seen else None
            choices = [i for i in range(len(pool)) if i != last] or list(range(len(pool)))
            idx = random.choice(choices)
        else:
            idx = random.choice(remaining)
    else:
        # Stable verse for the day (deterministic per user+emotion+date).
        seed_str = f"{user_id or ''}-{emotion}-{date.today().isoformat()}"
        h = int(hashlib.md5(seed_str.encode()).hexdigest(), 16)
        idx = h % len(pool)

    ar, en, surah, ref = pool[idx]
    return {
        "arabic": ar, "english": en, "surah": surah, "reference": ref,
        "pool_size": len(pool), "index": idx, "cycle_reset": cycle_reset,
    }


async def _generate_reflection(ayah: dict, emotion: str, user_ctx: Optional[dict]) -> str:
    # The verse's index in its pool doubles as the fallback variant, so a new
    # verse always comes with different words beside it.
    variant = int(ayah.get("index") or 0)
    # Ground the model in classical tafsir \u2014 or don't use the model at all.
    # (Grounded-or-static policy: a reflection is either anchored to verified
    # classical exegesis, or it comes from our hand-written fallbacks. The LLM
    # never freely interprets the Qur'an.)
    ref = parse_ref(ayah.get("reference", ""))
    tafsir_text: Optional[str] = None
    if ref:
        tafsir_text = await asyncio.to_thread(get_tafsir, ref[0], ref[1])
    if not tafsir_text:
        logger.info(f"tafsir unavailable for {ayah.get('reference')} \u2014 using static reflection")
        return _fallback_reflection(emotion, variant)

    if not ANTHROPIC_API_KEY:
        return _fallback_reflection(emotion, variant)

    try:
        name = (user_ctx or {}).get("name") or "friend"
        gender = (user_ctx or {}).get("gender") or "unspecified"

        if gender == "male":
            addr = f"a man named {name}"
            pronoun_hint = "Address him as a brother."
        elif gender == "female":
            addr = f"a woman named {name}"
            pronoun_hint = "Address her as a sister."
        else:
            addr = name
            pronoun_hint = "Use neutral, warm language."

        system = (
            "You are a gentle Islamic spiritual companion inside the app \u0646\u064E\u0628\u064E\u0623 (Nabah). "
            "Your tone is warm, intimate, and literary \u2014 never preachy or clinical. "
            "Write 2\u20133 sentences (max ~60 words). Do not quote the verse back. Do not greet. "
            "Do not start with 'O' or 'Dear'. Address the reader as 'you'. End softly. No clich\u00e9s, no emojis. "
            "CRITICAL BOUNDARY: you will be given an excerpt of classical tafsir for the verse. Treat it as "
            "the only valid interpretation. Your task is solely to connect the reader's feeling to what the "
            "tafsir already says \u2014 never introduce meanings, rulings, or claims that are not in it."
        )
        prompt = (
            f"The reader is {addr}. {pronoun_hint}\n"
            f"They are feeling: {emotion}.\n"
            f"The verse shown is from Surah {ayah['surah']} ({ayah['reference']}): \"{ayah['english']}\"\n\n"
            f"Classical exegesis ({TAFSIR_NAME}) for this verse \u2014 your ground truth:\n"
            f"\u201C{tafsir_text}\u201D\n\n"
            "Write 2\u20133 sentences (max 60 words) that gently acknowledge what they are feeling and connect "
            "it to what the classical exegesis says about this verse. Stay strictly within the tafsir's meaning. "
            "Do not quote the verse. Do not greet. Just speak softly to the heart."
        )
        client = _get_anthropic()
        resp = await client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=300,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(b.text for b in resp.content if b.type == "text").strip().strip('"')
        return text or _fallback_reflection(emotion, variant)
    except Exception as e:
        logger.warning(f"LLM reflection failed, using fallback: {e}")
        return _fallback_reflection(emotion, variant)


# Hand-written reflections, several per emotion. Multiple variants matter: without
# ANTHROPIC_API_KEY set (and whenever tafsir is unavailable for a verse) *every*
# reflection comes from here, so a single string per emotion meant "A word for you"
# never changed no matter how many times the reader pressed Another.
_FALLBACKS: dict[str, list[str]] = {
    "sad": [
        "Whatever you are carrying right now is not invisible to Him. Sit with this verse \u2014 let it soften the part of you that is tired.",
        "Sadness is not a failure of faith. Some griefs are meant to be carried gently, and not alone.",
        "You are allowed to be heavy today. Nothing about this hides you from the One who is nearest.",
        "The heart has weather. This will pass through you, and you will still be standing when it does.",
        "He does not ask you to feel differently before you turn to Him. Come as you are, tired and all.",
    ],
    "anxious": [
        "The mind races, but the heart was made for a quieter room. Slow your breath; let His name settle there.",
        "Not every thought asking for your attention deserves it. Give this moment only what it actually requires.",
        "You are trying to hold tomorrow with today's hands. Set it down; it was never yours to carry early.",
        "Fear grows loud in the dark and small in the light. Bring it into words, and it shrinks.",
        "You have survived every day that once frightened you from a distance. This one is no different.",
    ],
    "angry": [
        "Anger is fire that hurts the one who holds it. Mercy is the wider, harder door \u2014 and the one He loves.",
        "You are allowed to be wronged and still choose not to be ruined by it. That restraint is strength.",
        "Say less than you want to right now. What is unsaid can still be said tomorrow; the reverse is not true.",
        "The heat will pass and leave you with whatever you did while it burned. Choose something you can live beside.",
        "Justice and vengeance want the same thing from you but leave you in very different places.",
    ],
    "exhausted": [
        "You do not have to outrun the weight. Ease is being woven into the same cloth as the difficulty.",
        "Rest is not the opposite of devotion. A body that is spent is owed something, and He knows it.",
        "You have been running on the last of yourself for a while. Let today be smaller than you planned.",
        "Do the next small thing, and only that. The whole of it is not being asked of you at once.",
        "Tiredness is not weakness. It is the honest cost of having carried something real.",
    ],
    "grateful": [
        "Gratitude is the quietest worship. Speak it gently \u2014 even what you cannot count is counted.",
        "Notice one thing today that you would have missed a year ago. That noticing is itself the gift.",
        "What you are thankful for was given before you thought to ask. That is the shape of most mercies.",
        "Say it out loud to someone. Gratitude kept private tends to fade; spoken, it multiplies.",
        "The ordinary day you are having is the answer to a prayer you have forgotten making.",
    ],
    "hopeless": [
        "There is no door He cannot open, no return He refuses. Whatever you are carrying, bring it home.",
        "Despair speaks with great confidence and is very often wrong. Do not sign anything it tells you.",
        "You do not need to see the whole way out. You only need the next step, and it is usually visible.",
        "Nothing you have done has placed you outside His reach. That door was never the one that closes.",
        "Stay a little longer. Things that felt permanent have quietly changed before, and will again.",
    ],
    "happy": [
        "Hold this lightly and thankfully. The favors around you are uncountable; let one of them be noticed.",
        "Let yourself have this without waiting for it to be taken. Joy is not a debt you will be billed for.",
        "Share it. Happiness that is passed on tends to come back wearing a different face.",
        "Remember this feeling carefully. There will be a day you will want to be reminded it was real.",
        "Good days are not accidents to be rushed past. Sit in this one a moment longer.",
    ],
    "restless": [
        "You were not given more than you can carry. Set down what is not yours to hold tonight.",
        "The urge to move is not always the need to move. Ask what the restlessness is actually pointing at.",
        "Stillness feels like falling behind and rarely is. Let yourself be unproductive for one hour.",
        "You are searching for something you may already have. Look closer before you look further.",
        "Not every unsettled feeling needs solving today. Some of them just need sleep.",
    ],
    "heartbroken": [
        "Grief is not a sign you were wrong to love. To Him we belong, and to Him is the soft, sure return.",
        "The size of the ache is the size of what mattered. That is a hard kind of proof, but it is proof.",
        "You will not always feel this. Believe that on the days you cannot feel anything else.",
        "Let it hurt properly. Grief handled honestly heals cleaner than grief that is hurried.",
        "Something in you is still tender enough to break. Do not be in a rush to lose that.",
    ],
    "lonely": [
        "You are not as alone as the silence has made you feel. He is closer than the next breath you will take.",
        "Being unseen by people is not the same as being unseen. One of those is temporary.",
        "Reach out first, even clumsily. Most loneliness is two people each waiting for the other.",
        "Solitude and loneliness wear the same clothes. Sometimes changing which one you call it changes the evening.",
        "You are known in full by the One who made you \u2014 including the parts you have never said aloud.",
    ],
}

_GENERIC_FALLBACKS = [
    "Sit with the verse. Let it find the part of you that needs it most.",
    "Read it once more, slowly. The second reading usually lands somewhere the first did not.",
    "You do not have to draw a lesson from this today. Let it simply keep you company.",
]


def _fallback_reflection(emotion: str, variant: int = 0) -> str:
    """A hand-written reflection. `variant` (the verse's index in its pool)
    rotates through the set so pressing Another changes the words too."""
    pool = _FALLBACKS.get(emotion) or _GENERIC_FALLBACKS
    return pool[variant % len(pool)]


@router.get("/daily-reminder")
async def daily_reminder():
    return DAILY_REMINDERS[_daily_index(len(DAILY_REMINDERS))]


@router.get("/emotions")
async def list_emotions():
    return [
        {"key": k, "emotion_en": v["en"], "emotion_ar": v["ar"]}
        for k, v in EMOTION_LABELS.items()
    ]


@router.post("/emotions/ayah")
async def emotion_to_ayah(payload: EmotionRequest, auth_id: Optional[str] = Depends(optional_user_id)):
    key = payload.emotion.lower().strip()
    if key not in EMOTION_AYAH_POOL:
        raise HTTPException(status_code=400, detail=f"Unknown emotion: {key}")

    # Personalise (name/gender in the reflection, per-user verse rotation) only
    # for the authenticated owner — never for an arbitrary id in the body.
    effective_uid = payload.user_id if payload.user_id and payload.user_id == auth_id else None

    ayah = _pick_ayah(key, payload.refresh, effective_uid, payload.seen)
    labels = EMOTION_LABELS[key]

    user_ctx = None
    if effective_uid:
        u = await db.users.find_one({"id": effective_uid}, {"_id": 0})
        if u:
            user_ctx = doc_to_user(u)

    reflection = await _generate_reflection(ayah, key, user_ctx)

    return {
        "key": key,
        "emotion_en": labels["en"],
        "emotion_ar": labels["ar"],
        **ayah,
        "reflection": reflection,
    }
