/**
 * What a struct reader needs beyond the cursor.
 *
 * `BinaryCursor` deliberately knows nothing about packages, but a struct is not
 * always self-contained: some fields only exist at certain engine versions,
 * some hold a name-table index, and a couple hold a reference into the export
 * or import table. Those three needs are the whole of this interface.
 *
 * Every struct reader takes a `ReadContext` even when it only touches the
 * cursor. A uniform signature means struct readers compose freely - nesting
 * one inside another, or handing one to `readArray`, never requires knowing
 * which flavour of argument it wants.
 *
 * `name` and `object` are declared as function-typed properties, not methods:
 * struct readers destructure the context (`function readThing({ cursor, name })`),
 * which would strip a method of its `this`. An implementation must therefore
 * supply them already bound, as arrow functions, or via `.bind()`.
 *
 * `version` and `licenseeVersion` are the only header fields any struct
 * consults, so they are passed rather than the whole header.
 */

import { readArray } from "../io/cursor.ts";
import type { BinaryCursor } from "../io/cursor.ts";

/**
 * An entry in the export or import table.
 *
 * Opaque: structs only ever store a reference and hand it straight back, so
 * nothing here needs to know its shape.
 */
export type TableObject = object;

export interface ReadContext {
  readonly cursor: BinaryCursor;

  /** The engine version that wrote the package. */
  readonly version: number;

  /** Non-zero for licensee engine forks. */
  readonly licenseeVersion: number;

  /**
   * Resolve a name-table entry. With no argument, reads a compact index from
   * the cursor first, which is how names are stored inline in a struct.
   */
  readonly name: (index?: number) => string;

  /**
   * Resolve an object reference: positive is a 1-based export index, negative
   * is a bitwise-complemented import index, and zero is no object.
   */
  readonly object: (index: number) => TableObject | null;
}

/**
 * Read a length-prefixed array of structs.
 *
 * A thin wrapper over `readArray` for the shape every struct array takes:
 * `readStructArray(ctx, readVector)` rather than
 * `readArray(ctx.cursor, () => readVector(ctx))`. Pass `count` for the
 * fixed-length arrays that carry no length prefix.
 */
export function readStructArray<T>(
  ctx: ReadContext,
  read: (ctx: ReadContext) => T,
  count?: number,
): T[] {
  return readArray(ctx.cursor, () => read(ctx), count);
}
