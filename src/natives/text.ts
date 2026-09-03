/**
 * `UTextBuffer` - source text: UnrealScript, or a map's level-info text.
 */

import { decodeText } from "../io/text.ts";
import type { NativeContext } from "./context.ts";

/**
 * Source text: UnrealScript, or a map's level-info text.
 */
export interface UTextBuffer {
  pos: number;
  top: number;
  size: number;
  contents?: string;
}

export function readUTextBuffer(ctx: NativeContext): UTextBuffer {
  const { cursor } = ctx;

  const pos = cursor.uint32();
  const top = cursor.uint32();
  const size = cursor.compactIndex();

  if (size <= 0) {
    return { pos, top, size };
  }

  const contents = decodeText(cursor.bytes(size - 1));
  cursor.skip(1);

  return { pos, top, size, contents };
}
