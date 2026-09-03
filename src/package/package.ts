/**
 * A parsed package: the header, the name table, and both object tables.
 *
 * This is also the `ReadContext` implementation the struct readers consume.
 * Name and object resolution live here because this is the first layer that
 * can see the tables.
 */

import { BinaryCursor } from "../io/cursor.ts";
import type { ReadContext } from "../structs/context.ts";
import { readPackageHeader, type PackageHeader } from "./header.ts";
import { readNameTable, type NameTableEntry } from "./nameTable.ts";
import {
  ExportTableObject,
  ImportTableObject,
  type TableResolver,
  type UObject,
} from "./objects.ts";

export class UnrealPackage implements ReadContext, TableResolver {
  readonly cursor: BinaryCursor;
  readonly header: PackageHeader;
  readonly nameTable: NameTableEntry[];
  readonly exportTable: ExportTableObject[];
  readonly importTable: ImportTableObject[];

  constructor(buffer: ArrayBuffer) {
    this.cursor = new BinaryCursor(buffer);

    // Strictly ordered: the header locates the name table, the name table gives
    // every later index its meaning, and both tables are seeked to explicitly.
    this.header = readPackageHeader(this.cursor);
    this.nameTable = readNameTable(this.cursor, this.header);

    this.cursor.seek(this.header.export_offset);
    this.exportTable = Array.from(
      { length: this.header.export_count },
      () => new ExportTableObject(this, this.cursor),
    );

    this.cursor.seek(this.header.import_offset);
    this.importTable = Array.from(
      { length: this.header.import_count },
      () => new ImportTableObject(this, this.cursor),
    );
  }

  get version(): number {
    return this.header.version;
  }

  get licenseeVersion(): number {
    return this.header.licensee_version;
  }

  /**
   * Resolve a name-table entry, reading a compact index from the cursor when no
   * index is given - which is how a struct field holding a name is stored.
   */
  name = (index?: number): string => {
    return this.nameTable[index ?? this.cursor.compactIndex()].name;
  };

  /**
   * Resolve an object reference. Zero is no object, a positive value is a
   * 1-based export index, and a negative value is a bitwise-complemented import
   * index - so -1 is the first import.
   *
   * An index past the end of either table returns null.
   */
  object = (index: number): UObject | null => {
    if (index === 0) return null;

    return (
      (index < 0 ? this.importTable[~index] : this.exportTable[index - 1]) ??
      null
    );
  };

  /** First export whose name matches exactly, or null. */
  getExportObjectByName(objectName: string): ExportTableObject | null {
    return (
      this.exportTable.find((object) => object.objectName === objectName) ??
      null
    );
  }
}
