import { PartName, Pose, JointLimits, WalkingEnginePivotOffsets, ThemeMode } from './types';

export const SCALE_FACTOR = 1;
export const BASE_HEAD_UNIT = 50;

export const ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT = {
  HEAD: 2.2,
  HEAD_WIDTH: 1.55,
  HEAD_NECK_GAP_OFFSET: 0.1,
  COLLAR: 0.42,
  COLLAR_WIDTH: 1.95,
  TORSO: 1.7,
  TORSO_WIDTH: 1.15,
  WAIST: 1.55,
  WAIST_WIDTH: 1.02,
  UPPER_ARM: 1.86,
  LOWER_ARM: 1.95,
  HAND: 1.2,
  LEG_UPPER: 3.05,
  LEG_LOWER: 2.65,
  FOOT: 0.82,
  TOE: 0.42,
  SHOULDER_WIDTH: 2.04,
  HIP_WIDTH: 1.0,
  ROOT_SIZE: 0.28,
  LIMB_WIDTH_ARM: 0.25,
  LIMB_WIDTH_FOREARM: 0.2,
  LIMB_WIDTH_THIGH: 0.42,
  LIMB_WIDTH_CALF: 0.32,
  HAND_WIDTH: 0.26,
  FOOT_WIDTH: 0.28,
  TOE_WIDTH: 0.24,
  EFFECTOR_WIDTH: 0.16,
};

export const RIGGING = {
  L_SHOULDER_X_OFFSET_FROM_COLLAR_CENTER: -1.02,
  R_SHOULDER_X_OFFSET_FROM_COLLAR_CENTER: 1.02,
  SHOULDER_Y_OFFSET_FROM_COLLAR_END: ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.COLLAR,
  COLLAR_OFFSET_Y: ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.COLLAR * 0.15,
};

export const MANNEQUIN_LOCAL_FLOOR_Y =
  ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LEG_UPPER +
  ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LEG_LOWER +
  ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.FOOT_WIDTH * 0.5;

export const GROUND_STRIP_HEIGHT_RAW_H_UNIT = 0.4;
export const GROUND_STRIP_COLOR = '#252525';

export const CORE_DEFAULT_PIVOT_OFFSETS: WalkingEnginePivotOffsets = {
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
};

export const LEGACY_DEFAULT_PIVOT_OFFSETS: WalkingEnginePivotOffsets = {
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
  l_foot: -89,
  r_foot: -89,
  l_toe: 12,
  r_toe: 10,
};

export interface StageThemePalette {
  canvasBg: string;
  gridStroke: string;
  scanlineStroke: string;
  guideStroke: string;
  groundStripFill: string;
  groundLineStroke: string;
  purpleFlourish: string;
  greenFlourish: string;
  anchorRed: string;
  anchorRing: string;
  coreFrontFill: string;
  coreBackFill: string;
  coreStructureFill: string;
  coreStroke: string;
  oliveCollarFill: string;
  oliveCollarStroke: string;
  legacyFill: string;
  legacyStroke: string;
  labelFill: string;
  axisStroke: string;
  rootFill: string;
}

export const STAGE_PALETTES: Record<ThemeMode, StageThemePalette> = {
  light: {
    canvasBg: '#F6FCF7',
    gridStroke: 'rgba(5, 150, 105, 0.05)',
    scanlineStroke: '#E4F0E7',
    guideStroke: 'rgba(109, 40, 217, 0.14)',
    groundStripFill: 'rgba(5, 150, 105, 0.06)',
    groundLineStroke: '#059669',
    purpleFlourish: '#7C3AED',
    greenFlourish: '#059669',
    anchorRed: '#E11D48',
    anchorRing: '#FFFFFF',
    coreFrontFill: '#1A1E28',
    coreBackFill: '#4D566A',
    coreStructureFill: '#232836',
    coreStroke: '#0F1218',
    oliveCollarFill: '#5B6D34',
    oliveCollarStroke: '#38461E',
    legacyFill: '#000000',
    legacyStroke: '#333333',
    labelFill: '#3F5447',
    axisStroke: 'rgba(124, 58, 237, 0.25)',
    rootFill: '#EDE9FE',
  },
  dark: {
    canvasBg: '#0B0D12',
    gridStroke: 'rgba(148, 163, 184, 0.08)',
    scanlineStroke: '#1E2433',
    guideStroke: 'rgba(148, 163, 184, 0.16)',
    groundStripFill: 'rgba(30, 41, 59, 0.55)',
    groundLineStroke: '#475569',
    purpleFlourish: '#A78BFA',
    greenFlourish: '#34D399',
    anchorRed: '#F87171',
    anchorRing: '#0B0D12',
    coreFrontFill: '#E2E8F0',
    coreBackFill: '#7D8B9F',
    coreStructureFill: '#CBD5E1',
    coreStroke: '#475569',
    oliveCollarFill: '#6E8340',
    oliveCollarStroke: '#9AB362',
    legacyFill: '#E5E7EB',
    legacyStroke: '#475569',
    labelFill: '#94A3B8',
    axisStroke: 'rgba(226, 232, 240, 0.25)',
    rootFill: '#1E2433',
  },
};

type RotationValues = Omit<Pose, 'root' | 'offsets'>;

export const BASE_ROTATIONS: RotationValues = {
  bodyRotation: 0,
  torso: 0,
  waist: 0,
  collar: 0,
  head: 0,
  lShoulder: 0,
  lForearm: 0,
  lWrist: 0,
  rShoulder: 0,
  rForearm: 0,
  rWrist: 0,
  lThigh: 0,
  lCalf: 0,
  lAnkle: 0,
  rThigh: 0,
  rCalf: 0,
  rAnkle: 0,
};

export const RESET_POSE: Pose = {
  root: { x: 0, y: 0 },
  ...BASE_ROTATIONS,
  offsets: {
    [PartName.Collar]: { x: 0, y: RIGGING.COLLAR_OFFSET_Y }
  },
};

export const JOINT_LIMITS: JointLimits = {
  [PartName.Waist]: { min: -180, max: 180 },
  [PartName.Torso]: { min: -180, max: 180 },
  [PartName.Collar]: { min: -180, max: 180 },
  [PartName.Head]: { min: -180, max: 180 },
  [PartName.RShoulder]: { min: -180, max: 180 },
  rForearm: { min: -180, max: 180 },
  [PartName.RWrist]: { min: -180, max: 180 },
  [PartName.LShoulder]: { min: -180, max: 180 },
  lForearm: { min: -180, max: 180 },
  [PartName.LWrist]: { min: -180, max: 180 },
  [PartName.RThigh]: { min: -180, max: 180 },
  rCalf: { min: -180, max: 180 },
  [PartName.RAnkle]: { min: -180, max: 180 },
  [PartName.LThigh]: { min: -180, max: 180 },
  lCalf: { min: -180, max: 180 },
  lAnkle: { min: -180, max: 180 },
};