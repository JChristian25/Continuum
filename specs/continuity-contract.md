# Continuity records and commands v0.2

Status: proposed engineering detail for the accepted continuity cycle. This is a behavioral contract, not an existing API or an implemented schema. JSON field names below are proposed and independent of backend language and storage. All timestamps use UTC ISO-8601. IDs are opaque strings. Repository object IDs include their algorithm; display abbreviations do not identify retained source versions.

## Records

| Record | Required fields and meaning |
|---|---|
| Artifact | `id`, `repositoryId`, `kind`, `createdAt`. Kind is code, document, requirement or decision. File-backed identity is independent of a displayed line number. |
| ArtifactVersion | `id`, `artifactId`, `source`, `contentDigest`, `availability`, `limitations`. Source is either `{repositoryId, commitId, objectAlgorithm, path, blobId}` or `{recordId, recordVersion}` for authored structured records. |
| Assertion | `id`, `repositoryId`, `type`, `sourceArtifactId`, `targetArtifactId`, optional `supersedesAssertionId`. This is the identity of a claim between stable artifacts. |
| AssertionRevision | `id`, `assertionId`, `sourceVersionId`, `targetVersionId`, `evidenceIds`, `method`, `limitations`, optional `supersedesRevisionId`. Immutable exact reviewed claim. |
| Evidence | `id`, `artifactVersionId`, `locator`, `excerptDigest`, `method`, `availability`, `limitations`. Locator is a file span or a structured-record field; excerpt text is retained where permitted. Unavailable evidence has an explicit reason. |
| ReviewContext | `id`, `repositoryId`, `kind`, `targetRevision`, optional `baseRevision`, `assertionRevisionId`, `priorAssertionRevisionId`, `triggerIds`, `reason`, `validity`, `resolution`, `projectionVersion`. Initial review has a target only; comparison review identifies both commits. |
| ReviewEvent | `id`, `contextId`, `assertionRevisionId`, `type`, `actorId`, `recordedAt`, `reason`, `payload`, `sequence`. Server-issued and immutable after commit. |
| FollowUp | `id`, `contextId`, `assertionRevisionId`, `kind`, `status`, `openedByEventId`, optional `resolutionEventId`. Code update or documentation update is separate from validity. |
| Comparison | `id`, `repositoryId`, `baseRevision`, `targetRevision`, `configurationId`, `status`, `changes`, `outcomes`, `limitations`. Status is queued, running, complete, partial or failed. |
| CycleCompletion | `id`, `contextSnapshotId`, `actorId`, `recordedAt`, `acknowledgedLimitations`, `projectionVersion`. It describes a particular reviewed snapshot, not all future work in a repository. |

Each reference must belong to the same accessible project/repository. Revision and blob must resolve to the named path. A missing or invalid reference cannot be repaired by reading the current branch. Same blob content may be cached once, but each view and review retains its exact commit context.

Validities are candidate, confirmed, rejected, stale and retired. Resolution is open, resolved or superseded. Evidence availability is available, missing, unsupported or unresolved. Processing coverage is complete, partial, unsupported or unknown for a declared function and inventory. These dimensions do not substitute for each other.

For `documents`, direction is document to code. For future `calls`, it is caller to callee; `implements` is code to requirement; `motivates` is decision to code. Only `documents` automatic discovery is in the first slice. A manually recorded requirement/decision version is not automatically a confirmed relationship.

## State transitions

| Starting context | Command/event | Guards and result |
|---|---|---|
| candidate/open | confirm | Authorized actor, readable exact evidence and nonblank reason: confirmed/resolved. |
| candidate/open | reject | Authorized actor and nonblank reason: rejected/resolved. Does not add confirmed support. |
| confirmed at earlier versions | changed endpoint or evidence | New exact assertion revision/context is stale/open. Preserve earlier confirmation. |
| unconfirmed earlier versions | changed endpoint or evidence | New exact revision/context stays candidate/open. Do not label it previously confirmed. |
| stale/open | reconfirm | Exact new versions/evidence reviewed: confirmed/resolved with a new event. |
| stale or confirmed | retire | Authorized reason: retired/resolved for that context; earlier history remains. |
| candidate or stale | correct | Evidence/version correction produces a successor assertion revision. Type or stable-endpoint correction produces a replacement assertion. Prior context becomes superseded; successor starts candidate/open. Confirmation requires its own command. |
| latest effective committed judgment | reverse | Append a reversal event naming that judgment and a nonblank reason. Recompute validity from the preceding non-reversed decision, or the context's initial state. Preserve all later non-judgment activity. |

Rejected/retired contexts cannot be mutated into new claims. Open a successor context and retain predecessor references. A historical pane accepts no write command. An initial-review context can target an earlier commit before that commit is used as read-only history in a comparison.

P-03 proposes that only the latest effective judgment in the selected active context is reversible; reversing an older judgment after a newer one returns a conflict. Follow-up events are not deleted by reversal. Their notes remain visible, and their interpretation may need reassessment if the judgment they followed is reversed. Cycle completion is a snapshot record: new review work or reversal makes current completion incomplete without deleting the historical completion.

## Revision comparison and propagation

Resolve both selected commits before processing. A comparison uses immutable blobs and a declared supported-file inventory. Equal commits yield no changes. Record added, modified and deleted paths; rename/copy identity is unresolved in this first slice unless explicitly reviewed. Deleted source can be read through its earlier version; missing incoming evidence prevents confirmation.

For every registered assertion with changed endpoint content, new evidence, deleted endpoint or uncertain mapping, create one context keyed by assertion and comparison. Retain trigger and relationship path. One hop reaches the opposite endpoint; no transitive traversal is part of v1. A changed document can request code inspection and a changed code file can request document inspection without changing the meaning or direction of the edge. Unchanged endpoint content and evidence produce an explicit unchanged outcome and no new review from this rule.

Comparison retry must not duplicate assertion revisions, contexts or events. Missing source/history or exceeded processing limits produces partial or failed with affected scope, never an apparently complete empty result. Absence from an incomplete candidate set cannot establish no impact.

## Discovery proposal P-08

Use deterministic lexical evidence within the declared Python/Markdown/plain-text inventory. It is intentionally a candidate generator whose output requires human review.

1. Read version-pinned UTF-8 text; record unsupported encoding or unreadable input. Markdown code blocks, prose and plain-text documents are text evidence. Do not execute source examples.
2. At each documentation line, collect explicit repository-relative `.py` paths. A path that resolves within the selected inventory proposes a `documents` candidate with that exact line and the code file's version. An unresolved path is recorded as unresolved evidence.
3. For lexical matching, split letters/digits on punctuation, underscores and camel-case boundaries, then lowercase. Keep tokens of at least four characters; exclude Python reserved words and the fixed stop words `this, that, with, from, have, will, your, into, return, returns, true, false, none, code, file`. Version this rule and list as part of configuration.
4. Index code-file identifier tokens and filename stems. A documentation line sharing one retained token with an indexed code file proposes a candidate. Record the matched token, documentation line and first matching code span; collapse repeated matches into one assertion proposal per typed pair while retaining evidence. An ambiguous token can generate multiple unconfirmed candidates; no confidence probability or automatic acceptance is implied.
5. Co-change at or before the selected target revision can be attached as additional evidence only when its Git objects are available. Co-change after that revision cannot influence its baseline discovery. Co-change alone does not satisfy the lexical discovery check.

P-08 is a concrete proposal, not a selected algorithm with measured quality. The broad lexical rule may produce many weak candidates; report that result rather than silently tuning it until the demonstration passes. Freeze configuration and inventory before a repeatable integration check. Manual capture has a separate result and cannot count as successful automatic discovery.

## Command contracts

Transport proposal: JSON over an application API, with a version prefix selected during backend design. A backend schema should generate the final API description; this document defines the domain semantics and must not become a separately maintained server-schema copy.

| Command/query | Required input | Success | Failure behavior |
|---|---|---|---|
| Read artifact version/evidence | accessible artifact/version or evidence ID | Exact source metadata, content/availability and limitations | Absent/inaccessible reference: not found; never substitute another revision. |
| Capture structured record | kind, title, content, source reference if available | New artifact and immutable record version | Invalid kind/blank content: validation error, no partial record. |
| Discover candidates | repository, target commit, inventory/configuration IDs | Candidate/evidence records, completeness and method | Unsupported/missing/over-limit scope is explicit; rerun is deterministic within fixed inputs. |
| Compare revisions | repository, base and target commits, configuration ID | Accepted comparison identity; status queried separately | Invalid/missing commit: explicit error; processing failure retains attempt/result. |
| Record judgment | contextId, assertionRevisionId, decision, reason, contentConcern, followUpDisposition, expectedProjectionVersion | Event plus new projection and follow-up state | Permission, evidence, transition or conflict failure: no partial writes. |
| Correct assertion | contextId, expectedProjectionVersion, reason, complete typed replacement and exact endpoint/evidence IDs | Successor claim/revision, predecessor reference and open context | Wrong type/reference/version: validation error, unchanged predecessor. |
| Reverse judgment | contextId, eventId, reason, expectedProjectionVersion | Reversal event and recomputed projection | Not latest effective judgment: conflict; unrelated history untouched. |
| Resolve follow-up | followUpId, reason/verification note, expectedProjectionVersion | Resolution event; no change to relationship validity | Viewer/revoked actor or blank note: reject; preserve open work. |
| Read history | context/assertion ID, snapshot cursor, page size | Immutable events and exact versions, stable order and next cursor | Invalid cursor: validation error; unavailable source remains labeled. |
| Complete cycle / export | selected snapshot ID/version, limitation acknowledgment | Snapshot completion or export carrying selected repository, revisions and results | Pending reviews or stale snapshot: conflict; never use fixed fixture labels. |

All write commands require server-resolved actor, repository permission and a nonempty idempotency key. The server ignores/rejects supplied actor-role fields as authority. P-09 proposes a simple reviewer/viewer permission model for the bounded demonstration; the authentication mechanism remains open. Every command, including intent capture, follow-up resolution and cycle completion, must use the same fail-closed check.

Same actor, repository, command and idempotency key with identical canonical input returns the originally committed result, even after the projection advances. Reuse with different input returns conflict. Authenticate and validate access before returning any prior receipt. Check an existing receipt before enforcing the original expected projection version. A new command requires atomic compare-and-append of its event, domain projection and receipt. If the chosen storage cannot guarantee that transaction, the implementation is not ready for HC-07.

The client keeps the draft and request key until delivery is resolved. A timeout means unknown delivery; query or retry with the same key. Never create a new key just to escape a timeout. Conflict recovery reloads the projection and preserves local draft text for explicit resubmission. Navigation must not attach a response to a different selected artifact/context.

Proposed failure categories: unauthenticated, forbidden, not_found, invalid_input, invalid_transition, missing_evidence, revision_unavailable, stale_projection, idempotency_conflict and unavailable. HTTP mapping is 401, 403, 404, 422, 422, 422, 422, 409, 409 and 503 respectively. Error objects carry code, safe message and requestId. Content and credentials do not appear in generic errors.

## Frontend read models

P-04 uses one `HistoryEntry` view with eventId, contextId, assertionRevisionId, actorLabel, recordedAt, actionLabel, decision, rationale, followUp and source references. A fixture adapter maps baseline date/status/rationale/excerpt and local time/action/detail into that shape. Preserve source fields; parse no invented timestamp from display labels such as `Today`. An unavailable actor/date renders unavailable. History count equals displayed eligible entries.

A queue item has its own context and assertion identity, selected artifact, relationship type/direction, versions, evidence availability, validity and independent follow-up. Shared helpers derive queue progress, summary and export from one snapshot. A file with two links may have two queue items. Draft state is keyed by context and assertion revision, so switching the inspector cannot overwrite another draft.

Demo and service responses identify their provenance explicitly. Local-storage demo writes must report failure; a display update in memory alone is not a durable save. The existing visual design can render these models without replacing the shell or modules.
