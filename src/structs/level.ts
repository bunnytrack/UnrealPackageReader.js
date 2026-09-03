/**
 * Level metadata structures, for `Level` and `LevelBase`.
 *
 * These are the engine's `FURL` (`Engine/Inc/UnURL.h`) and `FReachSpec`
 * (`Engine/Inc/UnReach.h`), in the UT 436 source release; `LevelMap` is one
 * entry of `ULevel.TravelInfo`, its `TMap<FString,FString>`.
 */

import { readSizedText } from "../io/text.ts";
import { readArray } from "../io/cursor.ts";
import { type ReadContext } from "./context.ts";

/**
 * A parsed Unreal URL (`FURL`) - the addressing scheme used for both map travel
 * and network connections, e.g. `unreal://host:7777/CTF-Face?Game=CTFGame`.
 */
export interface LevelURL {
  protocol: string;
  /** The hostname; blank for a local map. */
  host: string;
  map: string;
  options: string[];
  portal: string;
  port: number;
  /** Whether the URL parsed successfully. Stored as a 32-bit integer, not a byte. */
  valid: boolean;
}

export function readLevelURL({ cursor }: ReadContext): LevelURL {
  return {
    protocol: readSizedText(cursor),
    host: readSizedText(cursor),
    map: readSizedText(cursor),
    options: readArray(cursor, () => readSizedText(cursor)),
    portal: readSizedText(cursor),
    port: cursor.uint32(),
    valid: cursor.uint32() > 0,
  };
}

/**
 * A navigation link between two path nodes (`FReachSpec`), as built by the
 * editor's path builder.
 */
export interface ReachSpec {
  distance: number;
  /** The path node the link starts from. */
  start: number;
  /** The path node the link ends at - the next waypoint or the goal. */
  end: number;
  /** The largest pawn radius that can use the link. */
  collision_radius: number;
  /** The largest pawn height that can use the link. */
  collision_height: number;
  /** Bitmask of the movement capabilities the link requires (jumping, swimming, ...). */
  reach_flags: number;
  /** Set when the path builder removed this link as redundant. */
  pruned: boolean;
}

export function readReachSpec({ cursor }: ReadContext): ReachSpec {
  return {
    distance: cursor.uint32(),
    start: cursor.compactIndex(),
    end: cursor.compactIndex(),
    collision_radius: cursor.uint32(),
    collision_height: cursor.uint32(),
    reach_flags: cursor.uint32(),
    pruned: cursor.uint8() > 0,
  };
}

/** One key/value pair of the level's travel info (`ULevel.TravelInfo`). */
export interface LevelMap {
  key: string;
  value: string;
}

export function readLevelMap({ cursor }: ReadContext): LevelMap {
  return {
    key: readSizedText(cursor),
    value: readSizedText(cursor),
  };
}
