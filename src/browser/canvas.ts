/**
 * The browser-only rendering helpers: everything that touches `document`.
 *
 * Kept out of `src/reader.ts` so that importing the reader under Node never
 * evaluates a DOM global - these functions only reach for `document` when
 * called. The reader's `textureToCanvas`, `getPaletteCanvas` and
 * `getLevelScreenshots` methods delegate here.
 */

import type { ExportTableObject } from "../package/objects.ts";
import type { UPalette } from "../natives/texture.ts";
import type { MipMap } from "../structs/texture.ts";
import type { UnrealPackageReader } from "../reader.ts";

export interface CanvasSource {
  width: number;
  height: number;
  palette: UPalette;
  mipMap?: MipMap;
}

/**
 * Render either a paletted mip map, or - with no mip - the palette itself as a
 * swatch grid.
 *
 * The alpha channel is forced opaque, which is close to the engine's own rule:
 * palette alpha is garbage before package version 66 - old writers never read
 * it, so `Faces.utx` has it zeroed throughout - and the engine's palette
 * loader overwrites it with 255 for files that old. From v66 the stored alpha
 * is real, but it feeds masked and translucent rendering, which this flat
 * preview does not attempt.
 */
export function createCanvas({
  width,
  height,
  palette,
  mipMap,
}: CanvasSource): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;

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
}

/** A texture's first mip, rendered through its own palette. */
export function textureToCanvas(
  reader: UnrealPackageReader,
  textureObject: ExportTableObject,
): HTMLCanvasElement {
  const textureData = textureObject.readData() as { mip_maps: MipMap[] };
  const [mipMap] = textureData.mip_maps;
  const paletteProp = textureObject.getProp("palette") as { value: number };
  const paletteObject = reader.getObject(
    paletteProp.value,
  ) as ExportTableObject;
  const palette = paletteObject.readData() as unknown as UPalette;

  return createCanvas({
    width: mipMap.width,
    height: mipMap.height,
    palette,
    mipMap,
  });
}

/** A palette as a 16 x 16 swatch grid. */
export function getPaletteCanvas(
  paletteObject: ExportTableObject,
): HTMLCanvasElement {
  return createCanvas({
    width: 16,
    height: 16,
    palette: paletteObject.readData() as unknown as UPalette,
  });
}

/**
 * A map's embedded screenshots.
 *
 * Officially one texture named "Screenshot"; consecutively numbered
 * "Screenshot1", "Screenshot2", ... make an in-game montage, so all are
 * returned in numeric order (which table order does not guarantee). Some maps
 * instead point `LevelInfo0.Screenshot` at an arbitrary texture - shown when
 * it lives in this package, skipped when it is an import.
 */
export function getLevelScreenshots(
  reader: UnrealPackageReader,
): HTMLCanvasElement[] {
  const screenshots: HTMLCanvasElement[] = [];
  const screenshotRegEx = /^Screenshot([0-9]+)?$/i;
  const screenshotObjects = reader
    .getTextureObjects()
    .filter((item) => screenshotRegEx.test(item.objectName));

  if (screenshotObjects.length > 0) {
    const tempScreenshots = screenshotObjects.map((item) => ({
      canvas: textureToCanvas(reader, item),
      num: Number(item.objectName.substring("Screenshot".length)),
    }));

    tempScreenshots.sort(({ num: a }, { num: b }) => a - b);

    screenshots.push(...tempScreenshots.map((item) => item.canvas));
  } else {
    const levelInfo = reader.getExportObjectByName("LevelInfo0");
    const screenshotProp = levelInfo?.getProp("Screenshot");

    if (screenshotProp && "value" in screenshotProp) {
      const invalidScreenshot = reader.getObject(
        screenshotProp.value as number,
      );

      if (invalidScreenshot && invalidScreenshot.table !== "import") {
        screenshots.push(
          textureToCanvas(reader, invalidScreenshot as ExportTableObject),
        );
      }
    }
  }

  return screenshots;
}
