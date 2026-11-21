import React from 'react';
import { STAGE_PALETTES } from '../constants';
import { ThemeMode, WalkingEnginePivotOffsets } from '../types';
import {
  PUPPYT_NATIVE_CENTER_X,
  PUPPYT_NATIVE_FLOOR_Y,
  PUPPYT_NODE_TO_PIVOT_KEY,
  PUPPYT_STAGE_SCALE,
  PuppytRigGraph,
  parentOf,
  pos,
} from '../utils/puppyt-rig';

interface PuppytSkeletonProps {
  graph: PuppytRigGraph;
  visualFloorY: number;
  theme: ThemeMode;
  showPivots: boolean;
  showLabels: boolean;
  isPaused: boolean;
  draggingBoneKey: keyof WalkingEnginePivotOffsets | null;
  hoveredBoneKey: keyof WalkingEnginePivotOffsets | null;
  onAnchorMouseDown: (boneKey: keyof WalkingEnginePivotOffsets, clientX: number) => void;
  onAnchorHover: (boneKey: keyof WalkingEnginePivotOffsets | null) => void;
  skullOverrideUrl?: string | null;
  skullOverrideBox?: { x: number; y: number; w: number; h: number } | null;
}

const LABELED_NODES: Record<string, string> = {
  head: 'Head',
  neck: 'Neck',
  thorax: 'Collar · Thorax',
  pelvis: 'Pelvis',
  humerusL: 'L.Humerus',
  humerusR: 'R.Humerus',
  forearmL: 'L.Forearm',
  forearmR: 'R.Forearm',
  handL: 'L.Hand',
  handR: 'R.Hand',
  femurL: 'L.Femur',
  femurR: 'R.Femur',
  shinL: 'L.Tibia',
  shinR: 'R.Tibia',
  footL: 'L.Foot',
  footR: 'R.Foot',
};

export const PuppytSkeleton: React.FC<PuppytSkeletonProps> = ({
  graph,
  visualFloorY,
  theme,
  showPivots,
  showLabels,
  isPaused,
  draggingBoneKey,
  hoveredBoneKey,
  onAnchorMouseDown,
  onAnchorHover,
  skullOverrideUrl,
  skullOverrideBox,
}) => {
  const palette = STAGE_PALETTES[theme];
  const isLight = theme === 'light';
  const isPausedAndPivotsVisible = isPaused && showPivots;

  // Map native 2500x8742 coordinates centered at MX=1257 with floor at Y=7623 -> SVG viewBox
  const tx = -PUPPYT_NATIVE_CENTER_X * PUPPYT_STAGE_SCALE;
  const ty = visualFloorY - PUPPYT_NATIVE_FLOOR_Y * PUPPYT_STAGE_SCALE;

  const { nodes, by, pieces } = graph;

  return (
    <g transform={`translate(${tx}, ${ty}) scale(${PUPPYT_STAGE_SCALE})`}>
      {/* Green digital skeleton bone lines (subtle X-Ray rig layer matching Bitruvian.Human.Puppyt) */}
      {showPivots && (
        <g className="pointer-events-none" opacity={isLight ? 0.55 : 0.45}>
          {nodes.map((n) => {
            if (n.ghost) return null;
            const par = parentOf(n, by);
            const lines: React.ReactNode[] = [];
            if (par) {
              const a = pos(par, by);
              const b = pos(n, by);
              lines.push(
                <line
                  key={`seg-${n.id}`}
                  x1={a[0]}
                  y1={a[1]}
                  x2={b[0]}
                  y2={b[1]}
                  stroke={palette.greenFlourish}
                  strokeWidth={10}
                  strokeLinecap="round"
                />
              );
            }
            if (n.bar && by[n.bar[0]] && by[n.bar[1]]) {
              const a = pos(by[n.bar[0]], by);
              const b = pos(by[n.bar[1]], by);
              lines.push(
                <line
                  key={`bar-${n.id}`}
                  x1={a[0]}
                  y1={a[1]}
                  x2={b[0]}
                  y2={b[1]}
                  stroke={palette.greenFlourish}
                  strokeWidth={10}
                  strokeLinecap="round"
                />
              );
            }
            return lines;
          })}
        </g>
      )}

      {/* Authentic PNG skeletal sprite layers sorted in exact painter order */}
      <g>
        {pieces.map((p, idx) => {
          const n = p.node;
          if (!n || !p.src) return null;
          const w = n.w;
          const isHeadFront = n.id === 'head' && p.name === 'Front';
          const href = isHeadFront && skullOverrideUrl ? skullOverrideUrl : p.oliveSrc || p.src;
          const box = isHeadFront && skullOverrideBox ? skullOverrideBox : p;

          return (
            <g
              key={`${n.id}-${p.i}-${idx}`}
              transform={`matrix(${w[0]} ${w[1]} ${w[2]} ${w[3]} ${w[4]} ${w[5]})`}
            >
              <image href={href} x={box.x} y={box.y} width={box.w} height={box.h} />
            </g>
          );
        })}
      </g>

      {/* Olive Collar Parent Ring Highlight around Neckring / Shoulder Girdle */}
      {by.thorax && (
        <g
          transform={`matrix(${by.thorax.w[0]} ${by.thorax.w[1]} ${by.thorax.w[2]} ${by.thorax.w[3]} ${by.thorax.w[4]} ${by.thorax.w[5]})`}
          className="pointer-events-none"
        >
          <ellipse
            cx={1257.5}
            cy={1271.5}
            rx={250}
            ry={175}
            fill="none"
            stroke={palette.oliveCollarFill}
            strokeWidth={14}
            opacity={0.42}
          />
        </g>
      )}

      {/* Red Dot Anchors & Technical Labels */}
      {showPivots &&
        nodes.map((n) => {
          if (n.ghost || n.lock) return null;
          const p = pos(n, by);
          const pivotKey = PUPPYT_NODE_TO_PIVOT_KEY[n.id];
          const isDragging = pivotKey && draggingBoneKey === pivotKey;
          const isHovered = pivotKey && hoveredBoneKey === pivotKey;
          const r = isDragging ? 30 : isHovered ? 26 : 22;

          return (
            <g key={`anchor-${n.id}`} data-no-export="true">
              {(isHovered || isDragging) && (
                <circle
                  cx={p[0]}
                  cy={p[1]}
                  r={r + 16}
                  fill="none"
                  stroke={isDragging ? palette.greenFlourish : palette.purpleFlourish}
                  strokeWidth={7}
                  opacity={0.9}
                />
              )}
              <circle
                cx={p[0]}
                cy={p[1]}
                r={r}
                fill={palette.anchorRed}
                stroke={palette.anchorRing}
                strokeWidth={6}
                className={
                  isPausedAndPivotsVisible && pivotKey
                    ? isDragging
                      ? 'cursor-grabbing'
                      : 'cursor-grab'
                    : 'cursor-default'
                }
                onMouseEnter={() => pivotKey && onAnchorHover(pivotKey)}
                onMouseLeave={() => onAnchorHover(null)}
                onMouseDown={(e) => {
                  if (isPausedAndPivotsVisible && pivotKey) {
                    e.stopPropagation();
                    onAnchorMouseDown(pivotKey, e.clientX);
                  }
                }}
              />
              {showLabels && LABELED_NODES[n.id] && (
                <text
                  x={p[0] + 42}
                  y={p[1] + 10}
                  fill={palette.labelFill}
                  fontSize="30"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="700"
                  opacity={0.85}
                  className="select-none pointer-events-none uppercase"
                  data-is-label="true"
                >
                  {LABELED_NODES[n.id]}
                </text>
              )}
            </g>
          );
        })}
    </g>
  );
};
