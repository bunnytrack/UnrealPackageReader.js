/**
 * Geometric primitives: points, orientations, colours and bounds.
 *
 * These are the engine's `FVector`, `FRotator`, `FQuat`, `FPlane`, `FScale`,
 * `FBox` and `FSphere` (`Core/Inc/UnMath.h`), `FColor` (`Engine/Inc/UnTex.h`)
 * and `FPointRegion` (`Engine/Inc/UnObj.h`), in the UT 436 source release.
 */

import type { ReadContext } from "./context.ts";

/** A point or direction in world space (`FVector`). */
export interface Vector {
  x: number;
  y: number;
  z: number;
}

export function readVector({ cursor }: ReadContext): Vector {
  return {
    x: cursor.float32(),
    y: cursor.float32(),
    z: cursor.float32(),
  };
}

/**
 * An orientation (`FRotator`), in Unreal's angle units: 65536 (`0x10000`) is a
 * full rotation, so 16384 (`0x4000`) is 90 degrees. Each component is a signed
 * 32-bit integer, and is not reduced to a single turn - it can be negative or
 * exceed 65536.
 */
export interface Rotator {
  /** Looking up and down: 0 straight ahead, positive up, negative down. */
  pitch: number;
  /** Turning left and right: 0 east, positive north, negative south. */
  yaw: number;
  /** Roll about the view axis: 0 level, positive clockwise, negative anticlockwise. */
  roll: number;
}

export function readRotator({ cursor }: ReadContext): Rotator {
  return {
    pitch: cursor.int32(),
    yaw: cursor.int32(),
    roll: cursor.int32(),
  };
}

/** An orientation as a quaternion (`FQuat`), used by skeletal animation. */
export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export function readQuaternion({ cursor }: ReadContext): Quaternion {
  return {
    x: cursor.float32(),
    y: cursor.float32(),
    z: cursor.float32(),
    w: cursor.float32(),
  };
}

/**
 * A plane (`FPlane`), as a normal (x, y, z) plus its distance from the origin (w).
 *
 * Field-identical to `Quaternion` but semantically unrelated, and the format
 * treats them as distinct types.
 */
export interface Plane {
  x: number;
  y: number;
  z: number;
  w: number;
}

export function readPlane({ cursor }: ReadContext): Plane {
  return {
    x: cursor.float32(),
    y: cursor.float32(),
    z: cursor.float32(),
    w: cursor.float32(),
  };
}

/** An RGBA colour (`FColor`), one byte per channel. */
export interface Colour {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function readColour({ cursor }: ReadContext): Colour {
  return {
    r: cursor.uint8(),
    g: cursor.uint8(),
    b: cursor.uint8(),
    a: cursor.uint8(),
  };
}

/**
 * A non-uniform scale with an optional shear (`FScale`) - the scaling and
 * shearing applied to a brush.
 */
export interface Scale {
  x: number;
  y: number;
  z: number;
  sheer_rate: number;
  /** The axis the shear is applied along; indexes `SHEER_AXIS` in `constants/enums.ts`. */
  sheer_axis: number;
}

export function readScale({ cursor }: ReadContext): Scale {
  return {
    x: cursor.float32(),
    y: cursor.float32(),
    z: cursor.float32(),
    sheer_rate: cursor.float32(),
    sheer_axis: cursor.uint8(),
  };
}

/** Where an actor sits in the BSP (`FPointRegion`): its zone, leaf and zone number. */
export interface PointRegion {
  zone: number;
  i_leaf: number;
  zone_number: number;
}

export function readPointRegion({ cursor }: ReadContext): PointRegion {
  return {
    zone: cursor.compactIndex(),
    i_leaf: cursor.int32(),
    zone_number: cursor.uint8(),
  };
}

/** An axis-aligned bounding box (`FBox`). */
export interface BoundingBox {
  min: Vector;
  max: Vector;
  /**
   * Whether the box has been computed, as distinct from left at its default. A
   * byte in the file rather than a bit; it cannot be inferred from the bounds,
   * because a zero-size box at the origin is a legitimate value.
   */
  valid: boolean;
}

export function readBoundingBox(ctx: ReadContext): BoundingBox {
  return {
    min: readVector(ctx),
    max: readVector(ctx),
    valid: ctx.cursor.uint8() > 0,
  };
}

/**
 * A bounding sphere (`FSphere`).
 *
 * Before version 62 only the centre was stored; the radius arrived with v62.
 */
export interface BoundingSphere {
  centre: Vector;
  radius?: number;
}

export function readBoundingSphere(ctx: ReadContext): BoundingSphere {
  return {
    centre: readVector(ctx),
    ...(ctx.version > 61 ? { radius: ctx.cursor.float32() } : {}),
  };
}
