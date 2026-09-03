/**
 * Skeletal mesh structures, for `SkeletalMesh`.
 *
 * Skeletal meshes are the later, skinned model format: a bone hierarchy plus
 * per-vertex weights, rather than `Mesh`'s baked per-frame vertex positions.
 *
 * These are the engine's `FMeshExtWedge` (`Engine/Inc/UnMesh.h`), `FMeshBone`
 * (with `VJointPos` inline), `VBoneInfIndex` and `VBoneInfluence`
 * (`Engine/Inc/UnSkeletalMesh.h`), and `FCoords` (`Core/Inc/UnMath.h`), in the
 * UT 436 source release.
 *
 * PARTIALLY UNVERIFIED: every struct here is exercised by real packages
 * except `SkeletalMeshExtWedge` - `ext_wedges` is empty in all four skeletal
 * meshes available, so that one struct is transcribed but never constructed.
 */

import { type ReadContext } from "./context.ts";
import {
  readQuaternion,
  readVector,
  type Quaternion,
  type Vector,
} from "./geometry.ts";

/**
 * A wedge with full float UVs (`FMeshExtWedge`).
 *
 * The "ext" is extended precision: `LodMeshWedge` quantises UVs to a byte,
 * this does not.
 */
export interface SkeletalMeshExtWedge {
  i_vertex: number;
  flags: number;
  u: number;
  v: number;
}

export function readSkeletalMeshExtWedge({
  cursor,
}: ReadContext): SkeletalMeshExtWedge {
  return {
    i_vertex: cursor.uint16(),
    flags: cursor.uint16(),
    u: cursor.float32(),
    v: cursor.float32(),
  };
}

/**
 * A bone in the mesh's skeleton (`FMeshBone`, with its `VJointPos` reference
 * pose read inline).
 *
 * The hierarchy is flat with `parent_index` links rather than nested, and
 * `children_count` is stored rather than derived.
 */
export interface SkeletalMeshSkeleton {
  name: string;
  flags: number;
  /** The bone's reference-pose orientation. */
  orientation: Quaternion;
  /** The bone's reference-pose position. */
  position: Vector;
  /** Bone length, for the collision/debug volume. */
  length: number;
  x_size: number;
  y_size: number;
  z_size: number;
  children_count: number;
  parent_index: number;
}

export function readSkeletalMeshSkeleton(
  ctx: ReadContext,
): SkeletalMeshSkeleton {
  const { cursor, name } = ctx;

  return {
    name: name(),
    flags: cursor.uint32(),
    orientation: readQuaternion(ctx),
    position: readVector(ctx),
    length: cursor.float32(),
    x_size: cursor.float32(),
    y_size: cursor.float32(),
    z_size: cursor.float32(),
    children_count: cursor.uint32(),
    parent_index: cursor.uint32(),
  };
}

/**
 * Where a bone's vertex weights start in the mesh's weight list
 * (`VBoneInfIndex`).
 */
export interface SkeletalMeshBoneWeightIndex {
  weight_index: number;
  /** How many weights to process at full detail. */
  number: number;
  /** How many to process when capped at two influences per vertex. */
  detail_a: number;
  /** How many to process when capped at three influences per vertex. */
  detail_b: number;
}

export function readSkeletalMeshBoneWeightIndex({
  cursor,
}: ReadContext): SkeletalMeshBoneWeightIndex {
  return {
    weight_index: cursor.uint16(),
    number: cursor.uint16(),
    detail_a: cursor.uint16(),
    detail_b: cursor.uint16(),
  };
}

/** How strongly one bone influences one vertex (`VBoneInfluence`). */
export interface SkeletalMeshBoneWeight {
  /** The vertex this weight applies to. */
  point_index: number;
  /** The influence as a 0-to-1 fraction, stored as a 16-bit fixed-point value, not a float. */
  bone_weight: number;
}

export function readSkeletalMeshBoneWeight({
  cursor,
}: ReadContext): SkeletalMeshBoneWeight {
  return {
    point_index: cursor.uint16(),
    bone_weight: cursor.uint16(),
  };
}

/**
 * The coordinate frame a weapon is attached to, relative to its bone
 * (`FCoords`): an origin plus three axis vectors.
 */
export interface SkeletalMeshWeaponAdjust {
  origin: Vector;
  x_axis: Vector;
  y_axis: Vector;
  z_axis: Vector;
}

export function readSkeletalMeshWeaponAdjust(
  ctx: ReadContext,
): SkeletalMeshWeaponAdjust {
  return {
    origin: readVector(ctx),
    x_axis: readVector(ctx),
    y_axis: readVector(ctx),
    z_axis: readVector(ctx),
  };
}
