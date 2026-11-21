import secrets
import time
import uuid
import json
from contextlib import asynccontextmanager
from threading import Event, Thread

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError

from .config import Settings
from .acquisition import AcquisitionError
from .db import make_engine, session_factory
from .models import Artifact, ArtifactVersion, AssertionRevision, Evidence, FollowUp, Grant, Repository, ReviewContext, SecurityAudit, Session, View
from .review import assertion_data, command, follow_up, history, load_scoped_map, projection, readable_evidence, scoped
from .schemas import Envelope, Login
from .pipeline import admit, query
from .pipeline_schemas import QueryEnvelope
from .pipeline_models import ReviewViewBinding, Selection, Snapshot
from .pipeline_models import Activity, EvidenceOrigin, InputRegistration, ProfileRegistration, RevisionOrigin
from .acquisition import WORKSPACE, sha256
from .discovery import extract_artifact_structure, load_profile
from .git_lens import (
    compute_file_blame,
    enrich_revision_entry,
    get_commit_diff,
    list_repo_commits,
    resolve_git_dir_from_manifest,
    resolve_repo_git_dir,
)
from .local_repo import (
    GitInspectInput,
    RevisionAddInput,
    WorkspaceCreateInput,
    add_custom_revision,
    create_custom_workspace,
    inspect_git_repository,
    is_custom_manifest,
    load_any_accepted,
    remote_connection,
)
from .capture import execute as capture_command
from .comparison import compare, prior_decision_map
from .security import check_csrf, cookie, current_actor, digest, error, fail, login_attempt, repository_access, utc


def create_app(settings=None, engine=None, *, worker_enabled=True):
    settings = settings or Settings.from_env()
    engine = engine or make_engine(settings.database_url)
    factory = session_factory(engine)
    @asynccontextmanager
    async def lifespan(app):
        from .worker import worker_loop
        stop = Event()
        worker = Thread(target=worker_loop, args=(factory, stop), daemon=True, name="continuum-worker")
        if worker_enabled:
            worker.start()
        try:
            yield
        finally:
            stop.set()
            if worker_enabled:
                worker.join(timeout=5)

    app = FastAPI(title="Continuum review API", version="0.1.0", lifespan=lifespan)
    app.state.engine, app.state.settings = engine, settings

    @app.middleware("http")
    async def boundaries(request, call_next):
        request.state.request_id = str(uuid.uuid4())
        if request.method in {"POST", "PUT", "PATCH"}:
            is_bundle_upload = request.url.path == "/api/v1/workspaces" or request.url.path.endswith("/revisions")
            max_bytes = 5 * 1024 * 1024 if is_bundle_upload else 262144
            chunks, size = [], 0
            async for chunk in request.stream():
                size += len(chunk)
                if size > max_bytes:
                    return JSONResponse(status_code=413, content={"schemaVersion": "0.1.0", "requestId": request.state.request_id,
                        "error": error("limit_exceeded", {"limitName": "requestBytes", "maximum": max_bytes, "unit": "bytes"})},
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
    @app.exception_handler(AcquisitionError)
    @app.exception_handler(OSError)
    @app.exception_handler(json.JSONDecodeError)
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

    @app.get("/api/v1/workspace")
    def workspace(request: Request):
        with factory.begin() as db:
            actor, _ = current_actor(db, request, settings)
            ids = list(db.scalars(select(Grant.repository_id).where(Grant.actor_id == actor.id,
                                  Grant.role.in_(["viewer", "reviewer"])).order_by(Grant.repository_id)))
            repositories = []
            for identity in ids:
                repository = repository_access(db, actor, identity)
                role = db.get(Grant, (actor.id, identity)).role
                inputs = []
                for registered in db.scalars(select(InputRegistration).where(InputRegistration.repository_id == identity).order_by(InputRegistration.id)):
                    manifest, acceptance, manifest_digest, acceptance_digest, _ = load_any_accepted(
                        WORKSPACE / registered.manifest_path, WORKSPACE / registered.acceptance_path, WORKSPACE)
                    if manifest_digest != registered.manifest_digest or acceptance_digest != registered.acceptance_digest:
                        fail("unavailable", 503)
                    profiles = []
                    for configured in db.scalars(select(ProfileRegistration).where(ProfileRegistration.repository_id == identity,
                                                  ProfileRegistration.inventory_id == registered.id).order_by(ProfileRegistration.id)):
                        profile, profile_digest = load_profile(WORKSPACE / configured.profile_path,
                            WORKSPACE / configured.acceptance_path, manifest_digest)
                        if profile_digest != configured.profile_digest or sha256((WORKSPACE / configured.acceptance_path).read_bytes()) != configured.acceptance_digest:
                            fail("unavailable", 503)
                        profiles.append({"id": configured.id, "methodId": profile["methodId"],
                                         "digest": profile_digest, "limitations": profile["limitations"]})
                    is_custom = is_custom_manifest(WORKSPACE / registered.acceptance_path, WORKSPACE)
                    git_dir = resolve_git_dir_from_manifest(manifest, WORKSPACE)
                    inputs.append((
                        (1 if is_custom else 0, str(acceptance.get("acceptedAt") or ""), registered.id),
                        {"id": registered.id, "repositoryFullName": manifest["repository"]["fullName"],
                         "manifestDigest": manifest_digest, "pathCount": len(manifest["entries"]), "language": "Python",
                         "isCustom": is_custom,
                         "gitRepoPath": str(git_dir) if git_dir else manifest["repository"].get("gitRepoPath"),
                         **remote_connection(manifest["repository"], git_dir, settings),
                         "revisions": [enrich_revision_entry(label, revision, git_dir)
                                       for label, revision in manifest["revisions"].items()], "profiles": profiles},
                    ))
                inputs.sort(key=lambda item: item[0])
                repositories.append({"id": identity, "name": repository.name, "role": role, "inputs": [item[1] for item in inputs]})
            return {
                "actorId": actor.id,
                "displayName": actor.display_name,
                "capabilities": {
                    "customWorkspaces": settings.allow_custom_workspaces,
                    "localGit": settings.allow_local_git,
                    "gitClone": settings.allow_local_git,
                },
                "repositories": repositories,
            }

    @app.post("/api/v1/git/inspect")
    def inspect_git_route(request: Request, body: GitInspectInput):
        request.state.request_id = body.requestId
        with factory.begin() as db:
            current_actor(db, request, settings, write=True)
            result = inspect_git_repository(body, settings)
        return {"schemaVersion": "0.1.0", "requestId": body.requestId, "result": result}

    @app.post("/api/v1/workspaces")
    def create_workspace_route(request: Request, body: WorkspaceCreateInput):
        request.state.request_id = body.requestId
        with factory.begin() as db:
            actor, _ = current_actor(db, request, settings, write=True)
            result = create_custom_workspace(db, actor, body, settings)
        return {"schemaVersion": "0.1.0", "requestId": body.requestId, "result": result}

    @app.post("/api/v1/repositories/{repository_id}/revisions")
    def add_revision_route(repository_id: str, request: Request, body: RevisionAddInput):
        request.state.request_id = body.requestId
        with factory.begin() as db:
            actor, _ = current_actor(db, request, settings, write=True)
            repository = repository_access(db, actor, repository_id, write=True)
            result = add_custom_revision(db, actor, repository, body, settings)
        return {"schemaVersion": "0.1.0", "requestId": body.requestId, "result": result}

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
            repository = repository_access(db, actor, body.repositoryId, write=body.command != "export_snapshot")
            if body.command in {"complete_cycle", "export_snapshot"}:
                from .cycle import execute as cycle_command
                response = cycle_command(db, actor, repository, body)
            elif body.command == "compare_revisions":
                response = compare(db, actor, repository, body)
            elif body.command in {"capture_files", "discover_candidates"}:
                response = admit(db, actor, repository, body)
            elif body.command in {"capture_record", "revise_record", "capture_candidate"}:
                response = capture_command(db, actor, repository, body)
            else:
                response = command(db, actor, repository, body)
        return response

    @app.post("/api/v1/queries")
    def execute_query(request: Request, body: QueryEnvelope):
        request.state.request_id = body.requestId
        with factory.begin() as db:
            actor, _ = current_actor(db, request, settings, write=True)
            repository = repository_access(db, actor, body.repositoryId)
            result = query(db, repository, body)
        return {"schemaVersion": "0.1.0", "requestId": body.requestId, "result": result}

    @app.get("/api/v1/repositories/{repository_id}/contexts/{context_id}")
    def read_context(repository_id: str, context_id: str, request: Request, viewId: str, includeExcerpts: bool = False):
        with factory.begin() as db:
            actor, _ = current_actor(db, request, settings)
            repository_access(db, actor, repository_id)
            context = scoped(db, ReviewContext, context_id, repository_id)
            view = scoped(db, View, viewId, repository_id)
            if view.context_id != context.id:
                fail("invalid_input")
            def resolve_prior(comp_doc):
                if comp_doc is None and context.comparison_id:
                    activity = db.get(Activity, context.comparison_id)
                    comp_doc = activity.document if activity else None
                return prior_decision_map(db, comp_doc).get(context.id) if comp_doc else None
            def enrich_evidence_list(evidence_ids, rows_by_id=None):
                ev_map = rows_by_id if rows_by_id is not None else load_scoped_map(db, Evidence, evidence_ids, repository_id)
                origins_by_ev = ({row.evidence_id: row for row in db.scalars(select(EvidenceOrigin).where(EvidenceOrigin.evidence_id.in_(evidence_ids)))}
                                 if includeExcerpts and evidence_ids else {})
                act_ids = list({origin.activity_id for origin in origins_by_ev.values()})
                act_docs = {row.id: row.document for row in db.scalars(select(Activity).where(Activity.id.in_(act_ids)))} if act_ids else {}
                version_cache = {}
                enriched = []
                for identity in evidence_ids:
                    item = readable_evidence(db, ev_map[identity], include_excerpt=includeExcerpts, version_cache=version_cache)
                    if includeExcerpts:
                        origin = origins_by_ev.get(identity)
                        item["provenance"] = act_docs.get(origin.activity_id) if origin else None
                    enriched.append(item)
                return enriched
            binding = db.get(ReviewViewBinding, view.id)
            if binding:
                retained = db.get(Snapshot, binding.snapshot_id)
                selected = db.get(Selection, binding.selection_id)
                item = next(row for row in retained.document["assertions"] if row["projection"]["contextId"] == context.id)
                mode = "historical" if view.mode == "historical" or selected.snapshot_version != retained.snapshot_version or context.resolution == "superseded" else "active"
                result = {"viewId": view.id, "mode": mode, **item,
                          "followUps": [work for work in retained.document["followUps"] if work["contextId"] == context.id],
                          "priorDecision": resolve_prior(retained.document.get("comparison"))}
                if includeExcerpts:
                    result = {**result, "evidence": enrich_evidence_list([e["id"] for e in item["evidence"]])}
                return result
            revision = scoped(db, AssertionRevision, context.assertion_revision_id, repository_id)
            evidence = enrich_evidence_list(revision.evidence_ids)
            origin = db.get(RevisionOrigin, revision.id)
            return {"viewId": view.id, "mode": "historical" if context.resolution == "superseded" else view.mode,
                    "projection": projection(context), "assertion": assertion_data(db, revision), "evidence": evidence,
                    "provenance": db.get(Activity, origin.activity_id).document if origin else None,
                    "followUps": [follow_up(work) for work in db.scalars(select(FollowUp).where(FollowUp.context_id == context.id).order_by(FollowUp.id))],
                    "priorDecision": resolve_prior(None)}

    @app.get("/api/v1/repositories/{repository_id}/versions/{version_id}")
    def read_version(repository_id: str, version_id: str, request: Request):
        with factory.begin() as db:
            actor, _ = current_actor(db, request, settings)
            repository_access(db, actor, repository_id)
            version = scoped(db, ArtifactVersion, version_id, repository_id)
            artifact = scoped(db, Artifact, version.artifact_id, repository_id)
            if digest(version.content) != version.digest:
                fail("missing_evidence", details={"evidenceIds": []})
            structure = extract_artifact_structure(artifact.kind, artifact.path, version.identity, version.content)
            return {"id": version.id, "artifactId": version.artifact_id, "identity": version.identity,
                    "content": version.content, "contentDigest": {"algorithm": "sha256", "value": version.digest},
                    "structure": structure}

    @app.get("/api/v1/repositories/{repository_id}/versions/{version_id}/blame")
    def read_version_blame(repository_id: str, version_id: str, request: Request):
        with factory.begin() as db:
            actor, _ = current_actor(db, request, settings)
            repository_access(db, actor, repository_id)
            version = scoped(db, ArtifactVersion, version_id, repository_id)
            artifact = scoped(db, Artifact, version.artifact_id, repository_id)
            git_dir = resolve_repo_git_dir(db, repository_id, WORKSPACE)
            commit_id = (version.identity.get("commit") or {}).get("commitId", "") if isinstance(version.identity, dict) else ""
            return compute_file_blame(
                git_dir,
                commit_id,
                artifact.path,
                fallback_content=version.content,
                fallback_identity=version.identity if isinstance(version.identity, dict) else {},
            )

    @app.get("/api/v1/repositories/{repository_id}/git/commits")
    def read_git_commits(
        repository_id: str,
        request: Request,
        ref: str = "HEAD",
        limit: int = Query(default=40, ge=1, le=200),
        path: str | None = None,
    ):
        with factory.begin() as db:
            actor, _ = current_actor(db, request, settings)
            repository_access(db, actor, repository_id)
            git_dir = resolve_repo_git_dir(db, repository_id, WORKSPACE)
            if git_dir is None:
                return {"available": False, "repoPath": None, "commits": []}
            return {
                "available": True,
                "repoPath": str(git_dir),
                "commits": list_repo_commits(git_dir, ref=ref, limit=limit, path=path),
            }

    @app.get("/api/v1/repositories/{repository_id}/git/commits/{commit_id}")
    def read_git_commit_detail(
        repository_id: str,
        commit_id: str,
        request: Request,
        path: str | None = None,
    ):
        with factory.begin() as db:
            actor, _ = current_actor(db, request, settings)
            repository_access(db, actor, repository_id)
            git_dir = resolve_repo_git_dir(db, repository_id, WORKSPACE)
            detail = get_commit_diff(git_dir, commit_id, file_path=path)
            if detail is None:
                fail("not_found", 404)
            return detail

    @app.get("/api/v1/repositories/{repository_id}/evidence/{evidence_id}")
    def read_evidence(repository_id: str, evidence_id: str, request: Request):
        with factory.begin() as db:
            actor, _ = current_actor(db, request, settings)
            repository_access(db, actor, repository_id)
            evidence = scoped(db, Evidence, evidence_id, repository_id)
            origin = db.get(EvidenceOrigin, evidence.id)
            return {**readable_evidence(db, evidence, include_excerpt=True),
                    "provenance": db.get(Activity, origin.activity_id).document if origin else None}

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
