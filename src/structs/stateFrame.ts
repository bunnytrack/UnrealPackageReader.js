/**
 * The UnrealScript execution state saved with an object.
 */

import { type ReadContext } from "./context.ts";

/**
 * A saved script execution state, present when an object carries the
 * `RF_HasStack` flag.
 *
 * This is not a property, but it is stored at the head of the property block
 * and listed in the `properties` array alongside real ones. The `name` field
 * is what makes that work: `getProp()` lowercases `prop.name` on every element
 * without guarding, so a state frame with no `name` would make any `getProp()`
 * call on that object throw. It is common enough to matter - 684 of the 1,344
 * exports in `DM-Peak.unr` carry `RF_HasStack`.
 *
 * Typed as the literal `"StateFrame"` rather than `string`, which makes the
 * field a usable discriminant in `PropertyListEntry` (`src/package/objects.ts`)
 * - a state frame is the one entry there with no `type`.
 *
 * `offset` is only stored when `node` is non-zero: with no node there is no
 * bytecode to be positioned within.
 */
export interface StateFrame {
  name: "StateFrame";
  node: number;
  state_node: number;
  probe_mask: bigint;
  latent_action: number;
  offset?: number;
}

export function readStateFrame({ cursor }: ReadContext): StateFrame {
  const node = cursor.compactIndex();

  return {
    name: "StateFrame",
    node,
    state_node: cursor.compactIndex(),
    probe_mask: cursor.bigInt64(),
    latent_action: cursor.uint32(),
    ...(node !== 0 ? { offset: cursor.compactIndex() } : {}),
  };
}
