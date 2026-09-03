/**
 * The name table: every string a package refers to, stored once.
 *
 * Names are the format's string pool. A struct field holding a name stores a
 * compact index into this table rather than the text, which is why almost
 * nothing can be read before the table is built.
 */

import type { BinaryCursor } from "../io/cursor.ts";
import { readNullTerminatedText, readSizedText } from "../io/text.ts";
import type { PackageHeader } from "./header.ts";

export interface NameTableEntry {
  name: string;
  flags: number;
}

/**
 * Version 64 changed the encoding from a bare null-terminated string to a
 * length-prefixed one. Both forms carry the same trailing flags word.
 */
export function readNameTable(
  cursor: BinaryCursor,
  header: PackageHeader,
): NameTableEntry[] {
  cursor.seek(header.name_offset);

  const readName =
    header.version < 64
      ? () => readNullTerminatedText(cursor)
      : () => readSizedText(cursor);

  const nameTable: NameTableEntry[] = new Array(header.name_count);

  for (let i = 0; i < header.name_count; i++) {
    nameTable[i] = {
      name: readName(),
      flags: cursor.uint32(),
    };
  }

  return nameTable;
}
