import React from 'react';
import { STAGE_PALETTES } from '../constants';
import { RigVisualMode, ThemeMode, WalkingEnginePivotOffsets } from '../types';
import {
  GOTZ_DIGITS,
  GOTZ_PROPS_ANAT,
  GOTZ_STAGE_BOX,
  GotzHandState,
  gotzBoneSvgPath,
  solveGotzHand,
} from '../utils/gotz-hand';
import {
  FOOT_BONE_SPECS,
  FOOT_SPEC_BY_INDEX,
  NEUTRAL_PIGGY_FOOT_STATE,
  PiggyFootState,
  solvePiggyFootFK,
} from '../utils/piggy-foot';
import {
  FOOTA_MATRIX,
  PUPPYT_NATIVE_CENTER_X,
  PUPPYT_NATIVE_FLOOR_Y,
  PUPPYT_NODE_TO_PIVOT_KEY,
  PUPPYT_STAGE_SCALE,
  PuppytFootPartPiece,
  PuppytNode,
  PuppytRigGraph,
  getPieceWorldMatrix,
  getTensionRatio,
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
  wingPop: number;
  visualMode: RigVisualMode;
  constrainLimits: boolean;
  useAdvancedHands: boolean;
  useAdvancedFeet: boolean;
  handStateL: GotzHandState;
  handStateR: GotzHandState;
  footStateL?: PiggyFootState;
  footStateR?: PiggyFootState;
  draggingBoneKey: keyof WalkingEnginePivotOffsets | null;
  hoveredBoneKey: keyof WalkingEnginePivotOffsets | null;
  onAnchorMouseDown: (boneKey: keyof WalkingEnginePivotOffsets, clientX: number) => void;
  onAnchorHover: (boneKey: keyof WalkingEnginePivotOffsets | null) => void;
  skullOverrideUrl?: string | null;
  skullOverrideBox?: { x: number; y: number; w: number; h: number } | null;
  isBackView?: boolean;
}

const LABELED_NODES: Record<string, string> = {
  head: 'Head',
  neck: 'Neck',
  thorax: 'Upper Spine',
  lumbar: 'Lower Spine',
  pelvis: 'Pelvis',
  humerusL: 'L.Humerus',
  humerusR: 'R.Humerus',
  forearmL: 'L.Forearm',
  forearmR: 'R.Forearm',
  handL: 'L.Hand',
  handR: 'R.Hand',
  fingerL: 'L.Fingers',
  fingerR: 'R.Fingers',
  femurL: 'L.Femur',
  femurR: 'R.Femur',
  shinL: 'L.Knee',
  shinR: 'R.Knee',
  footL: 'L.Foot',
  footR: 'R.Foot',
  toeBallL: 'L.Toe',
  toeBallR: 'R.Toe',
};

const DIGIT_STICK_NODES = new Set([
  'thumbL',
  'thumbTipL',
  'fingerL',
  'fingerTipL',
  'thumbR',
  'thumbTipR',
  'fingerR',
  'fingerTipR',
]);

const RAD_TO_DEG = 180 / Math.PI;

const GotzHandSvg: React.FC<{
  node: PuppytNode;
  state: GotzHandState;
  digitalMode: boolean;
  greenColor: string;
  isBackView?: boolean;
}> = ({ node, state, digitalMode, greenColor, isBackView = false }) => {
  const solved = solveGotzHand(state, GOTZ_PROPS_ANAT);
  const w = node.w;
  const s = GOTZ_STAGE_BOX.scale;
  const drawOrder = isBackView
    ? (['thumb', 'pinky', 'index', 'ring', 'middle'] as const)
    : (['middle', 'ring', 'index', 'pinky', 'thumb'] as const);
  const metaHeads = (['index', 'middle', 'ring', 'pinky'] as const).map((d) => solved[d].pts[1]);
  const palmPoints = `0,0 ${metaHeads.map(([mx, my]) => `${mx.toFixed(3)},${my.toFixed(3)}`).join(' ')}`;

  if (digitalMode) {
    return (
      <g transform={`matrix(${w[0]} ${w[1]} ${w[2]} ${w[3]} ${w[4]} ${w[5]})`}>
        <g
          transform={`translate(${node.piv[0]}, ${node.piv[1]}) scale(${state.mirror ? -s : s}, ${-s})`}
          className="pointer-events-none"
        >
          {/* Metacarpal arch vector bridge */}
          <polygon
            points={palmPoints}
            fill="none"
            stroke={greenColor}
            strokeWidth={0.11}
            strokeLinejoin="round"
            opacity={0.85}
          />
          {GOTZ_DIGITS.map((d) => {
            const pts = solved[d].pts;
            const pathStr = pts.map(([x, y], idx) => `${idx === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
            return (
              <g key={`xray-${d}`}>
                <path
                  d={pathStr}
                  fill="none"
                  stroke={greenColor}
                  strokeWidth={0.12}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.96}
                />
                {pts.slice(1).map(([x, y], j) => (
                  <circle key={j} cx={x} cy={y} r={0.1} fill={greenColor} opacity={0.95} />
                ))}
              </g>
            );
          })}
          <circle cx={0} cy={0} r={0.22} fill="none" stroke={greenColor} strokeWidth={0.1} opacity={0.9} />
        </g>
      </g>
    );
  }

  return (
    <g transform={`matrix(${w[0]} ${w[1]} ${w[2]} ${w[3]} ${w[4]} ${w[5]})`}>
      <g transform={`translate(${node.piv[0]}, ${node.piv[1]}) scale(${state.mirror ? -s : s}, ${-s})`}>
        {/* Palm metacarpal bridge */}
        <polygon
          points={palmPoints}
          fill="#5d03b4"
          stroke="#000000"
          strokeWidth={0.08}
          strokeLinejoin="round"
        />

        {/* Articulated 5 Digits */}
        {drawOrder.map((d) => {
          const { pts, segs } = solved[d];
          return (
            <g key={d}>
              {segs.map((seg, i) => (
                <g
                  key={`${d}-${i}`}
                  transform={`translate(${seg.x1}, ${seg.y1}) rotate(${seg.ang * RAD_TO_DEG})`}
                >
                  <path
                    d={gotzBoneSvgPath(seg, i, segs.length, GOTZ_PROPS_ANAT.width, state.style)}
                    fill="#5d03b4"
                    stroke="#000000"
                    strokeWidth={0.085}
                    strokeLinejoin="round"
                  />
                  <line
                    x1={0}
                    y1={-seg.len * 0.18}
                    x2={0}
                    y2={-seg.len * 0.82}
                    stroke="rgba(255,255,255,0.42)"
                    strokeWidth={0.04}
                    strokeLinecap="round"
                  />
                </g>
              ))}
              {pts.slice(1).map(([px, py], j) => {
                const isTip = j === pts.length - 2;
                return (
                  <circle
                    key={`${d}-pin-${j}`}
                    cx={px}
                    cy={py}
                    r={isTip ? 0.11 : 0.085}
                    fill={isTip ? '#3e0278' : '#181024'}
                    stroke="#000000"
                    strokeWidth={0.035}
                  />
                );
              })}
            </g>
          );
        })}

        {/* Wrist / Carpal socket disc */}
        <circle cx={0} cy={0} r={0.34} fill="#5d03b4" stroke="#000000" strokeWidth={0.085} />
      </g>
    </g>
  );
};

const PiggyFootSvg: React.FC<{
  footNode: PuppytNode;
  footPieces: PuppytFootPartPiece[];
  footState: PiggyFootState;
  mirror: boolean;
  digitalMode: boolean;
  greenColor: string;
  isBackView?: boolean;
}> = ({ footNode, footPieces, footState, mirror, digitalMode, greenColor, isBackView = false }) => {
  const fp = footNode.pieces[0];
  if (!fp || !footPieces.length) return null;

  const fw = footNode.w;
  const m = FOOTA_MATRIX;
  const matStr = mirror
    ? `${-m[0]} ${m[1]} ${-m[2]} ${m[3]} ${fp.w - m[4]} ${m[5]}`
    : `${m[0]} ${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}`;

  const fk = solvePiggyFootFK(footState, mirror ? -1 : 1);
  const dropM = fk.impactDropMat;
  const dropStr = `${dropM[0]} ${dropM[1]} ${dropM[2]} ${dropM[3]} ${dropM[4]} ${dropM[5]}`;
  const { anchors } = fk;

  if (digitalMode) {
    // Full anatomical 23-bone X-Ray vector foot: Ankle -> Heel -> Bridge -> Cuboid,
    // MTP transverse knuckle arch, 2.5D curved longitudinal plantar arch, and tight non-splayed digits
    const txPt = (boneIdx: number, x: number, y: number): [number, number] => {
      const bm = fk.mats[boneIdx];
      return [bm[0] * x + bm[2] * y + bm[4], bm[1] * x + bm[3] * y + bm[5]];
    };

    return (
      <g className="pointer-events-none">
        <g transform={`matrix(${fw[0]} ${fw[1]} ${fw[2]} ${fw[3]} ${fw[4]} ${fw[5]})`}>
          <g transform={`translate(${fp.x}, ${fp.y})`}>
            <g transform={`matrix(${matStr})`}>
              {/* Tarsal primary truss closing Ankle -> Heel -> Cuboid -> Ankle (outside drop for crisp joint mapping, drop applied to segments) */}
              <g transform={`matrix(${dropStr})`}>
                {(() => {
                  const ankleP = txPt(11, 1430, 698);
                  const heelP = txPt(10, 1392, 180);
                  const cuboidP = txPt(0, 878, 1203);
                  return (
                    <polygon
                      points={`${ankleP[0]},${ankleP[1]} ${heelP[0]},${heelP[1]} ${cuboidP[0]},${cuboidP[1]}`}
                      fill="none"
                      stroke={greenColor}
                      strokeWidth={54}
                      strokeLinejoin="round"
                      opacity={0.78}
                    />
                  );
                })()}
              </g>
              {/* 2.5D Plantar Arch Flexion Curve & MTP Transverse Ball Bridge */}
              <path
                d={`M ${anchors.heel[0]} ${anchors.heel[1]} Q ${anchors.cuboid[0]} ${anchors.cuboid[1]} ${anchors.mtp[2][0]} ${anchors.mtp[2][1]} T ${anchors.tips[2][0]} ${anchors.tips[2][1]}`}
                fill="none"
                stroke={greenColor}
                strokeWidth={36}
                strokeDasharray="68 44"
                strokeLinecap="round"
                opacity={0.82}
              />
              <polyline
                points={anchors.mtp.map(([mx, my]) => `${mx},${my}`).join(' ')}
                fill="none"
                stroke={greenColor}
                strokeWidth={34}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.72}
              />
              {/* Individual 23 Bone Rays + Newton's Cradle Bounce Halo on active digits */}
              <g transform={`matrix(${dropStr})`}>
                {FOOT_BONE_SPECS.map((spec) => {
                  const p1 = txPt(spec.index, spec.pivot[0], spec.pivot[1]);
                  const p2 = txPt(spec.index, spec.tip[0], spec.tip[1]);
                  const isPrimary = spec.digit === 0;
                  const rayBounce = spec.digit > 0 ? anchors.cradleBounces[5 - spec.digit] : 0;
                  return (
                    <g key={`xfoot-${spec.index}`}>
                      <line
                        x1={p1[0]}
                        y1={p1[1]}
                        x2={p2[0]}
                        y2={p2[1]}
                        stroke={greenColor}
                        strokeWidth={isPrimary ? 60 : spec.role === 'metatarsal' ? 46 : 36}
                        strokeLinecap="round"
                        opacity={isPrimary ? 0.96 : 0.92}
                      />
                      <circle
                        cx={p1[0]}
                        cy={p1[1]}
                        r={
                          spec.index === 11 || spec.index === 0 || spec.index === 10
                            ? 52
                            : 28 + Math.min(18, rayBounce * 10)
                        }
                        fill={greenColor}
                        opacity={0.95}
                      />
                    </g>
                  );
                })}
              </g>
            </g>
          </g>
        </g>
      </g>
    );
  }

  // Analog shaded multi-bone stack:
  // In 3rd-person Back View, render Heel (10) & Ankle (11) IN FRONT of toes/metatarsals so Achilles & calcaneus read behind the stride!
  const tarsalBackOrder = new Set([10, 11]);
  const baseReversed = footPieces.map((part, origIdx) => ({ part, origIdx })).reverse();
  const orderedWithIdx = isBackView
    ? [
        ...baseReversed.filter((e) => !tarsalBackOrder.has(e.origIdx)),
        ...baseReversed.filter((e) => tarsalBackOrder.has(e.origIdx)),
      ]
    : baseReversed;

  return (
    <g transform={`matrix(${fw[0]} ${fw[1]} ${fw[2]} ${fw[3]} ${fw[4]} ${fw[5]})`}>
      <g transform={`translate(${fp.x}, ${fp.y}) matrix(${matStr}) matrix(${dropStr})`}>
        {orderedWithIdx.map(({ part, origIdx }) => {
          if (part.on === false || !part.src) return null;
          const bm = fk.mats[origIdx] ?? [1, 0, 0, 1, 0, 0];
          const spec = FOOT_SPEC_BY_INDEX[origIdx];
          return (
            <g
              key={`${footNode.id}-piggy-${origIdx}`}
              transform={`matrix(${bm[0]} ${bm[1]} ${bm[2]} ${bm[3]} ${bm[4]} ${bm[5]})`}
              data-foot-role={spec?.role}
            >
              <image href={part.src} x={part.x} y={part.y} width={part.w} height={part.h} />
            </g>
          );
        })}
      </g>
    </g>
  );
};

export const PuppytSkeleton: React.FC<PuppytSkeletonProps> = ({
  graph,
  visualFloorY,
  theme,
  showPivots,
  showLabels,
  isPaused,
  wingPop,
  visualMode,
  constrainLimits,
  useAdvancedHands,
  useAdvancedFeet,
  handStateL,
  handStateR,
  footStateL,
  footStateR,
  draggingBoneKey,
  hoveredBoneKey,
  onAnchorMouseDown,
  onAnchorHover,
  skullOverrideUrl,
  skullOverrideBox,
  isBackView = false,
}) => {
  const palette = STAGE_PALETTES[theme];
  const isLight = theme === 'light';
  const isDigital = visualMode === 'digital';
  const isPausedAndPivotsVisible = isPaused && showPivots;
  const hasPiggyFoot = useAdvancedFeet && graph.footPieces.length > 0;

  const tx = -PUPPYT_NATIVE_CENTER_X * PUPPYT_STAGE_SCALE;
  const ty = visualFloorY - PUPPYT_NATIVE_FLOOR_Y * PUPPYT_STAGE_SCALE;

  const { nodes, by, pieces, footPieces } = graph;

  const greenBoneColor = isLight ? '#14532D' : '#16A34A';
  const magentaTensionColor = palette.anchorRed;
  const mirrorScreenX = (x: number) => (isBackView ? PUPPYT_NATIVE_CENTER_X * 2 - x : x);
  const subFootAnchors = new Set(['heelL', 'heelR', 'cuboidL', 'cuboidR']);

  return (
    <g transform={`translate(${tx}, ${ty}) scale(${PUPPYT_STAGE_SCALE})`}>
      {/* Reverse all skeletal sprites & X-Ray geometry across midline when 3rd-person Back View is active */}
      <g
        transform={
          isBackView ? `translate(${PUPPYT_NATIVE_CENTER_X * 2}, 0) scale(-1, 1)` : undefined
        }
      >
        {/* Analog skeletal sprite layers OR Pure Dark-Green Vector X-Ray */}
        <g>
          {pieces.map((p, idx) => {
            const n = p.node;
            if (!n || !p.src) return null;

            if (useAdvancedHands && (n.id === 'handL' || n.id === 'handR')) {
              return (
                <GotzHandSvg
                  key={`${n.id}-gotz`}
                  node={n}
                  state={n.id === 'handL' ? handStateL : handStateR}
                  digitalMode={isDigital}
                  greenColor={greenBoneColor}
                  isBackView={isBackView}
                />
              );
            }

            if (hasPiggyFoot && (n.id === 'footL' || n.id === 'footR')) {
              const isLeft = n.id === 'footL';
              return (
                <PiggyFootSvg
                  key={`${n.id}-piggy`}
                  footNode={n}
                  footPieces={footPieces}
                  footState={(isLeft ? footStateL : footStateR) ?? NEUTRAL_PIGGY_FOOT_STATE}
                  mirror={isLeft}
                  digitalMode={isDigital}
                  greenColor={greenBoneColor}
                  isBackView={isBackView}
                />
              );
            }

            // Pure vector X-Ray hides raster image plates so ONLY pure dark-green vector lines render!
            if (isDigital) return null;

            const w = getPieceWorldMatrix(p, wingPop);
            const isHeadFront = n.id === 'head' && p.name === 'Front';
            const href = isHeadFront && skullOverrideUrl ? skullOverrideUrl : p.src;
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

        {/* Pure Vector Bone Overlay (Dark Green in X-Ray mode, subtle guide when pivots visible) */}
        {(showPivots || isDigital) && (
          <g className="pointer-events-none">
            {nodes.map((n) => {
              if (n.ghost && !isDigital) return null;
              if (useAdvancedHands && DIGIT_STICK_NODES.has(n.id)) return null;

              const par = parentOf(n, by);
              const lines: React.ReactNode[] = [];
              const baseOpacity = isDigital ? (n.ghost ? 0.45 : 0.96) : isLight ? 0.45 : 0.34;
              const baseWidth = isDigital ? 15 : 9;

              if (par) {
                const a = pos(par, by);
                const b = pos(n, by);
                const { atLimit } = constrainLimits ? getTensionRatio(n) : { atLimit: false };
                const strokeCol = atLimit && isDigital ? magentaTensionColor : greenBoneColor;
                lines.push(
                  <line
                    key={`seg-${n.id}`}
                    x1={a[0]}
                    y1={a[1]}
                    x2={b[0]}
                    y2={b[1]}
                    stroke={strokeCol}
                    strokeWidth={baseWidth}
                    strokeLinecap="round"
                    opacity={baseOpacity}
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
                    stroke={greenBoneColor}
                    strokeWidth={baseWidth}
                    strokeLinecap="round"
                    opacity={baseOpacity}
                  />
                );
              }

              if (n.bond && n.bond.aim && by[n.bond.aim.to]) {
                const A = pos(by[n.bond.aim.to], by);
                const Q = pos(n.bond, by);
                const strained = Math.abs(n.eff - n.ang) > 0.05;
                lines.push(
                  <line
                    key={`bond-${n.id}`}
                    x1={Q[0]}
                    y1={Q[1]}
                    x2={A[0]}
                    y2={A[1]}
                    stroke={strained ? magentaTensionColor : greenBoneColor}
                    strokeWidth={strained ? baseWidth * 1.2 : baseWidth}
                    strokeLinecap="round"
                    opacity={strained ? 0.95 : baseOpacity}
                  />
                );
              }

              // Pure X-Ray head contour truss & joint node rings
              if (isDigital && n.id === 'head') {
                const neckP = par ? pos(par, by) : pos(n, by);
                const w = n.w;
                const craniumCenter: [number, number] = [
                  w[0] * 1258 + w[2] * 430 + w[4],
                  w[1] * 1258 + w[3] * 430 + w[5],
                ];
                const crownTop: [number, number] = [
                  w[0] * 1258 + w[2] * 35 + w[4],
                  w[1] * 1258 + w[3] * 35 + w[5],
                ];
                lines.push(
                  <line
                    key="head-axis"
                    x1={neckP[0]}
                    y1={neckP[1]}
                    x2={crownTop[0]}
                    y2={crownTop[1]}
                    stroke={greenBoneColor}
                    strokeWidth={baseWidth}
                    strokeLinecap="round"
                    opacity={0.96}
                  />,
                  <ellipse
                    key="head-cranium"
                    cx={craniumCenter[0]}
                    cy={craniumCenter[1]}
                    rx={275 * n.sx}
                    ry={385 * n.sy}
                    fill="none"
                    stroke={greenBoneColor}
                    strokeWidth={12}
                    transform={`rotate(${(Math.atan2(w[1], w[0]) * 180) / Math.PI}, ${craniumCenter[0]}, ${craniumCenter[1]})`}
                    opacity={0.9}
                  />
                );
              }

              if (isDigital && !n.ghost) {
                const p = pos(n, by);
                lines.push(
                  <circle
                    key={`xnode-${n.id}`}
                    cx={p[0]}
                    cy={p[1]}
                    r={n.id.startsWith('swivel') ? 12 : 16}
                    fill={greenBoneColor}
                    opacity={0.9}
                  />
                );
              }

              return lines;
            })}
          </g>
        )}
      </g>

      {/* Red Dot Anchors (Ankle, Heel, Cuboid, Ball/Toe & all joints) + Upright Technical Labels */}
      {showPivots &&
        nodes.map((n) => {
          if (n.ghost) return null;
          const pivotKey = PUPPYT_NODE_TO_PIVOT_KEY[n.id];
          const isSubFoot = subFootAnchors.has(n.id);
          if (n.lock && !pivotKey && !isSubFoot) return null;

          const rawP = pos(n, by);
          const p: [number, number] = [mirrorScreenX(rawP[0]), rawP[1]];
          const isDragging = pivotKey && draggingBoneKey === pivotKey;
          const isHovered = pivotKey && hoveredBoneKey === pivotKey;
          const { atLimit } = constrainLimits ? getTensionRatio(n) : { atLimit: false };
          const strainedBond = !!(n.bond && Math.abs(n.eff - n.ang) > 0.05);
          const isSwivel = n.id.startsWith('swivel');
          const baseRadius = isSubFoot ? 13 : isSwivel ? 14 : 21;
          const r = isDragging ? baseRadius + 8 : isHovered ? baseRadius + 4 : baseRadius;

          // Keep L/R label offsets aligned with which side of the body the limb actually sits on
          const isPhysicalR = n.id.endsWith('R');
          const labelOnLeftSide = isBackView ? !isPhysicalR : isPhysicalR;

          return (
            <g key={`anchor-${n.id}`} data-no-export="true">
              {(isHovered || isDragging || (isDigital && (atLimit || strainedBond))) && (
                <circle
                  cx={p[0]}
                  cy={p[1]}
                  r={r + 16}
                  fill="none"
                  stroke={
                    isDragging
                      ? greenBoneColor
                      : atLimit || strainedBond
                        ? magentaTensionColor
                        : palette.purpleFlourish
                  }
                  strokeWidth={7}
                  opacity={0.9}
                />
              )}
              <circle
                cx={p[0]}
                cy={p[1]}
                r={r}
                fill={isSubFoot ? palette.purpleFlourish : palette.anchorRed}
                stroke={palette.anchorRing}
                strokeWidth={isSubFoot ? 4.5 : 5.5}
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
                  x={p[0] + (labelOnLeftSide ? -42 : 42)}
                  y={p[1] + 10}
                  textAnchor={labelOnLeftSide ? 'end' : 'start'}
                  fill={palette.labelFill}
                  fontSize="29"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="700"
                  opacity={0.86}
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
