/**
 * The export and import table entries.
 */

import type { BinaryCursor } from "../io/cursor.ts";
import {
  OBJECT_FLAGS,
  decodeObjectFlags,
  type ObjectFlagName,
} from "../constants/flags.ts";
import type { ReadContext } from "../structs/context.ts";
import { readStateFrame, type StateFrame } from "../structs/stateFrame.ts";
import { readPropertyList, type Property } from "./properties.ts";
import {
  isNativeClassName,
  readNativeData,
  type NativeData,
} from "../natives/index.ts";

/** Cap on the package chain walk, so a cycle in corrupt indices cannot hang. */
const MAX_PACKAGE_DEPTH = 128;

/**
 * What a table entry needs in order to resolve its own references.
 */
export interface TableResolver {
  readonly name: (index?: number) => string;
  readonly object: (index: number) => UObject | null;
}

/**
 * What an export needs in order to read its own data: the resolver for its
 * references, plus the cursor and version.
 */
export type ObjectContext = ReadContext & TableResolver;

/**
 * An entry in an object's property list. The `StateFrame` is not a property,
 * but it is stored at the head of the block and listed alongside the real
 * ones.
 */
export type PropertyListEntry = Property | StateFrame;

/** Fields and behaviour common to import/export table objects. */
export abstract class UObject {
  package_index = 0;
  object_name_index = 0;

  protected readonly resolver: TableResolver;

  constructor(resolver: TableResolver) {
    this.resolver = resolver;
  }

  /** Which table this entry came from. */
  abstract get table(): "export" | "import";

  get objectName(): string {
    return this.resolver.name(this.object_name_index);
  }

  /**
   * The object this one lives inside - its group, or the package itself.
   *
   * Zero means "not in any package", which `object()` returns as null.
   */
  get packageObject(): UObject | null {
    return this.resolver.object(this.package_index);
  }

  get packageName(): string | null {
    return this.packageObject?.objectName || null;
  }

  get isInPackage(): boolean {
    return Boolean(this.packageObject);
  }

  /**
   * Walks the package chain to the outermost container.
   */
  get uppermostPackageObject(): UObject {
    let parent: UObject = this;

    for (let depth = 0; parent.packageObject; depth++) {
      if (depth === MAX_PACKAGE_DEPTH) {
        throw new Error(
          `Package chain for "${this.objectName}" exceeds ` +
            `${MAX_PACKAGE_DEPTH} levels: the package indices form a cycle`,
        );
      }

      parent = parent.packageObject;
    }

    return parent;
  }

  get uppermostPackageObjectName(): string {
    return this.uppermostPackageObject.objectName;
  }
}

/**
 * An object stored in this package, with its serialised data.
 *
 * `serial_offset` is only written when `serial_size` is non-zero: with no data
 * there is nothing for an offset to point at.
 */
export class ExportTableObject extends UObject {
  class_index: number;
  super_index: number;
  object_flags: number;
  serial_size: number;
  serial_offset?: number;

  readonly #ctx: ObjectContext;
  #properties?: PropertyListEntry[];
  #propertiesEndOffset = 0;
  #objectData?: ObjectData | null;

  constructor(ctx: ObjectContext, cursor: BinaryCursor = ctx.cursor) {
    super(ctx);
    this.#ctx = ctx;

    this.class_index = cursor.compactIndex();
    this.super_index = cursor.compactIndex();
    this.package_index = cursor.int32();
    this.object_name_index = cursor.compactIndex();
    this.object_flags = cursor.uint32();
    this.serial_size = cursor.compactIndex();

    if (this.hasData) {
      this.serial_offset = cursor.compactIndex();
    }
  }

  override get table(): "export" {
    return "export";
  }

  /** The class this object is an instance of, or null for a classless export. */
  get classObject(): UObject | null {
    return this.resolver.object(this.class_index);
  }

  get parentObject(): UObject | null {
    return this.resolver.object(this.super_index);
  }

  get className(): string | null {
    return this.classObject?.objectName || null;
  }

  get parentObjectName(): string | null {
    return this.parentObject?.objectName || null;
  }

  get flagNames(): ObjectFlagName[] {
    return decodeObjectFlags(this.object_flags);
  }

  get hasData(): boolean {
    return this.serial_size > 0;
  }

  hasFlag(flag: number): boolean {
    return Boolean(this.object_flags & flag);
  }

  /**
   * The object's saved properties, read on first access and cached.
   */
  get properties(): PropertyListEntry[] {
    if (this.#properties) {
      this.#ctx.cursor.seek(this.#propertiesEndOffset);
      return this.#properties;
    }

    const properties: PropertyListEntry[] = (this.#properties = []);

    if (this.hasData) {
      this.#ctx.cursor.seek(this.serial_offset!);

      if (this.hasFlag(OBJECT_FLAGS.RF_HasStack)) {
        properties.push(readStateFrame(this.#ctx));
      }

      if (this.class_index !== 0) {
        properties.push(...readPropertyList(this.#ctx));
      }
    }

    this.#propertiesEndOffset = this.#ctx.cursor.offset;

    return properties;
  }

  /** First property with this name, compared case-insensitively. */
  getProp(name: string): PropertyListEntry | undefined {
    const wanted = name.toLowerCase();
    return this.properties.find((prop) => prop.name.toLowerCase() === wanted);
  }

  /**
   * The object's complete parse: its properties followed by its native class
   * data, or null for a class the reader has no native reader for.
   *
   * `properties` is evaluated first, which is what positions the cursor at the
   * start of the native data. Read once and cached.
   */
  readData(): ObjectData | null {
    if (this.#objectData !== undefined) return this.#objectData;

    if (!isNativeClassName(this.className)) {
      return (this.#objectData = null);
    }

    const properties = this.properties;
    const data = readNativeData(this.#ctx, this.className)!;

    return (this.#objectData = { properties, ...data });
  }
}

/** A native parse, with the property block it followed. */
export type ObjectData = { properties: PropertyListEntry[] } & NativeData;

/** A reference to an object supplied by another package. */
export class ImportTableObject extends UObject {
  class_package_index: number;
  class_name_index: number;

  constructor(resolver: TableResolver, cursor: BinaryCursor) {
    super(resolver);

    this.class_package_index = cursor.compactIndex();
    this.class_name_index = cursor.compactIndex();
    this.package_index = cursor.int32();
    this.object_name_index = cursor.compactIndex();
  }

  override get table(): "import" {
    return "import";
  }

  get classPackageName(): string {
    return this.resolver.name(this.class_package_index);
  }

  get className(): string {
    return this.resolver.name(this.class_name_index);
  }
}
