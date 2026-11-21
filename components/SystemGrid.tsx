import React from 'react';
import { ModelVersion, PerspectiveState, ThemeMode, Vector2D } from '../types';
import { ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT, GROUND_STRIP_HEIGHT_RAW_H_UNIT, STAGE_PALETTES } from '../constants';

interface AdvancedGridProps {
  origin: Vector2D;
  gridSize: number;
  viewBox: { x: number; y: number; width: number; height: number };
}

interface SystemGuidesProps {
  floorY: number;
  baseUnitH: number;
  theme: ThemeMode;
  modelVersion: ModelVersion;
  lPlanted?: boolean;
  rPlanted?: boolean;
  lFootX?: number;
  rFootX?: number;
  lWeight?: number;
  rWeight?: number;
  lRoadOffsetY?: number;
  rRoadOffsetY?: number;
  focalX?: number;
  perspective?: PerspectiveState;
  onPerspMouseDown?: (target: 'vp' | 'horizon', e: React.MouseEvent) => void;
  draggingPersp?: 'vp' | 'horizon' | null;
}

export const Scanlines: React.FC = () => (
  <svg width="100%" height="100%" className="absolute inset-0 z-10 pointer-events-none opacity-20">
    <defs>
      <pattern id="scanlines" patternUnits="userSpaceOnUse" width="1" height="4">
        <line x1="0" y1="1" x2="1" y2="1" stroke="#E5E7EB" strokeWidth="1" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#scanlines)" />
  </svg>
);

export const AdvancedGrid: React.FC<AdvancedGridProps> = ({ origin, gridSize, viewBox }) => {
  if (gridSize <= 0) return null;

  const lines: React.ReactNode[] = [];
  const minorGridSize = gridSize / 4;

  const startX = Math.floor((viewBox.x - origin.x) / minorGridSize) * minorGridSize + origin.x;
  const endX = viewBox.x + viewBox.width;
  for (let x = startX; x <= endX; x += minorGridSize) {
    const isMajor = Math.abs(Math.round((x - origin.x) / minorGridSize)) % 4 === 0;
    lines.push(
      <line
        key={`v-${x}`}
        x1={x}
        y1={viewBox.y}
        x2={x}
        y2={viewBox.y + viewBox.height}
        stroke={isMajor ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
        strokeWidth={isMajor ? 1 : 0.5}
      />
    );
  }

  const startY = Math.floor((viewBox.y - origin.y) / minorGridSize) * minorGridSize + origin.y;
  const endY = viewBox.y + viewBox.height;
  for (let y = startY; y <= endY; y += minorGridSize) {
    const isMajor = Math.abs(Math.round((y - origin.y) / minorGridSize)) % 4 === 0;
    lines.push(
      <line
        key={`h-${y}`}
        x1={viewBox.x}
        y1={y}
        x2={viewBox.x + viewBox.width}
        y2={y}
        stroke={isMajor ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
        strokeWidth={isMajor ? 1 : 0.5}
      />
    );
  }

  return <g className="pointer-events-none">{lines}</g>;
};

export const SystemGuides: React.FC<SystemGuidesProps> = ({
  floorY,
  baseUnitH,
  theme,
  modelVersion,
  lPlanted = false,
  rPlanted = false,
  lFootX = 52,
  rFootX = -52,
  lWeight = 0.5,
  rWeight = 0.5,
  lRoadOffsetY = 0,
  rRoadOffsetY = 0,
  focalX = 0,
  perspective,
  onPerspMouseDown,
  draggingPersp = null,
}) => {
  const palette = STAGE_PALETTES[theme];
  const isLightCore = theme === 'light' && modelVersion === 'core';
  const span = 20000;

  const groundStripWidth = ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.FOOT * baseUnitH * 6.5;
  const groundStripX = -groundStripWidth / 2;

  // 1-point Perspective Grid Geometry (ported from Bitruvian.Human.Puppyt canvasRenderer)
  const perspOn = !!perspective?.enabled;
  const vx = perspective?.vpX ?? 0;
  const vy = perspective?.horizonY ?? -533;
  const dHG = floorY - vy;
  const safeHG = Math.abs(dHG) < 18 ? (dHG >= 0 ? 18 : -18) : dHG;
  const cell = 115;
  const raysN = 6;
  const halfSpan = raysN * cell;
  const kSteps = [-0.36, -0.18, 0.35, 0.85, 1.65, 2.8, 4.5, 7.5];

  return (
    <g className="system-guides-group">
      {/* 1-Point Perspective Floor Rays & Depth Transversals */}
      {perspOn && (
        <g className="pointer-events-none">
          {Array.from({ length: raysN * 2 + 1 }, (_, idx) => idx - raysN).map((i) => {
            const gx = focalX + i * cell;
            const dx = gx - vx;
            const tEnd = 2.6;
            const ex = vx + dx * tEnd;
            const ey = vy + safeHG * tEnd;
            const isCoreRay = Math.abs(i) <= 1;
            return (
              <line
                key={`p-ray-${i}`}
                x1={vx}
                y1={vy}
                x2={ex}
                y2={ey}
                stroke={palette.purpleFlourish}
                strokeWidth={isCoreRay ? 2.2 : 1.4}
                opacity={isCoreRay ? 0.24 : 0.12}
              />
            );
          })}

          {kSteps.map((k) => {
            const yk = vy + safeHG / (1 + k * 0.55);
            const scale = (yk - vy) / safeHG;
            if (scale <= 0.03) return null;
            const xl = vx + (focalX - halfSpan - vx) * scale;
            const xr = vx + (focalX + halfSpan - vx) * scale;
            return (
              <line
                key={`p-tr-${k}`}
                x1={xl}
                y1={yk}
                x2={xr}
                y2={yk}
                stroke={palette.purpleFlourish}
                strokeWidth={1.4}
                opacity={k < 0 ? 0.16 : 0.2 / (1 + k * 0.22)}
              />
            );
          })}

          {/* Skeleton Plumb -> Ground Anchor -> Vanishing Point Sightline */}
          <polyline
            points={`${focalX},140 ${focalX},${floorY} ${vx},${vy}`}
            fill="none"
            stroke={palette.purpleFlourish}
            strokeWidth={1.6}
            strokeDasharray="6 8"
            opacity={0.28}
          />
        </g>
      )}

      {/* Center X-axis guide */}
      <line
        x1={-span}
        y1="0"
        x2={span}
        y2="0"
        stroke={isLightCore ? palette.greenFlourish : palette.guideStroke}
        strokeWidth={1}
        opacity={isLightCore ? 0.14 : 0.22}
        strokeDasharray="10 8"
        className="pointer-events-none"
      />
      {/* Center Y-axis plumb line */}
      <line
        x1="0"
        y1={-span}
        x2="0"
        y2={span}
        stroke={isLightCore ? palette.purpleFlourish : palette.guideStroke}
        strokeWidth={1.1}
        opacity={isLightCore ? 0.18 : 0.24}
        strokeDasharray="10 8"
        className="pointer-events-none"
      />

      {/* Interactive Perspective Horizon & Vanishing Point Handle */}
      {perspOn && (
        <g data-no-export="true">
          <line
            x1={-span}
            y1={vy}
            x2={span}
            y2={vy}
            stroke={palette.purpleFlourish}
            strokeWidth={draggingPersp === 'horizon' ? 3.2 : 2}
            strokeDasharray="12 9"
            opacity={draggingPersp === 'horizon' ? 0.72 : 0.34}
            className={onPerspMouseDown ? 'cursor-ns-resize' : 'pointer-events-none'}
            onMouseDown={(e) => {
              if (!onPerspMouseDown) return;
              e.stopPropagation();
              onPerspMouseDown('horizon', e);
            }}
          />
          <text
            x={-440}
            y={vy - 12}
            fill={palette.purpleFlourish}
            fontSize="20"
            fontFamily="JetBrains Mono, monospace"
            fontWeight="700"
            opacity={0.55}
            className="select-none pointer-events-none uppercase"
          >
            Horizon
          </text>
          <g
            className={onPerspMouseDown ? 'cursor-move' : 'pointer-events-none'}
            onMouseDown={(e) => {
              if (!onPerspMouseDown) return;
              e.stopPropagation();
              onPerspMouseDown('vp', e);
            }}
          >
            <circle
              cx={vx}
              cy={vy}
              r={draggingPersp === 'vp' ? 18 : 13}
              fill="none"
              stroke={palette.purpleFlourish}
              strokeWidth={2.5}
              opacity={0.65}
            />
            <circle cx={vx} cy={vy} r={5.5} fill={palette.purpleFlourish} opacity={0.9} />
            <text
              x={vx + 18}
              y={vy + 6}
              fill={palette.purpleFlourish}
              fontSize="20"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="700"
              opacity={0.68}
              className="select-none pointer-events-none uppercase"
            >
              VP
            </text>
          </g>
        </g>
      )}

      {/* Floor guide line and subtle ground strip */}
      <g className="pointer-events-none">
        <line
          x1={-span}
          y1={floorY}
          x2={span}
          y2={floorY}
          stroke={isLightCore ? palette.greenFlourish : palette.groundLineStroke}
          strokeWidth={isLightCore ? 1.8 : 1}
          opacity={isLightCore ? 0.55 : 0.7}
        />
        <rect
          x={groundStripX}
          y={floorY}
          width={groundStripWidth}
          height={GROUND_STRIP_HEIGHT_RAW_H_UNIT * baseUnitH}
          fill={palette.groundStripFill}
          opacity="0.7"
        />

        {/* Individual Weight-Responsive Foot Contact Ellipses & Road Hitch Relief Markers */}
        {(lPlanted || lWeight > 0.12) && (
          <g>
            <ellipse
              cx={lFootX}
              cy={floorY + lRoadOffsetY + 3}
              rx={28 + lWeight * 46}
              ry={6 + lWeight * 6}
              fill={palette.greenFlourish}
              opacity={(lPlanted ? 0.18 : 0.06) + lWeight * 0.28}
            />
            {Math.abs(lRoadOffsetY) > 1.5 && (
              <path
                d={`M ${lFootX - 75} ${floorY} Q ${lFootX} ${floorY + lRoadOffsetY * 1.45} ${lFootX + 75} ${floorY}`}
                fill="none"
                stroke={palette.purpleFlourish}
                strokeWidth={2.2}
                opacity={0.55}
              />
            )}
          </g>
        )}
        {(rPlanted || rWeight > 0.12) && (
          <g>
            <ellipse
              cx={rFootX}
              cy={floorY + rRoadOffsetY + 3}
              rx={28 + rWeight * 46}
              ry={6 + rWeight * 6}
              fill={palette.greenFlourish}
              opacity={(rPlanted ? 0.18 : 0.06) + rWeight * 0.28}
            />
            {Math.abs(rRoadOffsetY) > 1.5 && (
              <path
                d={`M ${rFootX - 75} ${floorY} Q ${rFootX} ${floorY + rRoadOffsetY * 1.45} ${rFootX + 75} ${floorY}`}
                fill="none"
                stroke={palette.purpleFlourish}
                strokeWidth={2.2}
                opacity={0.55}
              />
            )}
          </g>
        )}

        {/* Calibration ruler ticks on the ground strip */}
        {isLightCore && (
          <g opacity="0.65">
            {[-3, -2, -1, 0, 1, 2, 3].map((tick) => {
              const tx = tick * baseUnitH * 0.5;
              const isCenter = tick === 0;
              return (
                <line
                  key={tick}
                  x1={tx}
                  y1={floorY}
                  x2={tx}
                  y2={floorY + (isCenter ? 22 : 12)}
                  stroke={isCenter ? palette.purpleFlourish : palette.greenFlourish}
                  strokeWidth={isCenter ? 2.5 : 1.5}
                />
              );
            })}
          </g>
        )}
      </g>
    </g>
  );
};

