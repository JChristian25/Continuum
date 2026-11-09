import { Arc } from '@visx/shape';

export default function TruckFactorVisxGauge({
  pct = 50,
  label = 'Truck Factor',
  statusColor = 'var(--accent)'
}) {
  const width = 120;
  const height = 75;
  const radius = 50;
  const strokeWidth = 8;

  // Map 0 - 100% to -Math.PI / 2 to Math.PI / 2
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (pct / 100) * Math.PI;
  const maxAngle = Math.PI / 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <g transform={`translate(${width / 2}, ${height - 10})`}>
          {/* Background track arc */}
          <Arc
            innerRadius={radius - strokeWidth}
            outerRadius={radius}
            startAngle={startAngle}
            endAngle={maxAngle}
            fill="var(--ground-sunken)"
          />

          {/* Active value arc */}
          <Arc
            innerRadius={radius - strokeWidth}
            outerRadius={radius}
            startAngle={startAngle}
            endAngle={endAngle}
            fill={statusColor}
          />

          {/* Safe threshold marker at 50% (angle = 0) */}
          <line
            x1="0"
            y1={-(radius - strokeWidth - 2)}
            x2="0"
            y2={-(radius + 2)}
            stroke="var(--ink-2)"
            strokeWidth="1.5"
            strokeDasharray="2 1"
          />

          {/* Center value text */}
          <text
            y="-10"
            textAnchor="middle"
            fontSize="16"
            fontWeight="800"
            fontFamily="var(--font-mono)"
            fill="var(--ink)"
          >
            {pct}%
          </text>
        </g>
      </svg>
      <span style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: -4 }}>{label}</span>
    </div>
  );
}
