/**
 * Texture data structures, for `Texture` and `ScriptedTexture`.
 *
 * `MipMap` is the engine's `FMipmap` / `FMipmapBase` (`Engine/Inc/UnTex.h` in
 * the UT 436 source release).
 */

import { type ReadContext } from "./context.ts";

/** One level of a texture's mipmap chain (`FMipmap`). */
export interface MipMap {
  /**
   * The file offset just past the pixel data, letting the engine skip the
   * payload without decoding it (the `TLazyArray` skip offset). Present from
   * version 63.
   */
  width_offset?: number;
  size: number;
  /**
   * Palette indices rather than pixels for the common 8-bit formats - turning
   * it into an image needs the texture's `Palette` object, which is why
   * decoding lives at the surface rather than here.
   */
  data: Uint8Array;
  width: number;
  height: number;
  /**
   * Log2 of `width` (dimensions are always powers of two). Stored alongside
   * the size so the renderer can address texels with a bit shift, `<<
   * bits_width`, rather than a multiply by `width`.
   */
  bits_width: number;
  /** Log2 of `height`; see `bits_width`. */
  bits_height: number;
}

export function readMipMap({ cursor, version }: ReadContext): MipMap {
  // The conditional field comes first, so it cannot be a trailing spread -
  // read order and property order both have to keep it in front.
  const width_offset = version >= 63 ? cursor.uint32() : undefined;
  const size = cursor.compactIndex();

  return {
    ...(width_offset !== undefined ? { width_offset } : {}),
    size,
    data: cursor.bytes(size),
    width: cursor.uint32(),
    height: cursor.uint32(),
    bits_width: cursor.uint8(),
    bits_height: cursor.uint8(),
  };
}
