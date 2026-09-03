import { describe, expect, it } from "vitest";
import { BinaryCursor, readArray } from "./cursor.ts";

const cursorOver = (bytes: number[]) =>
  new BinaryCursor(new Uint8Array(bytes).slice().buffer);

describe("cursor position", () => {
  it("tracks length and remaining", () => {
    const cursor = cursorOver([1, 2, 3, 4]);

    expect(cursor.length).toBe(4);
    expect(cursor.remaining).toBe(4);

    cursor.uint16();
    expect(cursor.remaining).toBe(2);

    cursor.seek(0);
    expect(cursor.remaining).toBe(4);

    cursor.skip(3);
    expect(cursor.offset).toBe(3);
  });
});

describe("bytes", () => {
  it("returns a copy, not a view into the buffer", () => {
    const source = new Uint8Array([1, 2, 3, 4]);
    const cursor = new BinaryCursor(source.slice().buffer);
    const taken = cursor.bytes(2);

    taken[0] = 0xff;
    expect(new Uint8Array(cursor.buffer)[0]).toBe(1);
  });

  it("refuses to read past the end", () => {
    const cursor = cursorOver([1, 2, 3]);
    cursor.skip(1);

    expect(() => cursor.bytes(5)).toThrow(
      /cannot read 5 bytes at offset 1: only 2 of 3 remain/i,
    );
  });

  it("refuses a negative length", () => {
    expect(() => cursorOver([1, 2]).bytes(-1)).toThrow(/cannot be negative/i);
  });

  it("allows an exact read to the end", () => {
    const cursor = cursorOver([1, 2, 3]);

    expect([...cursor.bytes(3)]).toEqual([1, 2, 3]);
    expect(cursor.remaining).toBe(0);
  });
});

describe("readArray", () => {
  it("reads a compact-index length prefix by default", () => {
    const cursor = cursorOver([0x03, 0x0a, 0x0b, 0x0c]);

    expect(readArray(cursor, () => cursor.uint8())).toEqual([0x0a, 0x0b, 0x0c]);
    expect(cursor.remaining).toBe(0);
  });

  it("accepts an explicit count and reads no prefix", () => {
    const cursor = cursorOver([0x0a, 0x0b, 0x0c]);

    expect(readArray(cursor, () => cursor.uint8(), 2)).toEqual([0x0a, 0x0b]);
    expect(cursor.offset).toBe(2);
  });

  it("returns an empty array for a zero length", () => {
    const cursor = cursorOver([0x00, 0xaa]);

    expect(readArray(cursor, () => cursor.uint8())).toEqual([]);
    expect(cursor.offset).toBe(1);
  });

  it("names a negative length rather than throwing RangeError", () => {
    // 0x81 is a compact index of -1. `new Array(-1)` would throw a bare
    // RangeError with no indication of where it came from.
    const cursor = cursorOver([0x81, 0x00]);

    expect(() => readArray(cursor, () => cursor.uint8())).toThrow(
      /invalid array length -1/i,
    );
  });

  it("composes, so nested structures need no special support", () => {
    // Two pairs: the shape struct constructors will use.
    const cursor = cursorOver([0x02, 0x01, 0x02, 0x03, 0x04]);

    const pairs = readArray(cursor, () => ({
      a: cursor.uint8(),
      b: cursor.uint8(),
    }));

    expect(pairs).toEqual([
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ]);
  });
});
