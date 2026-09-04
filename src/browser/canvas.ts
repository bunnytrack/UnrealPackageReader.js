/**
 * The browser-only rendering helpers: everything that touches `document`.
 *
 * Kept out of `src/reader.ts` so that importing the reader under Node never
 * evaluates a DOM global - these functions only reach for `document` when
 * called. The reader's `textureToCanvas`, `getPaletteCanvas` and
 * `getLevelScreenshots` methods delegate here.
 */

import type { ExportTableObject } from "../package/objects.ts";
import type { FloatProperty, ObjectProperty } from "../package/properties.ts";
import type { UPalette, UTexture } from "../natives/texture.ts";
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
  const textureData = textureObject.readData() as UTexture;
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

/** A palette as a 16×16 swatch grid. */
export function getPaletteCanvas(
  paletteObject: ExportTableObject,
): HTMLCanvasElement {
  return createCanvas({
    width: 16,
    height: 16,
    palette: paletteObject.readData() as unknown as UPalette,
  });
}

export interface LevelScreenshots {
  frames: HTMLCanvasElement[];
  /**
   * Seconds per frame: `1 / MaxFrameRate` of the `Screenshot` texture, with
   * the engine's clamp of the rate to 0.01-100. The engine advances the
   * animation by ticking the texture being drawn, so only the first frame's
   * rate matters; the others' are ignored. Zero means that texture sets no
   * rate, which the engine treats as "advance every tick"; slideshow callers
   * should substitute a floor.
   */
  interval: number;
}

/**
 * A map's screenshot frames, in order.
 *
 * The game menus load the texture named `Screenshot` and draw it
 * (`UMenu/UMenuScreenshotCW.uc`, `UBrowser/UBrowserScreenshotCW.uc`). A montage
 * is ordinary texture animation: `UTexture::ConstantTimeTick` walks `AnimNext`
 * from frame to frame, restarting from the first texture at a null link. The
 * walk in this reader stops at: a null link, an import object (this reader only
 * holds one package at a time), and at a frame already collected, since some
 * maps link the last frame back to the head.
 *
 * With no `Screenshot` texture the game shows nothing. As a convenience, this
 * reader falls back to `LevelInfo0.Screenshot`, when that lives in this package.
 */
export function getLevelScreenshots(
  reader: UnrealPackageReader,
): LevelScreenshots {
  const frameObjects: ExportTableObject[] = [];
  let interval = 0;

  const head = reader
    .getTextureObjects()
    .find((item) => item.objectName.toLowerCase() === "screenshot");

  if (head) {
    frameObjects.push(head);

    const maxFrameRate = head.getProp("MaxFrameRate");

    if (maxFrameRate && "value" in maxFrameRate) {
      const rate = (maxFrameRate as FloatProperty).value;

      if (rate !== 0) {
        interval = 1 / Math.min(Math.max(rate, 0.01), 100);
      }
    }

    let current: ExportTableObject = head;

    while (true) {
      const animNext = current.getProp("AnimNext");

      if (!animNext || !("value" in animNext)) break;

      const next = reader.getObject((animNext as ObjectProperty).value);

      if (!next?.isExportTableObject() || frameObjects.includes(next)) break;

      frameObjects.push(next);
      current = next;
    }
  } else {
    const levelInfo = reader.getExportObjectByName("LevelInfo0");
    const screenshotProp = levelInfo?.getProp("Screenshot");

    if (screenshotProp && "value" in screenshotProp) {
      const texture = reader.getObject(
        (screenshotProp as ObjectProperty).value,
      );

      if (texture?.isExportTableObject()) {
        frameObjects.push(texture);
      }
    }
  }

  return {
    frames: frameObjects.map((item) => textureToCanvas(reader, item)),
    interval,
  };
}
