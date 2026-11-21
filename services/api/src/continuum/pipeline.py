import json
import time
from types import SimpleNamespace
import uuid

from sqlalchemy import event, func, select, text

from pathlib import PurePosixPath
import re
from .acquisition import WORKSPACE, contained, sha256
from .discovery import _compile_rules, _extract_tokens, extract_artifact_structure, load_profile, summarize_artifact_structure
from .local_repo import load_any_accepted, load_any_sources
from .models import (Artifact, ArtifactVersion, Assertion, AssertionRevision, Evidence, FollowUp,
                     Receipt, ReviewContext, ReviewEvent, View, new_id)
from .pipeline_models import (Activity, InputRegistration, Operation, ProfileRegistration, RepositoryView, RevisionOrigin, SelectedRecord,
                              ResultPage, ReviewViewBinding, Selection, SelectionArtifact,
                              SelectionContext, Snapshot)
from .pipeline_schemas import (ActivityInput, OperationInput, ProcessingInput, ResultsInput, ReviewViewInput,
                               SelectionInput, SnapshotInput, SnapshotListInput, WorkspaceInput)
from .review import assertion_data_from, evidence_data, follow_up, load_scoped_map, projection, scoped
from .security import digest, fail


def stable(*parts):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, json.dumps(parts, separators=(",", ":"), ensure_ascii=False)))


def register_input(db, repository_id, manifest_path, acceptance_path):
    manifest_path, acceptance_path = contained(manifest_path, WORKSPACE), contained(acceptance_path, WORKSPACE)
    manifest, _, manifest_digest, acceptance_digest, _ = load_any_accepted(manifest_path, acceptance_path, WORKSPACE)
    for label in manifest["revisions"]:
        load_any_sources(manifest_path, acceptance_path, label)
    identity = stable(repository_id, "input", manifest_digest)
    row = db.get(InputRegistration, identity)
    if row is None:
        row = InputRegistration(id=identity, repository_id=repository_id,
            manifest_path=manifest_path.relative_to(WORKSPACE).as_posix(), acceptance_path=acceptance_path.relative_to(WORKSPACE).as_posix(),
            manifest_digest=manifest_digest, acceptance_digest=acceptance_digest)
        db.add(row)
        db.flush()
    elif row.acceptance_digest != acceptance_digest:
        fail("idempotency_conflict", 409)
    return row


def register_profile(db, repository_id, inventory_id, profile_path, acceptance_path):
    inventory = scoped(db, InputRegistration, inventory_id, repository_id)
    profile_path, acceptance_path = contained(profile_path, WORKSPACE), contained(acceptance_path, WORKSPACE)
    _, profile_digest = load_profile(profile_path, acceptance_path, inventory.manifest_digest)
    identity = stable(repository_id, "profile", profile_digest)
    row = db.get(ProfileRegistration, identity)
    if row is None:
        row = ProfileRegistration(id=identity, repository_id=repository_id, inventory_id=inventory_id,
            profile_path=profile_path.relative_to(WORKSPACE).as_posix(), acceptance_path=acceptance_path.relative_to(WORKSPACE).as_posix(),
            profile_digest=profile_digest, acceptance_digest=sha256(acceptance_path.read_bytes()))
        db.add(row)
        db.flush()
    elif row.inventory_id != inventory_id or row.acceptance_digest != sha256(acceptance_path.read_bytes()):
        fail("idempotency_conflict", 409)
    return row


def registered_inputs(db, repository_id, inventory_id, configuration_id):
    inventory = scoped(db, InputRegistration, inventory_id, repository_id)
    config = scoped(db, ProfileRegistration, configuration_id, repository_id)
    if config.inventory_id != inventory.id:
        fail("invalid_input", details={"fields": ["configurationId"]})
    manifest_path, acceptance_path = WORKSPACE / inventory.manifest_path, WORKSPACE / inventory.acceptance_path
    manifest, _, manifest_digest, acceptance_digest, _ = load_any_accepted(manifest_path, acceptance_path, WORKSPACE)
    if manifest_digest != inventory.manifest_digest or acceptance_digest != inventory.acceptance_digest:
        fail("invalid_input", details={"fields": ["inventoryId"]})
    profile, profile_digest = load_profile(WORKSPACE / config.profile_path, WORKSPACE / config.acceptance_path, manifest_digest)
    if profile_digest != config.profile_digest or sha256((WORKSPACE / config.acceptance_path).read_bytes()) != config.acceptance_digest:
        fail("invalid_input", details={"fields": ["configurationId"]})
    return inventory, config, manifest, profile


def selection_data(selection):
    return {**({"comparisonId": selection.id} if selection.base_revision else {}), "repositoryId": selection.repository_id, "targetRevision": selection.target_revision,
            "baseRevision": selection.base_revision, "inventoryId": selection.inventory_id,
            "configurationId": selection.configuration_id}


def select_initial(db, repository_id, data):
    if data.comparisonId:
        selected = scoped(db, Selection, data.comparisonId, repository_id)
        if selection_data(selected) != data.model_dump():
            fail('invalid_input')
        return selected
    if data.repositoryId != repository_id or data.baseRevision is not None:
        fail("invalid_input", details={"fields": ["repositoryId", "baseRevision"]})
    _, _, manifest, _ = registered_inputs(db, repository_id, data.inventoryId, data.configurationId)
    if data.targetRevision.objectAlgorithm != "sha1" or not any(
            revision["commitId"] == data.targetRevision.commitId for revision in manifest["revisions"].values()):
        fail("revision_unavailable")
    identity = stable(repository_id, data.inventoryId, data.configurationId, data.targetRevision.commitId)
    selection = db.get(Selection, identity)
    if selection is None:
        selection = Selection(id=identity, repository_id=repository_id, inventory_id=data.inventoryId,
            configuration_id=data.configurationId, target_revision=data.targetRevision.model_dump(), base_revision=None)
        db.add(selection)
        db.flush()
    return selection


def operation_data(operation, selection):
    return {"id": operation.id, "kind": operation.kind, "status": operation.status,
            "selection": selection_data(selection), "resultSnapshotId": operation.result_snapshot_id,
            "coverage": operation.coverage, "limitations": operation.limitations}


def _attach_signal_meta(assertions, versions, artifacts_by_id, evidence_by_id, profile):
    if not assertions:
        return
    rules = _compile_rules(profile)
    lines_by_version = {v.id: v.content.splitlines() for v in versions}
    per_item = []
    pair_df = {}
    for item in assertions:
        a = item["assertion"]
        src_art = artifacts_by_id.get(a["source"]["artifactId"])
        tgt_art = artifacts_by_id.get(a["target"]["artifactId"])
        src_vid = a["source"].get("versionId")
        tgt_vid = a["target"].get("versionId")
        src_tokens, tgt_tokens = set(), set()
        has_explicit = False
        tgt_path = tgt_art.path.lower() if tgt_art else ""
        for ev_ref in item["evidence"]:
            ev = evidence_by_id.get(ev_ref["id"])
            if ev is None:
                continue
            loc = ev.locator or {}
            if loc.get("kind") == "field":
                has_explicit = True
                continue
            if loc.get("kind") != "lines":
                continue
            lines = lines_by_version.get(ev.artifact_version_id)
            if not lines:
                continue
            start = max(1, int(loc.get("startLine", 1)))
            end = min(len(lines), int(loc.get("endLine", start)))
            excerpt = "\n".join(lines[start - 1:end])
            if tgt_path and tgt_path in excerpt.lower():
                has_explicit = True
            toks = _extract_tokens(excerpt, rules)
            if ev.artifact_version_id == src_vid:
                src_tokens.update(toks)
            elif ev.artifact_version_id == tgt_vid:
                tgt_tokens.update(toks)
        shared = src_tokens & tgt_tokens if (src_tokens and tgt_tokens) else (src_tokens | tgt_tokens)
        for tok in shared:
            pair_df[tok] = pair_df.get(tok, 0) + 1
        stem_tokens = set()
        for art in (src_art, tgt_art):
            if art and art.path:
                stem_tokens.update(re.findall(r"[a-z0-9]{4,}", PurePosixPath(art.path).stem.lower()))
        per_item.append((item, shared, has_explicit, bool(shared & stem_tokens)))
    total = len(assertions)
    rare_cutoff = max(2, int(total * 0.35))
    for item, shared, has_explicit, stem_overlap in per_item:
        rare = sum(1 for tok in shared if pair_df.get(tok, total) <= rare_cutoff)
        top = sorted(shared, key=lambda tok: (pair_df.get(tok, total), tok))[:5]
        item["signalMeta"] = {
            "uniqueTokenCount": len(shared),
            "rareTokenCount": rare,
            "hasExplicitPath": has_explicit,
            "stemOverlap": stem_overlap,
            "topTokens": top,
        }


def make_snapshot(db, selection):
    _, _, manifest, profile = registered_inputs(db, selection.repository_id, selection.inventory_id, selection.configuration_id)
    retained = db.scalar(select(Snapshot).where(Snapshot.selection_id == selection.id, Snapshot.snapshot_version == selection.snapshot_version).order_by(Snapshot.id))
    if retained is not None:
        return retained
    target_commit = selection.target_revision.get("commitId") if isinstance(selection.target_revision, dict) else None
    rev_label = next((lbl for lbl, rev in manifest["revisions"].items() if rev.get("commitId") == target_commit), None)
    eligible = sum(1 for e in manifest["entries"] if rev_label in e.get("revisions", {})) if rev_label else len(manifest["entries"])
    context_ids = list(db.scalars(select(SelectionContext.context_id).where(SelectionContext.selection_id == selection.id)))
    contexts = list(db.scalars(select(ReviewContext).where(ReviewContext.id.in_(context_ids)).order_by(ReviewContext.id))) if context_ids else []
    works = list(db.scalars(select(FollowUp).where(FollowUp.context_id.in_(context_ids)).order_by(FollowUp.id))) if context_ids else []
    versions = list(db.scalars(select(ArtifactVersion).join(SelectionArtifact, SelectionArtifact.version_id == ArtifactVersion.id)
                               .where(SelectionArtifact.selection_id == selection.id).order_by(ArtifactVersion.id)))
    captured_files = len(versions)
    versions += list(db.scalars(select(ArtifactVersion).join(SelectedRecord, SelectedRecord.version_id == ArtifactVersion.id)
                                .where(SelectedRecord.selection_id == selection.id).order_by(ArtifactVersion.id)))
    operations = list(db.scalars(select(Operation).where(Operation.selection_id == selection.id).order_by(Operation.published_version, Operation.id)))
    coverage = [{"function": "ingestion", "status": "complete" if captured_files == eligible else "unknown",
                 "eligibleCount": eligible, "processedCount": captured_files, "excludedCount": 0,
                 "limitations": ["Only the accepted file inventory is included."]}]
    for function in ["extraction", "evidence", "change_handling", "search", "graph"]:
        status = "unknown" if function in {"extraction", "evidence"} else "unsupported"
        coverage.append({"function": function, "status": status, "eligibleCount": None,
                         "processedCount": 0, "excludedCount": None,
                         "limitations": ["No complete processing claim for this function in this snapshot."]})
    inventory = manifest["revisions"].get(rev_label, {}).get("gitInventory")
    limitations = {"Search is literal within retained captured scope; graph access is typed and one-hop only."}
    if inventory:
        scope = "all tracked paths" if inventory["selectedPaths"] is None else f'{inventory["selectedPaths"]} requested paths'
        limitations.add(f'Git inventory for {scope}: {eligible} eligible text files, {len(inventory["excluded"])} exclusions.')
    elif manifest["repository"].get("sourceMode"):
        limitations.add("Coverage applies to the registered workspace inventory.")
    else:
        limitations.add("Bounded Healthchecks input; not complete project coverage.")
    for operation in operations:
        limitations.update(operation.limitations)
        for item in operation.coverage:
            coverage = [current for current in coverage if current["function"] != item["function"]] + [item]
    for function in ['search', 'graph']:
        coverage = [c for c in coverage if c['function'] != function] + [{'function': function, 'status': 'partial', 'eligibleCount': None, 'processedCount': len(versions) if function == 'search' else len(contexts), 'excludedCount': None, 'limitations': ['Selected captured scope only; no semantic or transitive completeness claim.']}]
    if selection.base_revision:
        coverage = [c for c in coverage if c['function'] != 'change_handling'] + [{'function': 'change_handling', 'status': 'partial', 'eligibleCount': len(versions), 'processedCount': len(versions), 'excludedCount': None, 'limitations': ['Native Git on retained bytes and direct typed endpoint impact; no rename inference.']}]
    limitations.update(profile["limitations"])
    if inventory:
        coverage = [{**item, "excludedCount": len(inventory["excluded"])} if item["function"] == "ingestion"
                    else item for item in coverage]
    header = {"id": new_id(), "selection": selection_data(selection), "snapshotVersion": selection.snapshot_version,
        "provenance": "real", "contextVersions": [{"contextId": row.id, "projectionVersion": row.projection_version} for row in contexts],
        "coverage": coverage, "pendingReviewCount": sum(row.resolution == "open" and row.validity in {"candidate", "stale"} for row in contexts),
        "staleReviewCount": sum(row.resolution == "open" and row.validity == "stale" for row in contexts),
        "openCandidateCount": sum(row.resolution == "open" and row.validity == "candidate" for row in contexts),
        "deferredCount": sum(row.resolution == "deferred" and row.validity == "candidate" for row in contexts),
        "screenedCount": sum(row.resolution == "screened" and row.validity == "candidate" for row in contexts),
        "unresolvedCandidateCount": sum(row.validity == "candidate" and row.resolution in {"open", "deferred", "screened"} for row in contexts),
        "openFollowUpCount": sum(row.status == "open" for row in works), "limitations": sorted(limitations)}
    revision_ids = [context.assertion_revision_id for context in contexts]
    revisions_by_id = load_scoped_map(db, AssertionRevision, revision_ids, selection.repository_id)
    assertions_by_id = load_scoped_map(db, Assertion, [rev.assertion_id for rev in revisions_by_id.values()], selection.repository_id)
    evidence_by_id = load_scoped_map(db, Evidence, [eid for rev in revisions_by_id.values() for eid in rev.evidence_ids], selection.repository_id)
    origins_by_rev = {row.revision_id: row for row in db.scalars(select(RevisionOrigin).where(RevisionOrigin.revision_id.in_(revision_ids)))} if revision_ids else {}
    activity_ids = list({origin.activity_id for origin in origins_by_rev.values()})
    activities_by_id = {row.id: row for row in db.scalars(select(Activity).where(Activity.id.in_(activity_ids)))} if activity_ids else {}
    max_seq_by_ctx = dict(db.execute(select(ReviewEvent.context_id, func.max(ReviewEvent.sequence))
                                     .where(ReviewEvent.context_id.in_(context_ids)).group_by(ReviewEvent.context_id)).all()) if context_ids else {}
    artifacts_by_id = load_scoped_map(db, Artifact, [version.artifact_id for version in versions], selection.repository_id)

    assertions = []
    for context in contexts:
        revision = revisions_by_id[context.assertion_revision_id]
        origin = origins_by_rev.get(revision.id)
        activity = activities_by_id.get(origin.activity_id) if origin else None
        assertions.append({
            "assertion": assertion_data_from(assertions_by_id[revision.assertion_id], revision),
            "projection": projection(context),
            "evidence": [evidence_data(evidence_by_id[identity]) for identity in revision.evidence_ids],
            "provenance": activity.document if activity else None,
            "historySequence": max_seq_by_ctx.get(context.id) or 0,
        })
    _attach_signal_meta(assertions, versions, artifacts_by_id, evidence_by_id, profile)
    artifacts = []
    for version in versions:
        artifact = artifacts_by_id[version.artifact_id]
        summary = summarize_artifact_structure(artifact.kind, artifact.path, version.identity, version.content, version.digest)
        artifacts.append({"artifactId": artifact.id, "kind": artifact.kind, "path": artifact.path,
                          "versionId": version.id, "identity": version.identity, "contentDigest": version.digest,
                          "structureSummary": summary})
    row = Snapshot(id=header["id"], repository_id=selection.repository_id, selection_id=selection.id,
                   snapshot_version=selection.snapshot_version,
                   document={"snapshot": header, "assertions": assertions, "artifacts": artifacts,
                             "followUps": [follow_up(work) for work in works],
                             "processing": [{"id": o.id, "kind": o.kind, "status": o.status, "limitations": o.limitations}
                                            for o in operations if o.kind in {"capture", "discovery"}],
                             "comparison": db.get(Activity, selection.id).document if selection.base_revision else None})
    db.add(row)
    db.flush()
    _schedule_neo4j_sync(db, row)
    return row


def _schedule_neo4j_sync(db, snapshot_row):
    from .graph_store import sync_snapshot_to_neo4j

    pending = db.info.setdefault("_neo4j_snapshots", [])
    pending.append(
        SimpleNamespace(
            id=snapshot_row.id,
            repository_id=snapshot_row.repository_id,
            snapshot_version=snapshot_row.snapshot_version,
            document=snapshot_row.document,
        )
    )
    if not db.info.get("_neo4j_hooked"):
        db.info["_neo4j_hooked"] = True

        @event.listens_for(db, "after_commit", once=False)
        def _sync_committed_snapshots(session):
            for snap in session.info.pop("_neo4j_snapshots", []):
                sync_snapshot_to_neo4j(snap)

        @event.listens_for(db, "after_rollback", once=False)
        def _clear_rolled_back_snapshots(session):
            session.info.pop("_neo4j_snapshots", None)


def schedule_rq_enqueue(db, operation_id):
    from .worker import enqueue_operation

    schema = db.scalar(text("SELECT current_schema()"))
    pending = db.info.setdefault("_rq_operations", [])
    pending.append((operation_id, schema))
    if not db.info.get("_rq_hooked"):
        db.info["_rq_hooked"] = True

        @event.listens_for(db, "after_commit", once=False)
        def _enqueue_committed_operations(session):
            for op_id, op_schema in session.info.pop("_rq_operations", []):
                enqueue_operation(op_id, schema=op_schema)

        @event.listens_for(db, "after_rollback", once=False)
        def _clear_rolled_back_operations(session):
            session.info.pop("_rq_operations", None)


def admit(db, actor, repository, envelope):
    data = ProcessingInput.model_validate(envelope.input)
    fingerprint = digest(json.dumps(envelope.model_dump(), sort_keys=True, separators=(",", ":"), ensure_ascii=False))
    key = actor.id, repository.id, envelope.command, envelope.requestId
    prior = db.get(Receipt, key)
    if prior:
        if prior.input_digest != fingerprint:
            fail("idempotency_conflict", 409)
        return prior.result
    view = scoped(db, RepositoryView, envelope.viewId, repository.id)
    selection = scoped(db, Selection, view.selection_id, repository.id)
    if view.mode != "active" or selection.base_revision:
        fail("historical_context")
    if data.targetRevision.model_dump() != selection.target_revision or data.inventoryId != selection.inventory_id or data.configurationId != selection.configuration_id:
        fail("invalid_input")
    _, _, _, profile = registered_inputs(db, repository.id, data.inventoryId, data.configurationId)
    operation = Operation(repository_id=repository.id, selection_id=selection.id, actor_id=actor.id,
        kind="capture" if envelope.command == "capture_files" else "discovery",
        deadline_at=int(time.time()) + profile["limits"]["maximumOperationSeconds"])
    db.add(operation)
    db.flush()
    response = {"schemaVersion": "0.1.0", "requestId": envelope.requestId, "result": {"operationId": operation.id, "status": "queued"}}
    db.add(Receipt(actor_id=actor.id, repository_id=repository.id, command=envelope.command,
                   request_id=envelope.requestId, input_digest=fingerprint, result=response))
    db.flush()
    schedule_rq_enqueue(db, operation.id)
    return response


def query(db, repository, envelope):
    from .access import search, graph, read_assertion, SearchInput, GraphInput, AssertionInput
    if envelope.query in {"search_records", "read_graph", "read_assertion"}:
        model, function = {"search_records": (SearchInput, search), "read_graph": (GraphInput, graph), "read_assertion": (AssertionInput, read_assertion)}[envelope.query]
        return function(db, repository, model.model_validate(envelope.input))
    if envelope.query == "read_release_record":
        from .release import read_record
        from .pipeline_schemas import ReleaseInput
        return read_record(ReleaseInput.model_validate(envelope.input).releaseRecordId)
    if envelope.query == "read_export":
        from .cycle import read_export
        return read_export(db, repository, OperationInput.model_validate(envelope.input).operationId)
    if envelope.query == "read_workspace":
        data = WorkspaceInput.model_validate(envelope.input)
        snapshot = scoped(db, Snapshot, data.snapshotId, repository.id)
        selection = scoped(db, Selection, snapshot.selection_id, repository.id)
        from .comparison import enrich_comparison
        from .cycle import completion
        from .git_lens import enrich_revision_entry, get_commit_metadata, resolve_repo_git_dir
        from .progress import workspace_progress
        doc = snapshot.document
        if doc.get("comparison"):
            doc = {**doc, "comparison": enrich_comparison(db, doc["comparison"])}
        git_dir = resolve_repo_git_dir(db, repository.id, WORKSPACE)
        target_cid = (selection.target_revision or {}).get("commitId", "")
        base_cid = (selection.base_revision or {}).get("commitId", "") if selection.base_revision else ""
        _, _, manifest, _ = registered_inputs(db, repository.id, selection.inventory_id, selection.configuration_id)
        rev_by_cid = {rev.get("commitId"): (lbl, rev) for lbl, rev in manifest.get("revisions", {}).items()}
        tgt_pair = rev_by_cid.get(target_cid)
        target_meta = enrich_revision_entry(tgt_pair[0], tgt_pair[1], git_dir) if tgt_pair else get_commit_metadata(git_dir, target_cid)
        base_pair = rev_by_cid.get(base_cid) if base_cid else None
        base_meta = (enrich_revision_entry(base_pair[0], base_pair[1], git_dir) if base_pair else get_commit_metadata(git_dir, base_cid)) if base_cid else None
        return {**doc, "gitInventory": tgt_pair[1].get("gitInventory") if tgt_pair else None,
                "revisionMeta": {"target": target_meta, "base": base_meta}, "progress": workspace_progress(db, snapshot, selection), "completion": completion(db, snapshot), "currentSnapshotVersion": selection.snapshot_version,
                "mode": "active" if selection.snapshot_version == snapshot.snapshot_version else "historical"}
    if envelope.query == "list_snapshots":
        data = SnapshotListInput.model_validate(envelope.input)
        view = scoped(db, RepositoryView, data.repositoryViewId, repository.id)
        selected = scoped(db, Selection, view.selection_id, repository.id)
        rows = db.execute(select(Snapshot.id, Snapshot.snapshot_version).where(Snapshot.selection_id == selected.id)
                          .order_by(Snapshot.snapshot_version.desc(), Snapshot.id.desc()).limit(100)).all()
        retained = {}
        for identity, version in rows:
            retained.setdefault(version, {"snapshotId": identity, "snapshotVersion": version,
                                         "mode": "active" if version == selected.snapshot_version else "historical"})
        return {"items": list(retained.values()), "limitations": ["Lists distinct versions within the most recent 100 retained snapshots for this selection."]}
    if envelope.query == "read_activity":
        data = ActivityInput.model_validate(envelope.input)
        return scoped(db, Activity, data.activityId, repository.id).document
    if envelope.query in {"select_context", "read_snapshot"}:
        data = (SelectionInput.model_validate(envelope.input) if envelope.query == "select_context"
                else SnapshotInput.model_validate(envelope.input).selection)
        selection = select_initial(db, repository.id, data)
        snapshot = make_snapshot(db, selection)
        if envelope.query == "read_snapshot":
            return snapshot.document["snapshot"]
        view = RepositoryView(repository_id=repository.id, selection_id=selection.id, mode="active")
        db.add(view)
        db.flush()
        return {"selection": selection_data(selection), "repositoryViewId": view.id,
                "repositoryViewMode": view.mode, "snapshot": snapshot.document["snapshot"]}
    if envelope.query == "open_review_view":
        data = ReviewViewInput.model_validate(envelope.input)
        repository_view = scoped(db, RepositoryView, data.repositoryViewId, repository.id)
        snapshot = scoped(db, Snapshot, data.snapshotId, repository.id)
        selection = scoped(db, Selection, repository_view.selection_id, repository.id)
        context = scoped(db, ReviewContext, data.contextId, repository.id)
        if snapshot.selection_id != selection.id or not any(item["contextId"] == context.id for item in snapshot.document["snapshot"]["contextVersions"]):
            fail("invalid_input")
        mode = ("active" if repository_view.mode == "active" and snapshot.snapshot_version == selection.snapshot_version
                and context.resolution != "superseded" else "historical")
        view = View(repository_id=repository.id, context_id=context.id, assertion_revision_id=context.assertion_revision_id, mode=mode)
        db.add(view)
        db.flush()
        db.add(ReviewViewBinding(view_id=view.id, selection_id=selection.id, snapshot_id=snapshot.id))
        return {"viewId": view.id, "mode": mode, "contextId": context.id, "assertionRevisionId": context.assertion_revision_id}
    data = (OperationInput.model_validate(envelope.input) if envelope.query == "read_operation"
            else ResultsInput.model_validate(envelope.input))
    operation = scoped(db, Operation, data.operationId, repository.id)
    selection = scoped(db, Selection, operation.selection_id, repository.id)
    public = operation_data(operation, selection)
    if envelope.query == "read_operation":
        return public
    if (envelope.query == "read_capture_results" and operation.kind != "capture"
            or envelope.query == "read_discovery_results" and operation.kind != "discovery"):
        fail("invalid_input")
    if data.cursor:
        page = scoped(db, ResultPage, data.cursor, repository.id)
        if page.query != envelope.query or page.binding != operation.id:
            fail("invalid_input", details={"fields": ["cursor"]})
        items, metadata, after = page.items, page.metadata_document, page.after_index
    else:
        items, metadata, after = operation.result_items, {"operation": public}, 0
        if operation.kind == "discovery":
            metadata = {**metadata, "methodId": "lexical-file-v1", "coverage": operation.coverage, **operation.result_metadata}
    next_cursor = None
    if after + data.pageSize < len(items):
        page = ResultPage(repository_id=repository.id, query=envelope.query, binding=operation.id,
                          items=items, metadata_document=metadata, after_index=after + data.pageSize)
        db.add(page)
        db.flush()
        next_cursor = page.id
    return {**metadata, "items": items[after:after + data.pageSize], "nextCursor": next_cursor,
            "snapshotResultCount": len(items)}
