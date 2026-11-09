import { useEffect, useState } from 'react';
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
import { FileCode2, FileText, CheckCircle2, GitCommit, Sparkles } from 'lucide-react';
import { Badge } from './ui/index.js';

const elk = new ELK();

// Custom Node for XYFlow
function ArtifactFlowNode({ data }) {
  const { title, sub, category, isSeed, isSelected, statusDot } = data;

  const getIcon = () => {
    switch (category) {
      case 'code':
      case 'Code Elements':
        return <FileCode2 size={13} color="var(--accent)" />;
      case 'requirement':
      case 'Requirements':
        return <FileText size={13} color="var(--ink-2)" />;
      case 'decision':
      case 'Decisions':
        return <GitCommit size={13} color="var(--accent)" />;
      case 'test':
        return <CheckCircle2 size={13} color="var(--green)" />;
      default:
        return <Sparkles size={13} color="var(--ink-2)" />;
    }
  };

  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 'var(--r-md)',
        background: isSelected ? 'var(--accent-tint)' : 'var(--ground-card)',
        border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
        boxShadow: isSelected ? '0 0 0 2px var(--accent-tint)' : 'none',
        width: 220,
        cursor: 'pointer',
        transition: 'background-color 0.15s ease, border-color 0.15s ease',
        fontFamily: 'inherit'
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: 'var(--accent)', width: 8, height: 8 }} />
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {getIcon()}
          <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase' }}>
            {category || 'Artifact'}
          </span>
        </div>
        {isSeed && (
          <Badge variant="accent" size="xs" className="font-mono text-[9px] px-1.5 py-0">
            Seed
          </Badge>
        )}
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {title}
      </div>

      <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {sub}
      </div>

      {statusDot && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 10.5, color: 'var(--ink-3)' }}>
          <span className={`status-dot ${statusDot}`} />
          <span>Status Active</span>
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: 'var(--accent)', width: 8, height: 8 }} />
    </div>
  );
}

const nodeTypes = {
  artifact: ArtifactFlowNode
};

export default function TraceabilityFlow({
  rawNodes = [],
  rawEdges = [],
  selectedArtifactId,
  onSelectNode,
  theme = 'dark'
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [layoutReady, setLayoutReady] = useState(false);

  // Compute ELK Layout
  useEffect(() => {
    let isCancelled = false;

    async function computeLayout() {
      const elkNodes = rawNodes.map(n => ({
        id: n.id,
        width: 230,
        height: 80
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
          'elk.spacing.nodeNode': '95',
          'elk.layered.spacing.nodeNodeBetweenLayers': '220',
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

        // Map to XYFlow edges
        const flowEdges = rawEdges.map((e, idx) => ({
          id: `flow-e-${idx}-${e.from}-${e.to}`,
          source: e.from,
          target: e.to,
          label: e.label,
          type: 'smoothstep',
          animated: e.kind === 'candidate',
          style: {
            stroke: e.kind === 'candidate' ? 'var(--amber)' : (e.kind === 'decision' ? 'var(--ink)' : 'var(--accent)'),
            strokeWidth: 2
          },
          labelStyle: {
            fill: 'var(--ink-2)',
            fontSize: 10,
            fontFamily: 'var(--font-mono)'
          },
          labelBgStyle: {
            fill: 'var(--ground-card)',
            stroke: 'var(--border)'
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: e.kind === 'candidate' ? 'var(--amber)' : (e.kind === 'decision' ? 'var(--ink)' : 'var(--accent)')
          }
        }));

        setNodes(flowNodes);
        setEdges(flowEdges);
        setLayoutReady(true);
      } catch (err) {
        console.error('ELK layout computation error:', err);
      }
    }

    computeLayout();
    return () => { isCancelled = true; };
  }, [rawNodes, rawEdges, selectedArtifactId, setNodes, setEdges]);

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

  return (
    <div style={{ width: '100%', height: 740, borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--border)', position: 'relative' }}>
      {!layoutReady ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-2)', fontSize: 13 }}>
          Computing automated hierarchical DAG layout with ELK…
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2.0}
        >
          <Background color={theme === 'dark' ? '#334155' : '#CBD5E1'} gap={16} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={() => 'var(--accent)'}
            maskColor={theme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'}
          />
        </ReactFlow>
      )}
    </div>
  );
}
