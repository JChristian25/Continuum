# Healthchecks upstream input proposal

Record: HC-UPSTREAM-2026-11-13-P1. Version: 0.1.0. Status: proposed, awaiting
review. Prepared on 2026-11-13 from public upstream metadata, commit diffs and
bounded source reads. No source checkout, local source-byte archive, ingestion,
upstream execution or Continuum integration was performed.

The user authorized preparation of this public upstream proposal. That is not
acceptance of the revisions, acquisition procedure, discovery configuration or
expected outcomes below. A-INPUT and A-DISCOVERY remain open. Task 3.1 remains
unchecked until its acceptance and reproducibility conditions are met.

This is supporting evidence for the existing change, not a second normative
specification. Requirements remain in the change's capability specs. Relevant
background: [real-project evidence freeze](../../../specs/acceptance-plan.md#real-project-evidence-freeze),
[demonstration guide](../../../specs/demonstration-plan.md) and
[discovery proposal P-08](../../../specs/continuity-contract.md#discovery-proposal-p-08).

## Recommendation

Use the public [healthchecks/healthchecks](https://github.com/healthchecks/healthchecks)
repository, observed GitHub repository ID `38067078`. Use two small, independent
parent-to-child comparisons around the same content-filtering feature. Each has
one commit, with parentage and complete changed-file metadata checked through the
public GitHub API. Do not use a moving branch, a release label or another local
checkout as input identity.

| Label | Exact commit SHA-1 | Tree SHA-1 |
|---|---|---|
| C0: code baseline | `0f78e117eadb59a01dd51e09344479fa3eeb4187` | `4ce49058cc13978c847a596c29ad1433ff00c974` |
| C1: code target | `c62d6648d81e1aebc65f80bddc72f165fba7320b` | `accdba0056d900bd3058da4a0e99f8747b802a4f` |
| D0: document baseline | `4d6db613da927840414750344172c35846358997` | `00c2bebea1549087a050444387537a615e69d134` |
| D1: document target | `3cfd32e56dd4113e89bb37589dc3407f54b97d77` | `75b5a3f70a0a497bebaaa6b97d22fe8620f67f66` |

HC-UP-CODE-01 compares C0 to its child C1. The
[upstream change](https://github.com/healthchecks/healthchecks/commit/c62d6648d81e1aebc65f80bddc72f165fba7320b)
adds HTTP-body keyword handling, an email no-match failure option and a shared
keyword helper, with upstream test changes. HC-UP-DOC-01 compares D0 to its child
D1. Its [upstream change](https://github.com/healthchecks/healthchecks/commit/3cfd32e56dd4113e89bb37589dc3407f54b97d77)
expands the configuring-checks Markdown and also changes an HTML fragment and an
image. Only the Markdown is in the proposed processing inventory.

These are two comparison selections, not one continuous four-step demonstration.
Additional commits lie between C1 and D0 and change selected files. Initialize
and review each baseline independently; never transplant a confirmation from C1
to D0 without its exact reviewed context. Author dates and committer dates differ
in this history. The manifest records both; parentage establishes comparison
order.

## Exact bounded inventory

The [proposed manifest](healthchecks-input-manifest.proposed.json) records every
selected path at all four commits, including its blob SHA-1, byte size, mode and
kind. All 40 bindings were found in non-truncated upstream tree responses, and
all are regular `100644` blobs. There are 18 distinct blobs, totaling 284,346
bytes; repeated revision bindings total 518,814 bytes. These are upstream
metadata counts, not locally acquired or integration-processed coverage.

| Selected path | Kind / format | Proposed use |
|---|---|---|
| `hc/api/views.py` | Code / Python | HTTP ping handling; changed in the code comparison. |
| `hc/api/management/commands/smtpd.py` | Code / Python | Email filtering; changed in the code comparison. |
| `hc/lib/string.py` | Code / Python | Shared keyword helper; changed in the code comparison. |
| `hc/api/models.py` | Code / Python | Context for stored check fields; metadata checked, not a reviewed semantic claim. |
| `hc/api/tests/test_ping.py` | Code / Python | Upstream regression-test source; changed in the code comparison. |
| `hc/api/tests/test_smtpd.py` | Code / Python | Upstream regression-test source; changed in the code comparison. |
| `hc/lib/urls.py` | Code / Python | Unchanged control, conditional on the declared relationship scope. |
| `templates/docs/configuring_checks.md` | Document / Markdown | Changed document endpoint in the document comparison. |
| `templates/docs/email.md` | Document / Markdown | Retained email-filtering explanation and content-concern example. |
| `templates/front/snippets/python_requests_payload.txt` | Document / plain text | Raw `.txt` capture/anchor case; an example is not executed as Python. |

Seven Python files, two Markdown documents and one plain-text document are
selected. This is deliberately a bounded feature sample. Other eligible Python,
Markdown and text paths are outside the selected inventory, not unsupported
formats or proof of complete project coverage. Do not silently expand the list
by following imports or links.

Both comparisons have complete public changed-file lists. All five code-change
paths are selected. The document comparison changes three paths: the selected
Markdown plus excluded `templates/docs/configuring_checks.html-fragment` and
`static/img/docs/filtering_rules.png`. Retain those two exclusions in results.
Do not describe D1 as an entirely Markdown-only repository change.

## Read-only review evidence

The following observations were made without running the candidate engine or
Healthchecks. They establish why the cases are suitable proposals, not accepted
relationships, code correctness, passed upstream tests or research results.

| Evidence | Checked anchor | Observation and limit |
|---|---|---|
| Email document at C0 | [Lines 8–27](https://github.com/healthchecks/healthchecks/blob/0f78e117eadb59a01dd51e09344479fa3eeb4187/templates/docs/email.md#L8-L27) | Describes failure/success/start precedence and ignoring a no-match email. The same document blob is retained at all four revisions. |
| Email handler at C0 | [Lines 80–111](https://github.com/healthchecks/healthchecks/blob/0f78e117eadb59a01dd51e09344479fa3eeb4187/hc/api/management/commands/smtpd.py#L80-L111) | Shows the earlier email-filtering path. |
| Email handler at C1 | [Lines 64–100](https://github.com/healthchecks/healthchecks/blob/c62d6648d81e1aebc65f80bddc72f165fba7320b/hc/api/management/commands/smtpd.py#L64-L100) | Adds a configurable failure outcome when no keywords match. An unchanged document can therefore merit content follow-up without automatically losing all descriptive relevance. |
| HTTP handler at C1 | [Lines 195–233](https://github.com/healthchecks/healthchecks/blob/c62d6648d81e1aebc65f80bddc72f165fba7320b/hc/api/views.py#L195-L233) | Adds HTTP-body keyword handling and preserves earlier admission guards. Static inspection only. |
| Configuring-checks document at D0 | [Lines 84–115](https://github.com/healthchecks/healthchecks/blob/4d6db613da927840414750344172c35846358997/templates/docs/configuring_checks.md#L84-L115) | Explains email keyword filtering in the filtering-rules section. |
| Configuring-checks document at D1 | [Lines 105–150](https://github.com/healthchecks/healthchecks/blob/3cfd32e56dd4113e89bb37589dc3407f54b97d77/templates/docs/configuring_checks.md#L105-L150) | Expands HTTP/email content filtering, precedence and the configurable no-match outcome. Template placeholders stay literal; their deployed values were not resolved. |
| Shared helper at C1 | [Lines 48–65](https://github.com/healthchecks/healthchecks/blob/c62d6648d81e1aebc65f80bddc72f165fba7320b/hc/lib/string.py#L48-L65) | Shows case-sensitive matching of comma-separated keywords. |
| Plain-text snippet at D1 | [File](https://github.com/healthchecks/healthchecks/blob/3cfd32e56dd4113e89bb37589dc3407f54b97d77/templates/front/snippets/python_requests_payload.txt) | Shows request-body/header examples. `PING_URL` is text, not an acquisition target. |
| Control at D1 | [Lines 1–30](https://github.com/healthchecks/healthchecks/blob/3cfd32e56dd4113e89bb37589dc3407f54b97d77/hc/lib/urls.py#L1-L30) | URL helper context inspected. Blob identity is unchanged at all four commits; this alone does not prove absence of semantic relationships. |

Upstream regression tests were inspected through the C1 diff, not executed.
`hc/api/models.py` was selected from tree metadata; its full content and semantics
have not been reviewed. No locally computed content SHA-256 is claimed for any
input: the manifest intentionally records `contentSha256: null` until approved
byte acquisition and verification.

## Proposed independent expected outcomes

Freeze this table before a candidate-engine run. A reviewer must accept or
correct the expectations independently of that engine's output. These are
engineering checks on a bounded sample, not a precision/recall benchmark.

| Case | Starting condition and action | Proposed observable outcome | Mapping |
|---|---|---|---|
| UP-01 exact capture | Acquire only accepted manifest objects, then capture selected C0/C1 files. | Path/commit/blob identities match the accepted manifest; old and new source remain independently readable. Unsupported encoding or unavailable objects produce explicit scope failures. | C-01a/b, C-02a; HC-01; T-15/16 |
| UP-02 code-origin reassessment | At C0, manually propose `email.md documents smtpd.py` with the checked filtering evidence; perform an actual authorized baseline review, then compare C0/C1. | Changed SMTP code surfaces the related document through one registered directed relationship. A prior confirmation leads to stale/open incoming review; a prior unconfirmed candidate remains candidate/open. Keep the earlier decision and source. | C-06b, C-07c/e; HC-04; T-14 |
| UP-03 separate content concern | Inspect the retained email document and incoming SMTP no-match behavior at C1. | Let the reviewer decide relationship validity and separately record the missing configurable-failure explanation as a proposed content concern/follow-up. Do not automatically prescribe retirement or claim the prose has been corrected. | C-10a; HC-05; T-09 |
| UP-04 document-origin reassessment | At independently initialized D0, manually propose/review `configuring_checks.md documents smtpd.py`, then compare D0/D1. | The changed document surfaces the related SMTP code even though that code blob is unchanged. Retain document-to-code direction. Incoming state depends on the real baseline review; inspection does not require a code edit. | C-06a/b, C-07c; HC-04/08; T-14 |
| UP-05 control | In the explicitly registered two-relationship manual scope, leave `hc/lib/urls.py` without a registered relationship; compare either pair. | Its unchanged blob alone creates no direct-impact review under the one-hop rule. Do not generalize to complete project independence. If later discovery registers a link to it, this disconnected-control precondition no longer holds and must be reported. | C-02a, C-06b; T-15 |
| UP-06 plain text | Capture and read the selected `.txt` file at its exact revision. | Treat it as a plain-text document, preserve line anchors and report extraction/evidence/change support separately. Do not execute example requests or claim a changed-plain-text scenario: its blob is unchanged here. | C-02b; HC-01; T-24, capture/read portion only |
| UP-07 automatic candidate, conditional | If P-08 is accepted with a frozen configuration, independently inspect the retained `failure` token in the C0 email document and SMTP `failure_kw` identifier. | Expect an unconfirmed document-to-code lexical candidate with exact-version evidence. This is conditional on the accepted token/index rules; no run has occurred. Additional weak candidates remain visible. | C-04a/b; HC-02D; T-13/25 |
| UP-08 retry/history | After processing exists, retry the same accepted comparison request and reopen the selected earlier review after service restart. | No duplicate contexts/events; retain exact earlier reason, actor and source, or mark unavailable source explicitly. | C-05c, C-07e, C-08a; HC-06/07; T-06/16 |

The two manual assertions are proposed test setup, not observed or accepted
semantic judgments. A baseline reviewer can reject them. Never fabricate a
confirmation to obtain a stale result; retain a candidate outcome or revise the
proposed scenario through review instead. A manual capture after an automatic
miss does not satisfy UP-07. The control's independence is scoped to registered
relationships, not a claim that a broad lexical rule will find no match.

UP-06 covers raw text capture/read only. A real changed-plain-text comparison,
deletion, ambiguous rename and missing-history case are not supplied by these
two natural changes. Prepare separate disclosed synthetic boundary tests or a
separately reviewed upstream extension before claiming their acceptance checks.
Equal-revision checks can reuse an accepted commit without fabricating a change.

## Discovery configuration review

P-08 remains proposed. Do not select or tune it merely to produce UP-07. Before
integration, accept a separately versioned configuration with exact identifier
extraction, tokenization/case splitting, minimum token length, Python keyword and
stop-word lists, first-span ordering, evidence aggregation, limits and no-match
behavior. Record that configuration's digest with the accepted inventory and
expectations. If its rules differ from P-08, revise the conditional expectation
before execution and retain this proposal's version.

Baseline discovery must read only that baseline's selected blobs and approved
history. D1's explanatory additions cannot inform C0 discovery. Do not use
future co-change or the engine's candidate list to choose which examples count
as expected. Raw Markdown/plain text is read literally: no template rendering,
HTML/image processing or external-link fetching is implied.

## Proposed acquisition after acceptance

Recommend targeted immutable GitHub REST object reads, avoiding a clone. Scope
the eventual acquisition to the repository ID, four commits/trees and the 18
selected blobs in this manifest. Keep all local material inside
`inputs/healthchecks/<accepted-manifest-sha256>/`; that directory has not been
created by this proposal. No sibling checkout is an allowed fallback.

1. Obtain explicit acceptance of the exact manifest, acquisition method and
   intended tests. Record the accepted manifest bytes and SHA-256 without
   relabeling this proposed record as accepted.
2. Re-read repository identity, exact commit metadata and selected tree entries
   through `api.github.com`. Require the same tree IDs, paths, blob IDs, sizes and
   regular-file modes. Reject truncated or mismatched metadata. Parentage for
   each selected comparison must still match; never substitute a branch tip.
3. Fetch the enumerated blob objects by ID through that host only. Decode the
   API's base64 response to raw bytes, check its size and Git blob SHA-1
   (`blob <byte-length>\0` plus the raw bytes), then compute a separate SHA-256.
   Preserve exact bytes before any newline/text normalization. An API locator
   alone does not prove local integrity or future availability.
4. Apply proposed bounds: at most 1 MiB per blob, 4 MiB total unique source bytes,
   ten declared paths and four revisions. Read strict UTF-8 for this profile.
   Reject symlinks, submodules, undeclared paths/objects and acquisition outside
   the accepted destination. Missing sources or failures remain explicit.
5. Publish an acquired input record with actual content digests, byte counts,
   source-object checks, acquisition time and per-function support/limitations.
   Do not call registration or acquisition successful extraction/discovery.
6. Accept the discovery configuration and independent expected outcomes before
   running integration. Use isolated synthetic application accounts for checks;
   do not run Healthchecks, install its dependencies, call its example URLs or
   alter its source. A processing operation is not complete merely when admitted.

Source bytes, commit/tree provenance and earlier proposal versions must remain
inspectable. If an object disappears or differs, report unavailable/mismatch and
return to review. Do not repair this input by modifying upstream source.

## Review disposition

The package is ready to review as a proposed input choice. Acceptance should
identify the repository, both exact comparison pairs, ten paths/40 bindings,
targeted acquisition method, bounds and independent expectations. Any changed
path, commit, method or expected outcome requires a new retained proposal
version. Acceptance of this package alone must not silently select P-08 or claim
a completed integration.

Still pending: user acceptance; source-byte acquisition/integrity checks;
A-DISCOVERY configuration; the additional boundary cases above; processing and
frontend implementation; actual T-/HC-/G- observations. The prior 43 review-service
tests use synthetic data and supply no Healthchecks integration result.
