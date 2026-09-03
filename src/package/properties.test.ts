/**
 * The property block over hand-built bytes: one case per type, each size code,
 * each array-index encoding, and the element-0 marking.
 *
 * The corpus exercises the common paths thousands of times over, but never
 * reaches a `Class` property, an array index above 101, or a size code above
 * 5 - so those are pinned here against the engine's `FPropertyTag` serialiser.
 */

import { describe, expect, it } from "vitest";
import { BinaryCursor } from "../io/cursor.ts";
import type { ReadContext } from "../structs/context.ts";
import { readArrayIndex, readPropertyList } from "./properties.ts";

/**
 * Name-table indices below 64 encode as a single compact-index byte equal to
 * the index, so a test can spell a name reference as its position here.
 */
const NAMES = ["None", "Foo", "Vector", "Bar", "Color", "Baz"] as const;
const [NONE, FOO, VECTOR, BAR, COLOR, BAZ] = NAMES.map((_, i) => i);

function contextOver(bytes: number[]): ReadContext {
  const cursor = new BinaryCursor(new Uint8Array(bytes).buffer);

  return {
    cursor,
    version: 68,
    licenseeVersion: 0,
    name: (index?: number) => NAMES[index ?? cursor.compactIndex()],
    object: () => null,
  };
}

const read = (bytes: number[]) => readPropertyList(contextOver(bytes));

/** Info byte: type nibble, size code in bits 4-6, flag in bit 7. */
const info = (type: number, sizeCode = 0, flag = false): number =>
  type | (sizeCode << 4) | (flag ? 0x80 : 0);

const BYTE = 1;
const INTEGER = 2;
const BOOLEAN = 3;
const FLOAT = 4;
const OBJECT = 5;
const NAME = 6;
const STRING = 7;
const CLASS = 8;
const STRUCT = 10;
const STR = 13;
const MAP = 14;

describe("terminator", () => {
  it("returns an empty list for an immediate None", () => {
    expect(read([NONE])).toEqual([]);
  });

  it("stops at None and leaves the cursor after it", () => {
    const ctx = contextOver([FOO, info(BYTE), 7, NONE, 0xff]);

    expect(readPropertyList(ctx)).toHaveLength(1);
    expect(ctx.cursor.offset).toBe(4);
  });
});

describe("value types", () => {
  it("Byte", () => {
    expect(read([FOO, info(BYTE), 42, NONE])).toEqual([
      { name: "Foo", type: "Byte", value: 42 },
    ]);
  });

  it("Integer is signed", () => {
    expect(read([FOO, info(INTEGER, 2), 0xff, 0xff, 0xff, 0xff, NONE])).toEqual(
      [{ name: "Foo", type: "Integer", value: -1 }],
    );
  });

  it("Boolean takes its value from the flag bit and has no payload", () => {
    expect(
      read([FOO, info(BOOLEAN, 0, true), BAR, info(BOOLEAN), NONE]),
    ).toEqual([
      { name: "Foo", type: "Boolean", value: true },
      { name: "Bar", type: "Boolean", value: false },
    ]);
  });

  it("Float", () => {
    expect(read([FOO, info(FLOAT, 2), 0x00, 0x00, 0xc0, 0x3f, NONE])).toEqual([
      { name: "Foo", type: "Float", value: 1.5 },
    ]);
  });

  it("Object and Class are both compact-index references", () => {
    // 0x81 is compact -1: the first import.
    expect(read([FOO, info(OBJECT), 3, BAR, info(CLASS), 0x81, NONE])).toEqual([
      { name: "Foo", type: "Object", value: 3 },
      { name: "Bar", type: "Class", value: -1 },
    ]);
  });

  it("Name resolves through the name table", () => {
    expect(read([FOO, info(NAME), BAZ, NONE])).toEqual([
      { name: "Foo", type: "Name", value: "Baz" },
    ]);
  });

  it("Str reads a compact-length string", () => {
    expect(
      read([FOO, info(STR, 5), 5, 4, 0x61, 0x62, 0x63, 0x00, NONE]),
    ).toEqual([{ name: "Foo", type: "Str", value: "abc" }]);
  });

  it("String is null-terminated ANSI within the tagged size", () => {
    expect(
      read([FOO, info(STRING, 5), 6, 0x68, 0x69, 0x00, 0x00, 0x00, 0x00, NONE]),
    ).toEqual([{ name: "Foo", type: "String", value: "hi" }]);
  });

  it("Struct dispatches on the struct name, case-insensitively", () => {
    const one = [0x00, 0x00, 0x80, 0x3f];

    expect(
      read([
        FOO,
        info(STRUCT, 3),
        VECTOR,
        ...one,
        ...one,
        ...one,
        BAR,
        info(STRUCT, 2),
        COLOR,
        1,
        2,
        3,
        4,
        NONE,
      ]),
    ).toEqual([
      {
        name: "Foo",
        type: "Struct",
        subtype: "Vector",
        value: { x: 1, y: 1, z: 1 },
      },
      {
        name: "Bar",
        type: "Struct",
        subtype: "Color",
        value: { r: 1, g: 2, b: 3, a: 4 },
      },
    ]);
  });

  it("an unrecognised struct keeps its bytes", () => {
    expect(read([FOO, info(STRUCT, 1), BAZ, 0xaa, 0xbb, NONE])).toEqual([
      {
        name: "Foo",
        type: "Struct",
        subtype: "Baz",
        value: new Uint8Array([0xaa, 0xbb]),
      },
    ]);
  });

  it("a type with no reader keeps its bytes", () => {
    expect(read([FOO, info(MAP, 1), 0x01, 0x02, NONE])).toEqual([
      { name: "Foo", type: "Map", value: new Uint8Array([1, 2]) },
    ]);
  });
});

describe("size codes", () => {
  it("0-4 are fixed sizes 1, 2, 4, 12, 16", () => {
    for (const [code, size] of [
      [0, 1],
      [1, 2],
      [2, 4],
      [3, 12],
      [4, 16],
    ]) {
      const [prop] = read([FOO, info(MAP, code), ...Array(size).fill(0), NONE]);
      expect(prop.value).toHaveLength(size);
    }
  });

  it("5, 6 and 7 read a byte, word and int", () => {
    expect(read([FOO, info(MAP, 5), 3, 1, 2, 3, NONE])[0].value).toHaveLength(
      3,
    );
    expect(
      read([FOO, info(MAP, 6), 3, 0, 1, 2, 3, NONE])[0].value,
    ).toHaveLength(3);
    expect(
      read([FOO, info(MAP, 7), 3, 0, 0, 0, 1, 2, 3, NONE])[0].value,
    ).toHaveLength(3);
  });
});

describe("array index", () => {
  const index = (bytes: number[]) => readArrayIndex(contextOver(bytes));

  it("one byte below 128", () => {
    expect(index([0])).toBe(0);
    expect(index([127])).toBe(127);
  });

  it("two bytes, big-endian, from 128", () => {
    expect(index([0x80, 0x80])).toBe(128);
    expect(index([0x81, 0x02])).toBe(258);
    expect(index([0xbf, 0xff])).toBe(16383);
  });

  it("four bytes, big-endian, from 16384", () => {
    expect(index([0xc0, 0x00, 0x40, 0x00])).toBe(16384);
    expect(index([0xc0, 0x01, 0x00, 0x00])).toBe(65536);
    expect(index([0xff, 0xff, 0xff, 0xff])).toBe(0x3fffffff);
  });

  it("is read between the tag and the value", () => {
    expect(read([FOO, info(BYTE, 0, true), 0x81, 0x02, 9, NONE])).toEqual([
      { name: "Foo", type: "Byte", index: 258, value: 9 },
    ]);
  });
});

describe("element 0 marking", () => {
  it("marks the unflagged predecessor of a flagged element, in tag key order", () => {
    const props = read([
      FOO,
      info(BYTE),
      1,
      FOO,
      info(BYTE, 0, true),
      1,
      2,
      FOO,
      info(BYTE, 0, true),
      2,
      3,
      NONE,
    ]);

    expect(props).toEqual([
      { name: "Foo", type: "Byte", index: 0, value: 1 },
      { name: "Foo", type: "Byte", index: 1, value: 2 },
      { name: "Foo", type: "Byte", index: 2, value: 3 },
    ]);
    expect(props.map((p) => Object.keys(p).join())).toEqual(
      Array(3).fill("name,type,index,value"),
    );
  });

  it("keeps subtype before index for a struct array", () => {
    const props = read([
      FOO,
      info(STRUCT, 2),
      COLOR,
      1,
      1,
      1,
      1,
      FOO,
      info(STRUCT, 2, true),
      COLOR,
      1,
      2,
      2,
      2,
      2,
      NONE,
    ]);

    expect(props.map((p) => Object.keys(p).join())).toEqual(
      Array(2).fill("name,type,subtype,index,value"),
    );
    expect(props[0]).toMatchObject({ subtype: "Color", index: 0 });
  });

  it("does not mark a differently named predecessor", () => {
    expect(
      read([BAR, info(BYTE), 1, FOO, info(BYTE, 0, true), 1, 2, NONE]),
    ).toEqual([
      { name: "Bar", type: "Byte", value: 1 },
      { name: "Foo", type: "Byte", index: 1, value: 2 },
    ]);
  });

  it("does not touch a predecessor that already has an index", () => {
    expect(
      read([
        FOO,
        info(BYTE, 0, true),
        3,
        1,
        FOO,
        info(BYTE, 0, true),
        4,
        2,
        NONE,
      ]),
    ).toEqual([
      { name: "Foo", type: "Byte", index: 3, value: 1 },
      { name: "Foo", type: "Byte", index: 4, value: 2 },
    ]);
  });
});
