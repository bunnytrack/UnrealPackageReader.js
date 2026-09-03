/**
 * Audio: `UMusic` (tracker modules, or anything the `format` name says) and
 * `USound`.
 *
 * This reader does not decode audio. `UMusic` copies its payload out;
 * `USound` records where the payload starts and how long it is, and leaves the
 * bytes in the package - sounds are far more numerous than music, and a
 * consumer can slice them out on demand.
 */

import { SOUND_FLAGS } from "../constants/flags.ts";
import type { NativeContext } from "./context.ts";

export interface UMusic {
  /** The tracker format, named by the object (e.g. `it`). */
  format: string;
  data_end_offset: number;
  size: number;
  audio_data: Uint8Array;
}

export function readUMusic(ctx: NativeContext): UMusic {
  const { cursor } = ctx;

  const format = ctx.name();
  const data_end_offset = cursor.uint32();
  const size = cursor.compactIndex();

  return {
    format,
    data_end_offset,
    size,
    audio_data: cursor.bytes(size),
  };
}

/**
 * The two layouts of a sound.
 *
 * The version-79, licensee-0 layout is Harry Potter 2's, which extends the
 * header with duration, sample format and optional lip-sync data. This reader
 * does not parse the lip-sync payload itself; its location within the package
 * is indicated by the three `lip_sync_*` fields, and `lip_sync_data` is always
 * null.
 *
 * `byte_rate` is `size / duration`, or null when `duration` is zero.
 */
export interface USound {
  format: string;
  core_flags?: number;
  duration?: number;
  raw_num_samples?: number | null;
  bit_depth?: number | null;
  channels?: number | null;
  sample_rate?: number | null;
  lip_sync_data?: null;
  skip_offset?: number;
  next_object_offset?: number;
  size: number;
  audio_offset: number;
  byte_rate?: number | null;
  lip_sync_skip_offset?: number;
  lip_sync_data_count?: number;
  lip_sync_data_offset?: number;
}

export function readUSound(ctx: NativeContext): USound {
  const { cursor, version, licenseeVersion } = ctx;

  const format = ctx.name();

  if (version === 79 && licenseeVersion === 0) {
    const core_flags = cursor.uint32();
    const duration = cursor.float32();
    const raw_num_samples = cursor.uint32();
    const bit_depth = cursor.uint32();
    const channels = cursor.uint32();
    const sample_rate = cursor.uint32();
    const skip_offset = cursor.uint32();
    const size = cursor.compactIndex();
    const audio_offset = cursor.offset;

    cursor.skip(size);

    return {
      format,
      core_flags,
      duration,
      raw_num_samples,
      bit_depth,
      channels,
      sample_rate,
      lip_sync_data: null,
      skip_offset,
      size,
      audio_offset,
      byte_rate: duration === 0 ? null : size / duration,
      ...(core_flags & SOUND_FLAGS.SF_HasLipSync
        ? {
            lip_sync_skip_offset: cursor.uint32(),
            lip_sync_data_count: cursor.compactIndex(),
            lip_sync_data_offset: cursor.offset,
          }
        : {}),
    };
  }

  return {
    format,
    ...(version >= 63 ? { next_object_offset: cursor.uint32() } : {}),
    size: cursor.compactIndex(),
    audio_offset: cursor.offset,
  };
}
