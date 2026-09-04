/**
 * The browser layer: the helpers that render parsed data onto a canvas.
 *
 * Everything that touches `document` lives here, so that importing the reader
 * under Node never evaluates a DOM global. `UnrealPackageReader` exposes these
 * as methods for convenience; calling them outside a browser throws on
 * `document`.
 *
 * @module browser
 */

export {
  createCanvas,
  getLevelScreenshots,
  getPaletteCanvas,
  textureToCanvas,
  type CanvasSource,
  type LevelScreenshots,
} from "./canvas.ts";
