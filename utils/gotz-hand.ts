import { GotzHandPresetName, WalkingEngineGait } from '../types';

export type GotzDigitId = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
export type GotzBuild = 'standard' | 'claw' | 'trident' | 'mickey';
export type GotzLimitsMode = 'realistic' | 'elastic' | 'expert';
export type GotzStyle = 'hand-app-1' | 'hand-app-2' | 'legacy';

export interface GotzProps {
  bones: Record<GotzDigitId, number[]>;
  kn: Record<GotzDigitId, number>;
  width: number;
}

export interface GotzHandPresetData {
  splay: number;
  tilt: number;
  wrist: number;
  thumb: number;
  fs: Record<'index' | 'ring' | 'pinky', number>;
  rot: Record<GotzDigitId, number>;
  cj: Record<GotzDigitId, number[]>;
}

export interface GotzHandState extends GotzHandPresetData {
  mirror: boolean;
  build: GotzBuild;
  limits: GotzLimitsMode;
  style: GotzStyle;
}

export interface GotzSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  len: number;
  ang: number;
  boneIdx: number;
  name: string;
}

export interface GotzSolvedDigit {
  digit: GotzDigitId;
  pts: Array<[number, number]>;
  segs: GotzSegment[];
}

export const GOTZ_DIGITS: GotzDigitId[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];

export const GOTZ_TE: Record<GotzDigitId, number> = {
  thumb: -120,
  index: -30,
  middle: 0,
  ring: 30,
  pinky: 60,
};

export const GOTZ_SIGN: Record<GotzDigitId, number> = {
  thumb: -1,
  index: 1,
  middle: 1,
  ring: 1,
  pinky: 1,
};

export const GOTZ_PROPS_ANAT: GotzProps = {
  bones: {
    middle: [4, 3, 2, 1],
    ring: [3.75, 2.8125, 1.875, 0.9375],
    index: [3.75, 2.8125, 1.875, 0.9375],
    pinky: [3.5, 2.625, 1.75, 0.875],
    thumb: [3, 2, 1],
  },
  kn: { middle: 1, ring: 1, index: 1, pinky: 1, thumb: 0.5 },
  width: 1.24,
};

export const GOTZ_STAGE_BOX = {
  halfW: 520,
  topPad: 115,
  w: 1040,
  h: 1080,
  scale: 84, // Arm-guided proportional scale: 9.2u * 84 ≈ 775px (~62% of forearm 1259.5px, matching static Handkit)
};

export const GOTZ_PRESETS: Record<Exclude<GotzHandPresetName, 'Dynamic'>, GotzHandPresetData> = {
  Neutral: {
    splay: 22,
    tilt: 0,
    wrist: 0,
    thumb: -4,
    fs: { index: 0, ring: 0, pinky: 2 },
    rot: { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 },
    cj: {
      thumb: [12, 14],
      index: [10, 14, 10],
      middle: [12, 16, 10],
      ring: [16, 20, 12],
      pinky: [20, 24, 14],
    },
  },
  Grip: {
    splay: 28,
    tilt: 0,
    wrist: 0,
    thumb: 6,
    fs: { index: 0, ring: 2, pinky: 5 },
    rot: { thumb: -6, index: 6, middle: 0, ring: -3, pinky: -6 },
    cj: {
      thumb: [38, 44],
      index: [48, 66, 42],
      middle: [54, 72, 46],
      ring: [60, 78, 50],
      pinky: [66, 84, 54],
    },
  },
  Open: {
    splay: 72,
    tilt: 0,
    wrist: 0,
    thumb: 12,
    fs: { index: -10, ring: 8, pinky: 18 },
    rot: { thumb: -6, index: -3, middle: 0, ring: 3, pinky: 6 },
    cj: {
      thumb: [0, 0],
      index: [-10, 0, 0],
      middle: [-8, 0, 0],
      ring: [-10, 0, 0],
      pinky: [-12, 0, 0],
    },
  },
  Fist: {
    splay: 28,
    tilt: 0,
    wrist: 0,
    thumb: 6,
    fs: { index: 0, ring: 2, pinky: 5 },
    rot: { thumb: -6, index: 18, middle: 8.5, ring: 5.5, pinky: 2.5 },
    cj: {
      thumb: [38, 44],
      index: [42, 85, 32],
      middle: [54, 72, 46],
      ring: [60, 78, 50],
      pinky: [66, 84, 54],
    },
  },
  Point: {
    splay: 35,
    tilt: 0,
    wrist: 0,
    thumb: -10,
    fs: { index: -12, ring: 0, pinky: 0 },
    rot: { thumb: 12, index: -4, middle: 0, ring: -2, pinky: -4 },
    cj: {
      thumb: [45, 40],
      index: [0, 0, 0],
      middle: [86, 102, 75],
      ring: [88, 108, 78],
      pinky: [88, 118, 80],
    },
  },
  Peace: {
    splay: 50,
    tilt: 0,
    wrist: 0,
    thumb: -15,
    fs: { index: -25, ring: 0, pinky: 0 },
    rot: { thumb: 16, index: -10, middle: 6, ring: -4, pinky: -8 },
    cj: {
      thumb: [52, 48],
      index: [0, 0, 0],
      middle: [0, 0, 0],
      ring: [88, 110, 78],
      pinky: [88, 120, 82],
    },
  },
  Rock: {
    splay: 48,
    tilt: 0,
    wrist: 0,
    thumb: 10,
    fs: { index: -15, ring: 0, pinky: 20 },
    rot: { thumb: -8, index: -6, middle: 0, ring: -4, pinky: 10 },
    cj: {
      thumb: [12, 18],
      index: [0, 0, 0],
      middle: [88, 105, 78],
      ring: [88, 112, 78],
      pinky: [0, 0, 0],
    },
  },
  Pinch: {
    splay: 30,
    tilt: 0,
    wrist: 0,
    thumb: -20,
    fs: { index: 15, ring: -5, pinky: -5 },
    rot: { thumb: 24, index: 14, middle: 0, ring: -4, pinky: -6 },
    cj: {
      thumb: [42, 50],
      index: [52, 65, 42],
      middle: [22, 26, 15],
      ring: [32, 38, 20],
      pinky: [42, 50, 28],
    },
  },
  Flat: {
    splay: 0,
    tilt: 0,
    wrist: 0,
    thumb: -45,
    fs: { index: 0, ring: 0, pinky: 0 },
    rot: { thumb: 20, index: 0, middle: 0, ring: 0, pinky: 0 },
    cj: {
      thumb: [0, 0],
      index: [0, 0, 0],
      middle: [0, 0, 0],
      ring: [0, 0, 0],
      pinky: [0, 0, 0],
    },
  },
};

const RAD = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function createGotzHandState(
  mirror: boolean,
  preset: Exclude<GotzHandPresetName, 'Dynamic'> = 'Neutral'
): GotzHandState {
  const base = GOTZ_PRESETS[preset] ?? GOTZ_PRESETS.Neutral;
  return {
    splay: base.splay,
    tilt: base.tilt,
    wrist: base.wrist,
    thumb: base.thumb,
    fs: { ...base.fs },
    rot: { ...base.rot },
    cj: {
      thumb: base.cj.thumb.slice(),
      index: base.cj.index.slice(),
      middle: base.cj.middle.slice(),
      ring: base.cj.ring.slice(),
      pinky: base.cj.pinky.slice(),
    },
    mirror,
    build: 'standard',
    limits: 'realistic',
    style: 'hand-app-1',
  };
}

export function gotzSplayAngle(d: GotzDigitId, st: GotzHandState): number {
  const spreadOff = d === 'thumb' ? st.thumb : d === 'middle' ? 0 : st.fs[d] || 0;
  const effSpread = clamp(st.splay + spreadOff, -100, 100);
  return GOTZ_TE[d] * (effSpread / 100) + st.tilt + (st.rot[d] || 0);
}

const BONE_NAMES_4 = ['Metacarpal', 'Proximal', 'Middle', 'Distal'];
const BONE_NAMES_3 = ['Metacarpal', 'Proximal', 'Distal'];

export function solveGotzDigit(
  d: GotzDigitId,
  st: GotzHandState,
  props: GotzProps = GOTZ_PROPS_ANAT
): GotzSolvedDigit {
  const lens = props.bones[d] || GOTZ_PROPS_ANAT.bones[d];
  const kn = props.kn?.[d] ?? GOTZ_PROPS_ANAT.kn[d];
  let x = 0;
  let y = 0;
  let a = ((st.mirror ? -st.wrist : st.wrist) + gotzSplayAngle(d, st)) * RAD;
  const pts: Array<[number, number]> = [[0, 0]];
  const segs: GotzSegment[] = [];
  const names = lens.length === 3 ? BONE_NAMES_3 : BONE_NAMES_4;
  for (let l = 0; l < lens.length; l++) {
    const rawL = lens[l];
    const segLen = Math.max(0.18, (l === 1 ? -kn / 2 : 0) + rawL - (l === 0 ? kn : 0) / 2);
    const nx = x + Math.sin(a) * segLen;
    const ny = y - Math.cos(a) * segLen;
    segs.push({
      x1: x,
      y1: y,
      x2: nx,
      y2: ny,
      len: segLen,
      ang: a,
      boneIdx: l,
      name: names[l] || `Phalanx ${l}`,
    });
    x = nx;
    y = ny;
    pts.push([x, y]);
    const cur = st.cj[d] || [];
    if (l < cur.length) {
      a += -GOTZ_SIGN[d] * (cur[l] || 0) * RAD;
    }
  }
  return { digit: d, pts, segs };
}

export function solveGotzHand(
  st: GotzHandState,
  props: GotzProps = GOTZ_PROPS_ANAT
): Record<GotzDigitId, GotzSolvedDigit> {
  return {
    thumb: solveGotzDigit('thumb', st, props),
    index: solveGotzDigit('index', st, props),
    middle: solveGotzDigit('middle', st, props),
    ring: solveGotzDigit('ring', st, props),
    pinky: solveGotzDigit('pinky', st, props),
  };
}

export function gotzToPuppetOffset(gx: number, gy: number, mirror: boolean): [number, number] {
  const sx = mirror ? -gx : gx;
  return [sx * GOTZ_STAGE_BOX.scale, -gy * GOTZ_STAGE_BOX.scale];
}

export function gotzBoneSvgPath(
  seg: GotzSegment,
  boneIdx: number,
  totalBones: number,
  widthMul: number,
  style: GotzStyle = 'hand-app-1'
): string {
  const L = seg.len;
  const baseW = (style === 'legacy' ? 0.56 : 0.62) * widthMul;
  const taper = [1.0, 0.78, 0.62, 0.5][boneIdx] ?? 0.48;
  const w1 = baseW * taper * (boneIdx === 0 ? 0.85 : 0.92);
  const w2 = baseW * taper * (boneIdx === totalBones - 1 ? 0.68 : 0.96);
  const half1 = w1 * 0.5;
  const half2 = w2 * 0.5;
  const ch = Math.min(L * 0.22, Math.max(half1, half2) * 0.65);

  if (style === 'legacy') {
    return `M ${-half1 * 0.6} 0 L ${half1 * 0.6} 0 L ${half1} ${-ch} L ${half2} ${-(L - ch)} L ${half2 * 0.6} ${-L} L ${-half2 * 0.6} ${-L} L ${-half2} ${-(L - ch)} L ${-half1} ${-ch} Z`;
  }
  const neck = Math.min(half1, half2) * 0.84;
  return `M ${-half1 * 0.55} ${ch * 0.18} Q 0 ${ch * 0.45} ${half1 * 0.55} ${ch * 0.18} C ${half1} ${-ch * 0.35} ${neck} ${-L * 0.45} ${half2 * 0.95} ${-(L - ch)} Q ${half2 * 0.6} ${-L - ch * 0.22} 0 ${-L - ch * 0.22} Q ${-half2 * 0.6} ${-L - ch * 0.22} ${-half2 * 0.95} ${-(L - ch)} C ${-neck} ${-L * 0.45} ${-half1} ${-ch * 0.35} ${-half1 * 0.55} ${ch * 0.18} Z`;
}

export function computeProceduralGotzHandState(
  side: 'L' | 'R',
  presetName: GotzHandPresetName,
  phaseRad: number,
  wristSwingDeg: number,
  gait: WalkingEngineGait,
  fingerOffsetDeg = 0
): GotzHandState {
  const mirror = side === 'R';
  const sidePhase = side === 'L' ? phaseRad : phaseRad + Math.PI;
  const baseKey: Exclude<GotzHandPresetName, 'Dynamic'> =
    presetName === 'Dynamic' ? 'Neutral' : presetName;
  const st = createGotzHandState(mirror, baseKey);

  // Subtle inertial finger lag during gait
  const swingDrive = Math.sin(sidePhase + 0.45);
  const whip = Math.cos(sidePhase * 2) * 0.35;

  if (presetName === 'Dynamic') {
    // Smooth blend between relaxed walk hang, sprinter grip/fist, and cartoon expressiveness
    const speedRunMix = clamp((gait.frequency - 1.35) * 0.75 + (gait.elbow_bend - 0.65) * 0.7, 0, 1);
    const tipToeGrace = clamp((gait.foot_angle_on_ground - 10) / 18, 0, 1);

    const baseCurl =
      14 +
      speedRunMix * 38 +
      (1 - tipToeGrace) * 8 -
      tipToeGrace * 14 +
      swingDrive * (8 + gait.wrist_swing * 9);

    st.splay = clamp(24 + tipToeGrace * 16 - speedRunMix * 10 + whip * 6, 10, 56);
    st.thumb = clamp(2 - speedRunMix * 5 + tipToeGrace * 8, -22, 22);

    const stagger: Record<GotzDigitId, number> = {
      thumb: -6,
      index: -6,
      middle: 0,
      ring: 7,
      pinky: 14,
    };

    for (const d of GOTZ_DIGITS) {
      const lagWave = Math.sin(sidePhase + 0.25 - (d === 'pinky' ? 0.55 : d === 'ring' ? 0.35 : d === 'middle' ? 0.15 : 0));
      const dCurl = baseCurl + stagger[d] + lagWave * (6 + gait.bends * 5) + fingerOffsetDeg * 0.75;
      if (d === 'thumb') {
        st.cj.thumb = [clamp(dCurl * 0.55, -20, 75), clamp(dCurl * 0.65, -20, 80)];
      } else {
        st.cj[d] = [
          clamp(dCurl * 0.78, -35, 90),
          clamp(dCurl * 1.02, -10, 115),
          clamp(dCurl * 0.72, -10, 85),
        ];
      }
    }
  } else {
    // Keep chosen preset silhouette clearly readable while adding subtle inertial finger breath & manual offset
    const subtleLag = swingDrive * (4 + gait.wrist_swing * 4) + fingerOffsetDeg * 0.75;
    st.splay = clamp(st.splay - fingerOffsetDeg * 0.25, -20, 95);
    for (const d of GOTZ_DIGITS) {
      st.cj[d] = st.cj[d].map((v, idx) => clamp(v + subtleLag * (0.55 + idx * 0.22), -45, 115));
    }
  }

  // Slight visual tilt response to wrist swing
  st.tilt = clamp(wristSwingDeg * 0.12, -18, 18);
  return st;
}
