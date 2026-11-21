import React from 'react';
import { Bone, BoneVariant } from './Bone';
import { ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT, RIGGING, STAGE_PALETTES } from '../constants';
import { ModelVersion, ThemeMode, WalkingEnginePose, WalkingEngineProportions, WalkingEnginePivotOffsets } from '../types';

interface MannequinProps {
  pose: WalkingEnginePose;
  pivotOffsets: Record<string, number>;
  props: WalkingEngineProportions;
  showPivots: boolean;
  showLabels: boolean;
  baseUnitH: number;
  onAnchorMouseDown: (boneKey: keyof WalkingEnginePivotOffsets, clientX: number) => void;
  onAnchorHover?: (boneKey: keyof WalkingEnginePivotOffsets | null) => void;
  draggingBoneKey: keyof WalkingEnginePivotOffsets | null;
  hoveredBoneKey?: keyof WalkingEnginePivotOffsets | null;
  isPaused: boolean;
  modelVersion: ModelVersion;
  theme: ThemeMode;
}

export const Mannequin: React.FC<MannequinProps> = ({
  pose,
  pivotOffsets,
  props,
  showPivots,
  showLabels,
  baseUnitH,
  onAnchorMouseDown,
  onAnchorHover,
  draggingBoneKey,
  hoveredBoneKey = null,
  isPaused,
  modelVersion,
  theme,
}) => {
  const palette = STAGE_PALETTES[theme];
  const isCore = modelVersion === 'core';
  const showFlourishes = isCore && theme === 'light';

  const getRotation = (partKey: keyof WalkingEnginePose, defaultVal: number = 0) => {
    const partRotation = pose[partKey] || defaultVal;
    const offset = pivotOffsets[partKey as keyof WalkingEnginePivotOffsets] || 0;
    return partRotation + offset;
  };

  const getScaledDimension = (
    rawAnatomyValue: number,
    propKey: keyof WalkingEngineProportions,
    axis: 'w' | 'h'
  ) => {
    const propScale = props[propKey]?.[axis] || 1;
    return rawAnatomyValue * baseUnitH * propScale;
  };

  const isPausedAndPivotsVisible = isPaused && showPivots;

  // Resolve silhouette fills & variants based on Core Doll vs Legacy Manikin
  const structureFill = isCore ? palette.coreStructureFill : palette.legacyFill;
  const frontLimbFill = isCore ? palette.coreFrontFill : palette.legacyFill;
  const backLimbFill = isCore ? palette.coreBackFill : palette.legacyFill;
  const baseStroke = isCore ? palette.coreStroke : palette.legacyStroke;
  const collarFill = structureFill;
  const collarStroke = baseStroke;

  const v = (coreVariant: BoneVariant, legacyVariant: BoneVariant): BoneVariant =>
    isCore ? coreVariant : legacyVariant;

  const commonStyleProps = {
    labelColor: palette.labelFill,
    axisColor: palette.axisStroke,
    anchorColor: palette.anchorRed,
    anchorRingColor: palette.anchorRing,
    flourishColor: palette.purpleFlourish,
    secondaryFlourishColor: palette.greenFlourish,
    showFlourishes,
    onAnchorHover,
    isPausedAndPivotsVisible,
    anchorRadius: isCore ? 5.5 : 5,
  };

  return (
    <g className="mannequin-root">
      {/* Root Pelvis Hub */}
      {showPivots && (
        <g data-no-export="true">
          {showFlourishes && (
            <circle
              cx="0"
              cy="0"
              r={ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.ROOT_SIZE * baseUnitH * 0.88}
              fill="none"
              stroke={palette.purpleFlourish}
              strokeWidth="1.2"
              strokeDasharray="3 3"
              opacity="0.65"
            />
          )}
          <circle
            cx="0"
            cy="0"
            r={ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.ROOT_SIZE * baseUnitH * 0.65}
            fill={palette.rootFill}
            stroke={isCore ? palette.purpleFlourish : baseStroke}
            strokeWidth="1.2"
          />
        </g>
      )}

      {/* Main Axial Spine: Waist -> Torso -> Olive Collar -> (Head + L.Arm + R.Arm) */}
      <Bone
        rotation={getRotation('waist')}
        length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.WAIST, 'waist', 'h')}
        width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.WAIST_WIDTH, 'waist', 'w')}
        variant={v('waist-sculpted', 'waist-teardrop-pointy-up')}
        drawsUpwards
        showPivots={showPivots}
        visible={true}
        fillColor={structureFill}
        strokeColor={baseStroke}
        showLabel={showLabels}
        label="Waist"
        boneKey="waist"
        proportionKey="waist"
        onAnchorMouseDown={onAnchorMouseDown}
        isBeingDragged={draggingBoneKey === 'waist'}
        isHovered={hoveredBoneKey === 'waist'}
        {...commonStyleProps}
      >
        <Bone
          rotation={getRotation('torso')}
          length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.TORSO, 'torso', 'h')}
          width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.TORSO_WIDTH, 'torso', 'w')}
          variant={v('torso-sculpted', 'torso-teardrop-pointy-down')}
          drawsUpwards
          showPivots={showPivots}
          visible={true}
          fillColor={structureFill}
          strokeColor={baseStroke}
          showLabel={showLabels}
          label="Torso"
          boneKey="torso"
          proportionKey="torso"
          onAnchorMouseDown={onAnchorMouseDown}
          isBeingDragged={draggingBoneKey === 'torso'}
          isHovered={hoveredBoneKey === 'torso'}
          {...commonStyleProps}
        >
          {/* OLIVE COLLAR: Parent to Head, R.Arm, and L.Arm */}
          <Bone
            rotation={getRotation('collar')}
            length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.COLLAR, 'collar', 'h')}
            width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.COLLAR_WIDTH, 'collar', 'w')}
            variant={v('collar-olive-yoke', 'collar-horizontal-oval-shape')}
            drawsUpwards
            showPivots={showPivots}
            visible={true}
            offset={RIGGING.COLLAR_OFFSET_Y !== 0 ? { x: 0, y: RIGGING.COLLAR_OFFSET_Y * baseUnitH } : undefined}
            fillColor={collarFill}
            strokeColor={collarStroke}
            showLabel={showLabels}
            label="Collar"
            boneKey="collar"
            proportionKey="collar"
            onAnchorMouseDown={onAnchorMouseDown}
            isBeingDragged={draggingBoneKey === 'collar'}
            isHovered={hoveredBoneKey === 'collar'}
            {...commonStyleProps}
          >
            {/* HEAD (Child of Olive Collar) */}
            <Bone
              rotation={getRotation('neck')}
              length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.HEAD, 'head', 'h')}
              width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.HEAD_WIDTH, 'head', 'w')}
              variant={v('head-flattened-wedge', 'head-tall-oval')}
              drawsUpwards
              showPivots={showPivots}
              visible={true}
              offset={{ x: 0, y: -ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.HEAD_NECK_GAP_OFFSET * baseUnitH }}
              fillColor={frontLimbFill}
              strokeColor={baseStroke}
              showLabel={showLabels}
              label="Head"
              boneKey="neck"
              proportionKey="head"
              onAnchorMouseDown={onAnchorMouseDown}
              isBeingDragged={draggingBoneKey === 'neck'}
              isHovered={hoveredBoneKey === 'neck'}
              {...commonStyleProps}
            />

            {/* RIGHT ARM (Child of Olive Collar) */}
            <g
              transform={`translate(${RIGGING.R_SHOULDER_X_OFFSET_FROM_COLLAR_CENTER * baseUnitH}, ${
                RIGGING.SHOULDER_Y_OFFSET_FROM_COLLAR_END * baseUnitH
              })`}
            >
              <Bone
                rotation={getRotation('r_shoulder')}
                length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.UPPER_ARM, 'r_upper_arm', 'h')}
                width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LIMB_WIDTH_ARM, 'r_upper_arm', 'w')}
                variant={v('deltoid-sculpted', 'deltoid-shape')}
                showPivots={showPivots}
                visible={true}
                fillColor={frontLimbFill}
                strokeColor={baseStroke}
                showLabel={showLabels}
                label="R.Bicep"
                boneKey="r_shoulder"
                proportionKey="r_upper_arm"
                onAnchorMouseDown={onAnchorMouseDown}
                isBeingDragged={draggingBoneKey === 'r_shoulder'}
                isHovered={hoveredBoneKey === 'r_shoulder'}
                {...commonStyleProps}
              >
                <Bone
                  rotation={getRotation('r_elbow')}
                  length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LOWER_ARM, 'r_lower_arm', 'h')}
                  width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LIMB_WIDTH_FOREARM, 'r_lower_arm', 'w')}
                  variant={v('limb-sculpted', 'limb-tapered')}
                  showPivots={showPivots}
                  visible={true}
                  fillColor={frontLimbFill}
                  strokeColor={baseStroke}
                  showLabel={showLabels}
                  label="R.Forearm"
                  boneKey="r_elbow"
                  proportionKey="r_lower_arm"
                  onAnchorMouseDown={onAnchorMouseDown}
                  isBeingDragged={draggingBoneKey === 'r_elbow'}
                  isHovered={hoveredBoneKey === 'r_elbow'}
                  {...commonStyleProps}
                >
                  <Bone
                    rotation={getRotation('r_hand')}
                    length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.HAND, 'r_hand', 'h')}
                    width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.HAND_WIDTH, 'r_hand', 'w')}
                    variant={v('arrowhead-thin-base', 'hand-foot-arrowhead-shape')}
                    showPivots={showPivots}
                    visible={true}
                    fillColor={frontLimbFill}
                    strokeColor={baseStroke}
                    showLabel={showLabels}
                    label="R.Hand"
                    boneKey="r_hand"
                    proportionKey="r_hand"
                    onAnchorMouseDown={onAnchorMouseDown}
                    isBeingDragged={draggingBoneKey === 'r_hand'}
                    isHovered={hoveredBoneKey === 'r_hand'}
                    {...commonStyleProps}
                  />
                </Bone>
              </Bone>
            </g>

            {/* LEFT ARM (Child of Olive Collar) */}
            <g
              transform={`translate(${RIGGING.L_SHOULDER_X_OFFSET_FROM_COLLAR_CENTER * baseUnitH}, ${
                RIGGING.SHOULDER_Y_OFFSET_FROM_COLLAR_END * baseUnitH
              })`}
            >
              <Bone
                rotation={getRotation('l_shoulder')}
                length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.UPPER_ARM, 'l_upper_arm', 'h')}
                width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LIMB_WIDTH_ARM, 'l_upper_arm', 'w')}
                variant={v('deltoid-sculpted', 'deltoid-shape')}
                showPivots={showPivots}
                visible={true}
                fillColor={backLimbFill}
                strokeColor={baseStroke}
                showLabel={showLabels}
                label="L.Bicep"
                boneKey="l_shoulder"
                proportionKey="l_upper_arm"
                onAnchorMouseDown={onAnchorMouseDown}
                isBeingDragged={draggingBoneKey === 'l_shoulder'}
                isHovered={hoveredBoneKey === 'l_shoulder'}
                {...commonStyleProps}
              >
                <Bone
                  rotation={getRotation('l_elbow')}
                  length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LOWER_ARM, 'l_lower_arm', 'h')}
                  width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LIMB_WIDTH_FOREARM, 'l_lower_arm', 'w')}
                  variant={v('limb-sculpted', 'limb-tapered')}
                  showPivots={showPivots}
                  visible={true}
                  fillColor={backLimbFill}
                  strokeColor={baseStroke}
                  showLabel={showLabels}
                  label="L.Forearm"
                  boneKey="l_elbow"
                  proportionKey="l_lower_arm"
                  onAnchorMouseDown={onAnchorMouseDown}
                  isBeingDragged={draggingBoneKey === 'l_elbow'}
                  isHovered={hoveredBoneKey === 'l_elbow'}
                  {...commonStyleProps}
                >
                  <Bone
                    rotation={getRotation('l_hand')}
                    length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.HAND, 'l_hand', 'h')}
                    width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.HAND_WIDTH, 'l_hand', 'w')}
                    variant={v('arrowhead-thin-base', 'hand-foot-arrowhead-shape')}
                    showPivots={showPivots}
                    visible={true}
                    fillColor={backLimbFill}
                    strokeColor={baseStroke}
                    showLabel={showLabels}
                    label="L.Hand"
                    boneKey="l_hand"
                    proportionKey="l_hand"
                    onAnchorMouseDown={onAnchorMouseDown}
                    isBeingDragged={draggingBoneKey === 'l_hand'}
                    isHovered={hoveredBoneKey === 'l_hand'}
                    {...commonStyleProps}
                  />
                </Bone>
              </Bone>
            </g>
          </Bone>
        </Bone>
      </Bone>

      {/* LEFT LEG (Background depth layer in Core Doll) */}
      <g>
        <Bone
          rotation={getRotation('l_hip')}
          length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LEG_UPPER, 'l_upper_leg', 'h')}
          width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LIMB_WIDTH_THIGH, 'l_upper_leg', 'w')}
          variant={v('limb-sculpted', 'limb-tapered')}
          showPivots={showPivots}
          visible={true}
          fillColor={backLimbFill}
          strokeColor={baseStroke}
          showLabel={showLabels}
          label="L.Thigh"
          boneKey="l_hip"
          proportionKey="l_upper_leg"
          onAnchorMouseDown={onAnchorMouseDown}
          isBeingDragged={draggingBoneKey === 'l_hip'}
          isHovered={hoveredBoneKey === 'l_hip'}
          {...commonStyleProps}
        >
          <Bone
            rotation={getRotation('l_knee')}
            length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LEG_LOWER, 'l_lower_leg', 'h')}
            width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LIMB_WIDTH_CALF, 'l_lower_leg', 'w')}
            variant={v('limb-sculpted', 'limb-tapered')}
            showPivots={showPivots}
            visible={true}
            fillColor={backLimbFill}
            strokeColor={baseStroke}
            showLabel={showLabels}
            label="L.Calf"
            boneKey="l_knee"
            proportionKey="l_lower_leg"
            onAnchorMouseDown={onAnchorMouseDown}
            isBeingDragged={draggingBoneKey === 'l_knee'}
            isHovered={hoveredBoneKey === 'l_knee'}
            {...commonStyleProps}
          >
            <Bone
              rotation={getRotation('l_foot')}
              length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.FOOT, 'l_foot', 'h')}
              width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.FOOT_WIDTH, 'l_foot', 'w')}
              variant={v('foot-sole-block', 'foot-block-shape')}
              showPivots={showPivots}
              visible={true}
              fillColor={backLimbFill}
              strokeColor={baseStroke}
              showLabel={showLabels}
              label="L.Foot"
              boneKey="l_foot"
              proportionKey="l_foot"
              onAnchorMouseDown={onAnchorMouseDown}
              isBeingDragged={draggingBoneKey === 'l_foot'}
              isHovered={hoveredBoneKey === 'l_foot'}
              {...commonStyleProps}
            >
              <Bone
                rotation={getRotation('l_toe')}
                length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.TOE, 'l_toe', 'h')}
                width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.TOE_WIDTH, 'l_toe', 'w')}
                variant={v('arrowhead-thin-base', 'hand-foot-arrowhead-shape')}
                showPivots={showPivots}
                visible={true}
                fillColor={backLimbFill}
                strokeColor={baseStroke}
                showLabel={showLabels}
                label="L.Toe"
                boneKey="l_toe"
                proportionKey="l_toe"
                onAnchorMouseDown={onAnchorMouseDown}
                isBeingDragged={draggingBoneKey === 'l_toe'}
                isHovered={hoveredBoneKey === 'l_toe'}
                {...commonStyleProps}
              />
            </Bone>
          </Bone>
        </Bone>
      </g>

      {/* RIGHT LEG (Foreground depth layer in Core Doll) */}
      <g>
        <Bone
          rotation={getRotation('r_hip')}
          length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LEG_UPPER, 'r_upper_leg', 'h')}
          width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LIMB_WIDTH_THIGH, 'r_upper_leg', 'w')}
          variant={v('limb-sculpted', 'limb-tapered')}
          showPivots={showPivots}
          visible={true}
          fillColor={frontLimbFill}
          strokeColor={baseStroke}
          showLabel={showLabels}
          label="R.Thigh"
          boneKey="r_hip"
          proportionKey="r_upper_leg"
          onAnchorMouseDown={onAnchorMouseDown}
          isBeingDragged={draggingBoneKey === 'r_hip'}
          isHovered={hoveredBoneKey === 'r_hip'}
          {...commonStyleProps}
        >
          <Bone
            rotation={getRotation('r_knee')}
            length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LEG_LOWER, 'r_lower_leg', 'h')}
            width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.LIMB_WIDTH_CALF, 'r_lower_leg', 'w')}
            variant={v('limb-sculpted', 'limb-tapered')}
            showPivots={showPivots}
            visible={true}
            fillColor={frontLimbFill}
            strokeColor={baseStroke}
            showLabel={showLabels}
            label="R.Calf"
            boneKey="r_knee"
            proportionKey="r_lower_leg"
            onAnchorMouseDown={onAnchorMouseDown}
            isBeingDragged={draggingBoneKey === 'r_knee'}
            isHovered={hoveredBoneKey === 'r_knee'}
            {...commonStyleProps}
          >
            <Bone
              rotation={getRotation('r_foot')}
              length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.FOOT, 'r_foot', 'h')}
              width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.FOOT_WIDTH, 'r_foot', 'w')}
              variant={v('foot-sole-block', 'foot-block-shape')}
              showPivots={showPivots}
              visible={true}
              fillColor={frontLimbFill}
              strokeColor={baseStroke}
              showLabel={showLabels}
              label="R.Foot"
              boneKey="r_foot"
              proportionKey="r_foot"
              onAnchorMouseDown={onAnchorMouseDown}
              isBeingDragged={draggingBoneKey === 'r_foot'}
              isHovered={hoveredBoneKey === 'r_foot'}
              {...commonStyleProps}
            >
              <Bone
                rotation={getRotation('r_toe')}
                length={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.TOE, 'r_toe', 'h')}
                width={getScaledDimension(ANATOMY_RAW_RELATIVE_TO_BASE_HEAD_UNIT.TOE_WIDTH, 'r_toe', 'w')}
                variant={v('arrowhead-thin-base', 'hand-foot-arrowhead-shape')}
                showPivots={showPivots}
                visible={true}
                fillColor={frontLimbFill}
                strokeColor={baseStroke}
                showLabel={showLabels}
                label="R.Toe"
                boneKey="r_toe"
                proportionKey="r_toe"
                onAnchorMouseDown={onAnchorMouseDown}
                isBeingDragged={draggingBoneKey === 'r_toe'}
                isHovered={hoveredBoneKey === 'r_toe'}
                {...commonStyleProps}
              />
            </Bone>
          </Bone>
        </Bone>
      </g>
    </g>
  );
};
