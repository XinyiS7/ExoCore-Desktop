import { useId } from 'react';
import { fontSizeForDieLabel, type DieFaces } from './diceTypes';

interface DiePalette {
  light: string;
  mid: string;
  dark: string;
  stroke: string;
  ink: string;
}

const DIE_PALETTES: Record<DieFaces, DiePalette> = {
  20: {
    light: '#ffc456',
    mid: '#df7818',
    dark: '#8d3906',
    stroke: '#ffe3a8',
    ink: '#fffaf0',
  },
  100: {
    light: '#5a5f78',
    mid: '#31354a',
    dark: '#191b28',
    stroke: '#e8c474',
    ink: '#f8e5b2',
  },
  12: {
    light: '#f0829e',
    mid: '#be3b62',
    dark: '#751c39',
    stroke: '#ffd0de',
    ink: '#fff7f9',
  },
  10: {
    light: '#b490f5',
    mid: '#754cc7',
    dark: '#432583',
    stroke: '#e3d4ff',
    ink: '#faf7ff',
  },
  8: {
    light: '#64cfe8',
    mid: '#238ba8',
    dark: '#125369',
    stroke: '#c7f4ff',
    ink: '#f2fcff',
  },
  6: {
    light: '#76b5ff',
    mid: '#2f6ec4',
    dark: '#18407a',
    stroke: '#cfe4ff',
    ink: '#f4f9ff',
  },
  4: {
    light: '#6fd89c',
    mid: '#27915c',
    dark: '#125937',
    stroke: '#caf7dc',
    ink: '#f2fff7',
  },
};

export interface DieSvgProps {
  faces: DieFaces;
  label: string | number;
  size?: number;
  angleRad?: number;
  highlight?: 'crit' | 'fumble' | null;
  className?: string;
}

function renderDieGeometry(faces: DieFaces, gradId: string, stroke: string) {
  switch (faces) {
    case 4:
      return (
        <>
          <polygon
            points="24,4 44,40 4,40"
            fill={`url(#${gradId})`}
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <polyline
            points="24,4 24,28 4,40 24,28 44,40"
            fill="none"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="1"
          />
        </>
      );
    case 6:
      return (
        <>
          <rect
            x="6"
            y="6"
            width="36"
            height="36"
            rx="7"
            fill={`url(#${gradId})`}
            stroke={stroke}
            strokeWidth="1.6"
          />
          <polygon
            points="12,12 36,12 34,34 14,34"
            fill="rgba(255,255,255,0.12)"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="0.9"
          />
        </>
      );
    case 8:
      return (
        <>
          <polygon
            points="24,3 44,24 24,45 4,24"
            fill={`url(#${gradId})`}
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <polygon
            points="24,10 37,24 24,38 11,24"
            fill="rgba(255,255,255,0.14)"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="0.9"
          />
        </>
      );
    case 10:
    case 100:
      return (
        <>
          <polygon
            points="24,3 43,21 24,45 5,21"
            fill={`url(#${gradId})`}
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <polyline
            points="5,21 24,16 43,21 24,32 5,21"
            fill="none"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="0.95"
          />
        </>
      );
    case 12:
      return (
        <>
          <polygon
            points="24,4 43,18 36,41 12,41 5,18"
            fill={`url(#${gradId})`}
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <polygon
            points="24,11 36,20 31,34 17,34 12,20"
            fill="rgba(255,255,255,0.12)"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="0.9"
          />
        </>
      );
    case 20:
      return (
        <>
          <polygon
            points="24,3 42,13.5 42,34.5 24,45 6,34.5 6,13.5"
            fill={`url(#${gradId})`}
            stroke={stroke}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <polygon
            points="24,10 36,31 12,31"
            fill="rgba(255,255,255,0.14)"
            stroke="rgba(255,255,255,0.34)"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <polyline
            points="24,3 24,10 M42,13.5 36,31 M6,13.5 12,31 M24,45 12,31 M24,45 36,31"
            fill="none"
            stroke="rgba(255,255,255,0.24)"
            strokeWidth="0.85"
          />
        </>
      );
  }
}

export function DieSvg({ faces, label, size = 40, angleRad = 0, highlight = null, className = '' }: DieSvgProps) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const gradId = `${uid}-die-grad`;
  const palette = DIE_PALETTES[faces];
  const textStr = String(label);
  const fontSize = fontSizeForDieLabel(textStr);
  const textY = faces === 4 ? 30 : 25.5;

  return (
    <svg
      className={`app-toy-die-svg${highlight ? ` app-toy-die-svg--${highlight}` : ''}${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      style={angleRad !== 0 ? { transform: `rotate(${angleRad}rad)` } : undefined}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="15%" y1="10%" x2="85%" y2="90%">
          <stop offset="0%" stopColor={palette.light} />
          <stop offset="52%" stopColor={palette.mid} />
          <stop offset="100%" stopColor={palette.dark} />
        </linearGradient>
      </defs>
      {renderDieGeometry(faces, gradId, palette.stroke)}
      <text
        x="24"
        y={textY}
        textAnchor="middle"
        dominantBaseline="central"
        fill={palette.ink}
        stroke="rgba(0, 0, 0, 0.55)"
        strokeWidth="2.4"
        paintOrder="stroke"
        fontSize={fontSize}
        fontWeight="700"
      >
        {label}
      </text>
    </svg>
  );
}
