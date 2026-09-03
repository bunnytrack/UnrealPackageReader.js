var UnrealPackageReader = function (arrayBuffer) {
  /**
   * Globally accessible DataView object of this file
   */
  this.dataView = new DataView(arrayBuffer);

  /**
   * Reference to UnrealPackageReader object; used to access global variables and functions
   */
  const reader = this;

  /**
   * UT file signatures
   */
  const SIGNATURE_UT = 0x9e2a83c1;

  const PACKAGE_PATH = {
    SYSTEM: "system",
    MAPS: "maps",
    TEXTURES: "textures",
    SOUNDS: "sounds",
    MUSIC: "music",
  };

  const FILE_EXTENSION = {
    SYSTEM: "u",
    MAP: "unr",
    TEXTURE: "utx",
    SOUND: "uax",
    MUSIC: "umx",
    UMOD: "umod",
    CACHE_UXX: "uxx",
    ZIP: "uz",
    TMP_ZIP: "tmp",
  };

  /**
   * File-reading helper functions
   */
  this.offset = 0;

  this.seek = function (offset) {
    return (reader.offset = offset);
  };

  const readBytes = (fn, size) => {
    const val = fn.call(reader.dataView, reader.offset, true);
    reader.offset += size;
    return val;
  };

  const Int8 = () => readBytes(reader.dataView.getInt8, 1);
  const Uint8 = () => readBytes(reader.dataView.getUint8, 1);
  const Int16 = () => readBytes(reader.dataView.getInt16, 2);
  const Uint16 = () => readBytes(reader.dataView.getUint16, 2);
  const Int32 = () => readBytes(reader.dataView.getInt32, 4);
  const Uint32 = () => readBytes(reader.dataView.getUint32, 4);
  const Float32 = () => readBytes(reader.dataView.getFloat32, 4);
  const BigInt64 = () => readBytes(reader.dataView.getBigInt64, 8);
  const BigUint64 = () => readBytes(reader.dataView.getBigUint64, 8);

  /**
   * A compact index is a variable-length signed integer spanning 1-5 bytes:
   *
   * ```
   *   byte 1     bit 8 = sign, bit 7 = continuation, bits 1-6 = value
   *   bytes 2-5  bit 8 = continuation, bits 1-7 = value
   * ```
   *
   * 6 + 7 + 7 + 7 bits leaves only 5 bits for the fifth byte, making 32 in
   * total - the most a compact index can hold. The fifth byte is therefore
   * terminal, and a conforming encoder can never set its continuation bit,
   * because the value that bit would continue has already used every bit
   * available to it.
   */
  const MAX_COMPACT_INDEX_BYTES = 5;

  const MAX_PACKAGE_DEPTH = 128;

  const CompactIndex = () => {
    const firstByte = Uint8();

    const isNegative = firstByte & 0b10000000;
    let hasMoreBytes = firstByte & 0b01000000;
    let value = firstByte & 0b00111111;

    let bytesRead = 1;
    let shift = 6;

    while (hasMoreBytes && bytesRead < MAX_COMPACT_INDEX_BYTES) {
      const byte = Uint8();
      bytesRead++;

      const isFinalByte = bytesRead === MAX_COMPACT_INDEX_BYTES;
      const valueBits = isFinalByte ? 0b00011111 : 0b01111111;

      value = ((byte & valueBits) << shift) | value;
      shift += 7;

      hasMoreBytes = byte & 0b10000000;

      if (isFinalByte && hasMoreBytes) {
        const hex = byte.toString(16).padStart(2, "0");

        throw new Error(
          `Invalid compact index at offset ${reader.offset - 1}: ` +
            `byte ${bytesRead} (0x${hex}) sets the continuation bit, but a ` +
            `compact index holds at most ${MAX_COMPACT_INDEX_BYTES} bytes`,
        );
      }
    }

    // Match the engine's signed 32-bit INT: `| 0` re-wraps a negation that
    // leaves int32 range, and turns JavaScript's -0 into the 0 a C++ int
    // negation gives.
    return (isNegative ? -value : value) | 0;
  };

  // Return a name from the name table from a given index,
  // or more typically, by reading a compact index.
  const Name = (index) => reader.nameTable[index ?? CompactIndex()].name;

  // Return a "templated" array of a given class or byte function
  const TArray = (type, size) => {
    const array = new Array(size ?? CompactIndex());

    switch (type.name) {
      case "Int8":
      case "Uint8":
      case "Int16":
      case "Uint16":
      case "Int32":
      case "Uint32":
      case "Float32":
      case "BigInt64":
      case "BigUint64":
      case "CompactIndex":
      case "Name":
        for (let i = 0; i < array.length; i++) array[i] = type();
        break;
      default:
        for (let i = 0; i < array.length; i++) array[i] = new type();
        break;
    }

    return array;
  };

  // Gets text where the first byte specifies the size
  this.getSizedText = function (offsetAdjust) {
    const size = Uint8();
    const bytes = reader.dataView.buffer.slice(
      reader.offset,
      reader.offset + size - 1,
    );

    reader.offset += size;

    if (offsetAdjust !== undefined) reader.offset += offsetAdjust;

    return reader.decodeText(bytes);
  };

  /**
   * From Anthrax (maintainer of OldUnreal UT99 patch):
   *   There are two legal encodings for string properties: "plain ANSI" or UTF-16LE.
   *   If the string you want to store in the property has no characters outside the [0, 0x7F] range,
   *   it will be stored as plain ANSI. The way to tell them apart is to look at the length that is stored
   *   at the start of the string: positive length = ANSI, negative = UTF-16LE.
   */
  this.getStringProperty = function () {
    const strSize = CompactIndex();
    const isUtf16 = strSize < 0;
    const charWidth = isUtf16 ? 2 : 1;
    const byteLength = Math.abs(strSize) * charWidth;
    const bytes = reader.dataView.buffer.slice(
      reader.offset,
      reader.offset + byteLength - charWidth,
    );

    reader.offset += byteLength;

    if (isUtf16) {
      return reader.decodeText(bytes, "utf-16le");
    }

    return reader.decodeText(bytes);
  };

  this.decodeText = function (bytes, encoding) {
    return new TextDecoder(encoding || "windows-1252").decode(bytes);
  };

  /**
   * A static-array element index in the engine's own encoding
   * (`FPropertyTag<<`, Core/Src/UnClass.cpp in the UT v400 tree):
   *
   *   ```
   *   0xxxxxxx                            one byte, 0-127
   *   10xxxxxx xxxxxxxx                   two bytes, big-endian
   *   11xxxxxx xxxxxxxx xxxxxxxx xxxxxxxx four bytes, big-endian
   *   ```
   *
   * Big-endian because the engine writes it byte by byte, not as a word. Not a
   * compact index - the continuation bit lives elsewhere.
   */
  this.getArrayIndex = function () {
    const first = Uint8();

    if ((first & 0x80) === 0) {
      return first;
    }

    if ((first & 0xc0) === 0x80) {
      return ((first & 0x7f) << 8) | Uint8();
    }

    return ((first & 0x3f) << 24) | (Uint8() << 16) | (Uint8() << 8) | Uint8();
  };

  /** Copy of the next `byteCount` bytes. */
  this.getBytes = function (byteCount) {
    const start = reader.offset;
    reader.offset += byteCount;
    return new Uint8Array(reader.dataView.buffer.slice(start, reader.offset));
  };

  /** The legacy fixed-length String type: null-terminated ANSI within `size`. */
  this.getFixedString = function (size) {
    const bytes = reader.getBytes(size);
    const terminator = bytes.indexOf(0);

    return reader.decodeText(
      terminator === -1 ? bytes : bytes.subarray(0, terminator),
    );
  };

  /**
   * REFACTOR SCAFFOLDING - remove once the TypeScript port lands.
   *
   * These helpers are closure-private, so there is no way to test them from
   * outside. Exposing them lets the test suite pin their exact current
   * behaviour, which then serves as the spec the ported versions must match
   * byte for byte. Nothing in the reader itself reads this property.
   */
  this.__internals = {
    Int8,
    Uint8,
    Int16,
    Uint16,
    Int32,
    Uint32,
    Float32,
    BigInt64,
    BigUint64,
    CompactIndex,
    Name,
    TArray,
  };

  /**
   * Package table objects
   */
  class UObject {
    get objectName() {
      return Name(this.object_name_index);
    }

    get packageObject() {
      return reader.getObject(this.package_index);
    }

    get packageName() {
      return this.packageObject?.objectName || null;
    }

    get isInPackage() {
      return Boolean(this.packageObject);
    }

    get uppermostPackageObject() {
      let parent = this;

      for (let depth = 0; parent.packageObject; depth++) {
        if (depth === MAX_PACKAGE_DEPTH) {
          throw new Error(
            `Package chain for "${this.objectName}" exceeds ${MAX_PACKAGE_DEPTH} levels; bailing out`,
          );
        }

        parent = parent.packageObject;
      }

      return parent;
    }

    get uppermostPackageObjectName() {
      return this.uppermostPackageObject.objectName;
    }
  }

  class ExportTableObject extends UObject {
    #properties;
    #propertiesEndOffset;
    #objectData;

    constructor() {
      super();
      this.class_index = CompactIndex();
      this.super_index = CompactIndex();
      this.package_index = Int32();
      this.object_name_index = CompactIndex();
      this.object_flags = Uint32();
      this.serial_size = CompactIndex();

      if (this.hasData) {
        this.serial_offset = CompactIndex();
      }
    }

    get properties() {
      if (this.#properties) {
        reader.seek(this.#propertiesEndOffset);
        return this.#properties;
      }

      const properties = (this.#properties = []);

      if (!this.hasData) {
        this.#propertiesEndOffset = reader.offset;
        return properties;
      }

      reader.seek(this.serial_offset);

      // If RF_HasStack flag is present, handle "StateFrame" block which comes before the properties
      if (this.hasFlag(reader.objectFlags.RF_HasStack)) {
        // Not actually a property but include it anyway for completeness
        properties.push(new StateFrame());
      }

      if (this.class_index === 0) {
        this.#propertiesEndOffset = reader.offset;
        return properties;
      }

      // The first byte of property block is a name table index
      let currentPropName = Name();

      while (currentPropName.toLowerCase() !== "none") {
        const prop = {};

        // Next byte contains property info (type, size, etc.)
        const infoByte = Uint8();

        prop.name = currentPropName;
        prop.type = reader.propertyTypes[infoByte & 0xf];

        // If the property type is a struct then the struct name follows
        if (prop.type === "Struct") {
          prop.subtype = Name();
        }

        /**
         * The size value is interpreted in the following way:
         *   0 = 1 byte
         *   1 = 2 bytes
         *   2 = 4 bytes
         *   3 = 12 bytes
         *   4 = 16 bytes
         *   5 = a byte follows with real size
         *   6 = a word follows with real size
         *   7 = an integer follows with real size
         */
        const propSizeInfo = (infoByte >> 4) & 0x7;
        let propSize;

        switch (propSizeInfo) {
          case 0:
            propSize = 1;
            break;
          case 1:
            propSize = 2;
            break;
          case 2:
            propSize = 4;
            break;
          case 3:
            propSize = 12;
            break;
          case 4:
            propSize = 16;
            break;

          case 5:
            propSize = Uint8();
            break;

          case 6:
            propSize = Uint16();
            break;

          case 7:
            propSize = Uint32();
            break;

          default:
            propSize = 1;
            break;
        }

        /**
         * Bit 7 is the array flag - except for a Boolean, where it is the value
         * itself and no index follows.
         *
         * The engine writes one entry per static-array element that differs
         * from the default, in ascending order, and element 0 is written
         * *without* the flag. So when a flagged element follows an unmarked
         * property of the same name, that previous property was element 0 and
         * is marked as such after the fact - rebuilt rather than mutated, so
         * its key order matches an element that was read with the flag.
         */
        const arrayFlag = Boolean(infoByte >> 7);

        if (prop.type !== "Boolean" && arrayFlag) {
          prop.index = reader.getArrayIndex();

          const prevProp = properties[properties.length - 1];

          if (
            prevProp &&
            prevProp.index === undefined &&
            prevProp.name === prop.name
          ) {
            properties[properties.length - 1] = {
              name: prevProp.name,
              type: prevProp.type,
              ...(prevProp.subtype !== undefined
                ? { subtype: prevProp.subtype }
                : {}),
              index: 0,
              value: prevProp.value,
            };
          }
        }

        // Assign property value
        switch (prop.type) {
          case "Byte":
            prop.value = Uint8();
            break;

          case "Integer":
            prop.value = Int32();
            break;

          case "Boolean":
            prop.value = arrayFlag;
            break;

          case "Float":
            prop.value = Float32();
            break;

          // A class<...> variable is an object reference to a class, written
          // exactly like Object (UClassProperty subclasses UObjectProperty).
          case "Object":
          case "Class":
            prop.value = CompactIndex();
            break;

          case "Name":
            prop.value = Name();
            break;

          case "Struct":
            switch (prop.subtype.toLowerCase()) {
              case "color":
                prop.value = new Colour();
                break;

              case "vector":
                prop.value = new Vector();
                break;

              case "rotator":
                prop.value = new Rotator();
                break;

              case "scale":
                prop.value = new Scale();
                break;

              case "pointregion":
                prop.value = new PointRegion();
                break;

              // A struct this reader has no layout for: keep its bytes.
              default:
                prop.value = reader.getBytes(propSize);
                break;
            }
            break;

          case "Str":
            prop.value = reader.getStringProperty();
            break;

          // The pre-Str fixed-length string: null-terminated ANSI within the
          // tagged size, which is how the engine upgrades it.
          case "String":
            prop.value = reader.getFixedString(propSize);
            break;

          // Reserved or legacy type IDs with no reader: keep the bytes.
          case "Unknown":
          case "Array":
          case "Vector":
          case "Rotator":
          case "Map":
          case "Fixed Array":
          default:
            prop.value = reader.getBytes(propSize);
            break;
        }

        properties.push(prop);

        currentPropName = Name();
      }

      this.#propertiesEndOffset = reader.offset;

      return properties;
    }

    get classObject() {
      return reader.getObject(this.class_index);
    }

    get parentObject() {
      return reader.getObject(this.super_index);
    }

    get className() {
      return this.classObject?.objectName || null;
    }

    get parentObjectName() {
      return this.parentObject?.objectName || null;
    }

    get flagNames() {
      return Object.keys(reader.objectFlags).filter((name) => {
        return reader.objectFlags[name] & this.object_flags;
      });
    }

    get hasData() {
      return this.serial_size > 0;
    }

    get table() {
      return "export";
    }

    getProp(name) {
      return this.properties.find(
        (prop) => prop.name.toLowerCase() === name.toLowerCase(),
      );
    }

    hasFlag(flag) {
      return Boolean(this.object_flags & flag);
    }

    readData() {
      if (this.#objectData) return this.#objectData;

      let objectClass;

      switch (this.className) {
        case "Animation":
          objectClass = UAnimation;
          break;
        case "Font":
          objectClass = UFont;
          break;
        case "Level":
          objectClass = ULevel;
          break;
        case "LodMesh":
          objectClass = ULodMesh;
          break;
        case "Mesh":
          objectClass = UMesh;
          break;
        case "Model":
          objectClass = UModel;
          break;
        case "Music":
          objectClass = UMusic;
          break;
        case "Palette":
          objectClass = UPalette;
          break;
        case "Polys":
          objectClass = UPolys;
          break;
        case "ScriptedTexture":
          objectClass = UScriptedTexture;
          break;
        case "SkeletalMesh":
          objectClass = USkeletalMesh;
          break;
        case "SkelModel":
          objectClass = USkelModel;
          break;
        case "Sound":
          objectClass = USound;
          break;
        case "TextBuffer":
          objectClass = UTextBuffer;
          break;
        case "Texture":
          objectClass = UTexture;
          break;
        default:
          return null;
      }

      return (this.#objectData = {
        properties: this.properties,
        ...new objectClass(),
      });
    }
  }

  class ImportTableObject extends UObject {
    constructor() {
      super();
      this.class_package_index = CompactIndex();
      this.class_name_index = CompactIndex();
      this.package_index = Int32();
      this.object_name_index = CompactIndex();
    }

    get classPackageName() {
      return Name(this.class_package_index);
    }

    get className() {
      return Name(this.class_name_index);
    }

    get table() {
      return "import";
    }
  }

  /**
   * Structs
   */
  class StateFrame {
    constructor() {
      this.name = "StateFrame";
      this.node = CompactIndex();
      this.state_node = CompactIndex();
      this.probe_mask = BigInt64();
      this.latent_action = Uint32();

      if (this.node !== 0) {
        this.offset = CompactIndex();
      }
    }
  }

  class Vector {
    constructor() {
      this.x = Float32();
      this.y = Float32();
      this.z = Float32();
    }
  }

  class Rotator {
    constructor() {
      this.pitch = Int32();
      this.yaw = Int32();
      this.roll = Int32();
    }
  }

  class Quaternion {
    constructor() {
      this.x = Float32();
      this.y = Float32();
      this.z = Float32();
      this.w = Float32();
    }
  }

  class Colour {
    constructor() {
      this.r = Uint8();
      this.g = Uint8();
      this.b = Uint8();
      this.a = Uint8();
    }
  }

  class Scale {
    constructor() {
      this.x = Float32();
      this.y = Float32();
      this.z = Float32();
      this.sheer_rate = Float32();
      this.sheer_axis = Uint8();
    }
  }

  class PointRegion {
    constructor() {
      this.zone = CompactIndex();
      this.i_leaf = Int32();
      this.zone_number = Uint8();
    }
  }

  class BoundingBox {
    constructor() {
      this.min = new Vector();
      this.max = new Vector();
      this.valid = Uint8() > 0;
    }
  }

  class BoundingSphere {
    constructor() {
      this.centre = new Vector();

      if (reader.header.version > 61) {
        this.radius = Float32();
      }
    }
  }

  class Plane {
    constructor() {
      this.x = Float32();
      this.y = Float32();
      this.z = Float32();
      this.w = Float32();
    }
  }

  class BspNode {
    constructor() {
      this.plane = new Plane();
      this.zone_mask = BigUint64();
      this.node_flags = Uint8();
      this.i_vert_pool = CompactIndex();
      this.i_surf = CompactIndex();
      this.i_front = CompactIndex();
      this.i_back = CompactIndex();
      this.i_plane = CompactIndex();
      this.i_collision_bound = CompactIndex();
      this.i_render_bound = CompactIndex();
      this.i_zone = TArray(Uint8, 2);
      this.vertices = Uint8();
      this.i_leaf = TArray(Int32, 2);
    }
  }

  class BspSurface {
    constructor() {
      this.texture = CompactIndex();
      this.poly_flags = Uint32();
      this.p_base = CompactIndex();
      this.v_normal = CompactIndex();
      this.v_texture_u = CompactIndex();
      this.v_texture_v = CompactIndex();
      this.i_light_map = CompactIndex();
      this.i_brush_poly = CompactIndex();
      this.pan_u = Int16();
      this.pan_v = Int16();
      this.actor = CompactIndex();
    }
  }

  class ModelVertex {
    constructor() {
      this.vertex = CompactIndex();
      this.i_side = CompactIndex();
    }
  }

  class MeshVertex {
    constructor() {
      // Vertex X/Y/Z values are stored in a single DWORD
      const xyz = Uint32();

      let x = (xyz & 0x7ff) / 8;
      let y = ((xyz >> 11) & 0x7ff) / 8;
      let z = ((xyz >> 22) & 0x3ff) / 4;

      if (x >= 128) x -= 256;
      if (y >= 128) y -= 256;
      if (z >= 128) z -= 256;

      // Deus Ex
      /*const xyz = Number(BigUint64());

      let x = (xyz & 0xFFFF) / 256;
      let y = ((xyz >> 16) & 0xFFFF) / 256;
      let z = ((xyz >> 32) & 0xFFFF) / 256;

      if (x > 128) x -= 256;
      if (y > 128) y -= 256;
      if (z > 128) z -= 256;*/

      this.x = x;
      this.y = y;
      this.z = z;
    }
  }

  class MeshTriangle {
    constructor() {
      this.vertex_index_1 = Uint16();
      this.vertex_index_2 = Uint16();
      this.vertex_index_3 = Uint16();
      this.vertex_1_u = Uint8();
      this.vertex_1_v = Uint8();
      this.vertex_2_u = Uint8();
      this.vertex_2_v = Uint8();
      this.vertex_3_u = Uint8();
      this.vertex_3_v = Uint8();
      this.flags = Uint32();
      this.texture_index = Uint32();
    }
  }

  class MeshAnimationSequence {
    constructor() {
      this.name = Name();
      this.group = Name();
      this.start_frame = Uint32();
      this.frame_count = Uint32();
      this.notifications = TArray(MeshAnimNotify);
      this.rate = Float32();
    }
  }

  class MeshAnimNotify {
    constructor() {
      this.time = Float32();
      this.function_name = Name();
    }
  }

  class MeshConnection {
    constructor() {
      this.num_vert_triangles = Uint32();
      this.triangle_list_offset = Uint32();
    }
  }

  class LodMeshFace {
    constructor() {
      this.wedge_index_1 = Uint16();
      this.wedge_index_2 = Uint16();
      this.wedge_index_3 = Uint16();
      this.material_index = Uint16();
    }
  }

  class LodMeshWedge {
    constructor() {
      this.vertex_index = Uint16();
      this.s = Uint8();
      this.t = Uint8();
    }
  }

  class LodMeshMaterial {
    constructor() {
      this.flags = Uint32();
      this.texture_index = Uint32();
    }
  }

  class SkeletalMeshExtWedge {
    constructor() {
      this.i_vertex = Uint16();
      this.flags = Uint16();
      this.u = Float32();
      this.v = Float32();
    }
  }

  class SkeletalMeshSkeleton {
    constructor() {
      this.name = Name();
      this.flags = Uint32();
      this.orientation = new Quaternion();
      this.position = new Vector();
      this.length = Float32();
      this.x_size = Float32();
      this.y_size = Float32();
      this.z_size = Float32();
      this.children_count = Uint32();
      this.parent_index = Uint32();
    }
  }

  class SkeletalMeshBoneWeightIndex {
    constructor() {
      this.weight_index = Uint16();
      this.number = Uint16();
      this.detail_a = Uint16();
      this.detail_b = Uint16();
    }
  }

  class SkeletalMeshBoneWeight {
    constructor() {
      this.point_index = Uint16();
      this.bone_weight = Uint16();
    }
  }

  class SkeletalMeshWeaponAdjust {
    constructor() {
      this.origin = new Vector();
      this.x_axis = new Vector();
      this.y_axis = new Vector();
      this.z_axis = new Vector();
    }
  }

  class BoneReference {
    constructor() {
      this.name = Name();
      this.flags = Uint32();
      this.parent_index = Uint32();
    }
  }

  class BoneMovement {
    constructor() {
      this.root_speed_3d = new Vector();
      this.track_time = Float32();
      this.start_bone = Uint32();
      this.flags = Uint32();
      this.bones = TArray(Uint32);
      this.animation_tracks = TArray(AnimationTrack);
      this.root_track = new AnimationTrack();
    }
  }

  class AnimationTrack {
    constructor() {
      this.flags = Uint32();
      this.key_quaternions = TArray(Quaternion);
      this.key_positions = TArray(Vector);
      this.key_time = TArray(Float32);
    }
  }

  class JointState {
    constructor() {
      this.pos = new Vector();
      this.rot = new Rotator();
      this.scale = new Scale();
    }
  }

  class Zone {
    constructor() {
      this.zone_actor = CompactIndex();
      this.connectivity = BigUint64();
      this.visibility = BigUint64();

      if (reader.header.version < 63) {
        this.last_render_time = Float32();
      }
    }
  }

  class LightMap {
    constructor() {
      this.data_offset = Uint32();
      this.pan = new Vector();
      this.u_clamp = CompactIndex();
      this.v_clamp = CompactIndex();
      this.u_scale = Float32();
      this.v_scale = Float32();
      this.i_light_actors = Int32();
    }
  }

  class BspLeaf {
    constructor() {
      this.i_zone = CompactIndex();
      this.i_permeating = CompactIndex();
      this.i_volumetric = CompactIndex();
      this.visible_zones = BigUint64();
    }
  }

  class Polygon {
    constructor() {
      this.vertex_count = Uint8();
      this.origin = new Vector();
      this.normal = new Vector();
      this.texture_u = new Vector();
      this.texture_v = new Vector();
      this.vertices = TArray(Vector, this.vertex_count);
      this.flags = reader.getPolyFlags(Uint32());
      this.actor = CompactIndex();
      this.texture = CompactIndex();
      this.item_name = CompactIndex();
      this.link = CompactIndex();
      this.brush_poly = CompactIndex();
      this.pan_u = Int16();
      this.pan_v = Int16();
    }
  }

  class MipMap {
    constructor() {
      if (reader.header.version >= 63) {
        this.width_offset = Uint32();
      }

      this.size = CompactIndex();
      this.data = new Uint8Array(
        reader.dataView.buffer.slice(reader.offset, reader.offset + this.size),
      );

      reader.offset += this.size;

      this.width = Uint32();
      this.height = Uint32();
      this.bits_width = Uint8();
      this.bits_height = Uint8();
    }
  }

  class FontTexture {
    constructor() {
      this.texture = reader.getObject(CompactIndex());
      this.characters = TArray(FontCharacter);
    }
  }

  class FontCharacter {
    constructor() {
      this.x = Uint32();
      this.y = Uint32();
      this.width = Uint32();
      this.height = Uint32();
    }
  }

  // One entry of a font's TMap<TCHAR, TCHAR> CharRemap. TCHAR is two bytes -
  // UT is a Unicode build - as UT 436's LadderFonts.utx shows: 1,183 pairs per
  // font at four bytes each, landing exactly on the object's end.
  class FontRemap {
    constructor() {
      this.key = Uint16();
      this.value = Uint16();
    }
  }

  /**
   * UT native classes
   */
  class ULevelBase {
    constructor() {
      this.actors = new Array(Uint32());

      // Seems to be repeated...
      reader.offset += 4;

      for (let i = 0; i < this.actors.length; i++) {
        this.actors[i] = reader.getObject(CompactIndex());
      }

      this.url = new LevelURL();
    }
  }

  class ULevel extends ULevelBase {
    constructor() {
      super();

      const NUM_LEVEL_TEXT_BLOCKS = 16;

      this.model = reader.getObject(CompactIndex());
      this.reach_specs = TArray(ReachSpec);
      this.approx_time = Float32();
      this.first_deleted = CompactIndex();
      this.text_blocks = new Array(NUM_LEVEL_TEXT_BLOCKS);

      for (let i = 0; i < this.text_blocks.length; i++) {
        this.text_blocks[i] = reader.getObject(CompactIndex());
      }

      if (reader.header.version > 62) {
        this.travel_info = TArray(LevelMap);
      }
    }
  }

  class LevelURL {
    constructor() {
      this.protocol = reader.getSizedText();
      this.host = reader.getSizedText();
      this.map = reader.getSizedText();
      this.options = new Array(CompactIndex());

      for (let i = 0; i < this.options.length; i++) {
        this.options[i] = reader.getSizedText();
      }

      this.portal = reader.getSizedText();
      this.port = Uint32();
      this.valid = Uint32() > 0;
    }
  }

  class ReachSpec {
    constructor() {
      this.distance = Uint32();
      this.start = CompactIndex();
      this.end = CompactIndex();
      this.collision_radius = Uint32();
      this.collision_height = Uint32();
      this.reach_flags = Uint32();
      this.pruned = Uint8() > 0;
    }
  }

  class LevelMap {
    constructor() {
      this.key = reader.getSizedText();
      this.value = reader.getSizedText();
    }
  }

  class UTexture {
    constructor() {
      this.mip_maps = TArray(MipMap, Uint8());
    }
  }

  class UScriptedTexture extends UTexture {}

  class UPalette {
    constructor() {
      this.colours = TArray(Colour);
    }
  }

  class UPolys {
    constructor() {
      this.poly_count = Uint32();

      // Seems to be repeated... (check source code)
      reader.offset += 4;

      this.polys = TArray(Polygon, this.poly_count);
    }
  }

  class UPrimitive {
    constructor() {
      this.bounding_box = new BoundingBox();
      this.bounding_sphere = new BoundingSphere();
    }
  }

  class UModel extends UPrimitive {
    constructor() {
      super();

      if (reader.header.version <= 61) {
        this.vectors = CompactIndex();
        this.points = CompactIndex();
        this.nodes = CompactIndex();
        this.surfaces = CompactIndex();
        this.vertices = CompactIndex();
      } else {
        this.vectors = TArray(Vector);
        this.points = TArray(Vector);
        this.nodes = TArray(BspNode);
        this.surfaces = TArray(BspSurface);
        this.vertices = TArray(ModelVertex);
        this.num_shared_sides = Int32();
        this.num_zones = Int32();
        this.zones = TArray(Zone, this.num_zones);
      }

      this.polys = CompactIndex();
      this.light_map = TArray(LightMap);
      this.light_bits = TArray(Uint8);
      this.bounds = TArray(BoundingBox);
      this.leaf_hulls = TArray(Int32);
      this.leaves = TArray(BspLeaf);
      this.lights = TArray(CompactIndex);

      if (reader.header.version <= 61) {
        this.leaf_zone = CompactIndex();
        this.leaf_leaf = CompactIndex();
      }

      this.root_outside = Uint32() > 0;
      this.linked = Uint32() > 0;
    }
  }

  class UMesh extends UPrimitive {
    constructor() {
      super();

      if (reader.header.version > 61) {
        this.vertices_jump = Uint32();
      }

      this.vertices = TArray(MeshVertex);

      if (reader.header.version > 61) {
        this.triangles_jump = Uint32();
      }

      this.triangles = TArray(MeshTriangle);
      this.anim_sequences = TArray(MeshAnimationSequence);
      this.connects_jump = Uint32();
      this.connections = TArray(MeshConnection);
      this.bounding_box_2 = new BoundingBox();
      this.bounding_sphere_2 = new BoundingSphere();
      this.vert_links_jump = Uint32();
      this.vert_links = TArray(Uint32);

      this.textures = new Array(CompactIndex());

      for (let i = 0; i < this.textures.length; i++) {
        this.textures[i] = reader.getObject(CompactIndex());
      }

      this.bounding_boxes = TArray(BoundingBox);
      this.bounding_spheres = TArray(BoundingSphere);
      this.frame_verts = Uint32();
      this.anim_frames = Uint32();
      this.flags_AND = Uint32();
      this.flags_OR = Uint32();
      this.scale = new Vector();
      this.origin = new Vector();
      this.rotation_origin = new Rotator();
      this.cur_poly = Uint32();
      this.cur_vertex = Uint32();

      if (reader.header.version === 65) {
        this.texture_lod = TArray(Float32, 1);
      } else if (reader.header.version >= 66) {
        this.texture_lod = TArray(Float32);
      }
    }
  }

  class ULodMesh extends UMesh {
    constructor() {
      super();

      this.collapse_point_thus = TArray(Uint16);
      this.face_level = TArray(Uint16);
      this.faces = TArray(LodMeshFace);
      this.collapse_wedge_thus = TArray(Uint16);
      this.wedges = TArray(LodMeshWedge);
      this.materials = TArray(LodMeshMaterial);
      this.special_faces = TArray(LodMeshFace);
      this.model_vertices = Uint32();
      this.special_vertices = Uint32();
      this.mesh_scale_max = Float32();
      this.lod_hysteresis = Float32();
      this.lod_strength = Float32();
      this.lod_min_verts = Uint32();
      this.lod_morph = Float32();
      this.lod_z_displace = Float32();
      this.remap_anim_vertices = TArray(Uint16);
      this.old_frame_verts = Uint32();
    }
  }

  class USkeletalMesh extends ULodMesh {
    constructor() {
      super();

      this.ext_wedges = TArray(SkeletalMeshExtWedge);
      this.points = TArray(Vector);
      this.skeletons = TArray(SkeletalMeshSkeleton);
      this.bone_weight_indices = TArray(SkeletalMeshBoneWeightIndex);
      this.bone_weights = TArray(SkeletalMeshBoneWeight);
      this.local_points = TArray(Vector);
      this.skeletal_depth = Uint32();
      this.default_animation = reader.getObject(CompactIndex());
      this.weapon_bone_index = Uint32();
      this.weapon_adjust = new SkeletalMeshWeaponAdjust();
    }
  }

  class USkelModel extends UPrimitive {
    constructor() {
      super();

      this.num_meshes = Int32();
      this.num_joints = Int32();
      this.num_frames = Int32();
      this.num_sequences = Int32();
      this.num_skins = Int32();
      this.root_joint = Int32();
      this.meshes = TArray(RMesh);
      this.joints = TArray(RJoint);
      this.anim_sequences = TArray(RSkelAnimSeq);
      this.frames = TArray(RAnimFrame);
      this.pos_offset = new Vector();
      this.rot_offset = new Rotator();
    }
  }

  class RMesh {
    constructor() {
      const NUM_POLYGROUPS = 16;

      this.num_verts = Int32();
      this.num_tris = Int32();
      this.triangles = TArray(RTriangle);
      this.vertices = TArray(RVertex);
      this.dec_count = Int32();
      this.dec = TArray(Int8);
      this.group_flags = new Array(NUM_POLYGROUPS);
      this.poly_group_skin_names = new Array(NUM_POLYGROUPS);

      for (let i = 0; i < NUM_POLYGROUPS; i++) {
        this.group_flags[i] = Int32();
        this.poly_group_skin_names[i] = Name();
      }
    }
  }

  class RTriangle {
    constructor() {
      this.vertex_index_1 = Int16();
      this.vertex_index_2 = Int16();
      this.vertex_index_3 = Int16();
      this.vertex_1_u = Int8();
      this.vertex_1_v = Int8();
      this.vertex_2_u = Int8();
      this.vertex_2_v = Int8();
      this.vertex_3_u = Int8();
      this.vertex_3_v = Int8();
      this.polygroup = Int8();
    }
  }

  class RVertex {
    constructor() {
      this.point1 = new Vector();
      this.point2 = new Vector();
      this.joint1 = Int32();
      this.joint2 = Int32();
      this.weight1 = Float32();
    }
  }

  class RJoint {
    constructor() {
      const MAX_CHILD_JOINTS = 4;

      this.parent = Int32();
      this.children = TArray(Int32, MAX_CHILD_JOINTS);
      this.name = Name();
      this.jointgroup = Int32();
      this.flags = Int32();
      this.baserot = new Rotator();
      this.planes = TArray(Plane, 6);
    }
  }

  class RSkelAnimSeq extends MeshAnimationSequence {
    constructor() {
      super();

      this.anim_data = TArray(Int8);
    }
  }

  class RAnimFrame {
    constructor() {
      this.sequence_id = Int16();
      this.event = Name();
      this.bounds = new BoundingBox();
      this.joint_anim = TArray(JointState);
    }
  }

  class UAnimation {
    constructor() {
      this.bones = TArray(BoneReference);
      this.movements = TArray(BoneMovement);
      this.animation_sequences = TArray(MeshAnimationSequence);
    }
  }

  class UMusic {
    constructor() {
      // If the package itself only contains music (.umx) then the first name table entry is the format.
      // This is not always the case if the music is embedded in a map, for example.
      this.format = Name();
      this.data_end_offset = Uint32();
      this.size = CompactIndex(); // includes null padding?
      // Consumes the payload, so the cursor ends where the object's data ends.
      this.audio_data = reader.getBytes(this.size);
    }
  }

  class USound {
    constructor() {
      this.format = Name();

      if (
        reader.header.version === 79 &&
        reader.header.licensee_version === 0
      ) {
        this.core_flags = Uint32();
        this.duration = Float32();
        this.raw_num_samples = null;
        this.bit_depth = null;
        this.channels = null;
        this.sample_rate = null;
        this.lip_sync_data = null;

        // TODO: use version range check above; all of these version checks evaluate to true due to `=== 79`
        if (reader.header.version > 76) {
          this.raw_num_samples = Uint32();
        }

        if (reader.header.version > 77) {
          this.bit_depth = Uint32();
          this.channels = Uint32();
        }

        if (reader.header.version > 78) {
          this.sample_rate = Uint32();
        }

        this.skip_offset = Uint32();
        this.size = CompactIndex();
        this.audio_offset = reader.offset;
        this.byte_rate = this.size / this.duration;

        reader.offset += this.size;

        if (this.core_flags & reader.soundFlags.SF_HasLipSync) {
          this.lip_sync_skip_offset = Uint32();
          this.lip_sync_data_count = CompactIndex();
          this.lip_sync_data_offset = reader.offset;
        }
      } else {
        if (reader.header.version >= 63) {
          this.next_object_offset = Uint32();
        }

        this.size = CompactIndex();
        this.audio_offset = reader.offset;
      }
    }
  }

  class UTextBuffer {
    constructor() {
      this.pos = Uint32();
      this.top = Uint32();
      this.size = CompactIndex();

      if (this.size > 0) {
        this.contents = reader.decodeText(
          reader.dataView.buffer.slice(
            reader.offset,
            reader.offset + this.size - 1,
          ),
        );
        // `size` counts the null terminator, so this lands just past it.
        reader.offset += this.size;
      }
    }
  }

  /**
   * Two layouts. Originally the font *is* a texture - `UFont : public UTexture`
   * with a glyph table, one FontCharacter per character code (Unreal 1.200,
   * Engine/Src/UnFont.cpp:22-23) - and that holds through v63. By v68 it is a
   * UObject holding texture pages and the page size (Unreal 1.224,
   * Engine/Inc/UnTex.h:449-455); v69 appended the character remap (HP2's
   * Engine/Src/UnFont.cpp:35-36, behind `Ar.Ver() >= 69`). Fonts are observed
   * texture-based up to v63 and paged from v68, with nothing in between in any
   * available package, so the branch sits at the first version seen paged.
   */
  class UFont {
    constructor() {
      const version = reader.header.version;

      if (version < 68) {
        this.mip_maps = new UTexture().mip_maps;
        this.characters = TArray(FontCharacter);
      } else {
        this.textures = TArray(FontTexture);
        this.characters_per_page = Int32();

        if (version >= 69) {
          this.char_remap = TArray(FontRemap);
          this.is_remapped = Uint32() > 0;
        }
      }
    }
  }

  this.propertyTypes = [
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
  ];

  this.objectFlags = {
    RF_Transactional: 0x00000001,
    RF_Unreachable: 0x00000002,
    RF_Public: 0x00000004,
    RF_TagImp: 0x00000008,
    RF_TagExp: 0x00000010,
    RF_SourceModified: 0x00000020,
    RF_TagGarbage: 0x00000040,
    RF_NeedLoad: 0x00000200,
    RF_HighlightedName: 0x00000400,
    RF_EliminateObject: 0x00000400,
    RF_InSingularFunc: 0x00000800,
    RF_RemappedName: 0x00000800,
    RF_Suppress: 0x00001000,
    RF_StateChanged: 0x00001000,
    RF_InEndState: 0x00002000,
    RF_Transient: 0x00004000,
    RF_PreLoading: 0x00008000,
    RF_LoadForClient: 0x00010000,
    RF_LoadForServer: 0x00020000,
    RF_LoadForEdit: 0x00040000,
    RF_Standalone: 0x00080000,
    RF_NotForClient: 0x00100000,
    RF_NotForServer: 0x00200000,
    RF_NotForEdit: 0x00400000,
    RF_Destroyed: 0x00800000,
    RF_NeedPostLoad: 0x01000000,
    RF_HasStack: 0x02000000,
    RF_Native: 0x04000000,
    RF_Marked: 0x08000000,
    RF_ErrorShutdown: 0x10000000,
    RF_DebugPostLoad: 0x20000000,
    RF_DebugSerialize: 0x40000000,
    RF_DebugDestroy: 0x80000000,
  };

  // Harry Potter 2
  this.soundFlags = {
    SF_None: 0,
    SF_Looping: 2,
    SF_Streaming: 4,
    SF_Music: 8,
    SF_No3D: 16,
    SF_UpdatePitch: 32,
    SF_NoUpdates: 64,
    SF_HasLipSync: 128,
    SF_Compressed: 256,
  };

  this.fileTypesByExt = {
    [FILE_EXTENSION.SYSTEM]: "System",
    [FILE_EXTENSION.SOUND]: "Sound",
    [FILE_EXTENSION.UMOD]: "UMOD",
    [FILE_EXTENSION.MUSIC]: "Music",
    [FILE_EXTENSION.MAP]: "Map",
    [FILE_EXTENSION.TEXTURE]: "Texture",
    [FILE_EXTENSION.CACHE_UXX]: "Cache",
    [FILE_EXTENSION.ZIP]: "Zip",
    [FILE_EXTENSION.TMP_ZIP]: "Zip",
  };

  this.extByFileType = {
    [PACKAGE_PATH.SYSTEM]: FILE_EXTENSION.SYSTEM,
    [PACKAGE_PATH.MAPS]: FILE_EXTENSION.MAP,
    [PACKAGE_PATH.TEXTURES]: FILE_EXTENSION.TEXTURE,
    [PACKAGE_PATH.SOUNDS]: FILE_EXTENSION.SOUND,
    [PACKAGE_PATH.MUSIC]: FILE_EXTENSION.MUSIC,
  };

  // Order follows UnrealTournament.ini's [Core.System] Paths section
  this.defaultPackages = new Map([
    [
      PACKAGE_PATH.SYSTEM,
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
        "uwindow",
      ],
    ],
    [
      PACKAGE_PATH.MAPS,
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
        "utcredits",
      ],
    ],
    [
      PACKAGE_PATH.TEXTURES,
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
        "xutfx",
      ],
    ],
    [
      PACKAGE_PATH.SOUNDS,
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
        "vrikers",
      ],
    ],
    [
      PACKAGE_PATH.MUSIC,
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
        "wheels",
      ],
    ],
  ]);

  this.isDefaultPackage = function (packageName) {
    const packageNameLower = packageName.toLowerCase();

    for (const [_, packages] of this.defaultPackages) {
      if (packages.some((name) => name === packageNameLower)) {
        return true;
      }
    }

    return false;
  };

  this.getPackageFileExtension = function (packageName) {
    const packageNameLower = packageName.toLowerCase();

    for (const [type, packages] of this.defaultPackages) {
      if (packages.some((name) => name === packageNameLower)) {
        return this.extByFileType[type];
      }
    }
  };

  this.polyFlags = {
    Invisible: 0x00000001,
    Masked: 0x00000002,
    Translucent: 0x00000004,
    NotSolid: 0x00000008,
    Environment: 0x00000010,
    ForceViewZone: 0x00000010,
    Semisolid: 0x00000020,
    Modulated: 0x00000040,
    FakeBackdrop: 0x00000080,
    TwoSided: 0x00000100,
    AutoUPan: 0x00000200,
    AutoVPan: 0x00000400,
    NoSmooth: 0x00000800,
    BigWavy: 0x00001000,
    SpecialPoly: 0x00001000,
    SmallWavy: 0x00002000,
    Flat: 0x00004000,
    LowShadowDetail: 0x00008000,
    NoMerge: 0x00010000,
    CloudWavy: 0x00020000,
    DirtyShadows: 0x00040000,
    BrightCorners: 0x00080000,
    SpecialLit: 0x00100000,
    Gouraud: 0x00200000,
    NoBoundRejection: 0x00200000,
    Unlit: 0x00400000,
    HighShadowDetail: 0x00800000,
    // Editor and internal flags
    Memorized: 0x01000000,
    RenderHint: 0x01000000,
    Selected: 0x02000000,
    Portal: 0x04000000,
    Mirrored: 0x08000000,
    Highlighted: 0x10000000,
    FlatShaded: 0x40000000,
    EdProcessed: 0x40000000,
    RenderFog: 0x40000000,
    EdCut: 0x80000000,
    Occlude: 0x80000000,
  };

  this.brushClasses = [
    "AssertMover",
    "AttachMover",
    "Brush",
    "ElevatorMover",
    "GradualMover",
    "LoopMover",
    "MixMover",
    "Mover",
    "RotatingMover",
  ];

  this.moverClasses = [
    "AssertMover",
    "AttachMover",
    "ElevatorMover",
    "GradualMover",
    "LoopMover",
    "MixMover",
    "Mover",
    "RotatingMover",
  ];

  this.meshClasses = ["Mesh", "LodMesh", "SkeletalMesh", "SkelModel"];

  this.enumBumpType = ["BT_PlayerBump", "BT_PawnBump", "BT_AnyBump"];

  this.enumMoverEncroachType = [
    "ME_StopWhenEncroach",
    "ME_ReturnWhenEncroach",
    "ME_CrushWhenEncroach",
    "ME_IgnoreWhenEncroach",
  ];

  this.enumMoverGlideType = ["MV_MoveByTime", "MV_GlideByTime"];

  this.enumCsgOper = [
    "CSG_Active",
    "CSG_Add",
    "CSG_Subtract",
    "CSG_Intersect",
    "CSG_Deintersect",
  ];

  this.enumSheerAxis = [
    "SHEER_None",
    "SHEER_XY",
    "SHEER_XZ",
    "SHEER_YX",
    "SHEER_YZ",
    "SHEER_ZX",
    "SHEER_ZY",
  ];

  /**
   * UT package functions
   */
  this.readPackage = function () {
    // Set global variables for access within other functions
    reader.header = reader.getPackageHeader();
    reader.version = reader.header.version;
    reader.nameTable = reader.getNameTable();
    reader.exportTable = reader.getExportTable();
    reader.importTable = reader.getImportTable();

    return reader;
  };

  this.getPackageHeader = function () {
    const header = {};

    reader.seek(0);

    header.signature = Uint32();

    if (header.signature !== SIGNATURE_UT) {
      throw new Error(
        `Invalid package signature: 0x${header.signature.toString(16).padStart(8, "0")}`,
      );
    }

    header.version = Uint16();
    header.licensee_version = Uint16();
    header.package_flags = Uint32();
    header.name_count = Uint32();
    header.name_offset = Uint32();
    header.export_count = Uint32();
    header.export_offset = Uint32();
    header.import_count = Uint32();
    header.import_offset = Uint32();

    if (header.version < 68) {
      header.heritage_count = Uint32();
      header.heritage_offset = Uint32();
    } else {
      header.guid = [Uint32(), Uint32(), Uint32(), Uint32()]
        .map((value) => value.toString(16).padStart(8, 0))
        .join("")
        .toUpperCase();

      header.generation_count = Uint32();
      header.generations = [];

      for (let i = 0; i < header.generation_count; i++) {
        const generation = {};

        generation.export_count = Uint32();
        generation.name_count = Uint32();

        header.generations.push(generation);
      }
    }

    return header;
  };

  this.getNameTable = function () {
    const nameTable = [];

    reader.seek(reader.header.name_offset);

    if (reader.header.version < 64) {
      for (let i = 0; i < reader.header.name_count; i++) {
        const bytes = [];
        let char = Uint8();

        while (char !== 0x00) {
          bytes.push(char);
          char = Uint8();
        }

        const name = reader.decodeText(new Uint8Array(bytes));
        const flags = Uint32();

        nameTable.push({
          name: name,
          flags: flags,
        });
      }
    } else {
      for (let i = 0; i < reader.header.name_count; i++) {
        const name = reader.getSizedText();
        const flags = Uint32();

        nameTable.push({
          name: name,
          flags: flags,
        });
      }
    }

    return nameTable;
  };

  this.getExportTable = function () {
    const exportTable = new Array(reader.header.export_count);

    reader.seek(reader.header.export_offset);

    for (let i = 0; i < exportTable.length; i++) {
      exportTable[i] = new ExportTableObject();
    }

    return exportTable;
  };

  this.getImportTable = function () {
    const importTable = new Array(reader.header.import_count);

    reader.seek(reader.header.import_offset);

    for (let i = 0; i < importTable.length; i++) {
      importTable[i] = new ImportTableObject();
    }

    return importTable;
  };

  this.getObject = function (index) {
    if (index === 0) {
      return null;
    } else if (index < 0) {
      return reader.importTable[~index];
    } else {
      return reader.exportTable[index - 1];
    }
  };

  this.getExportObjectByName = function (objectName) {
    return (
      reader.exportTable.find((item) => item.objectName === objectName) || null
    );
  };

  this.getImportObjectByName = function (objectName) {
    return (
      reader.importTable.find((item) => item.objectName === objectName) || null
    );
  };

  this.getExportObjectsByName = function (objectName) {
    return reader.exportTable.filter((item) => item.objectName === objectName);
  };

  this.getImportObjectsByName = function (objectName) {
    return reader.importTable.filter((item) => item.objectName === objectName);
  };

  this.getObjectNameFromIndex = function (index) {
    return reader.getObject(index)?.objectName || "None";
  };

  this.getObjectsByClass = function (objectClass) {
    return reader.exportTable.filter((item) => item.className === objectClass);
  };

  this.getLevelObjects = function () {
    return reader.getObjectsByClass("Level");
  };

  this.getMusicObjects = function () {
    return reader.getObjectsByClass("Music");
  };

  this.getSoundObjects = function () {
    return reader.getObjectsByClass("Sound");
  };

  this.getTextBufferObjects = function () {
    return reader.getObjectsByClass("TextBuffer");
  };

  this.getTextureObjects = function () {
    return reader.getObjectsByClass("Texture");
  };

  this.getAllBrushObjects = function () {
    return reader.exportTable.filter((item) =>
      reader.brushClasses.includes(item.className),
    );
  };

  this.getAllMeshObjects = function () {
    return reader.exportTable.filter((item) =>
      reader.meshClasses.includes(item.className),
    );
  };

  this.getBrushModelPolys = function (brushObject) {
    const data = {
      brush: brushObject,
      model: {},
      polys: {},
    };

    // A brush object's "Brush" property is an object reference to a Model
    const brushProp = brushObject.getProp("brush");

    if (brushProp) {
      const modelObject = reader.getObject(brushProp.value);
      const modelData = modelObject.readData();

      data.model.object = modelObject;
      data.model.properties = modelData;

      // Polys
      if (modelData.polys !== 0) {
        const polyObject = reader.getObject(modelData.polys);
        const polysData = polyObject.readData();

        data.polys.object = polyObject;
        data.polys.polygons = polysData.polys;
      }
    }

    return data;
  };

  this.getAllBrushData = function () {
    return reader.getAllBrushObjects().map(reader.getBrushModelPolys);
  };

  this.getTextureInfo = function (textureObject) {
    return {
      name: textureObject.objectName,
      group: textureObject.packageName,
    };
  };

  this.getTextureGroups = function () {
    const grouped = {};
    const ungrouped = [];

    let total = 0;

    for (const texture of reader.getTextureObjects()) {
      const textureInfo = reader.getTextureInfo(texture);

      if (textureInfo.group) {
        if (grouped[textureInfo.group] === undefined) {
          grouped[textureInfo.group] = [];
        }
        grouped[textureInfo.group].push(textureInfo.name);
      } else {
        ungrouped.push(textureInfo.name);
      }

      total++;
    }

    return {
      grouped: grouped,
      ungrouped: ungrouped,
      length: total,
    };
  };

  this.getSounds = function () {
    const sounds = [];
    const soundObjects = reader.getSoundObjects();

    // Used to check for additional metadata
    const WAVE_FORMAT_PCM = 0x01;
    const SUBCHUNK_SIZE_PCM = 0x10;

    for (const soundObject of soundObjects) {
      const sound = soundObject.readData();

      sound.name = soundObject.objectName;

      if (soundObject.isInPackage) {
        sound.package = soundObject.packageName;
      }

      // Not all sound files are PCM - e.g. ultra trash map CTF-BT-SuckmeToo seems to contain some kind of compressed audio.
      // Additionally, some files contain extra metadata so the values below cannot be accurately read unless using a more
      // sophisticated WAVE audio reading method.
      if (
        sound.format.toUpperCase() === "WAV" &&
        reader.dataView.getUint16(sound.audio_offset + 16, true) ===
          SUBCHUNK_SIZE_PCM &&
        reader.dataView.getUint16(sound.audio_offset + 20, true) ===
          WAVE_FORMAT_PCM
      ) {
        sound.channels = reader.dataView.getUint16(
          sound.audio_offset + 22,
          true,
        );
        sound.sample_rate = reader.dataView.getUint32(
          sound.audio_offset + 24,
          true,
        );
        sound.byte_rate = reader.dataView.getUint32(
          sound.audio_offset + 28,
          true,
        );
        sound.bit_depth = reader.dataView.getUint16(
          sound.audio_offset + 34,
          true,
        );
      }

      sounds.push(sound);
    }

    return sounds;
  };

  this.getLightHsl = function (lightObject) {
    // Default UT values: 0, 255, 64
    const hsl = {
      h: 0,
      s: 100,
      l: 25,
    };

    for (const prop of lightObject.properties) {
      switch (prop.name.toLowerCase()) {
        // Degree in colour wheel
        case "lighthue":
          hsl.h = Math.round((prop.value / 256) * 360);
          break;

        // UT saturation is opposite of HSL, i.e. 0% = full colour
        case "lightsaturation":
          hsl.s = 100 - Math.round((prop.value / 256) * 100);
          break;

        case "volumebrightness":
          hsl.l = Math.round((prop.value / 256) * 100);
          break;

        default:
          break;
      }
    }

    return hsl;
  };

  this.getPolyFlags = function (flags) {
    const polyFlags = [];

    for (const flagName in reader.polyFlags) {
      const flagVal = reader.polyFlags[flagName];

      if (flagVal > flags) break;

      if ((flags & flagVal) !== 0) {
        polyFlags.push(flagName);
      }
    }

    return polyFlags;
  };

  this.createCanvas = function ({ width, height, palette, mipMap }) {
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
        // imageData.data[i++] = colour.a;

        // Newer versions use alpha channel, but this doesn't seem to be
        // consistent in older packages, e.g. Faces.utx has alpha set to 0
        imageData.data[i++] = 0xff;
      }
    } else {
      for (const pixel of palette.colours) {
        imageData.data[i++] = pixel.r;
        imageData.data[i++] = pixel.g;
        imageData.data[i++] = pixel.b;
        imageData.data[i++] = 0xff;
      }
    }

    context.putImageData(imageData, 0, 0);

    return canvas;
  };

  this.textureToCanvas = function (textureObject) {
    const textureData = textureObject.readData();
    const [mipMap] = textureData.mip_maps;
    const paletteProp = textureObject.getProp("palette");
    const paletteObject = reader.getObject(paletteProp.value);
    const paletteData = paletteObject.readData();

    return reader.createCanvas({
      width: mipMap.width,
      height: mipMap.height,
      palette: paletteData,
      mipMap,
    });
  };

  this.getPaletteCanvas = function (paletteObject) {
    return reader.createCanvas({
      width: 16,
      height: 16,
      palette: paletteObject.readData(),
    });
  };

  this.getLevelScreenshots = function () {
    // Multiple screenshots can be embedded to create a montage effect by
    // consecutively naming MyLevel textures "Screenshot1", "Screenshot2", etc.
    const screenshots = [];
    const screenshotRegEx = new RegExp("^Screenshot([0-9]+)?$", "i");
    const screenshotObjects = reader
      .getTextureObjects()
      .filter((item) => screenshotRegEx.test(item.objectName));

    if (screenshotObjects.length > 0) {
      const tempScreenshots = screenshotObjects.map((item) => ({
        canvas: reader.textureToCanvas(item),
        num: Number(item.objectName.substring("Screenshot".length)),
      }));

      // Sort numerically as name table doesn't guarantee order
      tempScreenshots.sort(({ num: a }, { num: b }) => a - b);

      screenshots.push(...tempScreenshots.map((item) => item.canvas));
    } else {
      // Officially, the map screenshot should be a texture named "Screenshot",
      // but sometimes it's set to a different texture (e.g. CTF-BT-Slaughter).
      // It won't appear in-game, but is still saved in the LevelSummary actor.
      const levelInfo = reader.getExportObjectByName("LevelInfo0");

      if (levelInfo) {
        const screenshotProp = levelInfo.getProp("Screenshot");

        if (screenshotProp) {
          const invalidScreenshot = reader.getObject(screenshotProp.value);

          // Final check - can't show screenshot if it's linked to an external package (e.g. CTF-BT-Brazilian-novice).
          if (invalidScreenshot.table !== "import") {
            const canvas = reader.textureToCanvas(invalidScreenshot);
            screenshots.push(canvas);
          }
        }
      }
    }

    return screenshots;
  };

  this.getLevelSummary = function (allProperties = false) {
    const levelSummary = {};
    const levelInfo = reader.getExportObjectByName("LevelInfo0");
    const mainProperties = [
      "Author",
      "IdealPlayerCount",
      "LevelEnterText",
      "Song",
      "Title",
    ];
    const valueIsObjIndex = [
      "Song",
      "DefaultGameType",
      "Summary",
      "NavigationPointList",
      "Level",
    ];

    levelInfo?.properties.forEach((prop) => {
      if (allProperties || mainProperties.includes(prop.name)) {
        const propVal = valueIsObjIndex.includes(prop.name)
          ? reader.getObjectNameFromIndex(prop.value)
          : prop.value;

        levelSummary[prop.name] = propVal;
      }
    });

    return levelSummary;
  };

  this.getDependencies = function () {
    const dependencies = [];

    // Check dependencies against the file's "Song" name (if it's a map).
    const { Song: levelMusic } = reader.getLevelSummary();

    for (const tableEntry of reader.importTable) {
      if (tableEntry.className === "Package" && !tableEntry.isInPackage) {
        const dependency = {
          name: tableEntry.objectName,
        };

        const isDefaultPackage = this.isDefaultPackage(dependency.name);
        const isLevelMusic = dependency.name === levelMusic;

        if (isDefaultPackage) {
          dependency.ext = this.getPackageFileExtension(dependency.name);
        } else if (isLevelMusic) {
          dependency.ext = "umx";
        }

        if (isDefaultPackage || isLevelMusic) {
          dependency.type = reader.fileTypesByExt[dependency.ext];
        }

        dependency.default = isDefaultPackage;

        dependencies.push(dependency);
      }
    }

    return dependencies;
  };

  this.getDependenciesFiltered = function (ignoreCore = true) {
    const dependencies = reader.getDependencies();
    const ignore = [
      "botpack",
      "core",
      "engine",
      "unreali",
      "unrealshare",
      "uwindow",
    ];
    const filtered = {
      length: 0,
      packages: {
        default: [],
        custom: [],
      },
    };

    for (const dep of dependencies) {
      if (dep.default) {
        if (ignoreCore && ignore.includes(dep.name.toLowerCase())) continue;
        filtered.packages.default.push(dep);
      } else {
        filtered.packages.custom.push(dep);
      }

      filtered.length++;
    }

    return filtered;
  };

  this.getClassesCount = function () {
    const counts = {};

    for (const tableEntry of reader.exportTable) {
      if (!tableEntry.className) continue;

      const className = tableEntry.className.toLowerCase();

      if (counts[className] === undefined) {
        counts[className] = 0;
      }

      counts[className]++;
    }

    return counts;
  };
};

/**
 * Publish the constructor explicitly rather than relying on `var` reaching the
 * global object.
 *
 * A top-level `export` would make this an ES module, and the demo's plain
 * `<script src>` tag would then fail to parse the file at all. Assigning to
 * globalThis works in both worlds: unchanged for a classic script, and enough
 * for `await import()` under Node, where top-level `var` is module-scoped.
 */
globalThis.UnrealPackageReader = UnrealPackageReader;
