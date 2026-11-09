
export const STORAGE_KEY = 'CONTINUUM_REACT_2026_V2';

export const CHANGE_NEIGHBOR_IDS = [
  'aaa.py::submitUserOrder',
  'aaa.md::section-2.1',
  'compat.py::normalizeRequestResult',
  'REQ-02'
];

export function createInitialState() {
  return {
    activeModule: 'dashboard',
    revisionMode: 'R1',
    activeUserId: 'user-jc',
    activeRepoId: 'repo-checkout',
    importModalOpen: false,
    repositories: [
      {
        id: 'repo-checkout',
        name: 'checkout-service',
        fullName: 'core/checkout-service',
        sourceType: 'GitHub Shared Repository',
        branch: 'main',
        revBaseline: 'a41c90e (Baseline)',
        revTarget: '8f3b21d (Incoming Change)',
        language: 'Python 3.12',
        codeParser: 'Tree-sitter (Python AST)',
        docExtractor: 'Docling (Markdown + PDF)',
        description: 'E-commerce order intake service with asynchronous background queueing and DEC-04 dictionary response contract.',
        stats: { files: 14, nodes: 14, edges: 28, decisions: 1, pendingReview: 1 },
        tags: ['Core Service', 'Tree-sitter', 'Docling', 'Neo4j Active']
      },
      {
        id: 'repo-payment',
        name: 'payment-gateway',
        fullName: 'fintech/payment-gateway',
        sourceType: 'Separate Repositories (Code + Docs)',
        branch: 'main',
        revBaseline: 'f12a901 (Baseline)',
        revTarget: 'c43e88b (Incoming Change)',
        language: 'Go 1.22',
        codeParser: 'Tree-sitter (Go AST)',
        docExtractor: 'Docling (OpenAPI 3.1 + Markdown)',
        description: 'Payment orchestration & webhook replay verification service with idempotent ledger updates.',
        stats: { files: 22, nodes: 19, edges: 38, decisions: 2, pendingReview: 0 },
        tags: ['Fintech Core', 'OpenAPI 3.1', 'Tree-sitter Go', 'Neo4j Active']
      },
      {
        id: 'repo-auth',
        name: 'auth-identity',
        fullName: 'security/auth-identity',
        sourceType: 'GitHub Shared Repository',
        branch: 'main',
        revBaseline: 'e88b22a (Baseline)',
        revTarget: 'd101c77 (Incoming Change)',
        language: 'TypeScript / Node.js',
        codeParser: 'Tree-sitter (TypeScript AST)',
        docExtractor: 'Docling (RFC-8725 Specs)',
        description: 'OAuth2 / OIDC token issuance service enforcing RFC-8725 JSON Web Token Best Practices.',
        stats: { files: 18, nodes: 16, edges: 31, decisions: 1, pendingReview: 0 },
        tags: ['Security & Auth', 'RFC-8725', 'JWT BCP', 'Neo4j Active']
      }
    ],
    c4Topology: {
      webFrontend: {
        id: 'web-frontend',
        name: 'Web Frontend',
        container: 'Container: React / TS',
        status: 'Operational',
        latency: '0.4ms',
        role: 'Search, graph exploration, evidence and review views',
        protocol: 'HTTPS / JSON',
        port: '5173'
      },
      backendApi: {
        id: 'backend-api',
        name: 'Backend API',
        container: 'Container: Python / FastAPI',
        status: 'Operational',
        latency: '3.6ms',
        role: 'Access control, records, queries and job submission',
        protocol: 'Bolt queries / HTTPS',
        port: '8000'
      },
      redisQueue: {
        id: 'redis-queue',
        name: 'Redis Queue',
        container: 'Container: Redis 7.2',
        status: 'Operational',
        latency: '0.8ms',
        queuedJobs: 0,
        processedJobs: 148,
        role: 'Queues analysis jobs and review commands',
        protocol: 'Redis TCP 6379'
      },
      processingWorker: {
        id: 'processing-worker',
        name: 'Processing Worker',
        container: 'Container: Python / RQ',
        status: 'Idle (Ready)',
        workerPid: '8841',
        parsers: 'Tree-sitter AST + Docling v2.1',
        role: 'Extraction, relationship discovery, impact analysis and revalidation',
        protocol: 'Bolt write stream'
      },
      neo4j: {
        id: 'neo4j',
        name: 'Artifact Knowledge Graph',
        container: 'Container: Neo4j 5.20 (Bolt)',
        status: 'Connected',
        latency: '1.2ms',
        nodes: 14,
        edges: 28,
        role: 'Artifacts, links, evidence and history',
        protocol: 'bolt://localhost:7687'
      },
      gitProject: {
        id: 'git-project',
        name: 'Git Project',
        container: 'External Source: GitHub',
        status: 'Synced',
        branch: 'main',
        revs: 'a41c90e..8f3b21d (Baseline → Incoming Change)',
        role: 'Files and revision history'
      }
    },
    chatMessages: [
      {
        id: 'msg-0',
        sender: 'assistant',
        time: 'System Ready',
        text: 'Welcome to Continuum Graph-Grounded Assistant. Every answer is grounded directly in the Neo4j Artifact Knowledge Graph, verified AST call edges from Tree-sitter, and prose sections from Docling. What would you like to explore about your repository continuity?',
        citations: []
      },
      {
        id: 'msg-1',
        sender: 'user',
        time: '2 mins ago',
        text: 'Why was createRequest() modified in the incoming change and which callers are impacted?',
        citations: []
      },
      {
        id: 'msg-2',
        sender: 'assistant',
        time: 'Just now',
        text: 'In the incoming change (8f3b21d), `createRequest(payload)` was changed to return a structured dictionary `{"id": req_id, "status": "PENDING"}` instead of a plain string `req_id`. This change is directly justified by architectural decision **DEC-04**, authored by JC Linaban to eliminate a separate `getStatus()` round-trip for callers.\n\nDownstream analysis identified **4 candidate impact neighbors**:\n1. `src/aaa.py · submitUserOrder()`: **Breaking caller**. Slices `req_id.strip()`, causing an `AttributeError` at runtime. Needs a code update to read `req_id["id"]`.\n2. `docs/aaa.md · §2.1 Request API`: **Stale documentation**. Explains `createRequest()`, but prose still describes a string return value.\n3. `src/compat.py · normalizeRequestResult()`: **Already compatible**. Type-guard `isinstance(res, dict)` handles the dictionary return safely.\n4. `REQ-02`: **Fulfilled**. Fulfills synchronous status reporting directly.',
        citations: [
          { type: 'Decision Node', id: 'DEC-04', label: 'DEC-04: Structured Dict' },
          { type: 'AST Node', id: 'aaa.py::submitUserOrder', label: 'src/aaa.py:22 (Caller)' },
          { type: 'Docling Spec', id: 'aaa.md::section-2.1', label: 'docs/aaa.md §2.1' },
          { type: 'Neo4j Path', id: 'compat.py::normalizeRequestResult', label: 'src/compat.py' }
        ]
      }
    ],
    pipelineLimitsOpen: false,
    pipelineLastRun: 'Just now with incoming change (8f3b21d)',
    exploreCategory: 'All',
    exploreSearch: '',
    exploreRelFilter: 'all',
    exploreViewMode: 'graph',
    graphZoom: 1.0,
    diffMode: 'split',
    diffCollapsed: false,
    decisionDrawerOpen: false,
    changesFilter: 'all',
    coverageSubtab: 'doc_coverage',
    coverageFilter: 'all',
    onboardingSteps: [
      { id: 'step-1', title: '1. Read DEC-04: Why createRequest() returns a structured dictionary with incoming change', artifactId: 'DEC-04', done: true },
      { id: 'step-2', title: '2. Inspect src/bbb.py · createRequest() contract change from baseline to incoming change and undocumented sibling cancelRequest()', artifactId: 'bbb.py::createRequest', done: true },
      { id: 'step-3', title: '3. Verify why src/compat.py · normalizeRequestResult() is already compatible with both baseline and incoming change', artifactId: 'compat.py::normalizeRequestResult', done: false },
      { id: 'step-4', title: '4. Inspect open caller adaptation in src/aaa.py · submitUserOrder() and deferred doc update in docs/aaa.md §2.1', artifactId: 'aaa.py::submitUserOrder', done: false }
    ],
    policies: {
      requireRationale: true,
      allowAiDrafts: true,
      separateWorkFromReview: true
    },
    simulateSaveError: false,
    selectedArtifactId: 'aaa.py::submitUserOrder',
    inspectorOpen: false,
    inspectorTab: 'reading',
    reviewFormOpen: false,
    decisionHeadline: {
      id: 'DEC-04',
      title: 'Return structured dictionary from createRequest so callers can inspect initial status without a second query',
      author: 'JC Linaban',
      rationale: 'Callers previously had to issue an immediate follow-up getStatus(req_id) query after createRequest(payload) to check whether the request was queued or throttled. Returning {"id": req_id, "status": "PENDING"} synchronously eliminates that extra round-trip. src/compat.py already handles dicts, while src/aaa.py requires a caller update.'
    },
    teamMembers: [
      { id: 'user-jc', initials: 'JC', name: 'John Christian Linaban', shortName: 'JC Linaban', roleTitle: 'Lead Developer', authority: 'Authorized Reviewer', focus: 'src/aaa.py, src/compat.py, DEC-04', commits: 34, decisions: 4, reviews: 12 },
      { id: 'user-cj', initials: 'CJ', name: 'Cris Albert Jimenez', shortName: 'C. Jimenez', roleTitle: 'Systems Analyst & Core Maintainer', authority: 'Authorized Reviewer', focus: 'src/bbb.py (88% concentration), REQ-02', commits: 49, decisions: 3, reviews: 15 },
      { id: 'user-am', initials: 'AM', name: 'Angela Therese Marasigan', shortName: 'A. Marasigan', roleTitle: 'Documentation & Quality Lead', authority: 'Authorized Reviewer', focus: 'docs/aaa.md, REQ-02, Onboarding specs', commits: 22, decisions: 5, reviews: 19 },
      { id: 'user-sr', initials: 'SR', name: 'Sam Rivera', shortName: 'S. Rivera', roleTitle: 'Onboarding Contributor', authority: 'Read-Only / Commenter', focus: 'Shadowing Request Processing handover', commits: 2, decisions: 0, reviews: 0 }
    ],
    activityLog: [
      { time: '18 mins ago', actor: 'A. Marasigan', action: 'Reviewed docs/aaa.md · §2.1 Request API with change', detail: 'Kept trace link valid; marked prose update as "Doc update deferred" until caller migration completes.', artifactId: 'aaa.md::section-2.1', badge: 'Reviewed with change' },
      { time: '42 mins ago', actor: 'JC Linaban', action: 'Revalidated src/compat.py · normalizeRequestResult() with change', detail: 'Confirmed isinstance(res, dict) branch handles {"id", "status"} with No edit needed.', artifactId: 'compat.py::normalizeRequestResult', badge: 'Reviewed with change' },
      { time: '2 hours ago', actor: 'JC Linaban', action: 'Recorded DEC-04 & linked directly to src/bbb.py · createRequest()', detail: 'Documented rationale for returning {"id": req_id, "status": "PENDING"} at commit 8f3b21d (Incoming Change).', artifactId: 'DEC-04', badge: 'Direct Decision' },
      { time: 'Oct 12, 2026', actor: 'C. Jimenez', action: 'Confirmed baseline links for createRequest() & submitUserOrder()', detail: 'Bound to historical baseline (a41c90e); flagged for re-inspection after contract change.', artifactId: 'aaa.py::submitUserOrder', badge: 'Baseline' }
    ],
    artifacts: {
      'aaa.py::submitUserOrder': {
        id: 'aaa.py::submitUserOrder', name: 'submitUserOrder(user, items)', shortName: 'src/aaa.py · submitUserOrder()', file: 'src/aaa.py', category: 'Code Elements',
        relKind: 'calls', relLabel: 'Calls function',
        plainReason: 'Calls createRequest(payload) and slices the return value as a string (req_id.strip()), which raises an AttributeError when the incoming change returns {"id": req_id, "status": "PENDING"}.',
        linkedIntentId: 'DEC-04', linkedIntentTitle: 'DEC-04: Return structured dictionary from createRequest',
        provenanceMethod: 'Tree-sitter Python AST call-graph extraction', provenanceAnchor: 'src/aaa.py lines 20–25 → invokes createRequest(payload) at line 22',
        provenanceScore: 'Deterministic AST call edge (1.00 structural match)', provenanceNote: 'Static call site verified; downstream exception handler is not executed dynamically.',
        r1Status: 'needs_review', judgmentChoice: 'Confirm valid with change', followUpWork: 'Code update open',
        savedRationale: '', draftRationale: '', draftIsAi: false, r1Reviewer: '', r1ReviewedAt: '',
        coverageCondition: 'reviewed', coverageBadge: 'Reviewed Support', coverageDetail: 'Linked to Order Intake section in docs/aaa.md §1.2 and requirement REQ-02.',
        codeExcerptR0: [
          { ln: 20, text: 'def submitUserOrder(user: str, items: list) -> str:' },
          { ln: 21, text: '    payload = {"user": user, "items": items}' },
          { ln: 22, text: '    req_id = createRequest(payload)', hl: true },
          { ln: 23, text: '    return "Queued order: " + req_id.strip()', hl: true }
        ],
        codeExcerptR1: [
          { ln: 20, text: 'def submitUserOrder(user: str, items: list) -> str:' },
          { ln: 21, text: '    payload = {"user": user, "items": items}' },
          { ln: 22, text: '    req_id = createRequest(payload)  # R1 returns {"id", "status"}', hl: true },
          { ln: 23, text: '    return "Queued order: " + req_id.strip()  # Needs req_id["id"]', hl: true }
        ],
        historyR0: [{ rev: 'Baseline · a41c90e', actor: 'C. Jimenez', date: 'Oct 12, 2026', status: 'Accepted in Baseline · Not automatically valid for Incoming Change', rationale: 'Verified direct call from submitUserOrder to createRequest returning string ID.', excerpt: 'req_id = createRequest(payload) -> req_id.strip()' }]
      },
      'aaa.md::section-2.1': {
        id: 'aaa.md::section-2.1', name: '§2.1 Request API', shortName: 'docs/aaa.md · §2.1 Request API', file: 'docs/aaa.md', category: 'Documentation',
        relKind: 'explains', relLabel: 'Explains behavior',
        plainReason: 'Explains createRequest() behavior, but the markdown prose still describes a plain string return value ("req_<seq>"). The link remains valid while the text update is deferred.',
        linkedIntentId: 'DEC-04', linkedIntentTitle: 'DEC-04: Return structured dictionary from createRequest',
        provenanceMethod: 'Docling section segmentation + explicit symbol anchor + UniXcoder cosine (0.94)', provenanceAnchor: 'docs/aaa.md lines 18–23 → references `createRequest(payload)`',
        provenanceScore: '0.94 cosine similarity + explicit identifier match', provenanceNote: 'Detects stale return-value description; prose editing is tracked separately from link validity.',
        r1Status: 'reviewed', judgmentChoice: 'Keep link · Flag content issue', followUpWork: 'Doc update deferred',
        savedRationale: 'Section 2.1 still documents createRequest(), so the trace connection stays confirmed. Updating the return-value prose is deferred until the caller fix in src/aaa.py lands.',
        draftRationale: '', draftIsAi: false, r1Reviewer: 'A. Marasigan', r1ReviewedAt: 'Today, 14:35',
        coverageCondition: 'attention', coverageBadge: 'Earlier Support — Needs Attention', coverageDetail: 'Trace link reconfirmed at R1, with documentation text update tracked as deferred follow-up work.',
        codeExcerptR0: [
          { ln: 18, text: '### 2.1 Request API (`createRequest`)' },
          { ln: 19, text: 'Call `createRequest(payload)` to register a new order payload.' },
          { ln: 20, text: 'Returns: a plain string identifier (`req_<sequence>`).', hl: true },
          { ln: 21, text: 'Use `getStatus(req_id)` to poll initial queue state.', hl: true }
        ],
        codeExcerptR1: [
          { ln: 18, text: '### 2.1 Request API (`createRequest`)' },
          { ln: 19, text: 'Call `createRequest(payload)` to register a new order payload.' },
          { ln: 20, text: 'Returns: a plain string identifier (`req_<sequence>`).  [Outdated prose]', hl: true },
          { ln: 21, text: 'Use `getStatus(req_id)` to poll initial queue state.', hl: true }
        ],
        historyR0: [{ rev: 'R0 · a41c90e', actor: 'A. Marasigan', date: 'Oct 12, 2026', status: 'Accepted at R0 · Re-evaluated at R1', rationale: 'Accurately documented the R0 string return value and getStatus polling.', excerpt: 'Returns: a plain string identifier (`req_<sequence>`).' }]
      },
      'compat.py::normalizeRequestResult': {
        id: 'compat.py::normalizeRequestResult', name: 'normalizeRequestResult(res)', shortName: 'src/compat.py · normalizeRequestResult()', file: 'src/compat.py', category: 'Code Elements',
        relKind: 'calls', relLabel: 'Calls function',
        plainReason: 'Calls createRequest() and already branches on isinstance(res, dict) to extract res["id"]. Fully compatible with both Baseline strings and Incoming Change dictionaries.',
        linkedIntentId: 'DEC-04', linkedIntentTitle: 'DEC-04: Return structured dictionary from createRequest',
        provenanceMethod: 'Tree-sitter Python AST call-graph & type-guard inspection', provenanceAnchor: 'src/compat.py lines 8–13 → branches on isinstance(res, dict)',
        provenanceScore: 'Deterministic AST dependency (1.00 structural match)', provenanceNote: 'Handles both str and dict return shapes safely.',
        r1Status: 'reviewed', judgmentChoice: 'Confirm valid with change', followUpWork: 'No edit needed',
        savedRationale: 'Per DEC-04, normalizeRequestResult() already checks isinstance(res, dict) and reads res.get("id"). Verified compatible with incoming change with no code edit needed.',
        draftRationale: '', draftIsAi: false, r1Reviewer: 'JC Linaban', r1ReviewedAt: 'Today, 14:12',
        coverageCondition: 'reviewed', coverageBadge: 'Reviewed Support', coverageDetail: 'Documented by docs/aaa.md §2.4 Compatibility Helpers and verified with incoming change.',
        codeExcerptR0: [
          { ln: 8, text: 'def normalizeRequestResult(res: str | dict) -> str:' },
          { ln: 9, text: '    if isinstance(res, dict):', hl: true },
          { ln: 10, text: '        return str(res.get("id", ""))', hl: true },
          { ln: 11, text: '    return str(res).strip()' }
        ],
        codeExcerptR1: [
          { ln: 8, text: 'def normalizeRequestResult(res: str | dict) -> str:' },
          { ln: 9, text: '    if isinstance(res, dict):', hl: true },
          { ln: 10, text: '        return str(res.get("id", ""))', hl: true },
          { ln: 11, text: '    return str(res).strip()' }
        ],
        historyR0: [{ rev: 'Baseline · a41c90e', actor: 'JC Linaban', date: 'Oct 12, 2026', status: 'Accepted in Baseline · Reconfirmed with change', rationale: 'Adapter helper introduced to support gradual migration to dictionary responses.', excerpt: 'if isinstance(res, dict): return str(res.get("id", ""))' }]
      },
      'REQ-02': {
        id: 'REQ-02', name: 'REQ-02 — Track request creation status', shortName: 'REQ-02 — Track request creation status', file: 'Requirements Register', category: 'Requirements',
        relKind: 'implements', relLabel: 'Implements requirement',
        plainReason: 'Implemented by createRequest() to expose initial lifecycle state ("PENDING") synchronously alongside the request ID.',
        linkedIntentId: 'DEC-04', linkedIntentTitle: 'DEC-04: Return structured dictionary from createRequest',
        provenanceMethod: 'Structured requirement trace link (ISO/IEC/IEEE 29148 syntax mapping)', provenanceAnchor: 'REQ-02 → realized by src/bbb.py · createRequest(payload)',
        provenanceScore: 'Explicit maintainer-authored trace link', provenanceNote: 'Incoming change implementation now fulfills synchronous status reporting directly.',
        r1Status: 'needs_review', judgmentChoice: 'Confirm valid with change', followUpWork: 'No edit needed',
        savedRationale: '', draftRationale: '', draftIsAi: false, r1Reviewer: '', r1ReviewedAt: '',
        coverageCondition: 'reviewed', coverageBadge: 'Reviewed Support', coverageDetail: 'Structured requirement record connected to src/bbb.py · createRequest().',
        codeExcerptR0: [
          { ln: 1, text: 'Requirement ID: REQ-02 (Track request creation status)' },
          { ln: 2, text: 'Specification: Upon request creation, the service shall return', hl: true },
          { ln: 3, text: 'both the unique request ID and its initial lifecycle state.', hl: true }
        ],
        codeExcerptR1: [
          { ln: 1, text: 'Requirement ID: REQ-02 (Track request creation status)' },
          { ln: 2, text: 'Specification: Upon request creation, the service shall return', hl: true },
          { ln: 3, text: 'both the unique request ID and its initial lifecycle state.', hl: true }
        ],
        historyR0: [{ rev: 'R0 · a41c90e', actor: 'C. Jimenez', date: 'Oct 11, 2026', status: 'Accepted at R0 · Not automatically valid for R1', rationale: 'R0 satisfied unique ID generation; status required a separate lookup.', excerpt: 'return both the unique request ID and its initial lifecycle state.' }]
      },
      'bbb.py::createRequest': {
        id: 'bbb.py::createRequest', name: 'createRequest(payload)', shortName: 'src/bbb.py · createRequest()', file: 'src/bbb.py', category: 'Code Elements',
        relKind: 'decision', relLabel: 'Direct design decision',
        plainReason: 'Modified in incoming change (8f3b21d) to return {"id": req_id, "status": "PENDING"} directly, eliminating separate status polling per DEC-04.',
        linkedIntentId: 'DEC-04', linkedIntentTitle: 'DEC-04: Return structured dictionary from createRequest',
        provenanceMethod: 'Git revision diff (a41c90e..8f3b21d) + Tree-sitter Python symbol tracking', provenanceAnchor: 'src/bbb.py lines 14–19',
        provenanceScore: 'Changed provider seed (Starting Impact Set)', provenanceNote: 'Sibling function cancelRequest() in the same file remains unchanged and undocumented.',
        r1Status: 'reviewed', judgmentChoice: 'Confirm valid with change', followUpWork: 'Doc update deferred',
        savedRationale: 'Implements DEC-04 in incoming change. Linked documentation in docs/aaa.md §2.1 is flagged for a deferred prose update.',
        draftRationale: '', draftIsAi: false, r1Reviewer: 'JC Linaban', r1ReviewedAt: 'Today, 14:05',
        coverageCondition: 'attention', coverageBadge: 'Earlier Support — Needs Attention', coverageDetail: 'Linked to docs/aaa.md §2.1 (prose update deferred in incoming change) and directly justified by DEC-04.',
        codeExcerptR0: [
          { ln: 14, text: 'def createRequest(payload: dict) -> str:', hl: true },
          { ln: 15, text: '    req_id = f"req_{next_seq()}"' },
          { ln: 16, text: '    persist_order(req_id, payload, state="PENDING")' },
          { ln: 17, text: '    return req_id', hl: true }
        ],
        codeExcerptR1: [
          { ln: 14, text: 'def createRequest(payload: dict) -> dict:', hl: true },
          { ln: 15, text: '    req_id = f"req_{next_seq()}"' },
          { ln: 16, text: '    persist_order(req_id, payload, state="PENDING")' },
          { ln: 17, text: '    return {"id": req_id, "status": "PENDING"}', hl: true }
        ],
        historyR0: [{ rev: 'Baseline · a41c90e', actor: 'C. Jimenez', date: 'Oct 10, 2026', status: 'Accepted in Baseline · Superseded by incoming change', rationale: 'Baseline implementation returning plain req_id string.', excerpt: 'return req_id' }]
      },
      'bbb.py::cancelRequest': {
        id: 'bbb.py::cancelRequest', name: 'cancelRequest(req_id)', shortName: 'src/bbb.py · cancelRequest()', file: 'src/bbb.py', category: 'Code Elements',
        relKind: 'calls', relLabel: 'Sibling in src/bbb.py',
        plainReason: 'Sibling function in src/bbb.py with 100% single-author commits (C. Jimenez) and zero qualifying documentation links or decision rationale.',
        linkedIntentId: 'DEC-04', linkedIntentTitle: 'No linked decision record (Bus Factor = 1 risk)',
        provenanceMethod: 'Tree-sitter Python function inventory + completed F10 coverage scan', provenanceAnchor: 'src/bbb.py lines 22–26 (0 qualifying documentation passages found)',
        provenanceScore: '0 candidate matches above 0.65 cosine threshold', provenanceNote: 'Demonstrates that file-level grouping never masks an undocumented sibling function.',
        r1Status: 'needs_review', judgmentChoice: 'Keep link · Flag content issue', followUpWork: 'Doc update deferred',
        savedRationale: '', draftRationale: '', draftIsAi: false, r1Reviewer: '', r1ReviewedAt: '',
        coverageCondition: 'no_link', coverageBadge: 'No Known Documentation', coverageDetail: 'Configured analysis completed across all parsed docs, but found 0 qualifying documentation passages.',
        codeExcerptR0: [
          { ln: 22, text: 'def cancelRequest(req_id: str) -> bool:', hl: true },
          { ln: 23, text: '    if is_dispatched(req_id):' },
          { ln: 24, text: '        return False' },
          { ln: 25, text: '    return purge_queue_entry(req_id)', hl: true }
        ],
        codeExcerptR1: [
          { ln: 22, text: 'def cancelRequest(req_id: str) -> bool:', hl: true },
          { ln: 23, text: '    if is_dispatched(req_id):' },
          { ln: 24, text: '        return False' },
          { ln: 25, text: '    return purge_queue_entry(req_id)', hl: true }
        ],
        historyR0: []
      },
      'DEC-04': {
        id: 'DEC-04', name: 'DEC-04 — Return structured dict', shortName: 'DEC-04 — Return structured dict', file: 'Architecture Decisions', category: 'Decisions',
        relKind: 'decision', relLabel: 'Direct design decision',
        plainReason: 'Connects architectural rationale directly to src/bbb.py · createRequest() without requiring an intermediate requirement record.',
        linkedIntentId: 'DEC-04', linkedIntentTitle: 'DEC-04: Direct decision-to-code record',
        provenanceMethod: 'Maintainer-authored Technical Decision record for incoming change (8f3b21d)', provenanceAnchor: 'DEC-04 → directly concerns src/bbb.py · createRequest(payload)',
        provenanceScore: 'Explicit human rationale record', provenanceNote: 'Reusable as rationale when reviewing connected neighbors.',
        r1Status: 'reviewed', judgmentChoice: 'Confirm valid with change', followUpWork: 'No edit needed',
        savedRationale: 'Authored by JC Linaban for incoming change to explain why createRequest() returns {"id", "status"} synchronously.',
        draftRationale: '', draftIsAi: false, r1Reviewer: 'JC Linaban', r1ReviewedAt: 'Today, 14:00',
        coverageCondition: 'reviewed', coverageBadge: 'Reviewed Support', coverageDetail: 'Direct architectural decision record anchored to src/bbb.py · createRequest().',
        codeExcerptR0: [
          { ln: 1, text: '[DEC-04 was recorded in R1 · 8f3b21d]' },
          { ln: 2, text: 'Prior R0 baseline relied on separate getStatus(req_id) polling.', hl: true }
        ],
        codeExcerptR1: [
          { ln: 1, text: 'Decision ID: DEC-04 · Author: JC Linaban · Revision: R1 (8f3b21d)' },
          { ln: 2, text: 'Title: Return structured dictionary from createRequest', hl: true },
          { ln: 3, text: 'Direct Target: src/bbb.py · createRequest(payload)' },
          { ln: 4, text: 'Rationale: Returning {"id": req_id, "status": "PENDING"} synchronously', hl: true },
          { ln: 5, text: 'eliminates extra getStatus(req_id) polling for order intake callers.' }
        ],
        historyR0: []
      },
      'docs/onboarding_notes.md': {
        id: 'docs/onboarding_notes.md', name: 'onboarding_notes.md (§1.4 Handover)', shortName: 'docs/onboarding_notes.md · §1.4', file: 'docs/onboarding_notes.md', category: 'Documentation',
        relKind: 'candidate', relLabel: 'Semantic candidate',
        plainReason: 'Unreviewed embedding candidate (0.86 cosine similarity) suggesting that §1.4 Handover Notes describes request queue lifecycle states.',
        linkedIntentId: 'REQ-02', linkedIntentTitle: 'REQ-02: Track request creation status',
        provenanceMethod: 'Paired code-text embedding similarity (UniXcoder-base)', provenanceAnchor: 'docs/onboarding_notes.md lines 9–14 ↔ src/bbb.py · createRequest()',
        provenanceScore: '0.86 cosine similarity (candidate ranking signal only; requires human review)', provenanceNote: 'Never promoted to a confirmed documentation link until an authorized reviewer inspects and accepts it.',
        r1Status: 'candidate', judgmentChoice: 'Confirm valid with change', followUpWork: 'No edit needed',
        savedRationale: '', draftRationale: '', draftIsAi: false, r1Reviewer: '', r1ReviewedAt: '',
        coverageCondition: 'candidate', coverageBadge: 'Candidate Only', coverageDetail: 'Semantic candidate awaiting human judgment to confirm whether it explains behavior or merely mentions queue states.',
        codeExcerptR0: [
          { ln: 9, text: '## 1.4 Request Queue Handover Notes' },
          { ln: 10, text: 'New orders enter the `PENDING` lifecycle state when created', hl: true },
          { ln: 11, text: 'in `src/bbb.py` before background workers dispatch them.', hl: true }
        ],
        codeExcerptR1: [
          { ln: 9, text: '## 1.4 Request Queue Handover Notes' },
          { ln: 10, text: 'New orders enter the `PENDING` lifecycle state when created', hl: true },
          { ln: 11, text: 'in `src/bbb.py` before background workers dispatch them.', hl: true }
        ],
        historyR0: []
      },
      'docs/legacy_export.pdf': {
        id: 'docs/legacy_export.pdf', name: 'legacy_export.pdf (Scanned Spec)', shortName: 'docs/legacy_export.pdf', file: 'docs/legacy_export.pdf', category: 'Documentation',
        relKind: 'explains', relLabel: 'Parser boundary',
        plainReason: 'Scanned archival PDF with no extractable text layer. Reported transparently as Coverage unknown — parser limit rather than hidden or treated as unaffected.',
        linkedIntentId: 'REQ-02', linkedIntentTitle: 'Extraction boundary disclosed in Pipeline Stage 2',
        provenanceMethod: 'Docling PDF layout extractor + fallback check', provenanceAnchor: 'docs/legacy_export.pdf (0 text tokens extracted; image-only scan)',
        provenanceScore: 'Extraction warning — human inspection or OCR required', provenanceNote: 'Continuum distinguishes unparsed files from verified zero-impact records.',
        r1Status: 'historical', judgmentChoice: 'Keep link · Flag content issue', followUpWork: 'Doc update deferred',
        savedRationale: '', draftRationale: '', draftIsAi: false, r1Reviewer: '', r1ReviewedAt: '',
        coverageCondition: 'unknown', coverageBadge: 'Coverage Unknown', coverageDetail: 'Scanned PDF without text layer; reported as unknown coverage rather than false all-clear.',
        codeExcerptR0: [
          { ln: 1, text: '[Binary / Scanned PDF Archive: docs/legacy_export.pdf]' },
          { ln: 2, text: 'Stage 2 Docling Warning: No extractable text layer found.', hl: true },
          { ln: 3, text: 'Status: Coverage unknown (never counted as 100% documented).' }
        ],
        codeExcerptR1: [
          { ln: 1, text: '[Binary / Scanned PDF Archive: docs/legacy_export.pdf]' },
          { ln: 2, text: 'Stage 2 Docling Warning: No extractable text layer found.', hl: true },
          { ln: 3, text: 'Status: Coverage unknown (never counted as 100% documented).' }
        ],
        historyR0: []
      }
    }
  };
}

export function loadState() {
  const initial = createInitialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.artifacts?.['aaa.py::submitUserOrder']) {
        const mergedArtifacts = { ...initial.artifacts };
        Object.keys(parsed.artifacts).forEach(key => {
          if (mergedArtifacts[key]) {
            mergedArtifacts[key] = {
              ...mergedArtifacts[key],
              ...parsed.artifacts[key],
              shortName: initial.artifacts[key]?.shortName || parsed.artifacts[key]?.shortName?.replace(' :: ', ' · '),
              name: initial.artifacts[key]?.name || parsed.artifacts[key]?.name
            };
          } else {
            mergedArtifacts[key] = {
              ...parsed.artifacts[key],
              shortName: parsed.artifacts[key]?.shortName?.replace(' :: ', ' — ')
            };
          }
        });
        return {
          ...initial,
          ...parsed,
          artifacts: mergedArtifacts,
          onboardingSteps: initial.onboardingSteps,
          activityLog: (parsed.activityLog || initial.activityLog).map(log => ({
            ...log,
            action: log.action ? log.action.replace(' :: ', ' · ').replace(' at R1', ' with change') : log.action,
            badge: log.badge ? log.badge.replace('Reviewed at R1', 'Reviewed with change').replace('Historical R0', 'Baseline') : log.badge
          })),
          repositories: initial.repositories,
          c4Topology: parsed.c4Topology || initial.c4Topology,
          chatMessages: parsed.chatMessages || initial.chatMessages,
          activeRepoId: parsed.activeRepoId || initial.activeRepoId,
        };
      }
    }
  } catch { /* ignore */ }
  return initial;
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}
