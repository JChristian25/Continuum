import { useEffect, useId, useMemo, useRef, useState } from 'react';
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
import './service-graph.css';
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
  Clock,
  ArrowRight,
  ArrowDown,
  Maximize2,
  Tag,
  Map as MapIcon,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';

const elk = new ELK();

function prefersReducedMotion() {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const CHANGE_LABELS = {
  modified: 'Modified',
  added: 'Added',
  deleted: 'Removed',
  record_modified: 'Revised',
};

function ArtifactFlowNode({ data }) {
  const {
    title,
    sub,
    category,
    isSeed,
    isSelected,
    isActiveEndpoint,
    isNeighbor,
    isDimmed,
    direction = 'RIGHT',
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
  const targetPos = direction === 'DOWN' ? Position.Top : Position.Left;
  const sourcePos = direction === 'DOWN' ? Position.Bottom : Position.Right;

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

  const nodeStateClass = [
    isSelected ? 'is-selected' : '',
    !isSelected && isActiveEndpoint ? 'is-active-endpoint' : '',
    !isSelected && isDeleted ? 'is-deleted' : '',
    !isSelected && !isDeleted && isChanged ? 'is-changed' : '',
    !isSelected && !isDeleted && !isChanged && isImpacted ? 'is-impacted' : '',
    isNeighbor ? 'is-neighbor' : '',
    isDimmed ? 'is-dimmed' : '',
  ].filter(Boolean).join(' ');

  const hasMiniStats = staleCount > 0 || candidateCount > 0 || confirmedCount > 0;
  const nodeTooltip = [
    sub || title,
    changeKind ? `Change: ${CHANGE_LABELS[changeKind] || changeKind}` : null,
    isImpacted ? `Affected by revision change (${impactCount} link${impactCount === 1 ? '' : 's'})` : null,
    isSelected ? 'Focused 1-hop root (click another node to re-center)' : 'Click to focus 1-hop neighborhood',
  ].filter(Boolean).join(' · ');

  return (
    <div title={nodeTooltip} className={`tf-node ${nodeStateClass}`}>
      <Handle type="target" position={targetPos} className={`tf-handle ${isChanged || isImpacted ? 'is-warn' : ''}`} />

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
        ) : isSelected ? (
          <span className="tf-seed-badge">Focused</span>
        ) : isSeed ? (
          <span className="tf-seed-badge">Seed</span>
        ) : null}
      </div>

      <div className="tf-node__title">{title}</div>
      <div className="tf-node__sub">{sub}</div>

      {hasMiniStats ? (
        <div className="tf-node__stats">
          {staleCount > 0 && (
            <span className="tf-stat tf-stat--warn" title={`${staleCount} stale link${staleCount === 1 ? '' : 's'} needing revalidation`}>
              <AlertTriangle size={10} aria-hidden="true" /> {staleCount}
            </span>
          )}
          {confirmedCount > 0 && (
            <span className="tf-stat tf-stat--ok" title={`${confirmedCount} confirmed link${confirmedCount === 1 ? '' : 's'}`}>
              <CheckCircle2 size={10} aria-hidden="true" /> {confirmedCount}
            </span>
          )}
          {candidateCount > 0 && (
            <span className="tf-stat" title={`${candidateCount} unconfirmed candidate${candidateCount === 1 ? '' : 's'}`}>
              <Clock size={10} aria-hidden="true" /> {candidateCount}
            </span>
          )}
        </div>
      ) : statusDot ? (
        <div className="tf-node__stats">
          <span className={`status-dot ${statusDot}`} />
          <span>Active</span>
        </div>
      ) : null}

      <Handle type="source" position={sourcePos} className={`tf-handle ${isChanged || isImpacted ? 'is-warn' : ''}`} />
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
          <button
            type="button"
            className={`tf-edge-label ${data?.tone ? `is-${data.tone}` : ''} ${data?.isActive ? 'is-active' : ''}`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX + shiftX}px, ${labelY + shiftY}px)`,
            }}
            title={data?.fullLabel ? `${data.fullLabel} — click to inspect evidence` : data?.displayLabel}
            onClick={e => {
              e.stopPropagation();
              if (data?.contextId && data?.onSelectEdge) {
                data.onSelectEdge(data.contextId);
              }
            }}
          >
            <span>{data.displayLabel}</span>
            {data?.evidenceCount > 0 && (
              <span className="tf-edge-label__anchors" title={`${data.evidenceCount} recorded evidence anchor${data.evidenceCount === 1 ? '' : 's'}`}>
                {data.evidenceCount}
              </span>
            )}
          </button>
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

function edgeVisual(edge, isActive = false, isHovered = false, isDimmed = false) {
  const isStale = edge.kind === 'stale';
  const baseOpacity = isDimmed ? 0.22 : 1;
  if (isActive) {
    return {
      color: isStale || edge.kind === 'candidate' ? 'var(--amber, #b45309)' : 'var(--accent)',
      width: 3.0,
      animated: false,
      dasharray: isStale ? '6 3' : edge.kind === 'candidate' ? '4 3' : undefined,
      tone: edge.kind,
      opacity: 1,
    };
  }
  if (isStale) {
    return {
      color: '#d97706',
      width: isHovered ? 2.8 : 2.4,
      animated: false,
      dasharray: '6 3',
      tone: 'stale',
      opacity: baseOpacity,
    };
  }
  if (edge.kind === 'candidate') {
    return {
      color: 'var(--amber, #b45309)',
      width: isHovered ? 2.3 : 1.8,
      animated: false,
      dasharray: '4 3',
      tone: 'candidate',
      opacity: isDimmed ? 0.2 : 0.9,
    };
  }
  if (edge.kind === 'rejected' || edge.kind === 'retired') {
    return {
      color: 'var(--ink-3)',
      width: 1.4,
      animated: false,
      dasharray: '3 3',
      tone: 'rejected',
      opacity: isDimmed ? 0.16 : 0.68,
    };
  }
  return {
    color: edge.kind === 'decision' ? 'var(--ink)' : 'var(--accent)',
    width: isHovered ? 2.6 : 2.1,
    animated: false,
    dasharray: undefined,
    tone: 'confirmed',
    opacity: baseOpacity,
  };
}

export default function TraceabilityFlow({
  rawNodes = [],
  rawEdges = [],
  selectedArtifactId,
  activeEdgeId = null,
  onSelectNode,
  onSelectEdge,
  onResetFilters = null,
  compact = false,
  height,
  showMiniMap,
  theme = 'dark'
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [laidOutDirection, setLaidOutDirection] = useState(null);
  const layoutReady = laidOutDirection !== null;
  const [rfInstance, setRfInstance] = useState(null);
  const [direction, setDirection] = useState('RIGHT');
  const [showAllLabels, setShowAllLabels] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [hudOpen, setHudOpen] = useState(false);
  const [miniMapOpen, setMiniMapOpen] = useState(() => {
    if (typeof showMiniMap === 'boolean') return showMiniMap;
    if (typeof window !== 'undefined' && window.innerWidth < 640) return false;
    return !compact || rawNodes.length > 16;
  });
  const containerRef = useRef(null);
  const hudRef = useRef(null);
  const hudTriggerRef = useRef(null);
  const hasInitialFitRef = useRef(false);
  const hudPanelId = useId();

  useEffect(() => {
    if (!hudOpen) return;
    const handlePointerDown = event => {
      if (hudRef.current && !hudRef.current.contains(event.target)) {
        setHudOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [hudOpen]);

  const activeEdge = useMemo(
    () => (activeEdgeId ? rawEdges.find(e => e.id === activeEdgeId) || null : null),
    [rawEdges, activeEdgeId]
  );

  const hoveredNeighbors = useMemo(() => {
    if (!hoveredNodeId) return null;
    const set = new Set([hoveredNodeId]);
    for (const e of rawEdges) {
      if (e.from === hoveredNodeId) set.add(e.to);
      if (e.to === hoveredNodeId) set.add(e.from);
    }
    return set;
  }, [hoveredNodeId, rawEdges]);

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
      if (!rawNodes.length) {
        setNodes([]);
        setEdges([]);
        setLaidOutDirection(direction);
        return;
      }

      const isDown = direction === 'DOWN';
      const baseOptions = {
        'elk.algorithm': 'layered',
        'elk.direction': direction,
        'elk.spacing.nodeNode': isDown ? (compact ? '28' : '38') : (compact ? '20' : '28'),
        'elk.layered.spacing.nodeNodeBetweenLayers': isDown ? (compact ? '104' : '136') : (compact ? '142' : '185'),
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
            children: rawNodes.map(n => ({ id: n.id, width: 214, height: 76 })),
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
          const rowGapY = 96;
          let rowOffsetY = 0;

          for (let rStart = 0; rStart < clusters.length; rStart += colsPerRow) {
            const rowClusters = clusters.slice(rStart, rStart + colsPerRow);
            let maxRowHeight = 0;
            for (let cIdx = 0; cIdx < rowClusters.length; cIdx += 1) {
              const cSet = rowClusters[cIdx];
              const subNodes = rawNodes.filter(n => cSet.has(n.id)).map(n => ({ id: n.id, width: 214, height: 76 }));
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
                clusterMaxY = Math.max(clusterMaxY, ch.y + (ch.height || 76));
              });
              maxRowHeight = Math.max(maxRowHeight, clusterMaxY);
            }
            rowOffsetY += maxRowHeight + rowGapY;
          }
        }

        const flowNodes = rawNodes.map(n => {
          const pos = layoutNodeMap[n.id] || { x: n.x || 0, y: n.y || 0 };
          return {
            id: n.id,
            type: 'artifact',
            position: pos,
            data: {
              ...n,
              direction,
              isSelected: n.id === selectedArtifactId,
              isActiveEndpoint: Boolean(activeEdge && (activeEdge.from === n.id || activeEdge.to === n.id)),
              isNeighbor: false,
              isDimmed: false,
            }
          };
        });

        const pairCounts = new Map();
        for (const e of rawEdges) {
          const pk = `${e.from}::${e.to}`;
          pairCounts.set(pk, (pairCounts.get(pk) || 0) + 1);
        }
        const pairSeen = new Map();
        const denseGraph = rawEdges.length > 8;
        const flowEdges = rawEdges.map((e, idx) => {
          const isActive = Boolean(activeEdgeId && e.id === activeEdgeId);
          const visual = edgeVisual(e, isActive, false, false);
          const pk = `${e.from}::${e.to}`;
          const seenIdx = pairSeen.get(pk) || 0;
          pairSeen.set(pk, seenIdx + 1);
          const totalForPair = pairCounts.get(pk) || 1;
          const offset = totalForPair > 1 ? 18 + (seenIdx - (totalForPair - 1) / 2) * 26 : 20;
          const lane = (idx % 3) - 1;
          const shiftX = totalForPair > 1 ? lane * 26 : ((idx % 2 === 0 ? -1 : 1) * 18);
          const shiftY = totalForPair > 1 ? (seenIdx - (totalForPair - 1) / 2) * 20 : -13;
          const isImportant = isActive || e.impacted || e.kind === 'stale' || e.kind === 'confirmed';
          const shortType = typeof e.label === 'string' ? e.label.split(' · ')[0] : e.label;
          const displayLabel = denseGraph && !isImportant && !showAllLabels ? shortType : e.label;
          const showLabel = showAllLabels || !denseGraph || isImportant;

          return {
            id: `flow-e-${idx}-${e.from}-${e.to}`,
            source: e.from,
            target: e.to,
            type: 'relation',
            data: {
              contextId: e.id,
              rawEdge: e,
              offset,
              labelShiftX: shiftX,
              labelShiftY: shiftY,
              displayLabel,
              fullLabel: e.label,
              evidenceCount: e.evidenceCount || 0,
              showLabel,
              isActive,
              onSelectEdge,
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
        setLaidOutDirection(direction);
      } catch (err) {
        console.error('ELK layout computation error:', err);
      }
    }

    computeLayout();
    return () => { isCancelled = true; };
  }, [rawNodes, rawEdges, selectedArtifactId, activeEdgeId, activeEdge, direction, showAllLabels, compact, onSelectEdge, setNodes, setEdges]);

  // Synchronize hover, selection, and active-edge emphasis without re-running ELK layout
  useEffect(() => {
    setNodes(prev => prev.map(n => {
      const inHoverSet = hoveredNeighbors ? hoveredNeighbors.has(n.id) : true;
      return {
        ...n,
        data: {
          ...n.data,
          isSelected: n.id === selectedArtifactId,
          isActiveEndpoint: Boolean(activeEdge && (activeEdge.from === n.id || activeEdge.to === n.id)),
          isNeighbor: Boolean(hoveredNodeId && hoveredNodeId !== n.id && inHoverSet),
          isDimmed: Boolean(hoveredNodeId && !inHoverSet),
        }
      };
    }));

    const denseGraph = rawEdges.length > 8;
    setEdges(prev => prev.map(fe => {
      const raw = fe.data?.rawEdge;
      if (!raw) return fe;
      const isActive = Boolean(activeEdgeId && raw.id === activeEdgeId);
      const isHovered = Boolean(hoveredNodeId && (raw.from === hoveredNodeId || raw.to === hoveredNodeId));
      const isDimmed = Boolean(hoveredNodeId && !isHovered);
      const visual = edgeVisual(raw, isActive, isHovered, isDimmed);
      const isImportant = isActive || isHovered || raw.impacted || raw.kind === 'stale' || raw.kind === 'confirmed';
      const showLabel = showAllLabels || !denseGraph || isImportant;
      return {
        ...fe,
        animated: visual.animated,
        data: {
          ...fe.data,
          isActive,
          showLabel,
          tone: visual.tone,
        },
        style: {
          stroke: visual.color,
          strokeWidth: visual.width,
          strokeDasharray: visual.dasharray,
          opacity: visual.opacity,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: visual.color,
        },
      };
    }));
  }, [selectedArtifactId, activeEdgeId, activeEdge, hoveredNodeId, hoveredNeighbors, showAllLabels, rawEdges.length, setNodes, setEdges]);

  useEffect(() => {
    if (!rfInstance || !layoutReady || !nodes.length) return;
    const isInitial = !hasInitialFitRef.current;
    hasInitialFitRef.current = true;
    const duration = isInitial || prefersReducedMotion() ? 0 : 240;
    const raf = requestAnimationFrame(() => {
      rfInstance.fitView({ padding: compact ? 0.1 : 0.14, maxZoom: 1.15, duration });
    });
    return () => cancelAnimationFrame(raf);
  }, [rfInstance, layoutReady, compact, laidOutDirection, nodes.length, edges.length, selectedArtifactId]);

  const handleFitView = () => {
    rfInstance?.fitView({
      padding: compact ? 0.1 : 0.14,
      maxZoom: 1.15,
      duration: prefersReducedMotion() ? 0 : 260,
    });
  };

  const handleNodeClick = (_, node) => {
    onSelectNode?.(node.id);
  };

  const containerHeight = height ?? (compact ? 560 : 740);
  const hasActiveOption = direction === 'DOWN' || showAllLabels || miniMapOpen;

  return (
    <div
      ref={containerRef}
      className={`tf-container ${compact ? 'tf-container--compact' : ''}`}
      style={containerHeight ? { height: containerHeight } : undefined}
    >
      {!layoutReady ? (
        <div className="tf-loading-state" role="status">
          Computing graph layout…
        </div>
      ) : rawNodes.length === 0 ? (
        <div className="tf-empty-state" role="status">
          <strong>No artifacts or relationships in this graph filter</strong>
          <span>Adjust the validity or relationship type filter above to view captured connections.</span>
          {onResetFilters && (
            <button type="button" className="sg-pivot-btn" onClick={onResetFilters}>
              <RotateCcw size={12} aria-hidden="true" /> Reset graph filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            ref={hudRef}
            className={`tf-hud ${hudOpen ? 'is-open' : ''}`}
            role="group"
            aria-label="Graph canvas controls"
            onBlur={event => {
              if (hudOpen && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
                setHudOpen(false);
              }
            }}
            onKeyDown={event => {
              if (hudOpen && event.key === 'Escape') {
                event.stopPropagation();
                setHudOpen(false);
                hudTriggerRef.current?.focus();
              }
            }}
          >
            <div className="tf-hud-bar">
              <button
                type="button"
                className="tf-hud-btn"
                onClick={handleFitView}
                aria-label="Fit graph to canvas"
                title="Fit graph to viewport"
              >
                <Maximize2 size={12} aria-hidden="true" />
                <span>Fit</span>
              </button>
              <span className="tf-hud-divider" aria-hidden="true" />
              <button
                ref={hudTriggerRef}
                type="button"
                className={`tf-hud-btn tf-hud-trigger ${hudOpen ? 'is-active' : ''}`}
                onClick={() => setHudOpen(v => !v)}
                aria-expanded={hudOpen}
                aria-controls={hudPanelId}
                aria-label="View canvas options"
                title="Layout direction, edge labels, and minimap controls"
              >
                <SlidersHorizontal size={12} aria-hidden="true" />
                <span>View</span>
                {hasActiveOption && (
                  <span className="tf-hud-dot" aria-hidden="true" />
                )}
                <ChevronDown size={11} className="tf-hud-chevron" aria-hidden="true" />
              </button>
            </div>

            <div
              id={hudPanelId}
              className={`tf-hud-popover ${hudOpen ? 'is-open' : ''}`}
              inert={!hudOpen}
            >
              <div className="tf-hud-section">
                <span className="tf-hud-section-label">Layout</span>
                <div className="tf-hud-group tf-hud-segmented" role="group" aria-label="Layout direction">
                  <button
                    type="button"
                    className={`tf-hud-btn ${direction === 'RIGHT' ? 'is-active' : ''}`}
                    onClick={() => setDirection('RIGHT')}
                    aria-pressed={direction === 'RIGHT'}
                    aria-label="Across, horizontal graph layout"
                    title="Left-to-right layered flow"
                  >
                    <ArrowRight size={12} aria-hidden="true" />
                    <span>Across</span>
                  </button>
                  <button
                    type="button"
                    className={`tf-hud-btn ${direction === 'DOWN' ? 'is-active' : ''}`}
                    onClick={() => setDirection('DOWN')}
                    aria-pressed={direction === 'DOWN'}
                    aria-label="Down, vertical graph layout"
                    title="Top-to-bottom layered flow"
                  >
                    <ArrowDown size={12} aria-hidden="true" />
                    <span>Down</span>
                  </button>
                </div>
              </div>

              <div className="tf-hud-section">
                <span className="tf-hud-section-label">Display</span>
                <div className="tf-hud-group" role="group" aria-label="Canvas display toggles">
                  <button
                    type="button"
                    className={`tf-hud-btn ${showAllLabels ? 'is-active' : ''}`}
                    onClick={() => setShowAllLabels(v => !v)}
                    aria-pressed={showAllLabels}
                    title={showAllLabels ? 'Showing all link labels' : 'Showing key labels (click or hover for all)'}
                  >
                    <Tag size={12} aria-hidden="true" />
                    <span>All labels</span>
                  </button>
                  <button
                    type="button"
                    className={`tf-hud-btn ${miniMapOpen ? 'is-active' : ''}`}
                    onClick={() => setMiniMapOpen(v => !v)}
                    aria-pressed={miniMapOpen}
                    aria-label="Toggle minimap"
                    title="Toggle overview minimap"
                  >
                    <MapIcon size={12} aria-hidden="true" />
                    <span>Minimap</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onInit={setRfInstance}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
            onNodeMouseLeave={() => setHoveredNodeId(null)}
            onEdgeClick={(_, edge) => onSelectEdge?.(edge.data?.contextId)}
            fitView
            fitViewOptions={{ padding: compact ? 0.1 : 0.14, maxZoom: 1.15 }}
            minZoom={0.05}
            maxZoom={2.0}
          >
            <Background color={theme === 'dark' ? '#343b32' : '#d7d3c6'} gap={16} size={1} />
            <Controls showInteractive={false} showFitView={false} />
            {miniMapOpen && <MiniMap
              nodeColor={node => (node.data?.changeKind || node.data?.impactRole === 'impacted') ? '#d97706' : 'var(--accent)'}
              maskColor={theme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'}
            />}
          </ReactFlow>
        </>
      )}
    </div>
  );
}
