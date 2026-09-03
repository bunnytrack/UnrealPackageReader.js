/**
 * `UAnimation` - a skeletal animation set, separate from the mesh it drives.
 */

import { readStructArray } from "../structs/context.ts";
import {
  readBoneMovement,
  readBoneReference,
  readMeshAnimationSequence,
  type BoneMovement,
  type BoneReference,
  type MeshAnimationSequence,
} from "../structs/index.ts";
import type { NativeContext } from "./context.ts";

/**
 * Keyframe animation for skeletal bones, linked up by name at runtime to
 * `USkeletalMesh` skins and reference skeletons.
 */
export interface UAnimation {
  bones: BoneReference[];
  movements: BoneMovement[];
  animation_sequences: MeshAnimationSequence[];
}

export function readUAnimation(ctx: NativeContext): UAnimation {
  return {
    bones: readStructArray(ctx, readBoneReference),
    movements: readStructArray(ctx, readBoneMovement),
    animation_sequences: readStructArray(ctx, readMeshAnimationSequence),
  };
}
