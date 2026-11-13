import json
from fastapi import HTTPException
from sqlalchemy import func, select

from .models import (Artifact, ArtifactVersion, Assertion, AssertionRevision, Evidence,
                     FollowUp, HistoryPage, Receipt, ReviewContext, ReviewEvent, View, new_id)
from .schemas import INPUT_TYPES
from .security import digest, fail, utc


def scoped(db, model, identity, repository_id):
    row = db.get(model, identity)
    if row is None or row.repository_id != repository_id:
        fail("not_found", 404)
    return row


def projection(context):
    return {
        "contextId": context.id, "repositoryId": context.repository_id,
        "assertionRevisionId": context.assertion_revision_id, "kind": context.kind,
        "baseRevision": context.base_revision, "targetRevision": context.target_revision,
        "comparisonId": context.comparison_id, "initialValidity": context.initial_validity,
        "validity": context.validity, "resolution": context.resolution,
        "projectionVersion": context.projection_version,
        "effectiveJudgmentEventId": context.effective_judgment_event_id,
        "successorContextId": context.successor_context_id,
    }


def follow_up(row):
    return {"id": row.id, "contextId": row.context_id,
            "assertionRevisionId": row.assertion_revision_id,
            "openedByEventId": row.opened_by_event_id, "kind": row.kind,
            "status": row.status, "resolutionEventId": row.resolution_event_id}


def assertion_data(db, revision):
    assertion = scoped(db, Assertion, revision.assertion_id, revision.repository_id)
    return {"id": revision.id, "assertionId": assertion.id,
            "repositoryId": revision.repository_id, "type": assertion.type,
            "source": revision.source, "target": revision.target,
            "evidenceIds": revision.evidence_ids, "methodId": revision.method_id,
            "limitations": revision.limitations,
            "supersedesRevisionId": revision.supersedes_revision_id}


def evidence_data(row):
    return {"id": row.id, "artifactVersionId": row.artifact_version_id,
            "locator": row.locator, "availability": row.availability,
            "reason": row.reason, "methodId": row.method_id,
            "excerptDigest": {"algorithm": "sha256", "value": row.excerpt_digest} if row.excerpt_digest else None}


def available_version(db, repository_id, endpoint):
    if endpoint.get("availability") != "available" or not endpoint.get("versionId"):
        fail("missing_evidence", details={"evidenceIds": []})
    version = scoped(db, ArtifactVersion, endpoint["versionId"], repository_id)
    scoped(db, Artifact, version.artifact_id, repository_id)
    if version.artifact_id != endpoint.get("artifactId") or digest(version.content) != version.digest:
        fail("missing_evidence", details={"evidenceIds": []})
    return version


def evidence_excerpt(db, evidence):
    if evidence.availability != "available":
        fail("missing_evidence", details={"evidenceIds": [evidence.id]})
    version = scoped(db, ArtifactVersion, evidence.artifact_version_id, evidence.repository_id)
    locator = evidence.locator
    if digest(version.content) != version.digest or locator.get("kind") != "lines":
        fail("missing_evidence", details={"evidenceIds": [evidence.id]})
    start, end = locator.get("startLine"), locator.get("endLine")
    lines = version.content.splitlines()
    if type(start) is not int or type(end) is not int or start < 1 or end < start or end > len(lines):
        fail("missing_evidence", details={"evidenceIds": [evidence.id]})
    excerpt = "\n".join(lines[start - 1:end])
    if digest(excerpt) != evidence.excerpt_digest:
        fail("missing_evidence", details={"evidenceIds": [evidence.id]})
    return excerpt


def readable_evidence(db, row, include_excerpt=False):
    result, excerpt = evidence_data(row), None
    if row.availability == "available":
        try:
            excerpt = evidence_excerpt(db, row)
        except HTTPException as exc:
            if exc.detail["code"] != "missing_evidence":
                raise
            result.update(availability="unresolved", reason="Recorded evidence cannot be resolved against its exact source.")
    if include_excerpt:
        result["excerpt"] = excerpt
    return result


def validate_evidence(db, revision, reviewed_ids):
    if set(reviewed_ids) != set(revision.evidence_ids) or not reviewed_ids:
        fail("invalid_input", details={"fields": ["reviewedEvidenceIds"]})
    source = available_version(db, revision.repository_id, revision.source)
    target = available_version(db, revision.repository_id, revision.target)
    for evidence_id in reviewed_ids:
        evidence = scoped(db, Evidence, evidence_id, revision.repository_id)
        if evidence.artifact_version_id not in {source.id, target.id}:
            fail("invalid_input", details={"fields": ["reviewedEvidenceIds"]})
        evidence_excerpt(db, evidence)


def append_event(db, context, actor, event_type, reason, payload):
    previous = db.scalar(select(func.max(ReviewEvent.sequence)).where(ReviewEvent.context_id == context.id)) or 0
    event = ReviewEvent(repository_id=context.repository_id, context_id=context.id,
                        assertion_revision_id=context.assertion_revision_id,
                        actor_id=actor.id, recorded_at=utc(), sequence=previous + 1,
                        type=event_type, reason=reason, payload=payload)
    db.add(event)
    db.flush()
    return event


def open_work(db, context, actor, kind, note, related_id):
    if related_id:
        related = scoped(db, ReviewEvent, related_id, context.repository_id)
        if related.context_id != context.id or related.type != "judgment":
            fail("invalid_input")
    work_id = new_id()
    event = append_event(db, context, actor, "follow_up_opened", note,
                         {"workKind": kind, "relatedJudgmentEventId": related_id, "followUpId": work_id})
    work = FollowUp(id=work_id, repository_id=context.repository_id, context_id=context.id,
                    assertion_revision_id=context.assertion_revision_id,
                    opened_by_event_id=event.id, kind=kind)
    db.add(work)
    db.flush()
    return event


def effective_judgments(db, context):
    events = list(db.scalars(select(ReviewEvent).where(ReviewEvent.context_id == context.id).order_by(ReviewEvent.sequence)))
    reversed_ids = {event.payload["eventId"] for event in events if event.type == "reversal"}
    return [event for event in events if event.type == "judgment" and event.id not in reversed_ids]


def command(db, actor, repository, envelope):
    data = INPUT_TYPES[envelope.command].model_validate(envelope.input)
    canonical = json.dumps(envelope.model_dump(), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    fingerprint = digest(canonical)
    key = (actor.id, repository.id, envelope.command, envelope.requestId)
    prior = db.get(Receipt, key)
    if prior:
        if prior.input_digest != fingerprint:
            fail("idempotency_conflict", 409)
        return prior.result

    view = scoped(db, View, envelope.viewId, repository.id)
    context = scoped(db, ReviewContext, data.contextId, repository.id)
    if view.context_id != context.id or view.assertion_revision_id != data.assertionRevisionId or context.assertion_revision_id != data.assertionRevisionId:
        fail("invalid_input")
    if view.mode != "active" or context.resolution == "superseded":
        fail("historical_context")
    if context.projection_version != data.expectedProjectionVersion:
        fail("stale_projection", 409, {"currentProjectionVersion": context.projection_version})
    revision = scoped(db, AssertionRevision, context.assertion_revision_id, repository.id)
    events = []
    successor = None

    if envelope.command == "record_judgment":
        allowed = {("candidate", "open"): {"confirm", "reject"},
                   ("stale", "open"): {"reconfirm", "retire"},
                   ("confirmed", "resolved"): {"retire"}}
        if data.decision not in allowed.get((context.validity, context.resolution), set()):
            fail("invalid_transition", details={"validity": context.validity, "resolution": context.resolution})
        if not set(data.reviewedEvidenceIds) <= set(revision.evidence_ids):
            fail("invalid_input", details={"fields": ["reviewedEvidenceIds"]})
        if data.decision in {"confirm", "reconfirm"}:
            validate_evidence(db, revision, data.reviewedEvidenceIds)
        event = append_event(db, context, actor, "judgment", data.reason, {
            "decision": data.decision, "reviewedEvidenceIds": data.reviewedEvidenceIds,
            "contentConcern": data.contentConcern,
        })
        events.append(event.id)
        context.validity = {"confirm": "confirmed", "reconfirm": "confirmed", "reject": "rejected", "retire": "retired"}[data.decision]
        context.resolution = "resolved"
        context.effective_judgment_event_id = event.id
        if data.followUpDisposition.kind == "open":
            work_event = open_work(db, context, actor, data.followUpDisposition.workKind,
                                   data.followUpDisposition.note, event.id)
            events.append(work_event.id)

    elif envelope.command == "reverse_judgment":
        target = scoped(db, ReviewEvent, data.eventId, repository.id)
        if target.context_id != context.id or target.type != "judgment":
            fail("invalid_input")
        judgments = effective_judgments(db, context)
        if not judgments or judgments[-1].id != target.id:
            fail("judgment_conflict", 409)
        event = append_event(db, context, actor, "reversal", data.reason, {"eventId": target.id})
        events.append(event.id)
        previous = judgments[-2] if len(judgments) > 1 else None
        context.effective_judgment_event_id = previous.id if previous else None
        context.validity = ({"confirm": "confirmed", "reconfirm": "confirmed", "reject": "rejected", "retire": "retired"}[previous.payload["decision"]]
                            if previous else context.initial_validity)
        context.resolution = "resolved" if previous else "open"

    elif envelope.command == "open_follow_up":
        events.append(open_work(db, context, actor, data.workKind, data.note, data.relatedJudgmentEventId).id)

    elif envelope.command == "resolve_follow_up":
        work = scoped(db, FollowUp, data.followUpId, repository.id)
        if work.context_id != context.id or work.assertion_revision_id != revision.id:
            fail("invalid_input")
        if work.status != "open":
            fail("invalid_transition", details={"validity": context.validity, "resolution": context.resolution})
        event = append_event(db, context, actor, "follow_up_resolved", data.verificationNote,
                             {"followUpId": work.id, "verificationNote": data.verificationNote})
        events.append(event.id)
        work.status, work.resolution_event_id = "resolved", event.id

    elif envelope.command == "correct_assertion":
        if context.resolution != "open" or context.validity not in {"candidate", "stale"}:
            fail("invalid_transition", details={"validity": context.validity, "resolution": context.resolution})
        replacement = data.replacement
        source = scoped(db, ArtifactVersion, replacement.sourceVersionId, repository.id)
        target = scoped(db, ArtifactVersion, replacement.targetVersionId, repository.id)
        source_artifact = scoped(db, Artifact, replacement.sourceArtifactId, repository.id)
        target_artifact = scoped(db, Artifact, replacement.targetArtifactId, repository.id)
        if source.artifact_id != source_artifact.id or target.artifact_id != target_artifact.id:
            fail("invalid_input")
        if source_artifact.kind != "document" or target_artifact.kind != "code":
            fail("invalid_input", details={"fields": ["replacement"]})
        old_assertion = scoped(db, Assertion, revision.assertion_id, repository.id)
        same = (old_assertion.type == replacement.type and old_assertion.source_artifact_id == source_artifact.id
                and old_assertion.target_artifact_id == target_artifact.id)
        assertion = old_assertion
        if not same:
            assertion = Assertion(repository_id=repository.id, type=replacement.type,
                                  source_artifact_id=source_artifact.id, target_artifact_id=target_artifact.id,
                                  predecessor_id=old_assertion.id)
            db.add(assertion)
            db.flush()
        successor_revision = AssertionRevision(repository_id=repository.id, assertion_id=assertion.id,
            source={"artifactId": source_artifact.id, "versionId": source.id, "availability": "available", "reason": None, "priorVersionId": None},
            target={"artifactId": target_artifact.id, "versionId": target.id, "availability": "available", "reason": None, "priorVersionId": None},
            evidence_ids=replacement.evidenceIds, method_id="manual-correction-v1",
            limitations=["Manual correction; requires a separate human judgment."], supersedes_revision_id=revision.id)
        validate_evidence(db, successor_revision, replacement.evidenceIds)
        db.add(successor_revision)
        db.flush()
        successor = ReviewContext(repository_id=repository.id, assertion_revision_id=successor_revision.id,
            kind=context.kind, base_revision=context.base_revision, target_revision=context.target_revision,
            comparison_id=context.comparison_id)
        db.add(successor)
        db.flush()
        successor_view = View(repository_id=repository.id, context_id=successor.id,
                              assertion_revision_id=successor_revision.id, mode="active")
        db.add(successor_view)
        db.flush()
        event = append_event(db, context, actor, "correction", data.reason, {
            "successorContextId": successor.id, "successorAssertionRevisionId": successor_revision.id,
            "successorViewId": successor_view.id, "replacement": replacement.model_dump()})
        events.append(event.id)
        context.resolution, context.successor_context_id = "superseded", successor.id

    context.projection_version += 1
    repository.snapshot_version += 1
    db.flush()
    works = list(db.scalars(select(FollowUp).where(FollowUp.context_id == context.id).order_by(FollowUp.id)))
    result = {"eventIds": events, "projection": projection(context), "followUps": [follow_up(work) for work in works]}
    if successor:
        result["successorProjection"] = projection(successor)
        result["successorViewId"] = successor_view.id
    response = {"schemaVersion": "0.1.0", "requestId": envelope.requestId, "result": result}
    db.add(Receipt(actor_id=actor.id, repository_id=repository.id, command=envelope.command,
                   request_id=envelope.requestId, input_digest=fingerprint, result=response))
    db.flush()
    return response


def history(db, repository_id, view_id, context_id, cursor, page_size):
    context = scoped(db, ReviewContext, context_id, repository_id)
    view = scoped(db, View, view_id, repository_id)
    if view.context_id != context.id:
        fail("invalid_input")
    if cursor:
        page = scoped(db, HistoryPage, cursor, repository_id)
        if page.context_id != context_id or page.view_id != view_id:
            fail("invalid_input", details={"fields": ["cursor"]})
        high_water, after = page.high_water, page.after_sequence
    else:
        high_water = db.scalar(select(func.max(ReviewEvent.sequence)).where(ReviewEvent.context_id == context_id)) or 0
        after = 0
    events = list(db.scalars(select(ReviewEvent).where(ReviewEvent.context_id == context_id,
                  ReviewEvent.sequence > after, ReviewEvent.sequence <= high_water)
                  .order_by(ReviewEvent.sequence).limit(page_size + 1)))
    reversals = list(db.scalars(select(ReviewEvent).where(ReviewEvent.context_id == context_id,
                     ReviewEvent.sequence <= high_water, ReviewEvent.type == "reversal")))
    reversed_by = {event.payload["eventId"]: event.id for event in reversals}
    revision = scoped(db, AssertionRevision, context.assertion_revision_id, repository_id)
    references = {"artifactVersionIds": [endpoint["versionId"] for endpoint in [revision.source, revision.target] if endpoint.get("versionId")],
                  "evidenceIds": revision.evidence_ids}
    items = [{"id": event.id, "repositoryId": event.repository_id, "contextId": event.context_id,
              "assertionRevisionId": event.assertion_revision_id, "actorId": event.actor_id,
              "recordedAt": event.recorded_at, "sequence": event.sequence, "type": event.type,
              "reason": event.reason, "payload": event.payload, "references": references,
              "reversedByEventId": reversed_by.get(event.id)} for event in events[:page_size]]
    next_cursor = None
    if len(events) > page_size:
        page = HistoryPage(repository_id=repository_id, context_id=context_id,
                           view_id=view_id, high_water=high_water, after_sequence=events[page_size - 1].sequence)
        db.add(page)
        db.flush()
        next_cursor = page.id
    return {"snapshotSequence": high_water, "items": items, "nextCursor": next_cursor}
