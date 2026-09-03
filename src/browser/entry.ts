/**
 * The bundle entry point.
 *
 * `npm run build` wraps this in an IIFE at `dist/UnrealPackageReader.js`, for
 * loading with a classic `<script src>` tag. The constructor is
 * published on `globalThis` rather than exported: a classic script has no
 * module scope for consumers to import from, and the assignment also lets
 * `await import()` under Node see the constructor when a test loads the built
 * artefact.
 */

import { UnrealPackageReader } from "../reader.ts";

(
  globalThis as { UnrealPackageReader?: typeof UnrealPackageReader }
).UnrealPackageReader = UnrealPackageReader;
