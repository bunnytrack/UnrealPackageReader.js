"use strict";
(() => {
  // src/constants/classes.ts
  var BRUSH_CLASSES = [
    "AssertMover",
    "AttachMover",
    "Brush",
    "ElevatorMover",
    "GradualMover",
    "LoopMover",
    "MixMover",
    "Mover",
    "RotatingMover"
  ];
  var MOVER_CLASSES = [
    "AssertMover",
    "AttachMover",
    "ElevatorMover",
    "GradualMover",
    "LoopMover",
    "MixMover",
    "Mover",
    "RotatingMover"
  ];
  var MESH_CLASSES = [
    "Mesh",
    "LodMesh",
    "SkeletalMesh",
    "SkelModel"
  ];

  // src/constants/enums.ts
  var MOVER_ENCROACH_TYPE = [
    "ME_StopWhenEncroach",
    // Stop when we hit an actor.
    "ME_ReturnWhenEncroach",
    // Return to previous position when we hit an actor.
    "ME_CrushWhenEncroach",
    // Crush the poor helpless actor.
    "ME_IgnoreWhenEncroach"
    // Ignore encroached actors.
  ];
  var MOVER_GLIDE_TYPE = [
    "MV_MoveByTime",
    // Move linearly.
    "MV_GlideByTime"
    // Move with smooth acceleration.
  ];
  var BUMP_TYPE = [
    "BT_PlayerBump",
    // Can only be bumped by a player.
    "BT_PawnBump",
    // Can be bumped by any pawn.
    "BT_AnyBump"
    // Can be bumped by any solid actor.
  ];
  var CSG_OPER = [
    "CSG_Active",
    // Active brush - the editor's working brush, not part of the level.
    "CSG_Add",
    // Add to world.
    "CSG_Subtract",
    // Subtract from world.
    "CSG_Intersect",
    // Form from intersection with world.
    "CSG_Deintersect"
    // Form from negative intersection with world.
  ];
  var SHEER_AXIS = [
    "SHEER_None",
    "SHEER_XY",
    "SHEER_XZ",
    "SHEER_YX",
    "SHEER_YZ",
    "SHEER_ZX",
    "SHEER_ZY"
  ];

  // src/constants/flags.ts
  var OBJECT_FLAGS = {
    RF_Transactional: 1,
    RF_Unreachable: 2,
    RF_Public: 4,
    RF_TagImp: 8,
    RF_TagExp: 16,
    RF_SourceModified: 32,
    RF_TagGarbage: 64,
    RF_NeedLoad: 512,
    RF_HighlightedName: 1024,
    RF_EliminateObject: 1024,
    RF_InSingularFunc: 2048,
    RF_RemappedName: 2048,
    RF_Suppress: 4096,
    RF_StateChanged: 4096,
    RF_InEndState: 8192,
    RF_Transient: 16384,
    RF_PreLoading: 32768,
    RF_LoadForClient: 65536,
    RF_LoadForServer: 131072,
    RF_LoadForEdit: 262144,
    RF_Standalone: 524288,
    RF_NotForClient: 1048576,
    RF_NotForServer: 2097152,
    RF_NotForEdit: 4194304,
    RF_Destroyed: 8388608,
    RF_NeedPostLoad: 16777216,
    RF_HasStack: 33554432,
    RF_Native: 67108864,
    RF_Marked: 134217728,
    RF_ErrorShutdown: 268435456,
    RF_DebugPostLoad: 536870912,
    RF_DebugSerialize: 1073741824,
    RF_DebugDestroy: 2147483648
  };
  var POLY_FLAGS = {
    PF_Invisible: 1,
    PF_Masked: 2,
    PF_Translucent: 4,
    PF_NotSolid: 8,
    PF_Environment: 16,
    PF_ForceViewZone: 16,
    PF_Semisolid: 32,
    PF_Modulated: 64,
    PF_FakeBackdrop: 128,
    PF_TwoSided: 256,
    PF_AutoUPan: 512,
    PF_AutoVPan: 1024,
    PF_NoSmooth: 2048,
    PF_BigWavy: 4096,
    PF_SpecialPoly: 4096,
    PF_SmallWavy: 8192,
    PF_Flat: 16384,
    PF_LowShadowDetail: 32768,
    PF_NoMerge: 65536,
    PF_CloudWavy: 131072,
    PF_DirtyShadows: 262144,
    PF_BrightCorners: 524288,
    PF_SpecialLit: 1048576,
    PF_Gouraud: 2097152,
    PF_NoBoundRejection: 2097152,
    PF_Unlit: 4194304,
    PF_HighShadowDetail: 8388608,
    // Editor and internal flags. Not gameplay-facing, and easy to assume absent
    // from shipped content - but they survive into saved Polys objects, because
    // those are the brush's own source polygons straight out of UnrealEd.
    // 0x40000000 is set on 374 polygons in the test corpus.
    PF_Memorized: 16777216,
    PF_RenderHint: 16777216,
    PF_Selected: 33554432,
    PF_Portal: 67108864,
    PF_Mirrored: 134217728,
    PF_Highlighted: 268435456,
    PF_FlatShaded: 1073741824,
    PF_EdProcessed: 1073741824,
    PF_RenderFog: 1073741824,
    PF_EdCut: 2147483648,
    PF_Occlude: 2147483648
  };
  var SOUND_FLAGS = {
    SF_None: 0,
    SF_Looping: 2,
    SF_Streaming: 4,
    SF_Music: 8,
    SF_No3D: 16,
    SF_UpdatePitch: 32,
    SF_NoUpdates: 64,
    SF_HasLipSync: 128,
    SF_Compressed: 256
  };
  function decodeObjectFlags(flags) {
    return Object.keys(OBJECT_FLAGS).filter(
      (name) => (OBJECT_FLAGS[name] & flags) !== 0
    );
  }
  function decodePolyFlags(flags) {
    return Object.keys(POLY_FLAGS).filter(
      (name) => (POLY_FLAGS[name] & flags) !== 0
    );
  }

  // src/constants/packages.ts
  var FILE_TYPE_BY_EXTENSION = {
    u: "System",
    uax: "Sound",
    umod: "UMOD",
    umx: "Music",
    unr: "Map",
    utx: "Texture",
    uxx: "Cache",
    uz: "Zip",
    tmp: "Zip"
  };
  var EXTENSION_BY_PACKAGE_PATH = {
    system: "u",
    maps: "unr",
    textures: "utx",
    sounds: "uax",
    music: "umx"
  };
  var DEFAULT_PACKAGES = /* @__PURE__ */ new Map([
    [
      "system",
      [
        "botpack",
        "core",
        "de",
        "editor",
        "engine",
        "epiccustommodels",
        "fire",
        "ipdrv",
        "ipserver",
        "multimesh",
        "relics",
        "relicsbindings",
        "ubrowser",
        "umenu",
        "unreali",
        "unrealshare",
        "utbrowser",
        "utmenu",
        "utserveradmin",
        "uweb",
        "uwindow"
      ]
    ],
    [
      "maps",
      [
        "as-frigate",
        "as-guardia",
        "as-hispeed",
        "as-mazon",
        "as-oceanfloor",
        "as-overlord",
        "as-rook",
        "as-tutorial",
        "cityintro",
        "ctf-command",
        "ctf-coret",
        "ctf-cybrosis][",
        "ctf-darji16",
        "ctf-dreary",
        "ctf-eternalcave",
        "ctf-face",
        "ctf-face][",
        "ctf-gauntlet",
        "ctf-hallofgiants",
        "ctf-high",
        "ctf-hydro16",
        "ctf-kosov",
        "ctf-lavagiant",
        "ctf-niven",
        "ctf-november",
        "ctf-noxion16",
        "ctf-nucleus",
        "ctf-orbital",
        "ctf-tutorial",
        "dm-agony",
        "dm-arcanetemple",
        "dm-barricade",
        "dm-codex",
        "dm-conveyor",
        "dm-crane",
        "dm-curse][",
        "dm-cybrosis][",
        "dm-deck16][",
        "dm-fetid",
        "dm-fractal",
        "dm-gothic",
        "dm-grinder",
        "dm-healpod][",
        "dm-hyperblast",
        "dm-kgalleon",
        "dm-liandri",
        "dm-malevolence",
        "dm-mojo][",
        "dm-morbias][",
        "dm-morpheus",
        "dm-oblivion",
        "dm-peak",
        "dm-phobos",
        "dm-pressure",
        "dm-shrapnel][",
        "dm-spacenoxx",
        "dm-stalwart",
        "dm-stalwartxl",
        "dm-tempest",
        "dm-turbine",
        "dm-tutorial",
        "dm-zeto",
        "dom-cinder",
        "dom-condemned",
        "dom-cryptic",
        "dom-gearbolt",
        "dom-ghardhen",
        "dom-lament",
        "dom-leadworks",
        "dom-metaldream",
        "dom-olden",
        "dom-sesmar",
        "dom-tutorial",
        "entry",
        "eol_assault",
        "eol_challenge",
        "eol_ctf",
        "eol_deathmatch",
        "eol_domination",
        "eol_statues",
        "utcredits"
      ]
    ],
    [
      "textures",
      [
        "alfafx",
        "ancient",
        "arenatex",
        "belt_fx",
        "blufffx",
        "bossskins",
        "castle1",
        "chizraefx",
        "city",
        "commandoskins",
        "coret_fx",
        "creative",
        "credits",
        "crypt",
        "crypt2",
        "crypt_fx",
        "ctf",
        "dacomafem",
        "dacomaskins",
        "ddayfx",
        "decayeds",
        "detail",
        "dmeffects",
        "egypt",
        "egyptpan",
        "eol",
        "faces",
        "fcommandoskins",
        "female1skins",
        "female2skins",
        "fireeng",
        "flarefx",
        "fractalfx",
        "genearth",
        "genfluid",
        "genfx",
        "genin",
        "genterra",
        "genwarp",
        "gothfem",
        "gothskins",
        "greatfire",
        "greatfire2",
        "hubeffects",
        "indus1",
        "indus2",
        "indus3",
        "indus4",
        "indus5",
        "indus6",
        "indus7",
        "isvfx",
        "jwsky",
        "ladderfonts",
        "ladrarrow",
        "ladrstatic",
        "lavafx",
        "lian-x",
        "liquids",
        "male1skins",
        "male2skins",
        "male3skins",
        "menugr",
        "metalmys",
        "mine",
        "nalicast",
        "nalifx",
        "nivenfx",
        "noxxpack",
        "of1",
        "old_fx",
        "palettes",
        "phraelfx",
        "playrshp",
        "queen",
        "rainfx",
        "render",
        "rotatingu",
        "scripted",
        "sgirlskins",
        "shanechurch",
        "shaneday",
        "shanesky",
        "skaarj",
        "sktrooperskins",
        "skybox",
        "skycity",
        "slums",
        "soldierskins",
        "spacefx",
        "starship",
        "tcowmeshskins",
        "tcrystal",
        "terranius",
        "tnalimeshskins",
        "trenchesfx",
        "tskmskins",
        "ut",
        "ut_artfx",
        "utbase1",
        "utcrypt",
        "uttech1",
        "uttech2",
        "uttech3",
        "uwindowfonts",
        "xbpfx",
        "xfx",
        "xtortion",
        "xutfx"
      ]
    ],
    [
      "sounds",
      [
        "activates",
        "addon1",
        "ambancient",
        "ambcity",
        "ambmodern",
        "amboutside",
        "announcer",
        "bossvoice",
        "dday",
        "dmatch",
        "doorsanc",
        "doorsmod",
        "extro",
        "female1voice",
        "female2voice",
        "femalesounds",
        "laddersounds",
        "male1voice",
        "male2voice",
        "malesounds",
        "noxxsnd",
        "openingwave",
        "pan1",
        "rain",
        "tutvoiceas",
        "tutvoicectf",
        "tutvoicedm",
        "tutvoicedom",
        "vrikers"
      ]
    ],
    [
      "music",
      [
        "botmca9",
        "botpck10",
        "cannon",
        "colossus",
        "course",
        "credits",
        "ending",
        "enigma",
        "firebr",
        "foregone",
        "godown",
        "lock",
        "mech8",
        "mission",
        "nether",
        "organic",
        "phantom",
        "razor-ub",
        "run",
        "saveme",
        "savemeg",
        "seeker",
        "seeker2",
        "skyward",
        "strider",
        "suprfist",
        "unworld2",
        "utmenu23",
        "uttitle",
        "wheels"
      ]
    ]
  ]);
  var PACKAGE_PATH_BY_NAME = (() => {
    const index = /* @__PURE__ */ new Map();
    for (const [path, names] of DEFAULT_PACKAGES) {
      for (const name of names) {
        if (!index.has(name)) index.set(name, path);
      }
    }
    return index;
  })();
  function isDefaultPackage(packageName) {
    return PACKAGE_PATH_BY_NAME.has(packageName.toLowerCase());
  }
  function packageFileExtension(packageName) {
    const path = PACKAGE_PATH_BY_NAME.get(packageName.toLowerCase());
    return path === void 0 ? void 0 : EXTENSION_BY_PACKAGE_PATH[path];
  }

  // src/constants/propertyTypes.ts
  var PROPERTY_TYPES = [
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
    "Fixed Array"
  ];

  // src/package/header.ts
  var PACKAGE_SIGNATURE = 2653586369;
  function readPackageHeader(cursor) {
    cursor.seek(0);
    const signature = cursor.uint32();
    if (signature !== PACKAGE_SIGNATURE) {
      throw new Error(
        `Invalid package signature: 0x${signature.toString(16).padStart(8, "0")}`
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
      ...version < 68 ? readHeritage(cursor) : readGuidAndGenerations(cursor)
    };
  }
  function readHeritage(cursor) {
    return {
      heritage_count: cursor.uint32(),
      heritage_offset: cursor.uint32()
    };
  }
  function readGuidAndGenerations(cursor) {
    const guid = [
      cursor.uint32(),
      cursor.uint32(),
      cursor.uint32(),
      cursor.uint32()
    ].map((word) => word.toString(16).padStart(8, "0")).join("").toUpperCase();
    const generation_count = cursor.uint32();
    const generations = [];
    for (let i = 0; i < generation_count; i++) {
      generations.push({
        export_count: cursor.uint32(),
        name_count: cursor.uint32()
      });
    }
    return { guid, generation_count, generations };
  }

  // src/io/text.ts
  var DEFAULT_ENCODING = "windows-1252";
  var UTF16_ENCODING = "utf-16le";
  function decodeText(bytes, encoding = DEFAULT_ENCODING) {
    return new TextDecoder(encoding).decode(bytes);
  }
  function readSizedText(cursor) {
    const size = cursor.uint8();
    const raw = cursor.bytes(size);
    return decodeText(raw.subarray(0, Math.max(0, size - 1)));
  }
  function readNullTerminatedText(cursor) {
    const start = cursor.offset;
    const bytes = [];
    while (true) {
      if (cursor.remaining === 0) {
        throw new Error(
          `Unterminated string starting at offset ${start}: reached the end of the buffer`
        );
      }
      const byte = cursor.uint8();
      if (byte === 0) break;
      bytes.push(byte);
    }
    return decodeText(new Uint8Array(bytes));
  }
  function readStringProperty(cursor) {
    const size = cursor.compactIndex();
    const isUtf16 = size < 0;
    const charWidth = isUtf16 ? 2 : 1;
    const byteLength = Math.abs(size) * charWidth;
    const raw = cursor.bytes(byteLength);
    const withoutTerminator = raw.subarray(
      0,
      Math.max(0, byteLength - charWidth)
    );
    return decodeText(
      withoutTerminator,
      isUtf16 ? UTF16_ENCODING : DEFAULT_ENCODING
    );
  }

  // src/package/nameTable.ts
  function readNameTable(cursor, header) {
    cursor.seek(header.name_offset);
    const readName = header.version < 64 ? () => readNullTerminatedText(cursor) : () => readSizedText(cursor);
    const nameTable = new Array(header.name_count);
    for (let i = 0; i < header.name_count; i++) {
      nameTable[i] = {
        name: readName(),
        flags: cursor.uint32()
      };
    }
    return nameTable;
  }

  // src/structs/stateFrame.ts
  function readStateFrame({ cursor }) {
    const node = cursor.compactIndex();
    return {
      name: "StateFrame",
      node,
      state_node: cursor.compactIndex(),
      probe_mask: cursor.bigInt64(),
      latent_action: cursor.uint32(),
      ...node !== 0 ? { offset: cursor.compactIndex() } : {}
    };
  }

  // src/structs/geometry.ts
  function readVector({ cursor }) {
    return {
      x: cursor.float32(),
      y: cursor.float32(),
      z: cursor.float32()
    };
  }
  function readRotator({ cursor }) {
    return {
      pitch: cursor.int32(),
      yaw: cursor.int32(),
      roll: cursor.int32()
    };
  }
  function readQuaternion({ cursor }) {
    return {
      x: cursor.float32(),
      y: cursor.float32(),
      z: cursor.float32(),
      w: cursor.float32()
    };
  }
  function readPlane({ cursor }) {
    return {
      x: cursor.float32(),
      y: cursor.float32(),
      z: cursor.float32(),
      w: cursor.float32()
    };
  }
  function readColour({ cursor }) {
    return {
      r: cursor.uint8(),
      g: cursor.uint8(),
      b: cursor.uint8(),
      a: cursor.uint8()
    };
  }
  function readScale({ cursor }) {
    return {
      x: cursor.float32(),
      y: cursor.float32(),
      z: cursor.float32(),
      sheer_rate: cursor.float32(),
      sheer_axis: cursor.uint8()
    };
  }
  function readPointRegion({ cursor }) {
    return {
      zone: cursor.compactIndex(),
      i_leaf: cursor.int32(),
      zone_number: cursor.uint8()
    };
  }
  function readBoundingBox(ctx) {
    return {
      min: readVector(ctx),
      max: readVector(ctx),
      valid: ctx.cursor.uint8() > 0
    };
  }
  function readBoundingSphere(ctx) {
    return {
      centre: readVector(ctx),
      ...ctx.version > 61 ? { radius: ctx.cursor.float32() } : {}
    };
  }

  // src/package/properties.ts
  var FIXED_SIZES = [1, 2, 4, 12, 16];
  function readSize(ctx, sizeCode) {
    const { cursor } = ctx;
    switch (sizeCode) {
      case 5:
        return cursor.uint8();
      case 6:
        return cursor.uint16();
      case 7:
        return cursor.uint32();
      default:
        return FIXED_SIZES[sizeCode];
    }
  }
  function readArrayIndex(ctx) {
    const { cursor } = ctx;
    const first = cursor.uint8();
    if ((first & 128) === 0) {
      return first;
    }
    if ((first & 192) === 128) {
      return (first & 127) << 8 | cursor.uint8();
    }
    return (first & 63) << 24 | cursor.uint8() << 16 | cursor.uint8() << 8 | cursor.uint8();
  }
  var STRUCT_READERS = {
    color: readColour,
    vector: readVector,
    rotator: readRotator,
    scale: readScale,
    pointregion: readPointRegion
  };
  function readFixedString(ctx, size) {
    const bytes = ctx.cursor.bytes(size);
    const terminator = bytes.indexOf(0);
    return decodeText(terminator === -1 ? bytes : bytes.subarray(0, terminator));
  }
  function readProperty(ctx) {
    const { cursor } = ctx;
    const name = ctx.name();
    if (name.toLowerCase() === "none") return null;
    const info = cursor.uint8();
    const type = PROPERTY_TYPES[info & 15];
    const subtype = type === "Struct" ? ctx.name() : void 0;
    const size = readSize(ctx, info >> 4 & 7);
    const flag = Boolean(info & 128);
    const index = flag && type !== "Boolean" ? readArrayIndex(ctx) : void 0;
    const tag = {
      name,
      type,
      ...subtype !== void 0 ? { subtype } : {},
      ...index !== void 0 ? { index } : {}
    };
    switch (type) {
      case "Byte":
        return { ...tag, type, value: cursor.uint8() };
      case "Integer":
        return { ...tag, type, value: cursor.int32() };
      case "Boolean":
        return { ...tag, type, value: flag };
      case "Float":
        return { ...tag, type, value: cursor.float32() };
      case "Object":
        return { ...tag, type, value: cursor.compactIndex() };
      case "Class":
        return { ...tag, type, value: cursor.compactIndex() };
      case "Name":
        return { ...tag, type, value: ctx.name() };
      case "Str":
        return { ...tag, type, value: readStringProperty(cursor) };
      case "String":
        return { ...tag, type, value: readFixedString(ctx, size) };
      case "Struct": {
        const read = STRUCT_READERS[subtype.toLowerCase()];
        return {
          ...tag,
          type,
          subtype,
          value: read ? read(ctx) : cursor.bytes(size)
        };
      }
      default:
        return { ...tag, type, value: cursor.bytes(size) };
    }
  }
  function readPropertyList(ctx) {
    const properties = [];
    for (let property = readProperty(ctx); property; property = readProperty(ctx)) {
      const previous = properties[properties.length - 1];
      if (property.index !== void 0 && previous && previous.index === void 0 && previous.name === property.name) {
        const { name, type, ...rest } = previous;
        properties[properties.length - 1] = {
          name,
          type,
          ..."subtype" in rest ? { subtype: rest.subtype } : {},
          index: 0,
          value: rest.value
        };
      }
      properties.push(property);
    }
    return properties;
  }

  // src/io/cursor.ts
  var MAX_COMPACT_INDEX_BYTES = 5;
  var BinaryCursor = class {
    buffer;
    view;
    offset = 0;
    constructor(buffer) {
      this.buffer = buffer;
      this.view = new DataView(buffer);
    }
    get length() {
      return this.view.byteLength;
    }
    get remaining() {
      return this.view.byteLength - this.offset;
    }
    seek(offset) {
      return this.offset = offset;
    }
    skip(byteCount) {
      return this.offset += byteCount;
    }
    int8() {
      const value = this.view.getInt8(this.offset);
      this.offset += 1;
      return value;
    }
    uint8() {
      const value = this.view.getUint8(this.offset);
      this.offset += 1;
      return value;
    }
    int16() {
      const value = this.view.getInt16(this.offset, true);
      this.offset += 2;
      return value;
    }
    uint16() {
      const value = this.view.getUint16(this.offset, true);
      this.offset += 2;
      return value;
    }
    int32() {
      const value = this.view.getInt32(this.offset, true);
      this.offset += 4;
      return value;
    }
    uint32() {
      const value = this.view.getUint32(this.offset, true);
      this.offset += 4;
      return value;
    }
    float32() {
      const value = this.view.getFloat32(this.offset, true);
      this.offset += 4;
      return value;
    }
    bigInt64() {
      const value = this.view.getBigInt64(this.offset, true);
      this.offset += 8;
      return value;
    }
    bigUint64() {
      const value = this.view.getBigUint64(this.offset, true);
      this.offset += 8;
      return value;
    }
    /**
     * Copy of the next `byteCount` bytes.
     */
    bytes(byteCount) {
      if (byteCount < 0) {
        throw new Error(
          `Cannot read ${byteCount} bytes at offset ${this.offset}: length cannot be negative`
        );
      }
      if (byteCount > this.remaining) {
        throw new Error(
          `Cannot read ${byteCount} bytes at offset ${this.offset}: only ${this.remaining} of ${this.length} remain`
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
    compactIndex() {
      const firstByte = this.uint8();
      const isNegative = firstByte & 128;
      let hasMoreBytes = firstByte & 64;
      let value = firstByte & 63;
      let bytesRead = 1;
      let shift = 6;
      while (hasMoreBytes && bytesRead < MAX_COMPACT_INDEX_BYTES) {
        const byte = this.uint8();
        bytesRead++;
        const isFinalByte = bytesRead === MAX_COMPACT_INDEX_BYTES;
        const valueBits = isFinalByte ? 31 : 127;
        value = (byte & valueBits) << shift | value;
        shift += 7;
        hasMoreBytes = byte & 128;
        if (isFinalByte && hasMoreBytes) {
          const hex = byte.toString(16).padStart(2, "0");
          throw new Error(
            `Invalid compact index at offset ${this.offset - 1}: byte ${bytesRead} (0x${hex}) sets the continuation bit, but a compact index holds at most ${MAX_COMPACT_INDEX_BYTES} bytes`
          );
        }
      }
      return (isNegative ? -value : value) | 0;
    }
  };
  function readArray(cursor, read, count) {
    const length = count ?? cursor.compactIndex();
    if (length < 0) {
      throw new Error(
        `Invalid array length ${length} at offset ${cursor.offset}: lengths cannot be negative`
      );
    }
    const items = new Array(length);
    for (let i = 0; i < length; i++) items[i] = read();
    return items;
  }

  // src/structs/context.ts
  function readStructArray(ctx, read, count) {
    return readArray(ctx.cursor, () => read(ctx), count);
  }

  // src/structs/animation.ts
  function readBoneReference({
    cursor,
    name
  }) {
    return {
      name: name(),
      flags: cursor.uint32(),
      parent_index: cursor.uint32()
    };
  }
  function readAnimationTrack(ctx) {
    const { cursor } = ctx;
    return {
      flags: cursor.uint32(),
      key_quaternions: readStructArray(ctx, readQuaternion),
      key_positions: readStructArray(ctx, readVector),
      key_time: readStructArray(ctx, ({ cursor: cursor2 }) => cursor2.float32())
    };
  }
  function readBoneMovement(ctx) {
    const { cursor } = ctx;
    return {
      root_speed_3d: readVector(ctx),
      track_time: cursor.float32(),
      start_bone: cursor.uint32(),
      flags: cursor.uint32(),
      bones: readStructArray(ctx, ({ cursor: cursor2 }) => cursor2.uint32()),
      animation_tracks: readStructArray(ctx, readAnimationTrack),
      root_track: readAnimationTrack(ctx)
    };
  }

  // src/structs/bsp.ts
  function readBspNode(ctx) {
    const { cursor } = ctx;
    return {
      plane: readPlane(ctx),
      zone_mask: cursor.bigUint64(),
      node_flags: cursor.uint8(),
      i_vert_pool: cursor.compactIndex(),
      i_surf: cursor.compactIndex(),
      i_front: cursor.compactIndex(),
      i_back: cursor.compactIndex(),
      i_plane: cursor.compactIndex(),
      i_collision_bound: cursor.compactIndex(),
      i_render_bound: cursor.compactIndex(),
      i_zone: readStructArray(ctx, ({ cursor: cursor2 }) => cursor2.uint8(), 2),
      vertices: cursor.uint8(),
      i_leaf: readStructArray(ctx, ({ cursor: cursor2 }) => cursor2.int32(), 2)
    };
  }
  function readBspSurface({ cursor }) {
    return {
      texture: cursor.compactIndex(),
      poly_flags: cursor.uint32(),
      p_base: cursor.compactIndex(),
      v_normal: cursor.compactIndex(),
      v_texture_u: cursor.compactIndex(),
      v_texture_v: cursor.compactIndex(),
      i_light_map: cursor.compactIndex(),
      i_brush_poly: cursor.compactIndex(),
      pan_u: cursor.int16(),
      pan_v: cursor.int16(),
      actor: cursor.compactIndex()
    };
  }
  function readModelVertex({ cursor }) {
    return {
      vertex: cursor.compactIndex(),
      i_side: cursor.compactIndex()
    };
  }
  function readZone({ cursor, version }) {
    return {
      zone_actor: cursor.compactIndex(),
      connectivity: cursor.bigUint64(),
      visibility: cursor.bigUint64(),
      ...version < 63 ? { last_render_time: cursor.float32() } : {}
    };
  }
  function readLightMap(ctx) {
    const { cursor } = ctx;
    return {
      data_offset: cursor.uint32(),
      pan: readVector(ctx),
      u_clamp: cursor.compactIndex(),
      v_clamp: cursor.compactIndex(),
      u_scale: cursor.float32(),
      v_scale: cursor.float32(),
      i_light_actors: cursor.int32()
    };
  }
  function readBspLeaf({ cursor }) {
    return {
      i_zone: cursor.compactIndex(),
      i_permeating: cursor.compactIndex(),
      i_volumetric: cursor.compactIndex(),
      visible_zones: cursor.bigUint64()
    };
  }
  function readPolygon(ctx) {
    const { cursor } = ctx;
    const vertex_count = cursor.uint8();
    return {
      vertex_count,
      origin: readVector(ctx),
      normal: readVector(ctx),
      texture_u: readVector(ctx),
      texture_v: readVector(ctx),
      vertices: readStructArray(ctx, readVector, vertex_count),
      flags: cursor.uint32(),
      actor: cursor.compactIndex(),
      texture: cursor.compactIndex(),
      item_name: cursor.compactIndex(),
      link: cursor.compactIndex(),
      brush_poly: cursor.compactIndex(),
      pan_u: cursor.int16(),
      pan_v: cursor.int16()
    };
  }

  // src/structs/font.ts
  function readFontCharacter({ cursor }) {
    return {
      x: cursor.uint32(),
      y: cursor.uint32(),
      width: cursor.uint32(),
      height: cursor.uint32()
    };
  }
  function readFontTexture(ctx) {
    return {
      texture: ctx.object(ctx.cursor.compactIndex()),
      characters: readStructArray(ctx, readFontCharacter)
    };
  }
  function readFontRemap({ cursor }) {
    return {
      key: cursor.uint16(),
      value: cursor.uint16()
    };
  }

  // src/structs/level.ts
  function readLevelURL({ cursor }) {
    return {
      protocol: readSizedText(cursor),
      host: readSizedText(cursor),
      map: readSizedText(cursor),
      options: readArray(cursor, () => readSizedText(cursor)),
      portal: readSizedText(cursor),
      port: cursor.uint32(),
      valid: cursor.uint32() > 0
    };
  }
  function readReachSpec({ cursor }) {
    return {
      distance: cursor.uint32(),
      start: cursor.compactIndex(),
      end: cursor.compactIndex(),
      collision_radius: cursor.uint32(),
      collision_height: cursor.uint32(),
      reach_flags: cursor.uint32(),
      pruned: cursor.uint8() > 0
    };
  }
  function readLevelMap({ cursor }) {
    return {
      key: readSizedText(cursor),
      value: readSizedText(cursor)
    };
  }

  // src/structs/mesh.ts
  function readMeshVertex({ cursor }) {
    const xyz = cursor.uint32();
    let x = (xyz & 2047) / 8;
    let y = (xyz >> 11 & 2047) / 8;
    let z = (xyz >> 22 & 1023) / 4;
    if (x >= 128) x -= 256;
    if (y >= 128) y -= 256;
    if (z >= 128) z -= 256;
    return { x, y, z };
  }
  function readMeshTriangle({ cursor }) {
    return {
      vertex_index_1: cursor.uint16(),
      vertex_index_2: cursor.uint16(),
      vertex_index_3: cursor.uint16(),
      vertex_1_u: cursor.uint8(),
      vertex_1_v: cursor.uint8(),
      vertex_2_u: cursor.uint8(),
      vertex_2_v: cursor.uint8(),
      vertex_3_u: cursor.uint8(),
      vertex_3_v: cursor.uint8(),
      flags: cursor.uint32(),
      texture_index: cursor.uint32()
    };
  }
  function readMeshAnimNotify({
    cursor,
    name
  }) {
    return {
      time: cursor.float32(),
      function_name: name()
    };
  }
  function readMeshAnimationSequence(ctx) {
    const { cursor, name } = ctx;
    return {
      name: name(),
      group: name(),
      start_frame: cursor.uint32(),
      frame_count: cursor.uint32(),
      notifications: readStructArray(ctx, readMeshAnimNotify),
      rate: cursor.float32()
    };
  }
  function readMeshConnection({ cursor }) {
    return {
      num_vert_triangles: cursor.uint32(),
      triangle_list_offset: cursor.uint32()
    };
  }
  function readLodMeshFace({ cursor }) {
    return {
      wedge_index_1: cursor.uint16(),
      wedge_index_2: cursor.uint16(),
      wedge_index_3: cursor.uint16(),
      material_index: cursor.uint16()
    };
  }
  function readLodMeshWedge({ cursor }) {
    return {
      vertex_index: cursor.uint16(),
      s: cursor.uint8(),
      t: cursor.uint8()
    };
  }
  function readLodMeshMaterial({ cursor }) {
    return {
      flags: cursor.uint32(),
      texture_index: cursor.uint32()
    };
  }

  // src/structs/rune.ts
  var NUM_POLYGROUPS = 16;
  var MAX_CHILD_JOINTS = 4;
  var NUM_JOINT_PLANES = 6;
  function readRTriangle({ cursor }) {
    return {
      vertex_index_1: cursor.int16(),
      vertex_index_2: cursor.int16(),
      vertex_index_3: cursor.int16(),
      vertex_1_u: cursor.int8(),
      vertex_1_v: cursor.int8(),
      vertex_2_u: cursor.int8(),
      vertex_2_v: cursor.int8(),
      vertex_3_u: cursor.int8(),
      vertex_3_v: cursor.int8(),
      polygroup: cursor.int8()
    };
  }
  function readRVertex(ctx) {
    const { cursor } = ctx;
    return {
      point1: readVector(ctx),
      point2: readVector(ctx),
      joint1: cursor.int32(),
      joint2: cursor.int32(),
      weight1: cursor.float32()
    };
  }
  function readRMesh(ctx) {
    const { cursor, name } = ctx;
    const mesh = {
      num_verts: cursor.int32(),
      num_tris: cursor.int32(),
      triangles: readStructArray(ctx, readRTriangle),
      vertices: readStructArray(ctx, readRVertex),
      dec_count: cursor.int32(),
      dec: readStructArray(ctx, ({ cursor: cursor2 }) => cursor2.int8()),
      group_flags: new Array(NUM_POLYGROUPS),
      poly_group_skin_names: new Array(NUM_POLYGROUPS)
    };
    for (let i = 0; i < NUM_POLYGROUPS; i++) {
      mesh.group_flags[i] = cursor.int32();
      mesh.poly_group_skin_names[i] = name();
    }
    return mesh;
  }
  function readRJoint(ctx) {
    const { cursor, name } = ctx;
    return {
      parent: cursor.int32(),
      children: readStructArray(
        ctx,
        ({ cursor: cursor2 }) => cursor2.int32(),
        MAX_CHILD_JOINTS
      ),
      name: name(),
      jointgroup: cursor.int32(),
      flags: cursor.int32(),
      baserot: readRotator(ctx),
      planes: readStructArray(ctx, readPlane, NUM_JOINT_PLANES)
    };
  }
  function readRSkelAnimSeq(ctx) {
    return {
      ...readMeshAnimationSequence(ctx),
      anim_data: readStructArray(ctx, ({ cursor }) => cursor.int8())
    };
  }
  function readJointState(ctx) {
    return {
      pos: readVector(ctx),
      rot: readRotator(ctx),
      scale: readScale(ctx)
    };
  }
  function readRAnimFrame(ctx) {
    const { cursor, name } = ctx;
    return {
      sequence_id: cursor.int16(),
      event: name(),
      bounds: readBoundingBox(ctx),
      joint_anim: readStructArray(ctx, readJointState)
    };
  }

  // src/structs/skeletal.ts
  function readSkeletalMeshExtWedge({
    cursor
  }) {
    return {
      i_vertex: cursor.uint16(),
      flags: cursor.uint16(),
      u: cursor.float32(),
      v: cursor.float32()
    };
  }
  function readSkeletalMeshSkeleton(ctx) {
    const { cursor, name } = ctx;
    return {
      name: name(),
      flags: cursor.uint32(),
      orientation: readQuaternion(ctx),
      position: readVector(ctx),
      length: cursor.float32(),
      x_size: cursor.float32(),
      y_size: cursor.float32(),
      z_size: cursor.float32(),
      children_count: cursor.uint32(),
      parent_index: cursor.uint32()
    };
  }
  function readSkeletalMeshBoneWeightIndex({
    cursor
  }) {
    return {
      weight_index: cursor.uint16(),
      number: cursor.uint16(),
      detail_a: cursor.uint16(),
      detail_b: cursor.uint16()
    };
  }
  function readSkeletalMeshBoneWeight({
    cursor
  }) {
    return {
      point_index: cursor.uint16(),
      bone_weight: cursor.uint16()
    };
  }
  function readSkeletalMeshWeaponAdjust(ctx) {
    return {
      origin: readVector(ctx),
      x_axis: readVector(ctx),
      y_axis: readVector(ctx),
      z_axis: readVector(ctx)
    };
  }

  // src/structs/texture.ts
  function readMipMap({ cursor, version }) {
    const width_offset = version >= 63 ? cursor.uint32() : void 0;
    const size = cursor.compactIndex();
    return {
      ...width_offset !== void 0 ? { width_offset } : {},
      size,
      data: cursor.bytes(size),
      width: cursor.uint32(),
      height: cursor.uint32(),
      bits_width: cursor.uint8(),
      bits_height: cursor.uint8()
    };
  }

  // src/natives/animation.ts
  function readUAnimation(ctx) {
    return {
      bones: readStructArray(ctx, readBoneReference),
      movements: readStructArray(ctx, readBoneMovement),
      animation_sequences: readStructArray(ctx, readMeshAnimationSequence)
    };
  }

  // src/natives/context.ts
  function readObjectRefs(ctx, count) {
    return Array.from(
      { length: count },
      () => ctx.object(ctx.cursor.compactIndex())
    );
  }
  function readObjectRef(ctx) {
    return ctx.object(ctx.cursor.compactIndex());
  }

  // src/natives/level.ts
  var NUM_LEVEL_TEXT_BLOCKS = 16;
  function readULevelBase(ctx) {
    const { cursor } = ctx;
    const count = cursor.uint32();
    cursor.skip(4);
    return {
      actors: readObjectRefs(ctx, count),
      url: readLevelURL(ctx)
    };
  }
  function readULevel(ctx) {
    const { cursor } = ctx;
    return {
      ...readULevelBase(ctx),
      model: readObjectRef(ctx),
      reach_specs: readStructArray(ctx, readReachSpec),
      approx_time: cursor.float32(),
      first_deleted: cursor.compactIndex(),
      text_blocks: readObjectRefs(ctx, NUM_LEVEL_TEXT_BLOCKS),
      ...ctx.version > 62 ? { travel_info: readStructArray(ctx, readLevelMap) } : {}
    };
  }

  // src/natives/primitive.ts
  function readUPrimitive(ctx) {
    return {
      bounding_box: readBoundingBox(ctx),
      bounding_sphere: readBoundingSphere(ctx)
    };
  }
  function readUModel(ctx) {
    const { cursor } = ctx;
    const bareIndices = ctx.version <= 61;
    const primitive = readUPrimitive(ctx);
    const geometry = bareIndices ? {
      vectors: cursor.compactIndex(),
      points: cursor.compactIndex(),
      nodes: cursor.compactIndex(),
      surfaces: cursor.compactIndex(),
      vertices: cursor.compactIndex()
    } : readModernGeometry(ctx);
    return {
      ...primitive,
      ...geometry,
      polys: cursor.compactIndex(),
      light_map: readStructArray(ctx, readLightMap),
      light_bits: readArray(cursor, () => cursor.uint8()),
      bounds: readStructArray(ctx, readBoundingBox),
      leaf_hulls: readArray(cursor, () => cursor.int32()),
      leaves: readStructArray(ctx, readBspLeaf),
      lights: readArray(cursor, () => cursor.compactIndex()),
      ...bareIndices ? { leaf_zone: cursor.compactIndex(), leaf_leaf: cursor.compactIndex() } : {},
      root_outside: cursor.uint32() > 0,
      linked: cursor.uint32() > 0
    };
  }
  function readModernGeometry(ctx) {
    const { cursor } = ctx;
    const vectors = readStructArray(ctx, readVector);
    const points = readStructArray(ctx, readVector);
    const nodes = readStructArray(ctx, readBspNode);
    const surfaces = readStructArray(ctx, readBspSurface);
    const vertices = readStructArray(ctx, readModelVertex);
    const num_shared_sides = cursor.int32();
    const num_zones = cursor.int32();
    return {
      vectors,
      points,
      nodes,
      surfaces,
      vertices,
      num_shared_sides,
      num_zones,
      zones: readStructArray(ctx, readZone, num_zones)
    };
  }
  function readUPolys(ctx) {
    const { cursor } = ctx;
    const poly_count = cursor.uint32();
    cursor.skip(4);
    return {
      poly_count,
      polys: readStructArray(ctx, readPolygon, poly_count)
    };
  }

  // src/natives/mesh.ts
  function readUMesh(ctx) {
    const { cursor, version } = ctx;
    return {
      ...readUPrimitive(ctx),
      ...version > 61 ? { vertices_jump: cursor.uint32() } : {},
      vertices: readStructArray(ctx, readMeshVertex),
      ...version > 61 ? { triangles_jump: cursor.uint32() } : {},
      triangles: readStructArray(ctx, readMeshTriangle),
      anim_sequences: readStructArray(ctx, readMeshAnimationSequence),
      connects_jump: cursor.uint32(),
      connections: readStructArray(ctx, readMeshConnection),
      bounding_box_2: readBoundingBox(ctx),
      bounding_sphere_2: readBoundingSphere(ctx),
      vert_links_jump: cursor.uint32(),
      vert_links: readArray(cursor, () => cursor.uint32()),
      textures: readObjectRefs(ctx, cursor.compactIndex()),
      bounding_boxes: readStructArray(ctx, readBoundingBox),
      bounding_spheres: readStructArray(ctx, readBoundingSphere),
      frame_verts: cursor.uint32(),
      anim_frames: cursor.uint32(),
      flags_AND: cursor.uint32(),
      flags_OR: cursor.uint32(),
      scale: readVector(ctx),
      origin: readVector(ctx),
      rotation_origin: readRotator(ctx),
      cur_poly: cursor.uint32(),
      cur_vertex: cursor.uint32(),
      ...version === 65 ? { texture_lod: readArray(cursor, () => cursor.float32(), 1) } : version >= 66 ? { texture_lod: readArray(cursor, () => cursor.float32()) } : {}
    };
  }
  function readULodMesh(ctx) {
    const { cursor } = ctx;
    return {
      ...readUMesh(ctx),
      collapse_point_thus: readArray(cursor, () => cursor.uint16()),
      face_level: readArray(cursor, () => cursor.uint16()),
      faces: readStructArray(ctx, readLodMeshFace),
      collapse_wedge_thus: readArray(cursor, () => cursor.uint16()),
      wedges: readStructArray(ctx, readLodMeshWedge),
      materials: readStructArray(ctx, readLodMeshMaterial),
      special_faces: readStructArray(ctx, readLodMeshFace),
      model_vertices: cursor.uint32(),
      special_vertices: cursor.uint32(),
      mesh_scale_max: cursor.float32(),
      lod_hysteresis: cursor.float32(),
      lod_strength: cursor.float32(),
      lod_min_verts: cursor.uint32(),
      lod_morph: cursor.float32(),
      lod_z_displace: cursor.float32(),
      remap_anim_vertices: readArray(cursor, () => cursor.uint16()),
      old_frame_verts: cursor.uint32()
    };
  }
  function readUSkeletalMesh(ctx) {
    const { cursor } = ctx;
    return {
      ...readULodMesh(ctx),
      ext_wedges: readStructArray(ctx, readSkeletalMeshExtWedge),
      points: readStructArray(ctx, readVector),
      skeletons: readStructArray(ctx, readSkeletalMeshSkeleton),
      bone_weight_indices: readStructArray(ctx, readSkeletalMeshBoneWeightIndex),
      bone_weights: readStructArray(ctx, readSkeletalMeshBoneWeight),
      local_points: readStructArray(ctx, readVector),
      skeletal_depth: cursor.uint32(),
      default_animation: readObjectRef(ctx),
      weapon_bone_index: cursor.int32(),
      weapon_adjust: readSkeletalMeshWeaponAdjust(ctx)
    };
  }
  function readUSkelModel(ctx) {
    const { cursor } = ctx;
    return {
      ...readUPrimitive(ctx),
      num_meshes: cursor.int32(),
      num_joints: cursor.int32(),
      num_frames: cursor.int32(),
      num_sequences: cursor.int32(),
      num_skins: cursor.int32(),
      root_joint: cursor.int32(),
      meshes: readStructArray(ctx, readRMesh),
      joints: readStructArray(ctx, readRJoint),
      anim_sequences: readStructArray(ctx, readRSkelAnimSeq),
      frames: readStructArray(ctx, readRAnimFrame),
      pos_offset: readVector(ctx),
      rot_offset: readRotator(ctx)
    };
  }

  // src/natives/sound.ts
  function readUMusic(ctx) {
    const { cursor } = ctx;
    const format = ctx.name();
    const data_end_offset = cursor.uint32();
    const size = cursor.compactIndex();
    return {
      format,
      data_end_offset,
      size,
      audio_data: cursor.bytes(size)
    };
  }
  function readUSound(ctx) {
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
        ...core_flags & SOUND_FLAGS.SF_HasLipSync ? {
          lip_sync_skip_offset: cursor.uint32(),
          lip_sync_data_count: cursor.compactIndex(),
          lip_sync_data_offset: cursor.offset
        } : {}
      };
    }
    return {
      format,
      ...version >= 63 ? { next_object_offset: cursor.uint32() } : {},
      size: cursor.compactIndex(),
      audio_offset: cursor.offset
    };
  }

  // src/natives/text.ts
  function readUTextBuffer(ctx) {
    const { cursor } = ctx;
    const pos = cursor.uint32();
    const top = cursor.uint32();
    const size = cursor.compactIndex();
    if (size <= 0) {
      return { pos, top, size };
    }
    const contents = decodeText(cursor.bytes(size - 1));
    cursor.skip(1);
    return { pos, top, size, contents };
  }

  // src/natives/texture.ts
  function readUTexture(ctx) {
    return {
      mip_maps: readStructArray(ctx, readMipMap, ctx.cursor.uint8())
    };
  }
  var readUScriptedTexture = readUTexture;
  function readUPalette(ctx) {
    return {
      colours: readStructArray(ctx, readColour)
    };
  }
  function readUFont(ctx) {
    const { cursor, version } = ctx;
    if (version < 68) {
      return {
        ...readUTexture(ctx),
        characters: readStructArray(ctx, readFontCharacter)
      };
    }
    return {
      textures: readStructArray(ctx, readFontTexture),
      characters_per_page: cursor.int32(),
      ...version >= 69 ? {
        char_remap: readStructArray(ctx, readFontRemap),
        is_remapped: cursor.uint32() > 0
      } : {}
    };
  }

  // src/natives/index.ts
  var NATIVE_READERS = {
    Animation: readUAnimation,
    Font: readUFont,
    Level: readULevel,
    LodMesh: readULodMesh,
    Mesh: readUMesh,
    Model: readUModel,
    Music: readUMusic,
    Palette: readUPalette,
    Polys: readUPolys,
    ScriptedTexture: readUScriptedTexture,
    SkeletalMesh: readUSkeletalMesh,
    SkelModel: readUSkelModel,
    Sound: readUSound,
    TextBuffer: readUTextBuffer,
    Texture: readUTexture
  };
  function isNativeClassName(className) {
    return className !== null && Object.hasOwn(NATIVE_READERS, className);
  }
  function readNativeData(ctx, className) {
    return isNativeClassName(className) ? NATIVE_READERS[className](ctx) : null;
  }

  // src/package/objects.ts
  var MAX_PACKAGE_DEPTH = 128;
  var UObject = class {
    package_index = 0;
    object_name_index = 0;
    resolver;
    constructor(resolver) {
      this.resolver = resolver;
    }
    get objectName() {
      return this.resolver.name(this.object_name_index);
    }
    /**
     * The object this one lives inside - its group, or the package itself.
     *
     * Zero means "not in any package", which `object()` returns as null.
     */
    get packageObject() {
      return this.resolver.object(this.package_index);
    }
    get packageName() {
      return this.packageObject?.objectName || null;
    }
    get isInPackage() {
      return Boolean(this.packageObject);
    }
    /**
     * Walks the package chain to the outermost container.
     */
    get uppermostPackageObject() {
      let parent = this;
      for (let depth = 0; parent.packageObject; depth++) {
        if (depth === MAX_PACKAGE_DEPTH) {
          throw new Error(
            `Package chain for "${this.objectName}" exceeds ${MAX_PACKAGE_DEPTH} levels: the package indices form a cycle`
          );
        }
        parent = parent.packageObject;
      }
      return parent;
    }
    get uppermostPackageObjectName() {
      return this.uppermostPackageObject.objectName;
    }
  };
  var ExportTableObject = class extends UObject {
    class_index;
    super_index;
    object_flags;
    serial_size;
    serial_offset;
    #ctx;
    #properties;
    #propertiesEndOffset = 0;
    #objectData;
    constructor(ctx, cursor = ctx.cursor) {
      super(ctx);
      this.#ctx = ctx;
      this.class_index = cursor.compactIndex();
      this.super_index = cursor.compactIndex();
      this.package_index = cursor.int32();
      this.object_name_index = cursor.compactIndex();
      this.object_flags = cursor.uint32();
      this.serial_size = cursor.compactIndex();
      if (this.hasData) {
        this.serial_offset = cursor.compactIndex();
      }
    }
    get table() {
      return "export";
    }
    /** The class this object is an instance of, or null for a classless export. */
    get classObject() {
      return this.resolver.object(this.class_index);
    }
    get parentObject() {
      return this.resolver.object(this.super_index);
    }
    get className() {
      return this.classObject?.objectName || null;
    }
    get parentObjectName() {
      return this.parentObject?.objectName || null;
    }
    get flagNames() {
      return decodeObjectFlags(this.object_flags);
    }
    get hasData() {
      return this.serial_size > 0;
    }
    hasFlag(flag) {
      return Boolean(this.object_flags & flag);
    }
    /**
     * The object's saved properties, read on first access and cached.
     */
    get properties() {
      if (this.#properties) {
        this.#ctx.cursor.seek(this.#propertiesEndOffset);
        return this.#properties;
      }
      const properties = this.#properties = [];
      if (this.hasData) {
        this.#ctx.cursor.seek(this.serial_offset);
        if (this.hasFlag(OBJECT_FLAGS.RF_HasStack)) {
          properties.push(readStateFrame(this.#ctx));
        }
        if (this.class_index !== 0) {
          properties.push(...readPropertyList(this.#ctx));
        }
      }
      this.#propertiesEndOffset = this.#ctx.cursor.offset;
      return properties;
    }
    /** First property with this name, compared case-insensitively. */
    getProp(name) {
      const wanted = name.toLowerCase();
      return this.properties.find((prop) => prop.name.toLowerCase() === wanted);
    }
    /**
     * The object's complete parse: its properties followed by its native class
     * data, or null for a class the reader has no native reader for.
     *
     * `properties` is evaluated first, which is what positions the cursor at the
     * start of the native data. Read once and cached.
     */
    readData() {
      if (this.#objectData !== void 0) return this.#objectData;
      if (!isNativeClassName(this.className)) {
        return this.#objectData = null;
      }
      const properties = this.properties;
      const data = readNativeData(this.#ctx, this.className);
      return this.#objectData = { properties, ...data };
    }
  };
  var ImportTableObject = class extends UObject {
    class_package_index;
    class_name_index;
    constructor(resolver, cursor) {
      super(resolver);
      this.class_package_index = cursor.compactIndex();
      this.class_name_index = cursor.compactIndex();
      this.package_index = cursor.int32();
      this.object_name_index = cursor.compactIndex();
    }
    get table() {
      return "import";
    }
    get classPackageName() {
      return this.resolver.name(this.class_package_index);
    }
    get className() {
      return this.resolver.name(this.class_name_index);
    }
  };

  // src/package/package.ts
  var UnrealPackage = class {
    cursor;
    header;
    nameTable;
    exportTable;
    importTable;
    constructor(buffer) {
      this.cursor = new BinaryCursor(buffer);
      this.header = readPackageHeader(this.cursor);
      this.nameTable = readNameTable(this.cursor, this.header);
      this.cursor.seek(this.header.export_offset);
      this.exportTable = Array.from(
        { length: this.header.export_count },
        () => new ExportTableObject(this, this.cursor)
      );
      this.cursor.seek(this.header.import_offset);
      this.importTable = Array.from(
        { length: this.header.import_count },
        () => new ImportTableObject(this, this.cursor)
      );
    }
    get version() {
      return this.header.version;
    }
    get licenseeVersion() {
      return this.header.licensee_version;
    }
    /**
     * Resolve a name-table entry, reading a compact index from the cursor when no
     * index is given - which is how a struct field holding a name is stored.
     */
    name = (index) => {
      return this.nameTable[index ?? this.cursor.compactIndex()].name;
    };
    /**
     * Resolve an object reference. Zero is no object, a positive value is a
     * 1-based export index, and a negative value is a bitwise-complemented import
     * index - so -1 is the first import.
     *
     * An index past the end of either table returns null.
     */
    object = (index) => {
      if (index === 0) return null;
      return (index < 0 ? this.importTable[~index] : this.exportTable[index - 1]) ?? null;
    };
    /** First export whose name matches exactly, or null. */
    getExportObjectByName(objectName) {
      return this.exportTable.find((object) => object.objectName === objectName) ?? null;
    }
  };

  // src/browser/canvas.ts
  function createCanvas({
    width,
    height,
    palette,
    mipMap
  }) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = width;
    canvas.height = height;
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    let i = 0;
    if (mipMap) {
      for (const pixel of mipMap.data) {
        const colour = palette.colours[pixel];
        imageData.data[i++] = colour.r;
        imageData.data[i++] = colour.g;
        imageData.data[i++] = colour.b;
        imageData.data[i++] = 255;
      }
    } else {
      for (const pixel of palette.colours) {
        imageData.data[i++] = pixel.r;
        imageData.data[i++] = pixel.g;
        imageData.data[i++] = pixel.b;
        imageData.data[i++] = 255;
      }
    }
    context.putImageData(imageData, 0, 0);
    return canvas;
  }
  function textureToCanvas(reader, textureObject) {
    const textureData = textureObject.readData();
    const [mipMap] = textureData.mip_maps;
    const paletteProp = textureObject.getProp("palette");
    const paletteObject = reader.getObject(
      paletteProp.value
    );
    const palette = paletteObject.readData();
    return createCanvas({
      width: mipMap.width,
      height: mipMap.height,
      palette,
      mipMap
    });
  }
  function getPaletteCanvas(paletteObject) {
    return createCanvas({
      width: 16,
      height: 16,
      palette: paletteObject.readData()
    });
  }
  function getLevelScreenshots(reader) {
    const screenshots = [];
    const screenshotRegEx = /^Screenshot([0-9]+)?$/i;
    const screenshotObjects = reader.getTextureObjects().filter((item) => screenshotRegEx.test(item.objectName));
    if (screenshotObjects.length > 0) {
      const tempScreenshots = screenshotObjects.map((item) => ({
        canvas: textureToCanvas(reader, item),
        num: Number(item.objectName.substring("Screenshot".length))
      }));
      tempScreenshots.sort(({ num: a }, { num: b }) => a - b);
      screenshots.push(...tempScreenshots.map((item) => item.canvas));
    } else {
      const levelInfo = reader.getExportObjectByName("LevelInfo0");
      const screenshotProp = levelInfo?.getProp("Screenshot");
      if (screenshotProp && "value" in screenshotProp) {
        const invalidScreenshot = reader.getObject(
          screenshotProp.value
        );
        if (invalidScreenshot && invalidScreenshot.table !== "import") {
          screenshots.push(
            textureToCanvas(reader, invalidScreenshot)
          );
        }
      }
    }
    return screenshots;
  }

  // src/reader.ts
  var WAVE_FORMAT_PCM = 1;
  var SUBCHUNK_SIZE_PCM = 16;
  var UnrealPackageReader = class {
    #buffer;
    #package;
    /** Assigned by the consumer after readPackage(); never set by the reader. */
    filename;
    propertyTypes = PROPERTY_TYPES;
    objectFlags = OBJECT_FLAGS;
    soundFlags = SOUND_FLAGS;
    polyFlags = POLY_FLAGS;
    brushClasses = BRUSH_CLASSES;
    moverClasses = MOVER_CLASSES;
    meshClasses = MESH_CLASSES;
    enumBumpType = BUMP_TYPE;
    enumMoverEncroachType = MOVER_ENCROACH_TYPE;
    enumMoverGlideType = MOVER_GLIDE_TYPE;
    enumCsgOper = CSG_OPER;
    enumSheerAxis = SHEER_AXIS;
    fileTypesByExt = FILE_TYPE_BY_EXTENSION;
    extByFileType = EXTENSION_BY_PACKAGE_PATH;
    defaultPackages = DEFAULT_PACKAGES;
    constructor(buffer) {
      this.#buffer = buffer;
    }
    /** Parse the package. Returns this same reader, so the call chains off the constructor. */
    readPackage() {
      this.#package = new UnrealPackage(this.#buffer);
      return this;
    }
    /** The parsed package. Everything below reaches the parse through this. */
    get package() {
      if (!this.#package) {
        throw new Error("Package not parsed yet: call readPackage() first");
      }
      return this.#package;
    }
    get header() {
      return this.package.header;
    }
    get version() {
      return this.package.version;
    }
    get nameTable() {
      return this.package.nameTable;
    }
    get exportTable() {
      return this.package.exportTable;
    }
    get importTable() {
      return this.package.importTable;
    }
    /**
     * Resolve an object reference: zero is null, and an index beyond either
     * table is `undefined`. The internal resolver (`UnrealPackage.object`) folds
     * that second case into null; this method keeps the two apart because a
     * consumer can distinguish "no object" from "dangling reference" with
     * `=== null`.
     */
    getObject(index) {
      if (index === 0) return null;
      return index < 0 ? this.importTable[~index] : this.exportTable[index - 1];
    }
    getObjectNameFromIndex(index) {
      return this.getObject(index)?.objectName || "None";
    }
    getExportObjectByName(objectName) {
      return this.package.getExportObjectByName(objectName);
    }
    getImportObjectByName(objectName) {
      return this.importTable.find((item) => item.objectName === objectName) ?? null;
    }
    getExportObjectsByName(objectName) {
      return this.exportTable.filter((item) => item.objectName === objectName);
    }
    getImportObjectsByName(objectName) {
      return this.importTable.filter((item) => item.objectName === objectName);
    }
    getObjectsByClass(objectClass) {
      return this.exportTable.filter((item) => item.className === objectClass);
    }
    getLevelObjects() {
      return this.getObjectsByClass("Level");
    }
    getMusicObjects() {
      return this.getObjectsByClass("Music");
    }
    getSoundObjects() {
      return this.getObjectsByClass("Sound");
    }
    getTextBufferObjects() {
      return this.getObjectsByClass("TextBuffer");
    }
    getTextureObjects() {
      return this.getObjectsByClass("Texture");
    }
    getAllBrushObjects() {
      return this.exportTable.filter(
        (item) => this.brushClasses.includes(
          item.className
        )
      );
    }
    getAllMeshObjects() {
      return this.exportTable.filter(
        (item) => this.meshClasses.includes(item.className)
      );
    }
    /**
     * A brush actor's geometry: its `Brush` property references a `Model`, whose
     * `polys` references the `Polys` holding the editor polygons. Corrupt
     * references throw.
     */
    getBrushModelPolys(brushObject) {
      const data = { brush: brushObject, model: {}, polys: {} };
      const brushProp = brushObject.getProp("brush");
      if (brushProp && "value" in brushProp) {
        const modelObject = this.getObject(
          brushProp.value
        );
        const modelData = modelObject.readData();
        data.model.object = modelObject;
        data.model.properties = modelData;
        if (modelData.polys !== 0) {
          const polyObject = this.getObject(modelData.polys);
          const polysData = polyObject.readData();
          data.polys.object = polyObject;
          data.polys.polygons = polysData.polys;
        }
      }
      return data;
    }
    getAllBrushData() {
      return this.getAllBrushObjects().map(
        (brush) => this.getBrushModelPolys(brush)
      );
    }
    getTextureInfo(textureObject) {
      return {
        name: textureObject.objectName,
        group: textureObject.packageName
      };
    }
    getTextureGroups() {
      const grouped = {};
      const ungrouped = [];
      let total = 0;
      for (const texture of this.getTextureObjects()) {
        const { name, group } = this.getTextureInfo(texture);
        if (group) {
          (grouped[group] ??= []).push(name);
        } else {
          ungrouped.push(name);
        }
        total++;
      }
      return { grouped, ungrouped, length: total };
    }
    /**
     * Every sound in the package, with display metadata added.
     *
     * Mutates each sound's cached `readData()` result - `name`, `package`, and,
     * when the payload looks like plain PCM WAVE, the channel/rate/depth fields
     * sniffed from the RIFF header. Compressed or extended WAVEs keep whatever
     * the object itself carried.
     */
    getSounds() {
      const view = this.package.cursor.view;
      const sounds = [];
      for (const soundObject of this.getSoundObjects()) {
        const sound = soundObject.readData();
        sound.name = soundObject.objectName;
        if (soundObject.isInPackage) {
          sound.package = soundObject.packageName;
        }
        if (sound.format.toUpperCase() === "WAV" && view.getUint16(sound.audio_offset + 16, true) === SUBCHUNK_SIZE_PCM && view.getUint16(sound.audio_offset + 20, true) === WAVE_FORMAT_PCM) {
          sound.channels = view.getUint16(sound.audio_offset + 22, true);
          sound.sample_rate = view.getUint32(sound.audio_offset + 24, true);
          sound.byte_rate = view.getUint32(sound.audio_offset + 28, true);
          sound.bit_depth = view.getUint16(sound.audio_offset + 34, true);
        }
        sounds.push(sound);
      }
      return sounds;
    }
    /**
     * A light actor's colour as HSL. UT stores hue and saturation as bytes, with
     * saturation inverted (0 = full colour), and the defaults are UT's own.
     */
    getLightHsl(lightObject) {
      const hsl = { h: 0, s: 100, l: 25 };
      for (const prop of lightObject.properties) {
        if (!("value" in prop) || typeof prop.value !== "number") continue;
        switch (prop.name.toLowerCase()) {
          case "lighthue":
            hsl.h = Math.round(prop.value / 256 * 360);
            break;
          case "lightsaturation":
            hsl.s = 100 - Math.round(prop.value / 256 * 100);
            break;
          case "volumebrightness":
            hsl.l = Math.round(prop.value / 256 * 100);
            break;
        }
      }
      return hsl;
    }
    getPolyFlags(flags) {
      return decodePolyFlags(flags);
    }
    /**
     * The `LevelInfo0` summary shown for maps: title, author, song, etc.
     * with the object-reference properties resolved to names.
     */
    getLevelSummary(allProperties = false) {
      const levelSummary = {};
      const levelInfo = this.getExportObjectByName("LevelInfo0");
      const mainProperties = [
        "Author",
        "IdealPlayerCount",
        "LevelEnterText",
        "Song",
        "Title"
      ];
      const valueIsObjIndex = [
        "Song",
        "DefaultGameType",
        "Summary",
        "NavigationPointList",
        "Level"
      ];
      levelInfo?.properties.forEach((prop) => {
        if (allProperties || mainProperties.includes(prop.name)) {
          const value = "value" in prop ? prop.value : void 0;
          levelSummary[prop.name] = valueIsObjIndex.includes(prop.name) ? this.getObjectNameFromIndex(value) : value;
        }
      });
      return levelSummary;
    }
    isDefaultPackage(packageName) {
      return isDefaultPackage(packageName);
    }
    getPackageFileExtension(packageName) {
      return packageFileExtension(packageName);
    }
    /** Top-level package imports: the files this one needs alongside it. */
    getDependencies() {
      const dependencies = [];
      const { Song: levelMusic } = this.getLevelSummary();
      for (const tableEntry of this.importTable) {
        if (tableEntry.className === "Package" && !tableEntry.isInPackage) {
          const name = tableEntry.objectName;
          const isDefault = this.isDefaultPackage(name);
          const isLevelMusic = name === levelMusic;
          const dependency = { name, default: isDefault };
          if (isDefault) {
            dependency.ext = this.getPackageFileExtension(name);
          } else if (isLevelMusic) {
            dependency.ext = "umx";
          }
          if (isDefault || isLevelMusic) {
            dependency.type = this.fileTypesByExt[dependency.ext];
          }
          dependencies.push(dependency);
        }
      }
      return dependencies;
    }
    /**
     * `getDependencies()` split into stock (`default`) and custom packages.
     * When `ignoreCore` is set (it is by default), the stock packages that
     * virtually every game package depends on (`Core`, `Engine`, ...) are
     * omitted entirely, `length` included - their presence goes without saying,
     * so a consumer listing dependencies rarely wants them.
     */
    getDependenciesFiltered(ignoreCore = true) {
      const ignore = [
        "botpack",
        "core",
        "engine",
        "unreali",
        "unrealshare",
        "uwindow"
      ];
      const filtered = {
        length: 0,
        packages: { default: [], custom: [] }
      };
      for (const dep of this.getDependencies()) {
        if (dep.default) {
          if (ignoreCore && ignore.includes(dep.name.toLowerCase())) continue;
          filtered.packages.default.push(dep);
        } else {
          filtered.packages.custom.push(dep);
        }
        filtered.length++;
      }
      return filtered;
    }
    /** Export counts per class name, lowercased. */
    getClassesCount() {
      const counts = {};
      for (const tableEntry of this.exportTable) {
        if (!tableEntry.className) continue;
        const className = tableEntry.className.toLowerCase();
        counts[className] = (counts[className] ?? 0) + 1;
      }
      return counts;
    }
    // The canvas-producing methods, delegated so browser-only code stays in
    // src/browser. Calling these outside a browser throws on `document`.
    textureToCanvas(textureObject) {
      return textureToCanvas(this, textureObject);
    }
    getPaletteCanvas(paletteObject) {
      return getPaletteCanvas(paletteObject);
    }
    getLevelScreenshots() {
      return getLevelScreenshots(this);
    }
  };

  // src/browser/entry.ts
  globalThis.UnrealPackageReader = UnrealPackageReader;
})();
//# sourceMappingURL=UnrealPackageReader.js.map
