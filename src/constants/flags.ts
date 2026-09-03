/**
 * Bitfield flags and their decoders.
 */

/**
 * Object flags, stored per export table entry.
 *
 * Only a few matter to a reader: RF_HasStack signals a StateFrame block ahead
 * of an object's properties, and the RF_LoadFor / RF_NotFor pairs describe
 * where the object is needed. The rest are engine bookkeeping, retained
 * because they make decoded flag lists legible.
 *
 * Three bits carry two names each - HighlightedName/EliminateObject,
 * InSingularFunc/RemappedName and Suppress/StateChanged - where the meaning
 * depends on whether the flag describes a name or an object.
 *
 * Complete against EObjectFlags in the UT99 public source: 33 entries, every
 * value verified.
 */
export const OBJECT_FLAGS = {
  RF_Transactional: 0x00000001,
  RF_Unreachable: 0x00000002,
  RF_Public: 0x00000004,
  RF_TagImp: 0x00000008,
  RF_TagExp: 0x00000010,
  RF_SourceModified: 0x00000020,
  RF_TagGarbage: 0x00000040,
  RF_NeedLoad: 0x00000200,
  RF_HighlightedName: 0x00000400,
  RF_EliminateObject: 0x00000400,
  RF_InSingularFunc: 0x00000800,
  RF_RemappedName: 0x00000800,
  RF_Suppress: 0x00001000,
  RF_StateChanged: 0x00001000,
  RF_InEndState: 0x00002000,
  RF_Transient: 0x00004000,
  RF_PreLoading: 0x00008000,
  RF_LoadForClient: 0x00010000,
  RF_LoadForServer: 0x00020000,
  RF_LoadForEdit: 0x00040000,
  RF_Standalone: 0x00080000,
  RF_NotForClient: 0x00100000,
  RF_NotForServer: 0x00200000,
  RF_NotForEdit: 0x00400000,
  RF_Destroyed: 0x00800000,
  RF_NeedPostLoad: 0x01000000,
  RF_HasStack: 0x02000000,
  RF_Native: 0x04000000,
  RF_Marked: 0x08000000,
  RF_ErrorShutdown: 0x10000000,
  RF_DebugPostLoad: 0x20000000,
  RF_DebugSerialize: 0x40000000,
  RF_DebugDestroy: 0x80000000,
} as const;

export type ObjectFlagName = keyof typeof OBJECT_FLAGS;

/**
 * Surface flags on a BSP polygon.
 *
 * Several bits carry more than one name, because the engine reused them in
 * different contexts: Environment/ForceViewZone, BigWavy/SpecialPoly,
 * Gouraud/NoBoundRejection, Memorized/RenderHint, EdCut/Occlude, and three
 * names on 0x40000000. Decoding reports every name for a set bit, which is
 * faithful rather than a bug - the intended meaning depends on whether the
 * value came from an FPoly, a BSP surface or the renderer.
 *
 * Complete against EPolyFlags in the UT99 public source: 38 entries, every
 * value verified, and cross-checked against two engine forks. Bits a fork
 * repurposed for its own use are excluded, as are combination aliases such as
 * PF_NoOcclude, which are unions of the bits above rather than distinct flags.
 */
export const POLY_FLAGS = {
  PF_Invisible: 0x00000001,
  PF_Masked: 0x00000002,
  PF_Translucent: 0x00000004,
  PF_NotSolid: 0x00000008,
  PF_Environment: 0x00000010,
  PF_ForceViewZone: 0x00000010,
  PF_Semisolid: 0x00000020,
  PF_Modulated: 0x00000040,
  PF_FakeBackdrop: 0x00000080,
  PF_TwoSided: 0x00000100,
  PF_AutoUPan: 0x00000200,
  PF_AutoVPan: 0x00000400,
  PF_NoSmooth: 0x00000800,
  PF_BigWavy: 0x00001000,
  PF_SpecialPoly: 0x00001000,
  PF_SmallWavy: 0x00002000,
  PF_Flat: 0x00004000,
  PF_LowShadowDetail: 0x00008000,
  PF_NoMerge: 0x00010000,
  PF_CloudWavy: 0x00020000,
  PF_DirtyShadows: 0x00040000,
  PF_BrightCorners: 0x00080000,
  PF_SpecialLit: 0x00100000,
  PF_Gouraud: 0x00200000,
  PF_NoBoundRejection: 0x00200000,
  PF_Unlit: 0x00400000,
  PF_HighShadowDetail: 0x00800000,

  // Editor and internal flags. Not gameplay-facing, and easy to assume absent
  // from shipped content - but they survive into saved Polys objects, because
  // those are the brush's own source polygons straight out of UnrealEd.
  // 0x40000000 is set on 374 polygons in the test corpus.
  PF_Memorized: 0x01000000,
  PF_RenderHint: 0x01000000,
  PF_Selected: 0x02000000,
  PF_Portal: 0x04000000,
  PF_Mirrored: 0x08000000,
  PF_Highlighted: 0x10000000,
  PF_FlatShaded: 0x40000000,
  PF_EdProcessed: 0x40000000,
  PF_RenderFog: 0x40000000,
  PF_EdCut: 0x80000000,
  PF_Occlude: 0x80000000,
} as const;

export type PolyFlagName = keyof typeof POLY_FLAGS;

/**
 * Sound flags, from the Harry Potter 2 era of the engine.
 */
export const SOUND_FLAGS = {
  SF_None: 0,
  SF_Looping: 2,
  SF_Streaming: 4,
  SF_Music: 8,
  SF_No3D: 16,
  SF_UpdatePitch: 32,
  SF_NoUpdates: 64,
  SF_HasLipSync: 128,
  SF_Compressed: 256,
} as const;

export type SoundFlagName = keyof typeof SOUND_FLAGS;

/** Names of every object flag set in `flags`. */
export function decodeObjectFlags(flags: number): ObjectFlagName[] {
  return (Object.keys(OBJECT_FLAGS) as ObjectFlagName[]).filter(
    (name) => (OBJECT_FLAGS[name] & flags) !== 0,
  );
}

/** Names of every poly flag set in `flags`. */
export function decodePolyFlags(flags: number): PolyFlagName[] {
  return (Object.keys(POLY_FLAGS) as PolyFlagName[]).filter(
    (name) => (POLY_FLAGS[name] & flags) !== 0,
  );
}
