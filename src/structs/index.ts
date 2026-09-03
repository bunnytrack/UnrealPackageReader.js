/**
 * The format's struct layer: the ~45 sequential field readers that make up
 * everything inside a package's objects.
 *
 * Field names in returned objects follow the engine's own serialised fields,
 * snake_cased (`zone_mask` for `ZoneMask`, `i_vert_pool` for `iVertPool`), so
 * output can be matched against the engine sources and other tools.
 *
 * Key order in each returned object mirrors the order the fields occupy in
 * the file.
 *
 * Verification status:
 *
 * - 30 structs are exercised by the test corpus of real game packages.
 * - 8 more are reached through two custom packages carrying `SkeletalMesh` and
 *   `Animation` objects.
 * - `SkeletalMeshExtWedge` and all seven structs in `rune.ts` are transcribed
 *   but never constructed by any available file.
 * - `Zone.last_render_time` is the one version branch here that no available
 *   package reaches.
 *
 * @module structs
 */

export * from "./animation.ts";
export * from "./bsp.ts";
export * from "./context.ts";
export * from "./font.ts";
export * from "./geometry.ts";
export * from "./level.ts";
export * from "./mesh.ts";
export * from "./rune.ts";
export * from "./skeletal.ts";
export * from "./stateFrame.ts";
export * from "./texture.ts";
