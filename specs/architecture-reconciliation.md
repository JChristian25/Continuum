# Architecture Reconciliation: Manuscript Table 5 vs. Implemented Stack

Date: 2026-11-17. Scope: [prototype](file:///d:/%5BResearch%5D%20SKCF/prototype) repository as implemented after integrating Neo4j, Redis/RQ, Tree-sitter, and Docling into the backend alongside PostgreSQL 17, FastAPI, Native Git, and the React 19 + Vite UI.

## Basis in the Thesis Manuscript

Section `§3.7.3` (Table 5, *Preliminary Technology Shortlist*, PDF pp. 79–80) explicitly defines its stack as **"a shortlist subject to implementation and support verification"** rather than a rigid runtime mandate. Section `§3.7.4` (Figure 7, PDF pp. 81–83) similarly states that **"actual support and deployment boundaries will be recorded for the demonstrated build."**

Per [backend-conformance.md](file:///d:/%5BResearch%5D%20SKCF/prototype/outputs/manuscript-audit/backend-conformance.md), the working Continuum build now implements the Table 5 backend stack—FastAPI, Redis/RQ, Tree-sitter, Docling, Neo4j, and Git—while retaining PostgreSQL 17 as the authoritative ACID command/receipt store and preserving the React 19 + Vite SPA interface.

## Stack Comparison Matrix

| Architectural Layer | Manuscript Table 5 Shortlist (`§3.7.3`) | Implemented Continuum Stack | Status & Rationale |
| --- | --- | --- | --- |
| **Frontend UI** | Next.js; TypeScript; shadcn/ui | React (`react` 19) + Vite (`JavaScript`); Base UI (`@base-ui/react`), Radix UI primitives, `cmdk`, `sonner`, Lucide icons; client graph via `@xyflow/react` + `elkjs` | **Substituted.** Vite + React JSX delivers a single-page application without SSR server overhead while keeping accessible dialog/tab/combobox primitives and React Flow + ELK rendering. |
| **Backend API** | FastAPI | FastAPI (`uvicorn`) with SQLAlchemy + `psycopg` + PostgreSQL 17 | **Matched.** Typed request/response envelopes, fail-closed cookie session auth, Argon2id credentials, and explicit projection guards. |
| **Background Jobs** | Redis; RQ (Redis Queue) | Redis 7 (`127.0.0.1:56379`) + RQ (`rq.Queue` + Windows-compatible `rq.SimpleWorker` with `TimerDeathPenalty`), coordinated with PostgreSQL transactional leasing and schema advisory locks | **Matched.** Admitted `capture_files`, `discover_candidates`, and `export_snapshot` jobs enqueue to RQ on transaction `after_commit` and execute with PostgreSQL lease fencing. |
| **Source-Code Parsing** | Tree-sitter; optional LSP or SCIP | `tree-sitter` + `tree-sitter-python` AST identifier, symbol span (`class`/`method`/`function`), & syntax parsing (file scope) alongside Python `tokenize` + filename stems | **Matched (bounded file scope).** Parses Python AST `identifier` / `__future__` nodes and exact 1-based symbol spans (exposed on `versions/{id}` and projected to Neo4j `:ContinuumArtifact`) while preserving frozen `P-08` discovery parity; no cross-file call graph or runtime execution analysis is claimed. |
| **Document Extraction** | Docling; fallback extractors | `docling` (`DocumentConverter` + `docling-core` `DoclingDocument` structured item & section extraction) for Markdown (`.md`) + strict UTF-8 line-scanner fallback for plain text (`.txt`) + repository-relative `.py` regex (`P-08`) + authored form records | **Matched (bounded input scope).** Extracts Markdown sections and code blocks via Docling aligned to exact 1-based lines while preserving SHA-256 excerpt digests, with plain-text fallback. |
| **Supported Languages & Inputs** | Python, JS, TS, HTML, CSS (Django/FastAPI); JSON, YAML, MD, DOCX, PDF | Python at file scope; Markdown (`.md`), plain text (`.txt`), plus authored Requirement/Decision records | **Scoped subset.** Covers the accepted bounded `healthchecks/healthchecks` package (4 commits, 10 paths, 18 blobs) plus optional operator-gated custom `.py`/`.md`/`.txt` workspaces (`CONTINUUM_ALLOW_CUSTOM_WORKSPACES=1`, max 25 files / 4 MiB) and allowlisted local Git commit reads (`CONTINUUM_ALLOW_LOCAL_GIT=1`). Healthchecks Django modules and custom workspaces remain parsed at file scope. |
| **Graph Storage & Query** | Neo4j (Lexical, vector & graph retrieval) | Neo4j 5 Community (`bolt://127.0.0.1:57687`, `neo4j` Python Driver v6) projecting `:ContinuumSnapshot`, `:ContinuumArtifact` (including `symbolCount`, `sectionCount`, `structureEngine`), and `:ContinuumAssertionContext` nodes and `:DOCUMENTS` / `:IMPLEMENTS` / `:MOTIVATES` edges for Cypher `read_graph` 1-hop neighborhoods, paired with PostgreSQL 17 ACID records and Unicode literal search | **Matched (hybrid transactional projection).** Immutable snapshots project to Neo4j on commit for Cypher 1-hop typed neighborhood retrieval, while PostgreSQL remains the ACID source of truth for commands, sessions, and receipts (no vector embeddings claimed). |
| **Version Control Diff** | Git | Retained immutable GitHub REST blobs/commits + native `git diff --no-index --no-renames` + client-side LCS line-diff overlay | **Matched (bounded local mode).** Compares retained immutable snapshot bytes deterministically without cloning upstream or guessing renames. |
| **AI Assistance** | Local or hosted LLMs (optional) | None in live service mode (synthetic AI preview gated exclusively behind `?mode=demo`) | **Excluded from live core (`X-02`).** All live candidate assertions come strictly from frozen lexical discovery (`P-08`) or explicit manual claims. |
| **Deployment** | Local or cloud | Local loopback development stack (`Vite :5173`, `FastAPI :8787`, Docker `PostgreSQL 17 :55432`, `Redis 7 :56379`, `Neo4j 5 :57687`) | **Development build only.** No production deployment, live schema migration automation, or HTTPS certificate provisioning is claimed. |

## Explicit Non-Claims & Evidence Boundaries

Do **not** claim the following in Chapter 3, Chapter 4, or during oral defense without separate implementation work:

- **No Next.js SSR runtime or vector embeddings** in the demonstrated service (search uses deterministic Unicode literal matching over PostgreSQL retained snapshots; no vector index is claimed).
- **No live LLM inference** in authenticated review mode (live mode rejects synthetic fallbacks and strictly requires human confirmation).
- **No cross-file AST call-graph, transitive propagation, or automatic rename tracking** (Tree-sitter runs at file scope; revalidation checks directly affected endpoints via exact retained path and Git byte diff).
- **No runtime execution of Healthchecks**, multi-repo crawling, or unaccepted format ingestion (`.docx`, `.pdf`, `.yaml`, JS/TS AST).
- **No practitioner evaluation metrics or semantic accuracy percentages** from automated tests alone.

---

## Copy-Ready Manuscript Text (`§3.7.3` / Chapter 4 Replacement)

Use the prose below directly when updating Chapter 3 (`§3.7.3`–`§3.7.4`) or writing Chapter 4 (*System Implementation & Results*) so the manuscript matches the verified build verbatim:

> **Implemented Technology Stack (Reconciled against Section 3.7.3 Table 5).**  
> Consistent with the verification provision in Section 3.7.3 (*"a shortlist subject to implementation and support verification"*) and Section 3.7.4 (*"actual support and deployment boundaries will be recorded for the demonstrated build"*), the implemented Continuum prototype integrates the shortlisted backend components—FastAPI, Redis/RQ, Tree-sitter, Docling, Neo4j, and native Git—alongside PostgreSQL 17 and a React 19 + Vite client:
>
> - **Presentation Layer:** Built as a single-page application in React 19 and Vite (JavaScript) using Base UI, Radix UI, `cmdk`, and Sonner primitives with `@xyflow/react` and `elkjs` for interactive neighborhood graphs, rather than a Next.js SSR runtime.
> - **Application & Worker Layer:** Implemented in Python with FastAPI, SQLAlchemy, `psycopg`, Argon2id cookie sessions (`127.0.0.1:8787`), and Redis 7 + RQ (`rq.Queue` and Windows-compatible `rq.SimpleWorker` using `TimerDeathPenalty`, `127.0.0.1:56379`). Asynchronous snapshot capture, discovery, and bounded JSON export operations enqueue to RQ upon transaction commit and execute under PostgreSQL schema advisory locks and transactional lease fencing.
> - **Persistence & Typed Graph Storage:** PostgreSQL 17 (`127.0.0.1:55432`) serves as the ACID transactional authority for immutable artifact versions, decision history, follow-ups, sessions, and idempotent request receipts. Committed snapshots project into Neo4j 5 Community (`bolt://127.0.0.1:57687`, `neo4j` Python Driver v6) as `:ContinuumSnapshot`, `:ContinuumArtifact`, and `:ContinuumAssertionContext` nodes connected by `:DOCUMENTS`, `:IMPLEMENTS`, and `:MOTIVATES` relationships to answer Cypher-backed one-hop `read_graph` neighborhood queries, while search remains deterministic Unicode literal matching over retained snapshots (no vector index).
> - **Bounded Analysis & Version Comparison:** Python source parsing uses `tree-sitter` and `tree-sitter-python` AST traversal alongside `tokenize` at file scope, Markdown extraction uses `docling` (`DocumentConverter` and `DoclingDocument`) paired with a strict UTF-8 line-scanner fallback for plain text (`.txt`) while preserving exact 1-based line anchors, and revision comparison runs native `git diff --no-index --no-renames` across retained immutable bytes supplemented by a side-by-side line-diff viewer and ranked evidence signal filtering in the UI.
> - **Extension Isolation:** Live LLM assistance remains unimplemented in authenticated mode (extension `X-02`), with synthetic AI previews isolated to `?mode=demo`.
