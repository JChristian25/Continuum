import { useMemo } from 'react';
import { scaleLinear } from '@visx/scale';

export default function CoverageVisxSpectrum({
  items = [],
  filter = 'all',
  onSelectFilter
}) {
  const counts = useMemo(() => {
    const acc = {
      reviewed: 0,
      attention: 0,
      candidate: 0,
      no_link: 0,
      unknown: 0
    };
    items.forEach(it => {
      const cond = it?.coverageCondition || it?.condition;
      if (cond && acc[cond] !== undefined) {
        acc[cond]++;
      }
    });
    return acc;
  }, [items]);

  const total = items.length || 6;

  // Segment metadata with resilient colors
  const segments = [
    { key: 'reviewed', label: 'Reviewed Support', count: counts.reviewed, color: 'var(--green, #15803D)' },
    { key: 'attention', label: 'Needs Attention', count: counts.attention, color: 'var(--amber, #B45309)' },
    { key: 'candidate', label: 'Semantic Candidate', count: counts.candidate, color: 'var(--indigo, #4338CA)' },
    { key: 'no_link', label: 'No Known Doc', count: counts.no_link, color: 'var(--red, #B91C1C)' },
    { key: 'unknown', label: 'Boundary Disclosed', count: counts.unknown, color: 'var(--neutral, #52646A)' }
  ];

  // Width and scales
  const barWidth = 600;
  const barHeight = 18;
  const xScale = scaleLinear({
    domain: [0, total],
    range: [0, barWidth]
  });

  // Calculate cumulative offsets
  let cumulative = 0;
  const positionedSegments = segments.map(seg => {
    const x0 = xScale(cumulative);
    const x1 = xScale(cumulative + seg.count);
    const width = Math.max(0, x1 - x0);
    cumulative += seg.count;
    return {
      ...seg,
      x: x0,
      width,
      pct: total > 0 ? ((seg.count / total) * 100).toFixed(1) : 0
    };
  });

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${barWidth} ${barHeight + 24}`}
        style={{ width: '100%', height: 'auto', display: 'block', minWidth: 320 }}
      >
        <defs>
          <clipPath id="spectrum-clip">
            <rect x="0" y="0" width={barWidth} height={barHeight} rx="8" ry="8" />
          </clipPath>
        </defs>

        {/* Background track */}
        <rect
          x="0"
          y="0"
          width={barWidth}
          height={barHeight}
          rx="8"
          fill="var(--ground-sunken)"
          stroke="var(--border)"
          strokeWidth="1"
        />

        {/* Clipped segments */}
        <g clipPath="url(#spectrum-clip)">
          {positionedSegments.map((seg) => {
            const isSelected = filter === seg.key;
            return (
              <rect
                key={seg.key}
                x={seg.x}
                y="0"
                width={seg.width}
                height={barHeight}
                fill={seg.color}
                opacity={filter === 'all' || isSelected ? 1 : 0.35}
                style={{ cursor: 'pointer', transition: 'opacity 0.2s ease' }}
                onClick={() => onSelectFilter?.(seg.key)}
              >
                <title>{`${seg.label}: ${seg.count} unit(s) (${seg.pct}%)`}</title>
              </rect>
            );
          })}
        </g>

        {/* Ticks and Scale axis */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const x = ratio * barWidth;
          return (
            <g key={ratio} transform={`translate(${x}, ${barHeight + 6})`}>
              <line y1="0" y2="4" stroke="var(--ink-3)" strokeWidth="1" />
              <text
                y="14"
                textAnchor={ratio === 0 ? 'start' : ratio === 1 ? 'end' : 'middle'}
                fontSize="9.5"
                fontFamily="var(--font-mono)"
                fill="var(--ink-3)"
              >
                {Math.round(ratio * 100)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
