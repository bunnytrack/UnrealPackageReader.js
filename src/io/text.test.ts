import { describe, expect, it } from "vitest";
import { BinaryCursor } from "./cursor.ts";
import {
  decodeText,
  readNullTerminatedText,
  readSizedText,
  readStringProperty,
} from "./text.ts";

const cursorOver = (bytes: number[]) =>
  new BinaryCursor(new Uint8Array(bytes).slice().buffer);

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

describe("readNullTerminatedText", () => {
  it("reads up to and including the terminator", () => {
    const cursor = cursorOver([...ascii("Botpack"), 0x00, 0xaa]);

    expect(readNullTerminatedText(cursor)).toBe("Botpack");
    expect(cursor.offset).toBe(8);
  });

  it("reads an empty string from a lone terminator", () => {
    const cursor = cursorOver([0x00, 0xaa]);

    expect(readNullTerminatedText(cursor)).toBe("");
    expect(cursor.offset).toBe(1);
  });

  it("reads consecutive strings, as the pre-v64 name table does", () => {
    const cursor = cursorOver([
      ...ascii("None"),
      0x00,
      ...ascii("WAV"),
      0x00,
      ...ascii("DMatch"),
      0x00,
    ]);

    expect([
      readNullTerminatedText(cursor),
      readNullTerminatedText(cursor),
      readNullTerminatedText(cursor),
    ]).toEqual(["None", "WAV", "DMatch"]);
    expect(cursor.remaining).toBe(0);
  });

  it("decodes high bytes as windows-1252", () => {
    // 0x93/0x94 are curly quotes in windows-1252 and controls in Latin-1.
    const cursor = cursorOver([0x93, 0x41, 0x94, 0x00]);
    expect(readNullTerminatedText(cursor)).toBe("“A”");
  });

  it("names an unterminated string rather than throwing RangeError", () => {
    const cursor = cursorOver(ascii("no terminator"));

    expect(() => readNullTerminatedText(cursor)).toThrow(
      /unterminated string starting at offset 0/i,
    );
  });
});

describe("readSizedText", () => {
  it("trims the terminator but advances past it", () => {
    const cursor = cursorOver([0x05, ...ascii("None"), 0x00, 0xaa]);

    expect(readSizedText(cursor)).toBe("None");
    expect(cursor.offset).toBe(6);
  });

  it("refuses a length that runs past the end of the buffer", () => {
    // ArrayBuffer.slice would clamp here, yielding plausible text and a cursor
    // pointing beyond the buffer.
    const cursor = cursorOver([0x40, 0x41, 0x42]);

    expect(() => readSizedText(cursor)).toThrow(
      /cannot read 64 bytes at offset 1: only 2 of 3 remain/i,
    );
  });
});

describe("readStringProperty", () => {
  it("reads a positive length as single-byte text", () => {
    const cursor = cursorOver([0x04, ...ascii("Bot"), 0x00]);

    expect(readStringProperty(cursor)).toBe("Bot");
    expect(cursor.offset).toBe(5);
  });

  it("reads a negative length as utf-16le, two bytes per character", () => {
    const cursor = cursorOver([0x83, 0x41, 0x00, 0x42, 0x00, 0x00, 0x00]);

    expect(readStringProperty(cursor)).toBe("AB");
    // Three characters at two bytes each, terminator included.
    expect(cursor.offset).toBe(7);
  });

  it("reads an empty string of either encoding", () => {
    expect(readStringProperty(cursorOver([0x01, 0x00]))).toBe("");
    expect(readStringProperty(cursorOver([0x81, 0x00, 0x00]))).toBe("");
  });
});

describe("decodeText", () => {
  it("defaults to windows-1252, not Latin-1", () => {
    expect(decodeText(new Uint8Array([0x93, 0x94]))).toBe("“”");
    expect(decodeText(new Uint8Array([0x85]))).toBe("…");
    expect(decodeText(new Uint8Array([0x96]))).toBe("–");
  });

  it("leaves ASCII alone", () => {
    expect(decodeText(new Uint8Array(ascii("CTF-Face][")))).toBe("CTF-Face][");
  });
});
