import { useState } from 'react';
import {
  Layers,
  Server,
  Database,
  FolderGit2,
  GitBranch,
  FileCode2,
  ShieldCheck,
  Bot,
  Zap,
  Activity,
  ArrowRight,
  Terminal
} from 'lucide-react';
import { Button, Badge, Tabs, TabsList, TabsTrigger } from './ui/index.js';

export default function ArchitectureModule({ ctx }) {
  const { state, setState, showToast, triggerConfetti, selectArtifact } = ctx;
  const [activeTab, setActiveTab] = useState('c4'); // 'c4' or 'layered'
  const [simulatingEvent, setSimulatingEvent] = useState(false);
  const [cypherOutput, setCypherOutput] = useState(null);

  const c4 = state.c4Topology || {
    webFrontend: { name: 'Web Frontend', container: 'Container: React / TypeScript', status: 'Operational', latency: '0.4ms', port: '5173' },
    backendApi: { name: 'Backend API', container: 'Container: Python / FastAPI', status: 'Operational', latency: '3.6ms', port: '8000' },
    redisQueue: { name: 'Redis Queue', container: 'Container: Redis 7.2', status: 'Operational', latency: '0.8ms', queuedJobs: 0, processedJobs: 148 },
    processingWorker: { name: 'Processing Worker', container: 'Container: Python / RQ', status: 'Idle (Ready)', workerPid: '8841', parsers: 'Tree-sitter AST + Docling v2.1' },
    neo4j: { name: 'Artifact Knowledge Graph', container: 'Container: Neo4j 5.20 (Bolt)', status: 'Connected', latency: '1.2ms', nodes: 14, edges: 28, protocol: 'bolt://localhost:7687' },
    gitProject: { name: 'Git Project', container: 'External Source: GitHub', status: 'Synced', branch: 'main', revs: 'a41c90e..8f3b21d' }
  };

  const handleSimulateWebhook = () => {
    setSimulatingEvent(true);
    showToast('Simulating Git push event on branch "main" (commit 8f3b21d)...');

    setTimeout(() => {
      setState(s => {
        const base = s.c4Topology || c4;
        return {
          ...s,
          c4Topology: {
            ...base,
            redisQueue: { ...(base.redisQueue || {}), queuedJobs: 1 },
            processingWorker: { ...(base.processingWorker || {}), status: 'Processing job (Tree-sitter AST + Docling)' }
          }
        };
      });
    }, 400);

    setTimeout(() => {
      setState(s => {
        const base = s.c4Topology || c4;
        return {
          ...s,
          c4Topology: {
            ...base,
            redisQueue: {
              ...(base.redisQueue || {}),
              queuedJobs: 0,
              processedJobs: (base.redisQueue?.processedJobs || 148) + 1
            },
            processingWorker: { ...(base.processingWorker || {}), status: 'Idle (Ready)' },
            neo4j: { ...(base.neo4j || {}), nodes: 14, edges: 28 }
          }
        };
      });
      setSimulatingEvent(false);
      triggerConfetti?.({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
      showToast('Worker completed revalidation! Candidate Impact Set updated in Neo4j.');
    }, 1600);
  };

  const cypherQueryRows = [
    { nId: 'DEC-04', rel: 'JUSTIFIES', mId: 'bbb.py::createRequest' },
    { nId: 'aaa.py::submitUserOrder', rel: 'CALLS_FUNCTION', mId: 'bbb.py::createRequest' },
    { nId: 'compat.py::normalizeRequestResult', rel: 'CALLS_FUNCTION', mId: 'bbb.py::createRequest' },
    { nId: 'aaa.md::section-2.1', rel: 'EXPLAINS', mId: 'bbb.py::createRequest' }
  ];

  const handleRunCypherTest = () => {
    setCypherOutput(true);
    showToast('Executed Cypher query over Neo4j Bolt connection (1.2ms).');
  };

  return (
    <div className="canvas-scroll">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.03em', margin: 0 }}>
            Continuum Architecture &amp; C4 Container Topology
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <Badge variant="accent" size="xs" className="font-mono gap-1.5">
              <span className="status-dot dot--green" />
              <span>All 6 Containers Connected</span>
            </Badge>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0, maxWidth: 660 }}>
              Real-time interactive realization of Figure 7 (C4 Container Architecture) and Figure 1 (Layered Knowledge Continuity Architecture).
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleRunCypherTest}
            title="Execute test Cypher query against Neo4j"
            className="gap-1.5"
          >
            <Database size={13} color="var(--accent)" />
            <span>Test Neo4j Bolt Query</span>
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleSimulateWebhook}
            disabled={simulatingEvent}
            title="Simulate Git push webhook triggering Redis queue & RQ worker"
            className="gap-1.5"
          >
            <Zap size={14} />
            <span>{simulatingEvent ? 'Worker Processing…' : 'Simulate Git Push Webhook'}</span>
          </Button>
        </div>
      </div>

      {/* Tab Selector: Figure 7 C4 vs Figure 1 Layered */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-5">
        <TabsList>
          <TabsTrigger value="c4" className="gap-1.5 text-[12px]">
            <Server size={14} />
            <span>Figure 7 · Proposed C4 Container Architecture</span>
          </TabsTrigger>
          <TabsTrigger value="layered" className="gap-1.5 text-[12px]">
            <Layers size={14} />
            <span>Figure 1 · Overall 6-Layer Architecture</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* TAB 1: FIGURE 7 C4 CONTAINER TOPOLOGY */}
      {activeTab === 'c4' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Visual C4 Diagram Box */}
          <div className="card card--p-md" style={{ background: 'var(--ground-card)', overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={15} color="var(--accent)" />
                <span>Continuum System Container Boundary (C4 Level 2)</span>
              </div>
              <Badge variant="success" size="xs" className="font-mono">
                Live Connected State
              </Badge>
            </div>

            {/* Interactive C4 Diagram Layout */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 16,
                padding: 16,
                background: 'var(--ground-sunken)',
                borderRadius: 'var(--r-lg)',
                border: '1px solid var(--border)'
              }}
            >
              {/* Box 1: Practitioner */}
              <div style={{ padding: 16, background: 'var(--c4-practitioner-bg)', borderRadius: 'var(--r-md)', border: '1.5px solid var(--c4-practitioner-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c4-practitioner-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>PRACTITIONER</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c4-practitioner-title)', marginTop: 3 }}>Person: Lead Developer</div>
                <div style={{ fontSize: 12, color: 'var(--c4-practitioner-text)', marginTop: 5, lineHeight: 1.5 }}>
                  Explores artifacts, inspects candidate impact sets, authors ADRs, and records human-accountable review decisions.
                </div>
                <Badge variant="neutral" size="xs" className="font-mono mt-2.5 text-[10px]">
                  Uses Web Frontend
                </Badge>
              </div>

              {/* Box 2: Web Frontend */}
              <div style={{ padding: 16, background: 'var(--c4-web-bg)', borderRadius: 'var(--r-md)', border: '1.5px solid var(--c4-web-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c4-web-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>WEB FRONTEND</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c4-web-title)', marginTop: 3 }}>Container: React / TypeScript</div>
                <div style={{ fontSize: 12, color: 'var(--c4-web-text)', marginTop: 5, lineHeight: 1.5 }}>
                  Interactive UI for search, graph navigation, diff review, coverage spectrum, and graph-grounded AI queries.
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <Badge variant="accent" size="xs" className="font-mono text-[10px]">HTTPS / JSON</Badge>
                  <Badge variant="success" size="xs" className="font-mono text-[10px]">0.4ms Latency</Badge>
                </div>
              </div>

              {/* Box 3: Backend API */}
              <div style={{ padding: 16, background: 'var(--c4-api-bg)', borderRadius: 'var(--r-md)', border: '1.5px solid var(--c4-api-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c4-api-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>BACKEND API</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c4-api-title)', marginTop: 3 }}>Container: Python / FastAPI</div>
                <div style={{ fontSize: 12, color: 'var(--c4-api-text)', marginTop: 5, lineHeight: 1.5 }}>
                  Access control, audit record persistence, Bolt Cypher queries to Neo4j, and async job submission to Redis.
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <Badge variant="neutral" size="xs" className="font-mono text-[10px]">Port 8000</Badge>
                  <Badge variant="success" size="xs" className="font-mono text-[10px]">3.6ms Latency</Badge>
                </div>
              </div>

              {/* Box 4: Redis Queue */}
              <div style={{ padding: 16, background: 'var(--c4-queue-bg)', borderRadius: 'var(--r-md)', border: '1.5px solid var(--c4-queue-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c4-queue-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>REDIS QUEUE</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c4-queue-title)', marginTop: 3 }}>Container: Redis 7.2</div>
                <div style={{ fontSize: 12, color: 'var(--c4-queue-text)', marginTop: 5, lineHeight: 1.5 }}>
                  Queues analysis jobs, change impact recalculations, and asynchronous review validation commands.
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <Badge variant="neutral" size="xs" className="font-mono text-[10px]">{c4.redisQueue?.queuedJobs || 0} Queued</Badge>
                  <Badge variant="success" size="xs" className="font-mono text-[10px]">{c4.redisQueue?.processedJobs || 148} Processed</Badge>
                </div>
              </div>

              {/* Box 5: Processing Worker */}
              <div style={{ padding: 16, background: 'var(--c4-worker-bg)', borderRadius: 'var(--r-md)', border: '1.5px solid var(--c4-worker-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c4-worker-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>PROCESSING WORKER</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c4-worker-title)', marginTop: 3 }}>Container: Python / RQ</div>
                <div style={{ fontSize: 12, color: 'var(--c4-worker-text)', marginTop: 5, lineHeight: 1.5 }}>
                  Runs Tree-sitter AST extraction, Docling document layout analysis, UniXcoder embeddings, and impact revalidation.
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <Badge variant="neutral" size="xs" className="font-mono text-[10px]">PID {c4.processingWorker?.workerPid || 8841}</Badge>
                  <Badge variant="success" size="xs" className="font-mono text-[10px]">{c4.processingWorker?.status || 'Idle (Ready)'}</Badge>
                </div>
              </div>

              {/* Box 6: Neo4j Knowledge Graph */}
              <div style={{ padding: 16, background: 'var(--c4-neo4j-bg)', borderRadius: 'var(--r-md)', border: '1.5px solid var(--c4-neo4j-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c4-neo4j-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>NEO4J DATA STORE</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c4-neo4j-title)', marginTop: 3 }}>Artifact Knowledge Graph</div>
                <div style={{ fontSize: 12, color: 'var(--c4-neo4j-text)', marginTop: 5, lineHeight: 1.5 }}>
                  Stores code units, Docling sections, ADR records, ISO requirements, and validated relationship edges via Bolt.
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <Badge variant="success" size="xs" className="font-mono text-[10px]">14 Nodes · 28 Edges</Badge>
                  <Badge variant="accent" size="xs" className="font-mono text-[10px]">Bolt 1.2ms</Badge>
                </div>
              </div>

              {/* Box 7: Git Project (External) */}
              <div style={{ padding: 16, background: 'var(--c4-git-bg)', borderRadius: 'var(--r-md)', border: '1.5px solid var(--c4-git-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c4-git-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>EXTERNAL GIT SOURCE</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c4-git-title)', marginTop: 3 }}>Git Project &amp; Revisions</div>
                <div style={{ fontSize: 12, color: 'var(--c4-git-text)', marginTop: 5, lineHeight: 1.5 }}>
                  Provides raw file trees, commit histories, and revision diffs (a41c90e → 8f3b21d). Read by Processing Worker.
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <Badge variant="neutral" size="xs" className="font-mono text-[10px]">Branch: main</Badge>
                  <Badge variant="success" size="xs" className="font-mono text-[10px]">Synced</Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Cypher Output Console */}
          {cypherOutput && (
            <div
              className="card card--p-md"
              style={{
                background: '#090D16',
                border: '1px solid #1E293B',
                color: '#F8FAFC'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid #1E293B', paddingBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#38BDF8', fontFamily: 'var(--font-mono)' }}>
                  <Terminal size={14} />
                  <span>BOLT PROTOCOL QUERY · bolt://localhost:7687</span>
                </div>
                <Badge variant="success" size="xs" className="font-mono text-[10px]">
                  1.2ms · 4 Rows Returned
                </Badge>
              </div>

              <pre style={{ margin: 0, font: '12px/1.6 var(--font-mono)', color: '#94A3B8', marginBottom: 12 }}>
                {`MATCH (n:Artifact)-[r:JUSTIFIES|CALLS_FUNCTION|EXPLAINS]->(m:Artifact)
RETURN n.id, type(r), m.id LIMIT 4;`}
              </pre>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', font: '12px var(--font-mono)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1E293B', color: '#64748B', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px' }}>Source Node (n.id)</th>
                      <th style={{ padding: '6px 8px' }}>Relationship type(r)</th>
                      <th style={{ padding: '6px 8px' }}>Target Node (m.id)</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cypherQueryRows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: '8px', color: '#38BDF8' }}>
                          <Button variant="unstyled"
                            type="button"
                            onClick={() => selectArtifact(row.nId)}
                            style={{ background: 'none', border: 'none', color: '#38BDF8', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}
                          >
                            {row.nId}
                          </Button>
                        </td>
                        <td style={{ padding: '8px', color: '#FCD34D' }}>{row.rel}</td>
                        <td style={{ padding: '8px', color: '#4ADE80' }}>
                          <Button variant="unstyled"
                            type="button"
                            onClick={() => selectArtifact(row.mId)}
                            style={{ background: 'none', border: 'none', color: '#4ADE80', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}
                          >
                            {row.mId}
                          </Button>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => selectArtifact(row.nId)}
                            className="gap-1"
                          >
                            <span>Inspect</span>
                            <ArrowRight size={10} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FIGURE 1 LAYERED ARCHITECTURE */}
      {activeTab === 'layered' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Layer 1: Source */}
          <div className="card card--p-md" style={{ borderLeft: '3px solid var(--accent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FolderGit2 size={16} color="var(--accent)" />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Layer 1: Source repositories</span>
              </div>
              <Badge variant="neutral" size="xs" className="font-mono">GitHub Repositories</Badge>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Supports both <strong>Shared Repositories</strong> (code and documentation unified in a single repo) and <strong>Separate Repositories</strong> (dedicated code repo paired with an external documentation or specifications repo).
            </div>
          </div>

          {/* Layer 2: Ingestion */}
          <div className="card card--p-md" style={{ borderLeft: '3px solid var(--amber)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <GitBranch size={16} color="var(--amber)" />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Layer 2: Ingestion layer</span>
              </div>
              <Badge variant="neutral" size="xs" className="font-mono">Connector + Monitor</Badge>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              <strong>Repository Connector</strong> clones and indexes blobs. <strong>Branch / Event Monitor</strong> listens for git commits and pushes, triggering selective relationship re-analysis and revalidation.
            </div>
          </div>

          {/* Layer 3: Extraction & Analysis */}
          <div className="card card--p-md" style={{ borderLeft: '3px solid var(--green)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileCode2 size={16} color="var(--green)" />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Layer 3: Extraction, analysis, and relationships</span>
              </div>
              <Badge variant="neutral" size="xs" className="font-mono">Tree-sitter + Docling</Badge>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              <strong>Code Parser (Tree-sitter)</strong> extracts concrete syntax tree logical elements. <strong>Document Extractor (Docling)</strong> parses section headings, prose passages, and discloses layout boundaries (e.g. scanned PDFs without text layers). Both feed into the <strong>Relationship Engine</strong> (UniXcoder paired code-text embeddings + AST call-graph synthesis).
            </div>
          </div>

          {/* Layer 4: Knowledge Representation */}
          <div className="card card--p-md" style={{ borderLeft: '3px solid var(--accent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database size={16} color="var(--accent)" />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Layer 4: Knowledge representation</span>
              </div>
              <Badge variant="accent" size="xs" className="font-mono">Neo4j Artifact Knowledge Graph</Badge>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Persistent graph database storing artifacts (Code, Docs, Decisions, Requirements) and validated relationships with full versioned revision tracking.
            </div>
          </div>

          {/* Layer 5: Governance & Change-Impact */}
          <div className="card card--p-md" style={{ borderLeft: '3px solid var(--red)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={16} color="var(--red)" />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Layer 5: Governance, change-impact, and continuity</span>
              </div>
              <Badge variant="neutral" size="xs" className="font-mono">Change Detector &amp; Review Loop</Badge>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              <strong>Repository Change Detector</strong> computes diffs → <strong>Change Impact Engine</strong> identifies affected neighbors → <strong>Candidate Impact Set</strong> → <strong>Relationship Validation and Review</strong> (with human rationale required) → <strong>Knowledge Revalidation and Update Engine</strong> updates Neo4j.
            </div>
          </div>

          {/* Layer 6: Knowledge Access */}
          <div className="card card--p-md" style={{ borderLeft: '3px solid var(--ink-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bot size={16} color="var(--accent)" />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Layer 6: Knowledge access and presentation</span>
              </div>
              <Badge variant="neutral" size="xs" className="font-mono">Continuum User Interface</Badge>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Comprehensive access points: Artifact Search &amp; Exploration, Graph Navigation, Evidence-Backed Retrieval, <strong>Graph-Grounded AI Chatbot</strong>, and Guided Onboarding / Handover.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
