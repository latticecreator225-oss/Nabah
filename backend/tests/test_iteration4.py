"""
Nabah iteration 4 backend tests:
- New endpoint: GET /api/hijri-highlight
- Schema validation + month/day overrides
- Regression sanity for earlier endpoints
"""
import os
from pathlib import Path
import pytest
import requests


def _resolve_base_url() -> str:
    """Backend base URL: explicit env → repo frontend/.env → localhost default.
    (The old default pointed at a since-retired Emergent preview URL.)"""
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

REQUIRED_KEYS = {"id", "rank", "title", "subtitle", "ar", "body", "source", "cta"}


# ─── /api/hijri-highlight ───────────────────────────────────────────────
class TestHijriHighlight:
    def test_no_params_returns_payload_shape(self):
        r = requests.get(f"{API}/hijri-highlight", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        # `highlight` may be null on a generic day — acceptable
        assert "highlight" in body
        # When override absent, the server attempts hijri lookup; both keys should appear
        # unless the upstream lookup fails, in which case at minimum 'highlight' is present.
        if body.get("highlight") is not None:
            assert REQUIRED_KEYS.issubset(set(body["highlight"].keys()))

    @pytest.mark.parametrize("month,day,expected_id,expected_rank", [
        (1, 10, "ashura", "DAY OF ASHURA"),
        (1, 9, "tasua", None),
        (12, 9, "arafah", None),
        (12, 10, "eid_adha", None),
        (9, 27, "laylat_al_qadr", "GREATEST OF NIGHTS"),
        (9, 22, "laylat_al_qadr", None),
        (8, 15, "mid_shaban", None),
        (7, 14, "white_days", None),
    ])
    def test_specific_hijri_days(self, month, day, expected_id, expected_rank):
        r = requests.get(f"{API}/hijri-highlight", params={"month": month, "day": day}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["hijri_day"] == day
        assert data["hijri_month"] == month
        h = data.get("highlight")
        assert h is not None, f"Expected highlight payload for {month}/{day}"
        assert h["id"] == expected_id, f"Expected id={expected_id} got {h['id']}"
        if expected_rank is not None:
            assert h["rank"] == expected_rank, f"Expected rank={expected_rank}, got {h['rank']}"
        assert REQUIRED_KEYS.issubset(set(h.keys())), f"Missing keys: {REQUIRED_KEYS - set(h.keys())}"

    def test_laylat_qadr_odd_vs_even(self):
        odd = requests.get(f"{API}/hijri-highlight?month=9&day=27", timeout=10).json()["highlight"]
        even = requests.get(f"{API}/hijri-highlight?month=9&day=22", timeout=10).json()["highlight"]
        assert odd["rank"] == "GREATEST OF NIGHTS"
        assert even["rank"] == "LAST TEN"

    def test_white_days_subtitle_contains_day(self):
        for d in (13, 14, 15):
            h = requests.get(f"{API}/hijri-highlight?month=7&day={d}", timeout=10).json()["highlight"]
            assert h["id"] == "white_days"
            assert str(d) in h["subtitle"]

    def test_generic_day_may_be_null(self):
        # 5 Safar (month=2, day=5) should not match anything except possibly Friday weekday
        r = requests.get(f"{API}/hijri-highlight?month=2&day=5", timeout=10)
        assert r.status_code == 200
        body = r.json()
        # Either null or Friday weekday highlight
        if body["highlight"] is not None:
            assert body["highlight"]["id"] == "jumuah"


# ─── Regression — verify prior endpoints still work ─────────────────────
class TestRegression:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        assert r.json().get("app") == "Nabah"

    def test_daily_reminder(self):
        r = requests.get(f"{API}/daily-reminder", timeout=10)
        assert r.status_code == 200

    def test_emotions_list(self):
        r = requests.get(f"{API}/emotions", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) > 0

    def test_sunnah_categories(self):
        r = requests.get(f"{API}/sunnahs/categories", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_sunnah_of_the_hour(self):
        r = requests.get(f"{API}/sunnahs/of-the-hour?hour=12", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "id" in body and "title" in body

    def test_azkar(self):
        r = requests.get(f"{API}/azkar", timeout=10)
        assert r.status_code == 200

    def test_hijri_date(self):
        r = requests.get(f"{API}/hijri-date", timeout=15)
        assert r.status_code == 200

    def test_notifications_preview(self):
        r = requests.get(f"{API}/notifications/preview", timeout=10)
        assert r.status_code == 200

    def test_register_push_pending(self):
        r = requests.post(f"{API}/register-push", json={
            "user_id": "TEST_iter4_user", "platform": "android", "device_token": "TEST_TOKEN"
        }, timeout=10)
        assert r.status_code in (200, 201)
        assert r.json().get("status") == "pending"

    def test_notif_prefs_fresh_user(self):
        r = requests.get(f"{API}/notif-prefs/TEST_iter4_pref_user", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body.get("user_id") == "TEST_iter4_pref_user"
        assert "_id" not in body  # ObjectId leak guard
