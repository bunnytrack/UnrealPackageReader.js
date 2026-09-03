/**
 * Rune's skeletal model structures, for `SkelModel`.
 *
 * Rune shipped on a licensee fork of the engine and added its own model format
 * alongside the stock ones, hence the `R` prefix.
 */

import { readStructArray, type ReadContext } from "./context.ts";
import {
  readBoundingBox,
  readPlane,
  readRotator,
  readScale,
  readVector,
  type BoundingBox,
  type Plane,
  type Rotator,
  type Scale,
  type Vector,
} from "./geometry.ts";
import {
  readMeshAnimationSequence,
  type MeshAnimationSequence,
} from "./mesh.ts";

/** How many polygroups an `RMesh` always stores, populated or not. */
const NUM_POLYGROUPS = 16;

/** How many children a joint can have. */
const MAX_CHILD_JOINTS = 4;

/** How many bounding planes a joint stores. */
const NUM_JOINT_PLANES = 6;

/** A textured triangle, with signed indices and UVs unlike `MeshTriangle`. */
export interface RTriangle {
  vertex_index_1: number;
  vertex_index_2: number;
  vertex_index_3: number;
  vertex_1_u: number;
  vertex_1_v: number;
  vertex_2_u: number;
  vertex_2_v: number;
  vertex_3_u: number;
  vertex_3_v: number;
  polygroup: number;
}

export function readRTriangle({ cursor }: ReadContext): RTriangle {
  return {
    vertex_index_1: cursor.int16(),
    vertex_index_2: cursor.int16(),
    vertex_index_3: cursor.int16(),
    vertex_1_u: cursor.int8(),
    vertex_1_v: cursor.int8(),
    vertex_2_u: cursor.int8(),
    vertex_2_v: cursor.int8(),
    vertex_3_u: cursor.int8(),
    vertex_3_v: cursor.int8(),
    polygroup: cursor.int8(),
  };
}

/**
 * A vertex weighted between two joints.
 *
 * Two positions and one weight: the vertex is interpolated between its pose in
 * each joint's frame, so `weight1` implies the second weight.
 */
export interface RVertex {
  point1: Vector;
  point2: Vector;
  joint1: number;
  joint2: number;
  weight1: number;
}

export function readRVertex(ctx: ReadContext): RVertex {
  const { cursor } = ctx;

  return {
    point1: readVector(ctx),
    point2: readVector(ctx),
    joint1: cursor.int32(),
    joint2: cursor.int32(),
    weight1: cursor.float32(),
  };
}

/**
 * One mesh of a skeletal model.
 *
 * `group_flags` and `poly_group_skin_names` are fixed 16-entry arrays, and the
 * file interleaves them - a flag then a name, sixteen times - rather than
 * storing one array after the other.
 */
export interface RMesh {
  num_verts: number;
  num_tris: number;
  triangles: RTriangle[];
  vertices: RVertex[];
  dec_count: number;
  dec: number[];
  group_flags: number[];
  poly_group_skin_names: string[];
}

export function readRMesh(ctx: ReadContext): RMesh {
  const { cursor, name } = ctx;

  const mesh: RMesh = {
    num_verts: cursor.int32(),
    num_tris: cursor.int32(),
    triangles: readStructArray(ctx, readRTriangle),
    vertices: readStructArray(ctx, readRVertex),
    dec_count: cursor.int32(),
    dec: readStructArray(ctx, ({ cursor }) => cursor.int8()),
    group_flags: new Array(NUM_POLYGROUPS),
    poly_group_skin_names: new Array(NUM_POLYGROUPS),
  };

  for (let i = 0; i < NUM_POLYGROUPS; i++) {
    mesh.group_flags[i] = cursor.int32();
    mesh.poly_group_skin_names[i] = name();
  }

  return mesh;
}

/** A joint in a skeletal model's hierarchy. */
export interface RJoint {
  parent: number;
  /** Always four entries; unused slots are present in the file. */
  children: number[];
  name: string;
  jointgroup: number;
  flags: number;
  baserot: Rotator;
  /** Always six entries - the joint's bounding planes. */
  planes: Plane[];
}

export function readRJoint(ctx: ReadContext): RJoint {
  const { cursor, name } = ctx;

  return {
    parent: cursor.int32(),
    children: readStructArray(
      ctx,
      ({ cursor }) => cursor.int32(),
      MAX_CHILD_JOINTS,
    ),
    name: name(),
    jointgroup: cursor.int32(),
    flags: cursor.int32(),
    baserot: readRotator(ctx),
    planes: readStructArray(ctx, readPlane, NUM_JOINT_PLANES),
  };
}

/**
 * An animation sequence with Rune's compressed joint data appended.
 *
 * Extends `MeshAnimationSequence`, so the stock fields come first and in their
 * original order.
 */
export interface RSkelAnimSeq extends MeshAnimationSequence {
  anim_data: number[];
}

export function readRSkelAnimSeq(ctx: ReadContext): RSkelAnimSeq {
  return {
    ...readMeshAnimationSequence(ctx),
    anim_data: readStructArray(ctx, ({ cursor }) => cursor.int8()),
  };
}

/** A joint's pose at one keyframe. */
export interface JointState {
  pos: Vector;
  rot: Rotator;
  scale: Scale;
}

export function readJointState(ctx: ReadContext): JointState {
  return {
    pos: readVector(ctx),
    rot: readRotator(ctx),
    scale: readScale(ctx),
  };
}

/** One frame of a skeletal model's animation: every joint's pose at that time. */
export interface RAnimFrame {
  sequence_id: number;
  event: string;
  bounds: BoundingBox;
  joint_anim: JointState[];
}

export function readRAnimFrame(ctx: ReadContext): RAnimFrame {
  const { cursor, name } = ctx;

  return {
    sequence_id: cursor.int16(),
    event: name(),
    bounds: readBoundingBox(ctx),
    joint_anim: readStructArray(ctx, readJointState),
  };
}
