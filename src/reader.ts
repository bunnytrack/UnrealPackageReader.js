/**
 * The public entry class.
 *
 * @module reader
 */

import {
  BRUSH_CLASSES,
  BUMP_TYPE,
  CSG_OPER,
  DEFAULT_PACKAGES,
  EXTENSION_BY_PACKAGE_PATH,
  FILE_TYPE_BY_EXTENSION,
  MESH_CLASSES,
  MOVER_CLASSES,
  MOVER_ENCROACH_TYPE,
  MOVER_GLIDE_TYPE,
  OBJECT_FLAGS,
  POLY_FLAGS,
  PROPERTY_TYPES,
  SHEER_AXIS,
  SOUND_FLAGS,
  decodePolyFlags,
  isDefaultPackage,
  packageFileExtension,
  type FileExtension,
  type PolyFlagName,
} from "./constants/index.ts";
import type { PackageHeader } from "./package/header.ts";
import type { NameTableEntry } from "./package/nameTable.ts";
import {
  UnrealPackage,
  type ExportTableObject,
  type ImportTableObject,
  type ObjectData,
  type UObject,
} from "./package/index.ts";
import type { Polygon } from "./structs/index.ts";
import type { UModel, USound } from "./natives/index.ts";
import {
  getLevelScreenshots,
  getPaletteCanvas,
  textureToCanvas,
} from "./browser/canvas.ts";

/** A brush export with its resolved model and polygon list. */
export interface BrushData {
  brush: ExportTableObject;
  model: { object?: ExportTableObject; properties?: ObjectData & UModel };
  polys: { object?: ExportTableObject; polygons?: Polygon[] };
}

/** One entry of `getSounds()`: the sound's parse plus display metadata. */
export type SoundInfo = ObjectData &
  USound & {
    name: string;
    package?: string;
  };

/** One entry of `getDependencies()`: a package this one needs alongside it. */
export interface Dependency {
  name: string;
  ext?: FileExtension;
  type?: string;
  /** Whether or not this is a stock game package. */
  default: boolean;
}

export interface DependenciesFiltered {
  length: number;
  packages: { default: Dependency[]; custom: Dependency[] };
}

/** The WAVE fields `getSounds` reads when the data looks like plain PCM. */
const WAVE_FORMAT_PCM = 0x01;
const SUBCHUNK_SIZE_PCM = 0x10;

/**
 * The public entry class.
 *
 * Consumers do `reader = new UnrealPackageReader(buffer).readPackage()` and
 * then use that one object for everything - header, tables, queries, lookup
 * tables - so this class is all of those at once.
 */
export class UnrealPackageReader {
  readonly #buffer: ArrayBuffer;
  #package?: UnrealPackage;

  /** Assigned by the consumer after readPackage(); never set by the reader. */
  filename?: string;

  readonly propertyTypes = PROPERTY_TYPES;
  readonly objectFlags = OBJECT_FLAGS;
  readonly soundFlags = SOUND_FLAGS;
  readonly polyFlags = POLY_FLAGS;
  readonly brushClasses = BRUSH_CLASSES;
  readonly moverClasses = MOVER_CLASSES;
  readonly meshClasses = MESH_CLASSES;
  readonly enumBumpType = BUMP_TYPE;
  readonly enumMoverEncroachType = MOVER_ENCROACH_TYPE;
  readonly enumMoverGlideType = MOVER_GLIDE_TYPE;
  readonly enumCsgOper = CSG_OPER;
  readonly enumSheerAxis = SHEER_AXIS;
  readonly fileTypesByExt = FILE_TYPE_BY_EXTENSION;
  readonly extByFileType = EXTENSION_BY_PACKAGE_PATH;
  readonly defaultPackages = DEFAULT_PACKAGES;

  constructor(buffer: ArrayBuffer) {
    this.#buffer = buffer;
  }

  /** Parse the package. Returns this same reader, so the call chains off the constructor. */
  readPackage(): this {
    this.#package = new UnrealPackage(this.#buffer);
    return this;
  }

  /** The parsed package. Everything below reaches the parse through this. */
  get package(): UnrealPackage {
    if (!this.#package) {
      throw new Error("Package not parsed yet: call readPackage() first");
    }

    return this.#package;
  }

  get header(): PackageHeader {
    return this.package.header;
  }

  get version(): number {
    return this.package.version;
  }

  get nameTable(): NameTableEntry[] {
    return this.package.nameTable;
  }

  get exportTable(): ExportTableObject[] {
    return this.package.exportTable;
  }

  get importTable(): ImportTableObject[] {
    return this.package.importTable;
  }

  /**
   * Resolve an object reference: zero is null, and an index beyond either
   * table is `undefined`. The internal resolver (`UnrealPackage.object`) folds
   * that second case into null; this method keeps the two apart because a
   * consumer can distinguish "no object" from "dangling reference" with
   * `=== null`.
   */
  getObject(index: number): UObject | null | undefined {
    if (index === 0) return null;

    return index < 0 ? this.importTable[~index] : this.exportTable[index - 1];
  }

  getObjectNameFromIndex(index: number): string {
    return this.getObject(index)?.objectName || "None";
  }

  getExportObjectByName(objectName: string): ExportTableObject | null {
    return this.package.getExportObjectByName(objectName);
  }

  getImportObjectByName(objectName: string): ImportTableObject | null {
    return (
      this.importTable.find((item) => item.objectName === objectName) ?? null
    );
  }

  getExportObjectsByName(objectName: string): ExportTableObject[] {
    return this.exportTable.filter((item) => item.objectName === objectName);
  }

  getImportObjectsByName(objectName: string): ImportTableObject[] {
    return this.importTable.filter((item) => item.objectName === objectName);
  }

  getObjectsByClass(objectClass: string): ExportTableObject[] {
    return this.exportTable.filter((item) => item.className === objectClass);
  }

  getLevelObjects(): ExportTableObject[] {
    return this.getObjectsByClass("Level");
  }

  getMusicObjects(): ExportTableObject[] {
    return this.getObjectsByClass("Music");
  }

  getSoundObjects(): ExportTableObject[] {
    return this.getObjectsByClass("Sound");
  }

  getTextBufferObjects(): ExportTableObject[] {
    return this.getObjectsByClass("TextBuffer");
  }

  getTextureObjects(): ExportTableObject[] {
    return this.getObjectsByClass("Texture");
  }

  getAllBrushObjects(): ExportTableObject[] {
    return this.exportTable.filter((item) =>
      (this.brushClasses as readonly (string | null)[]).includes(
        item.className,
      ),
    );
  }

  getAllMeshObjects(): ExportTableObject[] {
    return this.exportTable.filter((item) =>
      (this.meshClasses as readonly (string | null)[]).includes(item.className),
    );
  }

  /**
   * A brush actor's geometry: its `Brush` property references a `Model`, whose
   * `polys` references the `Polys` holding the editor polygons. Corrupt
   * references throw.
   */
  getBrushModelPolys(brushObject: ExportTableObject): BrushData {
    const data: BrushData = { brush: brushObject, model: {}, polys: {} };

    const brushProp = brushObject.getProp("brush");

    if (brushProp && "value" in brushProp) {
      const modelObject = this.getObject(
        brushProp.value as number,
      ) as ExportTableObject;
      const modelData = modelObject.readData() as ObjectData & UModel;

      data.model.object = modelObject;
      data.model.properties = modelData;

      if (modelData.polys !== 0) {
        const polyObject = this.getObject(modelData.polys) as ExportTableObject;
        const polysData = polyObject.readData() as ObjectData & {
          polys: Polygon[];
        };

        data.polys.object = polyObject;
        data.polys.polygons = polysData.polys;
      }
    }

    return data;
  }

  getAllBrushData(): BrushData[] {
    return this.getAllBrushObjects().map((brush) =>
      this.getBrushModelPolys(brush),
    );
  }

  getTextureInfo(textureObject: ExportTableObject): {
    name: string;
    group: string | null;
  } {
    return {
      name: textureObject.objectName,
      group: textureObject.packageName,
    };
  }

  getTextureGroups(): {
    grouped: Record<string, string[]>;
    ungrouped: string[];
    length: number;
  } {
    const grouped: Record<string, string[]> = {};
    const ungrouped: string[] = [];

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
  getSounds(): SoundInfo[] {
    const view = this.package.cursor.view;
    const sounds: SoundInfo[] = [];

    for (const soundObject of this.getSoundObjects()) {
      const sound = soundObject.readData() as SoundInfo;

      sound.name = soundObject.objectName;

      if (soundObject.isInPackage) {
        sound.package = soundObject.packageName!;
      }

      if (
        sound.format.toUpperCase() === "WAV" &&
        view.getUint16(sound.audio_offset + 16, true) === SUBCHUNK_SIZE_PCM &&
        view.getUint16(sound.audio_offset + 20, true) === WAVE_FORMAT_PCM
      ) {
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
  getLightHsl(lightObject: ExportTableObject): {
    h: number;
    s: number;
    l: number;
  } {
    const hsl = { h: 0, s: 100, l: 25 };

    for (const prop of lightObject.properties) {
      if (!("value" in prop) || typeof prop.value !== "number") continue;

      switch (prop.name.toLowerCase()) {
        case "lighthue":
          hsl.h = Math.round((prop.value / 256) * 360);
          break;
        case "lightsaturation":
          hsl.s = 100 - Math.round((prop.value / 256) * 100);
          break;
        case "volumebrightness":
          hsl.l = Math.round((prop.value / 256) * 100);
          break;
      }
    }

    return hsl;
  }

  getPolyFlags(flags: number): PolyFlagName[] {
    return decodePolyFlags(flags);
  }

  /**
   * The `LevelInfo0` summary shown for maps: title, author, song, etc.
   * with the object-reference properties resolved to names.
   */
  getLevelSummary(allProperties = false): Record<string, unknown> {
    const levelSummary: Record<string, unknown> = {};
    const levelInfo = this.getExportObjectByName("LevelInfo0");

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
        const value = "value" in prop ? prop.value : undefined;

        levelSummary[prop.name] = valueIsObjIndex.includes(prop.name)
          ? this.getObjectNameFromIndex(value as number)
          : value;
      }
    });

    return levelSummary;
  }

  isDefaultPackage(packageName: string): boolean {
    return isDefaultPackage(packageName);
  }

  getPackageFileExtension(packageName: string): FileExtension | undefined {
    return packageFileExtension(packageName);
  }

  /** Top-level package imports: the files this one needs alongside it. */
  getDependencies(): Dependency[] {
    const dependencies: Dependency[] = [];

    // A map's music package is a dependency the import table cannot label.
    const { Song: levelMusic } = this.getLevelSummary();

    for (const tableEntry of this.importTable) {
      if (tableEntry.className === "Package" && !tableEntry.isInPackage) {
        const name = tableEntry.objectName;

        const isDefault = this.isDefaultPackage(name);
        const isLevelMusic = name === levelMusic;

        const dependency: Dependency = { name, default: isDefault };

        if (isDefault) {
          dependency.ext = this.getPackageFileExtension(name);
        } else if (isLevelMusic) {
          dependency.ext = "umx";
        }

        if (isDefault || isLevelMusic) {
          dependency.type = this.fileTypesByExt[dependency.ext!];
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
  getDependenciesFiltered(ignoreCore = true): DependenciesFiltered {
    const ignore = [
      "botpack",
      "core",
      "engine",
      "unreali",
      "unrealshare",
      "uwindow",
    ];

    const filtered: DependenciesFiltered = {
      length: 0,
      packages: { default: [], custom: [] },
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
  getClassesCount(): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const tableEntry of this.exportTable) {
      if (!tableEntry.className) continue;

      const className = tableEntry.className.toLowerCase();
      counts[className] = (counts[className] ?? 0) + 1;
    }

    return counts;
  }

  // The canvas-producing methods, delegated so browser-only code stays in
  // src/browser. Calling these outside a browser throws on `document`.

  textureToCanvas(textureObject: ExportTableObject): HTMLCanvasElement {
    return textureToCanvas(this, textureObject);
  }

  getPaletteCanvas(paletteObject: ExportTableObject): HTMLCanvasElement {
    return getPaletteCanvas(paletteObject);
  }

  getLevelScreenshots(): HTMLCanvasElement[] {
    return getLevelScreenshots(this);
  }
}
