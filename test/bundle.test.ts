/**
 * The shipped bundle actually works.
 *
 * `npm run build` produces `dist/UnrealPackageReader.js`, an IIFE that the demo
 * loads with a plain `<script src>` and that publishes `UnrealPackageReader` on
 * the global. A stale or broken `dist/` is invisible when developing against
 * `src/` and only bites whoever loads the built file, so this smoke test loads
 * the artefact the way a browser would and parses a package through it.
 *
 * Skipped when `dist/` is absent (no `npm run build`), so a source-only CI run
 * stays green.
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const DIST = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "dist",
  "UnrealPackageReader.js",
);

const SIGNATURE_UT = 0x9e2a83c1;

/** The smallest package the reader accepts: one name, one empty export. */
function minimalPackage(): ArrayBuffer {
  const bytes: number[] = [];
  const u8 = (v: number) => bytes.push(v & 0xff);
  const u16 = (v: number) => {
    u8(v);
    u8(v >> 8);
  };
  const u32 = (v: number) => {
    u16(v);
    u16(v >>> 16);
  };

  u32(SIGNATURE_UT);
  u16(68); // version >= 68 selects the GUID/generations header
  u16(0); // licensee version
  u32(0); // package flags
  u32(1); // name count
  u32(56); // name offset (header is 56 bytes here)
  u32(1); // export count
  u32(66); // export offset (after the one name-table entry)
  u32(0); // import count
  u32(0); // import offset
  u32(0); // guid
  u32(0);
  u32(0);
  u32(0);
  u32(0); // generation count

  // Name table: length-prefixed "None\0", then name flags.
  u8(5);
  for (const c of "None") u8(c.charCodeAt(0));
  u8(0);
  u32(0);

  // Export table: class, super, package, name, flags, serial size - all zero.
  u8(0);
  u8(0);
  u32(0);
  u8(0);
  u32(0);
  u8(0);

  return new Uint8Array(bytes).buffer;
}

describe.skipIf(!existsSync(DIST))("built bundle", () => {
  it("publishes the constructor on the global and parses a package", async () => {
    // Importing the IIFE runs its globalThis assignment, as the demo's
    // <script src> tag would.
    await import(/* @vite-ignore */ pathToFileURL(DIST).href);

    const UnrealPackageReader = (globalThis as any).UnrealPackageReader;
    expect(typeof UnrealPackageReader, "global constructor").toBe("function");

    const pkg = new UnrealPackageReader(minimalPackage()).readPackage();

    expect(pkg.version).toBe(68);
    expect(pkg.exportTable).toHaveLength(1);
    expect(pkg.exportTable[0].objectName).toBe("None");
  });
});
