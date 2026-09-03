/**
 * Sequential byte cursor over a package buffer.
 *
 * Unreal packages are read strictly in order: almost every structure is a run
 * of fields whose position depends on everything decoded before it.
 *
 * @module io/cursor
 */

/**
 * A compact index spans at most five bytes: six value bits in the first and
 * seven in each of the rest leaves five for the fifth, totalling the 32 bits
 * the format can hold.
 */
const MAX_COMPACT_INDEX_BYTES = 5;

export class BinaryCursor {
  readonly buffer: ArrayBuffer;
  readonly view: DataView;
  offset = 0;

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
  }

  get length(): number {
    return this.view.byteLength;
  }

  get remaining(): number {
    return this.view.byteLength - this.offset;
  }

  seek(offset: number): number {
    return (this.offset = offset);
  }

  skip(byteCount: number): number {
    return (this.offset += byteCount);
  }

  int8(): number {
    const value = this.view.getInt8(this.offset);
    this.offset += 1;
    return value;
  }

  uint8(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  int16(): number {
    const value = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return value;
  }

  uint16(): number {
    const value = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  int32(): number {
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  uint32(): number {
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  float32(): number {
    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  }

  bigInt64(): bigint {
    const value = this.view.getBigInt64(this.offset, true);
    this.offset += 8;
    return value;
  }

  bigUint64(): bigint {
    const value = this.view.getBigUint64(this.offset, true);
    this.offset += 8;
    return value;
  }

  /**
   * Copy of the next `byteCount` bytes.
   */
  bytes(byteCount: number): Uint8Array {
    if (byteCount < 0) {
      throw new Error(
        `Cannot read ${byteCount} bytes at offset ${this.offset}: length cannot be negative`,
      );
    }

    if (byteCount > this.remaining) {
      throw new Error(
        `Cannot read ${byteCount} bytes at offset ${this.offset}: ` +
          `only ${this.remaining} of ${this.length} remain`,
      );
    }

    const start = this.offset;
    this.offset += byteCount;
    return new Uint8Array(this.buffer.slice(start, start + byteCount));
  }

  /**
   * Variable-length signed integer, 1-5 bytes:
   *
   *   ```text
   *   byte 1     bit 8 = sign, bit 7 = continuation, bits 1-6 = value
   *   bytes 2-5  bit 8 = continuation, bits 1-7 = value
   *   ```
   *
   * The fifth byte is terminal, so a conforming encoder can never set its
   * continuation bit - the value it would continue has already used every
   * available bit.
   */
  compactIndex(): number {
    const firstByte = this.uint8();

    const isNegative = firstByte & 0b10000000;
    let hasMoreBytes = firstByte & 0b01000000;
    let value = firstByte & 0b00111111;

    let bytesRead = 1;
    let shift = 6;

    // The byte-count bound is redundant while the throw below stands, but it
    // is kept so that a future change there cannot reopen an unbounded read.
    while (hasMoreBytes && bytesRead < MAX_COMPACT_INDEX_BYTES) {
      const byte = this.uint8();
      bytesRead++;

      const isFinalByte = bytesRead === MAX_COMPACT_INDEX_BYTES;
      const valueBits = isFinalByte ? 0b00011111 : 0b01111111;

      value = ((byte & valueBits) << shift) | value;
      shift += 7;

      hasMoreBytes = byte & 0b10000000;

      if (isFinalByte && hasMoreBytes) {
        const hex = byte.toString(16).padStart(2, "0");

        throw new Error(
          `Invalid compact index at offset ${this.offset - 1}: ` +
            `byte ${bytesRead} (0x${hex}) sets the continuation bit, but a ` +
            `compact index holds at most ${MAX_COMPACT_INDEX_BYTES} bytes`,
        );
      }
    }

    // Match the engine's signed 32-bit INT: `| 0` re-wraps a negation that
    // leaves int32 range, and turns JavaScript's -0 into the 0 a C++ int
    // negation gives.
    return (isNegative ? -value : value) | 0;
  }
}

/**
 * Read `count` items, or a compact-index length prefix followed by that many.
 */
export function readArray<T>(
  cursor: BinaryCursor,
  read: () => T,
  count?: number,
): T[] {
  const length = count ?? cursor.compactIndex();

  if (length < 0) {
    throw new Error(
      `Invalid array length ${length} at offset ${cursor.offset}: lengths cannot be negative`,
    );
  }

  const items: T[] = new Array(length);
  for (let i = 0; i < length; i++) items[i] = read();
  return items;
}
