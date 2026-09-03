/**
 * Property type codes, indexed by the low nibble of a property's info byte.
 *
 * Each entry sits at its own type code, so the table is indexed straight into:
 * `PROPERTY_TYPES[infoByte & 0xf]`. Several entries
 * are legacy codes that never appear in Unreal 1 packages - "Vector",
 * "Rotator" and "String" are superseded by "Struct" with a subtype and by
 * "Str" - but they hold their slots because the nibble values are fixed by the
 * format.
 */
export const PROPERTY_TYPES = [
  "Unknown",
  "Byte",
  "Integer",
  "Boolean",
  "Float",
  "Object",
  "Name",
  "String",
  "Class",
  "Array",
  "Struct",
  "Vector",
  "Rotator",
  "Str",
  "Map",
  "Fixed Array",
] as const;

export type PropertyTypeName = (typeof PROPERTY_TYPES)[number];
