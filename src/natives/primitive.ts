/**
 * `UPrimitive` and its BSP descendants: `UModel`, the brush and level
 * geometry, and `UPolys`, the editor-side polygon list a model was built from.
 */

import { readArray } from "../io/cursor.ts";
import { readStructArray } from "../structs/context.ts";
import {
  readBoundingBox,
  readBoundingSphere,
  readBspLeaf,
  readBspNode,
  readBspSurface,
  readLightMap,
  readModelVertex,
  readPolygon,
  readVector,
  readZone,
  type BoundingBox,
  type BoundingSphere,
  type BspLeaf,
  type BspNode,
  type BspSurface,
  type LightMap,
  type ModelVertex,
  type Polygon,
  type Vector,
  type Zone,
} from "../structs/index.ts";
import type { NativeContext } from "./context.ts";

/**
 * The base of the engine's geometric classes - anything that can be rendered
 * and collided with.
 */
export interface UPrimitive {
  bounding_box: BoundingBox;
  bounding_sphere: BoundingSphere;
}

export function readUPrimitive(ctx: NativeContext): UPrimitive {
  return {
    bounding_box: readBoundingBox(ctx),
    bounding_sphere: readBoundingSphere(ctx),
  };
}

/**
 * A BSP model, used for brushes and for the level itself.
 *
 * Before version 62 the geometry arrays were separate objects and the model
 * held only a reference to each, so `vectors`, `points`, `nodes`, `surfaces`
 * and `vertices` are bare object indices on that side of the branch and arrays
 * on the other. `polys` is always a reference - the `UPolys` object.
 */
export interface UModel extends UPrimitive {
  vectors: number | Vector[];
  points: number | Vector[];
  nodes: number | BspNode[];
  surfaces: number | BspSurface[];
  vertices: number | ModelVertex[];
  num_shared_sides?: number;
  num_zones?: number;
  zones?: Zone[];
  polys: number;
  light_map: LightMap[];
  light_bits: number[];
  bounds: BoundingBox[];
  leaf_hulls: number[];
  leaves: BspLeaf[];
  lights: number[];
  leaf_zone?: number;
  leaf_leaf?: number;
  root_outside: boolean;
  linked: boolean;
}

export function readUModel(ctx: NativeContext): UModel {
  const { cursor } = ctx;
  const bareIndices = ctx.version <= 61;

  const primitive = readUPrimitive(ctx);

  const geometry = bareIndices
    ? {
        vectors: cursor.compactIndex(),
        points: cursor.compactIndex(),
        nodes: cursor.compactIndex(),
        surfaces: cursor.compactIndex(),
        vertices: cursor.compactIndex(),
      }
    : readModernGeometry(ctx);

  return {
    ...primitive,
    ...geometry,
    polys: cursor.compactIndex(),
    light_map: readStructArray(ctx, readLightMap),
    light_bits: readArray(cursor, () => cursor.uint8()),
    bounds: readStructArray(ctx, readBoundingBox),
    leaf_hulls: readArray(cursor, () => cursor.int32()),
    leaves: readStructArray(ctx, readBspLeaf),
    lights: readArray(cursor, () => cursor.compactIndex()),
    ...(bareIndices
      ? { leaf_zone: cursor.compactIndex(), leaf_leaf: cursor.compactIndex() }
      : {}),
    root_outside: cursor.uint32() > 0,
    linked: cursor.uint32() > 0,
  };
}

/** The version-62-and-later geometry block. `zones` is sized by `num_zones`. */
function readModernGeometry(ctx: NativeContext) {
  const { cursor } = ctx;

  const vectors = readStructArray(ctx, readVector);
  const points = readStructArray(ctx, readVector);
  const nodes = readStructArray(ctx, readBspNode);
  const surfaces = readStructArray(ctx, readBspSurface);
  const vertices = readStructArray(ctx, readModelVertex);
  const num_shared_sides = cursor.int32();
  const num_zones = cursor.int32();

  return {
    vectors,
    points,
    nodes,
    surfaces,
    vertices,
    num_shared_sides,
    num_zones,
    zones: readStructArray(ctx, readZone, num_zones),
  };
}

/**
 * The polygon count is stored twice as `TTransArray` serialises both its count
 * and its allocated capacity, so the second copy is skipped unread.
 */
export interface UPolys {
  poly_count: number;
  polys: Polygon[];
}

export function readUPolys(ctx: NativeContext): UPolys {
  const { cursor } = ctx;

  const poly_count = cursor.uint32();
  cursor.skip(4);

  return {
    poly_count,
    polys: readStructArray(ctx, readPolygon, poly_count),
  };
}
