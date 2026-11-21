import React, { useState, useEffect, useRef, useCallback } from 'react';
import saveAs from 'file-saver';
import {
  ModelVersion,
  ThemeMode,
  WalkingEnginePose,
  WalkingEngineGait,
  WalkingEnginePivotOffsets,
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
import {
  PuppytRawRigDef,
  PuppytRigGraph,
  SKULL_VIEW_SPECS,
  SkullViewMode,
  applyPoseToPuppytRig,
  buildPuppytRigGraph,
  createOliveNeckringDataUrl,
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
  // 4: Cartoon Extreme
  {
    intensity: 2.25,
    stride: 1.95,
    lean: 0.52,
    frequency: 1.95,
    gravity: 0.1,
    bounce: 2.15,
    bends: 2.15,
    head_spin: 0.0,
    mood: 1.0,
    ground_drag: 0.0,
    foot_angle_on_ground: 10,
    arm_swing: 2.15,
    elbow_bend: 0.98,
    wrist_swing: 2.25,
    foot_roll: 1.45,
    toe_lift: 1.35,
    shin_tilt: 0.35,
    foot_slide: 0.0,
    kick_up_force: 1.35,
    hover_height: 0.8,
    waist_twist: 1.95,
    hip_sway: 1.85,
    toe_bend: 1.85,
  },
];
const corePresetNames = ['Tiny Tip-Toe', 'Elderly Shuffle', 'Natural Walk', 'Spry Child Run', 'Cartoon Extreme'];

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
  { min: number; max: number; step: number; label: string }
> = {
  intensity: { min: 0.05, max: 2.8, step: 0.01, label: 'Intensity' },
  stride: { min: 0.05, max: 2.5, step: 0.01, label: 'Stride Length' },
  lean: { min: -1.2, max: 1.2, step: 0.01, label: 'Body Lean' },
  frequency: { min: 0.15, max: 5.5, step: 0.01, label: 'Frequency' },
  gravity: { min: 0, max: 1, step: 0.01, label: 'Gravity' },
  bounce: { min: 0, max: 2.6, step: 0.01, label: 'Bounce' },
  bends: { min: 0, max: 2.6, step: 0.01, label: 'Limb Bendiness' },
  mood: { min: 0, max: 1, step: 0.01, label: 'Mood' },
  ground_drag: { min: 0, max: 1, step: 0.01, label: 'Ground Drag' },
  foot_angle_on_ground: { min: -45, max: 45, step: 1, label: 'Foot / Tip-Toe Angle' },
  arm_swing: { min: 0, max: 2.6, step: 0.01, label: 'Arm Swing' },
  elbow_bend: { min: 0, max: 1.2, step: 0.01, label: 'Elbow Bend' },
  wrist_swing: { min: 0, max: 2.6, step: 0.01, label: 'Wrist Swing' },
  foot_roll: { min: 0, max: 1.6, step: 0.01, label: 'Foot Roll' },
  toe_lift: { min: 0, max: 1.5, step: 0.01, label: 'Toe Lift' },
  shin_tilt: { min: -1, max: 1, step: 0.01, label: 'Shin Tilt' },
  foot_slide: { min: 0, max: 1, step: 0.01, label: 'Foot Slide' },
  kick_up_force: { min: 0, max: 1.5, step: 0.01, label: 'Kick Up Force' },
  hover_height: { min: 0, max: 1.2, step: 0.01, label: 'Hover Height' },
  waist_twist: { min: 0, max: 2.5, step: 0.01, label: 'Waist Twist' },
  hip_sway: { min: 0, max: 2.5, step: 0.01, label: 'Hip Sway' },
  toe_bend: { min: 0, max: 2.2, step: 0.01, label: 'Toe Bend' },
};

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

const App: React.FC = () => {
  const [modelVersion, setModelVersion] = useState<ModelVersion>('core');
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [skullView, setSkullView] = useState<SkullViewMode>('front');
  const [skullOverrideUrl, setSkullOverrideUrl] = useState<string | null>(null);
  const [skullOverrideBox, setSkullOverrideBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const [showPivots, setShowPivots] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [bobblehead, setBobblehead] = useState(false);
  const [isGroundedMode, setIsGroundedMode] = useState(true);
  const [isGlideMode, setIsGlideMode] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [targetFps, setTargetFps] = useState(60);
  const H = 150;

  // Load real bitruvian.human.puppyt skeletal assets from /rig-data.json
  const puppytGraphRef = useRef<PuppytRigGraph | null>(null);
  const [puppytLoaded, setPuppytLoaded] = useState(false);
  const [puppytLoadError, setPuppytLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/rig-data.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ rig: PuppytRawRigDef }>;
      })
      .then(async (data) => {
        if (cancelled) return;
        const graph = buildPuppytRigGraph(data.rig);
        // Tint Neckring to Olive so collar is unmistakably olive while preserving black outline
        const neckringPiece = graph.pieces.find((p) => p.name === 'Neckring');
        if (neckringPiece?.src) {
          neckringPiece.oliveSrc = await createOliveNeckringDataUrl(neckringPiece.src);
        }
        if (cancelled) return;
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

  // Load Side / Back Skull kit views from /assets/skull-*.png on demand
  useEffect(() => {
    let cancelled = false;
    if (skullView === 'front') {
      setSkullOverrideUrl(null);
      setSkullOverrideBox(null);
      return;
    }
    const spec = SKULL_VIEW_SPECS[skullView];
    loadNormalizedSkullDataUrl(skullView)
      .then((url) => {
        if (cancelled) return;
        setSkullOverrideUrl(url);
        setSkullOverrideBox({ x: spec.dx, y: spec.dy, w: spec.w, h: spec.h });
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
  }, [skullView]);

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

  // Continuous transition refs (zero-hitch animation state)
  const phaseRef = useRef(0);
  const prevTickTimeRef = useRef(0);
  const lastRenderTimeRef = useRef(0);

  const isTransitioningToRestRef = useRef(false);
  const pauseTransitionStartRef = useRef(0);
  const initialPoseOnPauseRef = useRef<WalkingEnginePose | null>(null);
  const PAUSE_TRANSITION_DURATION = 900;

  const resumeBlendRef = useRef(1);
  const resumeStartPoseRef = useRef<WalkingEnginePose | null>(null);
  const RESUME_BLEND_DURATION = 0.45; // seconds

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

  const [footContacts, setFootContacts] = useState<{ lPlanted: boolean; rPlanted: boolean }>({
    lPlanted: false,
    rPlanted: false,
  });

  const headSpring = useRef({ pos: 0, vel: 0 });
  const smoothedWaistTwistRef = useRef(0);
  const smoothedTorsoLeanRef = useRef(0);
  const smoothedWaistSwayRef = useRef(0);
  const smoothedBodySwayXRef = useRef(0);
  const smoothedBobbingRef = useRef(0);

  const [props, setProps] = useState<WalkingEngineProportions>({
    head: { w: 1, h: 1 },
    collar: { w: 1, h: 1 },
    torso: { w: 1, h: 1 },
    waist: { w: 1, h: 1 },
    l_upper_arm: { w: 1, h: 1 },
    l_lower_arm: { w: 1, h: 1 },
    l_hand: { w: 0.55, h: 1 },
    r_upper_arm: { w: 1, h: 1 },
    r_lower_arm: { w: 1, h: 1 },
    r_hand: { w: 0.55, h: 1 },
    l_upper_leg: { w: 1, h: 1 },
    l_lower_leg: { w: 1, h: 1 },
    l_foot: { w: 0.65, h: 1 },
    r_upper_leg: { w: 1, h: 1 },
    r_lower_leg: { w: 1, h: 1 },
    r_foot: { w: 0.65, h: 1 },
    l_toe: { w: 0.9, h: 1 },
    r_toe: { w: 0.9, h: 1 },
  });

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
    // Smoothly transition into the new model's calibrated gait & pose with zero hitch
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

      // Smoothly interpolate liveGait toward targetGait every single frame (no cycle-boundary step jumps!)
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

      // Paused state: smooth rest transition & live pivot preview
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
            const contact = applyPoseToPuppytRig(
              puppytGraphRef.current,
              pausedPose,
              pivotOffsetsRef.current,
              props,
              isGroundedMode
            );
            setFootContacts({ lPlanted: contact.lPlanted, rPlanted: contact.rPlanted });
          }
          setPose({ ...pausedPose });
        }
        return;
      }

      // Continuous phase integration (never jumps when frequency changes!)
      phaseRef.current = (phaseRef.current + dt * Math.PI * lg.frequency) % (Math.PI * 2);
      const p = phaseRef.current;

      const strideVal = Math.sin(p);
      const counterStride = Math.sin(p + Math.PI);
      const moodFactor = lg.mood;

      let targetPose: WalkingEnginePose;
      let nextContacts = { lPlanted: false, rPlanted: false };

      if (modelVersion === 'core') {
        // ============================================================
        // BITRUVIAN.HUMAN.PUPPYT C1-SMOOTH WALK CYCLE (WIDE RANGE + EXPRESSIVE HANDS/FEET)
        // ============================================================
        const lLift = smoothLift(p);
        const rLift = smoothLift(p + Math.PI);
        const cosP = Math.cos(p);
        const counterCosP = Math.cos(p + Math.PI);

        const moodTorso = (moodFactor - 0.5) * -14;
        const torsoLeanTarget = lg.lean * 22 + moodTorso + Math.sin(p * 2) * 3.5 * lg.intensity;
        smoothedTorsoLeanRef.current = lerp(smoothedTorsoLeanRef.current, torsoLeanTarget, 1 - Math.exp(-10 * dt));
        const torsoLean = smoothedTorsoLeanRef.current;

        const waistTwistTarget = cosP * 9.5 * lg.waist_twist * Math.max(0.4, lg.intensity * 0.85);
        smoothedWaistTwistRef.current = lerp(smoothedWaistTwistRef.current, waistTwistTarget, 1 - Math.exp(-10 * dt));
        const waistTwist = smoothedWaistTwistRef.current;

        // Lateral weight shift over the planted stance leg
        const hipSwayMag = 18 * lg.hip_sway * Math.max(0.35, lg.intensity * 0.85);
        const waistSwayTarget = -strideVal * 6.5 * lg.hip_sway * Math.max(0.35, lg.intensity * 0.85);
        smoothedWaistSwayRef.current = lerp(smoothedWaistSwayRef.current, waistSwayTarget, 1 - Math.exp(-10 * dt));
        const waistSway = smoothedWaistSwayRef.current;

        const bodySwayXTarget = -strideVal * hipSwayMag;
        smoothedBodySwayXRef.current = lerp(smoothedBodySwayXRef.current, bodySwayXTarget, 1 - Math.exp(-10 * dt));
        const bodySwayX = smoothedBodySwayXRef.current;

        let headBobble = 0;
        if (bobblehead) {
          const target = -torsoLean * 0.72;
          const force = (target - headSpring.current.pos) * 0.14;
          headSpring.current.vel += force;
          headSpring.current.vel *= 0.84;
          headSpring.current.pos += headSpring.current.vel;
          headBobble = headSpring.current.pos;
        }

        // Shoulder, forearm, & expressive wrist follow-through
        const armDriveScale = 0.55 + Math.min(1.6, lg.intensity) * 0.45;
        const armSwingAmp = (7 + lg.stride * 17) * (0.48 + moodFactor * 0.52) * lg.arm_swing * armDriveScale;
        const lShoulder = -lLift * armSwingAmp * 0.72 + rLift * armSwingAmp * 0.52 - cosP * armSwingAmp * 0.4;
        const rShoulder = rLift * armSwingAmp * 0.72 - lLift * armSwingAmp * 0.52 + counterCosP * armSwingAmp * 0.4;

        const elbowAmp = (12 + 22 * lg.elbow_bend) * lg.bends;
        const lElbow =
          -12 * lg.elbow_bend - rLift * elbowAmp * 0.9 - Math.max(0, -cosP) * elbowAmp * 0.35;
        const rElbow =
          12 * lg.elbow_bend + lLift * elbowAmp * 0.9 + Math.max(0, -counterCosP) * elbowAmp * 0.35;

        // Expressive pendulum + snap wrist motion (reacts cleanly from calm elderly to whippy cartoon)
        const wristAmp = (18 + 24 * lg.intensity * 0.55) * lg.wrist_swing;
        const wristLag = Math.PI * 0.32;
        const lHand =
          Math.sin(p + Math.PI + wristLag) * wristAmp +
          Math.sin(p * 2 + 0.4) * 9 * lg.wrist_swing * Math.min(1.8, lg.bends) -
          lElbow * 0.16;
        const rHand =
          Math.sin(p + wristLag) * wristAmp -
          Math.sin(p * 2 + 0.4) * 9 * lg.wrist_swing * Math.min(1.8, lg.bends) -
          rElbow * 0.16;

        let l_hip = 0,
          l_knee = 0,
          l_foot = 0,
          r_hip = 0,
          r_knee = 0,
          r_foot = 0,
          bobbing = 0;

        if (isGlideMode) {
          bobbing = -Math.abs(Math.sin(p)) * 22 * lg.bounce;
          const glideRange = 16 * lg.stride;
          l_hip = -lLift * glideRange + rLift * 5;
          l_knee = lLift * 28 * lg.bends;
          r_hip = rLift * glideRange - lLift * 5;
          r_knee = -rLift * 28 * lg.bends;
          l_foot = -lLift * (14 + 10 * lg.foot_roll) + lg.foot_angle_on_ground * 0.85;
          r_foot = rLift * (14 + 10 * lg.foot_roll) - lg.foot_angle_on_ground * 0.85;
        } else {
          const hipSwingAmp = (6 + lg.stride * 14) * (0.6 + lg.intensity * 0.38) * (0.55 + moodFactor * 0.45);
          const kneeLiftAmp =
            (10 + lg.stride * 13 + lg.hover_height * 22) * lg.bends + lg.kick_up_force * 14;
          const dragKnee = lg.ground_drag * 12;

          // Left leg (screen right: negative femur lifts/opens, positive knee bends cleanly back)
          l_hip = -lLift * hipSwingAmp + rLift * (2.6 + lg.stride * 1.4);
          l_knee = lLift * kneeLiftAmp + dragKnee * (1 - lLift * 0.6) + Math.sin(p) * 5 * lg.shin_tilt;

          // Right leg (mirrored chirality)
          r_hip = rLift * hipSwingAmp - lLift * (2.6 + lg.stride * 1.4);
          r_knee = -rLift * kneeLiftAmp - dragKnee * (1 - rLift * 0.6) - Math.sin(p) * 5 * lg.shin_tilt;

          // Expressive ankle roll + tip-toe + swing dorsiflexion (strictly 2*PI-periodic, zero hitch)
          const solvePuppytFootAngle = (
            legPhase: number,
            lift: number,
            hipA: number,
            kneeA: number,
            sideSign: 1 | -1
          ) => {
            const s = Math.sin(legPhase);
            const c = Math.cos(legPhase);
            const stanceW = smoothstep(-0.28, 0.28, -s);
            const swingW = 1 - stanceW;

            const heelStrikeW = Math.pow(Math.max(0, -c), 2) * smoothstep(-0.25, 0.35, -Math.sin(legPhase - 0.3));
            const pushOffW = Math.pow(Math.max(0, c), 2) * smoothstep(-0.25, 0.35, -Math.sin(legPhase + 0.3));

            const shankWorld = (hipA + kneeA) * sideSign;
            // For footL (+1): positive = plantarflex (toes down / tip-toe), negative = dorsiflex (toes up / heel strike)
            const flatLevelAngle = -shankWorld * 0.72;
            const heelStrikeAngle = -15 * lg.foot_roll;
            const pushOffAngle = 26 * lg.foot_roll * lg.toe_bend;

            const stanceFoot =
              flatLevelAngle * (1 - heelStrikeW * 0.7) +
              heelStrikeAngle * heelStrikeW +
              pushOffAngle * pushOffW;

            const swingAngle =
              -lift * (14 + 22 * lg.toe_lift + 12 * lg.kick_up_force) - shankWorld * 0.45 * lift;

            const tipToePitch = lg.foot_angle_on_ground * 0.9;
            return (stanceFoot * stanceW + swingAngle * swingW + tipToePitch) * sideSign;
          };

          l_foot = solvePuppytFootAngle(p, lLift, l_hip, l_knee, 1);
          r_foot = solvePuppytFootAngle(p + Math.PI, rLift, r_hip, r_knee, -1);

          // Double-frequency vertical center-of-mass bounce (smooth cosine wave, zero corner!)
          const doubleBounce = (0.5 - 0.5 * Math.cos(p * 2)) * 26 * lg.bounce * (1 - lg.gravity * 0.35);
          bobbing = -doubleBounce;
        }

        smoothedBobbingRef.current = lerp(smoothedBobbingRef.current, bobbing, 1 - Math.exp(-12 * dt));

        targetPose = {
          waist: waistTwist + waistSway,
          stride_phase: strideVal,
          y_offset: smoothedBobbingRef.current,
          x_offset: bodySwayX,
          torso: torsoLean,
          collar: -torsoLean * 0.58 - waistSway * 0.45,
          neck: -torsoLean * 0.36 + lg.head_spin * 180 + headBobble,
          l_hip,
          l_knee,
          l_foot,
          l_toe: 0,
          r_hip,
          r_knee,
          r_foot,
          r_toe: 0,
          l_shoulder: lShoulder,
          l_elbow: lElbow,
          l_hand: lHand,
          r_shoulder: rShoulder,
          r_elbow: rElbow,
          r_hand: rHand,
        };
      } else {
        // ============================================================
        // LEGACY MANIKIN WALKING ENGINE (Proportioned & C1-Fluid, zero hitch)
        // ============================================================
        const moodTorso = (moodFactor - 0.5) * -40;
        const torsoLeanTarget = lg.lean * 35 + moodTorso + Math.sin(p) * 8 * lg.intensity;
        smoothedTorsoLeanRef.current = lerp(smoothedTorsoLeanRef.current, torsoLeanTarget, 1 - Math.exp(-10 * dt));
        const torsoLean = smoothedTorsoLeanRef.current;

        const waistTwistTarget = counterStride * 20 * lg.waist_twist * lg.intensity;
        smoothedWaistTwistRef.current = lerp(smoothedWaistTwistRef.current, waistTwistTarget, 1 - Math.exp(-10 * dt));
        const waistTwist = smoothedWaistTwistRef.current;

        const hipSwayMagnitude = 25 * lg.hip_sway * lg.intensity;
        const waistSwayTarget = Math.cos(p * 2) * hipSwayMagnitude * 0.5;
        smoothedWaistSwayRef.current = lerp(smoothedWaistSwayRef.current, waistSwayTarget, 1 - Math.exp(-10 * dt));
        const waistSway = smoothedWaistSwayRef.current;

        const bodySwayXTarget = Math.cos(p) * hipSwayMagnitude;
        smoothedBodySwayXRef.current = lerp(smoothedBodySwayXRef.current, bodySwayXTarget, 1 - Math.exp(-10 * dt));
        const bodySwayX = smoothedBodySwayXRef.current;

        let headBobble = 0;
        if (bobblehead) {
          const target = -torsoLean * 0.6;
          const force = (target - headSpring.current.pos) * 0.12;
          headSpring.current.vel += force;
          headSpring.current.vel *= 0.82;
          headSpring.current.pos += headSpring.current.vel;
          headBobble = headSpring.current.pos;
        }

        const armSwingMagnitude = (20 + lg.stride * 45) * (0.4 + moodFactor) * lg.arm_swing;
        const baseElbowBend = -30 * lg.elbow_bend;
        const dynamicElbowAmplitude = 60 * lg.arm_swing * lg.intensity * lg.bends;
        const elbowPhaseOffset = Math.PI * 0.05;
        const lElbowDrive = Math.cos(p + Math.PI + elbowPhaseOffset);
        const rElbowDrive = Math.cos(p + elbowPhaseOffset);
        const wristPhaseOffset = Math.PI * 0.15;
        const lWristDrive = Math.cos(p + Math.PI + wristPhaseOffset);
        const rWristDrive = Math.cos(p + wristPhaseOffset);

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
          l_knee = glideKneeBend - smoothAbsStride * 20;
          r_hip = counterStride * glideHipRange;
          r_knee = glideKneeBend - smoothAbsCounter * 20;
        } else {
          // Strictly 2*PI-periodic C1-smooth leg solver (zero phase-wrap or branch discontinuities)
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

            const slide = stanceArc * g.foot_slide * 38 * (1 + g.gravity * 0.5);
            const hip = s * hipMult + slide;

            const stanceKnee = 5 + g.ground_drag * 25 + g.gravity * 15 - slide * 0.45;
            const flatFoot = -(hip + stanceKnee);
            const heelLift = toeOffW * -52 * g.foot_roll;
            const stanceFoot = lerp(flatFoot, 15, heelStrikeW) + heelLift;
            const stanceToe = lerp(0, 7.5, heelStrikeW) - heelLift * g.toe_bend;

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
          l_knee = lLeg.knee;
          l_foot = lLeg.foot;
          l_toe = lLeg.toe;
          r_hip = rLeg.hip;
          r_knee = rLeg.knee;
          r_foot = rLeg.foot;
          r_toe = rLeg.toe;

          const lLegHeight = calculateLegacyLegVerticalHeight(lLeg, props, H, false);
          const rLegHeight = calculateLegacyLegVerticalHeight(rLeg, props, H, true);
          // Smooth maximum eliminates the V-cusp hitch when stance transfers from left leg to right leg
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
          l_shoulder: counterStride * armSwingMagnitude,
          l_elbow: baseElbowBend + lElbowDrive * dynamicElbowAmplitude,
          l_hand: lWristDrive * 50 * lg.wrist_swing,
          r_shoulder: strideVal * armSwingMagnitude,
          r_elbow: baseElbowBend + rElbowDrive * dynamicElbowAmplitude,
          r_hand: rWristDrive * 50 * lg.wrist_swing,
        };
      }

      // Smooth Resume / Mode-Toggle Crossfade (zero hitch when resuming or switching modes!)
      let finalPose: WalkingEnginePose;
      if (resumeBlendRef.current < 1 && resumeStartPoseRef.current) {
        resumeBlendRef.current = Math.min(1, resumeBlendRef.current + dt / RESUME_BLEND_DURATION);
        const w = easeInOutQuint(resumeBlendRef.current);
        finalPose = { ...targetPose };
        for (const key of POSE_KEYS) {
          finalPose[key] = lerp(resumeStartPoseRef.current[key], targetPose[key], w);
        }
      } else {
        // Gentle exponential filter on live pose to eliminate any micro-jitters on slider drags
        const poseAlpha = 1 - Math.exp(-26 * dt);
        finalPose = { ...targetPose };
        for (const key of POSE_KEYS) {
          finalPose[key] = lerp(livePoseRef.current[key], targetPose[key], poseAlpha);
        }
      }

      livePoseRef.current = finalPose;

      if (shouldRender) {
        if (modelVersion === 'core' && puppytGraphRef.current) {
          const contact = applyPoseToPuppytRig(
            puppytGraphRef.current,
            finalPose,
            pivotOffsetsRef.current,
            props,
            isGroundedMode
          );
          nextContacts = { lPlanted: contact.lPlanted, rPlanted: contact.rPlanted };
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

  const handleGaitChange = useCallback(
    (key: keyof WalkingEngineGait, value: string) => {
      const numericValue = parseFloat(value);
      const newGait = { ...liveGaitRef.current, [key]: numericValue };
      liveGaitRef.current = newGait;
      targetGaitRef.current = newGait;
      setGait(newGait);
      setActivePresetIndex(-1);
    },
    []
  );

  const handleRandomizeGait = useCallback(() => {
    const roll = Math.random();
    const extremeScale = roll > 0.72 ? 1.85 : roll < 0.25 ? 0.45 : 1.0;
    const randomGait: WalkingEngineGait = {
      intensity: Math.min(2.6, (Math.random() * 0.9 + 0.4) * extremeScale),
      stride: Math.min(2.4, (Math.random() * 1.1 + 0.25) * extremeScale),
      lean: (Math.random() * 1.2 - 0.5) * (roll > 0.72 ? 1.3 : 1.0),
      frequency: Math.random() * 2.4 + 0.55,
      gravity: Math.random() * 0.9 + 0.05,
      bounce: Math.min(2.4, Math.random() * 1.4 * extremeScale),
      bends: Math.min(2.4, (Math.random() * 1.2 + 0.25) * extremeScale),
      head_spin: 0.0,
      mood: Math.random(),
      ground_drag: roll < 0.25 ? Math.random() * 0.8 : Math.random() * 0.45,
      foot_angle_on_ground: roll < 0.22 ? Math.random() * 28 : Math.random() * 30 - 10,
      arm_swing: Math.min(2.4, Math.random() * 1.5 * extremeScale),
      elbow_bend: Math.random(),
      wrist_swing: Math.min(2.4, Math.random() * 1.6 * extremeScale),
      foot_roll: Math.min(1.5, Math.random() * 1.1 + 0.2),
      toe_lift: Math.min(1.4, Math.random() * 1.0 + 0.15),
      shin_tilt: Math.random() - 0.5,
      foot_slide: Math.random() * 0.4,
      kick_up_force: Math.min(1.4, Math.random() * 1.1 * extremeScale),
      hover_height: Math.min(1.0, Math.random() * 0.65 * extremeScale),
      waist_twist: Math.min(2.3, Math.random() * 1.4 * extremeScale),
      hip_sway: Math.min(2.3, Math.random() * 1.4 * extremeScale),
      toe_bend: Math.min(2.0, Math.random() * 1.3 + 0.25),
    };
    targetGaitRef.current = randomGait;
    setActivePresetIndex(-1);
  }, []);

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
    const poseData = { model: modelName, theme, skullView, proportions: props, pivotOffsets, gait };
    const blob = new Blob([JSON.stringify(poseData, null, 2)], { type: 'application/json' });
    saveAs(
      blob,
      modelVersion === 'core' ? 'bitruvian-human-puppyt-pose.json' : 'bitruvian-legacy-pose.json'
    );
  }, [modelVersion, theme, skullView, props, pivotOffsets, gait]);

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

        {/* Model & Theme Mode Selectors */}
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
            <div className="grid grid-cols-3 gap-1 p-1 bg-mono-dark border border-ridge rounded">
              {(['front', 'side', 'back'] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setSkullView(view)}
                  className={`text-[8.5px] py-1 px-1.5 rounded font-bold uppercase tracking-wider transition-colors ${
                    skullView === view
                      ? 'bg-selection-super-light text-selection border border-selection/30'
                      : 'text-mono-mid hover:text-ink'
                  }`}
                >
                  Skull: {view}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Playback & Rig View Toggles */}
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
        </div>

        <CollapsibleSection title="Export">
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
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {activePresets.map((preset, index) => {
              const isOddLast = activePresets.length % 2 === 1 && index === activePresets.length - 1;
              return (
                <button
                  key={activePresetLabels[index]}
                  onClick={() => {
                    targetGaitRef.current = { ...preset };
                    setActivePresetIndex(index);
                  }}
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
            Randomize Gait
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
              <span>Mood</span>
              <span className="text-ink font-bold">{gait.mood.toFixed(2)}</span>
            </div>
            <div className="text-[9px] flex text-mono-mid uppercase w-full justify-between tabular-nums">
              <span>Ground Drag</span>
              <span className="text-ink font-bold">{gait.ground_drag.toFixed(2)}</span>
            </div>
            <div className="text-[9px] flex text-mono-mid uppercase w-full justify-between tabular-nums">
              <span>Stride Phase</span>
              <span className="text-selection font-bold">{pose.stride_phase.toFixed(2)}</span>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Advanced Gait Controls" defaultOpen={false}>
          <div className="flex flex-col gap-3">
            {(Object.keys(gaitSliderConfig) as Array<keyof typeof gaitSliderConfig>).map((key) => {
              const config = gaitSliderConfig[key];
              return (
                <div key={key}>
                  <div className="flex justify-between text-[8px] uppercase font-bold text-mono-light">
                    <span>{config.label}</span>
                    <span className="text-selection tabular-nums">{gait[key].toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={config.min}
                    max={config.max}
                    step={config.step}
                    value={gait[key]}
                    onChange={(e) => handleGaitChange(key, e.target.value)}
                    className="w-full accent-selection bg-ridge h-1.5 appearance-none cursor-pointer rounded-full"
                  />
                </div>
              );
            })}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Structural Proportions" defaultOpen={false}>
          <p className="text-[9px] text-mono-mid italic border-b border-ridge pb-2 mb-2">
            Adjust the length and width of each body part.
          </p>
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

        <CollapsibleSection title="Joint Pivots" defaultOpen={false}>
          <div className="flex items-center justify-between border-b border-ridge pb-2 mb-2">
            <p className="text-[9px] text-mono-mid italic">Additive joint offsets.</p>
            <button
              onClick={handleResetPivots}
              className="text-[8px] px-2 py-0.5 border border-ridge rounded text-mono-mid hover:text-ink hover:border-selection font-bold uppercase"
            >
              Reset
            </button>
          </div>
          {(Object.keys(pivotOffsets) as Array<keyof WalkingEnginePivotOffsets>).sort().map((key) => (
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
          <span aria-hidden="true">·</span>
          <span style={{ color: palette.oliveCollarFill }} className="font-bold">
            Olive Collar Parent
          </span>
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
                draggingBoneKey={draggingBoneKey}
                hoveredBoneKey={hoveredBoneKey}
                onAnchorMouseDown={onAnchorMouseDown}
                onAnchorHover={setHoveredBoneKey}
                skullOverrideUrl={skullOverrideUrl}
                skullOverrideBox={skullOverrideBox}
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
