import {
  HeadTurnStep,
  RibAnchorMode,
  WalkingEnginePivotOffsets,
  WalkingEnginePose,
  WalkingEngineProportions,
} from '../types';
import { GotzHandState, gotzToPuppetOffset, solveGotzHand, GOTZ_PROPS_ANAT } from './gotz-hand';

export const PUPPYT_DEG = Math.PI / 180;
const IDENTITY = [1, 0, 0, 1, 0, 0] as const;

export type SkullViewMode = 'front' | 'side' | 'back';

export interface HeadTurnSpec {
  step: HeadTurnStep;
  view: SkullViewMode;
  flipX: boolean;
  label: string;
}

// 4-step 360° turntable order matching Bitruvian.Human.Puppyt:
// Front -> Side Right -> Back -> Side Left (mirrored) -> Front
export const HEAD_TURN_SEQUENCE: readonly HeadTurnSpec[] = [
  { step: 0, view: 'front', flipX: false, label: 'Front' },
  { step: 1, view: 'side', flipX: false, label: 'Side R' },
  { step: 2, view: 'back', flipX: false, label: 'Back' },
  { step: 3, view: 'side', flipX: true, label: 'Side L' },
] as const;

export interface PuppytRawPiece {
  i: number;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;
}

export interface PuppytFootPartPiece {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  on?: boolean;
  src: string;
  isToe: boolean;
}

export interface PuppytRawNode {
  id: string;
  name?: string;
  parent?: string | null;
  pivot: [number, number];
  aim?: { to: string; from: [number, number]; min: number; max: number } | null;
  ang?: number;
  lock?: number;
  ghost?: number;
  bar?: [string, string];
  flipX?: boolean;
  pieces?: PuppytRawPiece[];
}

export interface PuppytRawRigDef {
  W: number;
  H: number;
  nodes: PuppytRawNode[];
  jn?: number;
  dg?: number;
  antiPhallic?: number;
}

export interface PuppytHeadPartPiece {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  on: boolean;
  src: string;
}

export interface PuppytRawPartsDef {
  head?: {
    title?: string;
    views?: Array<{
      pieces?: Array<{
        name: string;
        x: number;
        y: number;
        w: number;
        h: number;
        on?: boolean;
        src: string;
      }>;
    }>;
  };
  foot?: {
    title?: string;
    views?: Array<{
      pieces?: Array<{
        name: string;
        x: number;
        y: number;
        w: number;
        h: number;
        on?: boolean;
        src: string;
      }>;
    }>;
  };
}

export interface PuppytPiece extends PuppytRawPiece {
  node?: PuppytNode;
  i0?: number;
  wing?: boolean;
  gotzManaged?: boolean;
  mir?: boolean;
  oliveSrc?: string;
  restBox?: { x: number; y: number; w: number; h: number };
}

export interface PuppytNode {
  id: string;
  name: string;
  parent: string | null;
  aim: { to: string; from: [number, number]; min: number; max: number } | null;
  pieces: PuppytPiece[];
  piv: [number, number];
  rest: [number, number];
  ang: number;
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  w: Float64Array;
  pureW: Float64Array;
  eff: number;
  bond: PuppytNode | null;
  lock: boolean;
  ghost: boolean;
  bar: [string, string] | null;
  at: [number, number] | null;
  limits: [number, number];
  flipX: boolean;
}

export interface PuppytRigGraph {
  W: number;
  H: number;
  nodes: PuppytNode[];
  by: Record<string, PuppytNode>;
  root: PuppytNode;
  pieces: PuppytPiece[];
  headPieces: PuppytHeadPartPiece[];
  footPieces: PuppytFootPartPiece[];
  lumbarShiftY: number;
}

// Calibrated Leg-Guided 3D Piggy Foot (Piggies) affine matrix: s=0.86 (~778px reach = 52.6% of shin), pitched -6° downward
export const FOOTA_MATRIX: readonly [number, number, number, number, number, number] = [
  -0.1812138211476307,
  -0.15363608392495995,
  -0.23820328414288053,
  0.2809608669180187,
  1089.4016565728425,
  95.08891490391568,
];

// Metatarsophalangeal (ball of foot) pivot aligned with tightened 3D Piggy Foot (3rd MTP at [521, 7458])
export const FOOT_R_BALL_PIVOT: [number, number] = [521, 7458];
export const FOOT_L_BALL_PIVOT: [number, number] = [1983, 7458];
export const FOOT_R_HEEL_PIVOT: [number, number] = [960, 6878];
export const FOOT_L_HEEL_PIVOT: [number, number] = [1544, 6878];
export const FOOT_R_CUBOID_PIVOT: [number, number] = [842, 7138];
export const FOOT_L_CUBOID_PIVOT: [number, number] = [1662, 7138];

// Toe phalanx piece indices inside parts.foot.views[0].pieces
export const FOOT_TOE_PIECE_INDICES = new Set([3, 4, 5, 7, 8, 9, 13, 14, 16, 17, 18, 20, 21, 22]);

export const PUPPYT_ANATOMICAL_LIMITS: Record<string, [number, number]> = {
  pelvis: [-180, 180],
  hipR: [-145, 145],
  hipL: [-145, 145],
  lumbar: [-180, 180], // Unlocked Lower Spine rotation
  thorax: [-180, 180], // Unlocked Upper Spine rotation
  ribR: [-36, 36],
  ribL: [-36, 36],
  neck: [-180, 180],   // Unlocked Cervical Spine rotation
  head: [-65, 65],
  lip: [-35, 18],
  braceL: [-18, 18],
  braceR: [-18, 18],
  swivelL: [-42, 42],
  swivelR: [-42, 42],
  acromionL: [-45, 60],
  acromionR: [-60, 45],
  humerusL: [-175, 165],
  humerusR: [-165, 175],
  forearmL: [-155, 15],
  forearmR: [-15, 155],
  handL: [-85, 85],
  handR: [-85, 85],
  thumbL: [-75, 75],
  thumbR: [-75, 75],
  fingerL: [-95, 45],
  fingerR: [-45, 95],
  femurL: [-135, 120],
  femurR: [-120, 135],
  shinL: [-15, 150],
  shinR: [-150, 15],
  footL: [-65, 75],
  footR: [-75, 65],
  toeBallL: [-55, 65],
  toeBallR: [-65, 55],
};

// Map Puppyt node IDs to interactive pivot offset keys — hands/fingers and feet/toes on the SAME level as all other joints
export const PUPPYT_NODE_TO_PIVOT_KEY: Record<string, keyof WalkingEnginePivotOffsets> = {
  pelvis: 'waist',
  lumbar: 'waist',
  thorax: 'torso',
  neck: 'collar',
  head: 'neck',
  humerusL: 'l_shoulder',
  humerusR: 'r_shoulder',
  forearmL: 'l_elbow',
  forearmR: 'r_elbow',
  handL: 'l_hand',
  handR: 'r_hand',
  fingerL: 'l_fingers',
  fingerR: 'r_fingers',
  femurL: 'l_hip',
  femurR: 'r_hip',
  shinL: 'l_knee',
  shinR: 'r_knee',
  footL: 'l_foot',
  footR: 'r_foot',
  toeBallL: 'l_toe',
  toeBallR: 'r_toe',
};

export const PUPPYT_NATIVE_CENTER_X = 1257;
export const PUPPYT_NATIVE_FLOOR_Y = 7623;
export const PUPPYT_NATIVE_CROWN_Y = 18;
export const PUPPYT_STAGE_SCALE = 0.232; // Maps 7605px height -> ~1764 SVG units

export function normalizeDeg(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

export function clampAnatomicalAngle(n: PuppytNode, deg: number, constrainLimits: boolean): number {
  const safe = Number.isFinite(deg) ? deg : 0;
  const norm = normalizeDeg(safe);
  if (!constrainLimits) return norm;
  const [min, max] = n.limits;
  return Math.max(min, Math.min(max, norm));
}

export function clampRealisticShoulder(
  n: PuppytNode,
  deg: number,
  by: Record<string, PuppytNode>,
  prometheusWings: boolean
): number {
  const norm = normalizeDeg(deg);
  if (prometheusWings) return norm;
  if (n.id === 'braceL' || n.id === 'braceR') {
    return Math.max(-12, Math.min(12, norm));
  }
  if (n.id === 'swivelL' || n.id === 'swivelR') {
    const txAng = by.thorax ? by.thorax.ang : 0;
    const rel = Math.max(-28, Math.min(28, normalizeDeg(norm - txAng)));
    return normalizeDeg(txAng + rel);
  }
  if (n.id === 'acromionL' || n.id === 'acromionR') {
    return Math.max(-35, Math.min(35, norm));
  }
  return norm;
}

export function getTensionRatio(n: PuppytNode): { ratio: number; atLimit: boolean } {
  if (!n.limits || n.lock) return { ratio: 0, atLimit: false };
  const [min, max] = n.limits;
  if (min <= -179 && max >= 179) return { ratio: 0, atLimit: false };
  const ang = normalizeDeg(n.ang);
  let ratio = 0;
  if (ang > 0 && max > 0) ratio = ang / max;
  else if (ang < 0 && min < 0) ratio = Math.abs(ang) / Math.abs(min);
  const clampedRatio = Math.max(0, Math.min(1.5, ratio));
  return { ratio: clampedRatio, atLimit: clampedRatio >= 0.96 };
}

export function parentOf(n: PuppytNode, by: Record<string, PuppytNode>): PuppytNode | null {
  return n.parent ? by[n.parent] ?? null : null;
}

export function pos(
  n: PuppytNode,
  by: Record<string, PuppytNode>,
  out: [number, number] = [0, 0]
): [number, number] {
  const par = parentOf(n, by);
  const w = par ? par.w : IDENTITY;
  const x = n.piv[0] + (n.parent ? 0 : n.tx);
  const y = n.piv[1] + (n.parent ? 0 : n.ty);
  out[0] = w[0] * x + w[2] * y + w[4];
  out[1] = w[1] * x + w[3] * y + w[5];
  return out;
}

export function setW(n: PuppytNode, rad: number, by: Record<string, PuppytNode>): void {
  const par = parentOf(n, by);
  const parPure = par ? par.pureW : IDENTITY;
  const parScaled = par ? par.w : IDENTITY;
  const px = n.piv[0];
  const py = n.piv[1];
  const wx = par ? parScaled[0] * px + parScaled[2] * py + parScaled[4] : px + n.tx;
  const wy = par ? parScaled[1] * px + parScaled[3] * py + parScaled[5] : py + n.ty;

  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const fx = n.flipX ? -1 : 1;
  const m00 = fx * c;
  const m01 = -s;
  const m10 = fx * s;
  const m11 = c;

  // Orthonormal unscaled world orientation (prevents parent scale from shearing children)
  const l00 = parPure[0] * m00 + parPure[2] * m10;
  const l10 = parPure[1] * m00 + parPure[3] * m10;
  const l01 = parPure[0] * m01 + parPure[2] * m11;
  const l11 = parPure[1] * m01 + parPure[3] * m11;

  const pw = n.pureW;
  pw[0] = l00;
  pw[1] = l10;
  pw[2] = l01;
  pw[3] = l11;
  pw[4] = wx - (l00 * px + l01 * py);
  pw[5] = wy - (l10 * px + l11 * py);

  const sx = Number.isFinite(n.sx) ? n.sx : 1;
  const sy = Number.isFinite(n.sy) ? n.sy : 1;
  const w = n.w;
  w[0] = l00 * sx;
  w[1] = l10 * sx;
  w[2] = l01 * sy;
  w[3] = l11 * sy;
  w[4] = wx - (w[0] * px + w[2] * py);
  w[5] = wy - (w[1] * px + w[3] * py);
}

export function computeChungusRibBounds(
  id: string,
  by?: Record<string, PuppytNode>,
  prometheusWings = false
): [number, number] {
  if (id !== 'ribR' && id !== 'ribL') return [-180, 180];
  const side: 'R' | 'L' = id === 'ribR' ? 'R' : 'L';
  const sideSign = side === 'L' ? 1 : -1;
  const fallbackMax = prometheusWings ? 12.5 : 8.5;
  if (!by || !by.thorax || !by.neck) {
    return side === 'R' ? [-fallbackMax, 2] : [-2, fallbackMax];
  }
  const th = by.thorax;
  const nk = by.neck;
  const sw = by['swivel' + side];
  const ac = by['acromion' + side];
  const br = by['brace' + side];

  const spinePx = th.w[0] || th.w[1] ? pos(th, by) : [th.piv[0], th.piv[1]];
  const neckPx = nk.w[0] || nk.w[1] ? pos(nk, by) : [nk.piv[0], nk.piv[1]];
  const spDx = neckPx[0] - spinePx[0];
  const spDy = neckPx[1] - spinePx[1];
  const spLen = Math.hypot(spDx, spDy) || 1;
  const upX = spDx / spLen;
  const upY = spDy / spLen;
  const outX = -upY * sideSign;
  const outY = upX * sideSign;

  let swivelMaxFlare = fallbackMax;
  if (sw && ac && (ac.w[0] || ac.w[1])) {
    const swPos = pos(sw, by);
    const acPos = pos(ac, by);
    const acLat = (acPos[0] - spinePx[0]) * outX + (acPos[1] - spinePx[1]) * outY;
    const swLat = (swPos[0] - spinePx[0]) * outX + (swPos[1] - spinePx[1]) * outY;
    const swivelCorridor = Math.max(0, swLat + (acLat - swLat) * 0.82);
    const maxLatTravel = Math.max(0, swivelCorridor * 0.34);
    const sternalHeight = 1010;
    const medialOffset = 74;
    const sinBound = Math.max(-0.5, Math.min(0.42, (maxLatTravel + medialOffset) / sternalHeight));
    swivelMaxFlare = swivelCorridor < 130 ? 0 : Math.max(0, Math.asin(sinBound) / PUPPYT_DEG);
  }

  let collarMaxFlare = fallbackMax;
  if (br && ac && br.aim && (br.w[0] || br.w[1]) && (ac.w[0] || ac.w[1])) {
    const brPos = pos(br, by);
    const acPos = pos(ac, by);
    const L0 = Math.hypot(br.aim.from[0] - br.piv[0], br.aim.from[1] - br.piv[1]) || 1;
    const curDist = Math.hypot(acPos[0] - brPos[0], acPos[1] - brPos[1]);
    const stretchMax = L0 * (prometheusWings ? br.aim.max * 1.04 : br.aim.max);
    const stretchSat = Math.max(0, Math.min(1, (curDist - L0 * 0.98) / Math.max(1, stretchMax - L0 * 0.98)));
    const maxTilt = br.limits ? Math.max(Math.abs(br.limits[0]), Math.abs(br.limits[1])) : 18;
    const angSat = Math.max(0, Math.min(1, Math.abs(normalizeDeg(br.ang)) / Math.max(1, maxTilt)));
    const brAxis = Math.atan2(br.w[1], br.w[0]);
    const thAxis = Math.atan2(th.w[1], th.w[0]);
    const swingDeg = Math.abs(normalizeDeg((brAxis - thAxis) / PUPPYT_DEG));
    const maxSwing = prometheusWings ? 36 : 22;
    const swingSat = Math.max(0, Math.min(1, swingDeg / maxSwing));
    const collarSat = Math.max(angSat, stretchSat, swingSat);
    collarMaxFlare = collarSat >= 0.985 ? 0 : fallbackMax * (1 - collarSat * 0.82);
  }

  const maxOut = Math.max(0, Math.min(fallbackMax, swivelMaxFlare, collarMaxFlare));
  const minIn = 2.0;
  return side === 'R' ? [-maxOut, minIn] : [-minIn, maxOut];
}

export function clampChungusRibAngle(
  id: string,
  deg: number,
  mode: RibAnchorMode,
  by?: Record<string, PuppytNode>,
  prometheusWings = false
): number {
  const safe = Number.isFinite(deg) ? deg : 0;
  const norm = normalizeDeg(safe);
  if (mode !== 'lower') return norm;
  const [min, max] = computeChungusRibBounds(id, by, prometheusWings);
  return Math.max(min, Math.min(max, norm));
}

export function applyRibAnchorMode(
  by: Record<string, PuppytNode>,
  mode: RibAnchorMode,
  prometheusWings = false
): void {
  const ribR = by.ribR;
  const ribL = by.ribL;
  if (!ribR || !ribL) return;

  if (mode === 'upper') {
    const th = by.thorax;
    const nk = by.neck;
    const px = nk ? nk.rest[0] : 1258;
    const py = th && nk ? nk.rest[1] + (th.rest[1] - nk.rest[1]) * 0.216 : 1130;
    ribR.piv = [px, py];
    ribR.rest = [px, py];
    ribL.piv = [px, py];
    ribL.rest = [px, py];
  } else if (mode === 'lower') {
    const junc = by.thorax;
    const px = junc ? junc.rest[0] : 1257.5;
    const py = junc ? junc.rest[1] : 2099.5;
    ribR.piv = [px, py];
    ribR.rest = [px, py];
    ribL.piv = [px, py];
    ribL.rest = [px, py];
    ribR.ang = clampChungusRibAngle('ribR', ribR.ang, 'lower', by, prometheusWings);
    ribL.ang = clampChungusRibAngle('ribL', ribL.ang, 'lower', by, prometheusWings);
  } else {
    const nk = by.neck;
    const nx = nk ? nk.rest[0] : 1258;
    const ny = nk ? nk.rest[1] : 862.5;
    ribR.piv = [nx - 43, ny + 186.5];
    ribR.rest = [nx - 43, ny + 186.5];
    ribL.piv = [nx + 41, ny + 130.5];
    ribL.rest = [nx + 41, ny + 130.5];
  }
}

export function bondAng(
  n: PuppytNode,
  by: Record<string, PuppytNode>,
  bondOn: boolean,
  prometheusWings = false
): number {
  const b = n.bond;
  if (!b || !bondOn || !b.aim) return n.ang;
  const ac = by[b.aim.to];
  if (!ac || !n.parent || !b.parent) return n.ang;
  const lw = by[n.parent].w;
  const tw = by[b.parent].w;
  const bp = b.piv;
  const nx = tw[0] * bp[0] + tw[2] * bp[1] + tw[4];
  const ny = tw[1] * bp[0] + tw[3] * bp[1] + tw[5];
  const f = b.aim.from;
  const L0 = Math.hypot(f[0] - bp[0], f[1] - bp[1]);
  const lo = b.aim.min * L0;
  const hi = b.aim.max * L0;
  const px = n.piv[0];
  const py = n.piv[1];
  const ax = ac.piv[0] - px;
  const ay = ac.piv[1] - py;
  const sideSign = n.id.endsWith('L') ? 1 : -1;
  const txAng = by[b.parent] ? by[b.parent].ang : 0;
  const stretchTol = prometheusWings ? 1.45 : 1.12;

  const v = (a: number) => {
    const r = a * PUPPYT_DEG;
    const c = Math.cos(r);
    const s = Math.sin(r);
    const X = px + c * ax - s * ay;
    const Y = py + s * ax + c * ay;
    const wx = lw[0] * X + lw[2] * Y + lw[4];
    const wy = lw[1] * X + lw[3] * Y + lw[5];
    const d = Math.hypot(wx - nx, wy - ny);
    const loSoft = lo * (prometheusWings ? 0.8 : 0.92);
    const hiSoft = hi * stretchTol;
    const distErr = d < loSoft ? loSoft - d : d > hiSoft ? d - hiSoft : 0;
    const lateralSigned = ((wx - nx) * tw[0] + (wy - ny) * tw[1]) * sideSign;
    const minLat = prometheusWings ? 32 : 240;
    const latErr = lateralSigned < minLat ? (minLat - lateralSigned) * 4 : 0;
    const relAng = Math.abs(normalizeDeg(a - txAng));
    const maxRel = prometheusWings ? 95 : 32;
    const angErr = relAng > maxRel ? (relAng - maxRel) * 25 : 0;
    return distErr + latErr + angErr;
  };

  const seed = prometheusWings
    ? n.ang
    : normalizeDeg(txAng + Math.max(-28, Math.min(28, normalizeDeg(n.ang - txAng))));
  if (v(seed) === 0) return seed;
  for (let i = 1; i <= 720; i++) {
    for (const s of [1, -1]) {
      const a = seed + s * i * 0.5;
      if (v(a) === 0) {
        let bad = a - s * 0.5;
        let good = a;
        for (let j = 0; j < 20; j++) {
          const m = (bad + good) / 2;
          if (v(m) === 0) good = m;
          else bad = m;
        }
        return good;
      }
    }
  }
  let best = seed;
  let bv = v(best);
  for (let i = -360; i <= 360; i++) {
    const a = seed + i * 0.5;
    const e = v(a);
    if (e < bv) {
      bv = e;
      best = a;
    }
  }
  return best;
}

export function setAim(
  n: PuppytNode,
  by: Record<string, PuppytNode>,
  bondOn: boolean,
  prometheusWings = false
): void {
  if (!n.aim || !n.parent) return;
  const pw = by[n.parent].w;
  const p = n.piv;
  const F = n.aim.from;
  const ac = by[n.aim.to];
  if (!ac || !ac.parent) return;
  const aw = by[ac.parent].w;
  const Qx = aw[0] * ac.piv[0] + aw[2] * ac.piv[1] + aw[4];
  const Qy = aw[1] * ac.piv[0] + aw[3] * ac.piv[1] + aw[5];
  const X = pw[0] * p[0] + pw[2] * p[1] + pw[4];
  const Y = pw[1] * p[0] + pw[3] * p[1] + pw[5];
  const vx = Qx - X;
  const vy = Qy - Y;
  const rawDist = Math.hypot(vx, vy);
  const dist = rawDist > 1e-3 ? rawDist : 1;
  const L0 = Math.hypot(F[0] - p[0], F[1] - p[1]) || 1;
  const maxTilt = prometheusWings ? 62 : 14;
  const clampedAng = Math.max(-maxTilt, Math.min(maxTilt, normalizeDeg(n.ang)));
  const dirX = rawDist > 1e-3 ? vx / dist : Math.cos(Math.atan2(pw[1], pw[0]));
  const dirY = rawDist > 1e-3 ? vy / dist : Math.sin(Math.atan2(pw[1], pw[0]));
  let a = Math.atan2(dirY, dirX) - Math.atan2(F[1] - p[1], F[0] - p[0]) + clampedAng * PUPPYT_DEG;
  if (!prometheusWings) {
    const thoraxRad = Math.atan2(pw[1], pw[0]);
    const relRad = Math.atan2(Math.sin(a - thoraxRad), Math.cos(a - thoraxRad));
    const maxSwing = 24 * PUPPYT_DEG;
    a = thoraxRad + Math.max(-maxSwing, Math.min(maxSwing, relRad));
  }
  const delta = dist - L0;
  const rawSlide = delta * (prometheusWings ? 0.78 : 0.5);
  const [minS, maxS] = bondOn
    ? prometheusWings
      ? [-0.52 * L0, 0.36 * L0]
      : [-0.24 * L0, 0.14 * L0]
    : prometheusWings
      ? [-0.26 * L0, 0.22 * L0]
      : [-0.14 * L0, 0.08 * L0];
  const span = Math.max(1, (maxS - minS) * 0.5);
  const mid = (minS + maxS) * 0.5;
  const slide = mid + span * Math.tanh((rawSlide - mid) / span);
  const stretchRatio = (delta - slide) / L0;
  const scaleCap = prometheusWings ? 0.028 : 0.014;
  const microScale =
    1 + Math.max(-scaleCap, Math.min(scaleCap, stretchRatio * (prometheusWings ? 0.08 : 0.06)));
  const c = Math.cos(a) * microScale;
  const s = Math.sin(a) * microScale;
  const pureW = n.pureW;
  pureW[0] = c;
  pureW[1] = s;
  pureW[2] = -s;
  pureW[3] = c;
  pureW[4] = X + dirX * slide - (c * p[0] - s * p[1]);
  pureW[5] = Y + dirY * slide - (s * p[0] + c * p[1]);

  const sx = Number.isFinite(n.sx) ? n.sx : 1;
  const sy = Number.isFinite(n.sy) ? n.sy : 1;
  const w = n.w;
  w[0] = c * sx;
  w[1] = s * sx;
  w[2] = -s * sy;
  w[3] = c * sy;
  w[4] = X + dirX * slide - (w[0] * p[0] + w[2] * p[1]);
  w[5] = Y + dirY * slide - (w[1] * p[0] + w[3] * p[1]);
}

export function solvePuppytRig(
  nodes: PuppytNode[],
  by: Record<string, PuppytNode>,
  bondOn = true,
  wingPop = 0,
  ribAnchor: RibAnchorMode = 'upper'
): void {
  const activeWings = wingPop > 0.05;
  for (const n of nodes) {
    if (!Number.isFinite(n.ang)) n.ang = 0;
    if (!Number.isFinite(n.tx)) n.tx = 0;
    if (!Number.isFinite(n.ty)) n.ty = 0;
    if (!Number.isFinite(n.piv[0]) || !Number.isFinite(n.piv[1])) {
      n.piv = n.rest.slice() as [number, number];
    }

    if (n.id === 'wingL' || n.id === 'wingR') {
      n.ghost = !activeWings;
      if (wingPop > 0.001 && n.parent && by[n.parent]) {
        const br = by[n.parent];
        const side = n.id === 'wingL' ? 1 : -1;
        const flareRad = side * -32 * wingPop * PUPPYT_DEG;
        const c = Math.cos(flareRad);
        const s = Math.sin(flareRad);
        const dx = n.rest[0] - br.piv[0];
        const dy = n.rest[1] - br.piv[1];
        n.piv = [
          br.piv[0] + c * dx - s * dy + side * 42 * wingPop,
          br.piv[1] + s * dx + c * dy - 26 * wingPop,
        ];
      } else {
        n.piv = n.rest.slice() as [number, number];
      }
    }

    if (n.aim) {
      setAim(n, by, bondOn, activeWings);
    } else {
      let solvedAng = bondAng(n, by, bondOn, activeWings);
      if (ribAnchor === 'lower' && (n.id === 'ribR' || n.id === 'ribL')) {
        solvedAng = clampChungusRibAngle(n.id, solvedAng, 'lower', by, activeWings);
        n.ang = solvedAng;
      }
      n.eff = Number.isFinite(solvedAng) ? solvedAng : 0;
      setW(n, n.eff * PUPPYT_DEG, by);
    }
  }
}

const DORSAL_BACKVIEW_PRIORITY = new Set([
  'Upperspine',
  'Backshoulder',
  'Shoulderswivel',
  'V',
]);

export function sortPiecesForWings(
  pieces: PuppytPiece[],
  popped: boolean,
  isBackView = false
): void {
  for (const p of pieces) {
    const base = p.i0 ?? p.i;
    if (isBackView) {
      // 3rd-Person Back View: promote dorsal spine, scapulae (Backshoulder), & rear neck in front of anterior ribs/clavicles
      if (p.wing && p.node) {
        p.i = popped ? (p.node.id === 'braceR' ? 3.5 : 3.6) : p.node.id === 'braceR' ? 8.2 : 8.4;
      } else if (DORSAL_BACKVIEW_PRIORITY.has(p.name)) {
        p.i = Math.max(0.5, base * 0.25);
      } else if (p.name === 'Ribcage' || p.name === 'Neckring' || p.name === 'Shouldertendon' || p.name === 'Shoulderbone') {
        p.i = 32 + base * 0.1;
      } else {
        p.i = base;
      }
    } else if (p.wing && p.node) {
      p.i = popped ? (p.node.id === 'braceR' ? 22.5 : 31.5) : base;
    } else {
      p.i = base;
    }
  }
  pieces.sort((a, b) => b.i - a.i);
}

export function getPieceWorldMatrix(
  p: PuppytPiece,
  wingPop = 0,
  out: Float64Array = new Float64Array(6)
): Float64Array {
  const n = p.node;
  if (!n) {
    out.set(IDENTITY);
    return out;
  }
  const w = n.w;
  if (!p.wing || wingPop <= 0.001) {
    out.set(w);
    return out;
  }
  const side = n.id === 'braceL' ? 1 : -1;
  const elasticBend = Math.max(-18, Math.min(18, n.ang * 0.42)) * wingPop;
  const flareRad = (side * -32 * wingPop + elasticBend) * PUPPYT_DEG;
  const chordScale =
    1 + Math.max(-0.08, Math.min(0.14, Math.abs(n.ang) * 0.0028 * wingPop + (wingPop - 1) * 0.22));
  const c = Math.cos(flareRad) * chordScale;
  const s = Math.sin(flareRad) * chordScale;
  const px = n.piv[0];
  const py = n.piv[1];
  const tx = side * 42 * wingPop;
  const ty = -26 * wingPop;
  const e = px - c * px + s * py + tx;
  const f = py - s * px - c * py + ty;
  out[0] = w[0] * c + w[2] * s;
  out[1] = w[1] * c + w[3] * s;
  out[2] = -w[0] * s + w[2] * c;
  out[3] = -w[1] * s + w[3] * c;
  out[4] = w[0] * e + w[2] * f + w[4];
  out[5] = w[1] * e + w[3] * f + w[5];
  return out;
}

function addDigits(def: PuppytRawRigDef): void {
  if (def.dg) return;
  def.dg = 1;
  const map: Record<string, PuppytRawNode> = {};
  def.nodes.forEach((n) => {
    map[n.id] = n;
  });
  for (const s of ['R', 'L'] as const) {
    const m = s === 'L';
    const X = (x: number) => (m ? 2504 - x : x);
    const handNode = map['hand' + s];
    if (handNode?.pieces?.length) {
      const pal = handNode.pieces[0] as unknown as PuppytPiece;
      pal.restBox = { x: pal.x, y: pal.y, w: pal.w, h: pal.h };
      pal.gotzManaged = true;
      pal.mir = m;
      def.nodes.push(
        { id: 'thumb' + s, name: 'Thumb ' + s, parent: 'hand' + s, pivot: [X(545), 4030], pieces: [] },
        { id: 'thumbTip' + s, name: 'Thumb tip ' + s, parent: 'thumb' + s, pivot: [X(609), 4347], pieces: [], lock: 1 },
        { id: 'finger' + s, name: 'Finger ' + s, parent: 'hand' + s, pivot: [X(492), 4183], pieces: [] },
        { id: 'fingerTip' + s, name: 'Finger tip ' + s, parent: 'finger' + s, pivot: [X(492), 4697], pieces: [], lock: 1 }
      );
    }
    const footNode = map['foot' + s];
    if (footNode) {
      const ballPivot: [number, number] = s === 'R' ? [...FOOT_R_BALL_PIVOT] : [...FOOT_L_BALL_PIVOT];
      const heelPivot: [number, number] = s === 'R' ? [...FOOT_R_HEEL_PIVOT] : [...FOOT_L_HEEL_PIVOT];
      const cuboidPivot: [number, number] = s === 'R' ? [...FOOT_R_CUBOID_PIVOT] : [...FOOT_L_CUBOID_PIVOT];
      def.nodes.push(
        { id: 'heel' + s, name: (m ? 'L.' : 'R.') + 'Heel', parent: 'foot' + s, pivot: heelPivot, pieces: [], lock: 1 },
        { id: 'cuboid' + s, name: (m ? 'L.' : 'R.') + 'Cuboid', parent: 'heel' + s, pivot: cuboidPivot, pieces: [], lock: 1 },
        { id: 'toeBall' + s, name: (m ? 'L.' : 'R.') + 'Toe', parent: 'foot' + s, pivot: ballPivot, pieces: [] },
        { id: 'toe' + s, name: 'Toe tip ' + s, parent: 'toeBall' + s, pivot: [m ? 2145 : 359, 7644], pieces: [], lock: 1 }
      );
    }
  }
}

function addJoints(def: PuppytRawRigDef): void {
  if (def.jn) return;
  def.jn = 1;
  const map: Record<string, PuppytRawNode> = {};
  def.nodes.forEach((n) => {
    map[n.id] = n;
  });

  if (map.head) {
    def.nodes.push(
      { id: 'lip', name: 'Head pose swivel', parent: 'head', pivot: [1259, 685], pieces: [] },
      { id: 'chinTip', name: 'Skull tip', parent: 'lip', pivot: [1259, 890], pieces: [], lock: 1 }
    );
  }

  if (map.femurR && map.femurL && map.pelvis) {
    map.femurR.pivot = [990, 3598];
    map.femurL.pivot = [1521, 3598];
    map.pelvis.bar = ['femurR', 'femurL'];
    if (map.pelvis.pieces && map.pelvis.pieces.length >= 2 && !map.hipR && !map.hipL) {
      const sorted = map.pelvis.pieces.slice().sort((a, b) => a.x - b.x);
      map.pelvis.pieces = [];
      def.nodes.push(
        { id: 'hipR', name: 'Right hip', parent: 'pelvis', pivot: [1257, 3382], pieces: [sorted[0]] },
        { id: 'hipL', name: 'Left hip', parent: 'pelvis', pivot: [1257, 3382], pieces: [sorted[1]] }
      );
      map.femurR.parent = 'hipR';
      map.femurL.parent = 'hipL';
    }
  }

  if (map.thorax && map.thorax.pieces && !map.ribR && !map.ribL) {
    const ribs = map.thorax.pieces.filter((p) => p.name === 'Ribcage').sort((a, b) => a.x - b.x);
    if (ribs.length >= 2) {
      map.thorax.pieces = map.thorax.pieces.filter((p) => p.name !== 'Ribcage');
      map.thorax.bar = ['ribR', 'ribL'];
      def.nodes.push(
        { id: 'ribR', name: 'Right ribcage', parent: 'thorax', pivot: [1257.5, 2377.5], pieces: [ribs[0]] },
        { id: 'ribL', name: 'Left ribcage', parent: 'thorax', pivot: [1257.5, 2377.5], pieces: [ribs[1]] }
      );
    }
  }

  for (const s of ['L', 'R'] as const) {
    const br = map['brace' + s];
    if (!br || !map.neck) continue;
    br.pivot = map.neck.pivot.slice() as [number, number];
    const bw = br.pieces?.find((p) => p.name === 'Backshoulder');
    if (bw) {
      bw.x = s === 'L' ? 1147 : 643;
      bw.y = 1115;
      def.nodes.push({
        id: 'wing' + s,
        name: 'Back wing ' + s,
        parent: 'brace' + s,
        pivot: [bw.x + bw.w / 2, bw.y + bw.h / 2],
        pieces: [],
        lock: 1,
        ghost: 1,
      });
    }
    def.nodes.push({
      id: 'swivelTip' + s,
      name: 'Swivel tip ' + s,
      parent: 'swivel' + s,
      pivot: s === 'L' ? [2031, 1334] : [483, 1390],
      pieces: [],
      lock: 1,
    });
  }
}

function applyAntiPhallicLowerSpine(def: PuppytRawRigDef): number {
  if (def.antiPhallic) return 0;
  def.antiPhallic = 1;
  const map: Record<string, PuppytRawNode> = {};
  def.nodes.forEach((n) => {
    map[n.id] = n;
  });
  const lum = map.lumbar;
  if (!lum || !lum.pieces?.length) return 0;
  const hipRef = map.hipR ?? map.hipL ?? map.pelvis;
  const hipY = hipRef ? hipRef.pivot[1] : lum.pivot[1];
  let lumbarBottomY = -1e9;
  for (const p of lum.pieces) {
    lumbarBottomY = Math.max(lumbarBottomY, p.y + p.h);
  }
  const shiftY = hipY - lumbarBottomY;
  if (!Number.isFinite(shiftY) || Math.abs(shiftY) <= 0.5) return 0;

  for (const p of lum.pieces) {
    p.y += shiftY;
    const rp = p as unknown as { restBox?: { y: number } };
    if (rp.restBox) rp.restBox.y += shiftY;
  }

  const isAboveLumbar = (n: PuppytRawNode): boolean => {
    let cur = n.parent ? map[n.parent] : undefined;
    let guard = 0;
    while (cur && guard++ < 64) {
      if (cur.id === 'lumbar') return true;
      cur = cur.parent ? map[cur.parent] : undefined;
    }
    return false;
  };

  for (const n of def.nodes) {
    if (!isAboveLumbar(n)) continue;
    n.pivot[1] += shiftY;
    if (n.aim?.from) {
      n.aim.from[1] += shiftY;
    }
    if (n.pieces) {
      for (const p of n.pieces) {
        p.y += shiftY;
        const rp = p as unknown as { restBox?: { y: number } };
        if (rp.restBox) rp.restBox.y += shiftY;
      }
    }
  }
  return shiftY;
}

export function buildPuppytRigGraph(
  rawInput: PuppytRawRigDef,
  rawParts?: PuppytRawPartsDef
): PuppytRigGraph {
  const def: PuppytRawRigDef = JSON.parse(JSON.stringify(rawInput));
  addDigits(def);
  addJoints(def);
  const lumbarShiftY = applyAntiPhallicLowerSpine(def);

  let nodes: PuppytNode[] = def.nodes.map((n) => ({
    id: n.id,
    name: n.name || n.id,
    parent: n.parent || null,
    aim: n.aim || null,
    pieces: (n.pieces || []).map((p) => ({
      ...p,
      restBox: { x: p.x, y: p.y, w: p.w, h: p.h },
    })) as PuppytPiece[],
    piv: n.pivot.slice() as [number, number],
    rest: n.pivot.slice() as [number, number],
    ang: n.ang || 0,
    tx: 0,
    ty: 0,
    sx: 1,
    sy: 1,
    w: new Float64Array([1, 0, 0, 1, 0, 0]),
    pureW: new Float64Array([1, 0, 0, 1, 0, 0]),
    eff: 0,
    bond: null,
    lock: !!n.lock,
    ghost: !!n.ghost,
    bar: n.bar || null,
    at: null,
    limits: PUPPYT_ANATOMICAL_LIMITS[n.id] ?? [-180, 180],
    flipX: !!n.flipX,
  }));

  const by: Record<string, PuppytNode> = {};
  nodes.forEach((n) => {
    by[n.id] = n;
  });

  nodes.forEach((n) => {
    if (n.aim) {
      const ac = by[n.aim.to];
      const sw = ac && ac.parent ? by[ac.parent] : null;
      if (sw) sw.bond = n;
    }
  });

  const ord: PuppytNode[] = [];
  const seen = new Set<string>();
  const dep = (n: PuppytNode) => {
    const d: Array<string | null> = [n.parent];
    if (n.aim) d.push(n.aim.to);
    return d;
  };
  const vis = (n: PuppytNode) => {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    for (const d of dep(n)) {
      if (d && by[d]) vis(by[d]);
    }
    if (n.bond && n.bond.parent && by[n.bond.parent]) {
      vis(by[n.bond.parent]);
    }
    ord.push(n);
  };
  nodes.forEach(vis);
  nodes = ord;

  const root = nodes.find((n) => !n.parent) || nodes[0];
  const pieces: PuppytPiece[] = [];
  nodes.forEach((n) =>
    n.pieces.forEach((p) => {
      p.node = n;
      p.i0 = p.i;
      p.wing = p.name === 'Backshoulder';
      pieces.push(p);
    })
  );
  pieces.sort((a, b) => b.i - a.i);

  const rawHeadPieces = rawParts?.head?.views?.[0]?.pieces ?? [];
  const headPieces: PuppytHeadPartPiece[] = rawHeadPieces.map((hp) => ({
    name: hp.name,
    x: hp.x,
    y: hp.y,
    w: hp.w,
    h: hp.h,
    on: hp.on ?? true,
    src: hp.src,
  }));

  const rawFootPieces = rawParts?.foot?.views?.[0]?.pieces ?? [];
  const footPieces: PuppytFootPartPiece[] = rawFootPieces.map((fp, idx) => ({
    name: fp.name,
    x: fp.x,
    y: fp.y,
    w: fp.w,
    h: fp.h,
    on: fp.on ?? true,
    src: fp.src,
    isToe: FOOT_TOE_PIECE_INDICES.has(idx),
  }));

  solvePuppytRig(nodes, by, true, 0, 'upper');

  return {
    W: def.W || 2500,
    H: def.H || 8742,
    nodes,
    by,
    root,
    pieces,
    headPieces,
    footPieces,
    lumbarShiftY,
  };
}

const HEAD_EYE_PIECE_NAMES = new Set([
  'Pupil1',
  'Iris1',
  'Eyeball1',
  'Pupil2',
  'Iris2',
  'Eyeball2',
]);
const frontSkullBakedCache: Partial<Record<'on' | 'off', string>> = {};

/**
 * Bakes the Front Skull modular parts (matching Bitruvian.Human.Puppyt partRigEngine.ts)
 * with Pupil1/2, Iris1/2, Eyeball1/2 deactivated by default (`eyesActive = false`).
 */
export async function bakeFrontSkullDataUrl(
  headPieces: PuppytHeadPartPiece[],
  eyesActive: boolean,
  targetBox = { w: 601, h: 896 }
): Promise<string | null> {
  if (!headPieces.length) return null;
  const cacheKey = eyesActive ? 'on' : 'off';
  if (frontSkullBakedCache[cacheKey]) return frontSkullBakedCache[cacheKey]!;

  const baseActive = headPieces.filter((p) => p.on && !HEAD_EYE_PIECE_NAMES.has(p.name));
  const bboxSource = baseActive.length ? baseActive : headPieces;
  const x0 = Math.min(...bboxSource.map((p) => p.x));
  const y0 = Math.min(...bboxSource.map((p) => p.y));
  const x1 = Math.max(...bboxSource.map((p) => p.x + p.w));
  const y1 = Math.max(...bboxSource.map((p) => p.y + p.h));
  const spanW = Math.max(1, x1 - x0);
  const spanH = Math.max(1, y1 - y0);

  const a = targetBox.w / spanW;
  const d = targetBox.h / spanH;
  const e = -x0 * a;
  const f = -y0 * d;

  const decoded = await Promise.all(
    headPieces.map(
      (p) =>
        new Promise<HTMLImageElement | null>((resolve) => {
          const isEye = HEAD_EYE_PIECE_NAMES.has(p.name);
          const shouldRender = isEye ? eyesActive : p.on;
          if (!shouldRender || !p.src) {
            resolve(null);
            return;
          }
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = p.src;
        })
    )
  );

  const c = document.createElement('canvas');
  c.width = targetBox.w;
  c.height = targetBox.h;
  const g = c.getContext('2d');
  if (!g) return null;

  for (let k = headPieces.length - 1; k >= 0; k--) {
    const img = decoded[k];
    const p = headPieces[k];
    if (!img) continue;
    g.setTransform(a, 0, 0, d, e, f);
    g.drawImage(img, p.x, p.y, p.w, p.h);
  }

  const url = c.toDataURL('image/png');
  frontSkullBakedCache[cacheKey] = url;
  return url;
}

// Tints the purple #5d03b4 pixels of Neckring to rich Olive (#5B6D34) while keeping black outlines intact
export function createOliveNeckringDataUrl(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      if (!g) {
        resolve(src);
        return;
      }
      g.drawImage(img, 0, 0);
      const imgData = g.getImageData(0, 0, c.width, c.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 10) continue;
        const r = d[i];
        const gr = d[i + 1];
        const b = d[i + 2];
        if (b > gr + 16 && b > r + 10) {
          const lum = (r * 0.25 + gr * 0.1 + b * 0.65) / 180;
          d[i] = Math.min(255, Math.round(98 * Math.max(0.65, lum)));
          d[i + 1] = Math.min(255, Math.round(118 * Math.max(0.65, lum)));
          d[i + 2] = Math.min(255, Math.round(54 * Math.max(0.65, lum)));
        }
      }
      g.putImageData(imgData, 0, 0);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

// Skull specs aligned crown-to-crown with Front skull (front crown ~18, head.piv ~873.5 pre-shift)
export const SKULL_VIEW_SPECS: Record<
  'side' | 'back',
  { url: string; sx: number; sy: number; sw: number; sh: number; w: number; h: number; dx: number; dy: number }
> = {
  side: {
    url: '/assets/skull-side.png',
    sx: 368,
    sy: 96,
    sw: 2240,
    sh: 2884,
    w: 668,
    h: 874,
    dx: 926,
    dy: 14,
  },
  back: {
    url: '/assets/skull-back.png',
    sx: 504,
    sy: 76,
    sw: 1992,
    sh: 3040,
    w: 601,
    h: 896,
    dx: 958,
    dy: 12,
  },
};

export function getSkullBoxForHead(
  view: SkullViewMode,
  headNode?: PuppytNode | null
): { x: number; y: number; w: number; h: number } | null {
  if (view === 'front') return null;
  const spec = SKULL_VIEW_SPECS[view];
  const hp = headNode?.pieces?.[0];
  const headOffsetY = hp ? (hp.restBox ? hp.restBox.y : hp.y) - 18 : 0;
  return { x: spec.dx, y: spec.dy + headOffsetY, w: spec.w, h: spec.h };
}

const skullViewDataCache: Partial<Record<'side' | 'back', string>> = {};

export function loadNormalizedSkullDataUrl(mode: 'side' | 'back'): Promise<string> {
  if (skullViewDataCache[mode]) return Promise.resolve(skullViewDataCache[mode]!);
  const spec = SKULL_VIEW_SPECS[mode];
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = spec.w;
      c.height = spec.h;
      const g = c.getContext('2d', { willReadFrequently: true });
      if (!g) {
        reject(new Error('2D context unavailable'));
        return;
      }
      g.clearRect(0, 0, spec.w, spec.h);
      g.drawImage(img, spec.sx, spec.sy, spec.sw, spec.sh, 0, 0, spec.w, spec.h);
      const imgData = g.getImageData(0, 0, spec.w, spec.h);
      const d = imgData.data;

      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let count = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 220) continue;
        const r = d[i];
        const gr = d[i + 1];
        const b = d[i + 2];
        if (b > 120 && b > gr + 35 && b > r + 25) {
          sumR += r;
          sumG += gr;
          sumB += b;
          count++;
        }
      }
      const domR = count > 0 ? sumR / count : 110;
      const domG = count > 0 ? sumG / count : 5;
      const domB = count > 0 ? sumB / count : 241;

      const TARGET_R = 93;
      const TARGET_G = 3;
      const TARGET_B = 180;

      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 10) continue;
        const r = d[i];
        const gr = d[i + 1];
        const b = d[i + 2];
        if (b > gr + 16 && b > r + 10) {
          if (Math.abs(r - domR) <= 14 && Math.abs(gr - domG) <= 14 && Math.abs(b - domB) <= 14) {
            d[i] = TARGET_R;
            d[i + 1] = TARGET_G;
            d[i + 2] = TARGET_B;
          } else if (gr > domG + 14) {
            const wMix = Math.max(0, Math.min(1, (gr - domG) / Math.max(1, 255 - domG)));
            d[i] = Math.round(TARGET_R + (255 - TARGET_R) * wMix);
            d[i + 1] = Math.round(TARGET_G + (255 - TARGET_G) * wMix);
            d[i + 2] = Math.round(TARGET_B + (255 - TARGET_B) * wMix);
          } else {
            const kMix = Math.max(0, Math.min(1.15, b / Math.max(1, domB)));
            d[i] = Math.min(255, Math.round(TARGET_R * kMix));
            d[i + 1] = Math.min(255, Math.round(TARGET_G * kMix));
            d[i + 2] = Math.min(255, Math.round(TARGET_B * kMix));
          }
        } else if (r < 32 && gr < 36 && b < 32) {
          const lum = Math.round(0.299 * r + 0.587 * gr + 0.114 * b);
          d[i] = lum < 14 ? 0 : lum;
          d[i + 1] = lum < 14 ? 0 : lum;
          d[i + 2] = lum < 14 ? 0 : lum;
        }
      }

      g.putImageData(imgData, 0, 0);
      const url = c.toDataURL('image/png');
      skullViewDataCache[mode] = url;
      resolve(url);
    };
    img.onerror = () => reject(new Error(`Failed to load ${spec.url}`));
    img.src = spec.url;
  });
}

export interface PuppytApplyOptions {
  ribAnchor?: RibAnchorMode;
  wingPop?: number;
  constrainLimits?: boolean;
  spineUnlocked?: boolean;
  headFlipX?: boolean;
  handStateL?: GotzHandState;
  handStateR?: GotzHandState;
  useAdvancedFeet?: boolean;
  footImpactDropL?: number; // 0..1 downward 3D impact rotation amplitude
  footImpactDropR?: number;
  lGroundOffsetY?: number;  // Road hitch elevation offset in SVG stage units
  rGroundOffsetY?: number;
  lumbarTwist?: number;     // Independent lower-spine compensation rotation (deg)
  isBackView?: boolean;     // True when Back Skull (3rd-person view) reverses bones L<->R and depth
}

function syncHandDigitNodes(
  side: 'L' | 'R',
  by: Record<string, PuppytNode>,
  handState: GotzHandState | undefined
): void {
  const hand = by['hand' + side];
  if (!hand || !handState) return;
  const solved = solveGotzHand(handState, GOTZ_PROPS_ANAT);
  const mirror = handState.mirror;

  const middlePts = solved.middle.pts;
  const thumbPts = solved.thumb.pts;
  const fingerBase = middlePts[1] ?? [0, -4];
  const fingerTip = middlePts[middlePts.length - 1] ?? [0, -9];
  const thumbBase = thumbPts[1] ?? [-1.5, -2.5];
  const thumbTip = thumbPts[thumbPts.length - 1] ?? [-2.8, -5];

  const fingerNode = by['finger' + side];
  const fingerTipNode = by['fingerTip' + side];
  const thumbNode = by['thumb' + side];
  const thumbTipNode = by['thumbTip' + side];

  if (fingerNode) {
    const off = gotzToPuppetOffset(fingerBase[0], fingerBase[1], mirror);
    fingerNode.piv = [hand.piv[0] + off[0], hand.piv[1] + off[1]];
    fingerNode.rest = [fingerNode.piv[0], fingerNode.piv[1]];
  }
  if (fingerTipNode) {
    const off = gotzToPuppetOffset(fingerTip[0], fingerTip[1], mirror);
    fingerTipNode.piv = [hand.piv[0] + off[0], hand.piv[1] + off[1]];
    fingerTipNode.rest = [fingerTipNode.piv[0], fingerTipNode.piv[1]];
  }
  if (thumbNode) {
    const off = gotzToPuppetOffset(thumbBase[0], thumbBase[1], mirror);
    thumbNode.piv = [hand.piv[0] + off[0], hand.piv[1] + off[1]];
    thumbNode.rest = [thumbNode.piv[0], thumbNode.piv[1]];
  }
  if (thumbTipNode) {
    const off = gotzToPuppetOffset(thumbTip[0], thumbTip[1], mirror);
    thumbTipNode.piv = [hand.piv[0] + off[0], hand.piv[1] + off[1]];
    thumbTipNode.rest = [thumbTipNode.piv[0], thumbTipNode.piv[1]];
  }
}

export interface PerspectiveSpineBias {
  lumbar: number;
  thorax: number;
}

/**
 * Computes a light 1-point perspective S-curve across lumbar & thorax
 * relative to the SVG vanishing point and horizon line (ported from Bitruvian.Human.Puppyt).
 */
export function computePerspectiveSpineBend(
  fxSvg: number,
  vpXSvg: number,
  horizonYSvg: number,
  thoraxYSvg: number,
  strength = 1.0
): PerspectiveSpineBias {
  const s = Math.max(0, Math.min(1.8, strength));
  if (s <= 0.01) return { lumbar: 0, thorax: 0 };
  // Convert SVG coords (~23.2% of native) into native scaling feel
  const dx = (fxSvg - vpXSvg) / PUPPYT_STAGE_SCALE;
  const dy = (horizonYSvg - thoraxYSvg) / PUPPYT_STAGE_SCALE;
  const hFactor = Math.tanh(dx / 1400);
  const vFactor = Math.tanh(dy / 2200);
  const lumbar = (hFactor * 5.2 + hFactor * vFactor * 2.2) * s;
  const thorax = (-lumbar * 0.72 + vFactor * hFactor * 1.4) * s;
  return { lumbar, thorax };
}

export function applyPropsToPuppytNodes(
  by: Record<string, PuppytNode>,
  props: WalkingEngineProportions
): void {
  const setS = (id: string, sx: number, sy: number) => {
    const n = by[id];
    if (!n) return;
    n.sx = Math.max(0.1, Math.min(2.5, Number.isFinite(sx) ? sx : 1));
    n.sy = Math.max(0.1, Math.min(2.5, Number.isFinite(sy) ? sy : 1));
  };

  setS('pelvis', props.waist.w, props.waist.h);
  setS('lumbar', props.waist.w, props.waist.h);
  setS('hipL', props.waist.w, props.waist.h);
  setS('hipR', props.waist.w, props.waist.h);

  setS('thorax', props.torso.w, props.torso.h);
  setS('ribL', props.torso.w, props.torso.h);
  setS('ribR', props.torso.w, props.torso.h);

  setS('neck', props.collar.w, props.collar.h);
  setS('braceL', props.collar.w, props.collar.h);
  setS('braceR', props.collar.w, props.collar.h);
  setS('swivelL', props.collar.w, 1);
  setS('swivelR', props.collar.w, 1);
  setS('acromionL', 1, 1);
  setS('acromionR', 1, 1);

  setS('head', props.head.w, props.head.h);
  setS('lip', 1, 1);

  // Use Arms & Legs as subtle proportional guides so Hands & Feet stay naturally proportioned to limb scaling
  const lArmGuideW = 0.62 + 0.38 * props.l_lower_arm.w;
  const lArmGuideH = 0.62 + 0.38 * ((props.l_upper_arm.h + props.l_lower_arm.h) * 0.5);
  const rArmGuideW = 0.62 + 0.38 * props.r_lower_arm.w;
  const rArmGuideH = 0.62 + 0.38 * ((props.r_upper_arm.h + props.r_lower_arm.h) * 0.5);

  setS('humerusL', props.l_upper_arm.w, props.l_upper_arm.h);
  setS('humerusR', props.r_upper_arm.w, props.r_upper_arm.h);
  setS('forearmL', props.l_lower_arm.w, props.l_lower_arm.h);
  setS('forearmR', props.r_lower_arm.w, props.r_lower_arm.h);
  setS('handL', props.l_hand.w * lArmGuideW, props.l_hand.h * lArmGuideH);
  setS('handR', props.r_hand.w * rArmGuideW, props.r_hand.h * rArmGuideH);
  setS('thumbL', props.l_hand.w * lArmGuideW, props.l_hand.h * lArmGuideH);
  setS('thumbR', props.r_hand.w * rArmGuideW, props.r_hand.h * rArmGuideH);
  setS('fingerL', props.l_hand.w * lArmGuideW, props.l_hand.h * lArmGuideH);
  setS('fingerR', props.r_hand.w * rArmGuideW, props.r_hand.h * rArmGuideH);

  const lLegGuideW = 0.62 + 0.38 * props.l_lower_leg.w;
  const lLegGuideH = 0.62 + 0.38 * ((props.l_upper_leg.h + props.l_lower_leg.h) * 0.5);
  const rLegGuideW = 0.62 + 0.38 * props.r_lower_leg.w;
  const rLegGuideH = 0.62 + 0.38 * ((props.r_upper_leg.h + props.r_lower_leg.h) * 0.5);

  setS('femurL', props.l_upper_leg.w, props.l_upper_leg.h);
  setS('femurR', props.r_upper_leg.w, props.r_upper_leg.h);
  setS('shinL', props.l_lower_leg.w, props.l_lower_leg.h);
  setS('shinR', props.r_lower_leg.w, props.r_lower_leg.h);
  setS('footL', props.l_foot.w * lLegGuideW, props.l_foot.h * lLegGuideH);
  setS('footR', props.r_foot.w * rLegGuideW, props.r_foot.h * rLegGuideH);
  setS('toeBallL', props.l_toe.w * lLegGuideW, props.l_toe.h * lLegGuideH);
  setS('toeBallR', props.r_toe.w * rLegGuideW, props.r_toe.h * rLegGuideH);
}

export function applyPoseToPuppytRig(
  graph: PuppytRigGraph,
  pose: WalkingEnginePose,
  pivotOffsets: WalkingEnginePivotOffsets,
  props: WalkingEngineProportions,
  isGroundedMode: boolean,
  options: PuppytApplyOptions = {}
): {
  lowestFootY: number;
  lPlanted: boolean;
  rPlanted: boolean;
  lFootX: number;
  rFootX: number;
  pelvisX: number;
} {
  const { by, nodes, pieces } = graph;
  const ribAnchor = options.ribAnchor ?? 'upper';
  const wingPop = Math.max(0, Math.min(1, options.wingPop ?? 0));
  const prometheusWings = wingPop > 0.05;
  const constrainLimits = options.constrainLimits ?? true;
  const spineUnlocked = options.spineUnlocked ?? true;
  const useAdvancedFeet = options.useAdvancedFeet ?? true;

  applyPropsToPuppytNodes(by, props);

  const SPINE_IDS = new Set(['pelvis', 'lumbar', 'thorax', 'neck']);
  const setAng = (id: string, rawDeg: number) => {
    const n = by[id];
    if (!n) return;
    const applyLim = constrainLimits && !(spineUnlocked && SPINE_IDS.has(id));
    let deg = clampAnatomicalAngle(n, rawDeg, applyLim);
    deg = clampRealisticShoulder(n, deg, by, prometheusWings);
    n.ang = deg;
  };

  if (by.head) {
    by.head.flipX = !!options.headFlipX;
  }
  if (by.lip) {
    by.lip.ang = 0;
  }

  // Unlocked Lower & Upper Spine Hierarchy
  setAng('pelvis', pose.waist * 0.35 + pivotOffsets.waist * 0.45);
  setAng('lumbar', pose.waist * 0.65 + (options.lumbarTwist ?? 0) + pivotOffsets.waist * 0.55);
  setAng('thorax', pose.torso + pivotOffsets.torso);
  setAng('neck', pose.collar + pivotOffsets.collar);
  setAng('head', pose.neck + pivotOffsets.neck);

  // Ribcage anchor mode & breathing
  applyRibAnchorMode(by, ribAnchor, prometheusWings);
  if (by.ribL && by.ribR) {
    const breathAmp = ribAnchor === 'lower' ? 3.2 : ribAnchor === 'ribwings' ? 2.4 : 1.6;
    const breath = Math.sin(pose.stride_phase * Math.PI) * breathAmp;
    by.ribL.ang = clampChungusRibAngle(
      'ribL',
      Math.max(0, breath) + (ribAnchor === 'lower' ? 2.2 : 0),
      ribAnchor,
      by,
      prometheusWings
    );
    by.ribR.ang = clampChungusRibAngle(
      'ribR',
      -Math.max(0, breath) - (ribAnchor === 'lower' ? 2.2 : 0),
      ribAnchor,
      by,
      prometheusWings
    );
  }

  // Shoulder girdle swivel + Prometheus wing flex
  const swivTwist = (pose.collar + pivotOffsets.collar) * 0.55;
  setAng('swivelL', swivTwist + (props.collar.w - 1) * 8 + pose.l_shoulder * (prometheusWings ? 0.14 * wingPop : 0));
  setAng('swivelR', swivTwist - (props.collar.w - 1) * 8 + pose.r_shoulder * (prometheusWings ? 0.14 * wingPop : 0));
  setAng('acromionL', prometheusWings ? -pose.l_shoulder * 0.08 * wingPop : 0);
  setAng('acromionR', prometheusWings ? -pose.r_shoulder * 0.08 * wingPop : 0);

  if (by.braceL && by.braceR) {
    setAng('braceL', prometheusWings ? pose.l_shoulder * 0.16 * wingPop : 0);
    setAng('braceR', prometheusWings ? pose.r_shoulder * 0.16 * wingPop : 0);
  }

  // Arms
  setAng('humerusL', pose.l_shoulder + pivotOffsets.l_shoulder);
  setAng('humerusR', pose.r_shoulder + pivotOffsets.r_shoulder);
  setAng('forearmL', pose.l_elbow + pivotOffsets.l_elbow);
  setAng('forearmR', pose.r_elbow + pivotOffsets.r_elbow);
  setAng('handL', pose.l_hand + pivotOffsets.l_hand);
  setAng('handR', pose.r_hand + pivotOffsets.r_hand);

  // Sync Gotz 5-digit hand tips & finger anchors
  syncHandDigitNodes('L', by, options.handStateL);
  syncHandDigitNodes('R', by, options.handStateR);
  setAng('thumbL', 0);
  setAng('thumbR', 0);
  setAng('fingerL', 0);
  setAng('fingerR', 0);

  // Legs & Articulated Piggy Feet + Toe Ball joints (same level as knees & elbows!)
  setAng('hipL', pose.waist * 0.25);
  setAng('hipR', pose.waist * 0.25);
  setAng('femurL', pose.l_hip + pivotOffsets.l_hip);
  setAng('femurR', pose.r_hip + pivotOffsets.r_hip);
  setAng('shinL', pose.l_knee + pivotOffsets.l_knee);
  setAng('shinR', pose.r_knee + pivotOffsets.r_knee);
  setAng('footL', pose.l_foot + pivotOffsets.l_foot);
  setAng('footR', pose.r_foot + pivotOffsets.r_foot);
  setAng('toeBallL', pose.l_toe + pivotOffsets.l_toe);
  setAng('toeBallR', pose.r_toe + pivotOffsets.r_toe);

  const isBackView = !!options.isBackView;
  sortPiecesForWings(pieces, prometheusWings, isBackView);

  graph.root.tx = pose.x_offset / PUPPYT_STAGE_SCALE;
  graph.root.ty = pose.y_offset / PUPPYT_STAGE_SCALE;

  solvePuppytRig(nodes, by, true, wingPop, ribAnchor);

  const lRoadY = PUPPYT_NATIVE_FLOOR_Y + (options.lGroundOffsetY ?? 0) / PUPPYT_STAGE_SCALE;
  const rRoadY = PUPPYT_NATIVE_FLOOR_Y + (options.rGroundOffsetY ?? 0) / PUPPYT_STAGE_SCALE;

  const getFootBottomY = (side: 'L' | 'R'): number => {
    const fn = by['foot' + side];
    const tn = by['toe' + side];
    const tb = by['toeBall' + side];
    if (!fn || !fn.pieces.length) return PUPPYT_NATIVE_FLOOR_Y;
    const w = fn.w;
    const p = fn.pieces[0];

    let maxY = -Infinity;
    if (useAdvancedFeet) {
      // Exact sole contact points for tightened leg-guided 2.5D Piggy Foot (Heel, Cuboid, MTP3, Tip5/Tip3/Tip1)
      const dropBoost = (side === 'L' ? options.footImpactDropL ?? 0 : options.footImpactDropR ?? 0) * 44;
      const corners: Array<[number, number]> =
        side === 'R'
          ? [
              [960, 6878],
              [842, 7138],
              [521, 7458 + dropBoost * 0.7],
              [458, 7640 + dropBoost],
              [359, 7644 + dropBoost],
              [285, 7599 + dropBoost],
            ]
          : [
              [1544, 6878],
              [1662, 7138],
              [1983, 7458 + dropBoost * 0.7],
              [2046, 7640 + dropBoost],
              [2145, 7644 + dropBoost],
              [2219, 7599 + dropBoost],
            ];
      for (const [cx, cy] of corners) {
        const wy = w[1] * cx + w[3] * cy + w[5];
        if (wy > maxY) maxY = wy;
      }
      if (tn) {
        const toePos = pos(tn, by);
        if (toePos[1] + 22 + dropBoost * 0.5 > maxY) maxY = toePos[1] + 22 + dropBoost * 0.5;
      }
      if (tb) {
        const ballPos = pos(tb, by);
        if (ballPos[1] + 38 + dropBoost * 0.4 > maxY) maxY = ballPos[1] + 38 + dropBoost * 0.4;
      }
    } else {
      const soleY = p.y + p.h;
      const corners: Array<[number, number]> = [
        [p.x + p.w * 0.14, soleY],
        [p.x + p.w * 0.42, soleY],
        [p.x + p.w * 0.72, soleY],
        [p.x + p.w * 0.92, soleY],
      ];
      for (const [cx, cy] of corners) {
        const wy = w[1] * cx + w[3] * cy + w[5];
        if (wy > maxY) maxY = wy;
      }
    }
    return maxY;
  };

  const lFootBottom = getFootBottomY('L');
  const rFootBottom = getFootBottomY('R');
  // Ground clearance relative to each foot's local road elevation (accommodates bumps & dips!)
  const lDelta = lRoadY - lFootBottom;
  const rDelta = rRoadY - rFootBottom;
  const groundDelta = Math.min(lDelta, rDelta);

  if (isGroundedMode || groundDelta < 0) {
    graph.root.ty += groundDelta;
    solvePuppytRig(nodes, by, true, wingPop, ribAnchor);
  }

  const finalL = getFootBottomY('L');
  const finalR = getFootBottomY('R');
  const toSvgX = (nativeX: number) => {
    const mx = isBackView ? PUPPYT_NATIVE_CENTER_X * 2 - nativeX : nativeX;
    return (mx - PUPPYT_NATIVE_CENTER_X) * PUPPYT_STAGE_SCALE;
  };
  const lFootPos = by.footL ? pos(by.footL, by)[0] : PUPPYT_NATIVE_CENTER_X + 220;
  const rFootPos = by.footR ? pos(by.footR, by)[0] : PUPPYT_NATIVE_CENTER_X - 220;
  const pelvisPos = pos(graph.root, by)[0];

  return {
    lowestFootY: Math.max(finalL, finalR),
    lPlanted: Math.abs(finalL - lRoadY) < 44,
    rPlanted: Math.abs(finalR - rRoadY) < 44,
    lFootX: toSvgX(lFootPos),
    rFootX: toSvgX(rFootPos),
    pelvisX: toSvgX(pelvisPos),
  };
}
