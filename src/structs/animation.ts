/**
 * Skeletal animation structures, for `Animation`.
 *
 * An `Animation` object is keyframe data for a bone hierarchy, stored
 * independently of the mesh it drives so one set of animations can be shared
 * between meshes with matching skeletons.
 *
 * These are the engine's `FNamedBone`, `AnalogTrack` and `MotionChunk`
 * (`Engine/Inc/UnSkeletalMesh.h` in the UT 436 source release).
 */

import { readStructArray, type ReadContext } from "./context.ts";
import {
  readQuaternion,
  readVector,
  type Quaternion,
  type Vector,
} from "./geometry.ts";

/** A named bone (`FNamedBone`), as referenced by an animation rather than by a mesh. */
export interface BoneReference {
  name: string;
  flags: number;
  parent_index: number;
}

export function readBoneReference({
  cursor,
  name,
}: ReadContext): BoneReference {
  return {
    name: name(),
    flags: cursor.uint32(),
    parent_index: cursor.uint32(),
  };
}

/**
 * Keyframes for one bone (`AnalogTrack`): separate orientation, position and
 * timing key lists.
 *
 * The three lists are independently lengthed. The engine notes that either the
 * orientation or the position track may be empty, to mean the bone does not
 * move that way, so the lengths need not match.
 */
export interface AnimationTrack {
  flags: number;
  key_quaternions: Quaternion[];
  key_positions: Vector[];
  key_time: number[];
}

export function readAnimationTrack(ctx: ReadContext): AnimationTrack {
  const { cursor } = ctx;

  return {
    flags: cursor.uint32(),
    key_quaternions: readStructArray(ctx, readQuaternion),
    key_positions: readStructArray(ctx, readVector),
    key_time: readStructArray(ctx, ({ cursor }) => cursor.float32()),
  };
}

/**
 * One animation sequence's movement across a bone hierarchy (`MotionChunk`):
 * one `animation_tracks` entry per bone.
 *
 * `root_track` is stored separately from `animation_tracks` because root motion
 * is applied to the actor rather than to a bone.
 */
export interface BoneMovement {
  root_speed_3d: Vector;
  track_time: number;
  start_bone: number;
  flags: number;
  bones: number[];
  animation_tracks: AnimationTrack[];
  root_track: AnimationTrack;
}

export function readBoneMovement(ctx: ReadContext): BoneMovement {
  const { cursor } = ctx;

  return {
    root_speed_3d: readVector(ctx),
    track_time: cursor.float32(),
    start_bone: cursor.uint32(),
    flags: cursor.uint32(),
    bones: readStructArray(ctx, ({ cursor }) => cursor.uint32()),
    animation_tracks: readStructArray(ctx, readAnimationTrack),
    root_track: readAnimationTrack(ctx),
  };
}
