/**
 * Image-carrying classes: `UTexture` and its scripted variant, `UPalette`, and
 * `UFont`, whose glyphs live in textures of their own.
 */

import { readStructArray } from "../structs/context.ts";
import {
  readColour,
  readFontCharacter,
  readFontRemap,
  readFontTexture,
  readMipMap,
  type Colour,
  type FontCharacter,
  type FontRemap,
  type FontTexture,
  type MipMap,
} from "../structs/index.ts";
import type { NativeContext } from "./context.ts";

/**
 * A texture's stored image data: its mipmap chain. The mip count is a single
 * byte, not a compact index.
 */
export interface UTexture {
  mip_maps: MipMap[];
}

export function readUTexture(ctx: NativeContext): UTexture {
  return {
    mip_maps: readStructArray(ctx, readMipMap, ctx.cursor.uint8()),
  };
}

/** Serialised identically to `UTexture`; the scripting lives in properties. */
export type UScriptedTexture = UTexture;

export const readUScriptedTexture = readUTexture;

/**
 * A 256-colour palette, referenced by textures.
 *
 * `colours` is the raw stored palette. The alpha channel is only meaningful
 * from package version 66: older writers never read it, so it is uninitialised
 * garbage there, and the engine's palette loader overwrites it with 255 for
 * files that old. This reader reports the bytes as stored; a consumer wanting
 * engine-effective values applies that rule itself.
 */
export interface UPalette {
  colours: Colour[];
}

export function readUPalette(ctx: NativeContext): UPalette {
  return {
    colours: readStructArray(ctx, readColour),
  };
}

/**
 * The original font: the font *is* a texture. Unreal 1 declares
 * `class UFont : public UTexture` holding `TArray<FFontCharacter> Characters`,
 * and its serialiser writes the full texture body followed by the glyph
 * table (which is why a font's properties are a texture's: `Palette`,
 * `UBits`, `MipZero`). One glyph entry per character code (256 in every font
 * examined).
 */
export interface UFontTexture extends UTexture {
  characters: FontCharacter[];
}

/**
 * The later font, from package version 68: a `UObject` holding texture pages,
 * each with its glyphs, and the page size (`UFont` in `Engine/Inc/UnTex.h` of
 * the UT 436 source release). Version 69 introduced character remapping.
 */
export interface UFontPaged {
  textures: FontTexture[];
  characters_per_page: number;
  char_remap?: FontRemap[];
  is_remapped?: boolean;
}

/**
 * A set of glyphs: the glyph bitmaps live in textures, while the font itself
 * stores each glyph's coordinates within them.
 */
export type UFont = UFontTexture | UFontPaged;

/**
 * The layout is texture-based up to v63 and paged from v68. The version that
 * changed it is unknown, and no available package uses one in between, so the
 * branch is placed at v68 (the earliest paged version seen): a version in the
 * gap is read with the layout of the nearest known version below it.
 */
export function readUFont(ctx: NativeContext): UFont {
  const { cursor, version } = ctx;

  if (version < 68) {
    return {
      ...readUTexture(ctx),
      characters: readStructArray(ctx, readFontCharacter),
    };
  }

  return {
    textures: readStructArray(ctx, readFontTexture),
    characters_per_page: cursor.int32(),
    ...(version >= 69
      ? {
          char_remap: readStructArray(ctx, readFontRemap),
          is_remapped: cursor.uint32() > 0,
        }
      : {}),
  };
}
