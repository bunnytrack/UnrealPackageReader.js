/**
 * The tagged property block: the UnrealScript variables an object saved
 * because they differed from its class defaults.
 *
 * Every export with data begins with one of these (after a `StateFrame` when
 * `RF_HasStack` is set), terminated by the name `None`. Each entry is a *tag* -
 * name, packed info byte, optional struct name, optional size, optional array
 * index - followed by the value. The engine's `FPropertyTag` serialiser
 * defines the tag layout, and `UStruct::SerializeTaggedProperties` is the loop
 * around it.
 *
 * The info byte packs three things:
 *
 *   bits 0-3  the type nibble, indexing `PROPERTY_TYPES`
 *   bits 4-6  the size code: 1, 2, 4, 12, 16 bytes, or "a byte / word / int
 *             follows with the real size"
 *   bit 7     for a Boolean, the value itself; for anything else, "an array
 *             index follows"
 *
 * The size is redundant for every type this reader understands - it exists so
 * the engine can skip a property whose class it no longer recognises - and is
 * what lets the unrecognised ones here be carried as raw bytes rather than
 * lost.
 *
 * On static arrays: the engine writes one tagged entry per element that differs
 * from the default, in ascending order, and element 0 is written *without* the
 * array flag - it is indistinguishable in the file from a plain property. When
 * a flagged element follows an unflagged property of the same name, that
 * previous property is therefore element 0 and is marked as such after the
 * fact. The engine itself never needs this, because it has the class and knows
 * which names are arrays; a reader without the class can only infer it.
 */

import { readStringProperty, decodeText } from "../io/text.ts";
import {
  PROPERTY_TYPES,
  type PropertyTypeName,
} from "../constants/propertyTypes.ts";
import type { ReadContext } from "../structs/context.ts";
import {
  readColour,
  readPointRegion,
  readRotator,
  readScale,
  readVector,
  type Colour,
  type PointRegion,
  type Rotator,
  type Scale,
  type Vector,
} from "../structs/geometry.ts";

/**
 * Tag fields shared by every property.
 *
 * `index` is present only on static-array elements. `value` is always present:
 * a property whose type or struct the reader does not interpret carries its
 * bytes verbatim instead of nothing.
 */
export interface PropertyTag<T extends PropertyTypeName> {
  name: string;
  type: T;
  index?: number;
}

/** A single byte - the engine's `byte`, and how an enum value is stored. */
export interface ByteProperty extends PropertyTag<"Byte"> {
  value: number;
}

/** A signed 32-bit integer. */
export interface IntegerProperty extends PropertyTag<"Integer"> {
  value: number;
}

/** The value is bit 7 of the info byte; a Boolean has no payload bytes. */
export interface BooleanProperty extends PropertyTag<"Boolean"> {
  value: boolean;
}

/** A 32-bit float. */
export interface FloatProperty extends PropertyTag<"Float"> {
  value: number;
}

/**
 * An object reference as stored in the file: positive for a 1-based
 * export-table entry, negative for a bitwise-complemented import-table entry,
 * zero for none. `UnrealPackageReader.getObject` resolves one to its table
 * entry.
 */
export type ObjectIndex = number;

/** An object reference. */
export interface ObjectProperty extends PropertyTag<"Object"> {
  value: ObjectIndex;
}

/**
 * A `class<...>` variable: an object reference to a class, serialised exactly
 * like `Object`. The engine's `UClassProperty` is a `UObjectProperty` subclass
 * with its own type ID and an unchanged `SerializeItem`.
 */
export interface ClassProperty extends PropertyTag<"Class"> {
  value: ObjectIndex;
}

/** A name: stored as a compact index into the name table, resolved to its text. */
export interface NameProperty extends PropertyTag<"Name"> {
  value: string;
}

/** A dynamic string, whose length prefix selects ANSI or UTF-16LE. */
export interface StrProperty extends PropertyTag<"Str"> {
  value: string;
}

/**
 * The pre-`Str` fixed-length string, still found in a few old packages. The
 * engine reads it as null-terminated ANSI within the tagged size, which is
 * what is done here.
 */
export interface StringProperty extends PropertyTag<"String"> {
  value: string;
}

/**
 * A struct the reader knows the layout of. `subtype` is the struct's name as
 * written in the file. The name is matched case-insensitively when choosing
 * how to parse the value; the literal types here use the engine's spelling,
 * the only spelling that appears in real packages.
 */
export type StructProperty = PropertyTag<"Struct"> &
  (
    | { subtype: "Color"; value: Colour }
    | { subtype: "Vector"; value: Vector }
    | { subtype: "Rotator"; value: Rotator }
    | { subtype: "Scale"; value: Scale }
    | { subtype: "PointRegion"; value: PointRegion }
    | { subtype: string; value: Uint8Array }
  );

/**
 * Types with no reader here. `Array`, `Map` and `Fixed Array` were reserved
 * but unused by Unreal 1; `Vector` and `Rotator` are legacy IDs superseded by
 * `Struct` with a subtype; `Unknown` is this reader's own label for nibble 0,
 * which the engine reserves for `NAME_None` and never writes as a type. The
 * bytes are kept.
 */
export interface RawProperty extends PropertyTag<
  "Unknown" | "Array" | "Vector" | "Rotator" | "Map" | "Fixed Array"
> {
  value: Uint8Array;
}

export type Property =
  | ByteProperty
  | IntegerProperty
  | BooleanProperty
  | FloatProperty
  | ObjectProperty
  | ClassProperty
  | NameProperty
  | StrProperty
  | StringProperty
  | StructProperty
  | RawProperty;

/**
 * Sizes for the five fixed size codes; codes 5-7 read the size from the stream
 * as a byte, word or int respectively.
 */
const FIXED_SIZES = [1, 2, 4, 12, 16] as const;

function readSize(ctx: ReadContext, sizeCode: number): number {
  const { cursor } = ctx;

  switch (sizeCode) {
    case 5:
      return cursor.uint8();
    case 6:
      return cursor.uint16();
    case 7:
      return cursor.uint32();
    default:
      return FIXED_SIZES[sizeCode];
  }
}

/**
 * A static-array element index, in the engine's own variable-length encoding:
 *
 *   ```text
 *   0xxxxxxx                             one byte, 0-127
 *   10xxxxxx xxxxxxxx                    two bytes, big-endian, 128-16383
 *   11xxxxxx xxxxxxxx xxxxxxxx xxxxxxxx  four bytes, big-endian
 *   ```
 *
 * Big-endian, unlike every other multi-byte integer in the format, because it
 * is written byte by byte rather than as a word. This is not a compact index -
 * that encoding puts its continuation bit in a different place.
 */
export function readArrayIndex(ctx: ReadContext): number {
  const { cursor } = ctx;
  const first = cursor.uint8();

  if ((first & 0x80) === 0) {
    return first;
  }

  if ((first & 0xc0) === 0x80) {
    return ((first & 0x7f) << 8) | cursor.uint8();
  }

  return (
    ((first & 0x3f) << 24) |
    (cursor.uint8() << 16) |
    (cursor.uint8() << 8) |
    cursor.uint8()
  );
}

/**
 * The struct readers the property block dispatches to, keyed by the lowercased
 * struct name. Anything not here is carried as raw bytes.
 */
const STRUCT_READERS: Record<string, (ctx: ReadContext) => unknown> = {
  color: readColour,
  vector: readVector,
  rotator: readRotator,
  scale: readScale,
  pointregion: readPointRegion,
};

/** Null-terminated ANSI within a fixed size, for the legacy `String` type. */
function readFixedString(ctx: ReadContext, size: number): string {
  const bytes = ctx.cursor.bytes(size);
  const terminator = bytes.indexOf(0);

  return decodeText(terminator === -1 ? bytes : bytes.subarray(0, terminator));
}

/**
 * Read one tagged property. Returns null at the `None` terminator.
 */
export function readProperty(ctx: ReadContext): Property | null {
  const { cursor } = ctx;

  const name = ctx.name();
  if (name.toLowerCase() === "none") return null;

  const info = cursor.uint8();
  const type = PROPERTY_TYPES[info & 0x0f];
  const subtype = type === "Struct" ? ctx.name() : undefined;
  const size = readSize(ctx, (info >> 4) & 0x7);

  // Bit 7 is the array flag - except for a Boolean, where it is the value and
  // no index follows.
  const flag = Boolean(info & 0x80);
  const index = flag && type !== "Boolean" ? readArrayIndex(ctx) : undefined;

  const tag = {
    name,
    type,
    ...(subtype !== undefined ? { subtype } : {}),
    ...(index !== undefined ? { index } : {}),
  };

  switch (type) {
    case "Byte":
      return { ...tag, type, value: cursor.uint8() };
    case "Integer":
      return { ...tag, type, value: cursor.int32() };
    case "Boolean":
      return { ...tag, type, value: flag };
    case "Float":
      return { ...tag, type, value: cursor.float32() };
    case "Object":
      return { ...tag, type, value: cursor.compactIndex() };
    case "Class":
      return { ...tag, type, value: cursor.compactIndex() };
    case "Name":
      return { ...tag, type, value: ctx.name() };
    case "Str":
      return { ...tag, type, value: readStringProperty(cursor) };
    case "String":
      return { ...tag, type, value: readFixedString(ctx, size) };
    case "Struct": {
      const read = STRUCT_READERS[subtype!.toLowerCase()];
      return {
        ...tag,
        type,
        subtype: subtype!,
        value: read ? read(ctx) : cursor.bytes(size),
      } as StructProperty;
    }
    default:
      return { ...tag, type, value: cursor.bytes(size) };
  }
}

/**
 * Read a whole property block, up to and including its `None` terminator.
 *
 * Marks element 0 of each static array as described in the module comment: a
 * flagged element arriving directly after a same-named, unmarked property
 * identifies that property as element 0. The rebuilt literal keeps `index` in
 * tag position rather than appending it, so the key order of a retroactively
 * marked element matches one read with the flag.
 */
export function readPropertyList(ctx: ReadContext): Property[] {
  const properties: Property[] = [];

  for (
    let property = readProperty(ctx);
    property;
    property = readProperty(ctx)
  ) {
    const previous = properties[properties.length - 1];

    if (
      property.index !== undefined &&
      previous &&
      previous.index === undefined &&
      previous.name === property.name
    ) {
      const { name, type, ...rest } = previous;
      properties[properties.length - 1] = {
        name,
        type,
        ...("subtype" in rest ? { subtype: rest.subtype } : {}),
        index: 0,
        value: rest.value,
      } as Property;
    }

    properties.push(property);
  }

  return properties;
}
