$(function () {
  initialisePage();

  // Globally accessible object for DataTables instances
  const tables = {};

  const fileInput = $("#file-input");

  const PLAYERS = {
    JSMPEG: "JSMPEG",
    MOD_PLAYER: "MOD_PLAYER",
  };

  const SOUND_FORMATS = {
    MP2: "MP2",
    WAV: "WAV",
    XA: "XA",
  };

  const SUPPORTED_SOUND_FORMATS = Object.values(SOUND_FORMATS);

  const isSupportedSoundFormat = (format) =>
    typeof format === "string" &&
    SUPPORTED_SOUND_FORMATS.includes(format.toUpperCase());

  // Globals used across various functions in this file
  const utLoadedScripts = [];
  const musicConfigStore = {};

  /** @type {UnrealPackageReader | null} */
  let utPackage = null;
  let screenshotSlideshowId, packageArrayBuffer, currentMesh;

  fileInput
    .on("input", function () {
      if (this.files.length > 0) {
        const file = this.files[0];
        const filename = file.name.substring(0, file.name.lastIndexOf("."));
        const fileExt = file.name
          .substring(file.name.lastIndexOf(".") + 1)
          .toLowerCase();
        const fileReader = new FileReader();

        fileReader.onload = function () {
          const utReader = new UnrealPackageReader(this.result);

          // Assign globals for functions below.
          try {
            utPackage = utReader.readPackage();
          } catch (e) {
            alert("Unable to load package due to invalid signature");
            return;
          }

          packageArrayBuffer = this.result;

          $("body").addClass("file-loaded");

          // Used when switching to Textures tab (see populateTexturesTab function).
          utPackage.filename = filename;

          // Populate file info
          $(".file-summary .file-name").text(filename);
          $(".file-summary .file-type").text(
            `${utPackage.fileTypesByExt[fileExt]} (.${fileExt})`,
          );
          $(".file-summary .file-size").text(readableFileSize(file.size));
          $(".file-summary .file-guid").text(
            utPackage.header.guid
              ? utPackage.header.guid.match(/.{8}/g).join("-")
              : "-",
          );
          $(".file-summary .file-version").text(utPackage.version);

          $("main").show(0);
          $(".screenshot, .level-summary").hide(0);

          if (!$("body").hasClass("tabs-loaded")) {
            loadTabs();
          }

          // Switch to the relevant tab for each format
          switch (fileExt) {
            case "unr":
              showLevelSummary();
              break;

            case "uax":
              $("[href='#tab-sounds']").click();
              break;

            case "umx":
              $("[href='#tab-music']").click();
              break;

            case "utx":
              $("[href='#tab-textures']").click();
              populateTexturesTab();
              break;

            case "uxx":
              if (isLevel()) showLevelSummary();
              break;

            default:
              $("[href='#tab-dependencies']").click();
              break;
          }

          // Show dependencies table first
          createDependenciesTable();

          // Update tab counts on file load
          const counts = utReader.getClassesCount();

          $("[href='#tab-textures'] .count").text(`(${counts.texture || 0})`);
          $("[href='#tab-sounds'] .count").text(`(${counts.sound || 0})`);
          $("[href='#tab-music'] .count").text(`(${counts.music || 0})`);
          $("[href='#tab-scripts'] .count").text(`(${counts.textbuffer || 0})`);
          $("[href='#tab-brushes'] .count").text(
            `(${utPackage.getAllBrushObjects().length})`,
          );
          $("[href='#tab-meshes'] .count").text(
            `(${(counts.mesh || 0) + (counts.lodmesh || 0) + (counts.skeletalmesh || 0)})`,
          );
        };

        fileReader.readAsArrayBuffer(file);
      }
    })
    .trigger("input");

  function isLevel() {
    return utPackage.getExportObjectByName("LevelInfo0") !== null;
  }

  function showLevelSummary() {
    const levelSummary = utPackage.getLevelSummary();

    $(".level-summary .author").text(levelSummary["Author"] || "—");
    $(".level-summary .title").text(levelSummary["Title"] || "—");
    $(".level-summary .music").text(levelSummary["Song"] || "—");
    $(".level-summary .ideal-player-count").text(
      levelSummary["IdealPlayerCount"] || "—",
    );
    $(".level-summary .level-enter-text").text(
      levelSummary["LevelEnterText"] || "—",
    );

    clearTimeout(screenshotSlideshowId);

    const screenshotArray = utPackage.getLevelScreenshots();

    if (screenshotArray.length > 0) {
      $(".screenshot canvas").replaceWith(screenshotArray[0]);

      // Emulate "slideshow" if multiple found
      if (screenshotArray.length > 1) {
        const speed = 1300; // approximation of UT's speed
        const showScreenshot = (i) => {
          screenshotSlideshowId = setTimeout(function () {
            $(".screenshot canvas").replaceWith(screenshotArray[i]);
            showScreenshot((i + 1) % screenshotArray.length);
          }, speed);
        };

        showScreenshot(1);
      }
    } else {
      noScreenshotAvailable();
    }

    $(".screenshot, .level-summary").show(0);
    $("[href='#tab-dependencies']").click();
  }

  // Check if this tab has loaded contents for the current package.
  // Prevents reloading resource-intensive contents (e.g. textures, import/export tables).
  function tabUnpopulated(tabId) {
    const tab = $(`#tab-${tabId}`);
    const tabUnpopulated = tab.data("current-package") !== utPackage.filename;

    if (tabUnpopulated) {
      tab.data("current-package", utPackage.filename);
    }

    return tabUnpopulated;
  }

  function populateTexturesTab() {
    if (tabUnpopulated("textures")) {
      const textureTab = $("#tab-textures .inner");
      const textureObjects = utPackage.getTextureObjects();
      const hasTextures = textureObjects.length > 0;

      $("#tab-textures").toggleClass("has-textures", hasTextures);

      if (!hasTextures) {
        textureTab.html("This package contains no embedded textures.");
      } else {
        textureTab.html(`
          <div class="sidebar">
            <div class="selected-texture">
              <canvas></canvas>
            </div>

            <div class="palette-wrapper">
              <canvas></canvas>
            </div>

            <div class="texture-info">
              <h4>Properties</h4>
              <table>
                <tbody></tbody>
              </table>
            </div>
          </div>
        `);

        const createTextureGroupHtml = (groupName, groupedObjects) => {
          const groupTextures = groupedObjects[groupName].sort((a, b) =>
            a.texture.name.toLowerCase() < b.texture.name.toLowerCase()
              ? -1
              : 1,
          );
          const groupWrapper = $(`
            <div class="group-wrapper">
              <h3><em>${groupName}</em> (${groupTextures.length})</h3>
              <div class="texture-group"></div>
            </div>
          `);

          const groupHtml = groupWrapper.find(".texture-group");

          for (const textureEl of groupTextures) {
            groupHtml.append(textureEl.html);
          }

          textureTab.append(groupWrapper);
        };

        const textureElements = [];

        for (const texture of textureObjects) {
          const canvas = utPackage.textureToCanvas(texture);
          const textureInfo = utPackage.getTextureInfo(texture);
          const textureHtml = $(`
            <div class="texture">
              <div class="canvas-wrapper"></div>
              <div class="label">
                <p class="name"></p>
                <p class="size"></p>
              </div>
            </div>
          `);

          textureHtml.find(".canvas-wrapper").append(canvas);
          textureHtml.find(".name").text(textureInfo.name);
          textureHtml.find(".size").text(`${canvas.width}×${canvas.height}`);

          // Add texture object here so it can be used to show details in the sidebar
          textureHtml.data("texture", texture);

          textureElements.push({
            texture: textureInfo,
            html: textureHtml,
          });

          if (textureElements.length === textureObjects.length) {
            const grouped = {};

            for (const texEl of textureElements) {
              const group = texEl.texture.group || "Ungrouped";

              if (grouped[group] !== undefined) {
                grouped[group].push(texEl);
              } else {
                grouped[group] = [texEl];
              }
            }

            // Show ungrouped textures first
            if (Object.keys(grouped).includes("Ungrouped")) {
              createTextureGroupHtml("Ungrouped", grouped);

              // Remove from object so it's not shown again below
              delete grouped["Ungrouped"];
            }

            const groupNames = getSortedKeys(grouped);

            // Yes these variable names are awful
            for (const group of groupNames) {
              createTextureGroupHtml(group, grouped);
            }

            $("#tab-textures .texture canvas").eq(0).click();
          }
        }
      }
    }
  }

  function createDependenciesTable(showTreeView) {
    const dependenciesTab = $("#tab-dependencies .inner");
    const dependencies = utPackage.getDependenciesFiltered();

    // Reset
    dependenciesTab.html("");

    // Show these types as plural in dependency list
    const typePlural = {
      Sound: "Sounds",
      Texture: "Textures",
    };

    if (dependencies.length === 0) {
      dependenciesTab.text("This package has no dependencies.");
    } else {
      for (const type in dependencies.packages) {
        const grouped = groupDependenciesByType(dependencies.packages[type]);
        const depTypes = getSortedKeys(grouped);

        const depHtml = $(`
          <section class="deps-list deps-${type}">
            <h3>${type === "default" ? "Default" : "Custom"} (${dependencies.packages[type].length})</h3>
          </section>
        `);

        if (type === "default") {
          depHtml.append(`
            <section>
              <label>
                <input type="radio" name="dependency-view" value="basic" autocomplete="off" ${showTreeView ? "" : "checked"} />
                Basic view
              </label>

              <label>
                <input type="radio" name="dependency-view" value="tree" autocomplete="off" ${showTreeView ? "checked" : ""} />
                Grouped view
              </label>
            </section>
          `);
        }

        for (const depType of depTypes) {
          // Show basic view
          if (!showTreeView || type !== "default") {
            depHtml.append(`
              <section class="package-type type-${depType.toLowerCase()}">
                <h4>${typePlural[depType] || depType} (${grouped[depType].length})</h4>
                <ul>
                  ${grouped[depType].map((d) => `<li>${d.name}</li>`).join("")}
                </ul>
              </section>
            `);
          }

          // Sort dependencies into groups and show textures where possible
          else {
            const depTreeHtml = $(`
              <section class="package-type type-${depType.toLowerCase()}">
                <h4>${typePlural[depType] || depType} (${grouped[depType].length})</h4>
                <ul></ul>
              </section>
            `);
            const treeHtml = depTreeHtml.find("ul");

            const dependencyTree = createDependencyTree(dependencies, depType);
            const treeKeys = getSortedKeys(dependencyTree);

            for (const packageName of treeKeys) {
              const packageHtml = $(`
                <li class="package-li">
                  <p class="dep-package"><strong>${packageName}</strong></p>
                  <ul class="dep-groups"></ul>
                </li>
              `);

              const groupHtml = packageHtml.find(".dep-groups");

              const tree = dependencyTree[packageName];
              const groups = getSortedKeys(tree);

              if (depType !== "Music") {
                for (const groupName of groups) {
                  const deps = tree[groupName].naturalSort();
                  const depsList = $(`
                    <li>
                      <p class="dep-group">${groupName}</p>
                      <ul class="group-list"></ul>
                    </li>
                  `);

                  const groupList = depsList.find(".group-list");

                  for (const d of deps) {
                    const li = $(`
                      <li>
                        <p class="dep-name">${d}</p>
                      </li>
                    `);

                    if (depType === "Texture") {
                      const src = getTextureURL(packageName, groupName, d);
                      li.prepend(`<img src="${src}" />`);
                    }

                    groupList.append(li);
                  }

                  groupHtml.append(depsList);
                }
              }

              treeHtml.append(packageHtml);
            }

            depHtml.append(depTreeHtml);
          }
        }

        dependenciesTab.append(depHtml);
      }
    }

    $("[href='#tab-dependencies'] .count").text(`(${dependencies.length})`);
  }

  function groupDependenciesByType(dependencies) {
    const output = {};

    for (const d of dependencies) {
      const type = d.type || "Unknown";

      try {
        output[type].push(d);
      } catch (e) {
        output[type] = [d];
      }
    }

    for (const depType in output) {
      output[depType].sort(function (a, b) {
        return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
      });
    }

    return output;
  }

  function createDependencyTree(dependencies, dependencyType) {
    const packageNames = [];
    const tree = {};

    // Top level package names: e.g. Ancient, SkyCity
    for (const dependency of dependencies.packages.default) {
      if (dependency.type === dependencyType) {
        packageNames.push(dependency.name);
      }
    }

    // Build tree
    for (const object of utPackage.importTable) {
      const objectName = object.objectName;
      const className = object.className;

      // May be changed to "None" if object is ungrouped
      let packageName = object.packageName;

      // Child-level object
      if (className === dependencyType) {
        const parentName = object.uppermostPackageObjectName;

        if (!utPackage.isDefaultPackage(parentName)) {
          continue;
        }

        // Object has no group; add to "None"
        if (packageName === parentName) {
          packageName = "None";
        }

        // Object not yet in tree - add parent name first
        if (tree[parentName] === undefined) {
          tree[parentName] = {};
        }

        // Group not yet in parent object
        if (tree[parentName][packageName] === undefined) {
          tree[parentName][packageName] = [];
        }

        // Finally, append object
        tree[parentName][packageName].push(objectName);
      }

      // Teenage-level group object: Base, Floor, etc.
      else if (packageNames.includes(packageName)) {
        // Object not yet in tree - add parent name first
        if (tree[packageName] === undefined) {
          tree[packageName] = {};
        }

        // Group not yet in parent object
        if (tree[packageName][objectName] === undefined) {
          tree[packageName][objectName] = [];
        }
      }
    }

    return tree;
  }

  function getTextureURL(packageName, group, name) {
    const baseUrl = "https://bunnytrack.net/file-browser/files/textures-lower/";

    let fullUrl = baseUrl + packageName.toLowerCase() + "/";

    if (group !== "None") {
      fullUrl += group.toLowerCase() + "/";
    }

    fullUrl += name.toLowerCase() + ".png";

    return fullUrl;
  }

  // Show a texture's properties and palette in the sidebar
  function updateTextureSidebar(canvas, textureObject) {
    const sidebar = $("#tab-textures .sidebar");
    const table = sidebar.find(".texture-info tbody");

    // Set texture canvas
    const previewCanvas = sidebar.find(".selected-texture canvas");
    const context = previewCanvas[0].getContext("2d");

    previewCanvas.prop("width", canvas.width);
    previewCanvas.prop("height", canvas.height);

    context.drawImage(canvas, 0, 0);

    // Set palette canvas
    const paletteProp = textureObject.getProp("palette");
    const paletteObject = utPackage.getObject(paletteProp.value);
    const paletteCanvas = utPackage.getPaletteCanvas(paletteObject);
    const paletteWrapper = sidebar.find(".palette-wrapper");

    paletteWrapper.html(`<h4>Palette</h4>`).append(paletteCanvas);

    // Populate table with texture properties
    table.html("");

    const colourInfoHtml = (value, colour) => {
      const rgb = {
        r: 0,
        g: 0,
        b: 0,
      };

      rgb[colour] = value[colour];

      const square = `<div class="colour-square" style="background-color: rgb(${rgb.r}, ${rgb.g}, ${rgb.b});"></div>`;

      return `<div class="colour-row mono">${colour.toUpperCase()}: ${square} ${value[colour]}</div>`;
    };

    for (const prop of textureObject.properties) {
      let propHtml;

      switch (prop.type) {
        case "Object":
          continue; // only "Object" prop should be palette, which is already shown

        case "Struct": // should only be colour properties
          propHtml = `
            <td class="prop-val">
              <div class="colour-square wide" style="background-color: rgb(${prop.value.r}, ${prop.value.g}, ${prop.value.b});"></div>
              ${colourInfoHtml(prop.value, "r")}
              ${colourInfoHtml(prop.value, "g")}
              ${colourInfoHtml(prop.value, "b")}
            </td>
          `;
          break;

        default:
          propHtml = `<td class="prop-val">${prop.value}</td>`;
          break;
      }

      table.append(`
        <tr>
          <td class="prop-name">${prop.name}</td>
          ${propHtml}
        </tr>
      `);
    }
  }

  function populateTextBufferTable() {
    if (tabUnpopulated("scripts")) {
      if (tables.scripts) {
        tables.scripts.destroy();
        $("#tab-scripts .code-wrapper code").html("");
      }

      const scriptTable = $("#script-table");
      const textBuffers = utPackage.getTextBufferObjects();
      const tableData = [];

      for (const textBufferObject of textBuffers) {
        const data = textBufferObject.readData();
        const rowData = [
          textBufferObject.objectName,
          textBufferObject.packageName || "—",
          textBufferObject.packageObject?.parentObjectName || "—",
          data.size,
          data.size > 0 ? data.contents.trim() : "",
        ];

        tableData.push(rowData);
      }

      tables.scripts = scriptTable.DataTable({
        data: tableData,
        pageLength: 50,
        lengthMenu: [25, 50, 75, 100, 250, 500],
        columns: [
          null,
          null,
          null,
          { render: formatColumn((data) => readableFileSize(data)) },
        ],
      });

      // Show first text buffer's contents by default.
      const hasTextBuffers = textBuffers.length > 0;

      if (hasTextBuffers) {
        scriptTable.find("tbody tr:nth-of-type(1)").click();
      }

      $("#tab-scripts .code-wrapper").toggle(hasTextBuffers);
    }
  }

  function populateSoundsTab() {
    const sounds = utPackage.getSounds();

    if (tabUnpopulated("sounds")) {
      if (tables.sounds) {
        tables.sounds.destroy();
      }

      const tableData = [];

      for (const sound of sounds) {
        tableData.push([
          sound.name,
          sound.packageName || "—",
          sound.size,
          sound.format.toUpperCase(),
          sound.channels ?? "—",
          sound.sample_rate ?? "—",
          sound.bit_depth ?? "—",
          sound.byte_rate ?? "—",
          `
            <div class="audio-wrapper">
              <audio preload="none" controls></audio>
              <button class="audio-loader"></button>
            </div>
          `,
          sound,
        ]);
      }

      tables.sounds = $("#sounds-table").DataTable({
        data: tableData,
        order: [[1, "asc"]],
        pageLength: 25,
        lengthMenu: [25, 50, 75, 100, 250, 500],
        columns: [
          null,
          null,
          { render: formatColumn((data) => readableFileSize(data)) },
          null,
          null,
          { render: formatColumn((data) => `${data / 1000} kHz`, "—") },
          { render: formatColumn((data) => `${data}-bit`, "—") },
          {
            render: formatColumn(
              (data) => `${(Math.round(data) * 8) / 1000} kb/s`,
              "—",
            ),
          },
          {
            orderable: false,
          },
        ],
      });
    }
  }

  function loadScriptsSync(scriptsArray, onSuccess) {
    const allScriptsLoaded = scriptsArray.every((src) =>
      utLoadedScripts.includes(src),
    );

    if (allScriptsLoaded) {
      onSuccess();
    } else {
      const src = scriptsArray.shift();
      const thisScriptLoaded = utLoadedScripts.includes(src);
      const moreToLoad = scriptsArray.length > 0;

      if (thisScriptLoaded) {
        if (moreToLoad) {
          loadScriptsSync(scriptsArray, onSuccess);
        } else {
          onSuccess();
        }
      } else {
        $.getScript(src).always(function (_, textStatus) {
          if (textStatus === "success") {
            utLoadedScripts.push(src);

            if (moreToLoad) {
              loadScriptsSync(scriptsArray, onSuccess);
            } else {
              onSuccess();
            }
          } else {
            alert(`Failed to load script: ${src}`);
          }
        });
      }
    }
  }

  function loadThreeJs(callback) {
    $("body").addClass("loading-three-js");

    loadScriptsSync(
      ["js/three.min.js", "js/three-orbit-controls.js"],
      function () {
        $("body").removeClass("loading-three-js");
        callback();
      },
    );
  }

  function populateMusicTab() {
    const musicTab = $("#tab-music .inner");
    const embeddedMusic = utPackage.getMusicObjects();

    // "Lazy load" audio-related JavaScript libraries first
    if (embeddedMusic.length > 0 && !musicTab.hasClass("loaded-script-xmp")) {
      if (!musicTab.hasClass("loading")) {
        musicTab.addClass("loading");

        loadScriptsSync(
          [
            "js/jsmpeg.js",
            "js/mod-player/scriptprocessor_player.js",
            "js/mod-player/backend_xmp.js",
          ],
          function () {
            // All scripts loaded - initialise ScriptNodePlayer then call function again
            musicTab.addClass("loaded-script-xmp");

            const onPlayerReady = populateMusicTab;

            // Callbacks for mod-player (jsmpeg handled separately)
            const doOnTrackReadyToPlay = function () {};
            const doOnTrackEnd = function () {
              $(".toggle-playback[data-status='playing']").each(
                function (i, el) {
                  const $el = $(el);
                  const musicConfig = musicConfigStore[$el.attr("data-id")];

                  if (musicConfig.type === PLAYERS.MOD_PLAYER) {
                    $el.attr("data-status", "paused");
                    musicConfig.player.seekPlaybackPosition(0);
                  }
                },
              );
            };

            ScriptNodePlayer.createInstance(
              new XMPBackendAdapter(),
              "",
              [],
              true,
              onPlayerReady,
              doOnTrackReadyToPlay,
              doOnTrackEnd,
            );
          },
        );
      }
    }

    // Scripts already loaded - populate tab if new package
    else if (tabUnpopulated("music")) {
      // Reset
      musicTab.html("");

      if (embeddedMusic.length === 0) {
        musicTab.text("This package contains no embedded music.");
      } else {
        const tableRows = [];
        const table = $(`
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Title</th>
                <th>Player</th>
                <th>Size</th>
                <th>Format</th>
                <th>Audio</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        `);

        for (const musicObject of embeddedMusic) {
          const musicName = musicObject.objectName;
          const musicData = musicObject.readData();
          const formatUpper = musicData.format.toUpperCase();

          // Global reference to this player instance/music object - used for playback/download
          const id = `audio_${utPackage.header.guid}`;

          const onCompletion = function (player) {
            // Prevent auto-play
            player?.pause();

            // Basic track metadata
            const musicInfo = player?.getSongInfo() || {};

            tableRows.push(`
              <tr>
                <td>${musicName}</td>
                <td>${musicInfo.title || "—"}</td>
                <td>${musicInfo.player || "—"}</td>
                <td>${readableFileSize(musicObject.serial_size)}</td>
                <td>${formatUpper}</td>
                <td class="buttons">
                  <div data-id="${id}" class="toggle-playback" title="Click to toggle playback" data-status="paused"></div>
                  <div data-id="${id}" class="download" title="Click to download"></div>
                </td>
              </tr>
            `);

            // Populate table HTML when all music objects have been loaded
            if (tableRows.length === embeddedMusic.length) {
              table.find("tbody").html(tableRows.join(""));
              musicTab.append(table);
            }
          };

          if (musicConfigStore[id] !== undefined) {
            onCompletion(musicConfigStore[id].player);
          } else if (formatUpper === "MP2") {
            onCompletion(null);
            musicConfigStore[id] = {
              filename: `${musicName}.${musicData.format}`,
              data: musicData,
              player: null,
              playerType: PLAYERS.JSMPEG,
            };
          } else {
            const player = ScriptNodePlayer.getInstance();

            player.loadMusicFromTypedArray(
              `${musicName}.${musicData.format}`,
              musicData.audio_data,
              [],
              () => onCompletion(player),
              () => {},
              () => {},
            );

            musicConfigStore[id] = {
              filename: `${musicName}.${musicData.format}`,
              data: musicData,
              player: player,
              playerType: PLAYERS.MOD_PLAYER,
            };
          }
        }
      }

      $("[href='#tab-music'] .count").text(`(${embeddedMusic.length})`);
    }
  }

  function getThreeSetup(cameraWidth, cameraHeight) {
    return {
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(
        50,
        (cameraWidth || 1920) / (cameraHeight || 1080),
        0.1,
        0x10000,
      ),
      renderer: new THREE.WebGLRenderer(),
      geometry: new THREE.BufferGeometry(),
    };
  }

  function addBrushToGeometry(geometry, polygons) {
    const vertices = [];
    const faces = [];

    let f = 0; // reference to last face index

    for (const poly of polygons) {
      // Push vertices into geometry.
      // Swap Y/Z axes here; UT's Z-axis is height whereas Three.js's is Y.
      for (const vertex of poly.vertices) {
        vertices.push(vertex.x, vertex.z, vertex.y);
      }

      // UT seems to limit surfaces to 16 vertices before automatically triangulating.
      // WebGL only allows triangular surfaces, so check for/handle different vertex counts.
      const totalVertices = poly.vertices.length;

      // Quadrilaterals - just split into two triangles down the middle
      if (totalVertices === 4) {
        faces.push(f + 0, f + 1, f + 2);
        faces.push(f + 0, f + 3, f + 2);
      }

      // 5-16 vertices - calculate centre and create "fan" pattern
      else if (totalVertices >= 5 && totalVertices <= 16) {
        const centre = getPolyCentre(poly.vertices);

        vertices.push(centre.x, centre.z, centre.y);

        // Starting from the first vertex, create a triangular face using this vertex, the one after it, and the centre
        for (let i = 0; i < totalVertices; i++) {
          faces.push(
            f + i,
            f + (i + 1 === totalVertices ? 0 : i + 1),
            f + totalVertices,
          );
        }

        // Account for extra centre vertex
        f++;
      }

      // Anything else should already be triangulated by Unreal
      else {
        faces.push(f + 0, f + 1, f + 2);
      }

      f += poly.vertices.length;
    }

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setIndex(faces);
  }

  function drawMapView() {
    const mapViewTab = $("#tab-map-view .inner");

    if (!isLevel()) {
      mapViewTab.text("Map view unavailable for this package.");
    } else {
      const allBrushData = utPackage.getAllBrushData();

      const previewWidth = 1920;
      const previewHeight = 1080;

      const { scene, camera, renderer } = getThreeSetup(
        previewWidth,
        previewHeight,
      );

      for (const brush of allBrushData) {
        if (brush.polys.polygons !== undefined) {
          const geometry = new THREE.BufferGeometry();

          addBrushToGeometry(geometry, brush.polys.polygons);

          // Convert properties array to object for convenience
          const brushProps = {};
          brush.brush.properties.forEach(
            (p) => (brushProps[p.name.toLowerCase()] = p.value),
          );

          if (brushProps.prepivot) {
            geometry.translate(
              -brushProps.prepivot.x,
              -brushProps.prepivot.z,
              -brushProps.prepivot.y,
            );
          }

          // Set scaling
          if (brushProps.mainscale) {
            geometry.scale(
              brushProps.mainscale.x,
              brushProps.mainscale.z,
              brushProps.mainscale.y,
            );
          }

          const material = new THREE.MeshBasicMaterial({
            wireframe: true,
            transparent: true,
            opacity: 0.5,
            color: getLineColour(brush.brush.className, brush.brush.properties),
          });

          const mesh = new THREE.Mesh(geometry, material);

          // Set rotation
          if (brushProps.rotation) {
            mesh.rotation.order = "YZX";

            mesh.rotation.x = utRotationToRadians(brushProps.rotation.roll);
            mesh.rotation.y = -utRotationToRadians(brushProps.rotation.yaw);
            mesh.rotation.z = utRotationToRadians(brushProps.rotation.pitch);
          }

          if (brushProps.location) {
            mesh.position.x = brushProps.location.x;
            mesh.position.y = brushProps.location.z;
            mesh.position.z = brushProps.location.y;
          }

          if (brushProps.postscale) {
            mesh.scale.x = brushProps.postscale.x;
            mesh.scale.y = brushProps.postscale.z;
            mesh.scale.z = brushProps.postscale.y;
          }

          scene.add(mesh);
        }
      }

      const lights = utPackage.getObjectsByClass("Light");

      if (lights.length > 0) {
        const spriteMap = new THREE.TextureLoader().load("icons/s_light.png");
        const spriteMaterial = new THREE.SpriteMaterial({ map: spriteMap });

        for (const light of lights) {
          const props = light.properties;

          const propObj = {};
          props.forEach((p) => (propObj[p.name.toLowerCase()] = p.value));

          const sprite = new THREE.Sprite(spriteMaterial);

          const drawScale = propObj.drawscale || 1;

          sprite.scale.set(32 * drawScale, 32 * drawScale, 32 * drawScale);

          const location = propObj.location || { x: 0, y: 0, z: 0 };

          sprite.position.x = location.x;
          sprite.position.y = location.z;
          sprite.position.z = location.y;

          scene.add(sprite);
        }
      }

      camera.position.x = 0;
      camera.position.y = 1024;
      camera.position.z = 1024;

      const controls = new OrbitControls(camera, renderer.domElement);

      controls.maxDistance = 0x10000;
      controls.screenSpacePanning = true;

      scene.add(camera);

      scene.add(new THREE.AxesHelper(32));

      renderer.setSize(previewWidth, previewHeight);

      mapViewTab.html(renderer.domElement);

      const animate = () => {
        requestAnimationFrame(animate);

        controls.update();

        renderer.render(scene, camera);
      };

      animate();
    }
  }

  function populateBrushesTab() {
    const brushes = utPackage.getAllBrushObjects();
    const brushesTab = $("#tab-brushes .inner");

    if (!$("body").hasClass("loaded-script-three")) {
      // Three.js is loading - try again
      setTimeout(populateBrushesTab, 100);
    } else if (tabUnpopulated("brushes")) {
      if (tables.brushes) {
        tables.brushes.destroy();
      }

      if (brushes.length === 0) {
        brushesTab.text("This package contains no brushes.");
      } else {
        const brushNames = brushes
          .map(({ objectName }) => [objectName])
          .sort((a, b) =>
            a[0].localeCompare(b[0], undefined, { numeric: true }),
          );

        tables.brushes = $("#brush-table")
          .on("init.dt", function () {
            // Stupid hack to select first Brush in table
            const table = $(this);

            setTimeout(function () {
              table.find("tbody tr").eq(0).click();
            }, 0);
          })
          .DataTable({
            data: brushNames,
            ordering: false,
            pageLength: 25,
            lengthMenu: [25, 50, 75, 100, 250, 500],
          });
      }
    }
  }

  function getAllBrushInfo(brushName) {
    const brush = utPackage.getExportObjectByName(brushName);
    const brushData = utPackage.getBrushModelPolys(brush);
    const brushClass = brush.className;

    showBrushProperties($("#brush-details"), brushName, brush.properties);

    if (brushData.model.object !== undefined) {
      showModelProperties(
        $("#model-details"),
        brushData.model.object.objectName,
        brushData.model.properties,
      );

      if (brushData.polys.object !== undefined) {
        showPolyProperties(
          $("#poly-details"),
          brushData.polys.object.objectName,
          brushData.polys.polygons,
        );

        showBrushPreview(
          brushClass,
          brushData.brush.properties,
          brushData.model.properties,
          brushData.polys.polygons,
        );
      }
    }
  }

  function utRotationToRadians(rotation) {
    return (Math.PI * 2 * (rotation & 0xffff)) / 0x10000;
  }

  function getLineColour(brushClass, brushProperties) {
    if (utPackage.moverClasses.includes(brushClass)) return 0xff00ff;

    const props = {};

    brushProperties.forEach((p) => (props[p.name.toLowerCase()] = p.value));

    props.polyflags = utPackage.getPolyFlags(props.polyflags);

    if (props.polyflags.includes("PF_Semisolid")) return 0xdf959d;
    if (props.polyflags.includes("PF_NotSolid")) return 0x3fc020;

    if (props.csgoper !== undefined) {
      switch (utPackage.enumCsgOper[props.csgoper]) {
        case "CSG_Add":
          return 0x7f7fff;
        case "CSG_Subtract":
          return 0xffc03f;
        default:
          break;
      }
    }

    return 0xff4b4b;
  }

  function getPolyCentre(vertices) {
    const centre = {};

    for (const vertex of vertices) {
      centre.x = centre.x !== undefined ? centre.x + vertex.x : vertex.x;
      centre.y = centre.y !== undefined ? centre.y + vertex.y : vertex.y;
      centre.z = centre.z !== undefined ? centre.z + vertex.z : vertex.z;
    }

    centre.x /= vertices.length;
    centre.y /= vertices.length;
    centre.z /= vertices.length;

    return centre;
  }

  function showBrushPreview(
    brushClass,
    brushProperties,
    modelInfo,
    polysArray,
  ) {
    const previewArea = $("#brush-viewer");
    const previewWidth = 1280;
    const previewHeight = 720;

    const { scene, camera, renderer, geometry } = getThreeSetup(
      previewWidth,
      previewHeight,
    );

    // Generate wireframe brush from polys then add to the geometry
    addBrushToGeometry(geometry, polysArray);

    // Convert properties array to object for convenience
    const propObject = {};
    brushProperties.forEach(
      (p) => (propObject[p.name.toLowerCase()] = p.value),
    );

    // Set scaling
    if (propObject.mainscale) {
      geometry.scale(
        propObject.mainscale.x,
        propObject.mainscale.z,
        propObject.mainscale.y,
      );
    }

    geometry.center();

    const material = new THREE.MeshBasicMaterial({
      wireframe: true,
      transparent: true,
      opacity: 0.5,
      color: getLineColour(brushClass, brushProperties),
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Set rotation
    if (propObject.rotation) {
      mesh.rotation.order = "XZY";

      mesh.rotation.x = utRotationToRadians(propObject.rotation.pitch);
      mesh.rotation.y = utRotationToRadians(propObject.rotation.yaw);
      mesh.rotation.z = utRotationToRadians(propObject.rotation.roll);
    }

    scene.add(mesh);

    // Hack to try and adjust the camera zoom to fit the model
    const largestSide = Math.max(
      Math.abs(geometry.boundingBox.min.x) +
        Math.abs(geometry.boundingBox.max.x),
      Math.abs(geometry.boundingBox.min.y) +
        Math.abs(geometry.boundingBox.max.y),
      Math.abs(geometry.boundingBox.min.z) +
        Math.abs(geometry.boundingBox.max.z),
    );

    camera.far = Infinity;
    camera.position.z = largestSide * 1.2;

    const controls = new OrbitControls(camera, renderer.domElement);

    controls.autoRotate = true;
    controls.screenSpacePanning = true;

    scene.add(camera);

    scene.add(new THREE.AxesHelper(32));

    renderer.setSize(previewWidth, previewHeight);

    previewArea.html(renderer.domElement);

    const animate = () => {
      requestAnimationFrame(animate);

      controls.update();

      renderer.render(scene, camera);
    };

    animate();
  }

  function getFrameData(meshObject, meshData, animationSequence, frameNumber) {
    const frameData = {
      faces: [],
      vertices: [],
      uvs: [],
    };

    // Mesh or LodMesh - vertices are extracted slightly differently for each class
    const meshClass = utPackage.getObjectNameFromIndex(meshObject.class_index);

    // The mesh vertices array index of the first vertex used by this animation sequence
    const firstVertIndex =
      (animationSequence.start_frame + frameNumber) * meshData.frame_verts;

    if (meshClass === "Mesh") {
      let i = 0;

      for (const triangle of meshData.triangles) {
        const vertex1 =
          meshData.vertices[firstVertIndex + triangle.vertex_index_1];
        const vertex2 =
          meshData.vertices[firstVertIndex + triangle.vertex_index_2];
        const vertex3 =
          meshData.vertices[firstVertIndex + triangle.vertex_index_3];

        // Push vertices for this triangle - swap 3/2 so not drawn inside out
        frameData.vertices.push(
          vertex1.x,
          vertex1.z,
          vertex1.y,
          vertex3.x,
          vertex3.z,
          vertex3.y,
          vertex2.x,
          vertex2.z,
          vertex2.y,
        );

        frameData.uvs.push(
          triangle.vertex_1_u / 0xff,
          1 - triangle.vertex_1_v / 0xff,
          triangle.vertex_3_u / 0xff,
          1 - triangle.vertex_3_v / 0xff,
          triangle.vertex_2_u / 0xff,
          1 - triangle.vertex_2_v / 0xff,
        );

        frameData.faces.push(i++, i++, i++);
      }
    } else if (meshClass === "LodMesh") {
      for (let i = 0; i < meshData.special_vertices; i++) {
        let index = firstVertIndex + i;

        // TODO
        if (meshData.remap_anim_vertices.length > 0) debugger;

        const vertex = meshData.vertices[index];

        frameData.vertices.push(vertex.x, vertex.z, vertex.y);
        frameData.uvs.push(0, 0);
      }

      for (const wedge of meshData.wedges) {
        let index =
          firstVertIndex + meshData.special_vertices + wedge.vertex_index;

        if (meshData.remap_anim_vertices.length > 0) {
          index =
            firstVertIndex +
            meshData.remap_anim_vertices[
              meshData.special_vertices + wedge.vertex_index
            ];
        }

        const vertex = meshData.vertices[index];

        try {
          frameData.vertices.push(vertex.x, vertex.z, vertex.y);
        } catch (e) {
          // TODO: probably special vertices
          debugger;
        }

        frameData.uvs.push(wedge.s / 0xff, 1 - wedge.t / 0xff);
      }

      for (const face of meshData.faces) {
        try {
          frameData.faces.push(
            meshData.special_vertices + face.wedge_index_1,
            meshData.special_vertices + face.wedge_index_3,
            meshData.special_vertices + face.wedge_index_2,
          );
        } catch (e) {
          // TODO: probably special vertices
          debugger;
        }
      }

      for (const face of meshData.special_faces) {
        frameData.faces.push(
          face.wedge_index_1,
          face.wedge_index_3,
          face.wedge_index_2,
        );

        // TODO: special UVs
      }
    } else {
      alert(`Unable to read mesh data for class: ${meshClass}`);
    }

    return frameData;
  }

  function playAnimSequence(
    meshObject,
    meshData,
    animationSequence,
    frameNumber,
  ) {
    // Canvas size
    const previewWidth = 1120;
    const previewHeight = 630;

    // Three.js setup
    const { scene, camera, renderer, geometry } = getThreeSetup(
      previewWidth,
      previewHeight,
    );

    // Get vertices for each frame of this animation sequence
    const framesData = [];

    for (let i = 0; i < animationSequence.frame_count; i++) {
      framesData.push(getFrameData(meshObject, meshData, animationSequence, i));
    }

    // Draw first frame
    const firstFrame = framesData.shift();

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(firstFrame.vertices, 3),
    );
    geometry.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(firstFrame.uvs, 2),
    );
    geometry.setIndex(firstFrame.faces);

    geometry.morphAttributes.position = [];

    const geometryPositions = geometry.getAttribute("position");

    for (let i = 0; i < framesData.length; i++) {
      const frame = framesData[i];

      const morphTarget = geometryPositions.clone();

      morphTarget.name = `frame_${i + 1}`;
      morphTarget.array = new Float32Array(frame.vertices);

      geometry.morphAttributes.position.push(morphTarget);
    }

    const material = new THREE.MeshBasicMaterial({
      color: 0x996619,
      morphTargets: true,
      opacity: 0.95,
      transparent: true,
      wireframe: true,
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Create global variable to allow wireframe toggling
    currentMesh = mesh;

    // Try to load texture asynchronously
    if (meshData.textures.length > 0) {
      for (let texture of meshData.textures) {
        if (texture?.table === "export") {
          if (texture.className === "ScriptedTexture") {
            const sourceTextureIndex =
              texture.getProp("SourceTexture")?.value ?? null;

            if (sourceTextureIndex !== null) {
              const sourceTexture = utPackage.getObject(sourceTextureIndex);

              if (sourceTexture) {
                texture = sourceTexture;
              } else {
                continue;
              }
            }
          }

          const canvas = utPackage.textureToCanvas(texture);
          mesh.material = new THREE.MeshBasicMaterial({
            map: new THREE.CanvasTexture(canvas),
            side: THREE.DoubleSide,
            morphTargets: true,
          });

          break;
        }
      }
    }

    // Set rotation
    if (meshData.rotation_origin) {
      mesh.rotation.x = utRotationToRadians(meshData.rotation_origin.roll);
    }

    geometry.center();

    scene.add(mesh);

    // TODO: use bounding box here
    camera.position.x = 0;
    camera.position.y = 64;
    camera.position.z = 128;

    const controls = new OrbitControls(camera, renderer.domElement);

    controls.maxDistance = 0x10000;
    controls.autoRotate = true;
    controls.screenSpacePanning = true;

    scene.add(camera);

    renderer.setSize(previewWidth, previewHeight);

    $("#mesh-viewer .canvas-wrapper").html(renderer.domElement).append(`
            <div id="toggle-wireframe">Show wireframe</div>
            <div class="controls-info">
                <p><strong>Controls</strong></p>
                <p>Left click: rotate</p>
                <p>Right click: move</p>
                <p>Middle click: zoom</p>
            </div>
        `);

    const clip = THREE.AnimationClip.CreateFromMorphTargetSequence(
      animationSequence.name,
      geometry.morphAttributes.position,
      animationSequence.rate,
    );

    const mixer = new THREE.AnimationMixer(mesh);

    const action = mixer.clipAction(clip);
    action.play();

    const clock = new THREE.Clock();

    const animate = () => {
      requestAnimationFrame(animate);

      controls.update();

      mixer.update(clock.getDelta());

      renderer.render(scene, camera);
    };

    animate();
  }

  function showAnimSequenceFrame(
    meshObject,
    meshData,
    animationSequence,
    frameNumber,
  ) {
    // Canvas size
    const previewWidth = 1120;
    const previewHeight = 630;

    // Three.js setup
    const { scene, camera, renderer, geometry } = getThreeSetup(
      previewWidth,
      previewHeight,
    );
    const vertices = [];

    // Mesh or LodMesh - geometry is extracted slightly differently for each class
    const meshClass = utPackage.getObjectNameFromIndex(meshObject.class_index);

    // The mesh vertices array index of the first vertex used by this animation sequence
    const firstVertIndex =
      (animationSequence.start_frame + frameNumber) * meshData.frame_verts;

    // Reference to last face index
    let f = 0;

    if (meshClass === "Mesh") {
      for (const triangle of meshData.triangles) {
        const vertex1 =
          meshData.vertices[firstVertIndex + triangle.vertex_index_1];
        const vertex2 =
          meshData.vertices[firstVertIndex + triangle.vertex_index_2];
        const vertex3 =
          meshData.vertices[firstVertIndex + triangle.vertex_index_3];

        // Push vertices for this triangle
        vertices.push(
          vertex1.x,
          vertex1.z,
          vertex1.y,
          vertex2.x,
          vertex2.z,
          vertex2.y,
          vertex3.x,
          vertex3.z,
          vertex3.y,
        );
      }
    } else if (meshClass === "LodMesh") {
      // TODO: special_verts
      if (meshData.special_vertices > 0) debugger;

      for (const wedge of meshData.wedges) {
        const vertex =
          meshData.vertices[
            firstVertIndex + meshData.special_vertices + wedge.vertex_index
          ];
        vertices.push(vertex.x, vertex.z, vertex.y);
      }

      for (const face of meshData.faces) {
        geometry.faces.push(
          new THREE.Face3(
            meshData.special_vertices + face.wedge_index_1,
            meshData.special_vertices + face.wedge_index_2,
            meshData.special_vertices + face.wedge_index_3,
          ),
        );
      }
    } else {
      return alert(`Unable to read mesh data for class: ${meshClass}`);
    }

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(vertices), 3),
    );
    geometry.center();

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0x996619,
        morphTargets: true,
        opacity: 0.95,
        transparent: true,
        wireframe: true,
      }),
    );

    // Set rotation
    if (meshData.rotation_origin) {
      mesh.setRotationFromEuler(
        new THREE.Euler(
          utRotationToRadians(meshData.rotation_origin.roll),
          utRotationToRadians(meshData.rotation_origin.yaw),
          utRotationToRadians(meshData.rotation_origin.pitch),
        ),
      );
    }

    scene.add(mesh);

    camera.position.x = 0;
    camera.position.y = 64;
    camera.position.z = 128;

    const controls = new OrbitControls(camera, renderer.domElement);

    controls.maxDistance = 0x10000;
    controls.autoRotate = true;
    controls.screenSpacePanning = true;

    scene.add(camera);

    scene.add(new THREE.AxesHelper(32));

    renderer.setSize(previewWidth, previewHeight);

    $("#mesh-viewer .canvas-wrapper").html(renderer.domElement);

    const animate = () => {
      requestAnimationFrame(animate);

      controls.update();

      renderer.render(scene, camera);
    };

    animate();
  }

  function drawSkeletalMesh(meshObject, meshData) {
    // Canvas size
    const previewWidth = 1120;
    const previewHeight = 630;

    // Three.js setup
    const { scene, camera, renderer, geometry } = getThreeSetup(
      previewWidth,
      previewHeight,
    );

    const vertices = [];
    const faces = [];

    for (const wedge of meshData.wedges) {
      const vertex = meshData.points[wedge.vertex_index];

      vertices.push(vertex.x, vertex.z, vertex.y);
    }

    for (const face of meshData.faces) {
      faces.push(face.wedge_index_1, face.wedge_index_2, face.wedge_index_3);
    }

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setIndex(faces);

    geometry.center();

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0x996619,
        opacity: 0.95,
        transparent: true,
        wireframe: true,
      }),
    );

    // Set rotation
    if (meshData.rotation_origin) {
      mesh.setRotationFromEuler(
        new THREE.Euler(
          utRotationToRadians(meshData.rotation_origin.roll),
          utRotationToRadians(meshData.rotation_origin.yaw),
          utRotationToRadians(meshData.rotation_origin.pitch),
        ),
      );
    }

    scene.add(mesh);

    camera.position.x = 0;
    camera.position.y = 64;
    camera.position.z = 128;

    const controls = new OrbitControls(camera, renderer.domElement);

    controls.maxDistance = 0x10000;
    controls.autoRotate = true;
    controls.screenSpacePanning = true;

    scene.add(camera);

    scene.add(new THREE.AxesHelper(32));

    renderer.setSize(previewWidth, previewHeight);

    $("#mesh-viewer .canvas-wrapper").html(renderer.domElement);

    const animate = () => {
      requestAnimationFrame(animate);

      controls.update();

      renderer.render(scene, camera);
    };

    animate();
  }

  function populateAnimSequencesTable(meshObject) {
    if (tables.animations) {
      tables.animations.destroy();
    }

    const meshClass = utPackage.getObjectNameFromIndex(meshObject.class_index);
    const meshData = meshObject.readData();

    $(".anim-sequences-wrapper h3 .count").text(
      `(${meshData.anim_sequences.length})`,
    );

    const animTable = $("#anim-sequences-table");

    const animTableData = [];

    for (let i = 0; i < meshData.anim_sequences.length; i++) {
      const anim = meshData.anim_sequences[i];

      animTableData.push([
        i + 1,
        anim.name,
        anim.group,
        anim.start_frame,
        anim.frame_count,
        anim.rate,
        meshObject,
        meshData,
      ]);
    }

    tables.animations = animTable.DataTable({
      data: animTableData,
      pageLength: 25,
      lengthMenu: [25, 50, 75, 100, 250, 500],
    });

    // Skeletal meshes do not appear to ever have animations (they're stored separately)
    if (meshClass === "SkeletalMesh") {
      drawSkeletalMesh(meshObject, meshData);
    } else if (meshData.anim_sequences.length > 0) {
      // Show 2nd sequence if possible, as showing "All" straight away looks a bit confusing
      // and is also currently not great for performance.
      const sequence = meshData.anim_sequences.length === 1 ? 1 : 2;
      animTable.find(`tbody tr:nth-of-type(${sequence})`).click();
    }
  }

  function showPolyProperties(parentEl, objectName, polysArray) {
    const propLabels = {
      actor: "Actor",
      brush_poly: "BrushPoly",
      flags: "Flags",
      item_name: "ItemName",
      link: "Link",
      normal: "Normal",
      origin: "Origin",
      pan_u: "PanU",
      pan_v: "PanV",
      texture: "Texture",
      texture_u: "TextureU",
      texture_v: "TextureV",
      vertices: "Vertices",
      vertex_count: "VertexCount",
    };

    parentEl.html("").append(`
            <h3>Polys (${polysArray.length})</h3>

            <section>
                <p class="property mono object-name">
                    <span class="name">Name</span>
                    <span class="value">${objectName}</span>
                </p>
            </section>
        `);

    for (let i = 0; i < polysArray.length; i++) {
      const poly = polysArray[i];

      const polyEl = $(`
                <section class="struct${i === 0 ? " open" : ""} poly-node">
                    <p class="struct-name poly-num mono">
                        <span class="toggle">${i === 0 ? "-" : "+"}</span>
                        Polys[${i}]
                    </p>
                </section>
            `);

      for (const propName in poly) {
        let propValue = poly[propName];

        switch (propName) {
          case "origin":
          case "normal":
          case "texture_u":
          case "texture_v":
          case "vertices":
            if (propName === "vertices") {
              for (let j = 0; j < propValue.length; j++) {
                const vertex = propValue[j];

                polyEl.append(`
                  <section class="struct" data-type="vector">
                    <p class="struct-name mono">Vertices[${j}]</p>

                    <p class="property mono">
                      <span class="name">X</span>
                      <span class="value">${vertex.x}</span>
                    </p>
                    <p class="property mono">
                      <span class="name">Y</span>
                      <span class="value">${vertex.y}</span>
                    </p>
                    <p class="property mono">
                      <span class="name">Z</span>
                      <span class="value">${vertex.z}</span>
                    </p>
                  </section>
                `);
              }
            } else {
              polyEl.append(`
                <section class="struct" data-type="vector">
                  <p class="struct-name mono">${propLabels[propName] || propName}</p>

                  <p class="property mono">
                    <span class="name">X</span>
                    <span class="value">${propValue.x}</span>
                  </p>
                  <p class="property mono">
                    <span class="name">Y</span>
                    <span class="value">${propValue.y}</span>
                  </p>
                  <p class="property mono">
                    <span class="name">Z</span>
                    <span class="value">${propValue.z}</span>
                  </p>
                </section>
              `);
            }
            break;

          case "flags":
            if (propValue > 0) {
              polyEl.append(`
                <section class="struct">
                  <p class="array-name mono">PolyFlags</p>

                  <section class="array-items">
                    ${utPackage
                      .getPolyFlags(propValue)
                      .map(
                        (flag) => `
                          <p class="property mono">
                            <span class="value">${flag}</span>
                          </p>
                        `,
                      )
                      .join("")}
                  </section>
                </section>
              `);
            }
            break;

          case "actor":
          case "brush_poly":
          case "texture":
            polyEl.append(`
              <p class="property mono">
                <span class="name">${propLabels[propName] || propName}</span>
                <span class="value">${utPackage.getObjectNameFromIndex(propValue)}</span>
              </p>
            `);
            break;

          default:
            polyEl.append(`
              <p class="property mono">
                <span class="name">${propLabels[propName] || propName}</span>
                <span class="value">${propValue}</span>
              </p>
            `);
            break;
        }
      }

      parentEl.append(polyEl);
    }
  }

  function showModelProperties(parentEl, objectName, properties) {
    const propLabels = {
      bounding_box: "BoundingBox",
      bounding_sphere: "BoundingSphere",
      bounds: "Bounds",
      leaf_hulls: "LeafHulls",
      leaves: "Leaves",
      light_bits: "LightBits",
      light_map: "LightMap",
      lights: "Lights",
      linked: "Linked",
      nodes: "Nodes",
      points: "Points",
      polys: "Polys",
      root_outside: "RootOutside",
      shared_sides: "SharedSides",
      surfaces: "Surfaces",
      vectors: "Vectors",
      vertices: "Vertices",
      zones: "Zones",
    };

    parentEl.html("").append(`
            <h3>Model</h3>

            <section>
                <p class="property mono">
                    <span class="name">Name</span>
                    <span class="value">${objectName}</span>
                </p>
            </section>
        `);

    for (const propName in properties) {
      let propValue = properties[propName];

      switch (propName) {
        case "polys":
          propValue = utPackage.getObjectNameFromIndex(propValue);
          break;

        case "name":
          continue;

        default:
          break;
      }

      const propEl = $("<section />");

      if (Array.isArray(propValue)) {
        // TODO
        continue;
      } else if (typeof propValue === "object") {
        switch (propName) {
          case "bounding_box":
          case "bounding_sphere":
            propEl
              .addClass("struct")
              .append(
                `<p class="struct-name mono">${propLabels[propName] || propName}</p>`,
              );

            if (propName === "bounding_box") {
              propEl.append(`
                                <section class="struct" data-type="vector">
                                    <p class="struct-name mono">Min</p>

                                    <p class="property mono">
                                        <span class="name">X</span>
                                        <span class="value">${propValue.min.x}</span>
                                    </p>
                                    <p class="property mono">
                                        <span class="name">Y</span>
                                        <span class="value">${propValue.min.y}</span>
                                    </p>
                                    <p class="property mono">
                                        <span class="name">Z</span>
                                        <span class="value">${propValue.min.z}</span>
                                    </p>
                                </section>

                                <section class="struct" data-type="vector">
                                    <p class="struct-name mono">Max</p>

                                    <p class="property mono">
                                        <span class="name">X</span>
                                        <span class="value">${propValue.max.x}</span>
                                    </p>
                                    <p class="property mono">
                                        <span class="name">Y</span>
                                        <span class="value">${propValue.max.y}</span>
                                    </p>
                                    <p class="property mono">
                                        <span class="name">Z</span>
                                        <span class="value">${propValue.max.z}</span>
                                    </p>
                                </section>

                                <p class="property mono">
                                    <span class="name">Valid</span>
                                    <span class="value">${propValue.valid}</span>
                                </p>
                            `);
            } else {
              propEl.append(`
                                <section class="struct" data-type="vector">
                                    <p class="struct-name mono">Centre</p>

                                    <p class="property mono">
                                        <span class="name">X</span>
                                        <span class="value">${propValue.centre.x}</span>
                                    </p>
                                    <p class="property mono">
                                        <span class="name">Y</span>
                                        <span class="value">${propValue.centre.y}</span>
                                    </p>
                                    <p class="property mono">
                                        <span class="name">Z</span>
                                        <span class="value">${propValue.centre.z}</span>
                                    </p>
                                </section>

                                <p class="property mono">
                                    <span class="name">Radius</span>
                                    <span class="value">${propValue.radius}</span>
                                </p>
                            `);
            }
            break;

          default:
            break;
        }
      } else {
        propEl.append(`
                    <p class="property mono">
                        <span class="name">${propLabels[propName] || propName}</span>
                        <span class="value">${propValue}</span>
                    </p>
                `);
      }

      parentEl.append(propEl);
    }
  }

  function showBrushProperties(parentEl, objectName, properties) {
    properties = properties.sort(
      (a, b) => a.name.toLowerCase() > b.name.toLowerCase(),
    );

    const propLabels = {
      i_leaf: "iLeaf",
      sheer_axis: "SheerAxis",
      sheer_rate: "SheerRate",
      zone: "Zone",
      zone_number: "ZoneNumber",
    };

    parentEl.html("").append(`
      <h3>Brush</h3>

      <section>
        <p class="property mono">
          <span class="name">Name</span>
          <span class="value">${objectName}</span>
        </p>
      </section>
    `);

    for (const prop of properties) {
      const propEl = $("<section />");

      let propValue = prop.value;

      switch (prop.name.toLowerCase()) {
        // Change certain values to something more readable (e.g. an index to a readable name)
        case "brush":
        case "closedsound":
        case "moveambientsound":
        case "openedsound":
          propValue = utPackage.getObjectNameFromIndex(propValue);
          break;

        case "bumptype":
          propValue = utPackage.enumBumpType[propValue];
          break;

        case "moverencroachtype":
          propValue = utPackage.enumMoverEncroachType[propValue];
          break;

        case "moverglidetype":
          propValue = utPackage.enumMoverGlideType[propValue];
          break;

        case "csgoper":
          propValue = utPackage.enumCsgOper[propValue];
          break;

        // Ignore these properties
        case "level":
          continue;

        default:
          break;
      }

      // Struct properties
      if (prop.type !== undefined && prop.type.toLowerCase() === "struct") {
        propEl.append(`<p class="struct-name mono">${prop.name}</p>`);

        const structEl = $(`
          <section class="struct" data-type="${prop.subtype.toLowerCase()}">
            <p class="struct-name mono">${prop.subtype}</p>
          </section>
        `);

        for (const propName in propValue) {
          let subPropValue = propValue[propName];

          switch (propName.toLowerCase()) {
            case "sheer_axis":
              subPropValue = utPackage.enumSheerAxis[subPropValue];
              break;

            case "zone":
              subPropValue = utPackage.getObjectNameFromIndex(subPropValue);
              break;

            default:
              break;
          }

          structEl.append(`
            <p class="property mono">
              <span class="name">${propLabels[propName] || propName}</span>
              <span class="value">${subPropValue}</span>
            </p>
          `);
        }

        propEl.append(structEl);
      }

      // Polyflags
      else if (prop.name.toLowerCase() === "polyflags") {
        propEl.addClass("array").append(`
          <p class="array-name mono">PolyFlags</p>

          <section class="array-items">
            ${utPackage
              .getPolyFlags(propValue)
              .map(
                (flag) => `
                  <p class="property mono">
                    <span class="value">${flag}</span>
                  </p>
                `,
              )
              .join("")}
          </section>
        `);
      }

      // Regular single properties
      else {
        propEl.append(`
          <p class="property mono">
            <span class="name">${prop.name}</span>
            <span class="value">${propValue}</span>
          </p>
        `);
      }

      parentEl.append(propEl);
    }
  }

  function createPackageTables() {
    if (tabUnpopulated("tables")) {
      if (tables.import && tables.export) {
        tables.import.destroy();
        tables.export.destroy();
      }

      const importTableData = [];
      const exportTableData = [];

      let i = 1;

      for (const object of utPackage.importTable) {
        importTableData.push([
          i++,
          object.objectName,
          object.packageName || "—",
          object.className,
          object.classPackageName,
        ]);
      }

      i = 1;

      for (const object of utPackage.exportTable) {
        if (object.serial_offset !== undefined) {
          exportTableData.push([
            i++,
            object.objectName,
            object.className || "MyLevel",
            object.parentObjectName || "—",
            object.packageName || "—",
            object.serial_offset,
            object.serial_size,
          ]);
        }
      }

      tables.import = $("#import-table").DataTable({
        data: importTableData,
        pageLength: 25,
        lengthMenu: [25, 50, 75, 100, 250, 500],
      });

      tables.export = $("#export-table").DataTable({
        data: exportTableData,
        pageLength: 25,
        lengthMenu: [25, 50, 75, 100, 250, 500],
        columns: [
          null,
          null,
          null,
          null,
          null,
          {
            createdCell: function (
              cell,
              cellData,
              rowData,
              rowIndex,
              colIndex,
            ) {
              cell.classList.add("mono");
            },
            render: formatColumn(
              (data) => `0x${data.toString(16).toUpperCase()}`,
            ),
          },
          { render: formatColumn((data) => readableFileSize(data)) },
        ],
      });
    }
  }

  // Some tabs are not populated on page load as these can be fairly resource intensive (e.g. textures),
  // so process their respective contents here, only when activated.
  function processTabAction(action) {
    switch (action) {
      case "textures":
        populateTexturesTab();
        break;

      case "sounds":
        populateSoundsTab();
        break;

      case "music":
        populateMusicTab();
        break;

      case "scripts":
        populateTextBufferTable();
        break;

      case "models":
        if (!$("body").hasClass("loaded-script-three")) {
          loadThreeJs(function () {
            $("body").addClass("loaded-script-three");
            $("[href='#tab-brushes']").click();
          });
        } else {
          $("[href='#tab-brushes']").click();
        }
        break;

      case "brushes":
        populateBrushesTab();
        break;

      case "meshes":
        populateMeshesTab();
        break;

      case "map-view":
        drawMapView();
        break;

      case "package-tables":
        createPackageTables();
        break;
    }
  }

  function populateMeshesTab() {
    const meshObjects = utPackage.getAllMeshObjects();

    $("[href='#tab-meshes'] .count").text(`(${meshObjects.length})`);

    if (!$("body").hasClass("loaded-script-three")) {
      // Three.js is loading - try again
      setTimeout(populateMeshesTab, 100);
    } else if (tabUnpopulated("meshes")) {
      if (tables.meshes) {
        tables.meshes.destroy();
      }

      const meshTableData = [];

      for (let i = 0; i < meshObjects.length; i++) {
        const meshObject = meshObjects[i];

        meshTableData.push([
          i + 1,
          meshObject.objectName,
          utPackage.getObjectNameFromIndex(meshObject.class_index),
          meshObject.serial_size,
          meshObject,
        ]);
      }

      tables.meshes = $("#mesh-table").DataTable({
        data: meshTableData,
        pageLength: 25,
        lengthMenu: [25, 50, 75, 100, 250, 500],
        columns: [
          null,
          null,
          null,
          { render: formatColumn((data) => readableFileSize(data)) },
        ],
      });

      const hasMeshes = meshObjects.length > 0;

      if (hasMeshes) {
        $("#mesh-table tbody tr:nth-of-type(1)").click();
      }

      $(".anim-sequences-wrapper, #mesh-viewer").toggle(hasMeshes);
    }
  }

  function getCurrentMesh() {
    const rowData = tables.animations
      .row($("#anim-sequences-table tbody .selected"))
      .data();

    // Mesh export table object
    const meshObject = rowData[rowData.length - 2];

    // All data for this mesh
    const meshData = rowData[rowData.length - 1];

    // Selected animation sequence index
    const sequenceIndex = rowData[0] - 1;

    // Data for the selected animation sequence of this mesh (frame count, sequence name, etc.)
    const animSeqData = meshData.anim_sequences[sequenceIndex];

    return {
      mesh_object: meshObject,
      mesh_data: meshData,
      anim_seq_data: animSeqData,
    };
  }

  // Create tabs for package contents
  function loadTabs() {
    $(".tabs").tabs({
      activate: function (event, ui) {
        processTabAction(ui.newTab.find("[data-action]").attr("data-action"));
      },
      create: function (event, ui) {
        processTabAction(ui.tab.find("[data-action]").attr("data-action"));
      },
    });

    $("body").addClass("tabs-loaded");
  }

  // Called once on page load to add event listeners, etc.
  function initialisePage() {
    // Dependencies tab - toggle tree view
    $("#tab-dependencies").on("click", "[name='dependency-view']", function () {
      createDependenciesTable(this.value === "tree");
    });

    $("#tab-textures").on("click", ".texture canvas", function () {
      const wrapper = $(this).parents(".texture");
      const textureObject = wrapper.data("texture");

      $(".texture.selected").removeClass("selected");

      wrapper.addClass("selected");

      updateTextureSidebar(this, textureObject);
    });

    // Sounds tab - lazy load sfx files
    $("#sounds-table tbody").on("click", ".audio-loader", function () {
      const $loaderBtn = $(this);
      const $td = $loaderBtn.parents("td");
      const audio = $td.find("audio")[0];
      const rowData = tables.sounds.row($td).data();
      const sound = rowData[rowData.length - 1];

      if (isSupportedSoundFormat(sound?.format)) {
        const playAudioFn = function (format) {
          let audioData = packageArrayBuffer.slice(
            sound.audio_offset,
            sound.audio_offset + sound.size,
          );

          if (format === SOUND_FORMATS.MP2) {
            audioData = decodeMp2ToWavBuffer(audioData);
          } else if (format === SOUND_FORMATS.XA) {
            const rawXaBytes = new Uint8Array(audioData);
            const samples = decodeEAXAMono(rawXaBytes);
            audioData = buildWavFile(samples, sound);
          }

          const audioBlob = new Blob([audioData], {
            type: "audio/wav",
          });

          audio.src = URL.createObjectURL(audioBlob);
          audio.load();
          audio.play();
          $loaderBtn.remove();
        };

        const format = sound.format.toUpperCase();

        if (format === SOUND_FORMATS.MP2) {
          loadScriptsSync(["js/jsmpeg.js"], () => playAudioFn(format));
        } else {
          playAudioFn(format);
        }
      } else {
        $loaderBtn
          .parents(".audio-wrapper")
          .replaceWith(`<p class="error-text">Unknown format</p>`);
      }
    });

    // Music tab - playback control
    $("#tab-music").on("click", ".toggle-playback", function () {
      const button = $(this);

      if (button.hasClass("loading")) return;

      const musicConfig = musicConfigStore[button.attr("data-id")];

      if (
        musicConfig.playerType === PLAYERS.JSMPEG &&
        musicConfig.player === null
      ) {
        button.addClass("loading");
        button.attr("data-status", "playing");

        createMP2Player(musicConfig.data.audio_data, (player) => {
          musicConfig.player = player;
          musicConfig.player.onEnded = async () => {
            button.attr("data-status", "paused");
            await musicConfig.player.restart();
            await musicConfig.player.pause();
          };
          button.removeClass("loading");
        });
      } else if (
        musicConfig.playerType === PLAYERS.MOD_PLAYER ||
        musicConfig.playerType === PLAYERS.JSMPEG
      ) {
        const { player } = musicConfig;

        if (player.isPaused()) {
          player.resume();
          button.attr("data-status", "playing");
        } else {
          player.pause();
          button.attr("data-status", "paused");
        }
      } else {
        alert(`Unknown player type: ${musicConfig.playerType}`);
      }
    });

    // Music tab - download music file
    $("#tab-music").on("click", ".download", function () {
      const musicData = musicConfigStore[$(this).attr("data-id")];
      const audioBlobUrl = URL.createObjectURL(
        new Blob([musicData.data.audio_data], {
          type: "application/octet-stream",
        }),
      );
      const tempLink = $("<a />", {
        download: musicData.filename,
        href: audioBlobUrl,
      });

      tempLink[0].click();
    });

    // Scripts tab - show text buffer contents/add syntax highlighting.
    $("#tab-scripts").on("click", "tbody tr", function () {
      const tableRow = $(this);

      $("#tab-scripts tr.selected").removeClass("selected");
      tableRow.addClass("selected");

      const codeBlock = $("#tab-scripts").find("code");

      const scriptContents = tables.scripts.row(this).data()[4];

      codeBlock.text(scriptContents);

      hljs.highlightBlock(codeBlock[0]);
    });

    // Meshes tab - process selected mesh from table
    $("#mesh-table tbody").on("click", "tr", function () {
      $("#mesh-table tbody .selected").removeClass("selected");

      $(this).addClass("selected");

      const meshObject = tables.meshes.row(this).data()[4];

      // Populate animation sequences table for this mesh
      populateAnimSequencesTable(meshObject);
    });

    // Meshes tab - process selected mesh's animation sequence from table
    $("#anim-sequences-table tbody").on("click", "tr", function () {
      $("#anim-sequences-table tbody .selected").removeClass("selected");

      $(this).addClass("selected");

      const mesh = getCurrentMesh();

      // Playback controls
      const inputs = $(
        "#mesh-viewer .frame-slider, #mesh-viewer .frame-counter",
      );

      // Update max frame #
      inputs.val(0).attr("max", mesh.anim_seq_data.frame_count - 1);

      // Disable if only one frame (more of a visual indication for the user that this isn't animated)
      inputs.attr("disabled", mesh.anim_seq_data.frame_count === 1);
      inputs.attr(
        "title",
        mesh.anim_seq_data.frame_count === 1
          ? "This sequence only contains one frame"
          : "",
      );

      // Show first frame of sequence
      playAnimSequence(mesh.mesh_object, mesh.mesh_data, mesh.anim_seq_data, 0);
      // showAnimSequenceFrame(mesh.mesh_object, mesh.mesh_data, mesh.anim_seq_data, 0);
    });

    // Meshes tab - animation frames controlled by range input
    $("#mesh-viewer .frame-slider").on("input", function () {
      $("#mesh-viewer .frame-counter").val(this.value);
    });

    // Meshes tab - animation frames controlled by number input
    $("#mesh-viewer .frame-counter").on("input", function () {
      $("#mesh-viewer .frame-slider").val(this.value);
    });

    // Meshes tab - frame control via any input with this class
    $("#mesh-viewer .frame-control").on("input", function () {
      const frame = parseInt(this.value);
      const mesh = getCurrentMesh();

      if (frame >= 0 && frame < mesh.anim_seq_data.frame_count) {
        showAnimSequenceFrame(
          mesh.mesh_object,
          mesh.mesh_data,
          mesh.anim_seq_data,
          frame,
        );
      }
    });

    // Meshes tab - toggle wireframe for models
    $("body").on("click", "#toggle-wireframe", function () {
      if (currentMesh) {
        // TODO
        if (currentMesh.material.wireframe) {
        } else {
          currentMesh.material = new THREE.MeshBasicMaterial({
            morphTargets: true,
            wireframe: true,
            color: 0x996619,
          });
        }
      }
    });

    // Brushes tab - process selected brush from table
    $("#brush-table tbody").on("click", "tr", function () {
      $("#brush-table tbody .selected").removeClass("selected");

      $(this).addClass("selected");

      const brushName = tables.brushes.row(this).data()[0];

      getAllBrushInfo(brushName);
    });

    // Brushes tab - show/collapse poly info on click
    $("#poly-details").on("click", ".poly-num", function () {
      const parent = $(this).parents(".poly-node");

      parent.toggleClass("open");

      $(this)
        .find(".toggle")
        .text(parent.hasClass("open") ? "-" : "+");
    });

    // Add event listeners for drag events.
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("dragleave", handleDragCancel);
    document.addEventListener("dragend", handleDragCancel);
    document.addEventListener("drop", handleDrop);

    function handleDragOver(e) {
      e.preventDefault();

      if (!$("body").is(".dragging-file")) {
        $("body").addClass("dragging-file");
        $(".file-input-wrapper p").text("Drop file anywhere to begin");
      }
    }

    function handleDragCancel(e) {
      e.preventDefault();

      if ($("body").is(".dragging-file")) {
        $("body").removeClass("dragging-file");
        $(".file-input-wrapper p").text("Drag file anywhere to begin");
      }
    }

    function handleDrop(e) {
      e.preventDefault();

      $("body").removeClass("dragging-file");
      fileInput.prop("files", e.dataTransfer.files).trigger("input");
    }
  }

  function noScreenshotAvailable() {
    const canvas = $(".screenshot canvas")[0];
    const context = canvas.getContext("2d");
    const x = canvas.width / 2;
    const y = canvas.height / 2;

    // Reset
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    context.fillStyle = "black";
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Text
    context.font = "60px Segoe UI";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "white";
    context.fillText("N/A", x, y);
  }

  /**
   * Misc / helper functions
   */
  Array.prototype.naturalSort = function () {
    return this.sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
  };

  function formatColumn(formatter, placeholder = null) {
    return function (data, type, row, meta) {
      if (type !== "display" || data === placeholder) {
        return data;
      }
      return formatter(data);
    };
  }

  function getSortedKeys(object) {
    return Object.keys(object).naturalSort();
  }

  // Slightly modified from https://stackoverflow.com/a/14919494/7290573
  function readableFileSize(bytes) {
    const thresh = 1024;

    if (Math.abs(bytes) < thresh) {
      return bytes + " B";
    }

    const units = ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    let u = -1;

    do {
      bytes /= thresh;
      ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);

    return bytes.toFixed(1) + " " + units[u];
  }

  const EA_XA_TABLE = [
    0, 240, 460, 392, 0, 0, -208, -220, 0, 1, 3, 4, 7, 8, 10, 11, 0, -1, -3, -4,
  ];

  function clamp16(v) {
    return v > 0x7fff ? 0x7fff : v < -0x8000 ? -0x8000 : v;
  }

  // Ported from https://github.com/vgmstream/vgmstream/blob/master/src/coding/ea_xa_decoder.c
  function decodeEAXAMono(data) {
    const out = [];
    let hist1 = 0;
    let hist2 = 0;

    for (let blockStart = 0; blockStart + 15 <= data.length; blockStart += 15) {
      const header = data[blockStart];
      const index = (header >> 4) & 0x0f;
      const coef1 = EA_XA_TABLE[index];
      const coef2 = EA_XA_TABLE[index + 4];
      const shift = (header & 0x0f) + 8;

      for (let i = 0; i < 28; i++) {
        const byteOffset = blockStart + 1 + Math.floor(i / 2);
        const highFirst = i % 2 === 0;
        const byte = data[byteOffset];
        const nibble = highFirst ? (byte >> 4) & 0x0f : byte & 0x0f;

        let sample = (nibble << 28) >> shift;
        sample = (sample + coef1 * hist1 + coef2 * hist2 + 128) >> 8;
        sample = clamp16(sample);

        hist2 = hist1;
        hist1 = sample;
        out.push(sample);
      }
    }

    return out;
  }

  function buildWavFile(samples, sound) {
    const sampleRate = sound.sample_rate;
    const channels = sound.channels;
    const bitDepth = sound.bit_depth;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, "WAVE");

    // fmt chunk
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // data chunk
    writeString(view, 36, "data");
    view.setUint32(40, dataSize, true);

    for (let i = 0; i < samples.length; i++) {
      view.setInt16(44 + i * 2, samples[i], true);
    }

    return buffer;
  }

  function writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  function decodeMp2ToWavBuffer(arrayBuffer) {
    const leftChunks = [];
    const rightChunks = [];
    let sampleRate = 44100;

    const collector = {
      play(sr, left, right) {
        sampleRate = sr;
        leftChunks.push(left.slice());
        rightChunks.push(right.slice());
      },
    };

    const decoder = new JSMpeg.Decoder.MP2Audio({});
    decoder.connect(collector);

    const bytes = new Uint8Array(arrayBuffer);
    for (let offset = 0; offset < bytes.length; offset += 0x10000) {
      decoder.write(0, [bytes.subarray(offset, offset + 0x10000)]);
    }
    while (decoder.decode()) {}

    const totalFrames = leftChunks.reduce((sum, c) => sum + c.length, 0);
    const samples = new Int16Array(totalFrames * 2);

    let pos = 0;
    for (let i = 0; i < leftChunks.length; i++) {
      const left = leftChunks[i],
        right = rightChunks[i];
      for (let j = 0; j < left.length; j++) {
        const l = Math.max(-1, Math.min(1, left[j]));
        const r = Math.max(-1, Math.min(1, right[j]));
        samples[pos++] = l < 0 ? l * 0x8000 : l * 0x7fff;
        samples[pos++] = r < 0 ? r * 0x8000 : r * 0x7fff;
      }
    }

    return buildWavFile(samples, {
      sample_rate: sampleRate,
      channels: 2,
      bit_depth: 16,
    });
  }

  class MP2Player {
    constructor(arrayBuffer) {
      this.arrayBuffer = arrayBuffer;
      this.audioOut = null;
      this.decoder = null;
      this.paused = true;
      this.endTime = null;
      this._watcherId = null;
      this.onEnded = null;
    }

    async _init() {
      this.audioOut = new JSMpeg.AudioOutput.WebAudio({});
      this.decoder = new JSMpeg.Decoder.MP2Audio({});
      this.decoder.connect(this.audioOut);

      await this.audioOut.context.resume();

      const bytes = new Uint8Array(this.arrayBuffer);
      for (let offset = 0; offset < bytes.length; offset += 0x10000) {
        this.decoder.write(0, [bytes.subarray(offset, offset + 0x10000)]);
      }

      const FRAMES_PER_BATCH = 30;
      let more = true;
      while (more) {
        for (let i = 0; i < FRAMES_PER_BATCH && more; i++) {
          more = this.decoder.decode();
        }
        if (more) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      this.paused = false;
      this.endTime = this.audioOut.startTime;
      this._watchForEnd();
    }

    async resume() {
      await this.audioOut.context.resume();
      this.paused = false;
    }

    async pause() {
      await this.audioOut.context.suspend();
      this.paused = true;
    }

    async restart() {
      this._teardown();
      await this._init();
    }

    _watchForEnd() {
      this._watcherId = setInterval(() => {
        if (!this.audioOut) {
          clearInterval(this._watcherId);
          return;
        }
        if (this.audioOut.context.currentTime >= this.endTime) {
          clearInterval(this._watcherId);
          this._watcherId = null;
          if (typeof this.onEnded === "function") {
            this.onEnded();
          }
        }
      }, 250);
    }

    _teardown() {
      if (this._watcherId) clearInterval(this._watcherId);
      this._watcherId = null;
      if (this.audioOut) this.audioOut.destroy();
      this.audioOut = null;
    }

    isPaused() {
      return this.paused;
    }

    destroy() {
      this._teardown();
    }
  }

  async function createMP2Player(arrayBuffer, callback) {
    const player = new MP2Player(arrayBuffer);
    await player._init();
    callback(player);
  }
});
