import React, { useState, useEffect, useRef, useCallback } from 'react';
import saveAs from 'file-saver';
import {
  GotzHandPresetName,
  HeadTurnStep,
  ModelVersion,
  PerspectiveState,
  RibAnchorMode,
  RigVisualMode,
  ThemeMode,
  WalkPerspectiveMode,
  WalkingEngineGait,
  WalkingEnginePivotOffsets,
  WalkingEnginePose,
  WalkingEngineProportions,
} from './types';
import {
  ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT,
  CORE_DEFAULT_PIVOT_OFFSETS,
  LEGACY_DEFAULT_PIVOT_OFFSETS,
  MANNEQUIN_LOCAL_FLOOR_Y,
  STAGE_PALETTES,
} from './constants';
import { SystemGuides } from './components/SystemGrid';
import { Mannequin } from './components/Mannequin';
import { PuppytSkeleton } from './components/PuppytSkeleton';
import { lerp, easeInOutQuint } from './utils/kinematics';
import { computeProceduralGotzHandState } from './utils/gotz-hand';
import {
  NEUTRAL_PIGGY_FOOT_STATE,
  PiggyFootGaitStyle,
  PiggyFootState,
  computeProceduralPiggyFootState,
} from './utils/piggy-foot';
import {
  HEAD_TURN_SEQUENCE,
  PUPPYT_STAGE_SCALE,
  PuppytRawPartsDef,
  PuppytRawRigDef,
  PuppytRigGraph,
  SKULL_VIEW_SPECS,
  applyPoseToPuppytRig,
  bakeFrontSkullDataUrl,
  buildPuppytRigGraph,
  computePerspectiveSpineBend,
  getSkullBoxForHead,
  loadNormalizedSkullDataUrl,
} from './utils/puppyt-rig';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  disabled?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultOpen = true,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={`flex flex-col gap-2 p-4 border rounded shadow-sm transition-colors ${
        disabled ? 'border-ridge bg-mono-darker/50 opacity-50' : 'border-ridge bg-mono-dark'
      }`}
    >
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex justify-between items-center w-full text-[10px] text-selection font-bold tracking-[0.2em] uppercase cursor-pointer border-b border-ridge pb-1.5 ${
          disabled ? 'text-mono-mid cursor-not-allowed' : 'hover:text-ink transition-colors'
        }`}
        disabled={disabled}
      >
        <span>{title}</span>
        <span className="text-mono-mid text-[9px]">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && <div className="pt-2">{children}</div>}
    </div>
  );
};

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

// C1-smooth half-wave lift: zero value AND zero derivative at 0 and PI -> zero transition hitch
const smoothLift = (phase: number): number => {
  const s = Math.sin(phase);
  return s > 0 ? Math.pow(s, 1.65) : 0;
};

// Wide-range calibrated presets for bitruvian.human.puppyt (Core Doll)
const coreGaitPresets: WalkingEngineGait[] = [
  // 0: Tiny Tip-Toe
  {
    intensity: 0.45,
    stride: 0.28,
    lean: -0.06,
    frequency: 1.55,
    gravity: 0.15,
    bounce: 0.16,
    bends: 0.48,
    head_spin: 0.0,
    mood: 0.78,
    ground_drag: 0.02,
    foot_angle_on_ground: 26,
    arm_swing: 0.32,
    elbow_bend: 0.72,
    wrist_swing: 0.58,
    foot_roll: 0.45,
    toe_lift: 0.2,
    shin_tilt: -0.08,
    foot_slide: 0.0,
    kick_up_force: 0.08,
    hover_height: 0.1,
    waist_twist: 0.18,
    hip_sway: 0.22,
    toe_bend: 1.35,
  },
  // 1: Elderly Shuffle
  {
    intensity: 0.55,
    stride: 0.34,
    lean: 0.44,
    frequency: 0.74,
    gravity: 0.88,
    bounce: 0.08,
    bends: 0.58,
    head_spin: 0.0,
    mood: 0.2,
    ground_drag: 0.75,
    foot_angle_on_ground: -3,
    arm_swing: 0.26,
    elbow_bend: 0.48,
    wrist_swing: 0.18,
    foot_roll: 0.32,
    toe_lift: 0.18,
    shin_tilt: -0.1,
    foot_slide: 0.28,
    kick_up_force: 0.04,
    hover_height: 0.02,
    waist_twist: 0.14,
    hip_sway: 0.28,
    toe_bend: 0.45,
  },
  // 2: Natural Walk (Default Calibrated)
  {
    intensity: 0.9,
    stride: 0.8,
    lean: 0.06,
    frequency: 1.2,
    gravity: 0.45,
    bounce: 0.38,
    bends: 0.95,
    head_spin: 0.0,
    mood: 0.65,
    ground_drag: 0.14,
    foot_angle_on_ground: 0,
    arm_swing: 0.78,
    elbow_bend: 0.55,
    wrist_swing: 0.68,
    foot_roll: 0.9,
    toe_lift: 0.8,
    shin_tilt: 0.0,
    foot_slide: 0.04,
    kick_up_force: 0.35,
    hover_height: 0.14,
    waist_twist: 0.48,
    hip_sway: 0.42,
    toe_bend: 0.95,
  },
  // 3: Spry Child Run
  {
    intensity: 1.35,
    stride: 1.24,
    lean: 0.22,
    frequency: 2.35,
    gravity: 0.25,
    bounce: 1.35,
    bends: 1.38,
    head_spin: 0.0,
    mood: 0.96,
    ground_drag: 0.04,
    foot_angle_on_ground: 6,
    arm_swing: 1.32,
    elbow_bend: 0.92,
    wrist_swing: 1.28,
    foot_roll: 1.12,
    toe_lift: 1.05,
    shin_tilt: 0.12,
    foot_slide: 0.02,
    kick_up_force: 0.92,
    hover_height: 0.44,
    waist_twist: 0.82,
    hip_sway: 0.38,
    toe_bend: 1.25,
  },
  // 4: Skate Mode (Carving Glide + Blade Edge Push-Off)
  {
    intensity: 1.25,
    stride: 1.48,
    lean: 0.28,
    frequency: 1.05,
    gravity: 0.22,
    bounce: 0.14,
    bends: 1.18,
    head_spin: 0.0,
    mood: 0.85,
    ground_drag: 0.04,
    foot_angle_on_ground: -2,
    arm_swing: 1.18,
    elbow_bend: 0.62,
    wrist_swing: 0.82,
    foot_roll: 0.58,
    toe_lift: 0.36,
    shin_tilt: 0.14,
    foot_slide: 0.78,
    kick_up_force: 0.34,
    hover_height: 0.22,
    waist_twist: 0.86,
    hip_sway: 1.08,
    toe_bend: 0.48,
  },
  // 5: Cartoon (Fleischer / Out of the Inkwell Clown Rubber-Hose Physics)
  {
    intensity: 1.48,
    stride: 1.18,
    lean: 0.22,
    frequency: 1.68,
    gravity: 0.26,
    bounce: 1.38,
    bends: 1.46,
    head_spin: 0.0,
    mood: 0.96,
    ground_drag: 0.08,
    foot_angle_on_ground: 4,
    arm_swing: 1.48,
    elbow_bend: 0.86,
    wrist_swing: 1.62,
    foot_roll: 1.16,
    toe_lift: 1.08,
    shin_tilt: 0.18,
    foot_slide: 0.06,
    kick_up_force: 0.84,
    hover_height: 0.52,
    waist_twist: 1.15,
    hip_sway: 1.12,
    toe_bend: 1.24,
  },
];
const corePresetNames = [
  'Tiny Tip-Toe',
  'Elderly Shuffle',
  'Natural Walk',
  'Spry Child Run',
  'Skate Mode',
  'Cartoon (Inkwell)',
];

// Calibrated stochastic jitter envelope per preset so every click spawns a fresh unique cycle within range
const corePresetVariation: Array<Partial<Record<keyof WalkingEngineGait, number>>> = [
  // Tiny Tip-Toe
  { intensity: 0.1, stride: 0.08, frequency: 0.25, bounce: 0.08, foot_angle_on_ground: 5, arm_swing: 0.12, toe_bend: 0.22 },
  // Elderly Shuffle
  { intensity: 0.12, stride: 0.1, lean: 0.14, frequency: 0.14, ground_drag: 0.16, foot_slide: 0.1, hip_sway: 0.1 },
  // Natural Walk
  { intensity: 0.18, stride: 0.2, lean: 0.08, frequency: 0.22, bounce: 0.14, arm_swing: 0.2, waist_twist: 0.16, hip_sway: 0.14 },
  // Spry Child Run
  { intensity: 0.28, stride: 0.28, lean: 0.14, frequency: 0.45, bounce: 0.35, bends: 0.28, kick_up_force: 0.25, hover_height: 0.16 },
  // Skate Mode
  { intensity: 0.18, stride: 0.26, lean: 0.12, frequency: 0.18, hip_sway: 0.24, foot_slide: 0.18, arm_swing: 0.25 },
  // Cartoon (Inkwell Rubber-Hose)
  { intensity: 0.24, stride: 0.2, lean: 0.14, frequency: 0.26, bounce: 0.28, bends: 0.24, arm_swing: 0.28, wrist_swing: 0.32, hip_sway: 0.22 },
];

// Legacy Manikin presets
const legacyGaitPresets: WalkingEngineGait[] = [
  {
    intensity: 0.8,
    stride: 0.7,
    lean: 0.1,
    frequency: 1.2,
    gravity: 0.6,
    bounce: 0.2,
    bends: 0.8,
    head_spin: 0.0,
    mood: 0.8,
    ground_drag: 0.3,
    foot_angle_on_ground: 0,
    arm_swing: 0.6,
    elbow_bend: 0.7,
    wrist_swing: 0.6,
    foot_roll: 0.6,
    toe_lift: 0.6,
    shin_tilt: 0.0,
    foot_slide: 0.2,
    kick_up_force: 0.4,
    hover_height: 0.1,
    waist_twist: 0.3,
    hip_sway: 0.4,
    toe_bend: 0.8,
  },
  {
    intensity: 1.0,
    stride: 1.0,
    lean: 0.2,
    frequency: 1.8,
    gravity: 0.4,
    bounce: 0.8,
    bends: 1.0,
    head_spin: 0.0,
    mood: 1.0,
    ground_drag: 0.1,
    foot_angle_on_ground: 0,
    arm_swing: 0.9,
    elbow_bend: 0.9,
    wrist_swing: 0.8,
    foot_roll: 0.8,
    toe_lift: 0.8,
    shin_tilt: 0.0,
    foot_slide: 0.1,
    kick_up_force: 0.8,
    hover_height: 0.2,
    waist_twist: 0.2,
    hip_sway: 0.2,
    toe_bend: 1.0,
  },
];
const legacyPresetNames = ['Normal Walk', 'Run'];

const GOTZ_PRESET_OPTIONS: GotzHandPresetName[] = [
  'Dynamic',
  'Neutral',
  'Grip',
  'Open',
  'Fist',
  'Point',
  'Peace',
  'Rock',
  'Pinch',
  'Flat',
];

const calculateLegacyLegVerticalHeight = (
  legAngles: { hip: number; knee: number; foot: number; toe: number },
  proportions: WalkingEngineProportions,
  baseUnitH: number,
  isRight: boolean
): number => {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const thighKey = isRight ? 'r_upper_leg' : 'l_upper_leg';
  const calfKey = isRight ? 'r_lower_leg' : 'l_lower_leg';
  const footKey = isRight ? 'r_foot' : 'l_foot';
  const toeKey = isRight ? 'r_toe' : 'l_toe';

  const thighLength = (proportions[thighKey]?.h ?? 1) * ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LEG_UPPER * baseUnitH;
  const calfLength = (proportions[calfKey]?.h ?? 1) * ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LEG_LOWER * baseUnitH;
  const footLength = (proportions[footKey]?.h ?? 1) * ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.FOOT * baseUnitH;
  const toeLength = (proportions[toeKey]?.h ?? 1) * ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.TOE * baseUnitH;

  const hipRad = rad(legAngles.hip);
  const kneeRad = rad(legAngles.knee);
  const footRad = rad(legAngles.foot);
  const toeRad = rad(legAngles.toe);

  return (
    thighLength * Math.cos(hipRad) +
    calfLength * Math.cos(hipRad + kneeRad) +
    footLength * Math.cos(hipRad + kneeRad + footRad) +
    toeLength * Math.cos(hipRad + kneeRad + footRad + toeRad)
  );
};

const gaitSliderConfig: Record<
  keyof Omit<WalkingEngineGait, 'head_spin'>,
  { min: number; max: number; hardMin: number; hardMax: number; step: number; label: string }
> = {
  intensity: { min: 0.05, max: 2.8, hardMin: 0.02, hardMax: 5.0, step: 0.01, label: 'Intensity' },
  stride: { min: 0.05, max: 2.5, hardMin: 0.02, hardMax: 4.5, step: 0.01, label: 'Stride Length' },
  lean: { min: -1.2, max: 1.2, hardMin: -2.5, hardMax: 2.5, step: 0.01, label: 'Body Lean' },
  frequency: { min: 0.15, max: 5.5, hardMin: 0.08, hardMax: 9.0, step: 0.01, label: 'Frequency' },
  gravity: { min: 0, max: 1, hardMin: 0, hardMax: 1.8, step: 0.01, label: 'Gravity' },
  bounce: { min: 0, max: 2.6, hardMin: 0, hardMax: 4.5, step: 0.01, label: 'Bounce' },
  bends: { min: 0, max: 2.6, hardMin: 0, hardMax: 4.5, step: 0.01, label: 'Limb Bendiness' },
  mood: { min: 0, max: 1, hardMin: 0, hardMax: 1.5, step: 0.01, label: 'Mood' },
  ground_drag: { min: 0, max: 1, hardMin: 0, hardMax: 1.8, step: 0.01, label: 'Ground Drag' },
  foot_angle_on_ground: { min: -45, max: 45, hardMin: -75, hardMax: 75, step: 1, label: 'Foot / Tip-Toe Angle' },
  arm_swing: { min: 0, max: 2.6, hardMin: 0, hardMax: 4.5, step: 0.01, label: 'Arm Swing' },
  elbow_bend: { min: 0, max: 1.2, hardMin: 0, hardMax: 2.0, step: 0.01, label: 'Elbow Bend' },
  wrist_swing: { min: 0, max: 2.6, hardMin: 0, hardMax: 4.5, step: 0.01, label: 'Wrist Swing' },
  foot_roll: { min: 0, max: 1.6, hardMin: 0, hardMax: 3.0, step: 0.01, label: 'Foot Roll' },
  toe_lift: { min: 0, max: 1.5, hardMin: 0, hardMax: 2.8, step: 0.01, label: 'Toe Lift' },
  shin_tilt: { min: -1, max: 1, hardMin: -2.2, hardMax: 2.2, step: 0.01, label: 'Shin Tilt' },
  foot_slide: { min: 0, max: 1, hardMin: 0, hardMax: 1.8, step: 0.01, label: 'Foot Slide' },
  kick_up_force: { min: 0, max: 1.5, hardMin: 0, hardMax: 3.0, step: 0.01, label: 'Kick Up Force' },
  hover_height: { min: 0, max: 1.2, hardMin: 0, hardMax: 2.4, step: 0.01, label: 'Hover Height' },
  waist_twist: { min: 0, max: 2.5, hardMin: 0, hardMax: 4.2, step: 0.01, label: 'Waist Twist' },
  hip_sway: { min: 0, max: 2.5, hardMin: 0, hardMax: 4.2, step: 0.01, label: 'Hip Sway' },
  toe_bend: { min: 0, max: 2.2, hardMin: 0, hardMax: 3.6, step: 0.01, label: 'Toe Bend' },
};

// Sliding slider bounds: dynamically shifts/expands to keep arrived procedural/randomized values inside an expressive window!
function getSlidingRange(
  key: keyof Omit<WalkingEngineGait, 'head_spin'>,
  val: number
): { min: number; max: number; expanded: boolean } {
  const cfg = gaitSliderConfig[key];
  const baseSpan = cfg.max - cfg.min;
  let min = cfg.min;
  let max = cfg.max;
  let expanded = false;

  if (val > max - baseSpan * 0.12) {
    max = Math.min(cfg.hardMax, Math.ceil((val + baseSpan * 0.25) * 10) / 10);
    // Slide min upward slightly only if far beyond base min, otherwise expand max so lower controls remain reachable
    if (val > cfg.max * 1.15) {
      min = Math.max(cfg.hardMin, Math.floor((val - baseSpan) * 10) / 10);
    }
    expanded = true;
  } else if (val < min + baseSpan * 0.12 && val < cfg.min) {
    min = Math.max(cfg.hardMin, Math.floor((val - baseSpan * 0.25) * 10) / 10);
    if (val < cfg.min * 1.15) {
      max = Math.min(cfg.hardMax, Math.ceil((val + baseSpan) * 10) / 10);
    }
    expanded = true;
  }

  return { min, max, expanded };
}

const DEFAULT_PROPORTIONS: WalkingEngineProportions = {
  head: { w: 1, h: 1 },
  collar: { w: 1, h: 1 },
  torso: { w: 1, h: 1 },
  waist: { w: 1, h: 1 },
  l_upper_arm: { w: 1, h: 1 },
  l_lower_arm: { w: 1, h: 1 },
  l_hand: { w: 1, h: 1 },
  r_upper_arm: { w: 1, h: 1 },
  r_lower_arm: { w: 1, h: 1 },
  r_hand: { w: 1, h: 1 },
  l_upper_leg: { w: 1, h: 1 },
  l_lower_leg: { w: 1, h: 1 },
  l_foot: { w: 1, h: 1 },
  r_upper_leg: { w: 1, h: 1 },
  r_lower_leg: { w: 1, h: 1 },
  r_foot: { w: 1, h: 1 },
  l_toe: { w: 1, h: 1 },
  r_toe: { w: 1, h: 1 },
};

const PIVOT_DISPLAY_ORDER: Array<keyof WalkingEnginePivotOffsets> = [
  'neck',
  'collar',
  'torso',
  'waist',
  'l_shoulder',
  'r_shoulder',
  'l_elbow',
  'r_elbow',
  'l_hand',
  'r_hand',
  'l_fingers',
  'r_fingers',
  'l_hip',
  'r_hip',
  'l_knee',
  'r_knee',
  'l_foot',
  'r_foot',
  'l_toe',
  'r_toe',
];

const POSE_KEYS: Array<keyof WalkingEnginePose> = [
  'waist',
  'neck',
  'collar',
  'torso',
  'l_shoulder',
  'r_shoulder',
  'l_elbow',
  'r_elbow',
  'l_hand',
  'r_hand',
  'l_hip',
  'r_hip',
  'l_knee',
  'r_knee',
  'l_foot',
  'r_foot',
  'l_toe',
  'r_toe',
  'stride_phase',
  'y_offset',
  'x_offset',
];

const INITIAL_POSE: WalkingEnginePose = {
  waist: 0,
  neck: 0,
  collar: 0,
  torso: 0,
  l_shoulder: 0,
  r_shoulder: 0,
  l_elbow: 0,
  r_elbow: 0,
  l_hand: 0,
  r_hand: 0,
  l_hip: 0,
  r_hip: 0,
  l_knee: 0,
  r_knee: 0,
  l_foot: 0,
  r_foot: 0,
  l_toe: 0,
  r_toe: 0,
  stride_phase: 0,
  y_offset: 0,
  x_offset: 0,
};

function stepSecondOrderSpring(
  state: { pos: number; vel: number },
  target: number,
  impulse: number,
  omega: number,
  zeta: number,
  dt: number
): number {
  const accel = omega * omega * (target - state.pos) - 2 * zeta * omega * state.vel + impulse;
  state.vel += accel * dt;
  // Clamp runaway velocities during extreme FPS drops or large step jumps
  state.vel = Math.max(-720, Math.min(720, state.vel));
  state.pos += state.vel * dt;
  return state.pos;
}

const App: React.FC = () => {
  const [modelVersion, setModelVersion] = useState<ModelVersion>('core');
  const [theme, setTheme] = useState<ThemeMode>('light');

  // 4-step 360° Skull Turntable (Front -> Side R -> Back -> Side L)
  const [headTurnStep, setHeadTurnStep] = useState<HeadTurnStep>(0);
  const [skullOverrideUrl, setSkullOverrideUrl] = useState<string | null>(null);
  const [skullOverrideBox, setSkullOverrideBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Perspective Engine & Camera Walk Modes
  const [walkPerspective, setWalkPerspective] = useState<WalkPerspectiveMode>('front');
  const [perspective, setPerspective] = useState<PerspectiveState>({
    enabled: true,
    vpX: 0,
    horizonY: -533,
    strength: 0.78,
  });
  const [draggingPersp, setDraggingPersp] = useState<'vp' | 'horizon' | null>(null);

  // Sibling Rig Systems (Bitruvian.Human.Puppyt parity + Dark Green Pure Vector X-Ray toggle)
  const [prometheusWings, setPrometheusWings] = useState(false);
  const [ribAnchor, setRibAnchor] = useState<RibAnchorMode>('upper');
  const [rigVisualMode, setRigVisualMode] = useState<RigVisualMode>('analog');
  const [constrainLimits, setConstrainLimits] = useState(true);
  const [spineUnlocked, setSpineUnlocked] = useState(true);
  const [roadHitchesEnabled, setRoadHitchesEnabled] = useState(true);
  const [eyesActive, setEyesActive] = useState(false); // Deactivated by default like Bitruvian.Human.Puppyt
  const [useAdvancedHands, setUseAdvancedHands] = useState(true);
  const [handPreset, setHandPreset] = useState<GotzHandPresetName>('Dynamic');
  const [useAdvancedFeet, setUseAdvancedFeet] = useState(true);

  const [showPivots, setShowPivots] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [bobblehead, setBobblehead] = useState(false);
  const [isGroundedMode, setIsGroundedMode] = useState(true);
  const [isGlideMode, setIsGlideMode] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [targetFps, setTargetFps] = useState(60);
  const H = 150;

  // Load real bitruvian.human.puppyt skeletal assets + Piggy multi-bone foot parts from /rig-data.json
  const puppytGraphRef = useRef<PuppytRigGraph | null>(null);
  const [puppytLoaded, setPuppytLoaded] = useState(false);
  const [puppytLoadError, setPuppytLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/rig-data.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ rig: PuppytRawRigDef; parts?: PuppytRawPartsDef }>;
      })
      .then((data) => {
        if (cancelled) return;
        const graph = buildPuppytRigGraph(data.rig, data.parts);
        puppytGraphRef.current = graph;
        setPuppytLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setPuppytLoadError(err instanceof Error ? err.message : 'Failed to load skeletal rig');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load Front (deactivated-eye composite by default), Side, or Back Skull aligned to anti-phallic head node
  const currentHeadSpec = HEAD_TURN_SEQUENCE[headTurnStep];
  useEffect(() => {
    let cancelled = false;
    const view = currentHeadSpec.view;
    if (view === 'front') {
      const headPieces = puppytGraphRef.current?.headPieces;
      if (headPieces && headPieces.length > 0) {
        bakeFrontSkullDataUrl(headPieces, eyesActive)
          .then((url) => {
            if (cancelled) return;
            setSkullOverrideUrl(url);
            setSkullOverrideBox(null);
          })
          .catch(() => {
            if (!cancelled) {
              setSkullOverrideUrl(null);
              setSkullOverrideBox(null);
            }
          });
      } else {
        setSkullOverrideUrl(null);
        setSkullOverrideBox(null);
      }
      return;
    }
    loadNormalizedSkullDataUrl(view)
      .then((url) => {
        if (cancelled) return;
        const headNode = puppytGraphRef.current?.by.head;
        const box = getSkullBoxForHead(view, headNode) ?? {
          x: SKULL_VIEW_SPECS[view].dx,
          y: SKULL_VIEW_SPECS[view].dy,
          w: SKULL_VIEW_SPECS[view].w,
          h: SKULL_VIEW_SPECS[view].h,
        };
        setSkullOverrideUrl(url);
        setSkullOverrideBox(box);
      })
      .catch(() => {
        if (!cancelled) {
          setSkullOverrideUrl(null);
          setSkullOverrideBox(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentHeadSpec.view, puppytLoaded, eyesActive]);

  // Sync `.dark` class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const currentViewBox = '-500 -1500 1000 2000';
  const visualFloorY = 500;
  const mannequinBaseYTranslation = visualFloorY - MANNEQUIN_LOCAL_FLOOR_Y * H;

  const getRestingPose = useCallback(
    (ver: ModelVersion): WalkingEnginePose => ({
      ...INITIAL_POSE,
      l_shoulder: ver === 'core' ? 0 : 90,
      r_shoulder: ver === 'core' ? 0 : -90,
    }),
    []
  );

  // Continuous transition & spring physics refs
  const phaseRef = useRef(0);
  const prevTickTimeRef = useRef(0);
  const lastRenderTimeRef = useRef(0);
  const wingPopRef = useRef(0);

  const isTransitioningToRestRef = useRef(false);
  const pauseTransitionStartRef = useRef(0);
  const initialPoseOnPauseRef = useRef<WalkingEnginePose | null>(null);
  const PAUSE_TRANSITION_DURATION = 900;

  const resumeBlendRef = useRef(1);
  const resumeStartPoseRef = useRef<WalkingEnginePose | null>(null);
  const RESUME_BLEND_DURATION = 0.45;

  const DEFAULT_CORE_PRESET_INDEX = 2; // Natural Walk
  const [gait, setGait] = useState<WalkingEngineGait>(coreGaitPresets[DEFAULT_CORE_PRESET_INDEX]);
  const [activePresetIndex, setActivePresetIndex] = useState(DEFAULT_CORE_PRESET_INDEX);
  const liveGaitRef = useRef<WalkingEngineGait>({ ...coreGaitPresets[DEFAULT_CORE_PRESET_INDEX] });
  const targetGaitRef = useRef<WalkingEngineGait>({ ...coreGaitPresets[DEFAULT_CORE_PRESET_INDEX] });
  const uiSyncCounterRef = useRef(0);

  const [pose, setPose] = useState<WalkingEnginePose>({ ...INITIAL_POSE });
  const livePoseRef = useRef<WalkingEnginePose>({ ...INITIAL_POSE });

  const [pivotOffsets, setPivotOffsets] = useState<WalkingEnginePivotOffsets>({
    ...CORE_DEFAULT_PIVOT_OFFSETS,
  });
  const pivotOffsetsRef = useRef(pivotOffsets);
  useEffect(() => {
    pivotOffsetsRef.current = pivotOffsets;
  }, [pivotOffsets]);

  const [footContacts, setFootContacts] = useState<{
    lPlanted: boolean;
    rPlanted: boolean;
    lFootX: number;
    rFootX: number;
    pelvisX: number;
    lWeight: number;
    rWeight: number;
    lRoadOffsetY: number;
    rRoadOffsetY: number;
  }>({
    lPlanted: false,
    rPlanted: false,
    lFootX: 52,
    rFootX: -52,
    pelvisX: 0,
    lWeight: 0.5,
    rWeight: 0.5,
    lRoadOffsetY: 0,
    rRoadOffsetY: 0,
  });

  const headSpring = useRef({ pos: 0, vel: 0 });
  const limbSprings = useRef({
    lKnee: { pos: 0, vel: 0 },
    rKnee: { pos: 0, vel: 0 },
    lElbow: { pos: 0, vel: 0 },
    rElbow: { pos: 0, vel: 0 },
    prevLHip: 0,
    prevRHip: 0,
    prevLShoulder: 0,
    prevRShoulder: 0,
    sideBalanceOffsetX: 0,
  });
  const totalPhaseRef = useRef(0);
  const stepTerrainRef = useRef({
    lastStepIndex: -1,
    targetLBump: 0,
    targetRBump: 0,
    curLBump: 0,
    curRBump: 0,
    targetPitchL: 0,
    targetPitchR: 0,
    curPitchL: 0,
    curPitchR: 0,
    targetStumblePitch: 0,
    curStumblePitch: 0,
    targetArmFlare: 0,
    curArmFlare: 0,
    strideMod: 1,
    curStrideMod: 1,
  });
  const smoothedWaistTwistRef = useRef(0);
  const smoothedTorsoLeanRef = useRef(0);
  const smoothedWaistSwayRef = useRef(0);
  const smoothedBodySwayXRef = useRef(0);
  const smoothedBobbingRef = useRef(0);
  const smoothedLumbarCompRef = useRef(0);

  // Live Gotz hand & Piggy foot state refs for Puppet skeleton
  const liveHandStateRef = useRef({
    L: computeProceduralGotzHandState('L', 'Dynamic', 0, 0, coreGaitPresets[DEFAULT_CORE_PRESET_INDEX], 0),
    R: computeProceduralGotzHandState('R', 'Dynamic', 0, 0, coreGaitPresets[DEFAULT_CORE_PRESET_INDEX], 0),
  });
  const liveFootStateRef = useRef<{ L: PiggyFootState; R: PiggyFootState }>({
    L: { ...NEUTRAL_PIGGY_FOOT_STATE },
    R: { ...NEUTRAL_PIGGY_FOOT_STATE },
  });
  const lastFootGapRef = useRef(120);

  const [props, setProps] = useState<WalkingEngineProportions>({ ...DEFAULT_PROPORTIONS });

  const [showSplash, setShowSplash] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordFrameCount, setRecordFrameCount] = useState(60);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const framesRecordedRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [draggingBoneKey, setDraggingBoneKey] = useState<keyof WalkingEnginePivotOffsets | null>(null);
  const [hoveredBoneKey, setHoveredBoneKey] = useState<keyof WalkingEnginePivotOffsets | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartPivotOffsetRef = useRef(0);

  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleModelSwitch = useCallback((nextModel: ModelVersion) => {
    setModelVersion(nextModel);
    resumeStartPoseRef.current = { ...livePoseRef.current };
    resumeBlendRef.current = 0;

    if (nextModel === 'core') {
      setPivotOffsets({ ...CORE_DEFAULT_PIVOT_OFFSETS });
      targetGaitRef.current = { ...coreGaitPresets[2] };
      setActivePresetIndex(2);
      setIsGroundedMode(true);
    } else {
      setPivotOffsets({ ...LEGACY_DEFAULT_PIVOT_OFFSETS });
      targetGaitRef.current = { ...legacyGaitPresets[0] };
      setActivePresetIndex(0);
    }
  }, []);

  const handleWalkPerspectiveChange = useCallback((mode: WalkPerspectiveMode) => {
    resumeStartPoseRef.current = { ...livePoseRef.current };
    resumeBlendRef.current = 0;
    setWalkPerspective(mode);
    if (mode === 'front') setHeadTurnStep(0);
    else if (mode === 'side_balance') setHeadTurnStep(1);
    else if (mode === 'back_3p') setHeadTurnStep(2);
  }, []);

  // Spawn a fresh procedural cycle within the selected preset's calibrated range every single click
  const spawnPresetCycle = useCallback(
    (index: number) => {
      const base = modelVersion === 'core' ? coreGaitPresets[index] : legacyGaitPresets[index];
      if (!base) return;
      const varSpec = modelVersion === 'core' ? corePresetVariation[index] : undefined;
      const spawned: WalkingEngineGait = { ...base };

      if (varSpec) {
        (Object.keys(varSpec) as Array<keyof WalkingEngineGait>).forEach((k) => {
          const amp = varSpec[k] ?? 0;
          const jitter = (Math.random() * 2 - 1) * amp;
          const minBound = k === 'lean' || k === 'shin_tilt' || k === 'foot_angle_on_ground' ? -75 : 0;
          spawned[k] = Math.max(minBound, base[k] + jitter);
        });
      }

      // Advance phase slightly so clicking any preset visibly launches into a fresh stride cycle
      phaseRef.current = (phaseRef.current + Math.PI * (0.35 + Math.random() * 0.45)) % (Math.PI * 2);
      if (isPaused) {
        isTransitioningToRestRef.current = false;
        resumeStartPoseRef.current = { ...livePoseRef.current };
        resumeBlendRef.current = 0;
        setIsPaused(false);
      }

      targetGaitRef.current = spawned;
      setGait(spawned);
      setActivePresetIndex(index);
    },
    [modelVersion, isPaused]
  );

  useEffect(() => {
    let frame: number;
    const animate = (time: number) => {
      frame = requestAnimationFrame(animate);

      if (prevTickTimeRef.current === 0) {
        prevTickTimeRef.current = time;
        lastRenderTimeRef.current = time;
      }

      const dt = Math.min(0.05, Math.max(0.0001, (time - prevTickTimeRef.current) / 1000));
      prevTickTimeRef.current = time;

      const fpsInterval = 1000 / targetFps;
      const renderElapsed = time - lastRenderTimeRef.current;
      const shouldRender = renderElapsed >= fpsInterval * 0.9;
      if (shouldRender) {
        lastRenderTimeRef.current = time - (renderElapsed % fpsInterval);
      }

      if (isRecording && shouldRender) {
        framesRecordedRef.current += 1;
        if (framesRecordedRef.current >= recordFrameCount) {
          mediaRecorderRef.current?.stop();
        }
      }

      // Smoothly animate Prometheus wings blend (zero hitch)
      const wingTarget = prometheusWings ? 1 : 0;
      wingPopRef.current = lerp(wingPopRef.current, wingTarget, 1 - Math.exp(-8.5 * dt));

      // Smoothly interpolate liveGait toward targetGait every single frame
      const gaitAlpha = 1 - Math.exp(-7.5 * dt);
      const lg = liveGaitRef.current;
      const tg = targetGaitRef.current;
      let gaitChanged = false;
      for (const k in tg) {
        const key = k as keyof WalkingEngineGait;
        const diff = tg[key] - lg[key];
        if (Math.abs(diff) > 0.0005) {
          lg[key] = lg[key] + diff * gaitAlpha;
          gaitChanged = true;
        } else if (lg[key] !== tg[key]) {
          lg[key] = tg[key];
          gaitChanged = true;
        }
      }

      if (gaitChanged && shouldRender) {
        uiSyncCounterRef.current += 1;
        if (uiSyncCounterRef.current % 3 === 0) {
          setGait({ ...lg });
        }
      }

      // Paused state: smooth rest transition & live pivot / proportion / wing preview
      if (isPaused && !isRecording) {
        let pausedPose = livePoseRef.current;
        if (isTransitioningToRestRef.current) {
          const rawT = Math.min(
            1,
            (performance.now() - pauseTransitionStartRef.current) / PAUSE_TRANSITION_DURATION
          );
          const t = easeInOutQuint(rawT);
          const rest = getRestingPose(modelVersion);
          if (rawT < 1 && initialPoseOnPauseRef.current) {
            const nextPose = { ...rest };
            for (const key of POSE_KEYS) {
              nextPose[key] = lerp(initialPoseOnPauseRef.current[key], rest[key], t);
            }
            pausedPose = nextPose;
          } else {
            pausedPose = rest;
            isTransitioningToRestRef.current = false;
          }
          livePoseRef.current = pausedPose;
        }

        if (shouldRender) {
          if (modelVersion === 'core' && puppytGraphRef.current) {
            liveHandStateRef.current.L = computeProceduralGotzHandState(
              'L',
              handPreset,
              phaseRef.current,
              pausedPose.l_hand,
              lg,
              pivotOffsetsRef.current.l_fingers
            );
            liveHandStateRef.current.R = computeProceduralGotzHandState(
              'R',
              handPreset,
              phaseRef.current,
              pausedPose.r_hand,
              lg,
              pivotOffsetsRef.current.r_fingers
            );
            const isBackView = HEAD_TURN_SEQUENCE[headTurnStep].view === 'back';
            liveFootStateRef.current.L = {
              ...NEUTRAL_PIGGY_FOOT_STATE,
              footRotationDeg: pausedPose.l_foot + pivotOffsetsRef.current.l_foot,
              groundContact: isGroundedMode ? 1 : 0.25,
              toeCurl: pausedPose.l_toe + pivotOffsetsRef.current.l_toe,
              isBackView,
            };
            liveFootStateRef.current.R = {
              ...NEUTRAL_PIGGY_FOOT_STATE,
              footRotationDeg: pausedPose.r_foot + pivotOffsetsRef.current.r_foot,
              groundContact: isGroundedMode ? 1 : 0.25,
              toeCurl: pausedPose.r_toe + pivotOffsetsRef.current.r_toe,
              isBackView,
            };
            const contact = applyPoseToPuppytRig(
              puppytGraphRef.current,
              pausedPose,
              pivotOffsetsRef.current,
              props,
              isGroundedMode,
              {
                ribAnchor,
                wingPop: wingPopRef.current,
                constrainLimits,
                spineUnlocked,
                useAdvancedFeet,
                footImpactDropL: liveFootStateRef.current.L.impactDownWeight,
                footImpactDropR: liveFootStateRef.current.R.impactDownWeight,
                headFlipX: HEAD_TURN_SEQUENCE[headTurnStep].flipX,
                handStateL: liveHandStateRef.current.L,
                handStateR: liveHandStateRef.current.R,
                lumbarTwist: 0,
                lGroundOffsetY: 0,
                rGroundOffsetY: 0,
                isBackView,
              }
            );
            lastFootGapRef.current = Math.abs(contact.lFootX - contact.rFootX);
            setFootContacts({
              lPlanted: contact.lPlanted,
              rPlanted: contact.rPlanted,
              lFootX: contact.lFootX,
              rFootX: contact.rFootX,
              pelvisX: contact.pelvisX,
              lWeight: 0.5,
              rWeight: 0.5,
              lRoadOffsetY: 0,
              rRoadOffsetY: 0,
            });
          }
          setPose({ ...pausedPose });
        }
        return;
      }

      // Continuous phase integration + Road-Hitch Step Irregularity Tracker
      const dPhase = dt * Math.PI * lg.frequency;
      totalPhaseRef.current += dPhase;
      phaseRef.current = (phaseRef.current + dPhase) % (Math.PI * 2);
      const p = phaseRef.current;

      const ter = stepTerrainRef.current;
      const stepIdx = Math.floor(totalPhaseRef.current / Math.PI);
      if (stepIdx !== ter.lastStepIndex) {
        ter.lastStepIndex = stepIdx;
        const hitLeftLeg = stepIdx % 2 === 1;
        if (roadHitchesEnabled && !isGlideMode && Math.random() < 0.34) {
          // Random stone/bump (upward: negative Y) or dip/pothole (downward: positive Y)
          const bump = (Math.random() * 2 - 1) * 19;
          const pitch = (Math.random() * 2 - 1) * 7.5;
          if (hitLeftLeg) {
            ter.targetLBump = bump;
            ter.targetPitchL = pitch;
            ter.targetRBump *= 0.25;
            ter.targetPitchR *= 0.25;
          } else {
            ter.targetRBump = bump;
            ter.targetPitchR = pitch;
            ter.targetLBump *= 0.25;
            ter.targetPitchL *= 0.25;
          }
          ter.targetStumblePitch = -bump * 0.45 + pitch * 0.5;
          ter.targetArmFlare = (hitLeftLeg ? 1 : -1) * (Math.abs(bump) * 0.65 + 4);
          ter.strideMod = 0.9 + Math.random() * 0.22;
        } else {
          ter.targetLBump = 0;
          ter.targetRBump = 0;
          ter.targetPitchL = 0;
          ter.targetPitchR = 0;
          ter.targetStumblePitch = 0;
          ter.targetArmFlare = 0;
          ter.strideMod = 1;
        }
      }

      const terAlpha = 1 - Math.exp(-7.5 * dt);
      ter.curLBump = lerp(ter.curLBump, ter.targetLBump, terAlpha);
      ter.curRBump = lerp(ter.curRBump, ter.targetRBump, terAlpha);
      ter.curPitchL = lerp(ter.curPitchL, ter.targetPitchL, terAlpha);
      ter.curPitchR = lerp(ter.curPitchR, ter.targetPitchR, terAlpha);
      ter.curStumblePitch = lerp(ter.curStumblePitch, ter.targetStumblePitch, 1 - Math.exp(-6.2 * dt));
      ter.curArmFlare = lerp(ter.curArmFlare, ter.targetArmFlare, 1 - Math.exp(-6.8 * dt));
      ter.curStrideMod = lerp(ter.curStrideMod, ter.strideMod, 1 - Math.exp(-5.5 * dt));

      // Continuous Weight Distribution (0..1 per foot based on support phase & stride load)
      const rawSupportBias = 0.5 + 0.5 * Math.tanh(-Math.sin(p) * 3.1);
      const bumpWeightShift = Math.max(-0.14, Math.min(0.14, (ter.curRBump - ter.curLBump) * 0.004));
      const lWeight = Math.max(0.05, Math.min(0.95, rawSupportBias + bumpWeightShift));
      const rWeight = 1 - lWeight;

      const strideVal = Math.sin(p);
      const counterStride = Math.sin(p + Math.PI);
      const moodFactor = lg.mood;

      // Perspective S-curve bias & walk perspective mode factors
      const perspBias = perspective.enabled
        ? computePerspectiveSpineBend(
            smoothedBodySwayXRef.current,
            perspective.vpX,
            perspective.horizonY,
            -55,
            perspective.strength
          )
        : { lumbar: 0, thorax: 0 };

      const isBackView = HEAD_TURN_SEQUENCE[headTurnStep].view === 'back';
      const isBack3P = walkPerspective === 'back_3p' || isBackView;
      const isSideBalance = walkPerspective === 'side_balance' && !isBackView;
      // In 3rd-person Back View all bones mirror across midline so screen lateral signs reverse cleanly
      const backMirrorSign = isBackView ? -1 : 1;
      const isSkateMode = modelVersion === 'core' && activePresetIndex === 4;
      const isRubberHoseMode = modelVersion === 'core' && activePresetIndex === 5;
      const footGaitStyle: PiggyFootGaitStyle = isSkateMode
        ? 'skate'
        : isRubberHoseMode
          ? 'rubber_hose'
          : 'standard';

      let targetPose: WalkingEnginePose;
      let nextContacts = {
        lPlanted: false,
        rPlanted: false,
        lFootX: 52,
        rFootX: -52,
        pelvisX: 0,
        lWeight,
        rWeight,
        lRoadOffsetY: ter.curLBump,
        rRoadOffsetY: ter.curRBump,
      };

      const spr = limbSprings.current;
      const kneeOmega = isRubberHoseMode ? 11.5 + lg.frequency * 3.0 : 15 + lg.frequency * 4.5;
      const elbowOmega = isRubberHoseMode ? 10.5 + lg.frequency * 2.8 : 13.5 + lg.frequency * 4.0;
      const limbDamp = isRubberHoseMode ? 0.62 : 0.46;

      if (modelVersion === 'core') {
        // ============================================================
        // BITRUVIAN.HUMAN.PUPPYT C1-SMOOTH WALK ENGINE
        // + 2nd-Order Knee/Elbow Physics + Articulated Toes + Perspective Modes
        // ============================================================
        const lLift = smoothLift(p);
        const rLift = smoothLift(p + Math.PI);
        const cosP = Math.cos(p);
        const counterCosP = Math.cos(p + Math.PI);

        const moodTorso = (moodFactor - 0.5) * -14;
        const backLeanScale = isBack3P ? 0.55 : isSideBalance ? 1.25 : 1.0;

        // Procedural Weight-Distribution Lumbar Compensation (Trendelenburg / pelvic drop + bump catch)
        const weightDiff = lWeight - rWeight; // +1 when L supports, -1 when R supports
        const rubberHoseWave = isRubberHoseMode ? Math.sin(p * 2 - 0.35) * 4.2 : 0;
        const skateLeanCarve = isSkateMode ? -strideVal * 7.5 : 0;
        const lumbarCompTarget =
          (weightDiff * (4.5 + lg.hip_sway * 5.2) + (ter.curLBump - ter.curRBump) * 0.28 + rubberHoseWave) *
            backMirrorSign +
          skateLeanCarve * backMirrorSign +
          perspBias.lumbar;
        smoothedLumbarCompRef.current = lerp(smoothedLumbarCompRef.current, lumbarCompTarget, 1 - Math.exp(-10 * dt));
        const lumbarComp = smoothedLumbarCompRef.current;

        const torsoLeanTarget =
          lg.lean * 22 * backLeanScale +
          moodTorso +
          Math.sin(p * 2 - (isRubberHoseMode ? 0.55 : 0)) * (isRubberHoseMode ? 5.8 : 3.5) * lg.intensity +
          perspBias.thorax +
          ter.curStumblePitch * (spineUnlocked ? 1.0 : 0.45) -
          lumbarComp * 0.42;
        smoothedTorsoLeanRef.current = lerp(smoothedTorsoLeanRef.current, torsoLeanTarget, 1 - Math.exp(-10 * dt));
        const torsoLean = smoothedTorsoLeanRef.current;

        const twistScale = isBack3P ? 1.2 : isSideBalance ? 0.45 : isSkateMode ? 1.3 : 1.0;
        const waistTwistTarget =
          cosP * 9.5 * lg.waist_twist * twistScale * Math.max(0.4, lg.intensity * 0.85) * backMirrorSign;
        smoothedWaistTwistRef.current = lerp(smoothedWaistTwistRef.current, waistTwistTarget, 1 - Math.exp(-10 * dt));
        const waistTwist = smoothedWaistTwistRef.current;

        // Lateral sway (Skate Mode glides laterally side-to-side; Inkwell Clown sways playfully)
        const lateralSwayScale = isSideBalance ? 0.22 : isSkateMode ? 1.55 : isBack3P ? 0.92 : 1.0;
        const hipSwayMag = 18 * lg.hip_sway * lateralSwayScale * Math.max(0.35, lg.intensity * 0.85);
        const waistSwayTarget =
          -strideVal * 6.5 * lg.hip_sway * lateralSwayScale * Math.max(0.35, lg.intensity * 0.85) * backMirrorSign +
          perspBias.lumbar +
          lumbarComp * 0.35;
        smoothedWaistSwayRef.current = lerp(smoothedWaistSwayRef.current, waistSwayTarget, 1 - Math.exp(-10 * dt));
        const waistSway = smoothedWaistSwayRef.current;

        // Perspective convergence + Weight-Distribution COM shift over stance foot
        const perspConvergenceX =
          perspective.enabled && !isSideBalance
            ? Math.tanh(perspective.vpX / 600) * 14 * perspective.strength * (0.4 + 0.6 * Math.abs(cosP))
            : 0;

        // Ground-plane support balance shift in Side Balance / Skate glide / Standard walk
        const stanceBalanceX = isSideBalance
          ? -strideVal * (14 * lg.stride * ter.curStrideMod + 8)
          : isSkateMode
            ? -strideVal * (18 * lg.stride * 0.85) + weightDiff * 14
            : weightDiff * (6.5 + lg.hip_sway * 5.0);
        spr.sideBalanceOffsetX = lerp(spr.sideBalanceOffsetX, stanceBalanceX, 1 - Math.exp(-8 * dt));

        const bodySwayXTarget =
          (-strideVal * hipSwayMag + spr.sideBalanceOffsetX) * backMirrorSign + perspConvergenceX;
        smoothedBodySwayXRef.current = lerp(smoothedBodySwayXRef.current, bodySwayXTarget, 1 - Math.exp(-10 * dt));
        const bodySwayX = smoothedBodySwayXRef.current;

        let headBobble = 0;
        if (bobblehead) {
          const target = -(torsoLean + lumbarComp * 0.5) * 0.72 + (isRubberHoseMode ? Math.sin(p * 2) * 4.5 : 0);
          const force = (target - headSpring.current.pos) * 0.14;
          headSpring.current.vel += force;
          headSpring.current.vel *= 0.84;
          headSpring.current.pos += headSpring.current.vel;
          headBobble = headSpring.current.pos;
        }

        // Arms & coupled 2nd-order Elbow Whip + Asymmetrical Balance Flare on Road Hitches
        const armDriveScale = 0.55 + Math.min(1.6, lg.intensity) * 0.45;
        const backArmScale = isBack3P ? -0.88 : isSideBalance ? 1.15 : 1.0;
        const armSwingAmp =
          (7 + lg.stride * 17) * (0.48 + moodFactor * 0.52) * lg.arm_swing * armDriveScale * backArmScale;

        const lShoulder =
          -lLift * armSwingAmp * 0.72 +
          rLift * armSwingAmp * 0.52 -
          cosP * armSwingAmp * 0.4 +
          Math.max(0, ter.curArmFlare) * 1.1;
        const rShoulder =
          rLift * armSwingAmp * 0.72 -
          lLift * armSwingAmp * 0.52 +
          counterCosP * armSwingAmp * 0.4 -
          Math.max(0, -ter.curArmFlare) * 1.1;

        const lShRate = (lShoulder - spr.prevLShoulder) / dt;
        const rShRate = (rShoulder - spr.prevRShoulder) / dt;
        spr.prevLShoulder = lShoulder;
        spr.prevRShoulder = rShoulder;

        const elbowAmp = (12 + 22 * lg.elbow_bend) * lg.bends;
        const lElbowRaw =
          -12 * lg.elbow_bend - rLift * elbowAmp * 0.9 - Math.max(0, -cosP) * elbowAmp * 0.35;
        const rElbowRaw =
          12 * lg.elbow_bend + lLift * elbowAmp * 0.9 + Math.max(0, -counterCosP) * elbowAmp * 0.35;

        const lElbow = stepSecondOrderSpring(
          spr.lElbow,
          lElbowRaw,
          -lShRate * (isRubberHoseMode ? 1.85 : 2.4) * (0.5 + lg.arm_swing * 0.4),
          elbowOmega,
          limbDamp,
          dt
        );
        const rElbow = stepSecondOrderSpring(
          spr.rElbow,
          rElbowRaw,
          -rShRate * (isRubberHoseMode ? 1.85 : 2.4) * (0.5 + lg.arm_swing * 0.4),
          elbowOmega,
          limbDamp,
          dt
        );

        // Expressive wrist follow-through driven by actual springed elbow velocity
        const wristAmp = (18 + 24 * lg.intensity * 0.55) * lg.wrist_swing;
        const wristLag = isRubberHoseMode ? Math.PI * 0.42 : Math.PI * 0.32;
        const lHand =
          Math.sin(p + Math.PI + wristLag) * wristAmp +
          Math.sin(p * 2 + 0.4) * (isRubberHoseMode ? 13 : 9) * lg.wrist_swing * Math.min(1.6, lg.bends) -
          lElbow * (isRubberHoseMode ? 0.24 : 0.16) -
          spr.lElbow.vel * 0.045 * lg.wrist_swing;
        const rHand =
          Math.sin(p + wristLag) * wristAmp -
          Math.sin(p * 2 + 0.4) * (isRubberHoseMode ? 13 : 9) * lg.wrist_swing * Math.min(1.6, lg.bends) -
          rElbow * (isRubberHoseMode ? 0.24 : 0.16) -
          spr.rElbow.vel * 0.045 * lg.wrist_swing;

        let l_hip = 0,
          l_knee = 0,
          l_foot = 0,
          l_toe = 0,
          r_hip = 0,
          r_knee = 0,
          r_foot = 0,
          r_toe = 0,
          bobbing = 0;

        const strideScale = (isSideBalance ? 1.24 : isBack3P ? 0.92 : 1.0) * ter.curStrideMod;

        if (isGlideMode) {
          bobbing = -Math.abs(Math.sin(p)) * 22 * lg.bounce;
          const glideRange = 16 * lg.stride * strideScale;
          l_hip = -lLift * glideRange + rLift * 5;
          r_hip = rLift * glideRange - lLift * 5;
          l_knee = stepSecondOrderSpring(spr.lKnee, lLift * 28 * lg.bends, 0, kneeOmega, 0.56, dt);
          r_knee = stepSecondOrderSpring(spr.rKnee, -rLift * 28 * lg.bends, 0, kneeOmega, 0.56, dt);
          l_foot = -lLift * (14 + 10 * lg.foot_roll) + lg.foot_angle_on_ground * 0.85;
          r_foot = rLift * (14 + 10 * lg.foot_roll) - lg.foot_angle_on_ground * 0.85;
          l_toe = lLift * 14 * lg.toe_bend - lg.foot_angle_on_ground * 0.4;
          r_toe = -rLift * 14 * lg.toe_bend + lg.foot_angle_on_ground * 0.4;
        } else {
          const hipSwingAmp =
            (6 + lg.stride * 14) * strideScale * (0.6 + lg.intensity * 0.38) * (0.55 + moodFactor * 0.45);
          const backKneeBoost = isBack3P ? 1.28 : 1.0;
          const kneeLiftAmp =
            ((10 + lg.stride * 13 + lg.hover_height * 22) * lg.bends + lg.kick_up_force * 14) * backKneeBoost;
          const dragKnee = lg.ground_drag * 12;

          l_hip = -lLift * hipSwingAmp + rLift * (2.6 + lg.stride * 1.4) * strideScale;
          r_hip = rLift * hipSwingAmp - lLift * (2.6 + lg.stride * 1.4) * strideScale;

          const lHipRate = (l_hip - spr.prevLHip) / dt;
          const rHipRate = (r_hip - spr.prevRHip) / dt;
          spr.prevLHip = l_hip;
          spr.prevRHip = r_hip;

          // Stance loading-response shock absorption flex + terrain bump knee cushion
          const lBumpFlex = Math.max(0, -ter.curLBump) * 0.72 * lWeight;
          const rBumpFlex = Math.max(0, -ter.curRBump) * 0.72 * rWeight;
          const lLoadingFlex =
            Math.pow(Math.max(0, -Math.sin(p - 0.55)), 2) * (6.5 + lg.gravity * 8 + lg.bounce * 3) * (0.5 + lWeight);
          const rLoadingFlex =
            Math.pow(Math.max(0, -Math.sin(p + Math.PI - 0.55)), 2) * (6.5 + lg.gravity * 8 + lg.bounce * 3) * (0.5 + rWeight);

          const lKneeTarget =
            lLift * kneeLiftAmp + dragKnee * (1 - lLift * 0.6) + Math.sin(p) * 5 * lg.shin_tilt + lLoadingFlex + lBumpFlex + (isSkateMode ? 12 : 0);
          const rKneeTarget =
            -rLift * kneeLiftAmp - dragKnee * (1 - rLift * 0.6) - Math.sin(p) * 5 * lg.shin_tilt - rLoadingFlex - rBumpFlex - (isSkateMode ? 12 : 0);

          l_knee = stepSecondOrderSpring(
            spr.lKnee,
            lKneeTarget,
            -lHipRate * (isRubberHoseMode ? 1.6 : 2.1),
            kneeOmega,
            isRubberHoseMode ? 0.62 : 0.54,
            dt
          );
          r_knee = stepSecondOrderSpring(
            spr.rKnee,
            rKneeTarget,
            -rHipRate * (isRubberHoseMode ? 1.6 : 2.1),
            kneeOmega,
            isRubberHoseMode ? 0.62 : 0.54,
            dt
          );

          // Expressive ankle + Piggy Toe-Ball + Skate Edge / Inkwell Clown Slap solver
          const solvePuppytFootAndToe = (
            legPhase: number,
            lift: number,
            hipA: number,
            kneeA: number,
            sideSign: 1 | -1,
            pitchHitch: number,
            legWeight: number
          ): { foot: number; toe: number } => {
            const s = Math.sin(legPhase);
            const c = Math.cos(legPhase);
            const stanceW = isSkateMode ? smoothstep(-0.36, 0.22, -s) : smoothstep(-0.28, 0.28, -s);
            const swingW = 1 - stanceW;

            const heelStrikeW = Math.pow(Math.max(0, -c), 2) * smoothstep(-0.25, 0.35, -Math.sin(legPhase - 0.3));
            const loadingDropW =
              Math.pow(Math.max(0, -Math.sin(legPhase - 0.52)), 1.6) * stanceW * (0.5 + legWeight * 0.8);
            const pushOffW = Math.pow(Math.max(0, c), 2) * smoothstep(-0.25, 0.35, -Math.sin(legPhase + 0.3));

            const shankWorld = (hipA + kneeA) * sideSign;
            const flatLevelAngle = -shankWorld * (isSkateMode ? 0.96 : 0.72);
            const heelStrikeAngle = isSkateMode ? -4 * lg.foot_roll : -15 * lg.foot_roll;
            // Downward plantar plunge on impact (Inkwell Clown heavy slap vs smooth Skate carve)
            const impactDownwardPitch = loadingDropW * ((isSkateMode ? 2.5 : isRubberHoseMode ? 11.0 : 8.5) + lg.gravity * 6.0);
            const pushOffAngle = (isSkateMode ? 18 : 30 + (isBack3P ? 14 : 0)) * lg.foot_roll * lg.toe_bend;
            // Skate blade lateral carve edge roll across stance sweep
            const skateCarveTilt = isSkateMode ? Math.sin(legPhase) * 9.5 * stanceW : 0;

            const stanceFoot =
              flatLevelAngle * (1 - heelStrikeW * (isSkateMode ? 0.25 : 0.72)) +
              heelStrikeAngle * heelStrikeW +
              impactDownwardPitch +
              pushOffAngle * pushOffW +
              skateCarveTilt +
              pitchHitch * stanceW;

            // 3rd-person Back View emphasizes trailing heel/sole peel toward camera; Skate holds blade level above ice
            const swingHeelFlash = isBackView ? lift * (10 + 16 * lg.kick_up_force) : 0;
            const swingFoot = isSkateMode
              ? -shankWorld * 0.75 * lift - lift * 6
              : swingHeelFlash -
                lift * (14 + 22 * lg.toe_lift + 12 * lg.kick_up_force) * (isBackView ? 0.52 : 1.0) -
                shankWorld * 0.45 * lift;

            const tipToePitch = lg.foot_angle_on_ground * (isSkateMode ? 0.35 : 0.9);
            const foot = (stanceFoot * stanceW + swingFoot * swingW + tipToePitch) * sideSign;

            const pushOffToeBend = -pushOffW * (isSkateMode ? 12 : 32 + (isBack3P ? 8 : 0)) * lg.toe_bend;
            const tipToeComp = -Math.max(0, tipToePitch) * 0.58;
            const swingToeCurl = isSkateMode ? lift * 4 : lift * ((isRubberHoseMode ? 20 : 16) * lg.toe_lift + 7);
            const toe = (pushOffToeBend * stanceW + swingToeCurl * swingW + tipToeComp - pitchHitch * 0.35) * sideSign;

            return { foot, toe };
          };

          const lFt = solvePuppytFootAndToe(p, lLift, l_hip, l_knee, 1, ter.curPitchL, lWeight);
          const rFt = solvePuppytFootAndToe(p + Math.PI, rLift, r_hip, r_knee, -1, ter.curPitchR, rWeight);
          l_foot = lFt.foot;
          l_toe = lFt.toe;
          r_foot = rFt.foot;
          r_toe = rFt.toe;

          // Skate Mode glides smoothly with minimal vertical bobbing; Inkwell Cartoon bounces musically like a clown
          const doubleBounce =
            (0.5 - 0.5 * Math.cos(p * 2)) *
            (isSkateMode ? 8 : isRubberHoseMode ? 30 : 26) *
            lg.bounce *
            (1 - lg.gravity * 0.35);
          bobbing = -doubleBounce + (ter.curLBump * lWeight + ter.curRBump * rWeight) * 0.35;
        }

        smoothedBobbingRef.current = lerp(smoothedBobbingRef.current, bobbing, 1 - Math.exp(-12 * dt));

        targetPose = {
          waist: waistTwist + waistSway,
          stride_phase: strideVal,
          y_offset: smoothedBobbingRef.current,
          x_offset: bodySwayX,
          torso: torsoLean,
          collar: -torsoLean * 0.58 - waistSway * 0.45 - lumbarComp * 0.32,
          neck: -torsoLean * 0.36 - lumbarComp * 0.2 + lg.head_spin * 180 + headBobble,
          l_hip,
          l_knee,
          l_foot,
          l_toe,
          r_hip,
          r_knee,
          r_foot,
          r_toe,
          l_shoulder: lShoulder,
          l_elbow: lElbow,
          l_hand: lHand,
          r_shoulder: rShoulder,
          r_elbow: rElbow,
          r_hand: rHand,
        };
      } else {
        // ============================================================
        // LEGACY MANIKIN WALKING ENGINE (Bitruvius-Height Scaled + 2nd-Order Knees/Elbows + Road Hitches)
        // ============================================================
        const weightDiff = lWeight - rWeight;
        const moodTorso = (moodFactor - 0.5) * -40;
        const lumbarCompTarget =
          weightDiff * (6 + lg.hip_sway * 6) + (ter.curLBump - ter.curRBump) * 0.3 + perspBias.lumbar;
        smoothedLumbarCompRef.current = lerp(smoothedLumbarCompRef.current, lumbarCompTarget, 1 - Math.exp(-10 * dt));
        const lumbarComp = smoothedLumbarCompRef.current;

        const torsoLeanTarget =
          lg.lean * 35 + moodTorso + Math.sin(p) * 8 * lg.intensity + perspBias.thorax + ter.curStumblePitch;
        smoothedTorsoLeanRef.current = lerp(smoothedTorsoLeanRef.current, torsoLeanTarget, 1 - Math.exp(-10 * dt));
        const torsoLean = smoothedTorsoLeanRef.current;

        const waistTwistTarget = counterStride * 20 * lg.waist_twist * lg.intensity;
        smoothedWaistTwistRef.current = lerp(smoothedWaistTwistRef.current, waistTwistTarget, 1 - Math.exp(-10 * dt));
        const waistTwist = smoothedWaistTwistRef.current;

        const lateralScale = isSideBalance ? 0.25 : 1.0;
        const hipSwayMagnitude = 25 * lg.hip_sway * lg.intensity * lateralScale;
        const waistSwayTarget =
          Math.cos(p * 2) * hipSwayMagnitude * 0.5 + perspBias.lumbar + lumbarComp * 0.4;
        smoothedWaistSwayRef.current = lerp(smoothedWaistSwayRef.current, waistSwayTarget, 1 - Math.exp(-10 * dt));
        const waistSway = smoothedWaistSwayRef.current;

        const bodySwayXTarget = Math.cos(p) * hipSwayMagnitude + weightDiff * 6;
        smoothedBodySwayXRef.current = lerp(smoothedBodySwayXRef.current, bodySwayXTarget, 1 - Math.exp(-10 * dt));
        const bodySwayX = smoothedBodySwayXRef.current;

        let headBobble = 0;
        if (bobblehead) {
          const target = -(torsoLean + lumbarComp * 0.4) * 0.6;
          const force = (target - headSpring.current.pos) * 0.12;
          headSpring.current.vel += force;
          headSpring.current.vel *= 0.82;
          headSpring.current.pos += headSpring.current.vel;
          headBobble = headSpring.current.pos;
        }

        const armSwingMagnitude = (20 + lg.stride * 45) * (0.4 + moodFactor) * lg.arm_swing * (isBack3P ? -0.9 : 1.0);
        const lShoulder = counterStride * armSwingMagnitude + Math.max(0, ter.curArmFlare) * 1.1;
        const rShoulder = strideVal * armSwingMagnitude - Math.max(0, -ter.curArmFlare) * 1.1;
        const lShRate = (lShoulder - spr.prevLShoulder) / dt;
        const rShRate = (rShoulder - spr.prevRShoulder) / dt;
        spr.prevLShoulder = lShoulder;
        spr.prevRShoulder = rShoulder;

        const baseElbowBend = -30 * lg.elbow_bend;
        const dynamicElbowAmplitude = 60 * lg.arm_swing * lg.intensity * lg.bends;
        const elbowPhaseOffset = Math.PI * 0.05;
        const lElbowDrive = Math.cos(p + Math.PI + elbowPhaseOffset);
        const rElbowDrive = Math.cos(p + elbowPhaseOffset);
        const wristPhaseOffset = Math.PI * 0.15;
        const lWristDrive = Math.cos(p + Math.PI + wristPhaseOffset);
        const rWristDrive = Math.cos(p + wristPhaseOffset);

        const lElbow = stepSecondOrderSpring(
          spr.lElbow,
          baseElbowBend + lElbowDrive * dynamicElbowAmplitude,
          -lShRate * 1.4,
          elbowOmega,
          0.52,
          dt
        );
        const rElbow = stepSecondOrderSpring(
          spr.rElbow,
          baseElbowBend + rElbowDrive * dynamicElbowAmplitude,
          -rShRate * 1.4,
          elbowOmega,
          0.52,
          dt
        );

        let l_hip = 0,
          l_knee = 0,
          l_foot = 0,
          r_hip = 0,
          r_knee = 0,
          r_foot = 0,
          l_toe = 0,
          r_toe = 0,
          bobbing = 0;

        if (isGlideMode) {
          bobbing = lg.gravity * 15;
          const glideKneeBend = 45;
          const glideHipRange = 30 * lg.stride;
          const smoothAbsStride = Math.sqrt(strideVal * strideVal + 0.04) - 0.2;
          const smoothAbsCounter = Math.sqrt(counterStride * counterStride + 0.04) - 0.2;
          l_hip = strideVal * glideHipRange;
          r_hip = counterStride * glideHipRange;
          l_knee = stepSecondOrderSpring(spr.lKnee, glideKneeBend - smoothAbsStride * 20, 0, kneeOmega, 0.56, dt);
          r_knee = stepSecondOrderSpring(spr.rKnee, glideKneeBend - smoothAbsCounter * 20, 0, kneeOmega, 0.56, dt);
        } else {
          const calculateLegacySmoothLeg = (phase: number, g: WalkingEngineGait) => {
            const s = Math.sin(phase);
            const c = Math.cos(phase);
            const hipMult = (10 + g.stride * 35) * (0.8 + g.intensity * 0.4) * (0.5 + moodFactor);

            const stanceW = smoothstep(-0.26, 0.26, -s);
            const swingW = 1 - stanceW;

            const stanceArc = Math.pow(Math.max(0, -s), 1.25);
            const swingArc = Math.pow(Math.max(0, s), 1.35);
            const heelStrikeW = Math.pow(Math.max(0, -c), 2) * smoothstep(-0.25, 0.35, -Math.sin(phase - 0.3));
            const toeOffW = Math.pow(Math.max(0, c), 2) * smoothstep(-0.25, 0.35, -Math.sin(phase + 0.3));
            const kickArc = Math.pow(Math.max(0, Math.sin(phase + 0.35)), 2) * swingW;
            const loadingFlex = Math.pow(Math.max(0, -Math.sin(phase - 0.55)), 2) * (6 + g.gravity * 8);

            const slide = stanceArc * g.foot_slide * 38 * (1 + g.gravity * 0.5);
            const hip = s * hipMult + slide;

            const stanceKnee = 5 + g.ground_drag * 25 + g.gravity * 15 - slide * 0.45 + loadingFlex;
            const flatFoot = -(hip + stanceKnee);
            const heelLift = toeOffW * -52 * g.foot_roll;
            const stanceFoot = lerp(flatFoot, 15, heelStrikeW) + heelLift + g.foot_angle_on_ground;
            const stanceToe = lerp(0, 7.5, heelStrikeW) - heelLift * g.toe_bend - g.foot_angle_on_ground * 0.55;

            const swingKnee =
              (g.stride + g.intensity) * 30 * swingArc +
              g.hover_height * 45 * swingArc +
              kickArc * g.kick_up_force * 40;
            const swingFoot = swingArc * 25 * g.gravity;
            const swingToe = swingFoot * 0.5;

            const shinTilt = Math.cos(phase + Math.PI / 4) * 25 * g.shin_tilt * (0.5 + g.intensity);
            const knee = stanceKnee * stanceW + swingKnee * swingW + shinTilt;
            const foot = stanceFoot * stanceW + swingFoot * swingW;
            const toe = stanceToe * stanceW + swingToe * swingW;

            return { hip, knee, foot, toe };
          };

          const lLeg = calculateLegacySmoothLeg(p, lg);
          const rLeg = calculateLegacySmoothLeg(p + Math.PI, lg);
          l_hip = lLeg.hip;
          r_hip = rLeg.hip;

          const lHipRate = (l_hip - spr.prevLHip) / dt;
          const rHipRate = (r_hip - spr.prevRHip) / dt;
          spr.prevLHip = l_hip;
          spr.prevRHip = r_hip;

          l_knee = stepSecondOrderSpring(spr.lKnee, lLeg.knee, -lHipRate * 1.6, kneeOmega, 0.56, dt);
          r_knee = stepSecondOrderSpring(spr.rKnee, rLeg.knee, -rHipRate * 1.6, kneeOmega, 0.56, dt);

          l_foot = lLeg.foot;
          l_toe = lLeg.toe;
          r_foot = rLeg.foot;
          r_toe = rLeg.toe;

          const lLegHeight = calculateLegacyLegVerticalHeight({ hip: l_hip, knee: l_knee, foot: l_foot, toe: l_toe }, props, H, false);
          const rLegHeight = calculateLegacyLegVerticalHeight({ hip: r_hip, knee: r_knee, foot: r_foot, toe: r_toe }, props, H, true);
          const smoothLowestY = 0.5 * (lLegHeight + rLegHeight + Math.hypot(lLegHeight - rLegHeight, 22));
          const floorY = MANNEQUIN_LOCAL_FLOOR_Y * H;

          const doubleBounce = (0.5 - 0.5 * Math.cos(p * 2)) * (6 * lg.bounce * (1 - lg.gravity * 0.65));
          const freeBobbing = doubleBounce + lg.gravity * 5 + (1 - moodFactor) * 5 + lg.ground_drag * 8;
          const floorPush = floorY - smoothLowestY;
          const groundBlend = smoothstep(-26, 6, smoothLowestY - (floorY - 6));
          bobbing = lerp(freeBobbing, Math.min(freeBobbing, floorPush), groundBlend);
        }

        smoothedBobbingRef.current = lerp(smoothedBobbingRef.current, bobbing, 1 - Math.exp(-12 * dt));

        targetPose = {
          waist: waistTwist + waistSway,
          stride_phase: strideVal,
          y_offset: smoothedBobbingRef.current,
          x_offset: bodySwayX,
          torso: torsoLean,
          collar: -torsoLean * 0.7 + moodFactor * 15 - waistSway * 0.6,
          neck: -torsoLean * 0.2 - moodFactor * 20 + lg.head_spin * 180 + headBobble,
          l_hip,
          l_knee,
          l_foot,
          l_toe,
          r_hip,
          r_knee,
          r_foot,
          r_toe,
          l_shoulder: lShoulder,
          l_elbow: lElbow,
          l_hand: lWristDrive * 50 * lg.wrist_swing - spr.lElbow.vel * 0.04,
          r_shoulder: rShoulder,
          r_elbow: rElbow,
          r_hand: rWristDrive * 50 * lg.wrist_swing - spr.rElbow.vel * 0.04,
        };
      }

      // Smooth Resume / Mode-Toggle Crossfade
      let finalPose: WalkingEnginePose;
      if (resumeBlendRef.current < 1 && resumeStartPoseRef.current) {
        resumeBlendRef.current = Math.min(1, resumeBlendRef.current + dt / RESUME_BLEND_DURATION);
        const w = easeInOutQuint(resumeBlendRef.current);
        finalPose = { ...targetPose };
        for (const key of POSE_KEYS) {
          finalPose[key] = lerp(resumeStartPoseRef.current[key], targetPose[key], w);
        }
      } else {
        const poseAlpha = 1 - Math.exp(-28 * dt);
        finalPose = { ...targetPose };
        for (const key of POSE_KEYS) {
          finalPose[key] = lerp(livePoseRef.current[key], targetPose[key], poseAlpha);
        }
      }

      livePoseRef.current = finalPose;

      if (shouldRender) {
        if (modelVersion === 'core' && puppytGraphRef.current) {
          liveHandStateRef.current.L = computeProceduralGotzHandState(
            'L',
            handPreset,
            p,
            finalPose.l_hand,
            lg,
            pivotOffsetsRef.current.l_fingers
          );
          liveHandStateRef.current.R = computeProceduralGotzHandState(
            'R',
            handPreset,
            p,
            finalPose.r_hand,
            lg,
            pivotOffsetsRef.current.r_fingers
          );

          liveFootStateRef.current.L = computeProceduralPiggyFootState(
            p,
            finalPose.l_foot + pivotOffsetsRef.current.l_foot,
            finalPose.l_toe + pivotOffsetsRef.current.l_toe,
            lg,
            lWeight,
            ter.curLBump,
            lastFootGapRef.current,
            isBackView,
            footGaitStyle
          );
          liveFootStateRef.current.R = computeProceduralPiggyFootState(
            p + Math.PI,
            finalPose.r_foot + pivotOffsetsRef.current.r_foot,
            finalPose.r_toe + pivotOffsetsRef.current.r_toe,
            lg,
            rWeight,
            ter.curRBump,
            lastFootGapRef.current,
            isBackView,
            footGaitStyle
          );

          const contact = applyPoseToPuppytRig(
            puppytGraphRef.current,
            finalPose,
            pivotOffsetsRef.current,
            props,
            isGroundedMode,
            {
              ribAnchor,
              wingPop: wingPopRef.current,
              constrainLimits,
              spineUnlocked,
              useAdvancedFeet,
              footImpactDropL: liveFootStateRef.current.L.impactDownWeight,
              footImpactDropR: liveFootStateRef.current.R.impactDownWeight,
              headFlipX: HEAD_TURN_SEQUENCE[headTurnStep].flipX,
              handStateL: liveHandStateRef.current.L,
              handStateR: liveHandStateRef.current.R,
              lumbarTwist: smoothedLumbarCompRef.current,
              lGroundOffsetY: ter.curLBump,
              rGroundOffsetY: ter.curRBump,
              isBackView,
            }
          );
          lastFootGapRef.current = Math.abs(contact.lFootX - contact.rFootX);
          nextContacts = {
            lPlanted: contact.lPlanted,
            rPlanted: contact.rPlanted,
            lFootX: contact.lFootX,
            rFootX: contact.rFootX,
            pelvisX: contact.pelvisX,
            lWeight,
            rWeight,
            lRoadOffsetY: ter.curLBump,
            rRoadOffsetY: ter.curRBump,
          };
        }
        setFootContacts(nextContacts);
        setPose(finalPose);
      }
    };

    prevTickTimeRef.current = performance.now();
    lastRenderTimeRef.current = prevTickTimeRef.current;
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [
    modelVersion,
    props,
    bobblehead,
    isGroundedMode,
    isGlideMode,
    isPaused,
    isRecording,
    targetFps,
    recordFrameCount,
    getRestingPose,
    prometheusWings,
    ribAnchor,
    constrainLimits,
    spineUnlocked,
    roadHitchesEnabled,
    useAdvancedFeet,
    headTurnStep,
    handPreset,
    walkPerspective,
    activePresetIndex,
    perspective,
  ]);

  const drawSvgToCanvas = useCallback(() => {
    const svg = svgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!svg || !canvas || !ctx) return;

    const bgHex = STAGE_PALETTES[theme].canvasBg;
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);

    img.onload = () => {
      ctx.fillStyle = bgHex;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.onerror = (e) => {
      console.error('Error loading SVG for canvas drawing:', e);
    };
    img.src = svgUrl;
  }, [theme]);

  useEffect(() => {
    if (isRecording) {
      drawSvgToCanvas();
    }
  }, [pose, isRecording, drawSvgToCanvas]);

  const handleGaitChange = useCallback((key: keyof WalkingEngineGait, value: string) => {
    const numericValue = parseFloat(value);
    const newGait = { ...liveGaitRef.current, [key]: numericValue };
    liveGaitRef.current = newGait;
    targetGaitRef.current = newGait;
    setGait(newGait);
    setActivePresetIndex(-1);
  }, []);

  // Wide-ranged procedural randomizer spanning tip-toe creep, heavy trudge, sprint, and cartoon extremes
  const handleRandomizeGait = useCallback(() => {
    const archetype = Math.random();
    const isTipToe = archetype < 0.18;
    const isHeavy = archetype >= 0.18 && archetype < 0.36;
    const isSprint = archetype >= 0.36 && archetype < 0.65;
    const isExtremeCartoon = archetype >= 0.65;

    const r = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

    const randomGait: WalkingEngineGait = isTipToe
      ? {
          intensity: r(0.2, 0.75),
          stride: r(0.14, 0.55),
          lean: r(-0.35, 0.15),
          frequency: r(0.45, 2.2),
          gravity: r(0.05, 0.35),
          bounce: r(0.05, 0.45),
          bends: r(0.25, 0.85),
          head_spin: 0.0,
          mood: r(0.55, 1.0),
          ground_drag: r(0.0, 0.15),
          foot_angle_on_ground: r(18, 44),
          arm_swing: r(0.15, 0.8),
          elbow_bend: r(0.55, 1.05),
          wrist_swing: r(0.4, 1.4),
          foot_roll: r(0.25, 0.85),
          toe_lift: r(0.1, 0.65),
          shin_tilt: r(-0.35, 0.2),
          foot_slide: 0.0,
          kick_up_force: r(0.02, 0.3),
          hover_height: r(0.05, 0.25),
          waist_twist: r(0.1, 0.6),
          hip_sway: r(0.1, 0.6),
          toe_bend: r(0.9, 2.2),
        }
      : isHeavy
        ? {
            intensity: r(0.35, 1.15),
            stride: r(0.22, 0.75),
            lean: r(0.25, 0.95),
            frequency: r(0.28, 0.95),
            gravity: r(0.75, 1.35),
            bounce: r(0.02, 0.32),
            bends: r(0.35, 1.0),
            head_spin: 0.0,
            mood: r(0.0, 0.35),
            ground_drag: r(0.45, 1.15),
            foot_angle_on_ground: r(-18, 6),
            arm_swing: r(0.15, 0.75),
            elbow_bend: r(0.2, 0.75),
            wrist_swing: r(0.1, 0.5),
            foot_roll: r(0.2, 0.65),
            toe_lift: r(0.05, 0.45),
            shin_tilt: r(-0.45, 0.15),
            foot_slide: r(0.15, 0.65),
            kick_up_force: r(0.0, 0.25),
            hover_height: r(0.0, 0.15),
            waist_twist: r(0.1, 0.65),
            hip_sway: r(0.3, 1.1),
            toe_bend: r(0.25, 0.85),
          }
        : isSprint
          ? {
              intensity: r(1.1, 2.3),
              stride: r(0.95, 2.25),
              lean: r(0.15, 0.85),
              frequency: r(2.1, 5.2),
              gravity: r(0.15, 0.55),
              bounce: r(0.85, 2.4),
              bends: r(1.0, 2.2),
              head_spin: 0.0,
              mood: r(0.65, 1.0),
              ground_drag: r(0.0, 0.18),
              foot_angle_on_ground: r(-5, 22),
              arm_swing: r(1.0, 2.4),
              elbow_bend: r(0.75, 1.35),
              wrist_swing: r(0.9, 2.3),
              foot_roll: r(0.8, 1.75),
              toe_lift: r(0.65, 1.55),
              shin_tilt: r(-0.15, 0.65),
              foot_slide: r(0.0, 0.12),
              kick_up_force: r(0.65, 1.7),
              hover_height: r(0.25, 0.95),
              waist_twist: r(0.55, 1.9),
              hip_sway: r(0.25, 1.15),
              toe_bend: r(0.85, 2.1),
            }
          : {
              // Inkwell Rubber-Hose / Skate Carve (buoyant Fleischer-style extremes without harsh snapping)
              intensity: r(1.15, 1.85),
              stride: r(0.95, 1.72),
              lean: r(-0.35, 0.65),
              frequency: r(1.05, 2.35),
              gravity: r(0.14, 0.42),
              bounce: r(0.55, 1.75),
              bends: r(0.95, 1.85),
              head_spin: 0.0,
              mood: r(0.65, 1.05),
              ground_drag: r(0.0, 0.25),
              foot_angle_on_ground: r(-12, 18),
              arm_swing: r(1.05, 1.85),
              elbow_bend: r(0.5, 1.15),
              wrist_swing: r(0.95, 1.95),
              foot_roll: r(0.65, 1.45),
              toe_lift: r(0.45, 1.35),
              shin_tilt: r(-0.25, 0.45),
              foot_slide: r(0.02, 0.65),
              kick_up_force: r(0.35, 1.25),
              hover_height: r(0.22, 0.72),
              waist_twist: r(0.75, 1.55),
              hip_sway: r(0.65, 1.55),
              toe_bend: r(0.65, 1.65),
            };

    if (isExtremeCartoon && Math.random() > 0.78) {
      randomGait.lean = -randomGait.lean * 0.5;
    }

    if (isPaused) {
      isTransitioningToRestRef.current = false;
      resumeStartPoseRef.current = { ...livePoseRef.current };
      resumeBlendRef.current = 0;
      setIsPaused(false);
    }

    targetGaitRef.current = randomGait;
    setGait(randomGait);
    setActivePresetIndex(-1);
  }, [isPaused]);

  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => {
      if (!prev) {
        initialPoseOnPauseRef.current = { ...livePoseRef.current };
        pauseTransitionStartRef.current = performance.now();
        isTransitioningToRestRef.current = true;
      } else {
        isTransitioningToRestRef.current = false;
        resumeStartPoseRef.current = { ...livePoseRef.current };
        resumeBlendRef.current = 0;
      }
      return !prev;
    });
  }, []);

  const handleToggleGlide = useCallback(() => {
    resumeStartPoseRef.current = { ...livePoseRef.current };
    resumeBlendRef.current = 0;
    setIsGlideMode((v) => !v);
  }, []);

  const handleToggleGrounded = useCallback(() => {
    resumeStartPoseRef.current = { ...livePoseRef.current };
    resumeBlendRef.current = 0;
    setIsGroundedMode((v) => !v);
  }, []);

  // Drag handler for anchor joints
  const handleGlobalBoneMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!draggingBoneKey) return;
      const deltaX = event.clientX - dragStartXRef.current;
      const newRotation = Math.round(dragStartPivotOffsetRef.current + deltaX * 0.35);
      setPivotOffsets((prev) => ({ ...prev, [draggingBoneKey]: newRotation }));
    },
    [draggingBoneKey]
  );

  const handleGlobalBoneMouseUp = useCallback(() => {
    setDraggingBoneKey(null);
  }, []);

  useEffect(() => {
    if (!draggingBoneKey) return;
    window.addEventListener('mousemove', handleGlobalBoneMouseMove);
    window.addEventListener('mouseup', handleGlobalBoneMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalBoneMouseMove);
      window.removeEventListener('mouseup', handleGlobalBoneMouseUp);
    };
  }, [draggingBoneKey, handleGlobalBoneMouseMove, handleGlobalBoneMouseUp]);

  // Drag handler for 1-point Perspective Vanishing Point & Horizon on SVG canvas
  const handlePerspMouseDown = useCallback((target: 'vp' | 'horizon', e: React.MouseEvent) => {
    e.preventDefault();
    setDraggingPersp(target);
  }, []);

  useEffect(() => {
    if (!draggingPersp) return;
    const onMove = (ev: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      // Map client pointer to SVG viewBox (-500 -1500 1000 2000) preserving aspectRatio meet
      const scale = Math.min(rect.width / 1000, rect.height / 2000);
      const renderedW = 1000 * scale;
      const renderedH = 2000 * scale;
      const offX = rect.left + (rect.width - renderedW) * 0.5;
      const offY = rect.top + (rect.height - renderedH) * 0.5;
      const svgX = -500 + (ev.clientX - offX) / scale;
      const svgY = -1500 + (ev.clientY - offY) / scale;

      setPerspective((prev) => ({
        ...prev,
        vpX: draggingPersp === 'vp' ? Math.max(-700, Math.min(700, Math.round(svgX))) : prev.vpX,
        horizonY: Math.max(-1350, Math.min(420, Math.round(svgY))),
      }));
    };
    const onUp = () => setDraggingPersp(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingPersp]);

  const onAnchorMouseDown = useCallback(
    (boneKey: keyof WalkingEnginePivotOffsets, clientX: number) => {
      if (!isPaused || !showPivots) return;
      setDraggingBoneKey(boneKey);
      dragStartXRef.current = clientX;
      dragStartPivotOffsetRef.current = pivotOffsets[boneKey];
    },
    [isPaused, showPivots, pivotOffsets]
  );

  const updateProp = useCallback(
    (piece: keyof WalkingEngineProportions, axis: 'w' | 'h', val: string) =>
      setProps((prev) => ({ ...prev, [piece]: { ...prev[piece], [axis]: parseFloat(val) } })),
    []
  );

  const handleResetProps = useCallback(() => {
    setProps({ ...DEFAULT_PROPORTIONS });
  }, []);

  const updatePivotOffset = useCallback(
    (key: keyof WalkingEnginePivotOffsets, val: string) =>
      setPivotOffsets((prev) => ({ ...prev, [key]: parseInt(val, 10) })),
    []
  );

  const handleResetPivots = useCallback(() => {
    setPivotOffsets(
      modelVersion === 'core' ? { ...CORE_DEFAULT_PIVOT_OFFSETS } : { ...LEGACY_DEFAULT_PIVOT_OFFSETS }
    );
  }, [modelVersion]);

  const handleStartRecording = useCallback(async () => {
    if (isRecording) return;
    setRecordingError(null);
    const canvas = canvasRef.current;
    if (!canvas) {
      setRecordingError('Canvas element unavailable.');
      return;
    }
    try {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        canvas.width = Math.max(640, Math.round(rect.width));
        canvas.height = Math.max(640, Math.round(rect.height));
      } else {
        canvas.width = 1280;
        canvas.height = 720;
      }

      drawSvgToCanvas();
      const stream = canvas.captureStream(targetFps);
      if (isPaused) {
        resumeStartPoseRef.current = { ...livePoseRef.current };
        resumeBlendRef.current = 0;
        setIsPaused(false);
      }

      const mimeTypes = ['video/mp4; codecs=avc1', 'video/webm; codecs=vp9', 'video/webm'];
      const supportedMimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type));

      if (!supportedMimeType) {
        setRecordingError('Video recording is not supported in this browser.');
        return;
      }

      const fileExtension = supportedMimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
      const fileName =
        modelVersion === 'core'
          ? `bitruvian-human-puppyt-loop.${fileExtension}`
          : `bitruvian-legacy-loop.${fileExtension}`;

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: supportedMimeType,
        videoBitsPerSecond: 8000000,
      });
      recordedChunksRef.current = [];
      framesRecordedRef.current = 0;
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: supportedMimeType });
        saveAs(blob, fileName);
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Canvas recording failed:', err);
      setRecordingError('Recording failed to initialize.');
      setIsRecording(false);
    }
  }, [isRecording, isPaused, targetFps, drawSvgToCanvas, modelVersion]);

  const handleSavePose = useCallback(() => {
    const modelName = modelVersion === 'core' ? 'bitruvian.human.puppyt' : 'legacy.manikin';
    const poseData = {
      model: modelName,
      theme,
      headTurn: currentHeadSpec.label,
      walkPerspective,
      perspective,
      rigSystems: {
        prometheusWings,
        ribAnchor,
        rigVisualMode,
        constrainLimits,
        useAdvancedHands,
        handPreset,
        useAdvancedFeet,
      },
      proportions: props,
      pivotOffsets,
      gait,
    };
    const blob = new Blob([JSON.stringify(poseData, null, 2)], { type: 'application/json' });
    saveAs(
      blob,
      modelVersion === 'core' ? 'bitruvian-human-puppyt-pose.json' : 'bitruvian-legacy-pose.json'
    );
  }, [
    modelVersion,
    theme,
    currentHeadSpec.label,
    walkPerspective,
    perspective,
    prometheusWings,
    ribAnchor,
    rigVisualMode,
    constrainLimits,
    useAdvancedHands,
    handPreset,
    useAdvancedFeet,
    props,
    pivotOffsets,
    gait,
  ]);

  const formatKeyLabel = (key: string) => {
    if (key.startsWith('l_'))
      return `L. ${key
        .slice(2)
        .replace(/_/g, ' ')
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')}`;
    if (key.startsWith('r_'))
      return `R. ${key
        .slice(2)
        .replace(/_/g, ' ')
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')}`;
    return key
      .replace(/_/g, ' ')
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const palette = STAGE_PALETTES[theme];
  const activePresets = modelVersion === 'core' ? coreGaitPresets : legacyGaitPresets;
  const activePresetLabels = modelVersion === 'core' ? corePresetNames : legacyPresetNames;
  const activeAnchorKey = draggingBoneKey || hoveredBoneKey;
  const isLightCore = theme === 'light' && modelVersion === 'core';
  const isXRay = rigVisualMode === 'digital';

  return (
    <div className="flex h-full w-full bg-paper font-mono text-ink overflow-hidden select-none transition-colors duration-200">
      {/* Left Sidebar Control Menu */}
      <div className="w-80 shrink-0 border-r border-ridge bg-mono-darker p-4 flex flex-col gap-4 custom-scrollbar overflow-y-auto">
        <div className="flex items-baseline justify-between border-b border-ridge pb-2">
          <h1 className="text-xl font-archaic tracking-widest text-ink uppercase italic">
            Bitruvius.Physics
          </h1>
          <span
            className={`text-[9px] font-bold tracking-wider ${
              isLightCore ? 'text-accent-green' : 'text-mono-light'
            }`}
          >
            {modelVersion === 'core' ? 'human.puppyt' : 'legacy'}
          </span>
        </div>

        {/* Model, Theme & 4-Step 360° Skull Turntable */}
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-1 p-1 bg-mono-dark border border-ridge rounded">
            <button
              onClick={() => handleModelSwitch('core')}
              className={`text-[8.5px] py-1.5 px-1.5 rounded font-bold tracking-tight transition-colors whitespace-nowrap truncate ${
                modelVersion === 'core'
                  ? 'bg-selection text-white dark:text-paper shadow-sm'
                  : 'text-mono-mid hover:text-ink'
              }`}
              title="bitruvian.human.puppyt"
            >
              bitruvian.human.puppyt
            </button>
            <button
              onClick={() => handleModelSwitch('legacy')}
              className={`text-[8.5px] py-1.5 px-1.5 rounded font-bold tracking-tight transition-colors whitespace-nowrap truncate ${
                modelVersion === 'legacy'
                  ? 'bg-selection text-white dark:text-paper shadow-sm'
                  : 'text-mono-mid hover:text-ink'
              }`}
              title="Legacy Manikin"
            >
              legacy.manikin
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1 p-1 bg-mono-dark border border-ridge rounded">
            <button
              onClick={() => setTheme('light')}
              className={`text-[9px] py-1 px-2 rounded font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                theme === 'light'
                  ? 'bg-accent-green text-white shadow-sm'
                  : 'text-mono-mid hover:text-ink'
              }`}
            >
              Light Mode
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`text-[9px] py-1 px-2 rounded font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                theme === 'dark'
                  ? 'bg-selection text-paper shadow-sm'
                  : 'text-mono-mid hover:text-ink'
              }`}
            >
              Dark Mode
            </button>
          </div>

          {modelVersion === 'core' && (
            <div className="grid grid-cols-4 gap-1 p-1 bg-mono-dark border border-ridge rounded">
              {HEAD_TURN_SEQUENCE.map((spec) => (
                <button
                  key={spec.step}
                  onClick={() => setHeadTurnStep(spec.step)}
                  className={`text-[8px] py-1 px-1 rounded font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                    headTurnStep === spec.step
                      ? 'bg-selection-super-light text-selection border border-selection/30'
                      : 'text-mono-mid hover:text-ink'
                  }`}
                >
                  {spec.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Playback, Anchors, Labels & Dark-Green Pure Vector X-Ray Toggle */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleTogglePause}
            className={`text-[9px] px-3 py-1.5 border rounded transition-all font-bold uppercase tracking-wider ${
              isPaused
                ? 'bg-accent-red text-white border-accent-red shadow-sm'
                : 'bg-mono-dark text-accent-red border-accent-red/40 hover:bg-accent-red/10 hover:border-accent-red'
            }`}
          >
            {isPaused ? 'Resume Loop' : 'Pause Loop'}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowPivots(!showPivots)}
              className={`text-[9px] px-2.5 py-1.5 border rounded transition-all font-bold uppercase tracking-wider whitespace-nowrap ${
                showPivots
                  ? 'bg-selection-super-light text-selection border-selection/40'
                  : 'bg-mono-dark text-mono-mid border-ridge hover:text-ink'
              }`}
            >
              {showPivots ? 'Hide Anchors' : 'Show Anchors'}
            </button>
            <button
              onClick={() => setShowLabels(!showLabels)}
              className={`text-[9px] px-2.5 py-1.5 border rounded transition-all font-bold uppercase tracking-wider whitespace-nowrap ${
                showLabels
                  ? 'bg-accent-green/15 text-accent-green border-accent-green/40'
                  : 'bg-mono-dark text-mono-mid border-ridge hover:text-ink'
              }`}
            >
              {showLabels ? 'Hide Labels' : 'Show Labels'}
            </button>
          </div>

          {modelVersion === 'core' && (
            <button
              onClick={() => setRigVisualMode((m) => (m === 'digital' ? 'analog' : 'digital'))}
              className={`text-[9px] px-3 py-1.5 border rounded transition-all font-bold uppercase tracking-wider ${
                isXRay
                  ? 'bg-[#14532D] text-white border-[#14532D] shadow-sm'
                  : 'bg-mono-dark text-[#14532D] dark:text-[#22c55e] border-[#14532D]/40 dark:border-[#22c55e]/40 hover:bg-[#14532D]/10'
              }`}
            >
              {isXRay ? 'X-Ray Vectors: On (Dark Green)' : 'X-Ray Vectors: Off'}
            </button>
          )}
        </div>

        {/* Procedural Walking Engine + Cycle Spawner */}
        <CollapsibleSection title="Procedural Walking Engine" defaultOpen={true}>
          <div className="flex flex-col gap-2 mb-4 border-b border-ridge pb-3">
            <h2 className="text-[10px] text-selection font-bold tracking-[0.2em] uppercase">
              Motion Style
            </h2>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setBobblehead(!bobblehead)}
                className={`text-[8px] px-2 py-1 border rounded transition-colors font-bold uppercase ${
                  bobblehead
                    ? 'bg-accent-green text-white border-accent-green'
                    : 'border-ridge text-mono-mid hover:text-ink'
                }`}
              >
                Bobble: {bobblehead ? 'On' : 'Off'}
              </button>
              <button
                onClick={handleToggleGrounded}
                className={`text-[8px] px-2 py-1 border rounded transition-colors font-bold uppercase ${
                  isGroundedMode
                    ? 'bg-accent-green text-white border-accent-green'
                    : 'border-ridge text-mono-mid hover:text-ink'
                }`}
              >
                Grounded: {isGroundedMode ? 'On' : 'Off'}
              </button>
              <button
                onClick={handleToggleGlide}
                className={`text-[8px] px-2 py-1 border rounded transition-colors font-bold uppercase ${
                  isGlideMode
                    ? 'bg-accent-green text-white border-accent-green'
                    : 'border-ridge text-mono-mid hover:text-ink'
                }`}
              >
                Glide: {isGlideMode ? 'On' : 'Off'}
              </button>
              <button
                onClick={() => setRoadHitchesEnabled((v) => !v)}
                className={`text-[8px] px-2 py-1 border rounded transition-colors font-bold uppercase ${
                  roadHitchesEnabled
                    ? 'bg-selection-super-light text-selection border-selection/40'
                    : 'border-ridge text-mono-mid hover:text-ink'
                }`}
                title="Occasional step terrain bumps & compensatory weight distribution"
              >
                Road Hitches: {roadHitchesEnabled ? 'On' : 'Off'}
              </button>
              <button
                onClick={() => setSpineUnlocked((v) => !v)}
                className={`text-[8px] px-2 py-1 border rounded transition-colors font-bold uppercase ${
                  spineUnlocked
                    ? 'bg-selection-super-light text-selection border-selection/40'
                    : 'border-ridge text-mono-mid hover:text-ink'
                }`}
                title="Unlock 360° upper & lower spine rotation for compensatory balance"
              >
                Spine 360°: {spineUnlocked ? 'Open' : 'Soft'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {activePresets.map((_, index) => {
              const isOddLast = activePresets.length % 2 === 1 && index === activePresets.length - 1;
              return (
                <button
                  key={activePresetLabels[index]}
                  onClick={() => spawnPresetCycle(index)}
                  title="Click to spawn a fresh variation cycle in this range"
                  className={`${isOddLast ? 'col-span-2 ' : ''}text-[8.5px] px-2.5 py-1.5 border rounded transition-all font-bold uppercase tracking-wider ${
                    activePresetIndex === index
                      ? 'bg-selection text-white dark:text-paper border-selection'
                      : 'border-ridge text-mono-mid hover:border-selection/50 hover:text-ink'
                  }`}
                >
                  {activePresetLabels[index]}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleRandomizeGait}
            className={`w-full text-[9px] px-3 py-1.5 border rounded transition-all font-bold uppercase tracking-wider mb-4 ${
              activePresetIndex === -1
                ? 'bg-accent-red text-white border-accent-red'
                : 'border-accent-red/40 text-accent-red hover:bg-accent-red/10 hover:border-accent-red'
            }`}
          >
            Randomize Gait (Wide Range)
          </button>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[8px] uppercase font-bold text-mono-light">
              <span>Target FPS</span>
              <span className="text-selection tabular-nums">{targetFps}</span>
            </div>
            <input
              type="range"
              min="1"
              max="60"
              step="1"
              value={targetFps}
              onChange={(e) => setTargetFps(parseInt(e.target.value, 10))}
              className="w-full accent-selection bg-ridge h-1.5 appearance-none cursor-pointer rounded-full"
            />
          </div>

          <div className="mt-4 pt-3 border-t border-ridge flex flex-col gap-1.5 font-mono text-left">
            <div className="text-[9px] text-accent-green font-bold tracking-wider">
              {modelVersion === 'core' ? 'bitruvian.human.puppyt' : 'legacy.manikin'}
            </div>
            <div className="text-[9px] flex text-mono-mid uppercase w-full justify-between tabular-nums">
              <span>Frequency</span>
              <span className="text-ink font-bold">{gait.frequency.toFixed(2)} Hz</span>
            </div>
            <div className="text-[9px] flex text-mono-mid uppercase w-full justify-between tabular-nums">
              <span>Mood / Drag</span>
              <span className="text-ink font-bold">
                {gait.mood.toFixed(2)} / {gait.ground_drag.toFixed(2)}
              </span>
            </div>
            <div className="text-[9px] flex text-mono-mid uppercase w-full justify-between tabular-nums">
              <span>Stride Phase</span>
              <span className="text-selection font-bold">{pose.stride_phase.toFixed(2)}</span>
            </div>
          </div>
        </CollapsibleSection>

        {/* Perspective Camera & Walk Views (Front / Back 3P / Side Balance) */}
        <CollapsibleSection title="Perspective Engine" defaultOpen={true}>
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  { id: 'front', label: 'Front' },
                  { id: 'back_3p', label: 'Back 3P' },
                  { id: 'side_balance', label: 'Side Bal' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleWalkPerspectiveChange(m.id)}
                  className={`text-[8px] py-1.5 px-1 rounded border font-bold uppercase tracking-wider transition-colors ${
                    walkPerspective === m.id
                      ? 'bg-selection text-white dark:text-paper border-selection'
                      : 'border-ridge text-mono-mid hover:text-ink'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setPerspective((prev) => ({ ...prev, enabled: !prev.enabled }))}
                className={`flex-1 text-[8px] px-2 py-1 border rounded font-bold uppercase ${
                  perspective.enabled
                    ? 'bg-accent-green text-white border-accent-green'
                    : 'border-ridge text-mono-mid hover:text-ink'
                }`}
              >
                1-Pt Grid: {perspective.enabled ? 'On' : 'Off'}
              </button>
              <button
                onClick={() =>
                  setPerspective({ enabled: true, vpX: 0, horizonY: -533, strength: 0.78 })
                }
                className="text-[8px] px-2 py-1 border border-ridge rounded text-mono-mid hover:text-ink hover:border-selection font-bold uppercase"
              >
                Reset VP
              </button>
            </div>

            {perspective.enabled && (
              <div className="flex flex-col gap-2 pt-1">
                <div>
                  <div className="flex justify-between text-[8px] uppercase font-bold text-mono-light">
                    <span>Vanishing Point X</span>
                    <span className="text-selection tabular-nums">{perspective.vpX}</span>
                  </div>
                  <input
                    type="range"
                    min="-500"
                    max="500"
                    step="1"
                    value={perspective.vpX}
                    onChange={(e) =>
                      setPerspective((prev) => ({ ...prev, vpX: parseInt(e.target.value, 10) }))
                    }
                    className="w-full accent-selection bg-ridge h-1 appearance-none cursor-pointer rounded-full"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[8px] uppercase font-bold text-mono-light">
                    <span>Horizon Elevation Y</span>
                    <span className="text-selection tabular-nums">{perspective.horizonY}</span>
                  </div>
                  <input
                    type="range"
                    min="-1250"
                    max="350"
                    step="1"
                    value={perspective.horizonY}
                    onChange={(e) =>
                      setPerspective((prev) => ({ ...prev, horizonY: parseInt(e.target.value, 10) }))
                    }
                    className="w-full accent-selection bg-ridge h-1 appearance-none cursor-pointer rounded-full"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[8px] uppercase font-bold text-mono-light">
                    <span>Perspective Bias</span>
                    <span className="text-selection tabular-nums">{perspective.strength.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.01"
                    value={perspective.strength}
                    onChange={(e) =>
                      setPerspective((prev) => ({ ...prev, strength: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-selection bg-ridge h-1 appearance-none cursor-pointer rounded-full"
                  />
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Sibling Puppet Rig Systems (Synced with Bitruvian.Human.Puppyt) */}
        {modelVersion === 'core' && (
          <CollapsibleSection title="Sibling Rig Systems" defaultOpen={false}>
            <div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => setPrometheusWings((w) => !w)}
                  className={`text-[8px] px-1.5 py-1.5 border rounded font-bold uppercase ${
                    prometheusWings
                      ? 'bg-selection text-white dark:text-paper border-selection'
                      : 'border-ridge text-mono-mid hover:text-ink'
                  }`}
                >
                  Wings: {prometheusWings ? 'Pop' : 'Off'}
                </button>
                <button
                  onClick={() => setConstrainLimits((c) => !c)}
                  className={`text-[8px] px-1.5 py-1.5 border rounded font-bold uppercase ${
                    constrainLimits
                      ? 'bg-accent-green text-white border-accent-green'
                      : 'border-ridge text-mono-mid hover:text-ink'
                  }`}
                >
                  Limits: {constrainLimits ? 'Soft' : 'Free'}
                </button>
                <button
                  onClick={() => setEyesActive((e) => !e)}
                  className={`text-[8px] px-1.5 py-1.5 border rounded font-bold uppercase ${
                    eyesActive
                      ? 'bg-selection text-white dark:text-paper border-selection'
                      : 'border-ridge text-mono-mid hover:text-ink'
                  }`}
                  title="Toggle skull eyeballs (off by default matching base repo)"
                >
                  Eyes: {eyesActive ? 'On' : 'Off'}
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[8px] uppercase font-bold text-mono-light">Ribcage Anchor</span>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { id: 'upper', label: 'Upper' },
                      { id: 'lower', label: 'Lower' },
                      { id: 'ribwings', label: 'Wings' },
                    ] as const
                  ).map((rMode) => (
                    <button
                      key={rMode.id}
                      onClick={() => setRibAnchor(rMode.id)}
                      className={`text-[8px] py-1 px-1 rounded border font-bold uppercase ${
                        ribAnchor === rMode.id
                          ? 'bg-selection-super-light text-selection border-selection/40'
                          : 'border-ridge text-mono-mid hover:text-ink'
                      }`}
                    >
                      {rMode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setUseAdvancedHands((v) => !v)}
                  className={`text-[8px] px-2 py-1.5 border rounded font-bold uppercase ${
                    useAdvancedHands
                      ? 'bg-selection text-white dark:text-paper border-selection'
                      : 'border-ridge text-mono-mid hover:text-ink'
                  }`}
                >
                  5-Digit Hands: {useAdvancedHands ? 'On' : 'Off'}
                </button>
                <button
                  onClick={() => setUseAdvancedFeet((v) => !v)}
                  className={`text-[8px] px-2 py-1.5 border rounded font-bold uppercase ${
                    useAdvancedFeet
                      ? 'bg-selection text-white dark:text-paper border-selection'
                      : 'border-ridge text-mono-mid hover:text-ink'
                  }`}
                >
                  Multi-Bone Feet: {useAdvancedFeet ? 'On' : 'Off'}
                </button>
              </div>

              {useAdvancedHands && (
                <div className="flex flex-col gap-1 pt-1">
                  <span className="text-[8px] uppercase font-bold text-mono-light">Gotz Hand Pose</span>
                  <div className="grid grid-cols-5 gap-1">
                    {GOTZ_PRESET_OPTIONS.map((hp) => (
                      <button
                        key={hp}
                        onClick={() => setHandPreset(hp)}
                        className={`text-[7.5px] py-1 px-0.5 rounded border font-bold uppercase truncate ${
                          handPreset === hp
                            ? 'bg-selection-super-light text-selection border-selection/40'
                            : 'border-ridge text-mono-mid hover:text-ink'
                        }`}
                        title={hp}
                      >
                        {hp}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Advanced Gait Controls with Dynamic Sliding Slider Ranges */}
        <CollapsibleSection title="Advanced Gait Controls" defaultOpen={false}>
          <div className="flex flex-col gap-3">
            {(Object.keys(gaitSliderConfig) as Array<keyof typeof gaitSliderConfig>).map((key) => {
              const cfg = gaitSliderConfig[key];
              const range = getSlidingRange(key, gait[key]);
              return (
                <div key={key}>
                  <div className="flex justify-between text-[8px] uppercase font-bold text-mono-light">
                    <span>
                      {cfg.label}
                      {range.expanded && <span className="ml-1 text-accent-red">•</span>}
                    </span>
                    <span className="text-selection tabular-nums">
                      {gait[key].toFixed(2)}{' '}
                      <span className="text-mono-mid font-normal text-[7px]">
                        [{range.min.toFixed(1)}..{range.max.toFixed(1)}]
                      </span>
                    </span>
                  </div>
                  <input
                    type="range"
                    min={range.min}
                    max={range.max}
                    step={cfg.step}
                    value={gait[key]}
                    onChange={(e) => handleGaitChange(key, e.target.value)}
                    className="w-full accent-selection bg-ridge h-1.5 appearance-none cursor-pointer rounded-full"
                  />
                </div>
              );
            })}
          </div>
        </CollapsibleSection>

        {/* Structural Proportions (Active on BOTH Core & Legacy!) */}
        <CollapsibleSection title="Structural Proportions" defaultOpen={false}>
          <div className="flex items-center justify-between border-b border-ridge pb-2 mb-2">
            <p className="text-[9px] text-mono-mid italic">Width & Height per bone segment.</p>
            <button
              onClick={handleResetProps}
              className="text-[8px] px-2 py-0.5 border border-ridge rounded text-mono-mid hover:text-ink hover:border-selection font-bold uppercase"
            >
              Reset
            </button>
          </div>
          {(Object.keys(props) as Array<keyof WalkingEngineProportions>).map((piece) => (
            <div key={piece} className="flex flex-col gap-2 p-2 border border-ridge rounded mb-2 last:mb-0">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-selection font-bold uppercase">{formatKeyLabel(piece)}</span>
              </div>
              <div className="flex justify-between text-[8px] uppercase font-bold text-mono-light">
                <span>Width</span>
                <span className="text-selection tabular-nums">{props[piece].w.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.01"
                value={props[piece].w}
                onChange={(e) => updateProp(piece, 'w', e.target.value)}
                className="w-full accent-accent-green bg-ridge h-1 appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[8px] uppercase font-bold text-mono-light mt-1">
                <span>Height</span>
                <span className="text-selection tabular-nums">{props[piece].h.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.01"
                value={props[piece].h}
                onChange={(e) => updateProp(piece, 'h', e.target.value)}
                className="w-full accent-selection bg-ridge h-1 appearance-none cursor-pointer"
              />
            </div>
          ))}
        </CollapsibleSection>

        {/* Joint Pivots (Hands/Fingers & Feet/Toes equalized with knees/elbows/hips/shoulders) */}
        <CollapsibleSection title="Joint Pivots" defaultOpen={false}>
          <div className="flex items-center justify-between border-b border-ridge pb-2 mb-2">
            <p className="text-[9px] text-mono-mid italic">Additive joint & digit offsets.</p>
            <button
              onClick={handleResetPivots}
              className="text-[8px] px-2 py-0.5 border border-ridge rounded text-mono-mid hover:text-ink hover:border-selection font-bold uppercase"
            >
              Reset
            </button>
          </div>
          {PIVOT_DISPLAY_ORDER.map((key) => (
            <div key={key} className="flex flex-col gap-1 mb-2 last:mb-0">
              <div className="flex justify-between text-[10px] uppercase font-bold text-mono-light">
                <span>{formatKeyLabel(key)}</span>
                <span className="text-selection tabular-nums">{pivotOffsets[key]}°</span>
              </div>
              <input
                type="range"
                min="-360"
                max="360"
                value={pivotOffsets[key]}
                onChange={(e) => updatePivotOffset(key, e.target.value)}
                className="w-full accent-selection bg-ridge h-1 appearance-none cursor-pointer"
              />
            </div>
          ))}
        </CollapsibleSection>

        <CollapsibleSection title="Export" defaultOpen={false}>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleSavePose}
              disabled={isRecording}
              className={`text-[9px] px-3 py-1.5 border rounded transition-all font-bold uppercase tracking-wider ${
                isRecording
                  ? 'bg-ridge text-mono-mid opacity-40 cursor-not-allowed'
                  : 'border-ridge text-ink hover:border-selection hover:text-selection'
              }`}
            >
              Save Pose Data
            </button>
            <button
              onClick={handleStartRecording}
              disabled={isRecording}
              className={`text-[9px] px-3 py-1.5 border rounded transition-all font-bold uppercase tracking-wider ${
                isRecording
                  ? 'border-accent-red bg-accent-red/15 text-accent-red animate-pulse'
                  : 'border-accent-red/40 text-accent-red hover:bg-accent-red/10 hover:border-accent-red'
              }`}
            >
              {isRecording
                ? `Recording ${framesRecordedRef.current}/${recordFrameCount}`
                : `Record Loop (${recordFrameCount} Frames)`}
            </button>
            {recordingError && <p className="text-[9px] text-accent-red font-medium">{recordingError}</p>}
            <div className="flex flex-col gap-1.5 pt-2">
              <div className="flex justify-between text-[8px] uppercase font-bold text-mono-light">
                <span>Frames to Record</span>
                <span className="text-selection tabular-nums">{recordFrameCount}</span>
              </div>
              <input
                type="range"
                min="10"
                max="300"
                step="1"
                value={recordFrameCount}
                disabled={isRecording}
                onChange={(e) => setRecordFrameCount(parseInt(e.target.value, 10))}
                className="w-full accent-selection bg-ridge h-1.5 appearance-none cursor-pointer rounded-full"
              />
            </div>
          </div>
        </CollapsibleSection>

        {/* Procedural Sibling Roadmap */}
        <CollapsibleSection title="Procedural Roadmap" defaultOpen={false}>
          <div className="flex flex-col gap-2 text-[9px] text-mono-mid">
            <div className="flex items-start justify-between gap-2 border-b border-ridge pb-1.5">
              <div>
                <div className="font-bold text-ink uppercase">Walking & Running Engine</div>
                <div>2nd-order knees/elbows, Gotz hands, Piggy toes, 1-pt perspective</div>
              </div>
              <span className="text-[8px] font-bold text-accent-green uppercase shrink-0">Active</span>
            </div>
            <div className="flex items-start justify-between gap-2 border-b border-ridge pb-1.5">
              <div>
                <div className="font-bold text-ink uppercase">Procedural Idle Engine</div>
                <div>Breathing ribcage cycles, COM micro-sway, weight shifts & gaze</div>
              </div>
              <span className="text-[8px] font-bold text-selection uppercase shrink-0">Next</span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-ink uppercase">Idle ↔ Walk ↔ Run Blend</div>
                <div>Continuous velocity state machine & sibling pose-kit interop</div>
              </div>
              <span className="text-[8px] font-bold text-mono-light uppercase shrink-0">Planned</span>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Live Pose Data" defaultOpen={false}>
          <pre className="text-[9px] text-mono-mid bg-mono-darker p-2 rounded overflow-x-auto tabular-nums">
            {JSON.stringify(
              pose,
              (key, value) => (typeof value === 'number' ? parseFloat(value.toFixed(1)) : value),
              2
            )}
          </pre>
        </CollapsibleSection>
      </div>

      {/* Main Anatomical Viewport - Clean, Open Seamless Canvas */}
      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center bg-paper overflow-hidden"
      >
        {showSplash && (
          <div className="absolute top-[8%] left-0 right-0 z-30 flex items-center justify-center pointer-events-none">
            <h1 className="text-6xl font-archaic text-ink/80 animate-terminal-boot tracking-widest uppercase">
              BITRUVIUS
            </h1>
          </div>
        )}

        {/* Quiet unboxed viewport hierarchy legend */}
        <div className="absolute top-4 right-6 z-20 flex items-center gap-3 text-[10px] text-mono-mid pointer-events-none">
          <span className="font-bold text-ink">
            {modelVersion === 'core' ? 'bitruvian.human.puppyt' : 'legacy.manikin'}
          </span>
          {modelVersion === 'core' && isXRay && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-bold text-[#14532D] dark:text-[#22c55e]">
                X-Ray Vector
              </span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span style={{ color: palette.anchorRed }} className="font-bold">
            Red Dot Anchors
          </span>
        </div>

        {/* Loading or Error state for rig-data.json */}
        {modelVersion === 'core' && !puppytLoaded && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="text-xs font-mono text-mono-mid bg-mono-dark/95 border border-ridge px-4 py-2 rounded">
              {puppytLoadError ? `Rig asset error: ${puppytLoadError}` : 'Loading bitruvian.human.puppyt rig...'}
            </div>
          </div>
        )}

        {/* Interactive anchor readout when paused */}
        {isPaused && showPivots && (
          <div className="absolute bottom-4 left-6 z-20 text-[10px] text-mono-mid bg-mono-dark/90 border border-ridge px-3 py-1.5 rounded pointer-events-none tabular-nums">
            {activeAnchorKey ? (
              <span>
                Anchor <strong className="text-selection">{formatKeyLabel(activeAnchorKey)}</strong> ·{' '}
                {pivotOffsets[activeAnchorKey]}° · Drag horizontally to offset
              </span>
            ) : (
              <span>Paused · Hover or drag any red anchor dot to adjust joint offset</span>
            )}
          </div>
        )}

        <canvas ref={canvasRef} className="absolute" style={{ display: 'none' }} />

        <svg
          viewBox={currentViewBox}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full overflow-visible relative z-10"
          ref={svgRef}
        >
          <SystemGuides
            floorY={visualFloorY}
            baseUnitH={H}
            theme={theme}
            modelVersion={modelVersion}
            lPlanted={footContacts.lPlanted}
            rPlanted={footContacts.rPlanted}
            lFootX={footContacts.lFootX}
            rFootX={footContacts.rFootX}
            lWeight={footContacts.lWeight}
            rWeight={footContacts.rWeight}
            lRoadOffsetY={footContacts.lRoadOffsetY}
            rRoadOffsetY={footContacts.rRoadOffsetY}
            focalX={modelVersion === 'core' ? footContacts.pelvisX : pose.x_offset || 0}
            perspective={perspective}
            onPerspMouseDown={handlePerspMouseDown}
            draggingPersp={draggingPersp}
          />

          {modelVersion === 'core' ? (
            puppytGraphRef.current && (
              <PuppytSkeleton
                graph={puppytGraphRef.current}
                visualFloorY={visualFloorY}
                theme={theme}
                showPivots={showPivots}
                showLabels={showLabels}
                isPaused={isPaused}
                wingPop={wingPopRef.current}
                visualMode={rigVisualMode}
                constrainLimits={constrainLimits}
                useAdvancedHands={useAdvancedHands}
                useAdvancedFeet={useAdvancedFeet}
                handStateL={liveHandStateRef.current.L}
                handStateR={liveHandStateRef.current.R}
                footStateL={liveFootStateRef.current.L}
                footStateR={liveFootStateRef.current.R}
                draggingBoneKey={draggingBoneKey}
                hoveredBoneKey={hoveredBoneKey}
                onAnchorMouseDown={onAnchorMouseDown}
                onAnchorHover={setHoveredBoneKey}
                skullOverrideUrl={skullOverrideUrl}
                skullOverrideBox={skullOverrideBox}
                isBackView={currentHeadSpec.view === 'back'}
              />
            )
          ) : (
            <g transform={`translate(${pose.x_offset || 0}, ${mannequinBaseYTranslation + pose.y_offset})`}>
              <Mannequin
                pose={pose}
                pivotOffsets={pivotOffsets}
                props={props}
                showPivots={showPivots}
                showLabels={showLabels}
                baseUnitH={H}
                onAnchorMouseDown={onAnchorMouseDown}
                onAnchorHover={setHoveredBoneKey}
                draggingBoneKey={draggingBoneKey}
                hoveredBoneKey={hoveredBoneKey}
                isPaused={isPaused}
                modelVersion="legacy"
                theme={theme}
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};

export default App;
