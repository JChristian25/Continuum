import { useState, useMemo, useTransition, useCallback, useRef } from 'react';
import {
  Network,
  List,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  Filter,
  Info,
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileCode2,
  FileText,
  CheckSquare,
  GitCommit,
  ChevronRight,
  X,
  RotateCcw,
  Sparkles,
  Orbit,
  Workflow,
  Boxes,
  Flame,
  Download,
  Copy,
  ExternalLink,
  Eye,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { getStatusInfo, getWorkInfo } from '../data/helpers.js';
import TraceabilityFlow from './TraceabilityFlow.jsx';
import Tooltip from './Tooltip.jsx';
import { Button, Badge, Input, Select, Tabs, TabsList, TabsTrigger } from './ui/index.js';

function formatRationale(text) {
  if (!text) return null;
  const regex = /(`[^`]+`|\{[^}]+\}|[a-zA-Z_][a-zA-Z0-9_.]*\([^)]*\)|[a-zA-Z_0-9]+\["[^"]+"\]|"[^"]*"|§\d+\.\d+)/g;
  const parts = [];
  let lastIdx = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(<span key={key++}>{text.substring(lastIdx, match.index)}</span>);
    }
    const val = match[0].replace(/^`|`$/g, '');
    parts.push(
      <code key={key++} className="table-code-inline">
        {val}
      </code>
    );
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < text.length) {
    parts.push(<span key={key++}>{text.substring(lastIdx)}</span>);
  }
  return parts;
}

function getCategoryMeta(cat) {
  switch (cat) {
    case 'Code Elements':
      return { icon: FileCode2, wrapCls: 'icon-wrap--code', label: 'Code', color: 'var(--accent)' };
    case 'Documentation':
      return { icon: FileText, wrapCls: 'icon-wrap--doc', label: 'Docs', color: 'var(--indigo)' };
    case 'Requirements':
      return { icon: CheckSquare, wrapCls: 'icon-wrap--req', label: 'Req', color: 'var(--neutral-text)' };
    case 'Decisions':
      return { icon: GitCommit, wrapCls: 'icon-wrap--dec', label: 'ADR', color: 'var(--amber)' };
    default:
      return { icon: FileText, wrapCls: 'icon-wrap--doc', label: cat || 'Spec', color: 'var(--ink-2)' };
  }
}

function getRelChipInfo(kind, label) {
  switch (kind) {
    case 'calls':
      return { cls: 'table-rel-chip--calls', tag: 'AST Call', icon: FileCode2 };
    case 'explains':
      return { cls: 'table-rel-chip--explains', tag: 'Docling Spec', icon: FileText };
    case 'implements':
      return { cls: 'table-rel-chip--implements', tag: 'Requirement', icon: CheckSquare };
    case 'decision':
      return { cls: 'table-rel-chip--decision', tag: 'ADR Decision', icon: GitCommit };
    case 'candidate':
      return { cls: 'table-rel-chip--candidate', tag: 'UniXcoder (0.86)', icon: Sparkles };
    default:
      return { cls: 'table-rel-chip--other', tag: label || 'Trace Link', icon: ChevronRight };
  }
}

function renderArtifactHeading(name) {
  const sep = name.includes(' · ') ? ' · ' : (name.includes(' :: ') ? ' :: ' : null);
  if (sep) {
    const [path, symbol] = name.split(sep);
    return (
      <div className="table-art-heading">
        <span className="table-art-path">{path}</span>
        <span className="table-art-sep">·</span>
        <strong className="table-art-symbol">{symbol}</strong>
      </div>
    );
  }
  return (
    <div className="table-art-heading">
      <strong className="table-art-symbol">{name}</strong>
    </div>
  );
}

// Compute smooth cubic bezier connection curve & midpoint
function computeCubicBezierPath(n1, n2, w = 220, h = 58) {
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;

  let x1, y1, x2, y2, cx1, cy1, cx2, cy2;

  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx >= 0) {
      x1 = n1.x + w / 2;
      y1 = n1.y;
      x2 = n2.x - w / 2;
      y2 = n2.y;
      const offset = Math.max(48, Math.abs(dx) * 0.36);
      cx1 = x1 + offset;
      cy1 = y1;
      cx2 = x2 - offset;
      cy2 = y2;
    } else {
      x1 = n1.x - w / 2;
      y1 = n1.y;
      x2 = n2.x + w / 2;
      y2 = n2.y;
      const offset = Math.max(48, Math.abs(dx) * 0.36);
      cx1 = x1 - offset;
      cy1 = y1;
      cx2 = x2 + offset;
      cy2 = y2;
    }
  } else {
    if (dy >= 0) {
      x1 = n1.x;
      y1 = n1.y + h / 2;
      x2 = n2.x;
      y2 = n2.y - h / 2;
      const offset = Math.max(38, Math.abs(dy) * 0.36);
      cx1 = x1;
      cy1 = y1 + offset;
      cx2 = x2;
      cy2 = y2 - offset;
    } else {
      x1 = n1.x;
      y1 = n1.y - h / 2;
      x2 = n2.x;
      y2 = n2.y + h / 2;
      const offset = Math.max(38, Math.abs(dy) * 0.36);
      cx1 = x1;
      cy1 = y1 - offset;
      cx2 = x2;
      cy2 = y2 + offset;
    }
  }

  // Exact midpoint along cubic bezier curve at t = 0.5
  const mx = 0.125 * x1 + 0.375 * cx1 + 0.375 * cx2 + 0.125 * x2;
  const my = 0.125 * y1 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * y2;

  const path = `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;

  return { path, mx, my, x1, y1, x2, y2 };
}

export default function ExploreModule({ ctx }) {
  const { state, selectArtifact, showToast, openCodeExplorer, openReviewForm } = ctx;

  const [category, setCategory] = useState(state.exploreCategory || 'All');
  const [relFilter, setRelFilter] = useState(state.exploreRelFilter || 'all');
  const [searchTerm, setSearchTerm] = useState(state.exploreSearch || '');
  const [viewMode, setViewMode] = useState(state.exploreViewMode || 'graph');
  const [layoutPreset, setLayoutPreset] = useState('radial'); // 'radial' | 'pipeline' | 'cluster'
  const [blastRadiusActive, setBlastRadiusActive] = useState(false);
  const [zoom, setZoom] = useState(state.graphZoom || 1.0);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [activePreviewId, setActivePreviewId] = useState(null);
  const [isPending, startTransition] = useTransition();
  const svgRef = useRef(null);

  const handleCategoryChange = useCallback((cat) => {
    startTransition(() => {
      setCategory(cat);
    });
  }, []);

  const handleRelFilterChange = useCallback((rel) => {
    startTransition(() => {
      setRelFilter(rel);
    });
  }, []);

  const handleSearchChange = useCallback((e) => {
    const val = e.target.value;
    startTransition(() => {
      setSearchTerm(val);
    });
  }, []);

  const categories = ['All', 'Code Elements', 'Documentation', 'Requirements', 'Decisions'];

  const relTypes = [
    { value: 'all', label: 'All Relationships' },
    { value: 'calls', label: 'Calls Function (AST)' },
    { value: 'explains', label: 'Explains Behavior (Docling)' },
    { value: 'implements', label: 'Implements Requirement' },
    { value: 'candidate', label: 'Candidate Link (UniXcoder)' },
    { value: 'decision', label: 'Design Decision (ADR)' }
  ];

  // Base raw nodes coordinates across 3 architectural layout presets (Spacious 1440x760 canvas)
  const nodeLayouts = useMemo(() => ({
    radial: {
      'bbb.py::createRequest': { x: 720, y: 390 },
      'bbb.py::cancelRequest': { x: 720, y: 640 },
      'DEC-04': { x: 300, y: 110 },
      'aaa.md::section-2.1': { x: 720, y: 110 },
      'REQ-02': { x: 1140, y: 110 },
      'aaa.py::submitUserOrder': { x: 170, y: 390 },
      'compat.py::normalizeRequestResult': { x: 1270, y: 390 },
      'docs/onboarding_notes.md': { x: 250, y: 640 },
      'docs/legacy_export.pdf': { x: 1190, y: 640 }
    },
    pipeline: {
      'REQ-02': { x: 180, y: 130 },
      'DEC-04': { x: 180, y: 380 },
      'docs/legacy_export.pdf': { x: 180, y: 630 },
      'bbb.py::createRequest': { x: 720, y: 280 },
      'bbb.py::cancelRequest': { x: 720, y: 560 },
      'aaa.py::submitUserOrder': { x: 1250, y: 120 },
      'compat.py::normalizeRequestResult': { x: 1250, y: 290 },
      'aaa.md::section-2.1': { x: 1250, y: 460 },
      'docs/onboarding_notes.md': { x: 1250, y: 630 }
    },
    cluster: {
      'DEC-04': { x: 280, y: 110 },
      'REQ-02': { x: 740, y: 110 },
      'bbb.py::createRequest': { x: 280, y: 330 },
      'bbb.py::cancelRequest': { x: 280, y: 550 },
      'aaa.py::submitUserOrder': { x: 740, y: 320 },
      'compat.py::normalizeRequestResult': { x: 740, y: 550 },
      'aaa.md::section-2.1': { x: 1220, y: 150 },
      'docs/onboarding_notes.md': { x: 1220, y: 370 },
      'docs/legacy_export.pdf': { x: 1220, y: 580 }
    }
  }), []);

  // Full set of 9 Nodes
  const nodes = useMemo(() => [
    { id: 'bbb.py::createRequest', title: 'createRequest()', sub: 'src/bbb.py · Changed Seed', category: 'Code Elements', isSeed: true },
    { id: 'bbb.py::cancelRequest', title: 'cancelRequest()', sub: 'src/bbb.py · Undocumented Sibling', category: 'Code Elements' },
    { id: 'DEC-04', title: 'DEC-04: Return dict', sub: 'Direct decision-to-code link', category: 'Decisions' },
    { id: 'aaa.md::section-2.1', title: 'docs/aaa.md · §2.1', sub: 'Doc update deferred', category: 'Documentation' },
    { id: 'REQ-02', title: 'REQ-02: Track status', sub: 'Requirement record', category: 'Requirements' },
    { id: 'aaa.py::submitUserOrder', title: 'submitUserOrder()', sub: 'src/aaa.py · Code update open', category: 'Code Elements' },
    { id: 'compat.py::normalizeRequestResult', title: 'normalizeRequestResult()', sub: 'src/compat.py · Compatible', category: 'Code Elements' },
    { id: 'docs/onboarding_notes.md', title: 'onboarding_notes.md §1.4', sub: 'Candidate link (0.86 cosine)', category: 'Documentation' },
    { id: 'docs/legacy_export.pdf', title: 'legacy_export.pdf', sub: 'Scanned spec boundary', category: 'Documentation' }
  ].map(n => {
    const coords = (nodeLayouts[layoutPreset] && nodeLayouts[layoutPreset][n.id]) || { x: 500, y: 300 };
    return { ...n, x: coords.x, y: coords.y };
  }), [layoutPreset, nodeLayouts]);

  // Edges mapping 8 verified and candidate relationships
  const edges = useMemo(() => [
    { from: 'DEC-04', to: 'bbb.py::createRequest', kind: 'decision', label: 'Direct decision', targetId: 'DEC-04' },
    { from: 'aaa.md::section-2.1', to: 'bbb.py::createRequest', kind: 'explains', label: 'Docling spec', targetId: 'aaa.md::section-2.1' },
    { from: 'bbb.py::createRequest', to: 'REQ-02', kind: 'implements', label: 'Implements req', targetId: 'REQ-02' },
    { from: 'aaa.py::submitUserOrder', to: 'bbb.py::createRequest', kind: 'calls', label: 'Calls function (Breaking)', targetId: 'aaa.py::submitUserOrder' },
    { from: 'compat.py::normalizeRequestResult', to: 'bbb.py::createRequest', kind: 'calls', label: 'Calls function (Compatible)', targetId: 'compat.py::normalizeRequestResult' },
    { from: 'docs/onboarding_notes.md', to: 'bbb.py::createRequest', kind: 'candidate', label: 'Candidate (0.86)', targetId: 'docs/onboarding_notes.md' },
    { from: 'bbb.py::cancelRequest', to: 'bbb.py::createRequest', kind: 'calls', label: 'Same file sibling', targetId: 'bbb.py::cancelRequest' },
    { from: 'docs/legacy_export.pdf', to: 'REQ-02', kind: 'explains', label: 'Parser boundary', targetId: 'docs/legacy_export.pdf' }
  ], []);

  const filteredEdges = useMemo(() => {
    return edges.filter(e => relFilter === 'all' || e.kind === relFilter);
  }, [edges, relFilter]);

  const nodeMap = useMemo(() => {
    const map = {};
    nodes.forEach(n => { map[n.id] = n; });
    return map;
  }, [nodes]);

  // Blast Radius Node Set (Direct 1-Hop Impact from Seed)
  const blastRadiusIds = useMemo(() => new Set([
    'bbb.py::createRequest',
    'aaa.py::submitUserOrder',
    'aaa.md::section-2.1',
    'compat.py::normalizeRequestResult',
    'bbb.py::cancelRequest',
    'DEC-04',
    'REQ-02'
  ]), []);

  // Connected nodes map for hover trail or blast radius
  const connectedNodeIds = useMemo(() => {
    if (blastRadiusActive) return blastRadiusIds;
    if (!hoveredNodeId) return null;
    const set = new Set([hoveredNodeId]);
    filteredEdges.forEach(e => {
      if (e.from === hoveredNodeId) set.add(e.to);
      if (e.to === hoveredNodeId) set.add(e.from);
    });
    return set;
  }, [hoveredNodeId, blastRadiusActive, blastRadiusIds, filteredEdges]);

  const tx = 720 * (1 - zoom);
  const ty = 390 * (1 - zoom);

  // Sorting state for table view
  const [sortKey, setSortKey] = useState('shortName');
  const [sortDir, setSortDir] = useState('asc'); // 'asc' or 'desc'

  const handleSort = useCallback((key) => {
    setSortKey(currentKey => {
      if (currentKey === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return currentKey;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const handleResetFilters = useCallback(() => {
    startTransition(() => {
      setCategory('All');
      setRelFilter('all');
      setSearchTerm('');
      setBlastRadiusActive(false);
    });
  }, []);

  // Category counts across active dataset
  const categoryCounts = useMemo(() => {
    const counts = { All: 0, 'Code Elements': 0, Documentation: 0, Requirements: 0, Decisions: 0 };
    Object.values(state.artifacts).forEach(art => {
      counts.All++;
      if (counts[art.category] !== undefined) {
        counts[art.category]++;
      }
    });
    return counts;
  }, [state.artifacts]);

  // Table rows filtering
  const q = searchTerm.trim().toLowerCase();
  const tableRows = useMemo(() => {
    return Object.values(state.artifacts).filter(art => {
      if (category !== 'All' && art.category !== category) return false;
      if (relFilter !== 'all' && art.relKind !== relFilter) return false;
      if (blastRadiusActive && !blastRadiusIds.has(art.id)) return false;
      if (q) {
        const match = art.shortName.toLowerCase().includes(q) ||
          art.plainReason.toLowerCase().includes(q) ||
          art.category.toLowerCase().includes(q) ||
          art.id.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [state.artifacts, category, relFilter, blastRadiusActive, blastRadiusIds, q]);

  // Table rows sorted
  const sortedRows = useMemo(() => {
    return [...tableRows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'shortName') {
        cmp = a.shortName.localeCompare(b.shortName);
      } else if (sortKey === 'category') {
        cmp = a.category.localeCompare(b.category);
      } else if (sortKey === 'relLabel') {
        cmp = (a.relLabel || '').localeCompare(b.relLabel || '');
      } else if (sortKey === 'r1Status') {
        const rank = { needs_review: 1, candidate: 2, historical: 3, reviewed: 4 };
        cmp = (rank[a.r1Status] || 9) - (rank[b.r1Status] || 9);
      } else if (sortKey === 'followUpWork') {
        const rank = { 'Code update open': 1, 'Doc update deferred': 2, 'No edit needed': 3 };
        cmp = (rank[a.followUpWork] || 9) - (rank[b.followUpWork] || 9);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [tableRows, sortKey, sortDir]);

  // Review status counters for summary footer
  const reviewStats = useMemo(() => {
    let needsReview = 0;
    let deferred = 0;
    let codeUpdate = 0;
    tableRows.forEach(art => {
      if (art.r1Status === 'needs_review') needsReview++;
      if (art.followUpWork === 'Doc update deferred') deferred++;
      if (art.followUpWork === 'Code update open') codeUpdate++;
    });
    return { needsReview, deferred, codeUpdate };
  }, [tableRows]);

  // Copy Architectural Mermaid Diagram
  const handleCopyMermaid = useCallback(() => {
    const mermaidCode = `graph TD
  %% Continuum Knowledge Continuity Graph (Incoming Change)
  subgraph src_bbb["src/bbb.py (Core Service)"]
    seed["createRequest() [CHANGED SEED]"]:::seedNode
    sibling["cancelRequest() [UNDOCUMENTED SIBLING]"]
  end
  subgraph callers["Callers & Adapters"]
    caller1["src/aaa.py · submitUserOrder() [BREAKING]"]:::breakingNode
    caller2["src/compat.py · normalizeRequestResult() [COMPATIBLE]"]:::reviewedNode
  end
  subgraph specs["Decisions & Requirements"]
    dec["DEC-04: Return dict"]:::decisionNode
    req["REQ-02: Track status"]:::reviewedNode
  end
  subgraph docs["Documentation"]
    doc1["docs/aaa.md · §2.1 [STALE PROSE]"]:::docNode
    doc2["onboarding_notes.md §1.4 [CANDIDATE 0.86]"]:::candidateNode
    doc3["docs/legacy_export.pdf [PARSER LIMIT]"]:::boundaryNode
  end

  dec -->|Direct decision| seed
  seed -->|Implements req| req
  doc1 -->|Explains behavior| seed
  caller1 -->|Calls function (Breaking)| seed
  caller2 -->|Calls function (Compatible)| seed
  sibling -->|Same file sibling| seed
  doc2 -.->|Candidate 0.86| seed
  doc3 -->|Parser boundary| req

  classDef seedNode stroke:#087E74,stroke-width:3px,fill:#E6F7F3
  classDef breakingNode stroke:#B91C1C,stroke-width:2px,fill:#FEE2E2
  classDef reviewedNode stroke:#15803D,stroke-width:2px,fill:#DCFCE7
  classDef decisionNode stroke:#B45309,stroke-width:2px,fill:#FEF3C7
  classDef docNode stroke:#0D9488,stroke-width:2px,fill:#F0FDFA
  classDef candidateNode stroke:#2d5a7b,stroke-dasharray: 4 4,fill:#f0f7fa
  classDef boundaryNode stroke:#52646A,stroke-width:1px,fill:#EEF2F0`;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(mermaidCode);
      showToast?.('Copied architectural Mermaid diagram to clipboard!');
    }
  }, [showToast]);

  // Copy PR Markdown Blast Radius Report
  const handleCopyPrReport = useCallback(() => {
    const md = `### Continuum Architectural Blast Radius Report (Incoming Change · 8f3b21d)
**Seed Artifact Changed**: \`src/bbb.py · createRequest()\`
**Direct Architectural Intent**: \`DEC-04\` (JC Linaban) — Synchronous dict return \`{"id", "status"}\`

#### Impact Analysis Summary
| Artifact | Category | Relationship | Status | Disposition |
|---|---|---|---|---|
| \`src/aaa.py · submitUserOrder()\` | Code Elements | AST Caller | **Needs Review** | **Code update open** (Breaks: slices \`req_id.strip()\`) |
| \`docs/aaa.md · §2.1 Request API\` | Documentation | Docling Spec | Reviewed | Doc update deferred (Stale return description) |
| \`src/compat.py · normalizeRequestResult()\` | Code Elements | AST Caller | Reviewed | No edit needed (Safe \`isinstance\` guard) |
| \`src/bbb.py · cancelRequest()\` | Code Elements | Sibling | Needs Review | Doc update deferred (Bus factor 1 risk) |
| \`REQ-02 — Track request status\` | Requirements | Implements | Needs Review | No edit needed (Fulfilled synchronously) |
| \`onboarding_notes.md §1.4\` | Documentation | UniXcoder Candidate | Candidate | Cosine 0.86 candidate link |
| \`docs/legacy_export.pdf\` | Documentation | Scanned Spec | Parser Boundary | Coverage unknown (scanned PDF) |`;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(md);
      showToast?.('Copied Architecture PR Blast Radius to clipboard!');
    }
  }, [showToast]);

  // Export SVG directly
  const handleExportSvg = useCallback(() => {
    const el = svgRef.current;
    if (!el) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(el);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'continuum-knowledge-continuity-graph.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast?.('Exported Knowledge Continuity Graph as SVG!');
  }, [showToast]);

  const activeArt = state.artifacts[activePreviewId || state.selectedArtifactId];

  return (
    <div className="canvas-scroll">
      {/* Header Controls */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.03em', margin: 0 }}>
            {viewMode === 'table' ? 'Continuity Artifacts & Traceability Matrix' : 'Knowledge Continuity Graph'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <Badge variant="accent" size="xs" className="gap-1">
              <Network size={12} />
              <span>{nodes.length} Active Nodes · {filteredEdges.length} Edges</span>
            </Badge>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0, maxWidth: 660 }}>
              {viewMode === 'table'
                ? 'Dense inspectable matrix of cross-module dependencies, AST call paths, Docling specifications, and review status.'
                : 'Interactive multi-artifact traceability mapping cross-module dependencies, AST call paths, ADR rationale, and Docling specifications.'}
            </p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <Tabs value={viewMode} onValueChange={setViewMode}>
          <TabsList>
            <Tooltip title="Spacious Architectural Diagram" content="Curved Bezier graph with expansive breathing room" side="top">
              <TabsTrigger value="graph" className="gap-1.5 text-xs">
                <Network size={13} />
                <span>Auto SVG</span>
              </TabsTrigger>
            </Tooltip>

            <Tooltip title="Interactive Infinite Canvas (XYFlow + ELK)" content="Automated DAG layout with pan, zoom, and draggable nodes" side="top">
              <TabsTrigger value="flow" className="gap-1.5 text-xs">
                <LayoutGrid size={13} />
                <span>Interactive Canvas</span>
              </TabsTrigger>
            </Tooltip>

            <Tooltip title="Traceability Matrix" content="Sortable matrix of artifacts, rationale, and review state" side="top">
              <TabsTrigger value="table" className="gap-1.5 text-xs">
                <List size={13} />
                <span>Table ({tableRows.length})</span>
              </TabsTrigger>
            </Tooltip>
          </TabsList>
        </Tabs>
      </div>

      {/* Continuum Architectural Blast Radius Intelligence Strip */}
      <div className="graph-impact-banner">
        <div className="graph-impact-banner__left">
          <div className="graph-impact-banner__seed">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
            <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Seed:</span>
            <code>src/bbb.py::createRequest()</code>
            <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>· Incoming contract change (DEC-04)</span>
          </div>

          <div className="graph-impact-banner__chips">
            <Tooltip title="Breaking Caller" content="Calls createRequest() and slices string; fails with incoming change. Needs code update." side="top">
              <span
                className="graph-severity-chip graph-severity-chip--breaking"
                onClick={() => { selectArtifact('aaa.py::submitUserOrder'); setActivePreviewId('aaa.py::submitUserOrder'); }}
              >
                <AlertTriangle size={11} />
                <span>1 Breaking Caller</span>
              </span>
            </Tooltip>

            <Tooltip title="Stale Documentation" content="Explains createRequest(); prose describes outdated string return. Deferred update." side="top">
              <span
                className="graph-severity-chip graph-severity-chip--stale"
                onClick={() => { selectArtifact('aaa.md::section-2.1'); setActivePreviewId('aaa.md::section-2.1'); }}
              >
                <FileText size={11} />
                <span>1 Stale Doc</span>
              </span>
            </Tooltip>

            <Tooltip title="Compatible Adapter" content="Type-guard checks isinstance(res, dict); fully compatible." side="top">
              <span
                className="graph-severity-chip graph-severity-chip--compat"
                onClick={() => { selectArtifact('compat.py::normalizeRequestResult'); setActivePreviewId('compat.py::normalizeRequestResult'); }}
              >
                <CheckCircle2 size={11} />
                <span>1 Compatible Helper</span>
              </span>
            </Tooltip>

            <Tooltip title="Sibling Bus Factor Risk" content="Sibling function in same file; zero documentation or decision links." side="top">
              <span
                className="graph-severity-chip graph-severity-chip--sibling"
                onClick={() => { selectArtifact('bbb.py::cancelRequest'); setActivePreviewId('bbb.py::cancelRequest'); }}
              >
                <FileCode2 size={11} />
                <span>1 Undocumented Sibling</span>
              </span>
            </Tooltip>
          </div>
        </div>

        {/* Blast Radius & Quick Export Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Button
            variant={blastRadiusActive ? 'default' : 'secondary'}
            size="xs"
            onClick={() => setBlastRadiusActive(v => !v)}
            className="gap-1.5"
            title="Focus on direct impact chain and dim unrelated nodes"
          >
            <Flame size={12} color={blastRadiusActive ? '#fff' : 'var(--amber)'} />
            <span>{blastRadiusActive ? 'Blast Radius Active' : 'Trace Blast Radius'}</span>
          </Button>

          <Button
            variant="subtle"
            size="xs"
            onClick={handleCopyPrReport}
            className="gap-1"
            title="Copy PR markdown report to clipboard"
          >
            <Copy size={11} />
            <span>PR Summary</span>
          </Button>

          <Button
            variant="subtle"
            size="xs"
            onClick={handleCopyMermaid}
            className="gap-1"
            title="Copy Mermaid diagram syntax"
          >
            <Sparkles size={11} />
            <span>Copy Mermaid</span>
          </Button>
        </div>
      </div>

      {/* Filter & Layout Toolbar */}
      <div className="card card--p-sm" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        {/* Category Pills with Count Chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {categories.map(cat => (
            <Button
              key={cat}
              variant={category === cat ? 'default' : 'secondary'}
              size="xs"
              onClick={() => handleCategoryChange(cat)}
              className="gap-1.5"
            >
              <span>{cat}</span>
              <span className="filter-count-badge">{categoryCounts[cat] ?? 0}</span>
            </Button>
          ))}
        </div>

        {/* Layout Preset Selector & Search & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {viewMode === 'graph' && (
            <div className="graph-layout-selector" title="Select Graph Layout Preset">
              <Button variant="unstyled"
                type="button"
                className={`graph-layout-btn ${layoutPreset === 'radial' ? 'is-active' : ''}`}
                onClick={() => setLayoutPreset('radial')}
                title="Radial Seed Ego-Net: Expansive circular layout around seed provider"
              >
                <Orbit size={12} />
                <span>Seed Orbit</span>
              </Button>
              <Button variant="unstyled"
                type="button"
                className={`graph-layout-btn ${layoutPreset === 'pipeline' ? 'is-active' : ''}`}
                onClick={() => setLayoutPreset('pipeline')}
                title="Tiered DAG: Left-to-right architecture pipeline"
              >
                <Workflow size={12} />
                <span>Tiered Flow</span>
              </Button>
              <Button variant="unstyled"
                type="button"
                className={`graph-layout-btn ${layoutPreset === 'cluster' ? 'is-active' : ''}`}
                onClick={() => setLayoutPreset('cluster')}
                title="Module Clusters: Grouped by file and repository boundary"
              >
                <Boxes size={12} />
                <span>File Clusters</span>
              </Button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={13} color="var(--ink-3)" />
            <Select
              className="w-auto h-8 text-xs"
              value={relFilter}
              onChange={(e) => handleRelFilterChange(e.target.value)}
              aria-label="Filter relationship types"
            >
              {relTypes.map(rt => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </Select>
          </div>

          <div style={{ position: 'relative', width: 200 }}>
            <Input
              icon={<Search size={13} />}
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search artifacts, code…"
              aria-label="Filter artifacts by name or category"
              style={{ height: 32, fontSize: 12, paddingRight: searchTerm ? 28 : 12 }}
            />
            {searchTerm && (
              <Button variant="unstyled"
                type="button"
                onClick={() => handleSearchChange({ target: { value: '' } })}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--ink-3)',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center'
                }}
                aria-label="Clear search"
              >
                <X size={12} />
              </Button>
            )}
          </div>

          {(category !== 'All' || relFilter !== 'all' || searchTerm || blastRadiusActive) && (
            <Button
              variant="subtle"
              size="xs"
              onClick={handleResetFilters}
              title="Reset all filters"
              className="gap-1"
            >
              <RotateCcw size={11} />
              <span>Reset</span>
            </Button>
          )}

          {viewMode === 'graph' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderLeft: '1px solid var(--border)', paddingLeft: 8 }}>
              <Tooltip content="Zoom out (-)" side="top">
                <Button
                  variant="secondary"
                  size="icon-xs"
                  onClick={() => setZoom(z => Math.max(0.5, Number((z - 0.1).toFixed(1))))}
                  aria-label="Zoom Out"
                >
                  <ZoomOut size={12} />
                </Button>
              </Tooltip>
              <span style={{ fontSize: 11, minWidth: 40, textAlign: 'center', color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(zoom * 100)}%
              </span>
              <Tooltip content="Zoom in (+)" side="top">
                <Button
                  variant="secondary"
                  size="icon-xs"
                  onClick={() => setZoom(z => Math.min(1.8, Number((z + 0.1).toFixed(1))))}
                  aria-label="Zoom In"
                >
                  <ZoomIn size={12} />
                </Button>
              </Tooltip>
              <Tooltip content="Reset zoom to 100%" side="top">
                <Button
                  variant="subtle"
                  size="icon-xs"
                  onClick={() => setZoom(1.0)}
                  aria-label="Reset Zoom"
                >
                  <Maximize2 size={12} />
                </Button>
              </Tooltip>
              <Tooltip content="Download standalone SVG" side="top">
                <Button
                  variant="subtle"
                  size="icon-xs"
                  onClick={handleExportSvg}
                  aria-label="Export SVG"
                >
                  <Download size={12} />
                </Button>
              </Tooltip>
            </div>
          )}
        </div>
      </div>

      {/* Main Content: Theme-Native SVG Graph or Interactive Canvas or Accessible Table */}
      {viewMode === 'graph' ? (
        <div
          className="graph-canvas-card"
          style={{
            minHeight: 740,
            opacity: isPending ? 0.8 : 1,
            transition: 'opacity 0.15s ease'
          }}
        >
          {/* Top Status & Legend Strip */}
          <div className="graph-top-strip">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, border: '1.5px dashed var(--accent)', display: 'inline-block' }} />
                <strong>Seed Provider</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-2)' }}>
                <span className="status-dot dot--green" /> Reviewed Support
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-2)' }}>
                <span className="status-dot dot--amber" /> Needs Review
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-2)' }}>
                <span className="status-dot dot--indigo" /> Candidate (UniXcoder)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-3)' }}>
                <span className="status-dot dot--neutral" /> Parser Boundary
              </span>
            </div>
            <span style={{ color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Info size={12} />
              <span>Hover nodes to trace paths · Click to inspect or open in Code Explorer</span>
            </span>
          </div>

          <svg
            ref={svgRef}
            id="continuity-graph-svg"
            width="100%"
            height="740"
            viewBox="0 0 1440 760"
            style={{
              display: 'block',
              background: 'var(--graph-canvas-bg)',
              transition: 'background 0.2s ease'
            }}
            role="region"
            aria-label="Traceability Graph Canvas"
          >
            <defs>
              {/* Technical Engineering Dot Blueprint Pattern */}
              <pattern id="graph-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="14" cy="14" r="1.1" fill="var(--border)" opacity="0.45" />
              </pattern>

              <marker id="arr-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--green)" />
              </marker>
              <marker id="arr-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--amber)" />
              </marker>
              <marker id="arr-indigo" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--indigo)" />
              </marker>
              <marker id="arr-accent" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--accent)" />
              </marker>
              <marker id="arr-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--red)" />
              </marker>
            </defs>

            {/* Blueprint Grid Background */}
            <rect width="100%" height="100%" fill="url(#graph-grid)" />

            <g transform={`translate(${tx}, ${ty}) scale(${zoom})`}>
              {/* Cluster Containers (when in cluster mode or radial mode) */}
              {layoutPreset === 'cluster' ? (
                <>
                  {/* Container: src/bbb.py */}
                  <rect x="110" y="230" width="340" height="390" rx="14" fill="var(--graph-group-bg)" stroke="var(--graph-group-border)" strokeWidth="1" strokeDasharray="4 3" opacity="0.85" />
                  <text x="130" y="258" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700" fill="var(--ink-2)">src/bbb.py (Core Provider · 2 units)</text>

                  {/* Container: src/aaa.py */}
                  <rect x="570" y="230" width="340" height="170" rx="14" fill="var(--graph-group-bg)" stroke="var(--graph-group-border)" strokeWidth="1" strokeDasharray="4 3" opacity="0.85" />
                  <text x="590" y="258" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700" fill="var(--ink-2)">src/aaa.py (Caller · Breaking)</text>

                  {/* Container: src/compat.py */}
                  <rect x="570" y="460" width="340" height="170" rx="14" fill="var(--graph-group-bg)" stroke="var(--graph-group-border)" strokeWidth="1" strokeDasharray="4 3" opacity="0.85" />
                  <text x="590" y="488" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700" fill="var(--ink-2)">src/compat.py (Adapter · Compatible)</text>

                  {/* Container: docs/ */}
                  <rect x="1050" y="60" width="340" height="600" rx="14" fill="var(--graph-group-bg)" stroke="var(--graph-group-border)" strokeWidth="1" strokeDasharray="4 3" opacity="0.85" />
                  <text x="1070" y="88" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700" fill="var(--ink-2)">docs/ (Specifications &amp; Handover)</text>

                  {/* Container: registers/ */}
                  <rect x="110" y="40" width="800" height="140" rx="14" fill="var(--graph-group-bg)" stroke="var(--graph-group-border)" strokeWidth="1" strokeDasharray="4 3" opacity="0.85" />
                  <text x="130" y="68" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700" fill="var(--ink-2)">Design Decisions &amp; System Requirements Register</text>
                </>
              ) : layoutPreset === 'radial' ? (
                <>
                  {/* Container for src/bbb.py in radial mode */}
                  <rect x="550" y="310" width="340" height="410" rx="16" fill="var(--graph-group-bg)" stroke="var(--graph-group-border)" strokeWidth="1.2" strokeDasharray="5 4" opacity="0.8" />
                  <text x="720" y="705" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fontWeight="600" fill="var(--ink-3)">File container: src/bbb.py (2 units)</text>
                </>
              ) : null}

              {/* Smooth Cubic Bezier Edges */}
              {filteredEdges.map((e, idx) => {
                const n1 = nodeMap[e.from];
                const n2 = nodeMap[e.to];
                if (!n1 || !n2) return null;

                const art = state.artifacts[e.targetId];
                const isNeedsReview = state.revisionMode === 'R1' && art?.r1Status === 'needs_review';
                const isCandidate = art?.r1Status === 'candidate';
                const isBreaking = e.from === 'aaa.py::submitUserOrder';

                // Check connection with active hover or blast radius
                const isEdgeHighlighted = (hoveredNodeId && (e.from === hoveredNodeId || e.to === hoveredNodeId)) ||
                  (blastRadiusActive && blastRadiusIds.has(e.from) && blastRadiusIds.has(e.to));
                const isEdgeDimmed = (hoveredNodeId && !isEdgeHighlighted) ||
                  (blastRadiusActive && (!blastRadiusIds.has(e.from) || !blastRadiusIds.has(e.to)));

                const { path, mx, my } = computeCubicBezierPath(n1, n2, 220, 58);

                let stroke = 'var(--green)';
                let marker = 'arr-green';
                let dotColor = 'var(--green)';

                if (isBreaking) {
                  stroke = 'var(--red)';
                  marker = 'arr-red';
                  dotColor = 'var(--red)';
                } else if (isCandidate) {
                  stroke = 'var(--indigo)';
                  marker = 'arr-indigo';
                  dotColor = 'var(--indigo)';
                } else if (isNeedsReview) {
                  stroke = 'var(--amber)';
                  marker = 'arr-amber';
                  dotColor = 'var(--amber)';
                }

                if (isEdgeHighlighted) {
                  stroke = isBreaking ? 'var(--red)' : 'var(--accent)';
                  marker = isBreaking ? 'arr-red' : 'arr-accent';
                  dotColor = isBreaking ? 'var(--red)' : 'var(--accent)';
                }

                const labelW = Math.max(105, e.label.length * 7 + 22);

                return (
                  <g
                    key={idx}
                    onClick={() => { selectArtifact(e.targetId); setActivePreviewId(e.targetId); }}
                    style={{
                      cursor: 'pointer',
                      opacity: isEdgeDimmed ? 0.18 : 1,
                      transition: 'opacity 0.2s ease, stroke 0.2s ease'
                    }}
                    tabIndex="0"
                    role="button"
                    aria-label={`Relationship: ${n1.title} to ${n2.title}: ${e.label}`}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        selectArtifact(e.targetId);
                        setActivePreviewId(e.targetId);
                      }
                    }}
                  >
                    {/* Underlying wider path for easier clicking */}
                    <path
                      d={path}
                      stroke="transparent"
                      strokeWidth="16"
                      fill="none"
                    />

                    {/* Rendered spline path */}
                    <path
                      d={path}
                      stroke={stroke}
                      strokeWidth={isEdgeHighlighted ? '2.5' : isNeedsReview ? '2' : '1.5'}
                      strokeDasharray={isCandidate ? '5 3' : (isEdgeHighlighted ? '6 4' : '')}
                      className={isEdgeHighlighted ? 'graph-edge-animated' : ''}
                      markerEnd={`url(#${marker})`}
                      fill="none"
                    />

                    {/* Edge Label Badge */}
                    <rect
                      x={mx - labelW / 2}
                      y={my - 12}
                      width={labelW}
                      height="24"
                      rx="6"
                      fill="var(--graph-edge-label-bg)"
                      stroke={isEdgeHighlighted ? 'var(--accent)' : 'var(--graph-edge-label-border)'}
                      strokeWidth={isEdgeHighlighted ? '1.5' : '1'}
                    />
                    <circle cx={mx - labelW / 2 + 10} cy={my} r="3.5" fill={dotColor} />
                    <text
                      x={mx - labelW / 2 + 20}
                      y={my + 3.5}
                      textAnchor="start"
                      fontFamily="var(--font-sans), sans-serif"
                      fontSize="10"
                      fontWeight="600"
                      fill="var(--ink)"
                    >
                      {e.label}
                    </text>
                  </g>
                );
              })}

              {/* Node Cards */}
              {nodes.map(n => {
                const art = state.artifacts[n.id];
                if (!art) return null;
                const isSel = (state.selectedArtifactId === n.id && state.inspectorOpen) || activePreviewId === n.id;
                const isNeedsReview = state.revisionMode === 'R1' && art.r1Status === 'needs_review';
                const isCandidate = art.r1Status === 'candidate';
                const isBreaking = n.id === 'aaa.py::submitUserOrder';

                const isConnected = connectedNodeIds ? connectedNodeIds.has(n.id) : true;
                const isHovered = hoveredNodeId === n.id;

                const w = 220;
                const h = 58;
                const x = n.x - w / 2;
                const y = n.y - h / 2;

                let dotColor = 'var(--green)';
                if (isBreaking) dotColor = 'var(--red)';
                else if (isCandidate) dotColor = 'var(--indigo)';
                else if (isNeedsReview) dotColor = 'var(--amber)';

                const fill = isSel ? 'var(--accent-tint)' : isHovered ? 'var(--ground-hover)' : 'var(--graph-node-bg)';
                const strokeColor = isSel ? 'var(--accent)' : isHovered ? 'var(--border-focus)' : 'var(--graph-node-border)';
                const strokeWidth = isSel || isHovered ? '2' : '1';

                return (
                  <g
                    key={n.id}
                    onClick={() => { selectArtifact(n.id); setActivePreviewId(n.id); }}
                    onMouseEnter={() => setHoveredNodeId(n.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    style={{
                      cursor: 'pointer',
                      opacity: isConnected ? 1 : 0.22,
                      transition: 'opacity 0.2s ease, transform 0.15s ease'
                    }}
                    tabIndex="0"
                    role="button"
                    aria-label={`Artifact node: ${n.title}, ${n.sub}. Press Enter to inspect.`}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        selectArtifact(n.id);
                        setActivePreviewId(n.id);
                      }
                    }}
                  >
                    {/* Seed Node Animated Radar Rings */}
                    {n.isSeed && (
                      <>
                        <circle
                          cx={n.x}
                          cy={n.y}
                          r="32"
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth="1.5"
                          className="graph-seed-ripple"
                        />
                        <rect
                          x={x - 4}
                          y={y - 4}
                          width={w + 8}
                          height={h + 8}
                          rx="14"
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth="1.8"
                          strokeDasharray="4 3"
                          opacity="0.8"
                        />
                      </>
                    )}

                    {/* Main Node Card */}
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      rx="10"
                      fill={fill}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                    />

                    {/* Status Dot */}
                    <circle cx={x + 16} cy={y + 21} r="4.5" fill={dotColor} />

                    {/* Seed Badge Indicator */}
                    {n.isSeed && (
                      <rect
                        x={x + w - 46}
                        y={y + 8}
                        width="38"
                        height="14"
                        rx="3"
                        fill="var(--accent)"
                      />
                    )}
                    {n.isSeed && (
                      <text
                        x={x + w - 27}
                        y={y + 18.5}
                        textAnchor="middle"
                        fontFamily="var(--font-sans), sans-serif"
                        fontSize="8.5"
                        fontWeight="800"
                        fill="#FFFFFF"
                      >
                        SEED
                      </text>
                    )}

                    {/* Title */}
                    <text
                      x={x + 28}
                      y={y + 24}
                      fontFamily="var(--font-mono), monospace"
                      fontSize="12"
                      fontWeight="700"
                      fill="var(--graph-node-text)"
                    >
                      {n.title}
                    </text>

                    {/* Subtitle / File Pointer */}
                    <text
                      x={x + 28}
                      y={y + 42}
                      fontFamily="var(--font-sans), sans-serif"
                      fontSize="10.5"
                      fill="var(--graph-node-sub)"
                    >
                      {n.sub}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* In-Canvas Floating Quick Inspector Dock (Only when side drawer is closed) */}
          {activePreviewId && activeArt && !state.selectedArtifactId && (
            <div className="graph-quick-dock" role="dialog" aria-label="Quick Node Inspector">
              <div className="graph-quick-dock__header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <Badge variant="accent" size="xs">{activeArt.category}</Badge>
                    <span className="status-pill status--amber" style={{ fontSize: 10, padding: '1px 6px' }}>
                      <span className="status-dot dot--amber" />
                      <span>{activeArt.r1Status === 'reviewed' ? 'Reviewed with change' : 'Needs Review'}</span>
                    </span>
                  </div>
                  <h3 className="graph-quick-dock__title">{activeArt.shortName || activeArt.name}</h3>
                  <div className="graph-quick-dock__file">
                    <FileCode2 size={12} color="var(--ink-3)" />
                    <span>{activeArt.file || 'Repository Artifact'}</span>
                  </div>
                </div>

                <Button variant="unstyled"
                  type="button"
                  onClick={() => setActivePreviewId(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', padding: 4 }}
                  aria-label="Close Preview"
                >
                  <X size={14} />
                </Button>
              </div>

              <p className="graph-quick-dock__reason">
                {formatRationale(activeArt.plainReason)}
              </p>

              <div className="graph-quick-dock__actions">
                <Button
                  variant="default"
                  size="xs"
                  onClick={() => selectArtifact(activeArt.id)}
                  className="gap-1.5"
                >
                  <Eye size={12} />
                  <span>Inspect Evidence</span>
                </Button>

                {openCodeExplorer && activeArt.file && !activeArt.file.includes('Register') && (
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => openCodeExplorer(activeArt.file)}
                    className="gap-1.5"
                  >
                    <ExternalLink size={12} />
                    <span>Open Code Explorer</span>
                  </Button>
                )}

                {openReviewForm && (
                  <Button
                    variant="subtle"
                    size="xs"
                    onClick={() => { selectArtifact(activeArt.id); openReviewForm(); }}
                    className="gap-1"
                  >
                    <CheckCircle2 size={12} />
                    <span>Record Judgment</span>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : viewMode === 'flow' ? (
        /* Interactive XYFlow + ELK Canvas */
        <TraceabilityFlow
          rawNodes={nodes}
          rawEdges={filteredEdges}
          selectedArtifactId={state.selectedArtifactId}
          onSelectNode={(id) => { selectArtifact(id); setActivePreviewId(id); }}
          theme={ctx.theme}
        />
      ) : (
        /* Impeccable Continuum Traceability Data Table */
        <div className="data-table-card">
          <div className="data-table-wrap">
            <table className="data-table" aria-label="Knowledge Continuity Artifacts & Traceability Matrix">
              <thead>
                <tr>
                  <th
                    scope="col"
                    style={{ width: '30%' }}
                    className={`is-sortable ${sortKey === 'shortName' ? 'is-sorted' : ''}`}
                    onClick={() => handleSort('shortName')}
                    aria-sort={sortKey === 'shortName' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    title="Sort by Artifact Name"
                  >
                    <div className="th-content">
                      <span>Artifact &amp; Category</span>
                      <span className="th-sort-icon">
                        {sortKey === 'shortName' ? (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
                      </span>
                    </div>
                  </th>
                  <th
                    scope="col"
                    style={{ width: '38%' }}
                    className={`is-sortable ${sortKey === 'relLabel' ? 'is-sorted' : ''}`}
                    onClick={() => handleSort('relLabel')}
                    aria-sort={sortKey === 'relLabel' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    title="Sort by Relationship Type"
                  >
                    <div className="th-content">
                      <span>Relationship &amp; Rationale</span>
                      <span className="th-sort-icon">
                        {sortKey === 'relLabel' ? (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
                      </span>
                    </div>
                  </th>
                  <th
                    scope="col"
                    style={{ width: '16%' }}
                    className={`is-sortable ${sortKey === 'r1Status' ? 'is-sorted' : ''}`}
                    onClick={() => handleSort('r1Status')}
                    aria-sort={sortKey === 'r1Status' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    title="Sort by Review Status"
                  >
                    <div className="th-content">
                      <span>Status</span>
                      <span className="th-sort-icon">
                        {sortKey === 'r1Status' ? (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
                      </span>
                    </div>
                  </th>
                  <th
                    scope="col"
                    style={{ width: '16%' }}
                    className={`is-sortable ${sortKey === 'followUpWork' ? 'is-sorted' : ''}`}
                    onClick={() => handleSort('followUpWork')}
                    aria-sort={sortKey === 'followUpWork' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    title="Sort by Follow-up Action"
                  >
                    <div className="th-content">
                      <span>Follow-up Work</span>
                      <span className="th-sort-icon">
                        {sortKey === 'followUpWork' ? (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan="4">
                      <div className="data-table-empty">
                        <div className="data-table-empty-icon">
                          <Filter size={20} />
                        </div>
                        <div>
                          <strong style={{ display: 'block', fontSize: 14, color: 'var(--ink)', marginBottom: 4 }}>
                            No matching artifacts found
                          </strong>
                          <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                            No items match the active category, relationship filter, or search query.
                          </span>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleResetFilters}
                          className="gap-1.5 mt-1"
                        >
                          <RotateCcw size={12} />
                          <span>Reset filters</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedRows.map(art => {
                    const isSel = state.selectedArtifactId === art.id && state.inspectorOpen;
                    const sInfo = getStatusInfo(art, state.revisionMode);
                    const wInfo = getWorkInfo(art, state.revisionMode);
                    const catMeta = getCategoryMeta(art.category);
                    const CatIcon = catMeta.icon;
                    const relInfo = getRelChipInfo(art.relKind, art.relLabel);

                    return (
                      <tr
                        key={art.id}
                        className={isSel ? 'is-selected' : ''}
                        onClick={() => selectArtifact(art.id)}
                        tabIndex="0"
                        role="button"
                        aria-label={`Inspect ${art.shortName}`}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.preventDefault();
                            selectArtifact(art.id);
                          }
                        }}
                      >
                        {/* Artifact & Category */}
                        <td>
                          <div className="table-artifact-cell">
                            <Tooltip title={art.category} content={`File: ${art.file || 'Repository artifact'}`} side="top">
                              <div className={`table-artifact-icon-wrap ${catMeta.wrapCls}`} style={{ cursor: 'help' }}>
                                <CatIcon size={16} />
                              </div>
                            </Tooltip>
                            <div className="table-artifact-info">
                              {renderArtifactHeading(art.shortName)}
                              <div className="table-art-meta">
                                <span className="table-cat-badge">{catMeta.label}</span>
                                {art.linkedIntentId && (
                                  <Tooltip title="Linked Architectural Intent" content={art.linkedIntentTitle || 'Direct architectural intent link'} side="top">
                                    <span className="table-intent-chip font-mono" style={{ cursor: 'help' }}>
                                      {art.linkedIntentId}
                                    </span>
                                  </Tooltip>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Relationship & Rationale */}
                        <td>
                          <div className="table-rationale-cell">
                            <Tooltip title={relInfo.tag} content={`Relationship: ${art.relLabel || relInfo.tag}`} side="top">
                              <span className={`table-rel-chip ${relInfo.cls}`} style={{ cursor: 'help' }}>
                                <span className="status-dot dot--neutral" style={{ width: 5, height: 5 }} />
                                <span>{art.relLabel || relInfo.tag}</span>
                              </span>
                            </Tooltip>
                            <p className="table-rationale-text">
                              {formatRationale(art.plainReason)}
                            </p>
                          </div>
                        </td>

                        {/* Status */}
                        <td>
                          <div className="table-status-cell">
                            <Tooltip title="Review Status" content={art.r1Reviewer ? `Reviewed & confirmed by ${art.r1Reviewer}` : 'Awaiting review decision for incoming change'} side="top">
                              <span className={`status-pill ${sInfo.cls}`} style={{ cursor: 'help' }}>
                                <span className={`status-dot ${sInfo.dot}`} />
                                <span>{sInfo.text}</span>
                              </span>
                            </Tooltip>
                            <small className="table-cell-sub">
                              {art.r1Reviewer ? `By ${art.r1Reviewer}` : 'Awaiting judgment'}
                            </small>
                          </div>
                        </td>

                        {/* Follow-up Work */}
                        <td>
                          <div className="table-work-cell">
                            <Tooltip title="Follow-up Action" content={`Assigned disposition: ${wInfo.text}`} side="top">
                              <span className={`status-pill ${wInfo.cls}`} style={{ cursor: 'help' }}>
                                <span className={`status-dot ${wInfo.dot}`} />
                                <span>{wInfo.text}</span>
                              </span>
                            </Tooltip>
                            <Tooltip title="Inspect Evidence" content="Examine code diff, history, and record judgment" side="left">
                              <span className="table-inspect-arrow">
                                <ChevronRight size={15} />
                              </span>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Summary Footer */}
          <div className="data-table-footer">
            <div className="data-table-footer__stats">
              <span className="data-table-footer__stat-item">
                <strong>{sortedRows.length}</strong> of {Object.keys(state.artifacts).length} artifacts
              </span>
              <span>·</span>
              <span className="data-table-footer__stat-item">
                <span className="status-dot dot--amber" />
                <span>{reviewStats.needsReview} need review</span>
              </span>
              {reviewStats.codeUpdate > 0 && (
                <>
                  <span>·</span>
                  <span className="data-table-footer__stat-item">
                    <span className="status-dot dot--red" />
                    <span>{reviewStats.codeUpdate} code update open</span>
                  </span>
                </>
              )}
              {reviewStats.deferred > 0 && (
                <>
                  <span>·</span>
                  <span className="data-table-footer__stat-item">
                    <span className="status-dot dot--amber" />
                    <span>{reviewStats.deferred} doc deferred</span>
                  </span>
                </>
              )}
            </div>
            <div className="data-table-footer__hints">
              <span>Select row or press</span>
              <kbd>Enter</kbd>
              <span>to inspect in evidence drawer</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
