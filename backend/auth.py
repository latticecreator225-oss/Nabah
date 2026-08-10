"""
Nabah · Lightweight bearer-token auth.

Every user is issued an opaque token at creation (`POST /users`). The client
stores it and sends it as `Authorization: Bearer <token>` on every request that
touches that user's data. We store only a SHA-256 hash of the token, so a leaked
database never reveals a usable credential.

This is deliberately minimal — no passwords, no sessions, no third-party IdP —
because the app has no login step: the token *is* the identity, minted once and
kept on-device. It exists to stop one user (or an anonymous caller) from reading
or mutating another user's profile, location, prefs, or bookmarks.
"""
from __future__ import annotations

import hashlib
import secrets
from typing import Optional

from fastapi import Header, HTTPException

from deps import db


def new_token() -> tuple[str, str]:
    """Return (plaintext_token, token_hash). Only the hash is ever stored."""
    tok = secrets.token_urlsafe(32)
    return tok, hash_token(tok)


def hash_token(tok: str) -> str:
    return hashlib.sha256(tok.encode("utf-8")).hexdigest()


def _extract_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(None, 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip() or None
    return None


async def _user_for_token(authorization: Optional[str]) -> Optional[dict]:
    tok = _extract_bearer(authorization)
    if not tok:
        return None
    return await db.users.find_one({"token_hash": hash_token(tok)}, {"_id": 0})


async def current_user_id(authorization: Optional[str] = Header(default=None)) -> str:
    """FastAPI dependency: the authenticated user's id, or 401."""
    user = await _user_for_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user["id"]


async def optional_user_id(authorization: Optional[str] = Header(default=None)) -> Optional[str]:
    """FastAPI dependency: the authenticated user's id if a valid token is
    present, else None. For endpoints that serve public content but personalise
    when a caller is known."""
    user = await _user_for_token(authorization)
    return user["id"] if user else None


def assert_owner(resource_user_id: str, auth_user_id: str) -> None:
    """403 unless the authenticated caller owns the addressed resource."""
    if resource_user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="You do not have access to this resource")
