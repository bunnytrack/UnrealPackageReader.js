/**
 * What a native class reader needs: everything a struct reader does, plus
 * object references that resolve to real table entries rather than the opaque
 * `TableObject` of the struct layer.
 */

import type { ReadContext } from "../structs/context.ts";
import type { TableResolver, UObject } from "../package/objects.ts";

/**
 * `object` comes from the resolver, so it returns the real table entry rather
 * than the struct layer's opaque `TableObject`.
 */
export type NativeContext = Omit<ReadContext, "object"> & TableResolver;

/** A resolved object reference; null where the file stored index 0. */
export type ObjectRef = UObject | null;

/** `count` object references, each a compact index resolved against the tables. */
export function readObjectRefs(ctx: NativeContext, count: number): ObjectRef[] {
  return Array.from({ length: count }, () =>
    ctx.object(ctx.cursor.compactIndex()),
  );
}

/** One object reference. */
export function readObjectRef(ctx: NativeContext): ObjectRef {
  return ctx.object(ctx.cursor.compactIndex());
}
