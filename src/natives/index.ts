/**
 * The native class layer: what follows the property block for the classes
 * whose data the reader understands.
 *
 * Every export's data is a property block followed by whatever its native
 * class serialises - `UTexture::Serialize`, `UModel::Serialize` and so on. The
 * struct layer supplies the pieces; this layer comprises the class-level
 * readers that assemble them.
 *
 * Field names and key order follow the conventions of `src/structs`: the
 * engine's serialised field names, snake_cased, in file order. A derived
 * class's data begins with its base class's fields, exactly as the C++
 * serialiser chain writes them.
 *
 * @module natives
 */

import type { NativeContext } from "./context.ts";
import { readUAnimation, type UAnimation } from "./animation.ts";
import { readULevel, type ULevel } from "./level.ts";
import {
  readULodMesh,
  readUMesh,
  readUSkeletalMesh,
  readUSkelModel,
  type ULodMesh,
  type UMesh,
  type USkeletalMesh,
  type USkelModel,
} from "./mesh.ts";
import {
  readUModel,
  readUPolys,
  type UModel,
  type UPolys,
} from "./primitive.ts";
import { readUMusic, readUSound, type UMusic, type USound } from "./sound.ts";
import { readUTextBuffer, type UTextBuffer } from "./text.ts";
import {
  readUFont,
  readUPalette,
  readUScriptedTexture,
  readUTexture,
  type UFont,
  type UPalette,
  type UScriptedTexture,
  type UTexture,
} from "./texture.ts";

export * from "./animation.ts";
export * from "./context.ts";
export * from "./level.ts";
export * from "./mesh.ts";
export * from "./primitive.ts";
export * from "./sound.ts";
export * from "./text.ts";
export * from "./texture.ts";

/** Class name to the shape its data takes. */
export interface NativeDataByClass {
  Animation: UAnimation;
  Font: UFont;
  Level: ULevel;
  LodMesh: ULodMesh;
  Mesh: UMesh;
  Model: UModel;
  Music: UMusic;
  Palette: UPalette;
  Polys: UPolys;
  ScriptedTexture: UScriptedTexture;
  SkeletalMesh: USkeletalMesh;
  SkelModel: USkelModel;
  Sound: USound;
  TextBuffer: UTextBuffer;
  Texture: UTexture;
}

export type NativeClassName = keyof NativeDataByClass;

export type NativeData = NativeDataByClass[NativeClassName];

/**
 * `readData()` returns `{ properties, ...data }`, and a spread lets a later key
 * overwrite an earlier one silently. No native class has a `properties` field,
 * and this keeps it that way: adding one to any reader turns `true` into
 * `never` here and fails the typecheck, instead of clobbering the block.
 */
const NO_NATIVE_FIELD_SHADOWS_PROPERTIES: [
  Extract<NativeData, { properties: unknown }>,
] extends [never]
  ? true
  : never = true;
void NO_NATIVE_FIELD_SHADOWS_PROPERTIES;

const NATIVE_READERS: {
  [K in NativeClassName]: (ctx: NativeContext) => NativeDataByClass[K];
} = {
  Animation: readUAnimation,
  Font: readUFont,
  Level: readULevel,
  LodMesh: readULodMesh,
  Mesh: readUMesh,
  Model: readUModel,
  Music: readUMusic,
  Palette: readUPalette,
  Polys: readUPolys,
  ScriptedTexture: readUScriptedTexture,
  SkeletalMesh: readUSkeletalMesh,
  SkelModel: readUSkelModel,
  Sound: readUSound,
  TextBuffer: readUTextBuffer,
  Texture: readUTexture,
};

export function isNativeClassName(
  className: string | null,
): className is NativeClassName {
  return className !== null && Object.hasOwn(NATIVE_READERS, className);
}

/**
 * Read the native data for an object of `className` from the cursor's current
 * position - which must be the end of the property block. Null for a class
 * with no reader.
 */
export function readNativeData(
  ctx: NativeContext,
  className: string | null,
): NativeData | null {
  return isNativeClassName(className) ? NATIVE_READERS[className](ctx) : null;
}
