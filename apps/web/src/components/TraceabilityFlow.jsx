import { useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
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
    const className = isDeleted ? 'tf-icon-danger' : isChanged || isImpacted ? 'tf-icon-warn' : 'tf-icon-accent';
    switch (category) {
      case 'code':
      case 'Code Elements':
        return <FileCode2 size={13} className={className} aria-hidden="true" />;
      case 'requirement':
      case 'Requirements':
        return <ListChecks size={13} className={className} aria-hidden="true" />;
      case 'decision':
      case 'Decisions':
        return <GitCommit size={13} className={className} aria-hidden="true" />;
      case 'document':
        return <FileText size={13} className={className} aria-hidden="true" />;
      case 'test':
        return <CheckCircle2 size={13} className="tf-icon-green" aria-hidden="true" />;
      default:
        return <Sparkles size={13} className="tf-icon-muted" aria-hidden="true" />;
    }
  };

  const nodeStateClass = isSelected
    ? 'is-selected'
    : isDeleted
      ? 'is-deleted'
      : isChanged
        ? 'is-changed'
        : isImpacted
          ? 'is-impacted'
          : '';

  const hasMiniStats = staleCount > 0 || candidateCount > 0 || confirmedCount > 0;
  const nodeTooltip = [
    sub || title,
    changeKind ? `Change: ${CHANGE_LABELS[changeKind] || changeKind}` : null,
    isImpacted ? `Affected by revision change (${impactCount} link${impactCount === 1 ? '' : 's'})` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div title={nodeTooltip} className={`tf-node ${nodeStateClass}`}>
      <Handle type="target" position={Position.Left} className={`tf-handle ${isChanged || isImpacted ? 'is-warn' : ''}`} />

      <div className="tf-node__top">
        <div className="tf-node__kind">
          {getIcon()}
          <span className="font-mono tf-node__category">{category || 'Artifact'}</span>
        </div>
        {isChanged ? (
          <span className={`tf-pill ${isDeleted ? 'tf-pill--danger' : 'tf-pill--warn'}`}>
            <AlertTriangle size={10} aria-hidden="true" />
            {CHANGE_LABELS[changeKind] || 'Changed'}
          </span>
        ) : isImpacted ? (
          <span className="tf-pill tf-pill--warn">
            <GitCompare size={10} aria-hidden="true" />
            Affected{impactCount > 1 ? ` (${impactCount})` : ''}
          </span>
        ) : isSeed ? (
          <Badge variant="accent" size="xs" className="font-mono text-[9px] px-1.5 py-0">
            Seed
          </Badge>
        ) : null}
      </div>

      <div className="tf-node__title">{title}</div>
      <div className="tf-node__sub">{sub}</div>

      {hasMiniStats ? (
        <div className="tf-node__stats">
          {staleCount > 0 && (
            <span className="tf-stat tf-stat--warn" title={`${staleCount} stale`}>
              <AlertTriangle size={10} aria-hidden="true" /> {staleCount}
            </span>
          )}
          {candidateCount > 0 && (
            <span className="tf-stat" title={`${candidateCount} candidate`}>
              <Clock size={10} aria-hidden="true" /> {candidateCount}
            </span>
          )}
          {confirmedCount > 0 && (
            <span className="tf-stat tf-stat--ok" title={`${confirmedCount} confirmed`}>
              <CheckCircle2 size={10} aria-hidden="true" /> {confirmedCount}
            </span>
          )}
        </div>
      ) : statusDot ? (
        <div className="tf-node__stats">
          <span className={`status-dot ${statusDot}`} />
          <span>Active</span>
        </div>
      ) : null}

      <Handle type="source" position={Position.Right} className={`tf-handle ${isChanged || isImpacted ? 'is-warn' : ''}`} />
    </div>
  );
}

function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    offset: data?.offset ?? 20,
  });

  const shiftX = data?.labelShiftX || 0;
  const shiftY = data?.labelShiftY || 0;
  const showLabel = data?.showLabel !== false && Boolean(data?.displayLabel);

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            className={`tf-edge-label ${data?.tone ? `is-${data.tone}` : ''}`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX + shiftX}px, ${labelY + shiftY}px)`,
            }}
            title={data?.fullLabel || data?.displayLabel}
          >
            {data.displayLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = {
  artifact: ArtifactFlowNode
};

const edgeTypes = {
  relation: RelationEdge
};

function edgeVisual(edge) {
  const isStale = edge.kind === 'stale' || edge.impacted;
  if (isStale) {
    return {
      color: '#d97706',
      width: 2.4,
      animated: true,
      dasharray: '6 3',
      tone: 'warn',
      opacity: 1,
    };
  }
  if (edge.kind === 'candidate') {
    return {
      color: 'var(--amber, #b45309)',
      width: 1.8,
      animated: false,
      dasharray: '4 3',
      tone: 'candidate',
      opacity: 0.9,
    };
  }
  if (edge.kind === 'rejected' || edge.kind === 'retired') {
    return {
      color: 'var(--ink-3)',
      width: 1.4,
      animated: false,
      dasharray: '3 3',
      tone: 'muted',
      opacity: 0.68,
    };
  }
  return {
    color: edge.kind === 'decision' ? 'var(--ink)' : 'var(--accent)',
    width: 2.1,
    animated: false,
    dasharray: undefined,
    tone: 'confirmed',
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
      rfInstance.fitView({ padding: compact ? 0.1 : 0.14, maxZoom: 1.15 });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [rfInstance, layoutReady, compact]);

  // Compute ELK Layout (with widescreen multi-column tiling when node count > 14)
  useEffect(() => {
    let isCancelled = false;

    async function computeLayout() {
      const baseOptions = {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': compact ? '18' : '28',
        'elk.layered.spacing.nodeNodeBetweenLayers': compact ? '136' : '185',
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        'elk.layered.spacing.edgeNodeBetweenLayers': '26',
        'elk.aspectRatio': '1.85',
        'elk.separateConnectedComponents': 'true',
      };

      try {
        const layoutNodeMap = {};

        if (rawNodes.length <= 14) {
          const elkGraph = {
            id: 'root',
            layoutOptions: baseOptions,
            children: rawNodes.map(n => ({ id: n.id, width: 214, height: 74 })),
            edges: rawEdges.map((e, idx) => ({
              id: `e-${idx}-${e.from}-${e.to}`,
              sources: [e.from],
              targets: [e.to],
            })),
          };
          const layout = await elk.layout(elkGraph);
          if (isCancelled) return;
          layout.children?.forEach(c => {
            layoutNodeMap[c.id] = { x: c.x, y: c.y };
          });
        } else {
          // Partition into widescreen column clusters so bipartite graphs do not form a narrow 10,000px skyscraper
          const nodeIds = new Set(rawNodes.map(n => n.id));
          const outTargetsBySource = new Map();
          const hasIncoming = new Set();
          for (const e of rawEdges) {
            if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) continue;
            if (!outTargetsBySource.has(e.from)) outTargetsBySource.set(e.from, []);
            outTargetsBySource.get(e.from).push(e.to);
            hasIncoming.add(e.to);
          }

          const assigned = new Set();
          const clusters = [];
          const maxNodesPerCluster = 11;
          let currentCluster = new Set();

          const sources = rawNodes.filter(n => outTargetsBySource.has(n.id) || !hasIncoming.has(n.id));
          for (const src of sources) {
            if (assigned.has(src.id)) continue;
            const targets = (outTargetsBySource.get(src.id) || []).filter(tid => !assigned.has(tid));
            const groupIds = [src.id, ...targets.slice(0, maxNodesPerCluster - 1)];
            if (currentCluster.size > 0 && currentCluster.size + groupIds.length > maxNodesPerCluster) {
              clusters.push(currentCluster);
              currentCluster = new Set();
            }
            for (const gid of groupIds) {
              currentCluster.add(gid);
              assigned.add(gid);
            }
          }
          for (const n of rawNodes) {
            if (!assigned.has(n.id)) {
              if (currentCluster.size >= maxNodesPerCluster) {
                clusters.push(currentCluster);
                currentCluster = new Set();
              }
              currentCluster.add(n.id);
              assigned.add(n.id);
            }
          }
          if (currentCluster.size > 0) clusters.push(currentCluster);

          const colsPerRow = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(clusters.length * 1.6))));
          const colGapX = 640;
          const rowGapY = 90;
          let rowOffsetY = 0;

          for (let rStart = 0; rStart < clusters.length; rStart += colsPerRow) {
            const rowClusters = clusters.slice(rStart, rStart + colsPerRow);
            let maxRowHeight = 0;
            for (let cIdx = 0; cIdx < rowClusters.length; cIdx += 1) {
              const cSet = rowClusters[cIdx];
              const subNodes = rawNodes.filter(n => cSet.has(n.id)).map(n => ({ id: n.id, width: 214, height: 74 }));
              const subEdges = rawEdges
                .filter(e => cSet.has(e.from) && cSet.has(e.to))
                .map((e, idx) => ({
                  id: `sub-${rStart}-${cIdx}-${idx}`,
                  sources: [e.from],
                  targets: [e.to],
                }));
              const subLayout = await elk.layout({
                id: `cluster-${rStart}-${cIdx}`,
                layoutOptions: baseOptions,
                children: subNodes,
                edges: subEdges,
              });
              if (isCancelled) return;
              const offsetX = cIdx * colGapX;
              let clusterMaxY = 0;
              subLayout.children?.forEach(ch => {
                layoutNodeMap[ch.id] = { x: ch.x + offsetX, y: ch.y + rowOffsetY };
                clusterMaxY = Math.max(clusterMaxY, ch.y + (ch.height || 74));
              });
              maxRowHeight = Math.max(maxRowHeight, clusterMaxY);
            }
            rowOffsetY += maxRowHeight + rowGapY;
          }
        }

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

        // Map to XYFlow edges with staggered non-overlapping labels
        const pairCounts = new Map();
        for (const e of rawEdges) {
          const pk = `${e.from}::${e.to}`;
          pairCounts.set(pk, (pairCounts.get(pk) || 0) + 1);
        }
        const pairSeen = new Map();
        const denseGraph = rawEdges.length > 8;
        const flowEdges = rawEdges.map((e, idx) => {
          const visual = edgeVisual(e);
          const pk = `${e.from}::${e.to}`;
          const seenIdx = pairSeen.get(pk) || 0;
          pairSeen.set(pk, seenIdx + 1);
          const totalForPair = pairCounts.get(pk) || 1;
          const offset = totalForPair > 1 ? 18 + (seenIdx - (totalForPair - 1) / 2) * 26 : 20;
          const lane = (idx % 3) - 1;
          const shiftX = totalForPair > 1 ? lane * 26 : ((idx % 2 === 0 ? -1 : 1) * 18);
          const shiftY = totalForPair > 1 ? (seenIdx - (totalForPair - 1) / 2) * 20 : 0;
          const isImportant = e.impacted || e.kind === 'stale' || e.kind === 'confirmed';
          const shortType = typeof e.label === 'string' ? e.label.split(' · ')[0] : e.label;
          const displayLabel = denseGraph && !isImportant ? shortType : e.label;
          // In dense full-snapshot graphs (>8 links), reserve always-on labels for stale, confirmed, or impacted links;
          // 1-hop neighborhoods and small graphs display every link label without overlap.
          const showLabel = !denseGraph || isImportant;

          return {
            id: `flow-e-${idx}-${e.from}-${e.to}`,
            source: e.from,
            target: e.to,
            type: 'relation',
            data: {
              contextId: e.id,
              offset,
              labelShiftX: shiftX,
              labelShiftY: shiftY,
              displayLabel,
              fullLabel: e.label,
              showLabel,
              tone: visual.tone,
            },
            animated: visual.animated,
            style: {
              stroke: visual.color,
              strokeWidth: visual.width,
              strokeDasharray: visual.dasharray,
              opacity: visual.opacity,
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

  useEffect(() => {
    if (!rfInstance || !layoutReady || !nodes.length) return;
    const raf = requestAnimationFrame(() => {
      rfInstance.fitView({ padding: compact ? 0.1 : 0.14, maxZoom: 1.15 });
    });
    return () => cancelAnimationFrame(raf);
  }, [rfInstance, layoutReady, compact, nodes.length, edges.length, selectedArtifactId]);

  const handleNodeClick = (_, node) => {
    onSelectNode?.(node.id);
  };

  const containerHeight = height ?? (compact ? 560 : 740);
  const displayMiniMap = showMiniMap ?? (!compact || rawNodes.length > 16);

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
          edgeTypes={edgeTypes}
          onInit={setRfInstance}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onEdgeClick={(_, edge) => onSelectEdge?.(edge.data?.contextId)}
          fitView
          fitViewOptions={{ padding: compact ? 0.1 : 0.14, maxZoom: 1.15 }}
          minZoom={0.05}
          maxZoom={2.0}
        >
          <Background color={theme === 'dark' ? '#343b32' : '#d7d3c6'} gap={16} size={1} />
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
