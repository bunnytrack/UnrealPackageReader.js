/**
 * Package naming, file types, and the stock package list.
 *
 * A package's kind is not recorded inside it - it is implied by the directory
 * the game loads it from, and by convention its file extension. That is why
 * classifying a dependency means looking its name up in the stock lists below
 * rather than reading anything out of the file.
 */

/**
 * Directories in UnrealTournament.ini's [Core.System] Paths section.
 *
 * The order is important and is not cosmetic. Asked for a package by bare
 * name, the engine checks CachePath first, then each numbered Paths entry in
 * order, and takes the first file it finds. Reproducing that order is what
 * makes extension lookups below agree with what the game actually loads.
 *
 * From Tim Sweeney's "Unreal Packages" document:
 *
 *   ```ini
 *   Paths[0]=..\System\*.u
 *   Paths[1]=..\Maps\*.unr
 *   Paths[2]=..\Textures\*.utx
 *   Paths[3]=..\Sounds\*.uax
 *   Paths[4]=..\Music\*.umx
 *   ```
 */
export const PACKAGE_PATH = {
  SYSTEM: "system",
  MAPS: "maps",
  TEXTURES: "textures",
  SOUNDS: "sounds",
  MUSIC: "music",
} as const;

export type PackagePath = (typeof PACKAGE_PATH)[keyof typeof PACKAGE_PATH];

/**
 * Package file extensions.
 */
export const FILE_EXTENSION = {
  SYSTEM: "u",
  MAP: "unr",
  TEXTURE: "utx",
  SOUND: "uax",
  MUSIC: "umx",
  UMOD: "umod",
  CACHE_UXX: "uxx",
  ZIP: "uz",
  TMP_ZIP: "tmp",
} as const;

export type FileExtension =
  (typeof FILE_EXTENSION)[keyof typeof FILE_EXTENSION];

/** Human-readable label for a package extension. */
export const FILE_TYPE_BY_EXTENSION = {
  u: "System",
  uax: "Sound",
  umod: "UMOD",
  umx: "Music",
  unr: "Map",
  utx: "Texture",
  uxx: "Cache",
  uz: "Zip",
  tmp: "Zip",
} as const;

/** The extension a stock package in each directory is expected to have. */
export const EXTENSION_BY_PACKAGE_PATH = {
  system: "u",
  maps: "unr",
  textures: "utx",
  sounds: "uax",
  music: "umx",
} as const;

/**
 * Packages shipped with Unreal Tournament, grouped by the directory they live
 * in, all lowercase.
 *
 * Used to tell a map's own dependencies apart from what every install already
 * has. Order follows UnrealTournament.ini's [Core.System] Paths section.
 */
export const DEFAULT_PACKAGES: ReadonlyMap<PackagePath, readonly string[]> =
  new Map([
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
        "uwindow",
      ],
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
        "utcredits",
      ],
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
        "xutfx",
      ],
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
        "vrikers",
      ],
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
        "wheels",
      ],
    ],
  ]);

/**
 * Reverse index of DEFAULT_PACKAGES, built once - lookups happen per import
 * table entry, and it collapses both functions below to one line.
 *
 * First group wins, which matters for exactly one name out of ~270: "credits"
 * ships both as Credits.utx and Credits.umx. Iterating in PACKAGE_PATH order
 * and keeping the first match answers "utx" - and that is not a coin toss, it
 * is what the engine itself resolves, because Textures is Paths[2] and Music is
 * Paths[4].
 *
 * Sweeney's document is explicit that shipping such a pair is a mistake: "you
 * must not create two packages with the same base name, which only differ by
 * extension... the engine will always fail to load one of the packages and give
 * an error." UT shipped one anyway, so the reader has to resolve it the way the
 * engine does rather than pick.
 */
const PACKAGE_PATH_BY_NAME: ReadonlyMap<string, PackagePath> = (() => {
  const index = new Map<string, PackagePath>();

  for (const [path, names] of DEFAULT_PACKAGES) {
    for (const name of names) {
      if (!index.has(name)) index.set(name, path);
    }
  }

  return index;
})();

/** Whether a package ships with the game. Case-insensitive. */
export function isDefaultPackage(packageName: string): boolean {
  return PACKAGE_PATH_BY_NAME.has(packageName.toLowerCase());
}

/**
 * The file extension a stock package is expected to have, or undefined if the
 * name is not a stock package.
 */
export function packageFileExtension(
  packageName: string,
): FileExtension | undefined {
  const path = PACKAGE_PATH_BY_NAME.get(packageName.toLowerCase());
  return path === undefined ? undefined : EXTENSION_BY_PACKAGE_PATH[path];
}
