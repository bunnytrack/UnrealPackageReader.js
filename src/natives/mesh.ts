/**
 * The mesh family: `UMesh` (vertex animation), `ULodMesh` (with level of
 * detail), `USkeletalMesh` (bones), and Rune's unrelated `USkelModel`.
 *
 * The `*_jump` fields are byte offsets the engine uses to skip a block it does
 * not need to load; a reader that reads everything can ignore their values but
 * must consume them.
 */

import { readArray } from "../io/cursor.ts";
import { readStructArray } from "../structs/context.ts";
import {
  readBoundingBox,
  readBoundingSphere,
  readLodMeshFace,
  readLodMeshMaterial,
  readLodMeshWedge,
  readMeshAnimationSequence,
  readMeshConnection,
  readMeshTriangle,
  readMeshVertex,
  readRAnimFrame,
  readRJoint,
  readRMesh,
  readRotator,
  readRSkelAnimSeq,
  readSkeletalMeshBoneWeight,
  readSkeletalMeshBoneWeightIndex,
  readSkeletalMeshExtWedge,
  readSkeletalMeshSkeleton,
  readSkeletalMeshWeaponAdjust,
  readVector,
  type BoundingBox,
  type BoundingSphere,
  type LodMeshFace,
  type LodMeshMaterial,
  type LodMeshWedge,
  type MeshAnimationSequence,
  type MeshConnection,
  type MeshTriangle,
  type MeshVertex,
  type RAnimFrame,
  type RJoint,
  type RMesh,
  type Rotator,
  type RSkelAnimSeq,
  type SkeletalMeshBoneWeight,
  type SkeletalMeshBoneWeightIndex,
  type SkeletalMeshExtWedge,
  type SkeletalMeshSkeleton,
  type SkeletalMeshWeaponAdjust,
  type Vector,
} from "../structs/index.ts";
import {
  readObjectRef,
  readObjectRefs,
  type NativeContext,
  type ObjectRef,
} from "./context.ts";
import { readUPrimitive, type UPrimitive } from "./primitive.ts";

/**
 * A complete 3D object - a creature, a weapon - with its animation sequences,
 * every vertex position stored per frame.
 */
export interface UMesh extends UPrimitive {
  vertices_jump?: number;
  vertices: MeshVertex[];
  triangles_jump?: number;
  triangles: MeshTriangle[];
  anim_sequences: MeshAnimationSequence[];
  connects_jump: number;
  connections: MeshConnection[];
  bounding_box_2: BoundingBox;
  bounding_sphere_2: BoundingSphere;
  vert_links_jump: number;
  vert_links: number[];
  textures: ObjectRef[];
  bounding_boxes: BoundingBox[];
  /** Per-frame bounding spheres. Marked "currently broken" in the engine header. */
  bounding_spheres: BoundingSphere[];
  frame_verts: number;
  anim_frames: number;
  flags_AND: number;
  flags_OR: number;
  /** Mesh scaling. */
  scale: Vector;
  /** Origin in the original coordinate system. */
  origin: Vector;
  /** Amount to rotate when importing (mostly for yawing). */
  rotation_origin: Rotator;
  /** Index of the selected polygon - editor state. */
  cur_poly: number;
  /** Index of the selected vertex - editor state. */
  cur_vertex: number;
  texture_lod?: number[];
}

/**
 * `texture_lod` arrived at version 65 as a single value and became an array at
 * 66. Neither the v65 side nor the v61 `*_jump` side is reached by any
 * available package.
 */
export function readUMesh(ctx: NativeContext): UMesh {
  const { cursor, version } = ctx;

  return {
    ...readUPrimitive(ctx),
    ...(version > 61 ? { vertices_jump: cursor.uint32() } : {}),
    vertices: readStructArray(ctx, readMeshVertex),
    ...(version > 61 ? { triangles_jump: cursor.uint32() } : {}),
    triangles: readStructArray(ctx, readMeshTriangle),
    anim_sequences: readStructArray(ctx, readMeshAnimationSequence),
    connects_jump: cursor.uint32(),
    connections: readStructArray(ctx, readMeshConnection),
    bounding_box_2: readBoundingBox(ctx),
    bounding_sphere_2: readBoundingSphere(ctx),
    vert_links_jump: cursor.uint32(),
    vert_links: readArray(cursor, () => cursor.uint32()),
    textures: readObjectRefs(ctx, cursor.compactIndex()),
    bounding_boxes: readStructArray(ctx, readBoundingBox),
    bounding_spheres: readStructArray(ctx, readBoundingSphere),
    frame_verts: cursor.uint32(),
    anim_frames: cursor.uint32(),
    flags_AND: cursor.uint32(),
    flags_OR: cursor.uint32(),
    scale: readVector(ctx),
    origin: readVector(ctx),
    rotation_origin: readRotator(ctx),
    cur_poly: cursor.uint32(),
    cur_vertex: cursor.uint32(),
    ...(version === 65
      ? { texture_lod: readArray(cursor, () => cursor.float32(), 1) }
      : version >= 66
        ? { texture_lod: readArray(cursor, () => cursor.float32()) }
        : {}),
  };
}

/**
 * A `UMesh` with the wedge/face indirection that lets the renderer collapse
 * detail.
 */
export interface ULodMesh extends UMesh {
  /** LOD-collapse single-linked list for points. */
  collapse_point_thus: number[];
  /** Minimum LOD level at which each face is drawn. */
  face_level: number[];
  faces: LodMeshFace[];
  /** LOD-collapse single-linked list for wedges. */
  collapse_wedge_thus: number[];
  /**
   * Vertices split at UV seams (see `LodMeshWedge`). The engine calls
   * these "Hoppe-style", after Hugues Hoppe, whose progressive-mesh work the
   * LOD-collapse scheme is based on.
   */
  wedges: LodMeshWedge[];
  materials: LodMeshMaterial[];
  /** Invisible special-coordinate faces. */
  special_faces: LodMeshFace[];
  /** Number of visible vertices. */
  model_vertices: number;
  /** Number of invisible (special attachment) vertices. */
  special_vertices: number;
  /** Max of the x/y/z mesh scale, for LOD gauging (on top of drawscale). */
  mesh_scale_max: number;
  /** Controls the delay and morphing when the LOD level changes. */
  lod_hysteresis: number;
  /** Scales the (not necessarily linear) falloff of vertices with distance. */
  lod_strength: number;
  /** Minimum number of vertices to draw the model with. */
  lod_min_verts: number;
  /** Above 0 allows morphing; 0 to 1 is the range of vertices to morph. */
  lod_morph: number;
  /** Z displacement for tweaking LOD's distance dependency. */
  lod_z_displace: number;
  remap_anim_vertices: number[];
  /** A possibly-different older per-frame vertex count. */
  old_frame_verts: number;
}

export function readULodMesh(ctx: NativeContext): ULodMesh {
  const { cursor } = ctx;

  return {
    ...readUMesh(ctx),
    collapse_point_thus: readArray(cursor, () => cursor.uint16()),
    face_level: readArray(cursor, () => cursor.uint16()),
    faces: readStructArray(ctx, readLodMeshFace),
    collapse_wedge_thus: readArray(cursor, () => cursor.uint16()),
    wedges: readStructArray(ctx, readLodMeshWedge),
    materials: readStructArray(ctx, readLodMeshMaterial),
    special_faces: readStructArray(ctx, readLodMeshFace),
    model_vertices: cursor.uint32(),
    special_vertices: cursor.uint32(),
    mesh_scale_max: cursor.float32(),
    lod_hysteresis: cursor.float32(),
    lod_strength: cursor.float32(),
    lod_min_verts: cursor.uint32(),
    lod_morph: cursor.float32(),
    lod_z_displace: cursor.float32(),
    remap_anim_vertices: readArray(cursor, () => cursor.uint16()),
    old_frame_verts: cursor.uint32(),
  };
}

/**
 * A `ULodMesh` skinned to a bone hierarchy with per-vertex weights, animated
 * by a separate `UAnimation` object.
 */
export interface USkeletalMesh extends ULodMesh {
  ext_wedges: SkeletalMeshExtWedge[];
  /** The skin's vertex 3D points, as floats. */
  points: Vector[];
  /** The reference skeleton - one entry per bone. */
  skeletons: SkeletalMeshSkeleton[];
  bone_weight_indices: SkeletalMeshBoneWeightIndex[];
  bone_weights: SkeletalMeshBoneWeight[];
  /** Each weighted point, in local bone space. */
  local_points: Vector[];
  /** The maximum depth of the bone hierarchy. */
  skeletal_depth: number;
  /** Fallback animation used when no other is available, kept for backwards compatibility. */
  default_animation: ObjectRef;
  /** Bone the weapon attaches to; -1 if unassigned. */
  weapon_bone_index: number;
  /**
   * The weapon attachment coordinate frame, relative to its bone. A mesh that
   * makes no adjustment stores the identity frame - origin at zero, axes along
   * world X/Y/Z - meaning no offset or rotation.
   */
  weapon_adjust: SkeletalMeshWeaponAdjust;
}

export function readUSkeletalMesh(ctx: NativeContext): USkeletalMesh {
  const { cursor } = ctx;

  return {
    ...readULodMesh(ctx),
    ext_wedges: readStructArray(ctx, readSkeletalMeshExtWedge),
    points: readStructArray(ctx, readVector),
    skeletons: readStructArray(ctx, readSkeletalMeshSkeleton),
    bone_weight_indices: readStructArray(ctx, readSkeletalMeshBoneWeightIndex),
    bone_weights: readStructArray(ctx, readSkeletalMeshBoneWeight),
    local_points: readStructArray(ctx, readVector),
    skeletal_depth: cursor.uint32(),
    default_animation: readObjectRef(ctx),
    weapon_bone_index: cursor.int32(),
    weapon_adjust: readSkeletalMeshWeaponAdjust(ctx),
  };
}

/** Rune's skeletal model. */
export interface USkelModel extends UPrimitive {
  num_meshes: number;
  num_joints: number;
  num_frames: number;
  num_sequences: number;
  num_skins: number;
  root_joint: number;
  meshes: RMesh[];
  joints: RJoint[];
  anim_sequences: RSkelAnimSeq[];
  frames: RAnimFrame[];
  pos_offset: Vector;
  rot_offset: Rotator;
}

export function readUSkelModel(ctx: NativeContext): USkelModel {
  const { cursor } = ctx;

  return {
    ...readUPrimitive(ctx),
    num_meshes: cursor.int32(),
    num_joints: cursor.int32(),
    num_frames: cursor.int32(),
    num_sequences: cursor.int32(),
    num_skins: cursor.int32(),
    root_joint: cursor.int32(),
    meshes: readStructArray(ctx, readRMesh),
    joints: readStructArray(ctx, readRJoint),
    anim_sequences: readStructArray(ctx, readRSkelAnimSeq),
    frames: readStructArray(ctx, readRAnimFrame),
    pos_offset: readVector(ctx),
    rot_offset: readRotator(ctx),
  };
}
