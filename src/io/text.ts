/**
 * Text decoding.
 *
 * Unreal 1 predates widespread Unicode, so strings are single-byte and encoded
 * in the Windows codepage of the era.
 *
 * Three forms appear in a package:
 *
 *   - length-prefixed and null-terminated (the name table from version 64 on,
 *     and every URL/map field)
 *   - null-terminated only (the name table before version 64)
 *   - a compact-index length whose sign selects the encoding (Str properties)
 *
 * @module io/text
 */

import type { BinaryCursor } from "./cursor.ts";

/**
 * The codepage single-byte text is decoded as - a deliberate divergence from
 * the engine, which widens each byte straight to a character (`FromAnsi` in
 * `Core/Inc/Core.h`, UT 436 source release):
 *
 *   ```cpp
 *   inline TCHAR FromAnsi( ANSICHAR In ) { return (BYTE)In; }
 *   ```
 *
 * That is Latin-1 semantics, which puts an unprintable C1 control where a
 * Windows author typed punctuation such as a curly quote; it renders correctly
 * in game only because UT's bitmap fonts are indexed in codepage order.
 * Decoding windows-1252 instead yields the character the author actually typed.
 * The two differ only for bytes 0x80-0x9F.
 *
 * This applies to the forms with no encoding of their own - the name table, the
 * URL and travel-info fields, and TextBuffer contents - but not `Str`
 * properties, which the engine writes as UTF-16LE for any non-ASCII text (see
 * readStringProperty).
 */
export const DEFAULT_ENCODING = "windows-1252";

export const UTF16_ENCODING = "utf-16le";

export function decodeText(
  bytes: ArrayBuffer | ArrayBufferView,
  encoding: string = DEFAULT_ENCODING,
): string {
  return new TextDecoder(encoding).decode(bytes);
}

/**
 * Length-prefixed string, where the stored length includes the null
 * terminator. The cursor advances by the full stored length; only the
 * terminator is trimmed from the returned text.
 */
export function readSizedText(cursor: BinaryCursor): string {
  const size = cursor.uint8();
  const raw = cursor.bytes(size);

  // A size of 0 is malformed - there is not even room for the terminator -
  // but it costs nothing to treat it as an empty string.
  return decodeText(raw.subarray(0, Math.max(0, size - 1)));
}

/**
 * Null-terminated string with no length prefix, used by the name table before
 * version 64.
 */
export function readNullTerminatedText(cursor: BinaryCursor): string {
  const start = cursor.offset;
  const bytes: number[] = [];

  while (true) {
    if (cursor.remaining === 0) {
      throw new Error(
        `Unterminated string starting at offset ${start}: reached the end of the buffer`,
      );
    }

    const byte = cursor.uint8();
    if (byte === 0x00) break;

    bytes.push(byte);
  }

  return decodeText(new Uint8Array(bytes));
}

/**
 * A `Str` property, whose length prefix is a signed compact index.
 *
 * Matches the engine's own FString serialiser, which stores the length as a
 * compact index, reads exactly that many characters at one or two bytes each,
 * and treats a stored length of 1 - the terminator alone - as an empty string.
 *
 * From Anthrax (maintainer of the OldUnreal UT99 patch):
 *
 * >There are two legal encodings for string properties: "plain ANSI" or
 * >UTF-16LE. If the string you want to store in the property has no
 * >characters outside the [0, 0x7F] range, it will be stored as plain ANSI.
 * >The way to tell them apart is to look at the length that is stored at the
 * >start of the string: positive length = ANSI, negative = UTF-16LE.
 *
 * The length counts *characters*, not bytes, and includes the terminator - so
 * a UTF-16LE string occupies twice as many bytes as its stated length.
 */
export function readStringProperty(cursor: BinaryCursor): string {
  const size = cursor.compactIndex();

  const isUtf16 = size < 0;
  const charWidth = isUtf16 ? 2 : 1;
  const byteLength = Math.abs(size) * charWidth;

  const raw = cursor.bytes(byteLength);
  const withoutTerminator = raw.subarray(
    0,
    Math.max(0, byteLength - charWidth),
  );

  return decodeText(
    withoutTerminator,
    isUtf16 ? UTF16_ENCODING : DEFAULT_ENCODING,
  );
}
