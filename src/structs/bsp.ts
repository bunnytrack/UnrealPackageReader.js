/**
 * BSP tree and brush geometry: the structures that make up a `Model`.
 *
 * A level's collision and rendering geometry is a BSP tree of `BspNode`s over a
 * shared vertex pool, with `BspSurface` describing how each face is textured.
 * `Polygon` is the other half of the picture - the brush's own source polygons,
 * saved straight out of UnrealEd and kept alongside the compiled tree.
 *
 * These are the engine's `FBspNode`, `FBspSurf`, `FVert`, `FZoneProperties`,
 * `FLightMapIndex`, `FLeaf` and `FPoly` (`Engine/Inc/UnObj.h` in the UT 436
 * source release).
 */

import { readStructArray, type ReadContext } from "./context.ts";
import { readPlane, readVector, type Plane, type Vector } from "./geometry.ts";

/**
 * A node in the BSP tree (`FBspNode`).
 *
 * `zone_mask` is a 64-bit set of every zone at or below this node in the tree.
 */
export interface BspNode {
  plane: Plane;
  zone_mask: bigint;
  node_flags: number;
  i_vert_pool: number;
  i_surf: number;
  i_front: number;
  i_back: number;
  i_plane: number;
  i_collision_bound: number;
  i_render_bound: number;
  /** Zone indices for the front and back of the plane. Always two entries. */
  i_zone: number[];
  vertices: number;
  /** Leaf indices for the front and back of the plane. Always two entries. */
  i_leaf: number[];
}

export function readBspNode(ctx: ReadContext): BspNode {
  const { cursor } = ctx;

  return {
    plane: readPlane(ctx),
    zone_mask: cursor.bigUint64(),
    node_flags: cursor.uint8(),
    i_vert_pool: cursor.compactIndex(),
    i_surf: cursor.compactIndex(),
    i_front: cursor.compactIndex(),
    i_back: cursor.compactIndex(),
    i_plane: cursor.compactIndex(),
    i_collision_bound: cursor.compactIndex(),
    i_render_bound: cursor.compactIndex(),
    i_zone: readStructArray(ctx, ({ cursor }) => cursor.uint8(), 2),
    vertices: cursor.uint8(),
    i_leaf: readStructArray(ctx, ({ cursor }) => cursor.int32(), 2),
  };
}

/**
 * A textured surface (`FBspSurf`) shared by every node on the same plane.
 *
 * `texture` and `actor` are object references; the `v_*` fields index the
 * model's vertex pool.
 */
export interface BspSurface {
  texture: number;
  poly_flags: number;
  p_base: number;
  v_normal: number;
  v_texture_u: number;
  v_texture_v: number;
  i_light_map: number;
  i_brush_poly: number;
  pan_u: number;
  pan_v: number;
  actor: number;
}

export function readBspSurface({ cursor }: ReadContext): BspSurface {
  return {
    texture: cursor.compactIndex(),
    poly_flags: cursor.uint32(),
    p_base: cursor.compactIndex(),
    v_normal: cursor.compactIndex(),
    v_texture_u: cursor.compactIndex(),
    v_texture_v: cursor.compactIndex(),
    i_light_map: cursor.compactIndex(),
    i_brush_poly: cursor.compactIndex(),
    pan_u: cursor.int16(),
    pan_v: cursor.int16(),
    actor: cursor.compactIndex(),
  };
}

/**
 * An entry in the model's vertex pool (`FVert`): a point, and `i_side` - the
 * unique side it belongs to if shared, otherwise none.
 */
export interface ModelVertex {
  vertex: number;
  i_side: number;
}

export function readModelVertex({ cursor }: ReadContext): ModelVertex {
  return {
    vertex: cursor.compactIndex(),
    i_side: cursor.compactIndex(),
  };
}

/**
 * A zone's connectivity and visibility masks (`FZoneProperties`). Bit `j` of
 * `connectivity` marks zone `j` as adjacent to this one; of `visibility`, as
 * visible from it.
 *
 * UNVERIFIED - `last_render_time` (version < 63) is not exercised by any
 * available package. `Zone` is only constructed on the `version > 61` side of
 * `UModel`, so the field is reachable at version 62 exactly.
 */
export interface Zone {
  zone_actor: number;
  connectivity: bigint;
  visibility: bigint;
  last_render_time?: number;
}

export function readZone({ cursor, version }: ReadContext): Zone {
  return {
    zone_actor: cursor.compactIndex(),
    connectivity: cursor.bigUint64(),
    visibility: cursor.bigUint64(),
    ...(version < 63 ? { last_render_time: cursor.float32() } : {}),
  };
}

/**
 * Lighting applied to a surface (`FLightMapIndex`), as an offset into the
 * model's light bits.
 */
export interface LightMap {
  data_offset: number;
  pan: Vector;
  u_clamp: number;
  v_clamp: number;
  u_scale: number;
  v_scale: number;
  i_light_actors: number;
}

export function readLightMap(ctx: ReadContext): LightMap {
  const { cursor } = ctx;

  return {
    data_offset: cursor.uint32(),
    pan: readVector(ctx),
    u_clamp: cursor.compactIndex(),
    v_clamp: cursor.compactIndex(),
    u_scale: cursor.float32(),
    v_scale: cursor.float32(),
    i_light_actors: cursor.int32(),
  };
}

/**
 * A leaf of the BSP tree (`FLeaf`) - a convex volume - carrying the zone it
 * lies in and a bit mask of the zones visible from it.
 */
export interface BspLeaf {
  i_zone: number;
  i_permeating: number;
  i_volumetric: number;
  visible_zones: bigint;
}

export function readBspLeaf({ cursor }: ReadContext): BspLeaf {
  return {
    i_zone: cursor.compactIndex(),
    i_permeating: cursor.compactIndex(),
    i_volumetric: cursor.compactIndex(),
    visible_zones: cursor.bigUint64(),
  };
}

/**
 * A brush's own source polygon (`FPoly`), as authored in UnrealEd.
 */
export interface Polygon {
  vertex_count: number;
  origin: Vector;
  normal: Vector;
  texture_u: Vector;
  texture_v: Vector;
  vertices: Vector[];
  flags: number;
  actor: number;
  texture: number;
  item_name: number;
  link: number;
  brush_poly: number;
  pan_u: number;
  pan_v: number;
}

export function readPolygon(ctx: ReadContext): Polygon {
  const { cursor } = ctx;
  const vertex_count = cursor.uint8();

  return {
    vertex_count,
    origin: readVector(ctx),
    normal: readVector(ctx),
    texture_u: readVector(ctx),
    texture_v: readVector(ctx),
    vertices: readStructArray(ctx, readVector, vertex_count),
    flags: cursor.uint32(),
    actor: cursor.compactIndex(),
    texture: cursor.compactIndex(),
    item_name: cursor.compactIndex(),
    link: cursor.compactIndex(),
    brush_poly: cursor.compactIndex(),
    pan_u: cursor.int16(),
    pan_v: cursor.int16(),
  };
}
