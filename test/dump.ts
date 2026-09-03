/**
 * Deep dump - writes the full parse of a package as JSON, for diagnosing a
 * snapshot mismatch. Run directly; Node 24 strips the types itself.
 *
 *   node test/dump.ts                              every package in test/corpus
 *   node test/dump.ts --file unreal-226/DmDeck16.unr
 *   node test/dump.ts --out /tmp/dumps
 *
 * Output is gitignored: unlike the snapshots, a deep dump is a fairly complete
 * description of the source asset.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { UnrealPackageReader } from "../src/index.ts";
import { buildSnapshot, discoverCorpus, readArrayBuffer } from "./snapshot.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

const { values } = parseArgs({
  options: {
    file: { type: "string", multiple: true },
    corpus: { type: "string", default: join(HERE, "corpus") },
    out: { type: "string", default: join(HERE, "deep") },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (values.help) {
  console.log(
    "node test/dump.ts [--file <relative path>]... [--corpus <dir>] [--out <dir>]",
  );
  process.exit(0);
}

const corpusDir = values.corpus!;
const outDir = values.out!;
const packages = values.file?.length ? values.file : discoverCorpus(corpusDir);

if (packages.length === 0) {
  console.log(`No packages found in ${corpusDir}`);
  process.exit(0);
}

for (const name of packages) {
  const source = readArrayBuffer(join(corpusDir, name));
  const pkg = new UnrealPackageReader(source).readPackage();
  const { deep } = buildSnapshot(pkg, name, source);

  const target = join(outDir, `${name}.json`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(deep, null, 2) + "\n");

  const errors = Object.values(deep).filter((entry) => entry.error).length;
  console.log(
    `  ${name} -> ${target}` +
      (errors > 0 ? `  (${errors} objects unreadable)` : ""),
  );
}
