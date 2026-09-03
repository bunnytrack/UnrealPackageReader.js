/**
 * Snapshot construction.
 *
 * The committed snapshot is a line-oriented text report rather than JSON.
 *
 * Each export carries a hash of its complete parse, so nothing is unchecked
 * even though the parse itself is not in the file. When a hash moves, `dump.ts`
 * writes the full JSON so the change can actually be read.
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { buildRefIndex, canonical, hash, type RefIndex } from "./serialise.ts";

const PACKAGE_EXTENSIONS = ["u", "unr", "utx", "uax", "umx", "uxx"];

/**
 * Read a file as a standalone ArrayBuffer. Node pools Buffer allocations, so
 * `buf.buffer` is usually a larger shared block - slicing to the exact view is
 * required or the reader sees adjacent files' bytes.
 */
export function readArrayBuffer(path: string): ArrayBuffer {
  const buf = readFileSync(path);
  return buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  ) as ArrayBuffer;
}

export interface ObjectDeep {
  properties: unknown;
  data: unknown;
  error?: string;
}

export interface Snapshot {
  text: string;
  deep: Record<string, ObjectDeep>;
}

/**
 * Find packages under a directory, recursively. Corpus files are grouped into
 * per-release subfolders, and the relative path is what identifies a snapshot -
 * the same filename can exist in several game builds.
 */
export function discoverCorpus(dir: string): string[] {
  if (!existsSync(dir)) return [];

  const found: string[] = [];

  const walk = (current: string): void => {
    for (const entry of readdirSync(current).sort()) {
      const path = join(current, entry);

      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }

      const ext = entry.split(".").pop()?.toLowerCase() ?? "";
      if (PACKAGE_EXTENSIONS.includes(ext)) found.push(path);
    }
  };

  walk(dir);

  // Forward slashes so snapshot paths match across platforms.
  return found.map((path) => relative(dir, path).split(sep).join("/"));
}

/**
 * Pad to a column width, but always emit at least one trailing space.
 */
const pad = (value: unknown, width: number): string => {
  const str = String(value);
  return str.length < width ? str.padEnd(width) : `${str} `;
};

const padStart = (value: unknown, width: number): string =>
  String(value).padStart(width);
const hex = (value: number, digits = 8): string =>
  "0x" + (value >>> 0).toString(16).padStart(digits, "0");

/** Parse one export completely. Errors are captured, not thrown. */
function readDeep(obj: any, refs: RefIndex): ObjectDeep {
  try {
    return {
      properties: canonical(obj.properties, refs, 1),
      data: canonical(obj.readData(), refs, 1),
    };
  } catch (err: any) {
    return { properties: null, data: null, error: String(err?.message ?? err) };
  }
}

function renderHeader(header: Record<string, any>): string[] {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(header)) {
    if (key === "generations") continue;

    const rendered =
      key === "signature" || key === "package_flags"
        ? hex(value)
        : String(value);

    lines.push(`  ${pad(key, 20)}${rendered}`);
  }

  for (const [i, gen] of (header.generations ?? []).entries()) {
    lines.push(
      `  ${pad(`generation[${i}]`, 20)}exports=${gen.export_count} names=${gen.name_count}`,
    );
  }

  return lines;
}

export function buildSnapshot(
  pkg: any,
  name: string,
  source: ArrayBuffer,
): Snapshot {
  const refs = buildRefIndex(pkg);
  const deep: Record<string, ObjectDeep> = {};
  const lines: string[] = [];

  lines.push(`package  ${name}`);
  lines.push(`bytes    ${source.byteLength}`);
  // Ties the snapshot to the exact input. A different build of a same-named
  // file fails here, immediately and legibly, instead of as a thousand
  // confusing parse diffs further down.
  lines.push(
    `sha256   ${createHash("sha256").update(new Uint8Array(source)).digest("hex")}`,
  );

  lines.push("", "[header]", ...renderHeader(pkg.header));

  const classes = pkg.getClassesCount();
  lines.push("", `[classes] ${Object.keys(classes).length}`);
  for (const className of Object.keys(classes).sort()) {
    lines.push(`  ${pad(className, 24)}${classes[className]}`);
  }

  lines.push("", `[names] ${pkg.nameTable.length}`);
  for (const [i, entry] of pkg.nameTable.entries()) {
    lines.push(
      `  ${padStart(i, 5)}  ${pad(hex(entry.flags), 12)}${entry.name}`,
    );
  }

  lines.push("", `[imports] ${pkg.importTable.length}`);
  lines.push(
    `  ${padStart("idx", 5)}  ${pad("class", 18)}${pad("classpkg", 14)}${pad("package", 20)}name`,
  );
  for (const [i, obj] of pkg.importTable.entries()) {
    lines.push(
      `  ${padStart(-(i + 1), 5)}  ${pad(obj.className, 18)}${pad(obj.classPackageName, 14)}` +
        `${pad(obj.packageName ?? "-", 20)}${obj.objectName}`,
    );
  }

  lines.push("", `[exports] ${pkg.exportTable.length}`);
  lines.push(
    `  ${padStart("idx", 5)}  ${pad("class", 18)}${pad("package", 20)}${pad("name", 28)}` +
      `${pad("flags", 12)}${pad("serial", 18)}${pad("props", 7)}parse`,
  );

  for (const [i, obj] of pkg.exportTable.entries()) {
    const index = i + 1;
    const parsed = readDeep(obj, refs);

    deep[`export:${index}`] = parsed;

    const serial = obj.hasData
      ? `${obj.serial_offset}+${obj.serial_size}`
      : "-";
    const props = Array.isArray(parsed.properties)
      ? parsed.properties.length
      : "-";
    // flagNames is derived entirely from object_flags, so the hex is the
    // complete record and the expanded list would be pure duplication.
    const parse = parsed.error
      ? `ERROR ${parsed.error}`
      : hash(parsed).replace("sha256:", "");

    lines.push(
      `  ${padStart(index, 5)}  ${pad(obj.className ?? "-", 18)}${pad(obj.packageName ?? "-", 20)}` +
        `${pad(obj.objectName, 28)}${pad(hex(obj.object_flags), 12)}${pad(serial, 18)}` +
        `${pad(props, 7)}${parse}`,
    );
  }

  return { text: lines.join("\n") + "\n", deep };
}
