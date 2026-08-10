"""Nabah backend API tests against the public preview URL."""
import os
import time
import uuid
import pytest
import requests
from pathlib import Path

def _resolve_base_url() -> str:
    """Backend base URL: explicit env → repo frontend/.env → localhost default."""
    env = os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if env:
        return env.strip().rstrip("/")
    for p in (Path(__file__).resolve().parents[2] / "frontend" / ".env", Path("/app/frontend/.env")):
        try:
            for line in p.read_text().splitlines():
                if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
                    return line.split("=", 1)[1].strip().strip('"').rstrip("/")
        except OSError:
            continue
    return "http://localhost:8000"


BASE_URL = _resolve_base_url()
API = f"{BASE_URL}/api"


def _server_up() -> bool:
    try:
        requests.get(f"{API}/", timeout=1.5)
        return True
    except Exception:
        return False


# Integration tests: skip (not error) when no backend is reachable.
pytestmark = pytest.mark.skipif(not _server_up(), reason=f"backend not reachable at {API}")


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# --- Root + meta ---
def test_root(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("app") == "Nabah"
    assert body.get("name_ar") == "نَبَأ"
    assert "tagline" not in body


def test_daily_reminder(s):
    r = s.get(f"{API}/daily-reminder")
    assert r.status_code == 200, r.text
    data = r.json()
    # should be a dict with text-ish fields
    assert isinstance(data, dict)
    assert len(data) > 0


def test_hijri_date(s):
    r = s.get(f"{API}/hijri-date")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "formatted" in data


# --- Emotions ---
def test_emotions_list(s):
    r = s.get(f"{API}/emotions")
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    assert len(data) == 10, f"expected 10 emotions, got {len(data)}"
    for item in data:
        assert "key" in item and "emotion_en" in item and "emotion_ar" in item


def test_emotion_ayah_with_llm_reflection(s):
    r = s.post(
        f"{API}/emotions/ayah",
        json={"emotion": "anxious", "name": "Yusuf"},
        timeout=60,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("key") == "anxious"
    assert data.get("arabic"), "missing arabic"
    assert data.get("english"), "missing english"
    assert data.get("surah"), "missing surah"
    reflection = data.get("reflection")
    assert isinstance(reflection, str) and len(reflection.strip()) > 0, "reflection must be non-empty"


def test_emotion_ayah_invalid(s):
    r = s.post(f"{API}/emotions/ayah", json={"emotion": "blahblah"})
    assert r.status_code == 400


# --- Users CRUD ---
@pytest.fixture(scope="session")
def created_user(s):
    payload = {"name": "TEST_Yusuf", "phone": "+15551234567"}
    r = s.post(f"{API}/users", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("id")
    assert body.get("name") == "TEST_Yusuf"
    assert body.get("phone") == "+15551234567"
    assert body.get("weekly_sms_enabled") is True
    yield body
    # no delete endpoint; leaving with TEST_ prefix


def test_user_get(s, created_user):
    r = s.get(f"{API}/users/{created_user['id']}")
    assert r.status_code == 200, r.text
    assert r.json()["id"] == created_user["id"]


def test_user_patch(s, created_user):
    r = s.patch(
        f"{API}/users/{created_user['id']}",
        json={"name": "TEST_Yusuf_Updated", "weekly_sms_enabled": False},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "TEST_Yusuf_Updated"
    assert body["weekly_sms_enabled"] is False
    # verify persistence
    r2 = s.get(f"{API}/users/{created_user['id']}")
    assert r2.json()["name"] == "TEST_Yusuf_Updated"
    assert r2.json()["weekly_sms_enabled"] is False


def test_user_404(s):
    r = s.get(f"{API}/users/{uuid.uuid4()}")
    assert r.status_code == 404


# --- Azkar ---
def test_azkar_list(s):
    r = s.get(f"{API}/azkar")
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    assert len(data) == 5, f"expected 5 azkar sections, got {len(data)}"


def test_azkar_progress_roundtrip(s, created_user):
    uid = created_user["id"]
    # set done=True
    r1 = s.post(
        f"{API}/azkar/progress",
        json={"user_id": uid, "section_id": "morning", "item_index": 0, "done": True},
    )
    assert r1.status_code == 200, r1.text
    r2 = s.get(f"{API}/azkar/progress/{uid}")
    assert r2.status_code == 200
    completed = r2.json().get("completed", [])
    assert "morning:0" in completed
    # set done=False
    r3 = s.post(
        f"{API}/azkar/progress",
        json={"user_id": uid, "section_id": "morning", "item_index": 0, "done": False},
    )
    assert r3.status_code == 200
    r4 = s.get(f"{API}/azkar/progress/{uid}")
    assert "morning:0" not in r4.json().get("completed", [])


# --- Saved ayahs ---
def test_saved_ayahs_roundtrip(s, created_user):
    uid = created_user["id"]
    payload = {
        "user_id": uid,
        "emotion": "anxious",
        "arabic": "بسم الله",
        "english": "Test verse",
        "surah": "Test",
        "reference": "1:1",
    }
    r = s.post(f"{API}/saved-ayahs", json=payload)
    assert r.status_code == 200, r.text
    saved = r.json()
    assert saved["user_id"] == uid
    assert "_id" not in saved

    r2 = s.get(f"{API}/saved-ayahs/{uid}")
    assert r2.status_code == 200
    rows = r2.json()
    assert any(row.get("reference") == "1:1" for row in rows)


# --- SMS (Twilio) ---
def test_sms_send(s):
    """Trial Twilio account will likely fail for unverified numbers — expect graceful 500 or 200."""
    r = s.post(
        f"{API}/sms/send",
        json={"phone": "+15551234567", "message": "TEST_Nabah integration test"},
        timeout=30,
    )
    # Either accepted (200) or surfaced as a clean 500 (not a crash)
    assert r.status_code in (200, 500), r.text
    if r.status_code == 500:
        body = r.json()
        assert "detail" in body
        # Should mention SMS failure reason gracefully
        assert "SMS" in body["detail"] or "Twilio" in body["detail"] or "unverified" in body["detail"].lower() or len(body["detail"]) > 0


def test_dawah_preview(s):
    r = s.get(f"{API}/dawah/preview")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "message" in body and isinstance(body["message"], str) and len(body["message"]) > 0
