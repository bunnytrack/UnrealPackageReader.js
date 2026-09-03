/**
 * `ULevel` - the map: its actor list, URL, BSP model and reach specs.
 */

import { readStructArray } from "../structs/context.ts";
import {
  readLevelURL,
  readLevelMap,
  readReachSpec,
  type LevelMap,
  type LevelURL,
  type ReachSpec,
} from "../structs/level.ts";
import {
  readObjectRef,
  readObjectRefs,
  type NativeContext,
  type ObjectRef,
} from "./context.ts";

/** Text-block slots on a level: `ULevel::TextBlocks[16]` in `Engine/Inc/UnLevel.h`. */
const NUM_LEVEL_TEXT_BLOCKS = 16;

export interface ULevelBase {
  actors: ObjectRef[];
  url: LevelURL;
}

/**
 * The actor count is stored twice - `TTransArray` serialises both its count
 * and its allocated capacity - so the second copy is skipped unread.
 */
export function readULevelBase(ctx: NativeContext): ULevelBase {
  const { cursor } = ctx;

  const count = cursor.uint32();
  cursor.skip(4);

  return {
    actors: readObjectRefs(ctx, count),
    url: readLevelURL(ctx),
  };
}

export interface ULevel extends ULevelBase {
  model: ObjectRef;
  reach_specs: ReachSpec[];
  approx_time: number;
  first_deleted: number;
  text_blocks: ObjectRef[];
  travel_info?: LevelMap[];
}

export function readULevel(ctx: NativeContext): ULevel {
  const { cursor } = ctx;

  return {
    ...readULevelBase(ctx),
    model: readObjectRef(ctx),
    reach_specs: readStructArray(ctx, readReachSpec),
    approx_time: cursor.float32(),
    first_deleted: cursor.compactIndex(),
    text_blocks: readObjectRefs(ctx, NUM_LEVEL_TEXT_BLOCKS),
    ...(ctx.version > 62
      ? { travel_info: readStructArray(ctx, readLevelMap) }
      : {}),
  };
}
