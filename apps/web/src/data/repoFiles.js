export const REPO_FILES = {
  'src/bbb.py': {
    path: 'src/bbb.py',
    name: 'bbb.py',
    folder: 'src',
    lang: 'python',
    loc: 36,
    size: '1.4 KB',
    status: 'changed',
    statusLabel: 'Changed in R1',
    statusBadgeCls: 'badge--seed',
    commit: {
      author: 'JC Linaban',
      initials: 'JC',
      msg: 'Modify createRequest() to return dict per DEC-04',
      sha: '8f3b21d',
      time: '2 hours ago'
    },
    symbols: [
      { id: 'next_seq', name: 'next_seq', kind: 'func', line: 11, tag: 'Internal helper' },
      { id: 'createRequest', name: 'createRequest', kind: 'func', line: 14, isSeed: true, tag: 'Seed Provider · DEC-04', badge: 'Changed in R1' },
      { id: 'cancelRequest', name: 'cancelRequest', kind: 'func', line: 27, tag: 'Sibling · Bus Factor = 1', badge: 'Undocumented' }
    ],
    code: `"""
Service Request Handler for Checkout Service (checkout-service).
Handles request registration, queue persistence, and lifecycle transitions.
"""

import uuid
from typing import Dict, Any
from app.redis import get_redis_client
from app.audit import persist_order, is_dispatched, purge_queue_entry

def next_seq() -> str:
    return str(uuid.uuid4())[:8]

def createRequest(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Registers a new incoming checkout order payload into the processing queue.
    
    Changed in R1 (8f3b21d) per DEC-04:
    Returns structured dictionary with initial queue status synchronously,
    eliminating redundant getStatus() polling.
    """
    req_id = f"req_{next_seq()}"
    persist_order(req_id, payload, state="PENDING")
    return {"id": req_id, "status": "PENDING"}

def cancelRequest(req_id: str) -> bool:
    """
    Cancels a pending request before worker dispatch.
    
    NOTE: Sibling method with 0 documentation links and Bus Factor = 1 (C. Jimenez).
    """
    if is_dispatched(req_id):
        return False
    return purge_queue_entry(req_id)
`,
    blame: [
      { lines: [1, 12], author: 'C. Jimenez', sha: 'a41c90e', time: 'Oct 10, 2026', msg: 'Initial service request handlers' },
      { lines: [14, 25], author: 'JC Linaban', sha: '8f3b21d', time: '2 hours ago', msg: 'DEC-04 dictionary return shape' },
      { lines: [27, 36], author: 'C. Jimenez', sha: 'a41c90e', time: 'Oct 10, 2026', msg: 'Add cancelRequest unreviewed method' }
    ]
  },

  'src/aaa.py': {
    path: 'src/aaa.py',
    name: 'aaa.py',
    folder: 'src',
    lang: 'python',
    loc: 26,
    size: '1.1 KB',
    status: 'caller',
    statusLabel: 'Caller Update Open',
    statusBadgeCls: 'badge--caller',
    commit: {
      author: 'JC Linaban',
      initials: 'JC',
      msg: 'Audit order intake caller for dictionary return compatibility',
      sha: '8f3b21d',
      time: '42 mins ago'
    },
    symbols: [
      { id: 'OrderValidationError', name: 'OrderValidationError', kind: 'class', line: 8, tag: 'Custom Exception' },
      { id: 'validateOrderPayload', name: 'validateOrderPayload', kind: 'func', line: 11, tag: 'Payload validator' },
      { id: 'submitUserOrder', name: 'submitUserOrder', kind: 'func', line: 17, isCaller: true, tag: 'Downstream Caller · Line 23', badge: 'Code Update Open' }
    ],
    code: `"""
Order Intake Controller for Checkout Service (checkout-service).
Processes incoming user orders and enqueues background processing.
"""

from typing import List, Dict, Any
from src.bbb import createRequest

class OrderValidationError(Exception):
    pass

def validateOrderPayload(user: str, items: List[Dict[str, Any]]) -> None:
    if not user or not user.strip():
        raise OrderValidationError("User identifier must not be empty.")
    if not items:
        raise OrderValidationError("Order must contain at least one line item.")

def submitUserOrder(user: str, items: List[Dict[str, Any]]) -> str:
    """
    Intake handler for checkout orders.
    
    WARNING: Slices req_id.strip(), which causes an AttributeError when
    invoking R1 createRequest() returning a dict. Requires caller update.
    """
    validateOrderPayload(user, items)
    payload = {"user": user, "items": items}
    req_id = createRequest(payload)
    return "Queued order: " + req_id.strip()
`,
    blame: [
      { lines: [1, 16], author: 'JC Linaban', sha: 'a41c90e', time: 'Oct 11, 2026', msg: 'Order payload validation' },
      { lines: [17, 26], author: 'C. Jimenez', sha: 'a41c90e', time: 'Oct 12, 2026', msg: 'submitUserOrder intake function' }
    ]
  },

  'src/compat.py': {
    path: 'src/compat.py',
    name: 'compat.py',
    folder: 'src',
    lang: 'python',
    loc: 16,
    size: '0.8 KB',
    status: 'adapter',
    statusLabel: 'Compatible Adapter',
    statusBadgeCls: 'badge--ok',
    commit: {
      author: 'JC Linaban',
      initials: 'JC',
      msg: 'Revalidate normalizeRequestResult() against R1 dictionary shape',
      sha: '8f3b21d',
      time: '42 mins ago'
    },
    symbols: [
      { id: 'normalizeRequestResult', name: 'normalizeRequestResult', kind: 'func', line: 8, tag: 'Adapter Helper · isinstance guard', badge: 'Compatible' }
    ],
    code: `"""
Compatibility Layer for Checkout Service.
Normalizes response shapes across R0 legacy string callers and R1 dictionary callers.
"""

from typing import Union, Dict, Any

def normalizeRequestResult(res: Union[str, Dict[str, Any]]) -> str:
    """
    Normalizes a createRequest result into a standardized string identifier.
    Fully compatible with both R0 scalar strings and R1 structured dictionaries.
    """
    if isinstance(res, dict):
        return str(res.get("id", ""))
    return str(res).strip()
`,
    blame: [
      { lines: [1, 16], author: 'JC Linaban', sha: '8f3b21d', time: '42 mins ago', msg: 'Add isinstance adapter helper' }
    ]
  },

  'docs/aaa.md': {
    path: 'docs/aaa.md',
    name: 'aaa.md',
    folder: 'docs',
    lang: 'markdown',
    loc: 18,
    size: '0.9 KB',
    status: 'deferred',
    statusLabel: 'Doc Update Deferred',
    statusBadgeCls: 'badge--seed',
    commit: {
      author: 'A. Marasigan',
      initials: 'AM',
      msg: 'Review §2.1 Request API specification for R1 deferral',
      sha: '8f3b21d',
      time: '18 mins ago'
    },
    symbols: [
      { id: 'sec-1', name: '1. Overview', kind: 'spec', line: 3, tag: 'Architecture Intro' },
      { id: 'sec-2.1', name: '2.1 Request API', kind: 'spec', line: 6, tag: 'Docling Spec Anchor', badge: 'Doc Update Deferred' },
      { id: 'sec-2.2', name: '2.2 Order Processing Flow', kind: 'spec', line: 13, tag: 'Lifecycle description' }
    ],
    code: `# Checkout Service API Documentation

## 1. Overview
The Checkout Service provides synchronous order intake and asynchronous fulfillment dispatch.

### 2.1 Request API (\`createRequest\`)
Call \`createRequest(payload)\` to register a new order payload into the intake queue.

- **Parameters**: \`payload: dict\` containing \`user\` and \`items\`
- **Returns**: A plain string identifier (\`req_<sequence>\`). *(Outdated prose: deferred update)*
- **Lifecycle**: Use \`getStatus(req_id)\` to poll initial queue state.

### 2.2 Order Processing Flow
Orders enter the \`PENDING\` state synchronously before being picked up by Redis workers.
`,
    blame: [
      { lines: [1, 18], author: 'A. Marasigan', sha: '8f3b21d', time: '18 mins ago', msg: 'Annotate §2.1 with deferred status' }
    ]
  },

  'docs/onboarding_notes.md': {
    path: 'docs/onboarding_notes.md',
    name: 'onboarding_notes.md',
    folder: 'docs',
    lang: 'markdown',
    loc: 24,
    size: '1.2 KB',
    status: 'candidate',
    statusLabel: 'Semantic Candidate',
    statusBadgeCls: 'badge--caller',
    commit: {
      author: 'S. Rivera',
      initials: 'SR',
      msg: 'Draft developer onboarding notes for queue handover',
      sha: '8f3b21d',
      time: '1 hour ago'
    },
    symbols: [
      { id: 'sec-onb-1', name: '1. Engineering Onboarding', kind: 'spec', line: 1, tag: 'Setup Guide' },
      { id: 'sec-onb-1.4', name: '1.4 Queue Handover Notes', kind: 'spec', line: 9, tag: 'UniXcoder Candidate (0.86)', badge: 'Candidate Only' }
    ],
    code: `# Engineering Onboarding & Handover Notes

## 1. Developer Environment Setup
Welcome to the Checkout Service team. This repository houses order intake, payment authorization webhooks, and asynchronous message workers.

- Requires Python 3.12+ and Redis 7.2+
- Run test suite: \`pytest tests/\`
- Verify continuity links: \`continuum audit --rev R1\`

## 1.4 Request Queue Handover Notes
New orders enter the \`PENDING\` lifecycle state when created in \`src/bbb.py\` before background workers dispatch them.

> Note: Semantic candidate awaiting human judgment to confirm whether it explains behavior or merely mentions queue states.
`,
    blame: [
      { lines: [1, 24], author: 'S. Rivera', sha: '8f3b21d', time: '1 hour ago', msg: 'Initial onboarding draft' }
    ]
  },

  'docs/legacy_export.pdf': {
    path: 'docs/legacy_export.pdf',
    name: 'legacy_export.pdf',
    folder: 'docs',
    lang: 'pdf',
    loc: 1,
    size: '4.8 MB',
    status: 'boundary',
    statusLabel: 'Parser Boundary Disclosed',
    statusBadgeCls: 'badge--neutral',
    commit: {
      author: 'Archival System',
      initials: 'AS',
      msg: 'Import legacy scanned checkout specifications from 1998',
      sha: 'a41c90e',
      time: 'Oct 1, 2026'
    },
    symbols: [
      { id: 'pdf-limit', name: 'Archival Scanned Spec', kind: 'spec', line: 1, tag: 'Zero Text Layer · Stage 2 Warning', badge: 'Coverage Unknown' }
    ],
    code: `[Binary / Scanned PDF Archive: docs/legacy_export.pdf]
Stage 2 Docling Layout Warning: No extractable text layer found.
Continuum Boundary Disclosure:
- File is an image-only scan of legacy checkout business rules.
- Transparently reported as 'Coverage Unknown' rather than treated as an all-clear or zero-impact file.
- Recommended action: Run OCR enrichment pipeline before next release cycle.
`,
    blame: [
      { lines: [1, 1], author: 'Archival System', sha: 'a41c90e', time: 'Oct 1, 2026', msg: 'Legacy scanned PDF' }
    ]
  },

  'specs/DEC-04.md': {
    path: 'specs/DEC-04.md',
    name: 'DEC-04.md',
    folder: 'specs',
    lang: 'markdown',
    loc: 22,
    size: '1.0 KB',
    status: 'changed',
    statusLabel: 'Direct Decision',
    statusBadgeCls: 'badge--seed',
    commit: {
      author: 'JC Linaban',
      initials: 'JC',
      msg: 'Record DEC-04: Return structured dictionary from createRequest',
      sha: '8f3b21d',
      time: '2 hours ago'
    },
    symbols: [
      { id: 'dec-04-title', name: 'DEC-04: Structured Return', kind: 'spec', line: 1, tag: 'Architectural Decision Record' },
      { id: 'dec-04-rationale', name: 'Decision Rationale', kind: 'spec', line: 9, tag: 'Justification for R1' }
    ],
    code: `# DEC-04: Return Structured Dictionary from createRequest

- **Status**: Accepted
- **Author**: John Christian Linaban (Lead Developer)
- **Revision**: R1 (8f3b21d)
- **Target**: \`src/bbb.py · createRequest()\`

## Context & Problem
In the R0 baseline (a41c90e), \`createRequest()\` returned a scalar string ID (\`req_<uuid>\`). Clients that needed initial processing state were forced to poll \`getStatus(req_id)\` immediately after queueing, doubling Redis roundtrips.

## Decision
Modify \`createRequest()\` to return \`{"id": req_id, "status": "PENDING"}\` synchronously.

## Consequences & Follow-up
- Eliminates getStatus polling for modern callers.
- Downstream caller \`src/aaa.py · submitUserOrder()\` requires an update because it performs \`req_id.strip()\`.
- Compatibility layer \`src/compat.py\` safely handles both shapes.
`,
    blame: [
      { lines: [1, 22], author: 'JC Linaban', sha: '8f3b21d', time: '2 hours ago', msg: 'Author DEC-04 rationale' }
    ]
  },

  'specs/REQ-02.md': {
    path: 'specs/REQ-02.md',
    name: 'REQ-02.md',
    folder: 'specs',
    lang: 'markdown',
    loc: 18,
    size: '0.8 KB',
    status: 'adapter',
    statusLabel: 'Requirement Record',
    statusBadgeCls: 'badge--ok',
    commit: {
      author: 'C. Jimenez',
      initials: 'CJ',
      msg: 'Link REQ-02 to createRequest lifecycle status contract',
      sha: 'a41c90e',
      time: 'Oct 11, 2026'
    },
    symbols: [
      { id: 'req-02-spec', name: 'REQ-02: Status Tracking', kind: 'spec', line: 1, tag: 'System Requirement' }
    ],
    code: `# REQ-02: Track Request Creation Status

- **Standard**: ISO/IEC/IEEE 29148
- **Category**: Functional / Lifecycle Traceability
- **Realized By**: \`src/bbb.py · createRequest()\`

## Requirement Statement
Upon checkout request creation, the service shall provide both the unique request identifier and its initial lifecycle state synchronously to the intake caller.

## Verification Method
- Static AST call verification in \`src/bbb.py\`
- Unit test assertion verifying return shape contains keys \`id\` and \`status\`
`,
    blame: [
      { lines: [1, 18], author: 'C. Jimenez', sha: 'a41c90e', time: 'Oct 11, 2026', msg: 'Initial REQ-02 definition' }
    ]
  },

  'src/models.py': {
    path: 'src/models.py',
    name: 'models.py',
    folder: 'src',
    lang: 'python',
    loc: 44,
    size: '1.6 KB',
    status: 'clean',
    statusLabel: 'Pydantic Schemas',
    statusBadgeCls: 'badge--neutral',
    commit: {
      author: 'JC Linaban',
      initials: 'JC',
      msg: 'Define Pydantic schema for RequestReceipt dictionary return shape',
      sha: '8f3b21d',
      time: '2 hours ago'
    },
    symbols: [
      { id: 'RequestStatus', name: 'RequestStatus', kind: 'class', line: 11, tag: 'Enum: PENDING, DISPATCHED, FAILED' },
      { id: 'CartItem', name: 'CartItem', kind: 'class', line: 17, tag: 'Data model' },
      { id: 'OrderPayload', name: 'OrderPayload', kind: 'class', line: 23, tag: 'Validated schema' },
      { id: 'RequestReceipt', name: 'RequestReceipt', kind: 'class', line: 31, tag: 'DEC-04 Contract Schema', badge: 'R1 Shape' }
    ],
    code: `"""
Data Models & Serialization Schemas for Checkout Service.
Implements Pydantic v2 schemas for intake validation and DEC-04 receipt shapes.
"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

class RequestStatus(str, Enum):
    PENDING = "PENDING"
    QUEUED = "QUEUED"
    DISPATCHED = "DISPATCHED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class CartItem(BaseModel):
    sku: str = Field(..., description="Unique product stock-keeping unit")
    quantity: int = Field(..., gt=0, description="Item quantity ordered")
    unit_price_cents: int = Field(..., ge=0, description="Price per unit in cents")

class OrderPayload(BaseModel):
    user: str = Field(..., min_length=1, description="Authenticated customer ID")
    items: List[CartItem] = Field(..., min_items=1, description="Non-empty cart items")
    idempotency_key: Optional[str] = Field(None, description="Client idempotency token")

class RequestReceipt(BaseModel):
    """
    R1 Contract Shape per DEC-04:
    Synchronous return value containing unique request tracking ID and initial state.
    """
    id: str = Field(..., description="Generated uuid sequence: req_<uuid>")
    status: RequestStatus = Field(default=RequestStatus.PENDING, description="Initial queue state")
`,
    blame: [
      { lines: [1, 28], author: 'C. Jimenez', sha: 'a41c90e', time: 'Oct 9, 2026', msg: 'Baseline Pydantic cart models' },
      { lines: [29, 44], author: 'JC Linaban', sha: '8f3b21d', time: '2 hours ago', msg: 'Add RequestReceipt model per DEC-04' }
    ]
  },

  'src/redis_queue.py': {
    path: 'src/redis_queue.py',
    name: 'redis_queue.py',
    folder: 'src',
    lang: 'python',
    loc: 38,
    size: '1.4 KB',
    status: 'clean',
    statusLabel: 'Redis Dispatcher',
    statusBadgeCls: 'badge--neutral',
    commit: {
      author: 'C. Jimenez',
      initials: 'CJ',
      msg: 'Implement Redis stream producer for async checkout queue',
      sha: 'a41c90e',
      time: 'Oct 8, 2026'
    },
    symbols: [
      { id: 'get_redis_pool', name: 'get_redis_pool', kind: 'func', line: 12, tag: 'Connection Pool' },
      { id: 'enqueue_order_job', name: 'enqueue_order_job', kind: 'func', line: 18, tag: 'Queue Producer' },
      { id: 'get_queue_depth', name: 'get_queue_depth', kind: 'func', line: 28, tag: 'Telemetry' },
      { id: 'purge_queue_entry', name: 'purge_queue_entry', kind: 'func', line: 33, tag: 'Cancellation Helper' }
    ],
    code: `"""
Redis Queue Adapter for Checkout Service.
Manages asynchronous task queueing, worker stream dispatch, and dead-letter handling.
"""

import json
from typing import Dict, Any
from app.config import get_settings

STREAM_KEY = "checkout:order_stream"

def get_redis_pool():
    settings = get_settings()
    return {"host": settings.redis_host, "port": settings.redis_port, "connected": True}

def enqueue_order_job(req_id: str, payload: Dict[str, Any]) -> str:
    """Appends an order job to Redis Stream with correlation headers."""
    message = {
        "req_id": req_id,
        "payload": json.dumps(payload),
        "status": "PENDING"
    }
    return f"stream_entry_{req_id}"

def get_queue_depth() -> int:
    """Returns number of unprocessed queue items awaiting worker dispatch."""
    return 14

def purge_queue_entry(req_id: str) -> bool:
    """Purges a pending task prior to worker claim (used by cancelRequest)."""
    return True
`,
    blame: [
      { lines: [1, 38], author: 'C. Jimenez', sha: 'a41c90e', time: 'Oct 8, 2026', msg: 'Queue management implementation' }
    ]
  },

  'src/audit.py': {
    path: 'src/audit.py',
    name: 'audit.py',
    folder: 'src',
    lang: 'python',
    loc: 32,
    size: '1.2 KB',
    status: 'clean',
    statusLabel: 'Audit Logger',
    statusBadgeCls: 'badge--neutral',
    commit: {
      author: 'JC Linaban',
      initials: 'JC',
      msg: 'Record audit entries for order state changes with immutable digest',
      sha: 'a41c90e',
      time: 'Oct 10, 2026'
    },
    symbols: [
      { id: 'persist_order', name: 'persist_order', kind: 'func', line: 10, tag: 'Persistence Layer' },
      { id: 'is_dispatched', name: 'is_dispatched', kind: 'func', line: 19, tag: 'State Check' },
      { id: 'record_audit_event', name: 'record_audit_event', kind: 'func', line: 24, tag: 'Compliance Log' }
    ],
    code: `"""
Audit & Persistence Subsystem for Checkout Service.
Provides immutable event logs and state tracking for every registered order.
"""

import time
from typing import Dict, Any

_ORDER_STORE: Dict[str, Dict[str, Any]] = {}

def persist_order(req_id: str, payload: Dict[str, Any], state: str = "PENDING") -> None:
    """Persists order snapshot in in-memory store and emits audit telemetry."""
    _ORDER_STORE[req_id] = {
        "payload": payload,
        "state": state,
        "created_at": time.time()
    }

def is_dispatched(req_id: str) -> bool:
    """Returns True if worker dispatch has already locked the order record."""
    order = _ORDER_STORE.get(req_id)
    return bool(order and order.get("state") == "DISPATCHED")

def record_audit_event(actor: str, action: str, req_id: str) -> None:
    """Emits structured audit JSON log for ISO/IEC/IEEE 29148 traceability."""
    pass
`,
    blame: [
      { lines: [1, 32], author: 'JC Linaban', sha: 'a41c90e', time: 'Oct 10, 2026', msg: 'Audit logging infrastructure' }
    ]
  },

  'src/config.py': {
    path: 'src/config.py',
    name: 'config.py',
    folder: 'src',
    lang: 'python',
    loc: 26,
    size: '0.9 KB',
    status: 'clean',
    statusLabel: 'Service Config',
    statusBadgeCls: 'badge--neutral',
    commit: {
      author: 'C. Jimenez',
      initials: 'CJ',
      msg: 'Configure Redis connection, timeout thresholds, and retry policy',
      sha: 'a41c90e',
      time: 'Oct 7, 2026'
    },
    symbols: [
      { id: 'Settings', name: 'Settings', kind: 'class', line: 8, tag: 'Pydantic Settings' },
      { id: 'get_settings', name: 'get_settings', kind: 'func', line: 20, tag: 'Singleton Factory' }
    ],
    code: `"""
Application Configuration for Checkout Service.
Loaded from environment variables with fallback defaults.
"""

from pydantic import BaseModel

class Settings(BaseModel):
    app_name: str = "checkout-service"
    environment: str = "production"
    redis_host: str = "redis-cluster.internal"
    redis_port: int = 6379
    max_queue_concurrency: int = 50
    idempotency_window_sec: int = 3600
    enable_dec04_dict_return: bool = True

_instance = None

def get_settings() -> Settings:
    global _instance
    if _instance is None:
        _instance = Settings()
    return _instance
`,
    blame: [
      { lines: [1, 26], author: 'C. Jimenez', sha: 'a41c90e', time: 'Oct 7, 2026', msg: 'Service settings setup' }
    ]
  },

  'src/middleware.py': {
    path: 'src/middleware.py',
    name: 'middleware.py',
    folder: 'src',
    lang: 'python',
    loc: 28,
    size: '1.0 KB',
    status: 'clean',
    statusLabel: 'Middleware Layer',
    statusBadgeCls: 'badge--neutral',
    commit: {
      author: 'JC Linaban',
      initials: 'JC',
      msg: 'Add correlation ID and user authentication headers to request context',
      sha: 'a41c90e',
      time: 'Oct 11, 2026'
    },
    symbols: [
      { id: 'extract_correlation_id', name: 'extract_correlation_id', kind: 'func', line: 10, tag: 'Trace Context' },
      { id: 'verify_auth_header', name: 'verify_auth_header', kind: 'func', line: 16, tag: 'Security Guard' }
    ],
    code: `"""
HTTP Middleware & Correlation Context for Checkout Service.
Injects telemetry headers and enforces JWT authorization checks on intake routes.
"""

import uuid
from typing import Optional

def extract_correlation_id(header_val: Optional[str]) -> str:
    """Extracts existing X-Correlation-ID header or generates a synthetic UUID4."""
    if header_val and header_val.strip():
        return header_val.strip()
    return f"corr_{uuid.uuid4().hex[:12]}"

def verify_auth_header(auth_header: Optional[str]) -> str:
    """Validates Bearer token format and returns extracted user identity."""
    if not auth_header or not auth_header.startswith("Bearer "):
        raise PermissionError("Missing or malformed Authorization header.")
    token = auth_header.split(" ")[1]
    return f"usr_{token[:8]}"
`,
    blame: [
      { lines: [1, 28], author: 'JC Linaban', sha: 'a41c90e', time: 'Oct 11, 2026', msg: 'Add auth and trace middleware' }
    ]
  },

  'tests/test_checkout_contract.py': {
    path: 'tests/test_checkout_contract.py',
    name: 'test_checkout_contract.py',
    folder: 'tests',
    lang: 'python',
    loc: 32,
    size: '1.1 KB',
    status: 'clean',
    statusLabel: 'Contract Suite',
    statusBadgeCls: 'badge--neutral',
    commit: {
      author: 'JC Linaban',
      initials: 'JC',
      msg: 'Add pytest assertion suite for R1 dictionary return contract',
      sha: '8f3b21d',
      time: '2 hours ago'
    },
    symbols: [
      { id: 'test_create_request_dict_shape', name: 'test_create_request_dict_shape', kind: 'func', line: 8, tag: 'R1 Assertion' },
      { id: 'test_cancel_request_purges_queue', name: 'test_cancel_request_purges_queue', kind: 'func', line: 20, tag: 'Cancellation Suite' }
    ],
    code: `"""
Unit & Contract Test Suite for Service Request Handlers.
Validates R1 contract behavior per DEC-04.
"""

import pytest
from src.bbb import createRequest, cancelRequest

def test_create_request_dict_shape():
    """Validates that R1 returns a dictionary with 'id' and 'status' keys."""
    payload = {"user": "usr_test_101", "items": [{"sku": "SKU-99", "qty": 1}]}
    result = createRequest(payload)
    
    assert isinstance(result, dict), "R1 contract must return a dictionary"
    assert "id" in result, "Result dictionary must contain 'id'"
    assert "status" in result, "Result dictionary must contain 'status'"
    assert result["status"] == "PENDING"

def test_cancel_request_purges_queue():
    """Ensures cancelRequest returns True for un-dispatched orders."""
    res = cancelRequest("req_test_seq")
    assert res is True
`,
    blame: [
      { lines: [1, 32], author: 'JC Linaban', sha: '8f3b21d', time: '2 hours ago', msg: 'Add R1 contract pytest suite' }
    ]
  },

  'tests/test_order_intake.py': {
    path: 'tests/test_order_intake.py',
    name: 'test_order_intake.py',
    folder: 'tests',
    lang: 'python',
    loc: 28,
    size: '1.0 KB',
    status: 'caller',
    statusLabel: 'Failing on R1',
    statusBadgeCls: 'badge--caller',
    commit: {
      author: 'JC Linaban',
      initials: 'JC',
      msg: 'Record test reproducing AttributeError in submitUserOrder on R1',
      sha: '8f3b21d',
      time: '42 mins ago'
    },
    symbols: [
      { id: 'test_submit_user_order_breaking', name: 'test_submit_user_order_breaking', kind: 'func', line: 9, tag: 'Regression Test', badge: 'Breaks on R1' },
      { id: 'test_payload_validation_empty_user', name: 'test_payload_validation_empty_user', kind: 'func', line: 20, tag: 'Payload Validation' }
    ],
    code: `"""
Order Intake Test Suite.
Reproduces breaking caller exception when calling R1 createRequest.
"""

import pytest
from src.aaa import submitUserOrder, OrderValidationError

def test_submit_user_order_breaking():
    """
    KNOW ISSUE ON R1:
    submitUserOrder executes req_id.strip(), which fails with AttributeError
    because createRequest now returns a dictionary.
    """
    with pytest.raises(AttributeError):
        submitUserOrder("usr_alex", [{"sku": "SKU-01", "qty": 2}])

def test_payload_validation_empty_user():
    """Verifies that empty user identifiers trigger OrderValidationError."""
    with pytest.raises(OrderValidationError):
        submitUserOrder("", [{"sku": "SKU-01", "qty": 1}])
`,
    blame: [
      { lines: [1, 28], author: 'JC Linaban', sha: '8f3b21d', time: '42 mins ago', msg: 'Add failing test for caller adaptation' }
    ]
  },

  'tests/test_compat_adapter.py': {
    path: 'tests/test_compat_adapter.py',
    name: 'test_compat_adapter.py',
    folder: 'tests',
    lang: 'python',
    loc: 24,
    size: '0.8 KB',
    status: 'adapter',
    statusLabel: 'Passing Suite',
    statusBadgeCls: 'badge--ok',
    commit: {
      author: 'JC Linaban',
      initials: 'JC',
      msg: 'Verify normalizeRequestResult against both string and dict shapes',
      sha: '8f3b21d',
      time: '42 mins ago'
    },
    symbols: [
      { id: 'test_normalize_legacy_r0_string', name: 'test_normalize_legacy_r0_string', kind: 'func', line: 8, tag: 'Legacy Compatibility' },
      { id: 'test_normalize_modern_r1_dict', name: 'test_normalize_modern_r1_dict', kind: 'func', line: 15, tag: 'R1 Compatibility' }
    ],
    code: `"""
Compatibility Adapter Verification Suite.
"""

import pytest
from src.compat import normalizeRequestResult

def test_normalize_legacy_r0_string():
    """Ensures legacy R0 string input is preserved cleanly."""
    raw = "req_a41c90e  "
    assert normalizeRequestResult(raw) == "req_a41c90e"

def test_normalize_modern_r1_dict():
    """Ensures modern R1 dictionary return shape extracts the id string."""
    receipt = {"id": "req_8f3b21d", "status": "PENDING"}
    assert normalizeRequestResult(receipt) == "req_8f3b21d"
`,
    blame: [
      { lines: [1, 24], author: 'JC Linaban', sha: '8f3b21d', time: '42 mins ago', msg: 'Add adapter verification tests' }
    ]
  },

  'docs/architecture.md': {
    path: 'docs/architecture.md',
    name: 'architecture.md',
    folder: 'docs',
    lang: 'markdown',
    loc: 32,
    size: '1.4 KB',
    status: 'clean',
    statusLabel: 'System Design',
    statusBadgeCls: 'badge--neutral',
    commit: {
      author: 'C. Jimenez',
      initials: 'CJ',
      msg: 'Document system topology and asynchronous processing queues',
      sha: 'a41c90e',
      time: 'Oct 6, 2026'
    },
    symbols: [
      { id: 'arch-1', name: '1. Service Topology', kind: 'spec', line: 3, tag: 'Architecture Overview' },
      { id: 'arch-2', name: '2. Synchronous vs Asynchronous Boundary', kind: 'spec', line: 12, tag: 'DEC-04 Context' }
    ],
    code: `# Checkout Service Architecture Guide

## 1. Service Topology
The \`checkout-service\` operates as a high-throughput edge coordinator between customer order submission and backend fulfillment pipelines.

\`\`\`
[Web Client] ──> [src/aaa.py: submitUserOrder]
                         │
                         ▼
                 [src/bbb.py: createRequest]
                         │
                 ┌───────┴───────┐
                 ▼               ▼
          (Redis Stream)    (Immediate Sync Return)
          Worker Dispatch    {"id": req_id, "status": "PENDING"}
\`\`\`

## 2. Synchronous vs Asynchronous Boundary
Per **DEC-04**, the synchronous boundary was updated at revision R1 to provide immediate lifecycle visibility to callers without requiring redundant status polling.
`,
    blame: [
      { lines: [1, 32], author: 'C. Jimenez', sha: 'a41c90e', time: 'Oct 6, 2026', msg: 'Initial architecture documentation' }
    ]
  },

  'docs/migration_r1.md': {
    path: 'docs/migration_r1.md',
    name: 'migration_r1.md',
    folder: 'docs',
    lang: 'markdown',
    loc: 26,
    size: '1.1 KB',
    status: 'clean',
    statusLabel: 'Migration Guide',
    statusBadgeCls: 'badge--neutral',
    commit: {
      author: 'JC Linaban',
      initials: 'JC',
      msg: 'Author consumer migration guide for R0 to R1 breaking change',
      sha: '8f3b21d',
      time: '1 hour ago'
    },
    symbols: [
      { id: 'mig-1', name: '1. Overview of Return Contract Change', kind: 'spec', line: 3, tag: 'Migration Note' },
      { id: 'mig-2', name: '2. Upgrading Callers', kind: 'spec', line: 10, tag: 'Actionable Steps' }
    ],
    code: `# R1 Migration Guide: Adapting to Structured Dictionary Return

## 1. Overview of Return Contract Change
In revision R1 (\`8f3b21d\`), \`createRequest()\` changes its return contract from a scalar string to a dictionary.

- **Old (R0)**: \`req_id: str\`
- **New (R1)**: \`{"id": str, "status": "PENDING"}\`

## 2. Upgrading Callers
Direct callers such as \`src/aaa.py\` that slice the response using string methods must be upgraded:

\`\`\`python
# Deprecated (R0)
req_id = createRequest(payload)
print(req_id.strip())

# Recommended (R1)
receipt = createRequest(payload)
req_id = receipt["id"]
initial_status = receipt["status"]
\`\`\`

Alternatively, callers can import \`src/compat.py: normalizeRequestResult\` during phased migrations.
`,
    blame: [
      { lines: [1, 26], author: 'JC Linaban', sha: '8f3b21d', time: '1 hour ago', msg: 'Author migration documentation' }
    ]
  },

  'specs/DEC-01.md': {
    path: 'specs/DEC-01.md',
    name: 'DEC-01.md',
    folder: 'specs',
    lang: 'markdown',
    loc: 20,
    size: '0.9 KB',
    status: 'clean',
    statusLabel: 'Accepted ADR',
    statusBadgeCls: 'badge--neutral',
    commit: {
      author: 'C. Jimenez',
      initials: 'CJ',
      msg: 'Record DEC-01: Redis Streams for asynchronous queue persistence',
      sha: 'a41c90e',
      time: 'Oct 5, 2026'
    },
    symbols: [
      { id: 'dec-01-spec', name: 'DEC-01: Queue Engine', kind: 'spec', line: 1, tag: 'Architecture Decision' }
    ],
    code: `# DEC-01: Select Redis Streams as Asynchronous Queue Engine

- **Status**: Accepted
- **Author**: Cris Albert Jimenez (Core Maintainer)
- **Revision**: R0 (a41c90e)

## Context
The service requires durable, in-memory queueing with consumer group acknowledgement for background worker processing.

## Decision
Adopt Redis Streams (\`XADD\` / \`XREADGROUP\`) to handle order intake workloads up to 10,000 req/sec.
`,
    blame: [
      { lines: [1, 20], author: 'C. Jimenez', sha: 'a41c90e', time: 'Oct 5, 2026', msg: 'Initial DEC-01 architecture decision' }
    ]
  },

  'specs/REQ-01.md': {
    path: 'specs/REQ-01.md',
    name: 'REQ-01.md',
    folder: 'specs',
    lang: 'markdown',
    loc: 18,
    size: '0.8 KB',
    status: 'clean',
    statusLabel: 'System Req',
    statusBadgeCls: 'badge--neutral',
    commit: {
      author: 'A. Marasigan',
      initials: 'AM',
      msg: 'Record REQ-01: Idempotent order submission guarantee',
      sha: 'a41c90e',
      time: 'Oct 6, 2026'
    },
    symbols: [
      { id: 'req-01-spec', name: 'REQ-01: Idempotency', kind: 'spec', line: 1, tag: 'System Requirement' }
    ],
    code: `# REQ-01: Idempotent Request Intake

- **Standard**: ISO/IEC/IEEE 29148
- **Category**: Reliability / Safety

## Requirement Statement
When a client submits an order payload with an identical \`idempotency_key\` within a 60-minute window, the service shall return the original request receipt without creating duplicate queue jobs.
`,
    blame: [
      { lines: [1, 18], author: 'A. Marasigan', sha: 'a41c90e', time: 'Oct 6, 2026', msg: 'Initial REQ-01 requirement record' }
    ]
  },

  'pyproject.toml': {
    path: 'pyproject.toml',
    name: 'pyproject.toml',
    folder: '',
    lang: 'toml',
    loc: 24,
    size: '0.9 KB',
    status: 'clean',
    statusLabel: 'Build Config',
    statusBadgeCls: 'badge--neutral',
    commit: {
      author: 'JC Linaban',
      initials: 'JC',
      msg: 'Update project dependencies and test runner configuration',
      sha: '8f3b21d',
      time: '3 hours ago'
    },
    symbols: [
      { id: 'toml-proj', name: '[project] metadata', kind: 'spec', line: 1, tag: 'Python Package' },
      { id: 'toml-deps', name: 'dependencies', kind: 'spec', line: 8, tag: 'Dependencies' }
    ],
    code: `[project]
name = "checkout-service"
version = "1.2.0"
description = "Core asynchronous order intake microservice"
readme = "README.md"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.111.0",
    "pydantic>=2.7.0",
    "redis>=5.0.4",
    "uvicorn>=0.30.0"
]

[project.optional-dependencies]
dev = [
    "pytest>=8.2.0",
    "pytest-asyncio>=0.23.0",
    "tree-sitter>=0.22.0"
]

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
`,
    blame: [
      { lines: [1, 24], author: 'JC Linaban', sha: '8f3b21d', time: '3 hours ago', msg: 'Configure pyproject.toml' }
    ]
  },

  'Dockerfile': {
    path: 'Dockerfile',
    name: 'Dockerfile',
    folder: '',
    lang: 'dockerfile',
    loc: 22,
    size: '0.8 KB',
    status: 'clean',
    statusLabel: 'Container Spec',
    statusBadgeCls: 'badge--neutral',
    commit: {
      author: 'C. Jimenez',
      initials: 'CJ',
      msg: 'Multi-stage production Dockerfile with non-root security user',
      sha: 'a41c90e',
      time: 'Oct 4, 2026'
    },
    symbols: [
      { id: 'docker-builder', name: 'Stage 1: Builder', kind: 'spec', line: 1, tag: 'Build stage' },
      { id: 'docker-runtime', name: 'Stage 2: Runtime', kind: 'spec', line: 11, tag: 'Production image' }
    ],
    code: `# Multi-stage Dockerfile for checkout-service
FROM python:3.12-slim AS builder

WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir pip-tools && \\
    pip wheel --no-cache-dir --wheel-dir /app/wheels .

FROM python:3.12-slim AS runner

WORKDIR /app
RUN useradd -m -u 1000 appuser
COPY --from=builder /app/wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

COPY src/ /app/src/
USER appuser

EXPOSE 8080
CMD ["uvicorn", "src.bbb:app", "--host", "0.0.0.0", "--port", "8080"]
`,
    blame: [
      { lines: [1, 22], author: 'C. Jimenez', sha: 'a41c90e', time: 'Oct 4, 2026', msg: 'Containerization setup' }
    ]
  },

  '.env.example': {
    path: '.env.example',
    name: '.env.example',
    folder: '',
    lang: 'yaml',
    loc: 12,
    size: '0.4 KB',
    status: 'clean',
    statusLabel: 'Env Template',
    statusBadgeCls: 'badge--neutral',
    commit: {
      author: 'C. Jimenez',
      initials: 'CJ',
      msg: 'Document required environment variables for local testing',
      sha: 'a41c90e',
      time: 'Oct 4, 2026'
    },
    symbols: [
      { id: 'env-service', name: 'Service Configuration', kind: 'spec', line: 1, tag: 'Env keys' }
    ],
    code: `# Checkout Service Environment Variables
PORT=8080
ENVIRONMENT=development
LOG_LEVEL=info

# Redis Stream Queue Broker
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Continuum Review Flags
CONTINUUM_REVISION=R1
ENABLE_DEC04_DICT_RETURN=true
`,
    blame: [
      { lines: [1, 12], author: 'C. Jimenez', sha: 'a41c90e', time: 'Oct 4, 2026', msg: 'Add environment template' }
    ]
  },

  'README.md': {
    path: 'README.md',
    name: 'README.md',
    folder: '',
    lang: 'markdown',
    loc: 34,
    size: '1.6 KB',
    status: 'clean',
    statusLabel: 'Project Overview',
    statusBadgeCls: 'badge--neutral',
    commit: {
      author: 'JC Linaban',
      initials: 'JC',
      msg: 'Document project structure and Continuum review cycle',
      sha: '8f3b21d',
      time: '3 hours ago'
    },
    symbols: [
      { id: 'readme-intro', name: 'Checkout Service', kind: 'spec', line: 1, tag: 'Root Overview' },
      { id: 'readme-arch', name: 'Architecture & Continuity', kind: 'spec', line: 8, tag: 'Repository Map' }
    ],
    code: `# Checkout Service (\`checkout-service\`)

E-commerce order intake service with asynchronous background queueing and DEC-04 dictionary response contract.

## Architecture
- \`src/bbb.py\`: Request intake & queue dispatch (Python 3.12)
- \`src/aaa.py\`: User order validation & caller intake
- \`src/compat.py\`: Adaptive compatibility layer for legacy/modern callers
- \`src/models.py\`: Pydantic domain models & request receipt schemas
- \`src/redis_queue.py\`: Stream producer and consumer queue helpers
- \`src/audit.py\`: Persistence and compliance audit logger
- \`src/middleware.py\`: Authentication header and correlation ID injection
- \`tests/\`: Automated pytest contract & caller regression suites
- \`docs/\`: API specs, architectural diagrams & onboarding guides
- \`specs/\`: Architectural Decision Records (ADRs) & Requirements

## Continuum Review Cycle
- **Current Active Revision**: R1 (\`8f3b21d\`)
- **Baseline Revision**: R0 (\`a41c90e\`)
- **Core Change**: DEC-04 dictionary return shape in \`src/bbb.py · createRequest()\`
`,
    blame: [
      { lines: [1, 34], author: 'JC Linaban', sha: '8f3b21d', time: '3 hours ago', msg: 'Update README for R1' }
    ]
  }
};

/**
 * Returns tree structure grouped by folder
 */
export function getRepoTree() {
  const folders = {
    'src': { name: 'src', files: [] },
    'tests': { name: 'tests', files: [] },
    'docs': { name: 'docs', files: [] },
    'specs': { name: 'specs', files: [] },
    'root': { name: 'root', files: [] }
  };

  Object.values(REPO_FILES).forEach(file => {
    if (file.folder) {
      if (!folders[file.folder]) {
        folders[file.folder] = { name: file.folder, files: [] };
      }
      folders[file.folder].files.push(file);
    } else {
      folders.root.files.push(file);
    }
  });

  return folders;
}
