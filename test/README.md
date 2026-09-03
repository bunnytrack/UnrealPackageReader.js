# Test harness

Golden snapshot tests for the reader in `src/`.

## Running

```
npm test              check the corpus against committed snapshots
npm run test:watch    re-run on change
npm run test:update   accept changes / add new files
npm run build         bundle src/ into dist/UnrealPackageReader.js (IIFE)
npm run dump          write full parse dumps to test/deep
npm run typecheck
npm run format
```

Unit tests for the modules live alongside the code in `src/`; this directory
holds the corpus harness and a bundle smoke test.

| File             | Purpose                                     |
| ---------------- | ------------------------------------------- |
| `corpus.test.ts` | One snapshot test per corpus package        |
| `bundle.test.ts` | `dist/` loads as a script and parses        |
| `snapshot.ts`    | Corpus discovery and snapshot construction  |
| `serialise.ts`   | Canonical, non-reconstructive serialisation |
| `dump.ts`        | CLI for full parse dumps                    |

## Corpus

Put packages in `test/corpus`, grouped by release:

```
test/corpus/
  unreal-227/maps/DmDeck16.unr
  ut99-436/system/Botpack.u
```

Snapshots are keyed on the path relative to `test/corpus`, so the same
filename can appear under several releases.

`test/corpus` is gitignored as stock assets are copyrighted and cannot be
committed. The snapshots derived from them _are_ committed, because every
binary payload is reduced to a digest; nothing in `test/snapshots` can
reconstruct an asset. A missing corpus makes the suite skip rather than fail.
Each snapshot begins with the SHA-256 of its source file, so a different
build of a same-named package fails immediately and legibly.

## Changing the reader

Snapshots are allowed to move, but only in ways predicted beforehand:

1. Predict what moves, as a count, before touching anything.
2. Apply changes expected to move nothing first. If all snapshots pass
   untouched, that is a complete check requiring no review.
3. For changes that do move values: `npm run dump` before and after, then
   diff `test/deep`. Confirm only the predicted fields changed, in the
   predicted counts.
4. `npm run test:update`, then check the snapshot diff is hash-only - masking
   the object hashes should collapse every changed line into matched pairs. A
   changed class, flag, offset, size or count means something structural moved
   and the prediction was wrong.

Rules that a plausible-looking change can silently break:

- **Wire-format field names are preserved verbatim**, snake_case and all
  (`zone_mask`, `i_vert_pool`). Snapshots hash each object's property _names_
  along with its values, so a rename moves the hash of every object
  containing the field.
- **In a reader, property order is read order.** Object literals evaluate top
  to bottom, so the returned literal doubles as the field sequence; reordering
  one for tidiness re-reads the bytes in the wrong order, and insertion order
  feeds the snapshot hash besides.
- **Lookup table order is part of the public contract.** Consumers index
  straight in (`enumCsgOper[props.csgoper]`, `propertyTypes[infoByte & 0xf]`),
  so reordering an enum or flag table silently mislabels values.
- **Source must use only _erasable_ TypeScript** - no parameter properties,
  enums, namespaces or decorators - so `test/dump.ts` keeps running under
  plain `node`. The `erasableSyntaxOnly` tsconfig flag enforces it at
  `npm run typecheck`.

## Coverage

The reader takes 23 distinct sides of `header.version` branches. The corpus -
16 packages spanning versions 60, 61, 63, 64, 66, 69 and 79 - exercises 20 of
them. The three unreached branches are single-field reads needing package
kinds that may not exist: `.u` script packages only ever carry the engine
version of the build that shipped them, so a v61 or v65 `.u` with meshes, or
a v62 `.unr`, would have to come from a specific interim build. Unreached
code is flagged `UNVERIFIED` in place in `src/`. Dropping a matching file
into the corpus and running `test:update` closes a gap retroactively at any
point.
