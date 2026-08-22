# UnrealPackageReader.js

A JavaScript plugin for reading [Unreal Tournament](https://en.wikipedia.org/wiki/Unreal_Tournament) package data. This has been successfully tested with a few other Unreal Engine 1 games including Deus Ex, Rune, Harry Potter and the Philosopher's Stone/Chamber of Secrets, Clive Barker's Undying, Nerf Arena Blast, and The Wheel of Time.

This plugin is largely based on the following package-readers:

* [PHP UPackage](https://ut99.org/viewtopic.php?t=4796) by Feralidragon
* [Unreal Tournament Package Tool](https://www.acordero.org/projects/unreal-tournament-package-tool/) by Antonio Cordero Balcázar

The main difference between UnrealPackageReader.js and the above readers (besides the programming language) is that this is web-oriented, providing textures as [Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) objects and brush geometry in a format suitable for use with [three.js](https://threejs.org/), for example.

## Demo
Visit https://bunnytrack.net/package-explorer/ and drag a UT package (map, texture, sound, etc.) to see what the plugin is capable of:

![Squid model shown using three.js](https://www.bunnytrack.net/package-explorer/demo/squid.gif)
![DM-Pyramid wireframe shown using three.js](https://www.bunnytrack.net/package-explorer/demo/dm-pyramid.gif)
![Pulse Gun wireframe shown using three.js](https://www.bunnytrack.net/package-explorer/demo/pulse-gun.gif)

---

## Usage
Create an instance of UnrealPackageReader by passing an `ArrayBuffer` as the only argument:

```js
const reader = new UnrealPackageReader(arrayBuffer);
```

**Example with HTML**
```html
<input type="file" id="file-input" />

<script src="UnrealPackageReader.js"></script>
<script>
    document.getElementById("file-input").addEventListener("input", function() {
        for (const file of this.files) {
            const fileReader = new FileReader();

            fileReader.onload = function() {
                const reader  = new UnrealPackageReader(this.result);
                const package = reader.readPackage();

                // Get package version
                console.log(package.version); // 69
            }

            fileReader.readAsArrayBuffer(file);
        }
    })
</script>
```

---

## Properties
| Name          | Type   | Description                                                                                                               |
| ---           | ---    | ---                                                                                                                       |
| `dataView`    | Object | A [`DataView`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView) of the package. |
| `header`      | Object | Package header.                                                                                                           |
| `version`     | Int    | Package version.                                                                                                          |
| `nameTable`   | Array  | Package name table.                                                                                                       |
| `importTable` | Array  | Package import table.                                                                                                     |
| `exportTable` | Array  | Package export table.                                                                                                     |

---

## Methods

> [!WARNING]
> Unfortunately everything from this point on is very out of date. This project was written many years ago in plain JavaScript, with no JSDoc annotations or anything to help with typing at all. Sorry about that. One day, I might rewrite this in TypeScript.

The most useful methods have been documented here, although there are several more available in the source (most of which are in use on the demo page linked above).

### `getLevelSummary(allProperties = false : Bool)` returns *Object*

Returns an object containing level details. The object will be empty if the package is not a map file (i.e. does not contain a `LevelInfo`) actor.

When `allProperties` is `false`, only the following level properties are returned: `Author`, `IdealPlayerCount`, `LevelEnterText`, `Screenshot`, `Song`, `Title`.

The `Screenshot` property is cast to a `bool` value rather than returning the export table index.

These properties are read directly from the `LevelInfo0` actor which is present in all map files.

**Example using CTF-Face**

_`allProperties = false`_

```json
{
    "Author"           : "Cedric 'Inoxx' Fiorentino",
    "IdealPlayerCount" : "4-10",
    "Screenshot"       : true,
    "Song"             : "Foregone",
    "Title"            : "Facing Worlds"
}
```

_`allProperties = true`_

```json
{
    "TimeSeconds": 174.3309326171875,
    "Title": "Facing Worlds",
    "Author": "Cedric 'Inoxx' Fiorentino",
    "IdealPlayerCount": "4-10",
    "RecommendedEnemies": 2,
    "RecommendedTeammates": 3,
    "Summary": "LevelSummary",
    "bHighDetailMode": false,
    "Song": "Foregone",
    "PlayerDoppler": 1,
    "Brightness": 1.5,
    "Screenshot": true,
    "DefaultGameType": "CTFGame",
    "NavigationPointList": "InventorySpot167",
    "AIProfile": 201077017,
    "AvgAITime": 1.2611686178923354e-44,
    "AmbientBrightness": 4,
    "TexUPanSpeed": 2,
    "Level": "LevelInfo0",
    "Tag": "LevelInfo",
    "Region": {
        "zone": 1,
        "i_leaf": -1,
        "zone_number": 0
    },
    "Location": {
        "x": -19899,
        "y": -2642,
        "z": -32767
    },
    "Rotation": {
        "pitch": 0,
        "yaw": 16384,
        "roll": 0
    }
}
```

---

### `getScreenshot(callback : Function)` returns *Array*
Asynchronously extracts a map's screenshot texture(s) and returns an array of Canvas objects in the provided callback function.

In order for UT to be able to display a map screenshot in-game, the screenshot must be named `Screenshot` and saved in the `MyLevel` pseudo-package; some mappers, however, have not named the texture correctly (e.g. BT-SlaughterCB) or have erroneously set the `Screenshot` property to a texture within a different package.

This function attempts to extract the screenshot even if it is set incorrectly, although it is not always possible to do so (e.g. when the texture is part of an external package).

An array is returned as multiple screenshots may be embedded to create a slideshow/montage effect if named sequentially, i.e. "Screenshot1", "Screenshot2", etc.

An empty array is returned if no screenshots are found.

**Example**

```js
package.getScreenshot(function(screenshotArray) {
    if (screenshotArray.length > 0) {
        // Do something with the screenshots
    } else {
        // No screenshots available
    }
})
```

---

### `getDependencies()` returns *Array*
Returns an array of dependencies (i.e. other packages) required for this package to be used.

The return value is an array of objects. Each object will always have a `name` and `default` property (`string` and `bool` respectively) and may also contain `ext` and `type` properties (both `string`).

**Example using BT-Mesablanca**
```js
[
    // Crypt2.utx - a default texture package dependency
    {
        "name"    : "Crypt2",
        "ext"     : "utx",
        "type"    : "Texture",
        "default" : true
    },

    // Non-default dependency; type unknown
    {
        "name"    : "BT2",
        "default" : false
    },

    // etc.
]
```

---

### `getDependenciesFiltered(ignoreCore = true : Bool)` returns *Object*
Returns an object containing a `packages` property which contains two arrays: `default` and `custom`. A `length` property is also included.

This function is essentially the same as `getDependencies` with the return value filtered into default/non-default dependency arrays.

When `ignoreCore` is `true`, several core UT files which are used by the vast majority of packages (such as `Core.u` and `Engine.u`) are excluded from the return value.

**Example using BT-Mesablanca**
```js
{
    "length": 30,
    "custom": [
        {
            "name"    : "SS3rdWorld",
            "default" : false
        },

        // etc.
    ],
    "default": [
        {
            "name"    : "DoorsAnc",
            "ext"     : "uax",
            "type"    : "Sound",
            "default" : true
        },

        // etc.
    ]
}
```

---

### `getTextureObjects()` returns *Array*
Returns an array of texture export table objects.

**Example using BT-BehindSunrise**
```js
[
    {
        "class_index"       : -39,
        "super_index"       : 0,
        "package_index"     : 0,
        "object_name_index" : 599,
        "object_flags"      : 983044,
        "serial_size"       : 22027,
        "serial_offset"     : 29774
    },

    // etc.
]
```

The properties listed in the example above can then be used to ascertain further details about that texture (its name, image data, etc).

---

### `getTextureInfo(textureObject : Object)` returns *Object*
Returns the texture's name and group (if available).

**Example using the texture object above**
```json
{
    "name"  : "trims2",
    "group" : null
}
```

---

### `textureToCanvas(textureObject : Object, callback : Function)` returns *Object*
Returns to the callback function a single object containing a Canvas, [ImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap) interface, and the texture name.

**Example**

```js
// All embedded textures
const textureObjects = package.getTextureObjects();

// Extract the first texture then append it to a container element
package.textureToCanvas(textureObjects[0], function(texture) {

    // Texture name, e.g. "C_wall2a"
    console.log("Appending canvas for texture:", texture.name);

    // Append canvas to the DOM
    document.getElementById("texture-container").append(texture.canvas);

})
```

---

### `getSounds()` returns *Array*
Returns an array of objects, each containing details of the package's sound objects.

Where possible, extra data is included from WAV file headers.

**Example using BT-BehindSunrise**
```js
[
    {
        "object_name"        : "islice",
        "properties"         : [],
        "format"             : "WAV",
        "next_object_offset" : 4665608,
        "size"               : 19822,
        "audio_offset"       : 4645786,
        "channels"           : 1,     // PCM WAV data
        "sample_rate"        : 22050, // PCM WAV data
        "byte_rate"          : 22050, // PCM WAV data
        "bit_depth"          : 8      // PCM WAV data
    },

    // etc.
]
```

This can then be used for audio playback via a [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob) object:

```js
// Get all sounds in the package
const sounds = package.getSounds();

// Slice the audio data from the DataView's array buffer
const audioData = reader.dataView.buffer.slice(sound[0].audio_offset, sound[0].audio_offset + sound[0].size);

// Create the Blob
const audioBlob = new Blob([audioData], {
    type: `audio/${sound[0].format.toLowerCase()}`
})

// Create an <audio> element
const audio = new Audio();

audio.src      = URL.createObjectURL(audioBlob);
audio.controls = true;

// Append to the DOM
document.getElementById("sound-container").append(audio);
```

---

### `getTextBuffer(textBufferObject : Object)` returns *Object*
Returns an object of text buffer properties. The `contents` property is only present if the size is greater than zero.

A text buffer is usually an embedded UnrealScript file.

**Example using BT-BehindSunrise**
```js
[
    // "contents" property truncated for brevity
    {
        "object_name" : "resetcounter",
        "properties"  : [],
        "pos"         : 850,
        "top"         : 0,
        "size"        : 2282,
        "contents"    : "class ResetCounter expands Triggers;\r\n#exec Texture Import File=Textures\\Counter.pcx"
    },

    // etc.
]

```

Displaying the contents of embedded UnrealScript:
```js
// Get all text buffers
const textBuffers = package.getTextBufferObjects();

// Get properties for this text buffer
const textBuffer = package.getTextBuffer(textBuffers[0]);

// Name and file size
console.log(textBuffer.name, "text buffer is", textBuffer.size, "bytes");

// Write the script contents to an element
document.getElementById("code-container").textContent = textBuffer.contents;
```

---

### `getMusic(musicObject : Object)` returns *Object*
Returns a music object's properties with an ArrayBuffer of the audio data. This can be used for audio playback using tracker players such as [WebXmp](https://github.com/wothke/libxmp-4.4.1/).

**Example using Botmca9.umx**
```js
{
    "object_name"     : "Botmca9",
    "properties"      : [],
    "format"          : "it",
    "data_end_offset" : 1208272,
    "size"            : 1208110,
    "audio_data"      : ArrayBuffer
}
```

---

### `getAllBrushData()` returns *Array*
Returns an array of objects containing related Brush, Model, and Polys objects. The amount of properties is very large, so to view the full list refer to the source code.

**Example using DM-Pyramid**
```js
// All brushes in this package
const allBrushData = package.getAllBrushData();

const brush = allBrushData[0];

// View details for the first brush polygon
console.log(brush.polys.polygons[0]);
```

The above will output:

```js
{
    "vertex_count": 3,
    "origin": {
        "x": 696.5000610351562,
        "y": 34.82449722290039,
        "z": 390.832763671875
    },
    "normal": {
        "x": -0.4247591495513916,
        "y": 0.17332696914672852,
        "z": 0.8885591626167297
    },
    "texture_u": {
        "x": 1.5418169498443604,
        "y": 4.74781608581543,
        "z": -0.18909700214862823
    },
    "texture_v": {
        "x": 3.814587116241455,
        "y": -1.0555590391159058,
        "z": 2.02939510345459
    },
    "vertices": [
        {
            "x": -37.44523239135742,
            "y": 24.32044219970703,
            "z": 42.03284454345703
        },
        {
            "x": -41.419986724853516,
            "y": 18.003799438476562,
            "z": 41.36494445800781
        },
        {
            "x": -27.743032455444336,
            "y": 20.313186645507812,
            "z": 47.452476501464844
        }
    ],
    "flags": [
        "Semisolid",
        "LowShadowDetail"
    ],
    "actor"      : 0,
    "texture"    : -7, // Package object reference
    "item_name"  : 0,
    "link"       : 0,
    "brush_poly" : -1, // Package object reference
    "pan_u"      : 0,
    "pan_v"      : 0
}
```

---

### `getAllMeshData()` returns *Array*
Returns an array of objects for Mesh, LodMesh, and SkeletalMesh objects. As with brushes, the objects can be extremely large in size so the example below has been reduced for simplicity:

```js
// All meshes in this package
const allMeshData = package.getAllMeshData();

const mesh = allMeshData[0];

// View some mesh details
console.log(mesh.object_name);
console.log(mesh.rotation_origin);
console.log(mesh.anim_sequences[1]);
console.log(mesh.vertices[0]);
```

The above will output:

```js
// mesh.object_name
"sktrooper"

// mesh.rotation_origin
{
    "pitch" : 0,
    "yaw"   : 16384,
    "roll"  : -16384
}

// mesh.anim_sequences[1]
{
    "name"        : "claw",
    "group"       : "Attack",
    "start_frame" : 0,
    "frame_count" : 13,
    "functions"   : [
        {
            "time"     : 1047904911,
            "function" : 300
        },
        {
            "time"     : 1061326684,
            "function" : 300
        }
    ],
    "rate" : 15
}

// mesh.vertices[0]
{
    "x" : -48.125,
    "y" : -2.375,
    "z" : -17.75
}
```
