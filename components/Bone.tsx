import React from 'react';
import { Vector2D, WalkingEnginePivotOffsets, WalkingEngineProportions } from '../types';

export type BoneVariant =
  | 'diamond'
  | 'waist-teardrop-pointy-up'
  | 'torso-teardrop-pointy-down'
  | 'collar-horizontal-oval-shape'
  | 'deltoid-shape'
  | 'limb-tapered'
  | 'head-tall-oval'
  | 'hand-foot-arrowhead-shape'
  | 'foot-block-shape'
  // Core Doll redesigned variants
  | 'head-flattened-wedge'
  | 'collar-olive-yoke'
  | 'torso-sculpted'
  | 'waist-sculpted'
  | 'deltoid-sculpted'
  | 'limb-sculpted'
  | 'foot-sole-block'
  | 'arrowhead-thin-base';

export interface BoneProps {
  rotation: number;
  length: number;
  width?: number;
  variant?: BoneVariant;
  showPivots: boolean;
  visible?: boolean;
  offset?: Vector2D;
  children?: React.ReactNode;
  drawsUpwards?: boolean;
  fillColor?: string;
  strokeColor?: string;
  labelColor?: string;
  axisColor?: string;
  anchorColor?: string;
  anchorRingColor?: string;
  flourishColor?: string;
  secondaryFlourishColor?: string;
  showFlourishes?: boolean;
  showLabel?: boolean;
  label?: string;
  boneKey?: keyof WalkingEnginePivotOffsets;
  proportionKey?: keyof WalkingEngineProportions;
  onAnchorMouseDown?: (boneKey: keyof WalkingEnginePivotOffsets, clientX: number) => void;
  onAnchorHover?: (boneKey: keyof WalkingEnginePivotOffsets | null) => void;
  isBeingDragged?: boolean;
  isHovered?: boolean;
  isPausedAndPivotsVisible?: boolean;
  anchorRadius?: number;
  isCollarHub?: boolean;
}

export const COLORS = {
  ANCHOR_RED: '#EF4444',
  SELECTION: '#7C3AED',
  RIDGE: '#333333',
  PIN_HIGHLIGHT: '#E5E7EB',
  DEFAULT_FILL: '#000000',
  FOCUS_RING: '#7C3AED',
};

export const Bone: React.FC<BoneProps> = ({
  rotation,
  length,
  width = 15,
  variant = 'diamond',
  showPivots = true,
  visible = true,
  offset = { x: 0, y: 0 },
  children,
  drawsUpwards = false,
  fillColor = '#000000',
  strokeColor = '#333333',
  labelColor = '#4B5563',
  axisColor = 'rgba(150, 150, 150, 0.2)',
  anchorColor = COLORS.ANCHOR_RED,
  anchorRingColor = '#FFFFFF',
  flourishColor = '#7C3AED',
  secondaryFlourishColor = '#059669',
  showFlourishes = false,
  showLabel = false,
  label,
  boneKey,
  onAnchorMouseDown,
  onAnchorHover,
  isBeingDragged = false,
  isHovered = false,
  isPausedAndPivotsVisible = false,
  anchorRadius = 5.5,
  isCollarHub = false,
}) => {
  const getBonePath = (boneLength: number, boneWidth: number, boneVariant: BoneVariant | string, upward: boolean): string => {
    const effectiveLength = upward ? -boneLength : boneLength;

    switch (boneVariant) {
      // --- LEGACY VARIANTS ---
      case 'head-tall-oval': {
        const hH = boneLength * 0.75;
        const bW = boneWidth * 0.3;
        const tW = boneWidth * 0.6;
        return `M ${-bW / 2},0 L ${bW / 2},0 C ${bW / 2 + 10},0 ${tW / 2},${-hH * 0.4} ${tW / 2},${-hH} L ${-tW / 2},${-hH} C ${-tW / 2},${-hH * 0.4} ${-bW / 2 - 10},0 ${-bW / 2},0 Z`;
      }

      case 'collar-horizontal-oval-shape': {
        const collarVisHeight = boneLength;
        const collarBaseWidth = boneWidth;
        const collarTopWidth = collarBaseWidth * 0.5;
        return `M ${collarBaseWidth / 2},0 C ${collarBaseWidth * 0.3},${-collarVisHeight * 0.3} ${collarTopWidth * 0.7},${-collarVisHeight * 0.6} ${collarTopWidth / 2},${-collarVisHeight} L ${-collarTopWidth / 2},${-collarVisHeight} C ${-collarTopWidth * 0.7},${-collarVisHeight * 0.6} ${-collarBaseWidth * 0.3},${-collarVisHeight * 0.3} ${-collarBaseWidth / 2},0 Z`;
      }

      case 'waist-teardrop-pointy-up': {
        const wHeight = boneLength;
        const wWidth = boneWidth;
        return `M ${wWidth / 2},0 L ${wWidth * 0.15},${-wHeight} L ${-wWidth * 0.15},${-wHeight} L ${-wWidth / 2},0 Z`;
      }

      case 'torso-teardrop-pointy-down': {
        const tHeight = boneLength;
        const tWidth = boneWidth;
        return `M ${tWidth * 0.3},0 C ${tWidth * 0.3},${-tHeight * 0.3} ${tWidth / 2},${-tHeight * 0.7} ${tWidth / 2},${-tHeight} L ${-tWidth / 2},${-tHeight} C ${-tWidth / 2},${-tHeight * 0.7} ${-tWidth * 0.3},${-tHeight * 0.3} ${-tWidth * 0.3},0 Z`;
      }

      case 'deltoid-shape': {
        const dHeight = boneLength;
        const shoulderWidth = boneWidth;
        return `M ${shoulderWidth / 2} 0
                C ${shoulderWidth / 2} ${dHeight * 0.2} ${shoulderWidth * 1.2 / 2} ${dHeight * 0.4} ${shoulderWidth * 1.2 / 2} ${dHeight * 0.7}
                L 0 ${dHeight}
                L ${-shoulderWidth * 1.2 / 2} ${dHeight * 0.7}
                C ${-shoulderWidth * 1.2 / 2} ${dHeight * 0.4} ${-shoulderWidth / 2} ${dHeight * 0.2} ${-shoulderWidth / 2} 0 Z`;
      }

      case 'limb-tapered': {
        const taperedWidth = boneWidth;
        const taperedEndWidth = taperedWidth * 0.65;
        return `M ${taperedWidth / 2},0 L ${taperedEndWidth / 2},${effectiveLength} L ${-taperedEndWidth / 2},${effectiveLength} L ${-taperedWidth / 2},0 Z`;
      }

      case 'foot-block-shape': {
        const footBlockWidth = boneWidth;
        const footBlockEndWidth = footBlockWidth * 0.8;
        return `M ${footBlockWidth / 2},0 L ${footBlockEndWidth / 2},${effectiveLength} L ${-footBlockEndWidth / 2},${effectiveLength} L ${-footBlockWidth / 2},0 Z`;
      }

      case 'hand-foot-arrowhead-shape': {
        const handFootWidth = boneWidth;
        return `M ${-handFootWidth / 2},0 L ${handFootWidth / 2},0 L 0,${effectiveLength} Z`;
      }

      // --- CORE DOLL REDESIGNED VARIANTS ---
      case 'head-flattened-wedge': {
        // Flattened inverted wedge cranium: 25% neck base -> 58% flat skull crown
        const hH = boneLength * 0.82;
        const bW = boneWidth * 0.26;
        const tW = boneWidth * 0.62;
        const crownFlat = hH * 0.94;
        return `M ${-bW / 2},0
                L ${bW / 2},0
                C ${bW * 0.65},${-hH * 0.28} ${tW * 0.48},${-hH * 0.62} ${tW / 2},${-crownFlat}
                L ${tW * 0.42},${-hH}
                L ${-tW * 0.42},${-hH}
                L ${-tW / 2},${-crownFlat}
                C ${-tW * 0.48},${-hH * 0.62} ${-bW * 0.65},${-hH * 0.28} ${-bW / 2},0 Z`;
      }

      case 'collar-olive-yoke': {
        // Sculpted olive clavicle yoke spanning both shoulder sockets and tapering to the neck
        const cH = boneLength;
        const baseW = boneWidth * 1.14;
        const topW = boneWidth * 0.44;
        const shoulderLipY = -cH * 0.24;
        return `M ${-baseW / 2},0
                L ${-baseW / 2},${shoulderLipY}
                C ${-baseW * 0.42},${-cH * 0.56} ${-topW * 0.72},${-cH * 0.8} ${-topW / 2},${-cH}
                L ${topW / 2},${-cH}
                C ${topW * 0.72},${-cH * 0.8} ${baseW * 0.42},${-cH * 0.56} ${baseW / 2},${shoulderLipY}
                L ${baseW / 2},0
                C ${baseW * 0.26},${cH * 0.08} ${-baseW * 0.26},${cH * 0.08} ${-baseW / 2},0 Z`;
      }

      case 'torso-sculpted': {
        const tH = boneLength;
        const waistW = boneWidth * 0.44;
        const chestW = boneWidth * 1.06;
        const topW = boneWidth * 0.88;
        return `M ${-waistW / 2},0
                C ${-waistW * 0.62},${-tH * 0.28} ${-chestW * 0.52},${-tH * 0.58} ${-chestW / 2},${-tH * 0.78}
                L ${-topW / 2},${-tH}
                L ${topW / 2},${-tH}
                L ${chestW / 2},${-tH * 0.78}
                C ${chestW * 0.52},${-tH * 0.58} ${waistW * 0.62},${-tH * 0.28} ${waistW / 2},0 Z`;
      }

      case 'waist-sculpted': {
        const wH = boneLength;
        const hipW = boneWidth * 0.94;
        const topW = boneWidth * 0.34;
        return `M ${-hipW / 2},0
                L ${-hipW * 0.46},${-wH * 0.22}
                L ${-topW / 2},${-wH}
                L ${topW / 2},${-wH}
                L ${hipW * 0.46},${-wH * 0.22}
                L ${hipW / 2},0
                C ${hipW * 0.22},${wH * 0.08} ${-hipW * 0.22},${wH * 0.08} ${-hipW / 2},0 Z`;
      }

      case 'deltoid-sculpted': {
        const dH = boneLength;
        const sW = boneWidth * 1.08;
        const midW = boneWidth * 1.18;
        const eW = boneWidth * 0.64;
        return `M ${-sW / 2},0
                C ${-sW * 0.55},${dH * 0.16} ${-midW / 2},${dH * 0.36} ${-midW * 0.46},${dH * 0.62}
                L ${-eW / 2},${dH}
                L ${eW / 2},${dH}
                L ${midW * 0.46},${dH * 0.62}
                C ${midW / 2},${dH * 0.36} ${sW * 0.55},${dH * 0.16} ${sW / 2},0 Z`;
      }

      case 'limb-sculpted': {
        const proxW = boneWidth;
        const distW = boneWidth * 0.58;
        const swellW = boneWidth * 1.04;
        const swellY = effectiveLength * 0.22;
        return `M ${-proxW / 2},0
                L ${-swellW / 2},${swellY}
                L ${-distW / 2},${effectiveLength}
                L ${distW / 2},${effectiveLength}
                L ${swellW / 2},${swellY}
                L ${proxW / 2},0 Z`;
      }

      case 'foot-sole-block': {
        // When rotated -90 deg, local -X faces DOWN (+Y global = floor), local +X faces UP (instep)
        const soleX = -boneWidth * 0.45;
        const ankleTopX = boneWidth * 0.55;
        const ballTopX = boneWidth * 0.24;
        const heelY = -boneWidth * 0.16;
        return `M ${soleX},${heelY}
                L ${ankleTopX},0
                L ${ballTopX},${effectiveLength}
                L ${soleX},${effectiveLength} Z`;
      }

      case 'arrowhead-thin-base': {
        // Ultra-thin 30% base flaring into crisp geometric arrowhead
        const baseW = boneWidth * 0.3;
        const flareW = boneWidth * 0.95;
        const flareY = effectiveLength * 0.28;
        return `M ${-baseW / 2},0
                L ${baseW / 2},0
                L ${flareW / 2},${flareY}
                L 0,${effectiveLength}
                L ${-flareW / 2},${flareY} Z`;
      }

      default: {
        const defaultWidth = boneWidth;
        const split = effectiveLength * 0.4;
        return `M 0 0 L ${defaultWidth / 2} ${split} L 0 ${effectiveLength} L ${-defaultWidth / 2} ${split} Z`;
      }
    }
  };

  const visualEndPoint = drawsUpwards ? -length : length;
  const transform =
    offset.x !== 0 || offset.y !== 0
      ? `translate(${offset.x}, ${offset.y}) rotate(${rotation})`
      : `rotate(${rotation})`;

  const cursorStyle = isPausedAndPivotsVisible
    ? isBeingDragged
      ? 'cursor-grabbing'
      : 'cursor-grab'
    : 'cursor-default';

  const isCoreVariant =
    variant === 'head-flattened-wedge' ||
    variant === 'collar-olive-yoke' ||
    variant === 'torso-sculpted' ||
    variant === 'waist-sculpted' ||
    variant === 'deltoid-sculpted' ||
    variant === 'limb-sculpted' ||
    variant === 'foot-sole-block' ||
    variant === 'arrowhead-thin-base';

  return (
    <g transform={transform}>
      {visible && (
        <React.Fragment>
          <path
            d={getBonePath(length, width, variant, drawsUpwards)}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={isCoreVariant ? 1.15 : 0.6}
            strokeLinejoin="round"
            paintOrder="stroke"
          />

          {/* Subtle Core Doll Purple & Green Flourishes */}
          {showFlourishes && isCoreVariant && (
            <g className="pointer-events-none">
              {variant === 'head-flattened-wedge' && (
                <>
                  <line
                    x1={-width * 0.24}
                    y1={-length * 0.68}
                    x2={width * 0.24}
                    y2={-length * 0.68}
                    stroke={flourishColor}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    opacity="0.85"
                  />
                  <circle cx="0" cy={-length * 0.68} r="2.2" fill={secondaryFlourishColor} />
                </>
              )}
              {variant === 'collar-olive-yoke' && (
                <>
                  <line
                    x1={-width * 0.46}
                    y1={-length * 0.14}
                    x2={width * 0.46}
                    y2={-length * 0.14}
                    stroke={secondaryFlourishColor}
                    strokeWidth="1.6"
                    strokeDasharray="4 3"
                    opacity="0.7"
                  />
                  <line
                    x1="0"
                    y1={-length * 0.18}
                    x2="0"
                    y2={-length * 0.88}
                    stroke={flourishColor}
                    strokeWidth="1.4"
                    opacity="0.75"
                  />
                </>
              )}
              {(variant === 'torso-sculpted' || variant === 'waist-sculpted') && (
                <line
                  x1="0"
                  y1={-length * 0.14}
                  x2="0"
                  y2={-length * 0.86}
                  stroke={variant === 'torso-sculpted' ? flourishColor : secondaryFlourishColor}
                  strokeWidth="1.3"
                  strokeDasharray="3 3"
                  opacity="0.55"
                />
              )}
            </g>
          )}

          {/* Kinematic centerline axis */}
          {showPivots && (
            <line
              x1="0"
              y1="0"
              x2="0"
              y2={visualEndPoint}
              stroke={showFlourishes && isCollarHub ? secondaryFlourishColor : axisColor}
              strokeWidth={isCoreVariant ? 1.2 : 1}
              opacity={0.7}
              strokeLinecap="round"
              strokeDasharray={isCoreVariant ? '4 4' : undefined}
            />
          )}

          {showLabel && label && (
            <text
              x={width / 2 + 8}
              y={visualEndPoint / 2}
              fill={labelColor}
              className="text-[7px] font-mono select-none tracking-tighter uppercase pointer-events-none"
              opacity={0.75}
              data-is-label="true"
            >
              {label}
            </text>
          )}
        </React.Fragment>
      )}

      <g transform={`translate(0, ${visualEndPoint})`}>{children}</g>

      {/* Red Anchor Dots at joint origin */}
      {showPivots && visible && boneKey && onAnchorMouseDown && (
        <g data-no-export="true">
          {(isHovered || isBeingDragged) && (
            <circle
              cx="0"
              cy="0"
              r={anchorRadius + 4.5}
              fill="none"
              stroke={isBeingDragged ? secondaryFlourishColor : flourishColor}
              strokeWidth="1.5"
              opacity="0.9"
            />
          )}
          <circle
            cx="0"
            cy="0"
            r={isBeingDragged ? anchorRadius + 1.5 : isHovered ? anchorRadius + 0.8 : anchorRadius}
            fill={anchorColor}
            stroke={anchorRingColor}
            strokeWidth="1.4"
            className={cursorStyle}
            onMouseEnter={() => onAnchorHover?.(boneKey)}
            onMouseLeave={() => onAnchorHover?.(null)}
            onMouseDown={(e) => {
              if (isPausedAndPivotsVisible) {
                e.stopPropagation();
                onAnchorMouseDown(boneKey, e.clientX);
              }
            }}
          />
        </g>
      )}
    </g>
  );
};