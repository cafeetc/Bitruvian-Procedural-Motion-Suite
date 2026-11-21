import { WalkingEngineGait } from '../types';
import { PUPPYT_DEG } from './puppyt-rig';

/**
 * Hierarchical 23-bone Human Foot Rig ("Piggies")
 * Refactored for:
 *   1. Tightened anatomical rest posture (zero asset changes — removes spread-eagle V-gap)
 *   2. 2.5D 3-zone flexible foot kinematics:
 *        - Hindfoot Cushion: 11 Ankle -> 10 Heelbone
 *        - Midfoot Arch Break: 1 Footbone Bridge -> 0 Cuboid
 *        - 2.5D Foreshortened Toe Chains: Prox -> Mid -> Dist with perspective depth fold
 *   3. Newton's Cradle Impulse-Momentum System:
 *        - Tarsal & Inter-Digit elastic bounce wave so bones deflect off each other cleanly
 *        - Anti-Trip Dorsal Clearance Rebound when toes/heel graze floor, bumps, or opposing foot
 */

export type FootBoneRole =
  | 'ankle'
  | 'heel'
  | 'bridge'
  | 'cuboid'
  | 'metatarsal'
  | 'prox'
  | 'mid'
  | 'dist';

export interface FootBoneSpec {
  index: number;
  parent: number; // -1 for root (11 Ankle)
  pivot: [number, number];
  tip: [number, number];
  role: FootBoneRole;
  digit: 0 | 1 | 2 | 3 | 4 | 5;
  isToe: boolean;
  // Local rest calibration (parent frame) to tighten raw spread-eagle kit geometry without editing PNGs
  restDx: number;
  restDy: number;
  restAng: number;
}

export const FOOT_BONE_SPECS: readonly FootBoneSpec[] = [
  // Primary 4 Tarsal Cluster
  {
    index: 11,
    parent: -1,
    pivot: [1430, 698],
    tip: [1430, 1020],
    role: 'ankle',
    digit: 0,
    isToe: false,
    restDx: 0,
    restDy: 0,
    restAng: 0,
  },
  {
    index: 10,
    parent: 11,
    pivot: [1415, 620],
    tip: [1392, 180],
    role: 'heel',
    digit: 0,
    isToe: false,
    restDx: 0,
    restDy: 15,
    restAng: 0,
  },
  {
    index: 1,
    parent: 10,
    pivot: [1240, 645],
    tip: [980, 960],
    role: 'bridge',
    digit: 0,
    isToe: false,
    restDx: 45,
    restDy: -10,
    restAng: 0,
  },
  {
    index: 0,
    parent: 1,
    pivot: [950, 975],
    tip: [878, 1340],
    role: 'cuboid',
    digit: 0,
    isToe: false,
    restDx: 65,
    restDy: -40,
    restAng: -3,
  },

  // Digit 5 (Pinky — connects at Cuboid 0)
  {
    index: 6,
    parent: 0,
    pivot: [845, 1170],
    tip: [545, 2170],
    role: 'metatarsal',
    digit: 5,
    isToe: false,
    restDx: 155,
    restDy: 20,
    restAng: -1.8,
  },
  { index: 7, parent: 6, pivot: [545, 2170], tip: [525, 2418], role: 'prox', digit: 5, isToe: true, restDx: 0, restDy: 0, restAng: 0 },
  { index: 8, parent: 7, pivot: [525, 2418], tip: [520, 2506], role: 'mid', digit: 5, isToe: true, restDx: 0, restDy: 0, restAng: 0 },
  { index: 9, parent: 8, pivot: [520, 2506], tip: [527, 2650], role: 'dist', digit: 5, isToe: true, restDx: 0, restDy: 0, restAng: 0 },

  // Digit 4 (Ring — connects at Cuboid 0)
  {
    index: 2,
    parent: 0,
    pivot: [945, 1210],
    tip: [755, 2225],
    role: 'metatarsal',
    digit: 4,
    isToe: false,
    restDx: 120,
    restDy: 0,
    restAng: -3.2,
  },
  { index: 5, parent: 2, pivot: [755, 2225], tip: [730, 2490], role: 'prox', digit: 4, isToe: true, restDx: 0, restDy: 0, restAng: 0 },
  { index: 3, parent: 5, pivot: [730, 2490], tip: [680, 2675], role: 'mid', digit: 4, isToe: true, restDx: 0, restDy: 0, restAng: 0 },
  { index: 4, parent: 3, pivot: [680, 2675], tip: [654, 2825], role: 'dist', digit: 4, isToe: true, restDx: 0, restDy: 0, restAng: 0 },

  // Digit 3 (Middle — connects at Ankle 11)
  {
    index: 19,
    parent: 11,
    pivot: [1225, 1005],
    tip: [1295, 2150],
    role: 'metatarsal',
    digit: 3,
    isToe: false,
    restDx: -55,
    restDy: 15,
    restAng: 0.8,
  },
  { index: 22, parent: 19, pivot: [1295, 2150], tip: [1315, 2445], role: 'prox', digit: 3, isToe: true, restDx: 0, restDy: 0, restAng: 0 },
  { index: 20, parent: 22, pivot: [1315, 2445], tip: [1320, 2650], role: 'mid', digit: 3, isToe: true, restDx: 0, restDy: 0, restAng: 0 },
  { index: 21, parent: 20, pivot: [1320, 2650], tip: [1317, 2820], role: 'dist', digit: 3, isToe: true, restDx: 0, restDy: 0, restAng: 0 },

  // Digit 2 (Second — connects at Ankle 11)
  {
    index: 15,
    parent: 11,
    pivot: [1460, 995],
    tip: [1520, 2185],
    role: 'metatarsal',
    digit: 2,
    isToe: false,
    restDx: -95,
    restDy: 10,
    restAng: 1.0,
  },
  { index: 16, parent: 15, pivot: [1520, 2185], tip: [1525, 2478], role: 'prox', digit: 2, isToe: true, restDx: 0, restDy: 0, restAng: 0 },
  { index: 17, parent: 16, pivot: [1525, 2478], tip: [1525, 2650], role: 'mid', digit: 2, isToe: true, restDx: 0, restDy: 0, restAng: 0 },
  { index: 18, parent: 17, pivot: [1525, 2650], tip: [1529, 2820], role: 'dist', digit: 2, isToe: true, restDx: 0, restDy: 0, restAng: 0 },

  // Digit 1 (Big / Market — connects at Ankle 11)
  {
    index: 12,
    parent: 11,
    pivot: [1720, 1050],
    tip: [1860, 2115],
    role: 'metatarsal',
    digit: 1,
    isToe: false,
    restDx: -195,
    restDy: 25,
    restAng: 3.5,
  },
  { index: 14, parent: 12, pivot: [1860, 2115], tip: [1895, 2498], role: 'prox', digit: 1, isToe: true, restDx: 0, restDy: 0, restAng: 0 },
  { index: 13, parent: 14, pivot: [1895, 2498], tip: [1900, 2840], role: 'dist', digit: 1, isToe: true, restDx: 0, restDy: 0, restAng: 0 },
] as const;

export const FOOT_SPEC_BY_INDEX: Readonly<Record<number, FootBoneSpec>> = Object.fromEntries(
  FOOT_BONE_SPECS.map((s) => [s.index, s])
);

const FOOT_FK_ORDER: readonly number[] = FOOT_BONE_SPECS.map((s) => s.index);

export interface PiggyFootState {
  heelPitch: number;          // Calcaneus tilt wrt Ankle (deg)
  cuboidFlex: number;         // Cuboid / lateral tarsal compression & pitch (deg)
  archBreakDeg: number;       // 2.5D Midtarsal arch flex (positive = high push-off arch, negative = flat/impact absorb)
  footRotationDeg: number;    // Current foot pitch angle relative to ground plane (deg)
  groundContact: number;      // 0..1 how flush the sole is pressed onto the ground plane
  rollOrder: number;          // -1 (lateral cuboid strike) -> 0 (flat weighted) -> +1 (medial big-toe pushoff)
  toeCurl: number;            // User/procedural toe angle (deg)
  impactDownWeight: number;   // 0..1 downward 3D rotation amplitude on impact
  weightShare: number;        // 0..1 vertical body weight carried by this foot
  dorsalCradleLift: number;   // 0..1 Newton's Cradle anti-trip dorsal bounce clearance
  cradleImpulseWave: number;  // -1..+1 elastic impulse packet traveling laterally <-> medially across foot bones
  isBackView: boolean;        // True when 3rd-person back skull camera is active
}

export const NEUTRAL_PIGGY_FOOT_STATE: PiggyFootState = {
  heelPitch: 0,
  cuboidFlex: 0,
  archBreakDeg: 0,
  footRotationDeg: 0,
  groundContact: 1,
  rollOrder: 0,
  toeCurl: 0,
  impactDownWeight: 0,
  weightShare: 0.5,
  dorsalCradleLift: 0,
  cradleImpulseWave: 0,
  isBackView: false,
};

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Computes ground-plane & 2.5D flexible foot state + Newton's Cradle anti-trip impulses:
 * - Tight bundled metatarsals (zero wide fanning)
 * - 3-zone flexion: Heel cushion -> Midtarsal arch break -> 2.5D foreshortened toe-break
 * - Newton's Cradle collision/graze rebound prevents toes/heels from catching road hitches or the stance foot
 */
export type PiggyFootGaitStyle = 'standard' | 'skate' | 'rubber_hose';

export function computeProceduralPiggyFootState(
  legPhase: number,
  footAngleDeg: number,
  toeAngleDeg: number,
  gait: WalkingEngineGait,
  weightShare: number,
  bumpY = 0,
  interFootGapSvgX = 120,
  isBackView = false,
  gaitStyle: PiggyFootGaitStyle = 'standard'
): PiggyFootState {
  const s = Math.sin(legPhase);
  const c = Math.cos(legPhase);
  const isSkate = gaitStyle === 'skate';
  const isRubberHose = gaitStyle === 'rubber_hose';

  const stanceW = isSkate ? smoothstep(-0.34, 0.22, -s) : smoothstep(-0.24, 0.24, -s);
  const swingW = 1 - stanceW;
  const loadingImpact =
    Math.pow(Math.max(0, -Math.sin(legPhase - 0.55)), 1.65) *
    smoothstep(-0.35, 0.35, -c * 0.4 + 0.65) *
    stanceW;
  const pushOffW = Math.pow(Math.max(0, c), 2) * smoothstep(-0.28, 0.32, -Math.sin(legPhase + 0.28)) * stanceW;

  const impactIntensity = Math.min(
    1,
    (loadingImpact * ((isSkate ? 0.24 : isRubberHose ? 0.72 : 0.58) + gait.gravity * 0.55 + gait.bounce * 0.28) +
      Math.max(0, -bumpY) * 0.018) *
      (0.38 + weightShare * 0.88)
  );

  const rollOrder = isSkate
    ? Math.max(-0.55, Math.min(0.65, c * 0.62))
    : Math.max(-1, Math.min(1, c * 1.18));
  const heelStrikeW = Math.pow(Math.max(0, -c), 2) * stanceW;

  // Zone 1: Hindfoot Heel Cushion
  const heelPitch = isSkate
    ? -impactIntensity * 2.4 + c * 2.8 * stanceW
    : heelStrikeW * (8.5 + gait.foot_roll * 6.5) - impactIntensity * 5.2;

  // Zone 2: Midtarsal Arch Break (stiff skate boot chassis in Skate mode; expressive rubbery slap in Inkwell mode)
  const archBreakDeg = isSkate
    ? pushOffW * 5.2 - impactIntensity * 2.2 - swingW * 1.4
    : pushOffW * ((isRubberHose ? 15.0 : 12.5) + gait.foot_roll * 6.0 + gait.toe_bend * 4.5) -
      impactIntensity * (isRubberHose ? 7.2 : 5.8) -
      swingW * (isRubberHose ? 5.2 : 3.5);

  const cuboidFlex = isSkate
    ? stanceW * (1.8 + weightShare * 3.4 - rollOrder * 2.2) - swingW * 1.5
    : stanceW * (2.5 + weightShare * 6.2 + impactIntensity * 5.4 - rollOrder * 1.8) -
      swingW * 4.2;

  // Newton's Cradle Anti-Trip Impulse:
  // Fires elastic dorsal lift when swinging foot crosses near stance foot OR clears an upward road hitch
  const swingPassProximity = Math.max(0, 1 - Math.abs(interFootGapSvgX) / 88) * swingW;
  const bumpGraze = Math.max(0, -bumpY) * 0.045 * (0.35 + swingW * 0.85);
  const swingPeak = Math.pow(Math.max(0, s), 1.4) * swingW;
  const dorsalCradleLift = Math.min(
    1,
    swingPassProximity * (isSkate ? 0.55 : 0.72) +
      bumpGraze +
      swingPeak * ((isSkate ? 0.16 : isRubberHose ? 0.36 : 0.28) + gait.toe_lift * 0.32)
  );

  // Newton's Cradle elastic wave: rebounds Heel -> Cuboid -> D5..D1 across stance, snaps back on swing release
  const cradleImpulseWave = isSkate
    ? Math.sin(legPhase - 0.3) * 0.28 + swingPassProximity * 0.45
    : Math.sin(legPhase * 2.0 - 0.45) * ((isRubberHose ? 0.48 : 0.35) + impactIntensity * 0.65) +
      swingPassProximity * 0.55;

  return {
    heelPitch,
    cuboidFlex,
    archBreakDeg,
    footRotationDeg: footAngleDeg,
    groundContact: stanceW,
    rollOrder,
    toeCurl: toeAngleDeg,
    impactDownWeight: impactIntensity,
    weightShare,
    dorsalCradleLift,
    cradleImpulseWave,
    isBackView,
  };
}

export interface PiggyFootSolvedAnchors {
  ankle: [number, number];
  heel: [number, number];
  bridge: [number, number];
  cuboid: [number, number];
  mtp: [[number, number], [number, number], [number, number], [number, number], [number, number]]; // D5..D1
  tips: [[number, number], [number, number], [number, number], [number, number], [number, number]]; // D5..D1
  cradleBounces: [number, number, number, number, number]; // per-digit elastic bounce amplitude D5..D1
  antiTripActive: boolean;
}

export interface PiggyFootSolved {
  mats: Array<[number, number, number, number, number, number]>;
  impactDropMat: [number, number, number, number, number, number];
  anchors: PiggyFootSolvedAnchors;
}

type Mat6 = [number, number, number, number, number, number];

const mulMat = (p: Mat6, c: number, s: number, sx: number, sy: number, e: number, f: number): Mat6 => {
  // Local matrix M_local = [c*sx, s*sx, -s*sy, c*sy, e, f] (2.5D scaling around local pivot along limb axis)
  const l0 = c * sx;
  const l1 = s * sx;
  const l2 = -s * sy;
  const l3 = c * sy;
  return [
    p[0] * l0 + p[2] * l1,
    p[1] * l0 + p[3] * l1,
    p[0] * l2 + p[2] * l3,
    p[1] * l2 + p[3] * l3,
    p[0] * e + p[2] * f + p[4],
    p[1] * e + p[3] * f + p[5],
  ];
};

const txPoint = (m: Mat6, pt: readonly [number, number]): [number, number] => [
  m[0] * pt[0] + m[2] * pt[1] + m[4],
  m[1] * pt[0] + m[3] * pt[1] + m[5],
];

/**
 * Solves forward kinematics for all 23 tightened foot bones with:
 * - Zero wide fanning (tight anatomical forefoot)
 * - 3-Zone 2.5D Flexible Foot (Heel cushion, Midfoot arch break, Foreshortened Toe Break)
 * - Newton's Cradle Impulse-Momentum Exchange & Collision Barrier (bones bounce cleanly off each other without tripping)
 */
export function solvePiggyFootFK(
  state: PiggyFootState,
  sideSign: 1 | -1 = 1
): PiggyFootSolved {
  const mats: Mat6[] = new Array(23);
  for (let i = 0; i < 23; i++) mats[i] = [1, 0, 0, 1, 0, 0];

  const localAng = new Float64Array(23);
  const localDx = new Float64Array(23);
  const localDy = new Float64Array(23);
  const localSx = new Float64Array(23).fill(1);
  const localSy = new Float64Array(23).fill(1);

  const cradle = state.cradleImpulseWave;
  const dorsalBounce = state.dorsalCradleLift;

  // =========================================================================
  // 1. TARSAL NEWTON'S CRADLE & 3-ZONE ARCH BREAK (11 Ankle -> 10 Heel -> 1 Bridge -> 0 Cuboid)
  // =========================================================================
  // Heel catches ground strike and elastically rebounds kinetic wave into Bridge & Cuboid
  localAng[10] = -state.heelPitch * 0.56 - dorsalBounce * 6.5;
  localDy[10] = -state.impactDownWeight * 18 - dorsalBounce * 26;

  // Bridge & Cuboid flex the 2.5D midfoot arch cleanly
  localAng[1] = state.cuboidFlex * 0.42 - state.archBreakDeg * 0.28 + cradle * 1.4;
  localDy[1] = -state.archBreakDeg * 2.2 - dorsalBounce * 18;
  localAng[0] = -state.cuboidFlex * 0.65 + state.archBreakDeg * 0.32 - cradle * 1.8;
  localDy[0] = state.impactDownWeight * 22 - state.archBreakDeg * 1.8 - dorsalBounce * 24;

  // Subtle 2.5D foreshortening on Tarsal Bridge/Cuboid when arch breaks steeply
  const archRad = Math.min(0.45, Math.abs(state.archBreakDeg) * PUPPYT_DEG);
  const archCompress = 1 - (1 - Math.cos(archRad)) * 0.35;
  localSy[1] = archCompress;
  localSy[0] = archCompress;

  // Coherent bound metatarsals: subtle midstance transverse spread + arch break fold (< 1.8 deg total)
  const mtSpread = Math.min(1.4, state.weightShare * 0.95 + state.impactDownWeight * 0.45);
  localAng[6] = mtSpread * 0.95 - dorsalBounce * 1.1;   // 5th MT off Cuboid
  localAng[2] = mtSpread * 0.42 - dorsalBounce * 0.7;   // 4th MT off Cuboid
  localAng[19] = 0;                                     // 3rd MT off Ankle
  localAng[15] = -mtSpread * 0.35 + dorsalBounce * 0.6; // 2nd MT off Ankle
  localAng[12] = -mtSpread * 0.68 + dorsalBounce * 1.0; // 1st MT off Ankle

  // 2.5D vertical perspective foreshortening along metatarsal rays when forefoot bends sharply on pushoff/dorsiflexion
  const mtFoldY = 1 - Math.min(0.18, Math.max(0, state.archBreakDeg) * 0.0085 + dorsalBounce * 0.1);
  const mtSpreadW = 1 + (1 - mtFoldY) * 0.22;
  for (const mtIdx of [6, 2, 19, 15, 12]) {
    localSy[mtIdx] = mtFoldY;
    localSx[mtIdx] = mtSpreadW;
    localDy[mtIdx] = -dorsalBounce * 20;
  }

  // =========================================================================
  // 2. PHALANX TOE-BREAK + 2.5D PERSPECTIVE FORESHORTENING + NEWTON'S CRADLE WAVE
  // =========================================================================
  const footTiltSigned = state.footRotationDeg * sideSign;
  const groundCompensation = -footTiltSigned * state.groundContact * 0.48;
  // Pronounced visible push-off extension vs swing anti-trip dorsal snap
  const antiTripExtension = dorsalBounce * 11.5;
  const baseToeBend =
    state.toeCurl * sideSign * 0.44 + groundCompensation - antiTripExtension;

  const lateralEngage = Math.max(0, -state.rollOrder); // peaks during cuboid strike (D5, D4)
  const medialEngage = Math.max(0, state.rollOrder);   // peaks during hallux propulsion (D2, D1)

  // Newton's Cradle impulse packet sweeps D5 -> D4 -> D3 -> D2 -> D1
  const wavePos = (state.rollOrder + 1) * 2.0; // 0 (Pinky) .. 4 (Big)
  const cradlePackets = [0, 1, 2, 3, 4].map((rayIdx) => {
    const distFromWave = Math.abs(rayIdx - wavePos);
    const hit = Math.exp(-distFromWave * distFromWave * 1.15);
    return hit * (0.4 + Math.abs(cradle) * 0.75) * (0.45 + state.weightShare * 0.55);
  }) as [number, number, number, number, number];

  const digitSpecs: Array<{
    rayPos: 0 | 1 | 2 | 3 | 4; // 0=D5 .. 4=D1
    digit: 5 | 4 | 3 | 2 | 1;
    ids: number[]; // [prox, mid?, dist]
    loadBias: number;
  }> = [
    { rayPos: 0, digit: 5, ids: [7, 8, 9], loadBias: lateralEngage * 6.8 + state.weightShare * 2.8 + cradlePackets[0] * 4.2 },
    { rayPos: 1, digit: 4, ids: [5, 3, 4], loadBias: lateralEngage * 5.2 + state.weightShare * 2.4 + cradlePackets[1] * 3.8 },
    { rayPos: 2, digit: 3, ids: [22, 20, 21], loadBias: (1 - Math.abs(state.rollOrder)) * 3.4 + state.weightShare * 2.2 + cradlePackets[2] * 3.2 },
    { rayPos: 3, digit: 2, ids: [16, 17, 18], loadBias: medialEngage * 4.8 + state.weightShare * 2.6 + cradlePackets[3] * 3.6 },
    { rayPos: 4, digit: 1, ids: [14, 13], loadBias: medialEngage * 7.8 - state.impactDownWeight * 3.2 + cradlePackets[4] * 4.5 },
  ];

  // Gotz chain articulation curve + 2.5D longitudinal foreshortening per phalanx
  const chainRatio3 = [0.74, 0.96, 0.62] as const;
  const chainRatio2 = [0.82, 0.68] as const;

  const applyDigitChain = (ids: number[], drive: number, extraTipCurl: number, bounceOffsetY: number) => {
    const foldRatio = Math.max(
      0.56,
      1 - Math.min(0.42, Math.abs(drive) * 0.011 + dorsalBounce * 0.14)
    );
    const widthRatio = 1 + (1 - foldRatio) * 0.24;

    if (ids.length === 3) {
      localAng[ids[0]] = drive * chainRatio3[0];
      localAng[ids[1]] = drive * chainRatio3[1];
      localAng[ids[2]] = drive * chainRatio3[2] + extraTipCurl;
      localSy[ids[0]] = 0.7 + 0.3 * foldRatio;
      localSy[ids[1]] = foldRatio;
      localSy[ids[2]] = 0.65 + 0.35 * foldRatio;
      localSx[ids[0]] = widthRatio;
      localSx[ids[1]] = widthRatio;
      localSx[ids[2]] = widthRatio;
      localDy[ids[0]] = bounceOffsetY;
    } else {
      localAng[ids[0]] = drive * chainRatio2[0];
      localAng[ids[1]] = drive * chainRatio2[1] + extraTipCurl;
      localSy[ids[0]] = 0.72 + 0.28 * foldRatio;
      localSy[ids[1]] = foldRatio;
      localSx[ids[0]] = widthRatio;
      localSx[ids[1]] = widthRatio;
      localDy[ids[0]] = bounceOffsetY;
    }
  };

  for (const d of digitSpecs) {
    const drive = baseToeBend + d.loadBias;
    applyDigitChain(d.ids, drive, 0, -cradlePackets[d.rayPos] * 14);
  }

  const runFKPass = () => {
    for (const idx of FOOT_FK_ORDER) {
      const spec = FOOT_SPEC_BY_INDEX[idx];
      if (!spec) continue;
      const totAng = spec.restAng + localAng[idx];
      const rad = totAng * PUPPYT_DEG;
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      const sx = localSx[idx];
      const sy = localSy[idx];
      const [px, py] = spec.pivot;
      // Scale around pivot (px, py) then rotate then translate by (restDx + localDx, restDy + localDy)
      const e = px - (c * sx * px - s * sy * py) + spec.restDx + localDx[idx];
      const f = py - (s * sx * px + c * sy * py) + spec.restDy + localDy[idx];

      if (spec.parent < 0) {
        mats[idx] = [c * sx, s * sx, -s * sy, c * sy, e, f];
      } else {
        mats[idx] = mulMat(mats[spec.parent], c, s, sx, sy, e, f);
      }
    }
  };

  runFKPass();

  // =========================================================================
  // 3. INTER-DIGIT NEWTON'S CRADLE COLLISION & ELASTIC BOUNCE PASS (NO TRIPPING)
  // =========================================================================
  const distPairs: Array<{ bone: number; mt: number; tip: [number, number]; mtTip: [number, number] }> = [
    { bone: 9, mt: 6, tip: [527, 2650], mtTip: [545, 2170] },
    { bone: 4, mt: 2, tip: [654, 2825], mtTip: [755, 2225] },
    { bone: 21, mt: 19, tip: [1317, 2820], mtTip: [1295, 2150] },
    { bone: 18, mt: 15, tip: [1529, 2820], mtTip: [1520, 2185] },
    { bone: 13, mt: 12, tip: [1900, 2840], mtTip: [1860, 2115] },
  ];

  const solvedTips = distPairs.map((d) => txPoint(mats[d.bone], d.tip));
  const reboundAng = [0, 0, 0, 0, 0];
  const restitution = 0.82;
  const MIN_DIGIT_CLEARANCE_X = 128;

  for (let i = 0; i < 4; i++) {
    const gapX = solvedTips[i + 1][0] - solvedTips[i][0];
    if (gapX < MIN_DIGIT_CLEARANCE_X) {
      const penetration = (MIN_DIGIT_CLEARANCE_X - gapX) * restitution;
      const bounceDeg = Math.min(7.5, penetration * 0.055);
      // Remember Y-down sign: +deg swings distal tip -X (left), -deg swings distal tip +X (right)
      reboundAng[i] += bounceDeg * 0.55;
      reboundAng[i + 1] -= bounceDeg * 0.55;
      cradlePackets[i] = Math.min(1.4, cradlePackets[i] + penetration * 0.012);
      cradlePackets[i + 1] = Math.min(1.4, cradlePackets[i + 1] + penetration * 0.012);
    }
  }

  if (reboundAng.some((v) => Math.abs(v) > 0.05)) {
    const mtIds = [6, 2, 19, 15, 12];
    for (let i = 0; i < 5; i++) {
      localAng[mtIds[i]] += reboundAng[i] * 0.45;
      const d = digitSpecs[i];
      const newDrive = baseToeBend + d.loadBias + reboundAng[i] * 0.55;
      applyDigitChain(d.ids, newDrive, reboundAng[i] * 0.35, -cradlePackets[i] * 18);
    }
    runFKPass();
  }

  // =========================================================================
  // 4. 2.5D DOWNWARD ROTATION & NEWTON'S CRADLE ANTI-TRIP MATRIX
  // =========================================================================
  const drop = state.impactDownWeight;
  const pitchRad = (drop * 8.2 - dorsalBounce * 4.5) * PUPPYT_DEG;
  const dropCos = Math.cos(pitchRad);
  const dropSin = Math.sin(pitchRad);
  const scaleY = 1 + drop * 0.085 - dorsalBounce * 0.055;
  const scaleX = 1 + drop * 0.04;
  const ax = 1430;
  const ay = 698;
  const ia = dropCos * scaleX;
  const ib = dropSin * scaleX;
  const ic = -dropSin * scaleY;
  const id = dropCos * scaleY;
  const ie = ax - (ia * ax + ic * ay);
  const ifv = ay - (ib * ax + id * ay) + drop * 28 - dorsalBounce * 36;
  const impactDropMat: Mat6 = [ia, ib, ic, id, ie, ifv];

  const applyDrop = (pt: [number, number]): [number, number] => [
    impactDropMat[0] * pt[0] + impactDropMat[2] * pt[1] + impactDropMat[4],
    impactDropMat[1] * pt[0] + impactDropMat[3] * pt[1] + impactDropMat[5],
  ];

  const anchors: PiggyFootSolvedAnchors = {
    ankle: applyDrop(txPoint(mats[11], [1430, 698])),
    heel: applyDrop(txPoint(mats[10], [1392, 180])),
    bridge: applyDrop(txPoint(mats[1], [1110, 800])),
    cuboid: applyDrop(txPoint(mats[0], [950, 975])),
    mtp: [
      applyDrop(txPoint(mats[6], [545, 2170])),
      applyDrop(txPoint(mats[2], [755, 2225])),
      applyDrop(txPoint(mats[19], [1295, 2150])),
      applyDrop(txPoint(mats[15], [1520, 2185])),
      applyDrop(txPoint(mats[12], [1860, 2115])),
    ],
    tips: [
      applyDrop(txPoint(mats[9], [527, 2650])),
      applyDrop(txPoint(mats[4], [654, 2825])),
      applyDrop(txPoint(mats[21], [1317, 2820])),
      applyDrop(txPoint(mats[18], [1529, 2820])),
      applyDrop(txPoint(mats[13], [1900, 2840])),
    ],
    cradleBounces: cradlePackets,
    antiTripActive: dorsalBounce > 0.22 || reboundAng.some((v) => Math.abs(v) > 0.2),
  };

  return {
    mats,
    impactDropMat,
    anchors,
  };
}
