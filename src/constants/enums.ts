/**
 * UnrealScript enums, as ordered value lists.
 *
 * A property referencing an enum stores the ordinal, so these are indexed
 * directly: `CSG_OPER[value]`.
 *
 * Verified against the UnrealScript sources in the OldUnreal 469d patch, which
 * adds no values to any of them. The per-value descriptions are the engine's
 * own comments.
 */

/**
 * Mover.MoverEncroachType: how a mover reacts when it encroaches an actor.
 *
 * Engine/Classes/Mover.uc
 */
export const MOVER_ENCROACH_TYPE = [
  "ME_StopWhenEncroach", // Stop when we hit an actor.
  "ME_ReturnWhenEncroach", // Return to previous position when we hit an actor.
  "ME_CrushWhenEncroach", // Crush the poor helpless actor.
  "ME_IgnoreWhenEncroach", // Ignore encroached actors.
] as const;

/**
 * Mover.MoverGlideType: how a mover moves from one position to another.
 *
 * Engine/Classes/Mover.uc
 */
export const MOVER_GLIDE_TYPE = [
  "MV_MoveByTime", // Move linearly.
  "MV_GlideByTime", // Move with smooth acceleration.
] as const;

/**
 * Mover.BumpType: what classes can bump-trigger a mover.
 *
 * Engine/Classes/Mover.uc
 */
export const BUMP_TYPE = [
  "BT_PlayerBump", // Can only be bumped by a player.
  "BT_PawnBump", // Can be bumped by any pawn.
  "BT_AnyBump", // Can be bumped by any solid actor.
] as const;

/**
 * Brush.CsgOper: how a brush combines with the level geometry.
 *
 * Engine/Classes/Brush.uc
 */
export const CSG_OPER = [
  "CSG_Active", // Active brush - the editor's working brush, not part of the level.
  "CSG_Add", // Add to world.
  "CSG_Subtract", // Subtract from world.
  "CSG_Intersect", // Form from intersection with world.
  "CSG_Deintersect", // Form from negative intersection with world.
] as const;

/**
 * Scale.SheerAxis: the axis a Scale struct shears along.
 *
 * Core/Classes/Object.uc, where it is declared inline in the Scale struct
 * alongside the sheer rate it applies to.
 */
export const SHEER_AXIS = [
  "SHEER_None",
  "SHEER_XY",
  "SHEER_XZ",
  "SHEER_YX",
  "SHEER_YZ",
  "SHEER_ZX",
  "SHEER_ZY",
] as const;

export type BumpType = (typeof BUMP_TYPE)[number];
export type MoverEncroachType = (typeof MOVER_ENCROACH_TYPE)[number];
export type MoverGlideType = (typeof MOVER_GLIDE_TYPE)[number];
export type CsgOper = (typeof CSG_OPER)[number];
export type SheerAxis = (typeof SHEER_AXIS)[number];
