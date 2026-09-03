# UnrealPackageReader.js

A TypeScript reader for [Unreal Tournament](https://en.wikipedia.org/wiki/Unreal_Tournament)
package files. It has been successfully tested with a few other Unreal Engine 1
games including Deus Ex, Rune, Harry Potter and the Philosopher's
Stone/Chamber of Secrets, Clive Barker's Undying, Nerf Arena Blast, and The
Wheel of Time.

This reader is largely based on the following package readers:

- [PHP UPackage](https://ut99.org/viewtopic.php?t=4796) by Feralidragon
- [Unreal Tournament Package Tool](https://www.acordero.org/projects/unreal-tournament-package-tool/) by Antonio Cordero Balcázar

The main difference between UnrealPackageReader.js and the above readers
(besides the programming language) is that this is web-oriented: textures
can be rendered onto a canvas on the fly, and brush geometry can be read
in a format that's easy to drop straight into [three.js](https://threejs.org/),
to name a couple of features.

## Demo

Visit BunnyTrack.net's [package explorer page](https://bunnytrack.net/package-explorer/)
and drag/drop a UT package (map, texture, sound, etc.) to see what the reader is capable of:

![Squid model shown using three.js](https://www.bunnytrack.net/package-explorer/demo/squid.gif)
![DM-Pyramid wireframe shown using three.js](https://www.bunnytrack.net/package-explorer/demo/dm-pyramid.gif)
![Pulse Gun wireframe shown using three.js](https://www.bunnytrack.net/package-explorer/demo/pulse-gun.gif)

## Usage

Load `dist/UnrealPackageReader.js` with a `<script>` tag; it defines a single
global class, `UnrealPackageReader`. Construct it with an `ArrayBuffer` and
call `readPackage()`, which parses the file and returns the reader:

```js
const utPackage = new UnrealPackageReader(arrayBuffer).readPackage();

utPackage.version; // 69
utPackage.getLevelSummary(); // { Title: "Facing Worlds", ... }
utPackage.getTextureObjects(); // one export table entry per texture
```

**Example with HTML**

```html
<input type="file" id="file-input" />

<script src="UnrealPackageReader.js"></script>
<script>
  document
    .getElementById("file-input")
    .addEventListener("input", async function () {
      for (const file of this.files) {
        const buffer = await file.arrayBuffer();
        const utPackage = new UnrealPackageReader(buffer).readPackage();

        // Get package version
        console.log(utPackage.version); // 69
      }
    });
</script>
```

## API documentation

The full API reference is generated from the source and published at
[bunnytrack.github.io/unreal-package-reader](https://bunnytrack.github.io/unreal-package-reader/).

What you're most likely after is the
[`UnrealPackageReader` class](https://bunnytrack.github.io/unreal-package-reader/classes/reader.UnrealPackageReader.html)
page, where you'll find the methods for fetching objects, textures, sounds,
brushes, dependencies and level summaries.

The modules are listed top down: starting from the general-purpose reader
class, each one goes a level deeper into the package anatomy, ending at the
raw bytes.

- `reader` - the entry class above
- `package` - the header, the three tables and the property block
- `natives` - what follows the property block, for the classes the reader
  understands (`Texture`, `Model`, `Sound`, ...)
- `structs` - the sequential field readers those are assembled from
- `constants` - flag tables, enums, type codes and the stock package list
- `io` - the byte cursor and codepage-aware text decoding

Where a struct or field mirrors an engine type, the doc comment acknowledges
the original naming (e.g. `FBspNode`) and describes it in terms verified
against, and paraphrased from, the publicly released Unreal Tournament engine
headers.

## TypeScript port

This reader was originally written as a single plain-JavaScript file, and was
ported to TypeScript by [Claude](https://claude.com/claude-code) under the
author's supervision. The ported reader was tested field by field against the
original implementation (fixing a number of bugs along the way), and verified
against engine sources and other package readers.

The original implementation has been retired and now lives in the `legacy/`
folder; it will not be worked on any further.
