/**
 * The package header: the fixed block at offset 0 that locates everything else.
 */

import type { BinaryCursor } from "../io/cursor.ts";

/** Tag at offset 0 of every Unreal package. */
export const PACKAGE_SIGNATURE = 0x9e2a83c1;

/** One entry in the generations list, present from version 68. */
export interface PackageGeneration {
  export_count: number;
  name_count: number;
}

/**
 * Version 68 replaced the heritage list with a GUID plus a generation count.
 */
export interface PackageHeader {
  signature: number;
  version: number;
  licensee_version: number;
  package_flags: number;
  name_count: number;
  name_offset: number;
  export_count: number;
  export_offset: number;
  import_count: number;
  import_offset: number;

  /** Before version 68 only. */
  heritage_count?: number;
  heritage_offset?: number;

  /** Version 68 and later only. */
  guid?: string;
  generation_count?: number;
  generations?: PackageGeneration[];
}

export function readPackageHeader(cursor: BinaryCursor): PackageHeader {
  cursor.seek(0);

  const signature = cursor.uint32();

  if (signature !== PACKAGE_SIGNATURE) {
    throw new Error(
      `Invalid package signature: 0x${signature.toString(16).padStart(8, "0")}`,
    );
  }

  const version = cursor.uint16();

  return {
    signature,
    version,
    licensee_version: cursor.uint16(),
    package_flags: cursor.uint32(),
    name_count: cursor.uint32(),
    name_offset: cursor.uint32(),
    export_count: cursor.uint32(),
    export_offset: cursor.uint32(),
    import_count: cursor.uint32(),
    import_offset: cursor.uint32(),
    ...(version < 68 ? readHeritage(cursor) : readGuidAndGenerations(cursor)),
  };
}

function readHeritage(cursor: BinaryCursor) {
  return {
    heritage_count: cursor.uint32(),
    heritage_offset: cursor.uint32(),
  };
}

function readGuidAndGenerations(cursor: BinaryCursor) {
  /**
   * A genuine Windows GUID: the engine's appCreateGuid casts a CoCreateGuid
   * result straight into `FGuid`, four DWORDs serialised in order (UnObjBas.h:193).
   * The 32 undashed uppercase hex digits are the engine format - `FGuid::String` is:
   *
   * ```cpp
   * appSprintf("%08X%08X%08X%08X", A, B, C, D) at UnObjBas.h:199.
   * ```
   */
  const guid = [
    cursor.uint32(),
    cursor.uint32(),
    cursor.uint32(),
    cursor.uint32(),
  ]
    .map((word) => word.toString(16).padStart(8, "0"))
    .join("")
    .toUpperCase();

  const generation_count = cursor.uint32();
  const generations: PackageGeneration[] = [];

  for (let i = 0; i < generation_count; i++) {
    generations.push({
      export_count: cursor.uint32(),
      name_count: cursor.uint32(),
    });
  }

  return { guid, generation_count, generations };
}
