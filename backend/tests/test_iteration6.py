"""
Nabah iteration 6 backend regression tests.
Pure refactor: server.py split into routers/.
All endpoints from iter5 must respond identically.
"""
import os
import uuid
from pathlib import Path
import pytest
import requests


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

PRAYER_KEYS = {"Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"}


# ─── core / users ───────────────────────────────────────
class TestCore:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["app"] == "Nabah"
        assert "name_ar" in body and "tagline" in body


class TestUsers:
    def test_user_crud_lifecycle(self):
        payload = {
            "name": "TEST_iter6_user",
            "gender": "male",
            "married": False,
            "location_lat": 21.4225,
            "location_lng": 39.8262,
            "timezone": "Asia/Riyadh",
        }
        c = requests.post(f"{API}/users", json=payload, timeout=10)
        assert c.status_code == 200, c.text
        u = c.json()
        uid = u["id"]
        assert u["name"] == "TEST_iter6_user"
        assert u["calculation_method"] == 2
        assert "_id" not in u

        g = requests.get(f"{API}/users/{uid}", timeout=10)
        assert g.status_code == 200
        assert g.json()["id"] == uid

        # PATCH
        p = requests.patch(f"{API}/users/{uid}", json={"calculation_method": 4}, timeout=10)
        assert p.status_code == 200
        assert p.json()["calculation_method"] == 4

        # 404
        miss = requests.get(f"{API}/users/{uuid.uuid4()}", timeout=10)
        assert miss.status_code == 404


# ─── emotions / daily ───────────────────────────────────
class TestEmotions:
    def test_daily_reminder(self):
        r = requests.get(f"{API}/daily-reminder", timeout=10)
        assert r.status_code == 200
        # should be a dict (ayah/reminder)
        assert isinstance(r.json(), dict)

    def test_list_emotions(self):
        r = requests.get(f"{API}/emotions", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        assert {"key", "emotion_en", "emotion_ar"} <= set(data[0].keys())

    def test_emotion_to_ayah_unknown(self):
        r = requests.post(f"{API}/emotions/ayah", json={"emotion": "not_a_real_emotion"}, timeout=20)
        assert r.status_code == 400

    def test_emotion_to_ayah_valid(self):
        r = requests.post(f"{API}/emotions/ayah", json={"emotion": "sad"}, timeout=40)
        assert r.status_code == 200, r.text
        body = r.json()
        assert {"arabic", "english", "surah", "reference", "reflection"} <= set(body.keys())


# ─── saved ayahs ────────────────────────────────────────
class TestSavedAyahs:
    @pytest.fixture(scope="class")
    def created(self):
        uid = "TEST_iter6_bookmark_user"
        payload = {
            "user_id": uid,
            "emotion": "sad",
            "arabic": "ar", "english": "en",
            "surah": "Al-Baqarah", "reference": "2:286",
        }
        r = requests.post(f"{API}/saved-ayahs", json=payload, timeout=10)
        assert r.status_code == 200
        yield uid, r.json()["id"]
        requests.delete(f"{API}/saved-ayahs/{uid}/{r.json()['id']}", timeout=10)

    def test_list_saved(self, created):
        uid, _ = created
        r = requests.get(f"{API}/saved-ayahs/{uid}", timeout=10)
        assert r.status_code == 200
        assert any(x["user_id"] == uid for x in r.json())

    def test_delete_saved(self):
        uid = "TEST_iter6_del_user"
        c = requests.post(f"{API}/saved-ayahs", json={
            "user_id": uid, "emotion": "happy",
            "arabic": "a", "english": "e", "surah": "s", "reference": "1:1",
        }, timeout=10)
        aid = c.json()["id"]
        d = requests.delete(f"{API}/saved-ayahs/{uid}/{aid}", timeout=10)
        assert d.status_code == 200
        # 404 on second delete
        d2 = requests.delete(f"{API}/saved-ayahs/{uid}/{aid}", timeout=10)
        assert d2.status_code == 404


# ─── azkar ──────────────────────────────────────────────
class TestAzkar:
    def test_get_azkar(self):
        r = requests.get(f"{API}/azkar", timeout=10)
        assert r.status_code == 200
        assert r.json()

    def test_azkar_progress(self):
        uid = "TEST_iter6_azkar_user"
        post = requests.post(f"{API}/azkar/progress", json={
            "user_id": uid, "section_id": "morning", "item_index": 0, "done": True,
        }, timeout=10)
        assert post.status_code == 200
        g = requests.get(f"{API}/azkar/progress/{uid}", timeout=10)
        assert g.status_code == 200
        assert "morning:0" in g.json()["completed"]
        # toggle off
        requests.post(f"{API}/azkar/progress", json={
            "user_id": uid, "section_id": "morning", "item_index": 0, "done": False,
        }, timeout=10)
        g2 = requests.get(f"{API}/azkar/progress/{uid}", timeout=10)
        assert "morning:0" not in g2.json()["completed"]


# ─── sunnah ─────────────────────────────────────────────
class TestSunnah:
    def test_categories(self):
        r = requests.get(f"{API}/sunnahs/categories", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        assert "count" in data[0]

    def test_list_sunnahs(self):
        r = requests.get(f"{API}/sunnahs", timeout=10)
        assert r.status_code == 200
        assert len(r.json()) > 0

    def test_sunnah_of_the_hour(self):
        r = requests.get(f"{API}/sunnahs/of-the-hour", params={"hour": 12}, timeout=10)
        assert r.status_code == 200
        assert r.json()

    def test_revive_sunnah(self):
        uid = "TEST_iter6_revive_user"
        r = requests.post(f"{API}/sunnahs/revive", json={
            "user_id": uid, "sunnah_id": "smile", "revived": True,
        }, timeout=10)
        assert r.status_code == 200
        assert r.json()["ok"] is True


# ─── prayer-times region picks ──────────────────────────
class TestPrayerTimes:
    @pytest.mark.parametrize("lat,lng,expected_method,name_substr", [
        (21.4225, 39.8262, 4, "Umm al-Qura"),
        (24.86, 67.01, 1, "Karachi"),
        (51.5074, -0.1278, 3, "Muslim World League"),
        (40.71, -74.0, 2, "ISNA"),
        (41.01, 28.97, 13, "Diyanet"),
        (30.04, 31.23, 5, "Egyptian"),
        (3.14, 101.69, 17, "JAKIM"),
    ])
    def test_region_method(self, lat, lng, expected_method, name_substr):
        r = requests.get(f"{API}/prayer-times", params={"lat": lat, "lng": lng}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["method"] == expected_method
        assert name_substr.lower() in body["method_name"].lower()
        assert PRAYER_KEYS <= set(body["timings"].keys())

    def test_missing_params(self):
        r = requests.get(f"{API}/prayer-times", timeout=10)
        assert r.status_code == 422


# ─── hijri ──────────────────────────────────────────────
class TestHijri:
    def test_hijri_date(self):
        r = requests.get(f"{API}/hijri-date", timeout=15)
        assert r.status_code == 200

    @pytest.mark.parametrize("month,day,expected_id", [
        (1, 10, "ashura"),
        (12, 9, "arafah"),
        (9, 27, "laylat_al_qadr"),
    ])
    def test_highlight(self, month, day, expected_id):
        r = requests.get(f"{API}/hijri-highlight", params={"month": month, "day": day}, timeout=15)
        assert r.status_code == 200
        h = r.json().get("highlight")
        assert h and h["id"] == expected_id


# ─── notif-prefs ────────────────────────────────────────
class TestNotifPrefs:
    def test_get_and_put(self):
        uid = "TEST_iter6_prefs_user"
        g = requests.get(f"{API}/notif-prefs/{uid}", timeout=10)
        assert g.status_code == 200
        body = g.json()
        assert body["user_id"] == uid
        assert "_id" not in body

        # Toggle one pref
        body["tahajjud"] = True
        p = requests.put(f"{API}/notif-prefs", json=body, timeout=10)
        assert p.status_code == 200
        assert p.json()["tahajjud"] is True

        g2 = requests.get(f"{API}/notif-prefs/{uid}", timeout=10)
        assert g2.json()["tahajjud"] is True


# ─── push registration ──────────────────────────────────
class TestRegisterPush:
    def test_pending_with_placeholder_key(self):
        r = requests.post(f"{API}/register-push", json={
            "user_id": "TEST_iter6_push_user",
            "platform": "android",
            "device_token": "TEST_TOKEN_iter6",
        }, timeout=15)
        assert r.status_code == 201, r.text
        body = r.json()
        # Per spec: placeholder key → status pending, NOT 500
        assert body["status"] == "pending"


# ─── notifications feed + preview/sample/test ───────────
class TestNotifications:
    def test_feed_empty_user(self):
        r = requests.get(f"{API}/notifications/feed/TEST_iter6_empty_user", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_feed_unread_count(self):
        r = requests.get(f"{API}/notifications/feed/TEST_iter6_empty_user/unread-count", timeout=10)
        assert r.status_code == 200
        assert "unread" in r.json()

    def test_feed_mark_read(self):
        r = requests.post(f"{API}/notifications/feed/read/TEST_iter6_empty_user", timeout=10)
        assert r.status_code == 200
        assert r.json()["marked"] is True

    def test_preview(self):
        r = requests.get(f"{API}/notifications/preview", timeout=10)
        assert r.status_code == 200
        assert r.json()

    @pytest.mark.parametrize("category,key", [
        ("fard", "Fajr"),
        ("pre_adhan", "Dhuhr"),
        ("adhkar", "morning"),
        ("tahajjud", None),
        ("sunnah", "household"),
    ])
    def test_sample(self, category, key):
        params = {"category": category}
        if key:
            params["key"] = key
        r = requests.get(f"{API}/notifications/sample", params=params, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "title" in body and "message" in body

    def test_sample_unknown_category(self):
        r = requests.get(f"{API}/notifications/sample", params={"category": "bogus"}, timeout=10)
        assert r.status_code == 400

    def test_notifications_test(self):
        r = requests.post(f"{API}/notifications/test", json={
            "user_id": "TEST_iter6_test_push_user",
            "category": "fard",
            "key": "Fajr",
        }, timeout=15)
        assert r.status_code == 200
        body = r.json()
        # Should NOT crash even when push key is placeholder
        assert body["status"] in ("sent", "pending")
        assert "payload" in body


# ─── refactor structural assertion (informational) ──────
_BACKEND_DIR = Path(__file__).resolve().parents[1]  # backend/


class TestRefactorStructure:
    def test_server_py_thin(self):
        path = _BACKEND_DIR / "server.py"
        if not path.exists():
            pytest.skip("server.py not found")
        with open(path) as f:
            n = sum(1 for _ in f)
        assert n <= 70, f"server.py is {n} lines, expected ≤70 after refactor"

    def test_routers_directory(self):
        d = _BACKEND_DIR / "routers"
        assert d.is_dir()
        d = str(d)
        files = {f for f in os.listdir(d) if f.endswith(".py") and f != "__init__.py"}
        expected = {"users.py", "emotions.py", "azkar.py", "bookmarks.py", "sunnah.py", "prayers.py", "notifications.py"}
        assert expected <= files, f"Missing router modules: {expected - files}"
