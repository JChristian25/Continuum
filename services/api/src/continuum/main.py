import secrets
import time
import uuid

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError

from .config import Settings
from .db import make_engine, session_factory
from .models import Artifact, ArtifactVersion, AssertionRevision, Evidence, ReviewContext, SecurityAudit, Session, View
from .review import assertion_data, command, history, projection, readable_evidence, scoped
from .schemas import Envelope, Login
from .security import check_csrf, cookie, current_actor, digest, error, fail, login_attempt, repository_access, utc


def create_app(settings=None, engine=None):
    settings = settings or Settings.from_env()
    engine = engine or make_engine(settings.database_url)
    factory = session_factory(engine)
    app = FastAPI(title="Continuum review API", version="0.1.0")
    app.state.engine, app.state.settings = engine, settings

    @app.middleware("http")
    async def boundaries(request, call_next):
        request.state.request_id = str(uuid.uuid4())
        if request.method in {"POST", "PUT", "PATCH"}:
            chunks, size = [], 0
            async for chunk in request.stream():
                size += len(chunk)
                if size > 262144:
                    return JSONResponse(status_code=413, content={"schemaVersion": "0.1.0", "requestId": request.state.request_id,
                        "error": error("limit_exceeded", {"limitName": "requestBytes", "maximum": 262144, "unit": "bytes"})},
                        headers={"Cache-Control": "no-store"})
                chunks.append(chunk)
            request._body = b"".join(chunks)
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.exception_handler(HTTPException)
    async def http_error(request, exc):
        detail = exc.detail if isinstance(exc.detail, dict) else error("invalid_input")
        return JSONResponse(status_code=exc.status_code, content={"schemaVersion": "0.1.0", "requestId": request.state.request_id, "error": detail})

    @app.exception_handler(RequestValidationError)
    @app.exception_handler(ValidationError)
    async def invalid_input(request, exc):
        # Validation errors can include the submitted password and must never be echoed.
        return JSONResponse(status_code=422, content={"schemaVersion": "0.1.0", "requestId": request.state.request_id,
                            "error": error("invalid_input", {"fields": []})})

    @app.exception_handler(SQLAlchemyError)
    async def unavailable(request, exc):
        return JSONResponse(status_code=503, content={"schemaVersion": "0.1.0", "requestId": request.state.request_id, "error": error("unavailable")})

    @app.get("/api/v1/health")
    def health():
        with factory.begin() as db:
            db.execute(text("SELECT 1"))
        return {"status": "ok", "version": "0.1.0"}

    @app.get("/api/v1/auth/bootstrap")
    def bootstrap(request: Request):
        if (request.headers.get("origin") not in {None, settings.origin}
                or request.headers.get("sec-fetch-site") not in {None, "same-origin", "none"}):
            fail("forbidden", 403)
        token, csrf, now = secrets.token_urlsafe(32), secrets.token_urlsafe(32), int(time.time())
        with factory.begin() as db:
            db.add(Session(digest=digest(token), actor_id=None, csrf=csrf, expires_at=now + 600))
        response = JSONResponse({"csrfToken": csrf, "expiresAt": utc(now + 600)})
        cookie(response, settings, settings.pre_cookie, token, 600)
        return response

    @app.post("/api/v1/auth/login")
    def login(request: Request, body: Login):
        request.state.request_id = body.requestId
        with factory.begin() as db:
            pre_digest = digest(request.cookies.get(settings.pre_cookie, ""))
            pre = db.get(Session, pre_digest)
            now = int(time.time())
            if pre is None or pre.actor_id is not None or pre.revoked or pre.expires_at <= now:
                fail("unauthenticated", 401)
            check_csrf(request, pre, settings)
            actor, failure = login_attempt(db, body.login, body.password)
            if failure:
                db.add(SecurityAudit(subject_actor_id=None, recorded_at=utc(), action="login", outcome=failure))
                response = JSONResponse(status_code=429 if failure == "rate_limited" else 401,
                                        content={"schemaVersion": "0.1.0", "requestId": body.requestId, "error": error(failure)})
                if failure == "rate_limited":
                    response.headers["Retry-After"] = "900"
                return response
            pre = db.scalar(select(Session).where(Session.digest == pre_digest).with_for_update().execution_options(populate_existing=True))
            if pre.revoked or pre.expires_at <= int(time.time()):
                fail("unauthenticated", 401)
            pre.revoked = True
            token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
            db.add(Session(digest=digest(token), actor_id=actor.id, csrf=csrf,
                           credential_version=actor.credential_version, expires_at=now + 28800))
            db.add(SecurityAudit(subject_actor_id=actor.id, recorded_at=utc(), action="login", outcome="success"))
            response = JSONResponse({"schemaVersion": "0.1.0", "requestId": body.requestId,
                "result": {"actorId": actor.id, "displayName": actor.display_name, "absoluteExpiresAt": utc(now + 28800)}})
        response.delete_cookie(settings.pre_cookie, path="/", secure=not settings.local_http, httponly=True, samesite="lax")
        cookie(response, settings, settings.session_cookie, token, 28800)
        return response

    @app.get("/api/v1/auth/session")
    def session(request: Request):
        with factory.begin() as db:
            actor, current = current_actor(db, request, settings)
            return {"actorId": actor.id, "displayName": actor.display_name,
                    "csrfToken": current.csrf, "absoluteExpiresAt": utc(current.expires_at)}

    @app.post("/api/v1/auth/logout")
    def logout(request: Request):
        with factory.begin() as db:
            try:
                actor, current = current_actor(db, request, settings, write=True)
            except HTTPException as exc:
                if exc.status_code != 401:
                    raise
                pre = db.get(Session, digest(request.cookies.get(settings.pre_cookie, "")))
                if pre is None or pre.actor_id is not None or pre.revoked or pre.expires_at <= int(time.time()):
                    fail("unauthenticated", 401)
                check_csrf(request, pre, settings)
            else:
                current.revoked = True
                db.add(SecurityAudit(subject_actor_id=actor.id, recorded_at=utc(), action="logout", outcome="success"))
        response = JSONResponse({"signedOut": True})
        response.delete_cookie(settings.session_cookie, path="/", secure=not settings.local_http, httponly=True, samesite="lax")
        return response

    @app.post("/api/v1/commands")
    def execute(request: Request, body: Envelope):
        request.state.request_id = body.requestId
        with factory.begin() as db:
            actor, _ = current_actor(db, request, settings, write=True)
            repository = repository_access(db, actor, body.repositoryId, write=True)
            response = command(db, actor, repository, body)
        return response

    @app.get("/api/v1/repositories/{repository_id}/contexts/{context_id}")
    def read_context(repository_id: str, context_id: str, request: Request, viewId: str):
        with factory.begin() as db:
            actor, _ = current_actor(db, request, settings)
            repository_access(db, actor, repository_id)
            context = scoped(db, ReviewContext, context_id, repository_id)
            view = scoped(db, View, viewId, repository_id)
            if view.context_id != context.id:
                fail("invalid_input")
            revision = scoped(db, AssertionRevision, context.assertion_revision_id, repository_id)
            evidence = [readable_evidence(db, scoped(db, Evidence, identity, repository_id)) for identity in revision.evidence_ids]
            return {"viewId": view.id, "mode": "historical" if context.resolution == "superseded" else view.mode,
                    "projection": projection(context), "assertion": assertion_data(db, revision), "evidence": evidence}

    @app.get("/api/v1/repositories/{repository_id}/versions/{version_id}")
    def read_version(repository_id: str, version_id: str, request: Request):
        with factory.begin() as db:
            actor, _ = current_actor(db, request, settings)
            repository_access(db, actor, repository_id)
            version = scoped(db, ArtifactVersion, version_id, repository_id)
            scoped(db, Artifact, version.artifact_id, repository_id)
            if digest(version.content) != version.digest:
                fail("missing_evidence", details={"evidenceIds": []})
            return {"id": version.id, "artifactId": version.artifact_id, "identity": version.identity,
                    "content": version.content, "contentDigest": {"algorithm": "sha256", "value": version.digest}}

    @app.get("/api/v1/repositories/{repository_id}/evidence/{evidence_id}")
    def read_evidence(repository_id: str, evidence_id: str, request: Request):
        with factory.begin() as db:
            actor, _ = current_actor(db, request, settings)
            repository_access(db, actor, repository_id)
            evidence = scoped(db, Evidence, evidence_id, repository_id)
            return readable_evidence(db, evidence, include_excerpt=True)

    @app.get("/api/v1/repositories/{repository_id}/contexts/{context_id}/history")
    def read_history(repository_id: str, context_id: str, request: Request, viewId: str,
                     cursor: str | None = None, pageSize: int = Query(default=20, ge=1, le=100)):
        with factory.begin() as db:
            actor, _ = current_actor(db, request, settings)
            repository_access(db, actor, repository_id)
            return history(db, repository_id, viewId, context_id, cursor, pageSize)

    return app


def app_factory():
    return create_app()
