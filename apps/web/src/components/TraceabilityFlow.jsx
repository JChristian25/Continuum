import { useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';
import {
  FileCode2,
  FileText,
  ListChecks,
  CheckCircle2,
  GitCommit,
  Sparkles,
  AlertTriangle,
  GitCompare,
  Clock
} from 'lucide-react';
import { Badge } from './ui/index.js';

const elk = new ELK();

const CHANGE_LABELS = {
  modified: 'Modified',
  added: 'Added',
  deleted: 'Removed',
  record_modified: 'Revised',
};

// Custom Node for XYFlow
function ArtifactFlowNode({ data }) {
  const {
    title,
    sub,
    category,
    isSeed,
    isSelected,
    statusDot,
    changeKind,
    impactRole,
    impactCount = 0,
    staleCount = 0,
    candidateCount = 0,
    confirmedCount = 0,
  } = data;

  const isChanged = Boolean(changeKind) || impactRole === 'changed';
  const isImpacted = !isChanged && impactRole === 'impacted';
  const isDeleted = changeKind === 'deleted';

  const getIcon = () => {
    const color = isDeleted
      ? '#c2410c'
      : isChanged || isImpacted
        ? '#b45309'
        : 'var(--accent)';
    switch (category) {
      case 'code':
      case 'Code Elements':
        return <FileCode2 size={13} color={color} aria-hidden="true" />;
      case 'requirement':
      case 'Requirements':
        return <ListChecks size={13} color={color} aria-hidden="true" />;
      case 'decision':
      case 'Decisions':
        return <GitCommit size={13} color={color} aria-hidden="true" />;
      case 'document':
        return <FileText size={13} color={color} aria-hidden="true" />;
      case 'test':
        return <CheckCircle2 size={13} color="var(--green)" aria-hidden="true" />;
      default:
        return <Sparkles size={13} color="var(--ink-2)" aria-hidden="true" />;
    }
  };

  let border = '1px solid var(--border)';
  let background = 'var(--ground-card)';
  let boxShadow = 'none';

  if (isDeleted) {
    border = '1.5px solid #dc2626';
    background = 'rgba(220, 38, 38, 0.06)';
    boxShadow = '0 3px 10px rgba(220, 38, 38, 0.10)';
  } else if (isChanged) {
    border = '1.5px solid #d97706';
    background = 'rgba(217, 119, 6, 0.08)';
    boxShadow = '0 3px 10px rgba(217, 119, 6, 0.12)';
  } else if (isImpacted) {
    border = '1.5px dashed #d97706';
    background = 'rgba(250, 236, 196, 0.35)';
    boxShadow = '0 2px 8px rgba(217, 119, 6, 0.08)';
  }

  if (isSelected) {
    border = '2px solid var(--accent)';
    background = 'var(--accent-tint)';
    boxShadow = '0 4px 12px rgba(52, 103, 70, 0.14)';
  }

  const hasMiniStats = staleCount > 0 || candidateCount > 0 || confirmedCount > 0;
  const nodeTooltip = [
    sub || title,
    changeKind ? `Change: ${CHANGE_LABELS[changeKind] || changeKind}` : null,
    isImpacted ? `Affected by revision change (${impactCount} link${impactCount === 1 ? '' : 's'})` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div
      title={nodeTooltip}
      style={{
        padding: '10px 13px',
        borderRadius: 12,
        background,
        border,
        boxShadow,
        width: 224,
        cursor: 'pointer',
        transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
        fontFamily: 'inherit'
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: isChanged || isImpacted ? '#d97706' : 'var(--accent)', width: 8, height: 8 }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {getIcon()}
          <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase' }}>
            {category || 'Artifact'}
          </span>
        </div>
        {isChanged ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 9.5,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 99,
              background: isDeleted ? '#fbeaea' : '#faecc4',
              color: isDeleted ? '#8c1d18' : '#5c3904',
              border: isDeleted ? '1px solid #eabcbc' : '1px solid #dec073',
            }}
          >
            <AlertTriangle size={10} aria-hidden="true" />
            {CHANGE_LABELS[changeKind] || 'Changed'}
          </span>
        ) : isImpacted ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 9.5,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 99,
              background: '#faecc4',
              color: '#5c3904',
              border: '1px solid #dec073',
            }}
          >
            <GitCompare size={10} aria-hidden="true" />
            Affected{impactCount > 1 ? ` (${impactCount})` : ''}
          </span>
        ) : isSeed ? (
          <Badge variant="accent" size="xs" className="font-mono text-[9px] px-1.5 py-0">
            Seed
          </Badge>
        ) : null}
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {title}
      </div>

      <div style={{ fontSize: 10.5, color: 'var(--ink-2)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-mono)' }}>
        {sub}
      </div>

      {hasMiniStats ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 10, color: 'var(--ink-2)' }}>
          {staleCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#8a5204', fontWeight: 600 }} title={`${staleCount} stale`}>
              <AlertTriangle size={10} aria-hidden="true" /> {staleCount}
            </span>
          )}
          {candidateCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--ink-2)', fontWeight: 600 }} title={`${candidateCount} candidate`}>
              <Clock size={10} aria-hidden="true" /> {candidateCount}
            </span>
          )}
          {confirmedCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--accent)', fontWeight: 600 }} title={`${confirmedCount} confirmed`}>
              <CheckCircle2 size={10} aria-hidden="true" /> {confirmedCount}
            </span>
          )}
        </div>
      ) : statusDot ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 10.5, color: 'var(--ink-3)' }}>
          <span className={`status-dot ${statusDot}`} />
          <span>Active</span>
        </div>
      ) : null}

      <Handle type="source" position={Position.Right} style={{ background: isChanged || isImpacted ? '#d97706' : 'var(--accent)', width: 8, height: 8 }} />
    </div>
  );
}

const nodeTypes = {
  artifact: ArtifactFlowNode
};

function edgeVisual(edge) {
  const isStale = edge.kind === 'stale' || edge.impacted;
  if (isStale) {
    return {
      color: '#d97706',
      width: 2.5,
      animated: true,
      dasharray: '6 3',
      labelFill: '#5c3904',
      labelBg: '#faecc4',
      labelBorder: '#dec073',
      opacity: 1,
    };
  }
  if (edge.kind === 'candidate') {
    return {
      color: 'var(--amber, #b45309)',
      width: 2,
      animated: true,
      dasharray: undefined,
      labelFill: 'var(--ink-2)',
      labelBg: 'var(--ground-card)',
      labelBorder: 'var(--border)',
      opacity: 1,
    };
  }
  if (edge.kind === 'rejected' || edge.kind === 'retired') {
    return {
      color: 'var(--ink-3)',
      width: 1.5,
      animated: false,
      dasharray: '3 3',
      labelFill: 'var(--ink-3)',
      labelBg: 'var(--ground-card)',
      labelBorder: 'var(--border)',
      opacity: 0.72,
    };
  }
  return {
    color: edge.kind === 'decision' ? 'var(--ink)' : 'var(--accent)',
    width: 2,
    animated: false,
    dasharray: undefined,
    labelFill: 'var(--ink-2)',
    labelBg: 'var(--ground-card)',
    labelBorder: 'var(--border)',
    opacity: 1,
  };
}

export default function TraceabilityFlow({
  rawNodes = [],
  rawEdges = [],
  selectedArtifactId,
  onSelectNode,
  onSelectEdge,
  compact = false,
  height,
  showMiniMap,
  theme = 'dark'
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [layoutReady, setLayoutReady] = useState(false);
  const [rfInstance, setRfInstance] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !rfInstance || !layoutReady || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      rfInstance.fitView({ padding: compact ? 0.12 : 0.2 });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [rfInstance, layoutReady, compact]);

  // Compute ELK Layout
  useEffect(() => {
    let isCancelled = false;

    async function computeLayout() {
      const elkNodes = rawNodes.map(n => ({
        id: n.id,
        width: 234,
        height: 86
      }));

      const elkEdges = rawEdges.map((e, idx) => ({
        id: `e-${idx}-${e.from}-${e.to}`,
        sources: [e.from],
        targets: [e.to]
      }));

      const elkGraph = {
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'RIGHT',
          'elk.spacing.nodeNode': compact ? '28' : '95',
          'elk.layered.spacing.nodeNodeBetweenLayers': compact ? '140' : '220',
          'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
          'elk.layered.spacing.edgeNodeBetweenLayers': '40'
        },
        children: elkNodes,
        edges: elkEdges
      };

      try {
        const layout = await elk.layout(elkGraph);
        if (isCancelled) return;

        const layoutNodeMap = {};
        layout.children?.forEach(c => {
          layoutNodeMap[c.id] = { x: c.x, y: c.y };
        });

        // Map to XYFlow nodes
        const flowNodes = rawNodes.map(n => {
          const pos = layoutNodeMap[n.id] || { x: n.x || 0, y: n.y || 0 };
          return {
            id: n.id,
            type: 'artifact',
            position: pos,
            data: {
              ...n,
              isSelected: n.id === selectedArtifactId
            }
          };
        });

        // Map to XYFlow edges (stagger parallel edges sharing endpoints cleanly)
        const pairCounts = new Map();
        for (const e of rawEdges) {
          const pk = `${e.from}::${e.to}`;
          pairCounts.set(pk, (pairCounts.get(pk) || 0) + 1);
        }
        const pairSeen = new Map();
        const flowEdges = rawEdges.map((e, idx) => {
          const visual = edgeVisual(e);
          const pk = `${e.from}::${e.to}`;
          const seenIdx = pairSeen.get(pk) || 0;
          pairSeen.set(pk, seenIdx + 1);
          const totalForPair = pairCounts.get(pk) || 1;
          const offset = totalForPair > 1 ? 18 + (seenIdx - (totalForPair - 1) / 2) * 28 : 20;
          return {
            id: `flow-e-${idx}-${e.from}-${e.to}`,
            source: e.from,
            data: { contextId: e.id },
            target: e.to,
            label: e.label,
            type: 'smoothstep',
            pathOptions: { offset },
            animated: visual.animated,
            style: {
              stroke: visual.color,
              strokeWidth: visual.width,
              strokeDasharray: visual.dasharray,
              opacity: visual.opacity,
            },
            labelStyle: {
              fill: visual.labelFill,
              fontSize: 10,
              fontWeight: e.impacted || e.kind === 'stale' ? 600 : 500,
              fontFamily: 'var(--font-mono)'
            },
            labelBgStyle: {
              fill: visual.labelBg,
              stroke: visual.labelBorder
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: visual.color
            }
          };
        });

        setNodes(flowNodes);
        setEdges(flowEdges);
        setLayoutReady(true);
      } catch (err) {
        console.error('ELK layout computation error:', err);
      }
    }

    computeLayout();
    return () => { isCancelled = true; };
  }, [rawNodes, rawEdges, selectedArtifactId, compact, setNodes, setEdges]);

  // Synchronize selection state in nodes
  useEffect(() => {
    setNodes(prev => prev.map(n => ({
      ...n,
      data: {
        ...n.data,
        isSelected: n.id === selectedArtifactId
      }
    })));
  }, [selectedArtifactId, setNodes]);

  const handleNodeClick = (_, node) => {
    onSelectNode?.(node.id);
  };

  const containerHeight = height ?? (compact ? '100%' : 740);
  const displayMiniMap = showMiniMap ?? !compact;

  return (
    <div ref={containerRef} style={{ width: '100%', height: containerHeight, borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--border)', position: 'relative' }}>
      {!layoutReady ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-2)', fontSize: 13 }}>
          Computing graph layout…
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onInit={setRfInstance}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onEdgeClick={(_, edge) => onSelectEdge?.(edge.data?.contextId)}
          fitView
          fitViewOptions={{ padding: compact ? 0.12 : 0.2 }}
          minZoom={0.15}
          maxZoom={2.0}
        >
          <Background color={theme === 'dark' ? '#334155' : '#CBD5E1'} gap={16} size={1} />
          <Controls showInteractive={false} />
          {displayMiniMap && <MiniMap
            nodeColor={node => (node.data?.changeKind || node.data?.impactRole === 'impacted') ? '#d97706' : 'var(--accent)'}
            maskColor={theme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'}
          />}
        </ReactFlow>
      )}
    </div>
  );
}
