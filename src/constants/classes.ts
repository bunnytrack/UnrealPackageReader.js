/**
 * Class-name groupings the reader uses to classify exports.
 *
 * Matched against an export's class name, so these are the engine's own class
 * names and are case-sensitive as written.
 */

/** Classes whose objects carry brush geometry. Every mover, plus Brush. */
export const BRUSH_CLASSES = [
  "AssertMover",
  "AttachMover",
  "Brush",
  "ElevatorMover",
  "GradualMover",
  "LoopMover",
  "MixMover",
  "Mover",
  "RotatingMover",
] as const;

/** Movers specifically - brushes that animate. */
export const MOVER_CLASSES = [
  "AssertMover",
  "AttachMover",
  "ElevatorMover",
  "GradualMover",
  "LoopMover",
  "MixMover",
  "Mover",
  "RotatingMover",
] as const;

/** Classes the reader can extract mesh data from. */
export const MESH_CLASSES = [
  "Mesh",
  "LodMesh",
  "SkeletalMesh",
  "SkelModel",
] as const;
