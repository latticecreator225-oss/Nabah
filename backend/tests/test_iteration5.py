"""
Nabah iteration 5 backend tests:
- New endpoint: GET /api/prayer-times (region-aware calculation method picker)
- Manual override + Asr school
- Response payload shape validation
- Regression sanity for prior endpoints
"""
import os
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
TOP_LEVEL_KEYS = {"timings", "date", "method", "method_name", "school"}


# ─── /api/prayer-times — region-aware method picker ─────────────────────
class TestPrayerTimesRegion:
    @pytest.mark.parametrize("lat,lng,expected_method,expected_name_substr", [
        (21.4225, 39.8262, 4, "Umm al-Qura"),          # Makkah
        (24.86, 67.01, 1, "Karachi"),                  # Karachi
        (51.5074, -0.1278, 3, "Muslim World League"),  # London → MWL (UK rectangle)
        (40.71, -74.0, 2, "ISNA"),                     # NYC
        (41.01, 28.97, 13, "Diyanet"),                 # Istanbul
        (30.04, 31.23, 5, "Egyptian"),                 # Cairo
        (3.14, 101.69, 17, "JAKIM"),                   # Kuala Lumpur
    ])
    def test_region_method_pick(self, lat, lng, expected_method, expected_name_substr):
        r = requests.get(f"{API}/prayer-times", params={"lat": lat, "lng": lng}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["method"] == expected_method, (
            f"For ({lat},{lng}) expected method={expected_method}, got {body['method']} ({body.get('method_name')})"
        )
        assert expected_name_substr.lower() in body["method_name"].lower(), (
            f"method_name '{body['method_name']}' does not contain '{expected_name_substr}'"
        )


class TestPrayerTimesManualOverride:
    def test_manual_override(self):
        # Makkah coords, but request MWL (method=3) explicitly
        r = requests.get(
            f"{API}/prayer-times",
            params={"lat": 21.4225, "lng": 39.8262, "method": 3},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["method"] == 3
        assert body["method_name"] == "Muslim World League"

    def test_asr_school_hanafi(self):
        r = requests.get(
            f"{API}/prayer-times",
            params={"lat": 24.86, "lng": 67.01, "school": 1},
            timeout=20,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["school"] == 1
        # Method should still resolve to Karachi
        assert body["method"] == 1


class TestPrayerTimesShape:
    def test_payload_shape(self):
        r = requests.get(f"{API}/prayer-times", params={"lat": 21.4225, "lng": 39.8262}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        # Top-level keys
        missing_top = TOP_LEVEL_KEYS - set(body.keys())
        assert not missing_top, f"Missing top-level keys: {missing_top}"

        # timings must include core prayers
        timings = body["timings"]
        assert isinstance(timings, dict)
        missing_prayers = PRAYER_KEYS - set(timings.keys())
        assert not missing_prayers, f"Missing prayer timings: {missing_prayers}"
        # Each timing should be HH:MM-ish string
        for k in PRAYER_KEYS:
            assert isinstance(timings[k], str) and ":" in timings[k]

        # date should have readable subkeys
        assert isinstance(body["date"], dict)

        # No ObjectId leak
        assert "_id" not in body

    def test_missing_lat_lng_returns_422(self):
        r = requests.get(f"{API}/prayer-times", timeout=10)
        # FastAPI returns 422 for missing required query params
        assert r.status_code == 422


# ─── Regression — prior endpoints ───────────────────────────────────────
class TestRegression:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        assert r.json().get("app") == "Nabah"

    def test_hijri_highlight_ashura(self):
        r = requests.get(f"{API}/hijri-highlight", params={"month": 1, "day": 10}, timeout=15)
        assert r.status_code == 200
        h = r.json().get("highlight")
        assert h and h["id"] == "ashura"

    def test_sunnahs_list(self):
        r = requests.get(f"{API}/sunnahs", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) > 0

    def test_azkar(self):
        r = requests.get(f"{API}/azkar", timeout=10)
        assert r.status_code == 200
        # azkar should contain morning / evening / sleep sections
        data = r.json()
        # Either dict-of-sections or list-of-sections; just verify non-empty
        assert data

    def test_notif_prefs_fresh_user(self):
        r = requests.get(f"{API}/notif-prefs/TEST_iter5_pref_user", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body.get("user_id") == "TEST_iter5_pref_user"
        assert "_id" not in body

    def test_register_push_pending(self):
        r = requests.post(
            f"{API}/register-push",
            json={"user_id": "TEST_iter5_user", "platform": "android", "device_token": "TEST_TOKEN_5"},
            timeout=10,
        )
        assert r.status_code in (200, 201)
        assert r.json().get("status") == "pending"

    def test_saved_ayahs_empty(self):
        r = requests.get(f"{API}/saved-ayahs/TEST_iter5_nonexistent_user", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_notifications_feed_unread_count(self):
        r = requests.get(f"{API}/notifications/feed/TEST_iter5_nonexistent_user/unread-count", timeout=10)
        assert r.status_code == 200
        assert "unread" in r.json()
