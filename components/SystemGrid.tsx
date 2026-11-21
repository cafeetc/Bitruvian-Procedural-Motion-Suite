import React from 'react';
import { ModelVersion, ThemeMode, Vector2D } from '../types';
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
}) => {
  const palette = STAGE_PALETTES[theme];
  const isLightCore = theme === 'light' && modelVersion === 'core';
  const span = 20000;

  const groundStripWidth = ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.FOOT * baseUnitH * 6.5;
  const groundStripX = -groundStripWidth / 2;

  return (
    <g className="pointer-events-none system-guides-group">
      {/* Center X-axis guide */}
      <line
        x1={-span}
        y1="0"
        x2={span}
        y2="0"
        stroke={isLightCore ? palette.greenFlourish : palette.guideStroke}
        strokeWidth={1}
        opacity={isLightCore ? 0.16 : 0.25}
        strokeDasharray="10 8"
      />
      {/* Center Y-axis plumb line */}
      <line
        x1="0"
        y1={-span}
        x2="0"
        y2={span}
        stroke={isLightCore ? palette.purpleFlourish : palette.guideStroke}
        strokeWidth={1.1}
        opacity={isLightCore ? 0.2 : 0.28}
        strokeDasharray="10 8"
      />

      {/* Floor guide line and subtle ground strip */}
      <g>
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
            {/* Live stance foot-plant contact indicators */}
            {(lPlanted || rPlanted) && (
              <line
                x1={-baseUnitH * 0.8}
                y1={floorY}
                x2={baseUnitH * 0.8}
                y2={floorY}
                stroke={palette.greenFlourish}
                strokeWidth="4"
                strokeLinecap="round"
              />
            )}
          </g>
        )}
      </g>
    </g>
  );
};
