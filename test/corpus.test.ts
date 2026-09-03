/**
 * Golden snapshot regression tests.
 *
 * Every package in test/corpus is parsed in full and compared against a
 * committed snapshot. Run after any change to the reader:
 *
 *   npm test              check
 *   npm run test:update   accept changes
 *
 * The corpus is gitignored (copyrighted game assets); the snapshots are not,
 * because they contain no reconstructable asset data. Missing corpus means the
 * suite skips rather than fails, so a clone without game files stays green.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { UnrealPackageReader } from "../src/index.ts";
import { buildSnapshot, discoverCorpus, readArrayBuffer } from "./snapshot.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(HERE, "corpus");

const packages = discoverCorpus(CORPUS_DIR);

describe.skipIf(packages.length === 0)("corpus", () => {
  for (const name of packages) {
    it(name, async () => {
      const source = readArrayBuffer(join(CORPUS_DIR, name));
      const pkg = new UnrealPackageReader(source).readPackage();
      const { text } = buildSnapshot(pkg, name, source);

      await expect(text).toMatchFileSnapshot(
        join(HERE, "snapshots", `${name}.txt`),
      );
    });

    /**
     * The properties getter caches, and on re-entry seeks to the offset the
     * first parse ended at. Every exit path must therefore record one - an
     * early return that forgets leaves the second access seeking to undefined,
     * which turns the shared cursor into NaN for everything after it.
     *
     * Snapshots cannot catch this on their own, because they read each export's
     * properties exactly once.
     */
    it(`${name} - repeated property access keeps the cursor intact`, () => {
      const source = readArrayBuffer(join(CORPUS_DIR, name));
      const pkg = new UnrealPackageReader(source).readPackage();

      for (const obj of pkg.exportTable) {
        try {
          void obj.properties;
        } catch {
          // Parse failures are pinned in the snapshot; they leave the cache in
          // a partial state by design and are not this test's concern.
          continue;
        }

        const afterFirst = pkg.package.cursor.offset;
        void obj.properties;

        expect(
          pkg.package.cursor.offset,
          `${obj.objectName} (export ${obj.class_index})`,
        ).toBe(afterFirst);
      }
    });
  }
});

it.skipIf(packages.length > 0)("corpus is empty", () => {
  console.warn(
    "No packages in test/corpus - snapshot tests skipped.\n" +
      "Add .u/.unr/.utx/.uax/.umx files locally; see test/README.md.",
  );
  expect(packages).toEqual([]);
});
