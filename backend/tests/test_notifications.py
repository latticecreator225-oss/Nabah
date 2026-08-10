"""
Nabah - Notifications & Push endpoints tests.
Covers:
  - GET  /api/notifications/preview
  - GET  /api/notifications/sample (fard, pre_adhan, adhkar, tahajjud, sunnah, bogus)
  - POST /api/register-push
  - POST /api/notifications/test
  - Existing endpoints regression check (hijri, daily-reminder, azkar, sunnahs,
    sunnahs/categories, sunnahs/of-the-hour, users, emotions/ayah, azkar/progress)
"""
import os
import uuid
import pytest
import requests
from pathlib import Path

# ─── Resolve BASE URL ───
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


# ─── Notifications PREVIEW ───
def test_notifications_preview_shape(s):
    r = s.get(f"{API}/notifications/preview")
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, dict)
    for key in ("fard", "pre_adhan", "adhkar", "tahajjud", "contextual_sunnah"):
        assert key in data, f"missing key {key} in preview"
    # fard should have 5 prayers
    assert set(data["fard"].keys()) >= {"Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"}
    # adhkar has 3 windows
    assert set(data["adhkar"].keys()) >= {"morning", "evening", "sleep"}
    # contextual_sunnah has 3 categories
    assert set(data["contextual_sunnah"].keys()) >= {"household", "public", "work"}


# ─── Notifications SAMPLE ───
def _assert_payload_schema(p, must_contain_in_action_url=None):
    assert isinstance(p, dict)
    assert isinstance(p.get("title"), str) and p["title"].strip()
    assert isinstance(p.get("message"), str) and p["message"].strip()
    assert isinstance(p.get("action_url"), str) and p["action_url"].startswith("nabah:///")
    if must_contain_in_action_url:
        assert must_contain_in_action_url in p["action_url"], (
            f"action_url '{p['action_url']}' missing '{must_contain_in_action_url}'"
        )


@pytest.mark.parametrize("prayer", ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"])
def test_fard_sample(s, prayer):
    r = s.get(f"{API}/notifications/sample", params={"category": "fard", "key": prayer})
    assert r.status_code == 200, r.text
    p = r.json()
    _assert_payload_schema(p, must_contain_in_action_url="nabah:///home?open=prayers")


def test_pre_adhan_sample(s):
    r = s.get(f"{API}/notifications/sample", params={"category": "pre_adhan", "key": "Asr"})
    assert r.status_code == 200, r.text
    p = r.json()
    _assert_payload_schema(p, must_contain_in_action_url="open=prayers")
    # 'Asr' must appear in either title or message (templates use {prayer})
    combined = f"{p['title']} {p['message']}"
    assert "Asr" in combined, f"'Asr' not in pre_adhan output: {combined}"
    # minutes value (15 from server default) should appear somewhere
    assert "15" in combined, f"minutes '15' not found in pre_adhan output: {combined}"


@pytest.mark.parametrize("window", ["morning", "evening", "sleep"])
def test_adhkar_sample(s, window):
    r = s.get(f"{API}/notifications/sample", params={"category": "adhkar", "key": window})
    assert r.status_code == 200, r.text
    p = r.json()
    _assert_payload_schema(p, must_contain_in_action_url=f"azkar&section={window}")


def test_tahajjud_sample(s):
    r = s.get(f"{API}/notifications/sample", params={"category": "tahajjud"})
    assert r.status_code == 200, r.text
    p = r.json()
    _assert_payload_schema(p, must_contain_in_action_url="intent=tahajjud")


@pytest.mark.parametrize("cat", ["household", "public", "work"])
def test_sunnah_sample(s, cat):
    r = s.get(f"{API}/notifications/sample", params={"category": "sunnah", "key": cat})
    assert r.status_code == 200, r.text
    p = r.json()
    _assert_payload_schema(p, must_contain_in_action_url="open=sunnah")


def test_bogus_category_returns_400(s):
    r = s.get(f"{API}/notifications/sample", params={"category": "bogus"})
    assert r.status_code == 400, r.text


# ─── Register Push ───
@pytest.mark.parametrize("platform", ["android", "ios"])
def test_register_push_accepts(s, platform):
    body = {
        "user_id": str(uuid.uuid4()),
        "platform": platform,
        "device_token": f"TEST_TOKEN_{uuid.uuid4().hex[:8]}",
    }
    r = s.post(f"{API}/register-push", json=body)
    # placeholder key is acceptable; either 201 registered or 200 pending — must not 5xx
    assert r.status_code in (200, 201), f"unexpected {r.status_code}: {r.text}"
    data = r.json()
    assert "status" in data
    assert data["status"] in ("registered", "pending"), data


# ─── Notifications Test (send) ───
def test_notifications_test_fard(s):
    body = {"user_id": str(uuid.uuid4()), "category": "fard", "key": "Fajr"}
    r = s.post(f"{API}/notifications/test", json=body)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("status") in ("sent", "pending")
    payload = data.get("payload")
    assert isinstance(payload, dict)
    assert "title" in payload and "message" in payload


def test_notifications_test_bogus_category(s):
    body = {"user_id": str(uuid.uuid4()), "category": "bogus"}
    r = s.post(f"{API}/notifications/test", json=body)
    assert r.status_code == 400, r.text


# ─── Regression: existing endpoints ───
def test_hijri_date(s):
    r = s.get(f"{API}/hijri-date")
    assert r.status_code == 200, r.text
    assert "formatted" in r.json()


def test_daily_reminder(s):
    r = s.get(f"{API}/daily-reminder")
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), dict)


def test_azkar(s):
    r = s.get(f"{API}/azkar")
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list) and len(data) > 0


def test_sunnahs(s):
    r = s.get(f"{API}/sunnahs")
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list) and len(data) > 0
    s0 = data[0]
    for k in ("id", "category", "demographic"):
        assert k in s0


def test_sunnahs_categories(s):
    r = s.get(f"{API}/sunnahs/categories")
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list) and len(data) > 0
    assert "count" in data[0]


@pytest.mark.parametrize("h", [0, 6, 12, 18, 23])
def test_sunnah_of_the_hour(s, h):
    r = s.get(f"{API}/sunnahs/of-the-hour", params={"hour": h})
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, dict)


def test_create_user_and_persistence(s):
    payload = {"name": "TEST_NotifUser", "gender": "male", "married": False}
    r = s.post(f"{API}/users", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    uid = body["id"]
    # GET back
    r2 = s.get(f"{API}/users/{uid}")
    assert r2.status_code == 200
    assert r2.json()["name"] == "TEST_NotifUser"


def test_emotions_ayah(s):
    r = s.post(
        f"{API}/emotions/ayah",
        json={"emotion": "anxious"},
        timeout=60,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("arabic") and data.get("english")


def test_azkar_progress_roundtrip(s):
    # quick user
    r = s.post(f"{API}/users", json={"name": "TEST_AzkarProg"})
    uid = r.json()["id"]
    r1 = s.post(
        f"{API}/azkar/progress",
        json={"user_id": uid, "section_id": "morning", "item_index": 0, "done": True},
    )
    assert r1.status_code == 200, r1.text
    assert r1.json().get("ok") is True
