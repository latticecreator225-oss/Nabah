import asyncio
import hashlib
import random
import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from deps import db, EMERGENT_LLM_KEY, logger
from auth import optional_user_id
from ayah_data import EMOTION_LABELS, EMOTION_AYAH_POOL, DAILY_REMINDERS
from routers.users import doc_to_user
from tafsir import get_tafsir, parse_ref, TAFSIR_NAME

router = APIRouter(prefix="/api", tags=["emotions"])


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
        return _fallback_reflection(emotion)

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

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
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"nabah-{emotion}-{uuid.uuid4().hex[:8]}",
            system_message=system,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        msg = UserMessage(text=prompt)
        response = await chat.send_message(msg)
        return (response or "").strip().strip('"')
    except Exception as e:
        logger.warning(f"LLM reflection failed, using fallback: {e}")
        return _fallback_reflection(emotion)


def _fallback_reflection(emotion: str) -> str:
    fallbacks = {
        "sad": "Whatever you are carrying right now is not invisible to Him. Sit with this verse \u2014 let it soften the part of you that is tired.",
        "anxious": "The mind races, but the heart was made for a quieter room. Slow your breath; let His name settle there.",
        "angry": "Anger is fire that hurts the one who holds it. Mercy is the wider, harder door \u2014 and the one He loves.",
        "exhausted": "You do not have to outrun the weight. Ease is being woven into the same cloth as the difficulty.",
        "grateful": "Gratitude is the quietest worship. Speak it gently \u2014 even what you cannot count is counted.",
        "hopeless": "There is no door He cannot open, no return He refuses. Whatever you are carrying, bring it home.",
        "happy": "Hold this lightly and thankfully. The favors around you are uncountable; let one of them be noticed.",
        "restless": "You were not given more than you can carry. Set down what is not yours to hold tonight.",
        "heartbroken": "Grief is not a sign you were wrong to love. To Him we belong, and to Him is the soft, sure return.",
        "lonely": "You are not as alone as the silence has made you feel. He is closer than the next breath you will take.",
    }
    return fallbacks.get(emotion, "Sit with the verse. Let it find the part of you that needs it most.")


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
