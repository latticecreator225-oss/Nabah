"""
Nabah · Direct Firebase Cloud Messaging (FCM HTTP v1) sender.

Replaces the previous Emergent/SuprSend relay: the backend now talks to FCM
directly using a Firebase service account, so no third-party push platform sits
in the path. Device tokens are the native FCM tokens the app registers via
POST /api/register-push (stored in db.push_tokens).

Configuration (backend/.env) — either form works:
  FIREBASE_PROJECT_ID             — your Firebase project id (optional if present
                                    in the service-account JSON)
  GOOGLE_APPLICATION_CREDENTIALS  — path to the service-account JSON file, OR
  FIREBASE_SERVICE_ACCOUNT_JSON   — the service-account JSON inline (string)

If no credential is configured, push runs in a logged no-op mode so local dev
and CI still work without Firebase.
"""
from __future__ import annotations

import asyncio
import json
import os
from typing import Dict, List, Optional

import httpx

from deps import db, logger

_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
_FCM_ENDPOINT = "https://fcm.googleapis.com/v1/projects/{project}/messages:send"


class FcmPush:
    def __init__(self) -> None:
        self._project_id = os.environ.get("FIREBASE_PROJECT_ID", "").strip()
        self._creds = None
        self._client = httpx.AsyncClient(timeout=10.0)
        self._load_credentials()

    def _load_credentials(self) -> None:
        raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
        path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
        info: Optional[dict] = None
        try:
            if raw:
                info = json.loads(raw)
            elif path and os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    info = json.load(f)
        except Exception as e:
            logger.warning(f"FCM: could not read service account: {e}")

        if not info:
            logger.warning(
                "FCM: no service account configured — push delivery runs in no-op "
                "mode. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON."
            )
            return

        try:
            from google.oauth2 import service_account  # google-auth

            self._creds = service_account.Credentials.from_service_account_info(
                info, scopes=[_SCOPE]
            )
            if not self._project_id:
                self._project_id = info.get("project_id", "")
        except Exception as e:
            logger.warning(f"FCM: credential init failed: {e}")
            self._creds = None

    @property
    def enabled(self) -> bool:
        return bool(self._creds and self._project_id)

    def _access_token_sync(self) -> Optional[str]:
        # google-auth caches and refreshes the token; its refresh is blocking, so
        # callers invoke this via asyncio.to_thread.
        if not self._creds:
            return None
        try:
            from google.auth.transport.requests import Request

            if not self._creds.valid:
                self._creds.refresh(Request())
            return self._creds.token
        except Exception as e:
            logger.warning(f"FCM: token refresh failed: {e}")
            return None

    async def _access_token(self) -> Optional[str]:
        return await asyncio.to_thread(self._access_token_sync)

    async def send_to_user(self, user_id: str, data: Dict[str, str]) -> str:
        """Deliver one payload to every device the user has registered.

        Returns a short delivery status for the notifications feed:
        "sent" | "no_device" | "pending" (not configured) | "failed" | "error(...)".
        """
        if not self.enabled:
            return "pending"
        try:
            rows = await db.push_tokens.find(
                {"user_id": user_id}, {"_id": 0, "device_token": 1}
            ).to_list(20)
        except Exception as e:
            logger.warning(f"FCM: token lookup failed for {user_id}: {e}")
            return f"error({type(e).__name__})"

        tokens: List[str] = [r.get("device_token") for r in rows if r.get("device_token")]
        if not tokens:
            return "no_device"

        access = await self._access_token()
        if not access:
            return "error(no_token)"

        sent = 0
        for tok in tokens:
            if await self._send_one(access, tok, data, user_id):
                sent += 1
        return "sent" if sent else "failed"

    async def _send_one(self, access_token: str, device_token: str,
                        data: Dict[str, str], user_id: str) -> bool:
        title = data.get("title", "Nabah")
        body = data.get("message", "")
        # FCM data values must all be strings.
        data_payload = {k: str(v) for k, v in data.items() if v is not None}
        message = {
            "message": {
                "token": device_token,
                "notification": {"title": title, "body": body},
                "data": data_payload,
                "android": {
                    "priority": "high",
                    "notification": {"channel_id": "default", "default_sound": True},
                },
            }
        }
        url = _FCM_ENDPOINT.format(project=self._project_id)
        try:
            resp = await self._client.post(
                url, headers={"Authorization": f"Bearer {access_token}"}, json=message
            )
            if resp.status_code == 200:
                return True
            # Prune tokens FCM reports as no longer valid.
            text = resp.text or ""
            if resp.status_code in (404, 400) and (
                "UNREGISTERED" in text
                or "NOT_FOUND" in text
                or "registration-token-not-registered" in text
                or "INVALID_ARGUMENT" in text
            ):
                try:
                    await db.push_tokens.delete_one(
                        {"user_id": user_id, "device_token": device_token}
                    )
                    logger.info(f"FCM: pruned stale token for {user_id}")
                except Exception:
                    pass
            else:
                logger.warning(f"FCM send failed {resp.status_code}: {text[:200]}")
            return False
        except Exception as e:
            logger.warning(f"FCM send error: {e}")
            return False

    async def aclose(self) -> None:
        try:
            await self._client.aclose()
        except Exception:
            pass


# Module-level singleton, imported by the scheduler and the notifications router.
fcm = FcmPush()
