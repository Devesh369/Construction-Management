import React, { useId } from 'react';

export const Sparkline = ({
  data = [12, 19, 14, 25, 22, 30, 28],
  color = '#93c5fd',
  width = 120,
  height = 40,
  strokeWidth = 2,
  className = '',
}) => {
  const gradientId = useId();
  const strokeGradientId = useId();

  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 6;
  const availableHeight = height - padding * 2;
  const availableWidth = width - padding * 2;

  // Generate coordinates
  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * availableWidth;
    const y = height - padding - ((val - min) / range) * availableHeight;
    return { x, y };
  });

  // Build cubic bezier curve string
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const cpX1 = curr.x + (next.x - curr.x) / 2;
    const cpY1 = curr.y;
    const cpX2 = curr.x + (next.x - curr.x) / 2;
    const cpY2 = next.y;
    pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
  }

  // Area fill closed path
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  const lastPoint = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`overflow-visible ${className}`}
    >
      <defs>
        {/* Fill Area Gradient */}
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>

        {/* Stroke Gradient */}
        <linearGradient id={strokeGradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path d={areaD} fill={`url(#${gradientId})`} />

      {/* Animated Stroke line */}
      <path
        d={pathD}
        fill="none"
        stroke={`url(#${strokeGradientId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-sparkline"
      />

      {/* Pulsing glow dot at final coordinate */}
      {lastPoint && (
        <g transform={`translate(${lastPoint.x}, ${lastPoint.y})`}>
          <circle
            r="6"
            fill={color}
            opacity="0.5"
            className="animate-ping"
            style={{ transformOrigin: 'center' }}
          />
          <circle r="3" fill={color} stroke="#ffffff" strokeWidth="1" />
        </g>
      )}
    </svg>
  );
};
