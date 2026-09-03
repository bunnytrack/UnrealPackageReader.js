/**
 * Vertex mesh structures, shared by `Mesh` and `LodMesh`.
 *
 * Unreal's vertex meshes are frame-animated rather than skinned: a mesh stores
 * every vertex position for every frame, and an animation sequence is a range
 * of frames. `LodMesh` adds the wedge/face indirection that lets the renderer
 * collapse detail.
 *
 * These are the engine's `FMeshVert`, `FMeshTri`, `FMeshVertConnect`,
 * `FMeshWedge`, `FMeshFace` and `FMeshMaterial` (`Engine/Inc/UnMesh.h`), and
 * `FMeshAnimSeq` / `FMeshAnimNotify` (`Engine/Inc/UnAnim.h`), in the UT 436
 * source release.
 */

import { readStructArray, type ReadContext } from "./context.ts";

/**
 * A single vertex position (`FMeshVert`), packed into one 32-bit word.
 *
 * 11 bits for X and Y and 10 for Z, each a fixed-point value - X and Y divide
 * by 8, Z by 4 - and each sign-corrected by subtracting 256 above the midpoint.
 * The packing costs precision but quarters the size of a mesh, which mattered a
 * great deal in 1998.
 *
 * The layout is game-specific rather than version-specific: Deus Ex widens it
 * to 64 bits, 16 bits per axis at 1/256 precision, which cannot be told apart
 * from the standard form by the package version alone. Choosing between them
 * would need engine-fork detection, which this reader does not attempt, so
 * the Deus Ex unpacking is recorded here:
 *
 * ```ts
 * const xyz = cursor.bigUint64();
 *
 * let x = Number(xyz & 0xffffn) / 256;
 * let y = Number((xyz >> 16n) & 0xffffn) / 256;
 * let z = Number((xyz >> 32n) & 0xffffn) / 256;
 *
 * if (x > 128) x -= 256;
 * if (y > 128) y -= 256;
 * if (z > 128) z -= 256;
 * ```
 */
export interface MeshVertex {
  x: number;
  y: number;
  z: number;
}

export function readMeshVertex({ cursor }: ReadContext): MeshVertex {
  const xyz = cursor.uint32();

  let x = (xyz & 0x7ff) / 8;
  let y = ((xyz >> 11) & 0x7ff) / 8;
  let z = ((xyz >> 22) & 0x3ff) / 4;

  if (x >= 128) x -= 256;
  if (y >= 128) y -= 256;
  if (z >= 128) z -= 256;

  return { x, y, z };
}

/**
 * A textured triangle (`FMeshTri`): three vertex indices with per-corner UVs,
 * plus surface flags and a source texture index.
 *
 * UVs are bytes, so texture coordinates are quantised to 1/256 of the texture.
 */
export interface MeshTriangle {
  vertex_index_1: number;
  vertex_index_2: number;
  vertex_index_3: number;
  vertex_1_u: number;
  vertex_1_v: number;
  vertex_2_u: number;
  vertex_2_v: number;
  vertex_3_u: number;
  vertex_3_v: number;
  flags: number;
  texture_index: number;
}

export function readMeshTriangle({ cursor }: ReadContext): MeshTriangle {
  return {
    vertex_index_1: cursor.uint16(),
    vertex_index_2: cursor.uint16(),
    vertex_index_3: cursor.uint16(),
    vertex_1_u: cursor.uint8(),
    vertex_1_v: cursor.uint8(),
    vertex_2_u: cursor.uint8(),
    vertex_2_v: cursor.uint8(),
    vertex_3_u: cursor.uint8(),
    vertex_3_v: cursor.uint8(),
    flags: cursor.uint32(),
    texture_index: cursor.uint32(),
  };
}

/** A script callback fired during an animation sequence (`FMeshAnimNotify`). */
export interface MeshAnimNotify {
  /** When the callback fires, as a fraction of the sequence from 0 to 1. */
  time: number;
  /** The actor function the callback calls. */
  function_name: string;
}

export function readMeshAnimNotify({
  cursor,
  name,
}: ReadContext): MeshAnimNotify {
  return {
    time: cursor.float32(),
    function_name: name(),
  };
}

/** A named range of animation frames (`FMeshAnimSeq`), e.g. `Walking` or `Dead`. */
export interface MeshAnimationSequence {
  name: string;
  /** Groups several sequences so one name can trigger them together. */
  group: string;
  start_frame: number;
  frame_count: number;
  notifications: MeshAnimNotify[];
  /** Playback rate, in frames per second. */
  rate: number;
}

export function readMeshAnimationSequence(
  ctx: ReadContext,
): MeshAnimationSequence {
  const { cursor, name } = ctx;

  return {
    name: name(),
    group: name(),
    start_frame: cursor.uint32(),
    frame_count: cursor.uint32(),
    notifications: readStructArray(ctx, readMeshAnimNotify),
    rate: cursor.float32(),
  };
}

/**
 * Where a vertex's triangles start in the mesh's triangle list
 * (`FMeshVertConnect`).
 */
export interface MeshConnection {
  num_vert_triangles: number;
  triangle_list_offset: number;
}

export function readMeshConnection({ cursor }: ReadContext): MeshConnection {
  return {
    num_vert_triangles: cursor.uint32(),
    triangle_list_offset: cursor.uint32(),
  };
}

/**
 * A `LodMesh` face (`FMeshFace`): three wedge indices plus the material index
 * to draw them with.
 */
export interface LodMeshFace {
  wedge_index_1: number;
  wedge_index_2: number;
  wedge_index_3: number;
  material_index: number;
}

export function readLodMeshFace({ cursor }: ReadContext): LodMeshFace {
  return {
    wedge_index_1: cursor.uint16(),
    wedge_index_2: cursor.uint16(),
    wedge_index_3: cursor.uint16(),
    material_index: cursor.uint16(),
  };
}

/**
 * A vertex/UV pair (`FMeshWedge`).
 *
 * The indirection exists because one vertex can carry different UVs on
 * different faces - a seam - so faces index wedges rather than vertices.
 */
export interface LodMeshWedge {
  vertex_index: number;
  s: number;
  t: number;
}

export function readLodMeshWedge({ cursor }: ReadContext): LodMeshWedge {
  return {
    vertex_index: cursor.uint16(),
    s: cursor.uint8(),
    t: cursor.uint8(),
  };
}

/**
 * A `LodMesh` material (`FMeshMaterial`): a texture plus its own poly flags -
 * "texture plus unique flags", in the engine's words.
 */
export interface LodMeshMaterial {
  flags: number;
  texture_index: number;
}

export function readLodMeshMaterial({ cursor }: ReadContext): LodMeshMaterial {
  return {
    flags: cursor.uint32(),
    texture_index: cursor.uint32(),
  };
}
