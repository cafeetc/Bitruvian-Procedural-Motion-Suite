import { WalkingEnginePivotOffsets, WalkingEnginePose, WalkingEngineProportions } from '../types';

export const PUPPYT_DEG = Math.PI / 180;
const IDENTITY = [1, 0, 0, 1, 0, 0] as const;

export type SkullViewMode = 'front' | 'side' | 'back';

export interface PuppytRawPiece {
  i: number;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;
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
}

export interface PuppytPiece extends PuppytRawPiece {
  node?: PuppytNode;
  i0?: number;
  wing?: boolean;
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
  w: Float64Array;
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
}

export const PUPPYT_ANATOMICAL_LIMITS: Record<string, [number, number]> = {
  pelvis: [-180, 180],
  hipR: [-145, 145],
  hipL: [-145, 145],
  lumbar: [-48, 48],
  thorax: [-42, 42],
  ribR: [-28, 28],
  ribL: [-28, 28],
  neck: [-45, 45],
  head: [-65, 65],
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
  femurL: [-135, 120],
  femurR: [-120, 135],
  shinL: [-15, 150],
  shinR: [-150, 15],
  footL: [-65, 75],
  footR: [-75, 65],
};

// Map Puppyt node IDs to interactive pivot offset keys
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
  femurL: 'l_hip',
  femurR: 'r_hip',
  shinL: 'l_knee',
  shinR: 'r_knee',
  footL: 'l_foot',
  footR: 'r_foot',
};

export const PUPPYT_NATIVE_CENTER_X = 1257;
export const PUPPYT_NATIVE_FLOOR_Y = 7623;
export const PUPPYT_NATIVE_CROWN_Y = 18;
export const PUPPYT_STAGE_SCALE = 0.232; // Maps 7605px height -> ~1764 SVG units

export function normalizeDeg(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
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
  const p = par ? par.w : IDENTITY;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const fx = n.flipX ? -1 : 1;
  const px = n.piv[0];
  const py = n.piv[1];
  const e = px - fx * c * px + s * py + n.tx;
  const f = py - fx * s * px - c * py + n.ty;
  const m00 = fx * c;
  const m01 = -s;
  const m10 = fx * s;
  const m11 = c;
  const w = n.w;
  w[0] = p[0] * m00 + p[2] * m10;
  w[1] = p[1] * m00 + p[3] * m10;
  w[2] = p[0] * m01 + p[2] * m11;
  w[3] = p[1] * m01 + p[3] * m11;
  w[4] = p[0] * e + p[2] * f + p[4];
  w[5] = p[1] * e + p[3] * f + p[5];
}

export function bondAng(n: PuppytNode, by: Record<string, PuppytNode>, bondOn: boolean): number {
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

  const v = (a: number) => {
    const r = a * PUPPYT_DEG;
    const c = Math.cos(r);
    const s = Math.sin(r);
    const X = px + c * ax - s * ay;
    const Y = py + s * ax + c * ay;
    const wx = lw[0] * X + lw[2] * Y + lw[4];
    const wy = lw[1] * X + lw[3] * Y + lw[5];
    const d = Math.hypot(wx - nx, wy - ny);
    const loSoft = lo * 0.92;
    const hiSoft = hi * 1.12;
    const distErr = d < loSoft ? loSoft - d : d > hiSoft ? d - hiSoft : 0;
    const lateralSigned = ((wx - nx) * tw[0] + (wy - ny) * tw[1]) * sideSign;
    const latErr = lateralSigned < 240 ? (240 - lateralSigned) * 4 : 0;
    const relAng = Math.abs(normalizeDeg(a - txAng));
    const angErr = relAng > 32 ? (relAng - 32) * 25 : 0;
    return distErr + latErr + angErr;
  };

  const seed = normalizeDeg(txAng + Math.max(-28, Math.min(28, normalizeDeg(n.ang - txAng))));
  if (v(seed) === 0) return seed;
  for (let i = 1; i <= 360; i++) {
    for (const s of [1, -1]) {
      const a = seed + s * i;
      if (v(a) === 0) {
        let bad = a - s;
        let good = a;
        for (let j = 0; j < 14; j++) {
          const m = (bad + good) / 2;
          if (v(m) === 0) good = m;
          else bad = m;
        }
        return good;
      }
    }
  }
  return seed;
}

export function setAim(n: PuppytNode, by: Record<string, PuppytNode>, bondOn: boolean): void {
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
  const dist = Math.hypot(vx, vy) || 1;
  const L0 = Math.hypot(F[0] - p[0], F[1] - p[1]) || 1;
  const clampedAng = Math.max(-14, Math.min(14, normalizeDeg(n.ang)));
  let a = Math.atan2(vy, vx) - Math.atan2(F[1] - p[1], F[0] - p[0]) + clampedAng * PUPPYT_DEG;
  const thoraxRad = Math.atan2(pw[1], pw[0]);
  const relRad = Math.atan2(Math.sin(a - thoraxRad), Math.cos(a - thoraxRad));
  const maxSwing = 24 * PUPPYT_DEG;
  a = thoraxRad + Math.max(-maxSwing, Math.min(maxSwing, relRad));

  const ux = vx / dist;
  const uy = vy / dist;
  const delta = dist - L0;
  const rawSlide = delta * 0.5;
  const [minS, maxS] = bondOn ? [-0.24 * L0, 0.14 * L0] : [-0.14 * L0, 0.08 * L0];
  const span = Math.max(1, (maxS - minS) * 0.5);
  const mid = (minS + maxS) * 0.5;
  const slide = mid + span * Math.tanh((rawSlide - mid) / span);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const w = n.w;
  w[0] = c;
  w[1] = s;
  w[2] = -s;
  w[3] = c;
  w[4] = X + ux * slide - (c * p[0] - s * p[1]);
  w[5] = Y + uy * slide - (s * p[0] + c * p[1]);
}

export function solvePuppytRig(nodes: PuppytNode[], by: Record<string, PuppytNode>, bondOn = true): void {
  for (const n of nodes) {
    if (n.aim) {
      setAim(n, by, bondOn);
    } else {
      n.eff = bondAng(n, by, bondOn);
      setW(n, n.eff * PUPPYT_DEG, by);
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
    }
  }
}

export function buildPuppytRigGraph(rawInput: PuppytRawRigDef): PuppytRigGraph {
  const def: PuppytRawRigDef = JSON.parse(JSON.stringify(rawInput));
  addJoints(def);

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
    w: new Float64Array([1, 0, 0, 1, 0, 0]),
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

  solvePuppytRig(nodes, by, true);

  return {
    W: def.W || 2500,
    H: def.H || 8742,
    nodes,
    by,
    root,
    pieces,
  };
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
        // Identify purple fill pixels (#5d03b4 / #6e05f1) without touching black outline or white highlights
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

// Skull specs from Bitruvian.Human.Puppyt skullKitModels.ts
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
    h: 860,
    dx: 926,
    dy: 54,
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
    dy: 18,
  },
};

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

      // Measure actual modal purple fill on the canvas (immune to PNG iCCP color-profile shifts)
      const hist = new Map<string, { count: number; r: number; g: number; b: number }>();
      for (let i = 0; i < d.length; i += 16) {
        if (d[i + 3] < 210) continue;
        const r = d[i];
        const gr = d[i + 1];
        const b = d[i + 2];
        if (b > gr + 25 && b > r + 15 && b > 100 && gr < 120) {
          const qr = r >> 2;
          const qg = gr >> 2;
          const qb = b >> 2;
          const key = `${qr},${qg},${qb}`;
          const prev = hist.get(key);
          if (prev) prev.count += 1;
          else hist.set(key, { count: 1, r, g: gr, b });
        }
      }

      let modeR = 110;
      let modeG = 5;
      let modeB = 241;
      let bestCount = 0;
      hist.forEach((entry) => {
        if (entry.count > bestCount) {
          bestCount = entry.count;
          modeR = entry.r;
          modeG = entry.g;
          modeB = entry.b;
        }
      });

      // Exact target fill matching rig-data.json Front skull & skeleton bones: rgb(93, 3, 180) (#5d03b4)
      const TARGET_R = 93;
      const TARGET_G = 3;
      const TARGET_B = 180;

      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 10) continue;
        const r = d[i];
        const gr = d[i + 1];
        const b = d[i + 2];
        // Map any purple-tinted or antialiased purple pixel cleanly to #5d03b4 scale
        if (b > gr + 8 && b > r + 6) {
          const whiteMix = Math.max(0, Math.min(1, (gr - modeG - 8) / Math.max(1, 255 - modeG)));
          const darkMix = Math.max(0, Math.min(1.04, b / Math.max(1, modeB)));
          const baseR = TARGET_R * darkMix;
          const baseG = TARGET_G * darkMix;
          const baseB = TARGET_B * darkMix;
          d[i] = Math.min(255, Math.round(baseR + (255 - baseR) * whiteMix));
          d[i + 1] = Math.min(255, Math.round(baseG + (255 - baseG) * whiteMix));
          d[i + 2] = Math.min(255, Math.round(baseB + (255 - baseB) * whiteMix));
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

// Applies walking pose + pivot offsets to the Puppyt RigGraph and solves exact world matrices
export function applyPoseToPuppytRig(
  graph: PuppytRigGraph,
  pose: WalkingEnginePose,
  pivotOffsets: WalkingEnginePivotOffsets,
  props: WalkingEngineProportions,
  isGroundedMode: boolean
): { lowestFootY: number; lPlanted: boolean; rPlanted: boolean } {
  const { by, nodes } = graph;

  const setAng = (id: string, deg: number) => {
    if (by[id]) by[id].ang = deg;
  };

  // Spine & Olive Collar hierarchy
  setAng('pelvis', pose.waist * 0.35 + pivotOffsets.waist);
  setAng('lumbar', pose.waist * 0.65);
  setAng('thorax', pose.torso + pivotOffsets.torso);
  setAng('neck', pose.collar + pivotOffsets.collar);
  setAng('head', pose.neck + pivotOffsets.neck);

  // Subtle ribcage breathing from torso/mood
  if (by.ribL && by.ribR) {
    const breath = Math.sin(pose.stride_phase * Math.PI) * 1.6;
    by.ribL.ang = breath;
    by.ribR.ang = -breath;
  }

  // Shoulder girdle swivel + closed-chain tendon brace (olive collar acts as parent hub)
  const swivTwist = (pose.collar + pivotOffsets.collar) * 0.55;
  setAng('swivelL', swivTwist + (props.collar.w - 1) * 8);
  setAng('swivelR', swivTwist - (props.collar.w - 1) * 8);
  setAng('acromionL', 0);
  setAng('acromionR', 0);

  // Arms (left/right mirrored chirality in Vitruvian rig)
  setAng('humerusL', pose.l_shoulder + pivotOffsets.l_shoulder);
  setAng('humerusR', pose.r_shoulder + pivotOffsets.r_shoulder);
  setAng('forearmL', pose.l_elbow + pivotOffsets.l_elbow);
  setAng('forearmR', pose.r_elbow + pivotOffsets.r_elbow);
  setAng('handL', pose.l_hand + pivotOffsets.l_hand);
  setAng('handR', pose.r_hand + pivotOffsets.r_hand);

  // Legs
  setAng('hipL', pose.waist * 0.25);
  setAng('hipR', pose.waist * 0.25);
  setAng('femurL', pose.l_hip + pivotOffsets.l_hip);
  setAng('femurR', pose.r_hip + pivotOffsets.r_hip);
  setAng('shinL', pose.l_knee + pivotOffsets.l_knee);
  setAng('shinR', pose.r_knee + pivotOffsets.r_knee);
  setAng('footL', pose.l_foot + pivotOffsets.l_foot);
  setAng('footR', pose.r_foot + pivotOffsets.r_foot);

  // Apply root translation first without vertical ground clamp
  graph.root.tx = pose.x_offset / PUPPYT_STAGE_SCALE;
  graph.root.ty = pose.y_offset / PUPPYT_STAGE_SCALE;

  solvePuppytRig(nodes, by, true);

  // Measure lowest foot sole Y across heel, arch, and toe tips of footL & footR
  const getFootBottomY = (footId: string): number => {
    const fn = by[footId];
    if (!fn || !fn.pieces.length) return PUPPYT_NATIVE_FLOOR_Y;
    const w = fn.w;
    const p = fn.pieces[0];
    const soleY = p.y + p.h;
    const corners: Array<[number, number]> = [
      [p.x + p.w * 0.08, soleY],
      [p.x + p.w * 0.28, soleY],
      [p.x + p.w * 0.5, soleY],
      [p.x + p.w * 0.78, soleY],
      [p.x + p.w * 0.96, soleY],
    ];
    let maxY = -Infinity;
    for (const [cx, cy] of corners) {
      const wy = w[1] * cx + w[3] * cy + w[5];
      if (wy > maxY) maxY = wy;
    }
    return maxY;
  };

  const lFootBottom = getFootBottomY('footL');
  const rFootBottom = getFootBottomY('footR');
  const lowestFootY = Math.max(lFootBottom, rFootBottom);

  // Clamp or ground so planted foot rests cleanly on PUPPYT_NATIVE_FLOOR_Y
  const floorDelta = PUPPYT_NATIVE_FLOOR_Y - lowestFootY;
  if (isGroundedMode || floorDelta < 0) {
    graph.root.ty += floorDelta;
    solvePuppytRig(nodes, by, true);
  }

  const finalL = getFootBottomY('footL');
  const finalR = getFootBottomY('footR');
  return {
    lowestFootY: Math.max(finalL, finalR),
    lPlanted: Math.abs(finalL - PUPPYT_NATIVE_FLOOR_Y) < 40,
    rPlanted: Math.abs(finalR - PUPPYT_NATIVE_FLOOR_Y) < 40,
  };
}
