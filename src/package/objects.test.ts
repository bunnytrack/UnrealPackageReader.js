/**
 * Behaviour of the table entries that does not need a package to demonstrate.
 */

import { describe, expect, it } from "vitest";
import { BinaryCursor } from "../io/cursor.ts";
import {
  ExportTableObject,
  type ObjectContext,
  type UObject,
} from "./objects.ts";

/** A context over a fixed set of entries, indexed the way `object()` is. */
function resolverOver(entries: UObject[]): ObjectContext {
  return {
    cursor: new BinaryCursor(new ArrayBuffer(64)),
    version: 68,
    licenseeVersion: 0,
    name: (index?: number) => `name${index ?? "?"}`,
    object: (index: number) =>
      index === 0 ? null : (entries[index - 1] ?? null),
  };
}

/** An export whose fields are all zero, so nothing is read from real bytes. */
function emptyExport(ctx: ObjectContext): ExportTableObject {
  return new ExportTableObject(ctx, new BinaryCursor(new ArrayBuffer(64)));
}

describe("uppermostPackageObject", () => {
  it("returns itself when the object is in no package", () => {
    const object = emptyExport(resolverOver([]));

    expect(object.package_index).toBe(0);
    expect(object.uppermostPackageObject).toBe(object);
  });

  it("walks to the outermost container", () => {
    const entries: UObject[] = [];
    const resolver = resolverOver(entries);

    const outer = emptyExport(resolver);
    const middle = emptyExport(resolver);
    const inner = emptyExport(resolver);
    entries.push(outer, middle, inner);

    middle.package_index = 1; // -> outer
    inner.package_index = 2; // -> middle

    expect(inner.uppermostPackageObject).toBe(outer);
  });

  it("throws rather than hanging when the chain forms a cycle", () => {
    const entries: UObject[] = [];
    const resolver = resolverOver(entries);

    const first = emptyExport(resolver);
    const second = emptyExport(resolver);
    entries.push(first, second);

    // Each claims to live inside the other, which a corrupt package index can
    // produce. An unbounded walk would never return.
    first.package_index = 2;
    second.package_index = 1;

    expect(() => first.uppermostPackageObject).toThrow(
      /exceeds 128 levels: the package indices form a cycle/,
    );
  });
});
