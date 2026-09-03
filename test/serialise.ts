/**
 * Canonical serialisation for golden snapshots.
 *
 * Two jobs:
 *   1. Turn a parsed package into JSON that is byte-identical across runs and machines.
 *   2. Make that JSON non-reconstructive, so it can be committed even when the
 *      source asset cannot be. Every binary payload is reduced to a digest.
 */

import { createHash } from "crypto";

/** Maps a table object to a readable reference label, e.g. "export:12 (Palette0)". */
export type RefIndex = Map<object, string>;

/**
 * Getters hold the most useful data on table objects, but JSON.stringify only
 * walks own enumerable properties, so they would be silently dropped. Pull them
 * in by name. `properties` is deliberately excluded - it is expensive, it moves
 * the read cursor, and it is captured separately.
 */
const GETTERS = [
  "objectName",
  "className",
  "packageName",
  "classPackageName",
  "table",
  "flagNames",
];

const digest = (bytes: Uint8Array): string =>
  "sha256:" + createHash("sha256").update(bytes).digest("hex").slice(0, 16);

/** Stable hash of an already-canonical value. */
export const hash = (value: unknown): string =>
  "sha256:" +
  createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

/**
 * Build the reference index for a package. Export indices are 1-based and
 * import indices are negative, matching the reader's own getObject() encoding.
 */
export function buildRefIndex(pkg: any): RefIndex {
  const refs: RefIndex = new Map();

  pkg.exportTable.forEach((obj: any, i: number) =>
    refs.set(obj, `export:${i + 1} (${obj.objectName})`),
  );

  pkg.importTable.forEach((obj: any, i: number) =>
    refs.set(obj, `import:${-(i + 1)} (${obj.objectName})`),
  );

  return refs;
}

/**
 * Recursively canonicalise a parsed value.
 *
 * @param refs  When supplied, nested table objects collapse to a reference
 *              label instead of being inlined as an anonymous bag of indices.
 * @param depth Depth 0 is the object being serialised in its own right, so it
 *              is never collapsed to a reference to itself.
 */
export function canonical(value: any, refs?: RefIndex, depth = 0): any {
  // BigInt throws in JSON.stringify outright - zone_mask, probe_mask, visible_zones.
  if (typeof value === "bigint") return value.toString();

  if (typeof value === "number") {
    // JSON turns these into null, which would collapse three distinct states
    // into one - so a stray NaN or Infinity from a division stays legible in a
    // snapshot rather than masquerading as an intentional null.
    if (Number.isNaN(value)) return "NaN";
    if (!Number.isFinite(value)) return value > 0 ? "Infinity" : "-Infinity";
    // -0 and 0 stringify differently via Object.is but identically via JSON.
    return Object.is(value, -0) ? 0 : value;
  }

  if (value === null || typeof value !== "object") return value;

  if (value instanceof ArrayBuffer) return digest(new Uint8Array(value));

  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return digest(
      new Uint8Array(
        view.buffer as ArrayBuffer,
        view.byteOffset,
        view.byteLength,
      ),
    );
  }

  if (Array.isArray(value))
    return value.map((item) => canonical(item, refs, depth + 1));

  if (depth > 0 && refs?.has(value)) return refs.get(value);

  const out: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(value)) {
    out[key] = canonical(val, refs, depth + 1);
  }

  for (const getter of GETTERS) {
    if (!(getter in value)) continue;

    try {
      out[getter] = canonical(value[getter], refs, depth + 1);
    } catch (err: any) {
      out[getter] = `<error: ${err?.message ?? err}>`;
    }
  }

  return out;
}
