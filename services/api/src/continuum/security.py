import hashlib
import secrets
import time
from datetime import datetime, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from .models import Account, Grant, LoginLimit, Repository, Session

passwords = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)
DUMMY_HASH = passwords.hash(secrets.token_urlsafe(32))


def digest(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def utc(timestamp=None):
    return datetime.fromtimestamp(time.time() if timestamp is None else timestamp, timezone.utc).isoformat().replace("+00:00", "Z")


MESSAGES = {
    "unauthenticated": "A current authenticated session is required.",
    "forbidden": "This request is not authorized.",
    "not_found": "The requested record was not found.",
    "invalid_input": "The request does not match the required input.",
    "historical_context": "Open an eligible active context before recording changes.",
    "invalid_transition": "This command is not allowed in the current review state.",
    "missing_evidence": "Required exact-version evidence is unavailable.",
    "stale_projection": "Review state changed. Reload before submitting again.",
    "judgment_conflict": "The latest effective judgment has changed.",
    "idempotency_conflict": "This request identity was already used with different input.",
    "unavailable": "Persistence is unavailable. Retry with the same request identity.",
    "rate_limited": "Too many login attempts. Try again later.",
    "limit_exceeded": "The request exceeds an operating limit.",
    "revision_unavailable": "The requested revision is not available in the accepted inventory.",
    "snapshot_conflict": "The selected snapshot changed. Refresh the selected context.",
    "record_conflict": "The authored record changed. Refresh its current version.",
}


def error(code, details=None):
    return {"code": code, "message": MESSAGES[code], "details": details or {}}


def fail(code, status=422, details=None):
    raise HTTPException(status_code=status, detail=error(code, details))


def cookie(response, settings, name, token, max_age):
    response.set_cookie(name, token, max_age=max_age, httponly=True,
                        secure=not settings.local_http, samesite="lax", path="/")


def check_origin(request, settings):
    if request.headers.get("origin") != settings.origin:
        fail("forbidden", 403)
    if request.headers.get("content-type", "").split(";", 1)[0].strip() != "application/json":
        fail("forbidden", 403)


def check_csrf(request, session, settings):
    check_origin(request, settings)
    if not secrets.compare_digest(request.headers.get("x-csrf-token", ""), session.csrf):
        fail("forbidden", 403)


def current_actor(db, request, settings, write=False):
    token = request.cookies.get(settings.session_cookie, "")
    session_digest = digest(token)
    # Read identity first, then acquire every authority lock in the same order as admin operations.
    initial = db.get(Session, session_digest)
    if initial is None or initial.actor_id is None:
        fail("unauthenticated", 401)
    actor = db.scalar(select(Account).where(Account.id == initial.actor_id).with_for_update())
    session = db.scalar(select(Session).where(Session.digest == session_digest).with_for_update().execution_options(populate_existing=True))
    now = int(time.time())
    if (actor is None or not actor.enabled or session is None or session.revoked
            or session.expires_at <= now or now - session.last_seen_at >= 1800
            or session.credential_version != actor.credential_version):
        fail("unauthenticated", 401)
    if write:
        check_csrf(request, session, settings)
    session.last_seen_at = now
    return actor, session


def repository_access(db, actor, repository_id, write=False):
    grant = db.scalar(select(Grant).where(
        Grant.actor_id == actor.id, Grant.repository_id == repository_id
    ).with_for_update())
    if grant is None or grant.role not in {"viewer", "reviewer"}:
        fail("forbidden", 403)
    if write and grant.role != "reviewer":
        fail("forbidden", 403)
    repository = db.scalar(select(Repository).where(Repository.id == repository_id).with_for_update())
    if repository is None:
        fail("not_found", 404)
    return repository


def login_attempt(db, login, password):
    normalized = login.strip().casefold()
    now = int(time.time())
    key = digest(normalized)
    db.execute(insert(LoginLimit).values(key=key, started_at=now, failures=0).on_conflict_do_nothing())
    limit = db.scalar(select(LoginLimit).where(LoginLimit.key == key).with_for_update())
    if now - limit.started_at >= 900:
        limit.started_at, limit.failures = now, 0
    if limit.failures >= 5:
        return None, "rate_limited"
    actor = db.scalar(select(Account).where(Account.login == normalized))
    observed_version = actor.credential_version if actor else None
    try:
        valid = passwords.verify(actor.password_hash if actor else DUMMY_HASH, password)
    except VerificationError:
        valid = False
    if actor:
        actor = db.scalar(select(Account).where(Account.id == actor.id).with_for_update().execution_options(populate_existing=True))
    if not valid or actor is None or not actor.enabled or actor.credential_version != observed_version:
        limit.failures += 1
        return None, "unauthenticated"
    limit.failures = 0
    return actor, None
