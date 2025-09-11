$(function() {
	initialisePage();

	// Globally accessible object for DataTables instances
	const tables = {};

	const fileInput = $("#file-input");

	// Global reference to setTimeout for maps with multiple screenshots
	let screenshotSlideshow;

	fileInput.on("input", function() {
		if (this.files.length > 0) {
			const file       = this.files[0];
			const filename   = file.name.substring(0, file.name.lastIndexOf("."));
			const fileExt    = file.name.substring(file.name.lastIndexOf(".") + 1).toLowerCase();
			const fileReader = new FileReader();

			fileReader.onload = function() {
				$("body").addClass("file-loaded");

				const utReader = new UTReader(this.result);

				// experimental: UZ
				if (fileExt === "uz" || fileExt === "tmp") {
					utReader.readUZ();
				}

				// experimental: UMOD
				else if (fileExt === "umod") {
					window.package = utReader.readUMOD();
				}

				else {
					// Assign globals for functions below.
					window.package = utReader.readPackage();
					window.packageArrayBuffer = this.result;

					// Used when switching to Textures tab (see populateTexturesTab function).
					package.filename = filename;

					// Populate file info
					$(".file-summary .file-name").text(filename);
					$(".file-summary .file-type").text(`${package.fileTypes[fileExt]} (.${fileExt})`);
					$(".file-summary .file-size").text(readableFileSize(file.size));
					$(".file-summary .file-guid").text(package.header.guid ? package.header.guid.match(/.{8}/g).join("-") : "-");
					$(".file-summary .file-version").text(package.version);

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
					$("[href='#tab-brushes'] .count").text(`(${package.getAllBrushObjects().length})`);
					$("[href='#tab-meshes'] .count").text(`(${(counts.mesh || 0) + (counts.lodmesh || 0) + (counts.skeletalmesh || 0)})`);
				}
			}

			fileReader.readAsArrayBuffer(file);
		}
	}).trigger("input");

	function isLevel() {
		return package.getObjectByName("LevelInfo0") !== null;
	}

	/**
	 * Populate <table> with level info
	 */
	function showLevelSummary() {
		const levelSummary = package.getLevelSummary();

		$(".level-summary .author").text(levelSummary["Author"] || "—");
		$(".level-summary .title").text(levelSummary["Title"] || "—");
		$(".level-summary .music").text(levelSummary["Song"] || "—");
		$(".level-summary .ideal-player-count").text(levelSummary["IdealPlayerCount"] || "—");
		$(".level-summary .level-enter-text").text(levelSummary["LevelEnterText"] || "—");

		// Stop screenshot slideshow if already playing
		clearTimeout(screenshotSlideshow);

		// Attempt to show screenshot
		package.getScreenshot(function(screenshotArray) {
			if (screenshotArray.length > 0) {
				$(".screenshot canvas").replaceWith(screenshotArray[0].canvas);

				// Emulate "slideshow" if multiple found
				if (screenshotArray.length > 1) {
					const speed = 1300; // approximation of UT's speed
					const showScreenshot = (i) => {
						screenshotSlideshow = setTimeout(function() {
							$(".screenshot canvas").replaceWith(screenshotArray[i].canvas);
							showScreenshot((i + 1) % screenshotArray.length);
						}, speed);
					}

					showScreenshot(1);
				}
			} else {
				noScreenshotAvailable();
			}
		})

		$(".screenshot, .level-summary").show(0);

		// Switch to dependencies tab.
		$("[href='#tab-dependencies']").click();
	}

	// Check if this tab has loaded contents for the current package.
	// Prevents reloading resource-intensive contents (e.g. textures, import/export tables).
	function tabUnpopulated(tabId) {
		const tab = $(`#tab-${tabId}`);
		const tabUnpopulated = tab.data("current-package") !== package.filename;

		if (tabUnpopulated) {
			tab.data("current-package", package.filename);
		}

		return tabUnpopulated;
	}

	function populateTexturesTab() {
		if (tabUnpopulated("textures")) {
			const textureTab     = $("#tab-textures .inner");
			const textureObjects = package.getTextureObjects();
			const hasTextures    = textureObjects.length !== 0;

			$("#tab-textures").toggleClass("has-textures", hasTextures);

			if (!hasTextures) {
				textureTab.html("This package contains no embedded textures.");
			} else {
				// Sidebar
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
					const groupTextures = groupedObjects[groupName].sort((a, b) => a.texture.name.toLowerCase() < b.texture.name.toLowerCase() ? -1 : 1);
					const groupWrapper  = $(`
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
				}

				const textureElements = [];

				for (const texture of textureObjects) {
					package.textureToCanvas(texture, function(textureCanvas) {
						const textureInfo = package.getTextureInfo(texture);
						const textureHtml = $(`
							<div class="texture">
								<div class="canvas-wrapper"></div>
								<div class="label">
									<p class="name"></p>
									<p class="size"></p>
								</div>
							</div>
						`);

						textureHtml.find(".canvas-wrapper").append(textureCanvas.canvas);
						textureHtml.find(".name").text(textureInfo.name);
						textureHtml.find(".size").text(`${textureCanvas.canvas.width}×${textureCanvas.canvas.height}`);

						// Add texture object here so it can be used to show details in the sidebar
						textureHtml.data("texture", texture);

						textureElements.push({
							texture : textureInfo,
							html    : textureHtml,
						})

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
					})
				}
			}
		}
	}

	/**
	 * Creates a <table> showing package depencies
	 */
	function createDependenciesTable(showTreeView) {
		const dependenciesTab = $("#tab-dependencies .inner");
		const dependencies    = package.getDependenciesFiltered();

		// Reset
		dependenciesTab.html("");

		// Show these types as plural in dependency list
		const typePlural = {
			"Sound"   : "Sounds",
			"Texture" : "Textures",
		}

		if (dependencies.length === 0) {
			dependenciesTab.text("This package has no dependencies.");
		} else {
			for (const type in dependencies.packages) {
				const grouped  = groupDependenciesByType(dependencies.packages[type]);
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
									${grouped[depType].map(d => `<li>${d.name}</li>`).join("")}
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
						const treeKeys       = getSortedKeys(dependencyTree);

						for (const packageName of treeKeys) {
							const packageHtml = $(`
								<li class="package-li">
									<p class="dep-package"><strong>${packageName}</strong></p>
									<ul class="dep-groups"></ul>
								</li>
							`);

							const groupHtml = packageHtml.find(".dep-groups");

							const tree   = dependencyTree[packageName];
							const groups = getSortedKeys(tree);

							if (depType !== "Music") {
								for (const groupName of groups) {
									const deps     = tree[groupName].naturalSort();
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
			output[depType].sort(function(a, b) {
				return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
			})
		}

		return output;
	}

	function createDependencyTree(dependencies, dependencyType) {
		const packageNames = [];
		const tree = {};

		// Top level package names: e.g. Ancient, SkyCity
		for (const dependency of dependencies.packages.default) {
			if (dependency.type === dependencyType) packageNames.push(dependency.name);
		}

		// Build tree
		for (const object of package.importTable) {
			const objectName = package.nameTable[object.object_name_index];
			const className  = package.nameTable[object.class_name_index];

			// May be changed to "None" if object is ungrouped
			let packageName = package.getObjectNameFromIndex(object.package_index);

			// Child-level object
			if (className === dependencyType) {
				const parent     = package.getParentObject(object);
				const parentName = package.nameTable[parent.object_name_index];

				if (package.defaultPackages[parentName.toLowerCase()] === undefined) continue;

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

	function getTextureURL(package, group, name) {
		const baseUrl = "https://bunnytrack.net/file-browser/files/textures-lower/";

		let fullUrl = baseUrl + package.toLowerCase() + "/";

		if (group !== "None") {
			fullUrl += group.toLowerCase() + "/";
		}

		fullUrl += name.toLowerCase() + ".png";

		return fullUrl;
	}

	// Show a texture's properties and palette in the sidebar
	function updateTextureSidebar(canvas, textureObject) {
		const sidebar = $("#tab-textures .sidebar");
		const table   = sidebar.find(".texture-info tbody");

		// Set texture canvas
		const previewCanvas = sidebar.find(".selected-texture canvas");
		const context = previewCanvas[0].getContext("2d");

		previewCanvas.prop("width", canvas.width);
		previewCanvas.prop("height", canvas.height);

		context.drawImage(canvas, 0, 0);

		// Set palette canvas
		package.getPaletteCanvas(textureObject, function(paletteCanvas, paletteData) {
			const paletteWrapper = sidebar.find(".palette-wrapper");

			paletteWrapper.html(`<h4>Palette</h4>`).append(paletteCanvas);
		})

		// Populate table with texture properties
		const textureProperties = package.getObjectProperties(textureObject);

		table.html("");

		const colourInfoHtml = (value, colour) => {
			const rgb = {
				r: 0,
				g: 0,
				b: 0,
			}

			rgb[colour] = value[colour];

			const square = `<div class="colour-square" style="background-color: rgb(${rgb.r}, ${rgb.g}, ${rgb.b});"></div>`;

			return `<div class="colour-row mono">${colour.toUpperCase()}: ${square} ${value[colour]}</div>`;
		}

		for (const prop of textureProperties) {
			let propHtml;

			switch (prop.type) {
				case "Object":
					continue; // only "Object" prop should be palette, which is already shown
				break;

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

	function createTextBufferTable() {
		if (tabUnpopulated("scripts")) {
			if (tables.scripts) {
				tables.scripts.destroy();
				$("#tab-scripts .code-wrapper code").html("");
			}

			const scriptTable = $("#script-table");
			const textBuffers = package.getTextBufferObjects();
			const tableData   = [];

			for (const textBufferObject of textBuffers) {
				const textBuffer = package.getTextBuffer(textBufferObject);

				let packageName = "—";

				if (textBuffer.package !== undefined) {
					const textBufferPackageObj = package.getObjectByName(textBuffer.package);
					packageName = package.getObjectNameFromIndex(textBufferPackageObj.super_index);
				}

				const rowData = [
					textBuffer.object_name,
					textBuffer.package || "—",
					packageName,
					readableFileSize(textBuffer.size),
					textBuffer.size > 0 ? textBuffer.contents.trim() : "",
				];

				tableData.push(rowData);
			}

			tables.scripts = scriptTable.DataTable({
				data       : tableData,
				pageLength : 50,
				lengthMenu : [25, 50, 75, 100, 250, 500],
			})

			// Show first text buffer's contents by default.
			const hasTextBuffers = textBuffers.length > 0;

			if (hasTextBuffers) {
				scriptTable.find("tbody tr:nth-of-type(1)").click();
			}

			$("#tab-scripts .code-wrapper").toggle(hasTextBuffers);
		}
	}

	function populateSoundsTab() {
		const sounds    = package.getSounds();
		const soundsTab = $("#tab-sounds .inner");

		if (tabUnpopulated("sounds")) {
			if (tables.sounds) {
				tables.sounds.destroy();
			}

			const tableData = [];

			for (const sound of sounds) {
				const audioData = packageArrayBuffer.slice(sound.audio_offset, sound.audio_offset + sound.size);
				const audioBlob = new Blob([audioData], {
					type: `audio/${sound.format.toLowerCase()}`
				})

				tableData.push([
					sound.object_name,
					sound.package || "—",
					readableFileSize(sound.size),
					sound.format.toUpperCase(),
					sound.channels    !== undefined ? sound.channels : "—",
					sound.sample_rate !== undefined ? `${sound.sample_rate / 1000} kHz` : "—",
					sound.bit_depth   !== undefined ? `${sound.bit_depth}-bit` : "—",
					sound.byte_rate   !== undefined ? `${sound.byte_rate * 8 / 1000} kb/s` : "—",
					`<audio src="${URL.createObjectURL(audioBlob)}" controls></audio>`,
				])
			}

			tables.sounds = $("#sounds-table").DataTable({
				data       : tableData,
				order      : [[1, "asc"]],
				pageLength : 25,
				lengthMenu : [25, 50, 75, 100, 250, 500],
				columns    : [
					null,
					null,
					null,
					null,
					null,
					null,
					null,
					null,
					{
						orderable: false
					}
				]
			})
		}
	}

	function loadScriptsSync(scriptsArray, onSuccess) {
		$.getScript(scriptsArray.shift()).always(function(script, textStatus) {
			if (textStatus === "success") {
				if (scriptsArray.length === 0) {
					onSuccess();
				} else {
					loadScriptsSync(scriptsArray, onSuccess);
				}
			} else {
				// TO-DO: handle failed script load
			}
		})
	}

	function loadThreeJs(callback) {
		$("body").addClass("loading-three-js");

		loadScriptsSync([
			"js/three.min.js",
			"js/three-orbit-controls.js",
		], function() {
			$("body").removeClass("loading-three-js");
			callback();
		})
	}

	function populateMusicTab() {
		const musicTab = $("#tab-music .inner");
		const embeddedMusic = package.getObjectsByType("Music");

		// Load MOD JavaScript files (once) before continuing
		if (embeddedMusic.length > 0 && !musicTab.hasClass("loaded-script-xmp")) {
			if (!musicTab.hasClass("loading")) {
				musicTab.addClass("loading");

				loadScriptsSync([
					"js/mod-player/scriptprocessor_player.js",
					"js/mod-player/backend_xmp.js",
				], function() {
					// All scripts loaded - initialise ScriptNodePlayer then call function again
					musicTab.addClass("loaded-script-xmp");

					const onPlayerReady = populateMusicTab;

					const doOnTrackReadyToPlay = function() {};

					const doOnTrackEnd = function() {
						$(".toggle-playback[data-status='playing']").each(function(i, el) {
							const $el = $(el);

							// Restore play icon
							$el.attr("data-status", "paused");

							// Reset playback position
							const player = window[$el.attr("data-id")].player;
							player.seekPlaybackPosition(0);
						})
					}

					ScriptNodePlayer.createInstance(
						new XMPBackendAdapter(),
						"",
						[],
						true,
						onPlayerReady,
						doOnTrackReadyToPlay,
						doOnTrackEnd,
					);
				})
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
				const table     = $(`
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
					const musicName = package.nameTable[musicObject.object_name_index];
					const musicData = package.getMusic(musicObject);

					// Global reference to this player instance/music object - used for playback/download
					const id = `audio_${package.header.guid}`;

					const onCompletion = function() {
						// Prevent auto-play
						player.pause();

						// Basic track metadata
						const musicInfo = player.getSongInfo();

						tableRows.push(`
							<tr>
								<td>${musicName}</td>
								<td>${musicInfo.title || "—"}</td>
								<td>${musicInfo.player || "—"}</td>
								<td>${readableFileSize(musicObject.serial_size)}</td>
								<td>${musicData.format.toUpperCase()}</td>
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
					}

					let player;

					if (window[id] !== undefined) {
						player = window[id].player;
						onCompletion();
					} else {
						player = ScriptNodePlayer.getInstance();

						player.loadMusicFromTypedArray(
							`${musicName}.${musicData.format}`,
							musicData.audio_data,
							[],
							onCompletion,
							function() { console.log("onFail"); },
							function() { console.log("onProgress"); },
						);

						window[id] = {
							filename : `${musicName}.${musicData.format}`,
							data     : musicData,
							player   : player,
						}
					}
				}
			}

			$("[href='#tab-music'] .count").text(`(${embeddedMusic.length})`);
		}
	}

	function getThreeSetup(cameraWidth, cameraHeight) {
		return {
			scene    : new THREE.Scene(),
			camera   : new THREE.PerspectiveCamera(50, (cameraWidth || 1920) / (cameraHeight || 1080), 0.1, 0x10000),
			renderer : new THREE.WebGLRenderer(),
			geometry : new THREE.BufferGeometry(),
		}
	}

	function addBrushToGeometry(geometry, polygons) {
		const vertices = [];
		const faces    = [];

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
				faces.push(f+0, f+1, f+2);
				faces.push(f+0, f+3, f+2);
			}

			// 5-16 vertices - calculate centre and create "fan" pattern
			else if (totalVertices >= 5 && totalVertices <= 16) {
				const centre = getPolyCentre(poly.vertices);

				vertices.push(centre.x, centre.z, centre.y);

				// Starting from the first vertex, create a triangular face using this vertex, the one after it, and the centre
				for (let i = 0; i < totalVertices; i++) {
					faces.push(f+i, f+(i+1 === totalVertices ? 0 : i+1), f+totalVertices);
				}

				// Account for extra centre vertex
				f++;
			}

			// Anything else should already be triangulated by Unreal
			else {
				faces.push(f+0, f+1, f+2);
			}

			f += poly.vertices.length;
		}

		geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
		geometry.setIndex(faces);
	}

	function drawMapView() {
		const mapViewTab = $("#tab-map-view .inner");

		if (!isLevel()) {
			mapViewTab.text("Map view unavailable for this package.");
		} else {
			const allBrushData = package.getAllBrushData();

			const previewWidth  = 1920;
			const previewHeight = 1080;

			const {scene, camera, renderer} = getThreeSetup(previewWidth, previewHeight);

			for (const brush of allBrushData) {
				if (brush.polys.polygons !== undefined) {

					const geometry = new THREE.BufferGeometry();

					addBrushToGeometry(geometry, brush.polys.polygons);

					// Convert properties array to object for convenience
					const brushProps = {};
					brush.brush.properties.forEach(p => brushProps[p.name.toLowerCase()] = p.value);

					if (brushProps.prepivot) {
						geometry.translate(-brushProps.prepivot.x, -brushProps.prepivot.z, -brushProps.prepivot.y);
					}

					// Set scaling
					if (brushProps.mainscale) {
						geometry.scale(brushProps.mainscale.x, brushProps.mainscale.z, brushProps.mainscale.y);
					}

					const material = new THREE.MeshBasicMaterial({
						wireframe   : true,
						transparent : true,
						opacity     : 0.5,
						color       : getLineColour(package.getObjectNameFromIndex(brush.brush.object.class_index), brush.brush.properties),
					})

					const mesh = new THREE.Mesh(
						geometry,
						material
					);

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

            const lights = package.getObjectsByType("Light");

            if (lights.length > 0) {
                const spriteMap      = new THREE.TextureLoader().load("icons/s_light.png");
                const spriteMaterial = new THREE.SpriteMaterial({map: spriteMap});

                for (const light of lights) {
                    const props = package.getObjectProperties(light, light.object_flags);

                    const propObj = {};
                    props.forEach(p => propObj[p.name.toLowerCase()] = p.value);

                    const sprite = new THREE.Sprite(spriteMaterial);

                    const drawScale = propObj.drawscale || 1;

                    sprite.scale.set(32 * drawScale, 32 * drawScale, 32 * drawScale);

                    sprite.position.x = propObj.location.x;
                    sprite.position.y = propObj.location.z;
                    sprite.position.z = propObj.location.y;

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
			}

			animate();
		}
	}

	function populateBrushesTab() {
		const brushes    = package.getAllBrushObjects();
		const brushesTab = $("#tab-brushes .inner");

		if (!$("body").hasClass("loaded-script-three")) {
			// Three.js is loading - try again
			setTimeout(populateBrushesTab, 100);
		}

		else if (tabUnpopulated("brushes")) {
			if (tables.brushes) {
				tables.brushes.destroy();
			}

			if (brushes.length === 0) {
				brushesTab.text("This package contains no brushes.");
			} else {
				const brushNames = brushes.map((b) => [package.nameTable[b.object_name_index]]);

				// Sort by brush numbers properly (1, 2, 3, etc. instead of 1, 10, 11)
				brushNames.sort((a, b) => {
					return parseInt(a[0].match(/\d+/) || []) - parseInt(b[0].match(/\d+/) || []);
				})

				// Now sort by brush class alphabetically (AssertMover, Mover, etc.)
				brushNames.sort((a, b) => {
					return a[0].match(/[a-z]+/i) > b[0].match(/[a-z]+/i);
				})

				tables.brushes = $("#brush-table").on("init.dt", function() {
					// Stupid hack to select first Brush in table
					const table = $(this);

					setTimeout(function() {
						table.find("tbody tr").eq(0).click();
					}, 0);
				}).DataTable({
					data       : brushNames,
					ordering   : false,
					pageLength : 25,
					lengthMenu : [25, 50, 75, 100, 250, 500],
				})
			}
		}
	}

	function getAllBrushInfo(brushName) {
		const brush      = package.getObjectByName(brushName);
		const brushData  = package.getBrushData(brush);
		const brushClass = package.getObjectNameFromIndex(brush.class_index);

		showBrushProperties(
			$("#brush-details"),
			brushName,
			brushData.brush.properties
		);

		if (brushData.model.object !== undefined) {
			showModelProperties(
				$("#model-details"),
				package.nameTable[brushData.model.object.object_name_index],
				brushData.model.properties
			);

			if (brushData.polys.object !== undefined) {
				showPolyProperties(
					$("#poly-details"),
					package.nameTable[brushData.polys.object.object_name_index],
					brushData.polys.polygons
				);

				showBrushPreview(brushClass, brushData.brush.properties, brushData.model.properties, brushData.polys.polygons);
			}
		}
	}

	function utRotationToRadians(rotation) {
		return Math.PI * 2 * (rotation & 0xFFFF) / 0x10000;
	}

	function getLineColour(brushClass, brushProperties) {
		if (package.moverClasses.includes(brushClass)) return 0xFF00FF;

		const props = {};

		brushProperties.forEach(p => props[p.name.toLowerCase()] = p.value);

		props.polyflags = package.getPolyFlags(props.polyflags);

		if (props.polyflags.includes("Semisolid")) return 0xDF959D;
		if (props.polyflags.includes("NotSolid"))  return 0x3FC020;

		if (props.csgoper !== undefined) {
			switch (package.enumCsgOper[props.csgoper]) {
				case "CSG_Add"      : return 0x7F7FFF;
				case "CSG_Subtract" : return 0xFFC03F;
				default: break;
			}
		}

		return 0xFF4B4B;
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

	function showBrushPreview(brushClass, brushProperties, modelInfo, polysArray) {
		const previewArea   = $("#brush-viewer");
		const previewWidth  = 1280;
		const previewHeight = 720;

		const {scene, camera, renderer, geometry} = getThreeSetup(previewWidth, previewHeight);

		// Generate wireframe brush from polys then add to the geometry
		addBrushToGeometry(geometry, polysArray);

		// Convert properties array to object for convenience
		const propObject = {};
		brushProperties.forEach(p => propObject[p.name.toLowerCase()] = p.value);

		// Set scaling
		if (propObject.mainscale) {
			geometry.scale(propObject.mainscale.x, propObject.mainscale.z, propObject.mainscale.y);
		}

		geometry.center();

		const material = new THREE.MeshBasicMaterial({
			wireframe   : true,
			transparent : true,
			opacity     : 0.5,
			color       : getLineColour(brushClass, brushProperties),
		})

		const mesh = new THREE.Mesh(
			geometry,
			material
		);

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
			Math.abs(geometry.boundingBox.min.x) + Math.abs(geometry.boundingBox.max.x),
			Math.abs(geometry.boundingBox.min.y) + Math.abs(geometry.boundingBox.max.y),
			Math.abs(geometry.boundingBox.min.z) + Math.abs(geometry.boundingBox.max.z),
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
		}

		animate();
	}

	function getFrameData(meshObject, meshData, animationSequence, frameNumber) {
		const frameData = {
			faces    : [],
			vertices : [],
			uvs      : [],
		}

		// Mesh or LodMesh - vertices are extracted slightly differently for each class
		const meshClass = package.getObjectNameFromIndex(meshObject.class_index);

		// The mesh vertices array index of the first vertex used by this animation sequence
		const firstVertIndex = (animationSequence.start_frame + frameNumber) * meshData.frame_verts;

		if (meshClass === "Mesh") {
			let i = 0;

			for (const triangle of meshData.triangles) {
				const vertex1 = meshData.vertices[firstVertIndex + triangle.vertex_index_1];
				const vertex2 = meshData.vertices[firstVertIndex + triangle.vertex_index_2];
				const vertex3 = meshData.vertices[firstVertIndex + triangle.vertex_index_3];

				// Push vertices for this triangle - swap 3/2 so not drawn inside out
				frameData.vertices.push(
					vertex1.x, vertex1.z, vertex1.y,
					vertex3.x, vertex3.z, vertex3.y,
					vertex2.x, vertex2.z, vertex2.y,
				);

				frameData.uvs.push(
						triangle.vertex_1_u / 0xFF,
					1 - triangle.vertex_1_v / 0xFF,
						triangle.vertex_3_u / 0xFF,
					1 - triangle.vertex_3_v / 0xFF,
						triangle.vertex_2_u / 0xFF,
					1 - triangle.vertex_2_v / 0xFF,
				);

				frameData.faces.push(
					i++,
					i++,
					i++,
				);
			}
		}

		else if (meshClass === "LodMesh") {
			const verticesUnordered = [];
			const uvsUnordered = [];

			for (let i = 0; i < meshData.special_vertices; i++) {
				let index = firstVertIndex + i;

				// TODO
				if (meshData.remap_anim_vertices.length > 0) debugger

				const vertex = meshData.vertices[index];

				frameData.vertices.push(vertex.x, vertex.z, vertex.y);
				frameData.uvs.push(0, 0);
			}

			for (const wedge of meshData.wedges) {
				let index = firstVertIndex + meshData.special_vertices + wedge.vertex_index;

				if (meshData.remap_anim_vertices.length > 0) {
					index = firstVertIndex + meshData.remap_anim_vertices[meshData.special_vertices + wedge.vertex_index];
				}

				const vertex = meshData.vertices[index];

				try {
					frameData.vertices.push(vertex.x, vertex.z, vertex.y);
				} catch (e) {
					// TODO: probably special vertices
					debugger
				}

				frameData.uvs.push(
						wedge.s / 0xFF,
					1 - wedge.t / 0xFF,
				);
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
					debugger
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
		}

		else {
			alert(`Unable to read mesh data for class: ${meshClass}`);
		}

		return frameData;
	}

	function playAnimSequence(meshObject, meshData, animationSequence, frameNumber) {
		console.log(meshData);

		// Canvas size
		const previewWidth  = 1120;
		const previewHeight = 630;

		// Three.js setup
		const {scene, camera, renderer, geometry} = getThreeSetup(previewWidth, previewHeight);

		// Get vertices for each frame of this animation sequence
		const framesData   = [];
		const meshTextures = [];
		const uvs          = [];

		for (let i = 0; i < animationSequence.frame_count; i++) {
			framesData.push(
				getFrameData(meshObject, meshData, animationSequence, i)
			);
		}

		// Draw first frame
		const firstFrame = framesData.shift();

		geometry.setAttribute("position", new THREE.Float32BufferAttribute(firstFrame.vertices, 3));
		geometry.setAttribute("uv", new THREE.Float32BufferAttribute(firstFrame.uvs, 2));
		geometry.setIndex(firstFrame.faces);

		geometry.morphAttributes.position = [];

		const geometryPositions = geometry.getAttribute("position");

		for (let i = 0; i < framesData.length; i++) {
			const frame = framesData[i];

			const morphTarget = geometryPositions.clone();

			morphTarget.name  = `frame_${i+1}`;
			morphTarget.array = new Float32Array(frame.vertices);

			geometry.morphAttributes.position.push(morphTarget);
		}

		const material = new THREE.MeshBasicMaterial({
			color        : 0x996619,
			morphTargets : true,
			opacity      : 0.95,
			transparent  : true,
			wireframe    : true,
		})

		const mesh = new THREE.Mesh(
			geometry,
			material,
		);

		// Create global variable to allow wireframe toggling
		window.currentMesh = mesh;

		// Try to load texture asynchronously
		if (meshData.textures.length > 0) {
			for (const texture of meshData.textures) {
				if (texture !== null && texture.table === "export") {
					package.textureToCanvas(texture.object, function(textureCanvas) {
						console.log(textureCanvas);

						mesh.material = new THREE.MeshBasicMaterial({
							map          : new THREE.CanvasTexture(textureCanvas.canvas),
							side         : THREE.DoubleSide,
							morphTargets : true,
						})
					})

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

		const clip = THREE.AnimationClip.CreateFromMorphTargetSequence(animationSequence.name, geometry.morphAttributes.position, animationSequence.rate);

		const mixer = new THREE.AnimationMixer(mesh);

		const action = mixer.clipAction(clip);
		action.play();

		const clock = new THREE.Clock();

		const animate = () => {
			requestAnimationFrame(animate);

			controls.update();

			mixer.update(clock.getDelta());

			renderer.render(scene, camera);
		}

		animate();
	}

	function showAnimSequenceFrame(meshObject, meshData, animationSequence, frameNumber) {
		// Canvas size
		const previewWidth  = 1120;
		const previewHeight = 630;

		// Three.js setup
		const {scene, camera, renderer, geometry} = getThreeSetup(previewWidth, previewHeight);
		const vertices = [];

		// Mesh or LodMesh - geometry is extracted slightly differently for each class
		const meshClass = package.getObjectNameFromIndex(meshObject.class_index);

		// The mesh vertices array index of the first vertex used by this animation sequence
		const firstVertIndex = (animationSequence.start_frame + frameNumber) * meshData.frame_verts;

		// Reference to last face index
		let f = 0;

		if (meshClass === "Mesh") {
			for (const triangle of meshData.triangles) {
				const vertex1 = meshData.vertices[firstVertIndex + triangle.vertex_index_1];
				const vertex2 = meshData.vertices[firstVertIndex + triangle.vertex_index_2];
				const vertex3 = meshData.vertices[firstVertIndex + triangle.vertex_index_3];

				// Push vertices for this triangle
				vertices.push(
					vertex1.x, vertex1.z, vertex1.y,
					vertex2.x, vertex2.z, vertex2.y,
					vertex3.x, vertex3.z, vertex3.y,
				);
			}
		}

		else if (meshClass === "LodMesh") {
			// TODO: special_verts
			if (meshData.special_vertices > 0) debugger;

			for (const wedge of meshData.wedges) {
				const vertex = meshData.vertices[firstVertIndex + meshData.special_vertices + wedge.vertex_index];
				vertices.push(vertex.x, vertex.z, vertex.y);
			}

			for (const face of meshData.faces) {
				geometry.faces.push(new THREE.Face3(
					meshData.special_vertices + face.wedge_index_1,
					meshData.special_vertices + face.wedge_index_2,
					meshData.special_vertices + face.wedge_index_3,
				));
			}
		}

		else {
			return alert(`Unable to read mesh data for class: ${meshClass}`);
		}

		geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));
		geometry.center();

		const mesh = new THREE.Mesh(
			geometry,
			new THREE.MeshBasicMaterial({
				color        : 0x996619,
				morphTargets : true,
				opacity      : 0.95,
				transparent  : true,
				wireframe    : true,
			})
		);

		// Set rotation
		if (meshData.rotation_origin) {
			mesh.setRotationFromEuler(new THREE.Euler(
				utRotationToRadians(meshData.rotation_origin.roll),
				utRotationToRadians(meshData.rotation_origin.yaw),
				utRotationToRadians(meshData.rotation_origin.pitch),
			));
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
		}

		animate();
	}

	function drawSkeletalMesh(meshObject, meshData) {
		// Canvas size
		const previewWidth  = 1120;
		const previewHeight = 630;

		// Three.js setup
		const {scene, camera, renderer, geometry} = getThreeSetup(previewWidth, previewHeight);

		const vertices = [];
		const faces    = [];

		for (const wedge of meshData.wedges) {
			const vertex = meshData.points[wedge.vertex_index];

			vertices.push(
				vertex.x,
				vertex.z,
				vertex.y
			);
		}

		for (const face of meshData.faces) {
			faces.push(
				face.wedge_index_1,
				face.wedge_index_2,
				face.wedge_index_3,
			);
		}

		geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
		geometry.setIndex(faces);

		geometry.center();

		const mesh = new THREE.Mesh(
			geometry,
			new THREE.MeshBasicMaterial({
				color        : 0x996619,
				opacity      : 0.95,
				transparent  : true,
				wireframe    : true,
			})
		);

		// Set rotation
		if (meshData.rotation_origin) {
			mesh.setRotationFromEuler(new THREE.Euler(
				utRotationToRadians(meshData.rotation_origin.roll),
				utRotationToRadians(meshData.rotation_origin.yaw),
				utRotationToRadians(meshData.rotation_origin.pitch),
			));
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
		}

		animate();
	}

	function populateAnimSequencesTable(meshObject) {
		if (tables.animations) {
			tables.animations.destroy();
		}

		let meshData;

		const meshClass = package.getObjectNameFromIndex(meshObject.class_index);

		switch (meshClass) {
			case "Mesh":
				meshData = package.getMeshData(meshObject);
			break;

			case "LodMesh":
				meshData = package.getLodMeshData(meshObject);
			break;

			case "SkeletalMesh":
				meshData = package.getSkeletalMeshData(meshObject);
			break;

			default: return alert(`Unable to read mesh data for class: ${meshClass}`);
		}

		$(".anim-sequences-wrapper h3 .count").text(`(${meshData.anim_sequences.length})`);

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
			])
		}

		tables.animations = animTable.DataTable({
			data       : animTableData,
			pageLength : 25,
			lengthMenu : [25, 50, 75, 100, 250, 500],
		})

		// Skeletal meshes do not appear to ever have animations (they're stored separately)
		if (meshClass === "SkeletalMesh") {
			drawSkeletalMesh(meshObject, meshData);
		}

		else if (meshData.anim_sequences.length > 0) {
			// Show 2nd sequence if possible, as showing "All" straight away looks a bit confusing
			// and is also currently not great for performance.
			const sequence = meshData.anim_sequences.length === 1 ? 1 : 2;
			animTable.find(`tbody tr:nth-of-type(${sequence})`).click();
		}
	}

	function showPolyProperties(parentEl, objectName, polysArray) {
		const propLabels = {
			actor        : "Actor",
			brush_poly   : "BrushPoly",
			flags        : "Flags",
			item_name    : "ItemName",
			link         : "Link",
			normal       : "Normal",
			origin       : "Origin",
			pan_u        : "PanU",
			pan_v        : "PanV",
			texture      : "Texture",
			texture_u    : "TextureU",
			texture_v    : "TextureV",
			vertices     : "Vertices",
			vertex_count : "VertexCount",
		}

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
						if (propValue.length > 0) {
							polyEl.append(`
								<section class="struct">
									<p class="array-name mono">PolyFlags</p>

									<section class="array-items">
										${propValue.map(flag => `
											<p class="property mono">
												<span class="value">${flag}</span>
											</p>
										`).join("")}
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
								<span class="value">${package.getObjectNameFromIndex(propValue)}</span>
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
			bounding_box    : "BoundingBox",
			bounding_sphere : "BoundingSphere",
			bounds          : "Bounds",
			leaf_hulls      : "LeafHulls",
			leaves          : "Leaves",
			light_bits      : "LightBits",
			light_map       : "LightMap",
			lights          : "Lights",
			linked          : "Linked",
			nodes           : "Nodes",
			points          : "Points",
			polys           : "Polys",
			root_outside    : "RootOutside",
			shared_sides    : "SharedSides",
			surfaces        : "Surfaces",
			vectors         : "Vectors",
			vertices        : "Vertices",
			zones           : "Zones",
		}

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
					propValue = package.getObjectNameFromIndex(propValue);
				break;

				case "name":
					continue;
				break;

				default:
				break;
			}

			const propEl = $("<section />");

			if (Array.isArray(propValue)) {
				// TODO
				continue;
			}

			else if (typeof propValue === "object") {
				switch (propName) {
					case "bounding_box":
					case "bounding_sphere":
						propEl.addClass("struct").append(`<p class="struct-name mono">${propLabels[propName] || propName}</p>`);

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
						}

						else {
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
			}

			else {
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
		properties = properties.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase());

		const propLabels = {
			i_leaf      : "iLeaf",
			sheer_axis  : "SheerAxis",
			sheer_rate  : "SheerRate",
			zone        : "Zone",
			zone_number : "ZoneNumber",
		}

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
					propValue = package.getObjectNameFromIndex(propValue);
				break;

				case "bumptype":
					propValue = package.enumBumpType[propValue];
				break;

				case "moverencroachtype":
					propValue = package.enumMoverEncroachType[propValue];
				break;

				case "moverglidetype":
					propValue = package.enumMoverGlideType[propValue];
				break;

				case "csgoper":
					propValue = package.enumCsgOper[propValue];
				break;

				// Ignore these properties
				case "level":
					continue;
				break;

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
							subPropValue = package.enumSheerAxis[subPropValue];
						break;

						case "zone":
							subPropValue = package.getObjectNameFromIndex(subPropValue);
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
						${package.getPolyFlags(propValue).map(flag => `
							<p class="property mono">
								<span class="value">${flag}</span>
							</p>
						`).join("")}
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

			for (const object of package.importTable) {
				const parent = package.getObject(object.package_index);

				importTableData.push([
					i++,
					package.nameTable[object.object_name_index],
					parent ? package.nameTable[parent.object.object_name_index] : "—",
					package.nameTable[object.class_name_index],
					package.nameTable[object.class_package_index],
				]);
			}

			i = 1;

			for (const object of package.exportTable) {
				if (object.serial_offset === undefined) continue;

				const objectClass = package.getObject(object.class_index);
				const objectClassName = objectClass ? package.nameTable[objectClass.object.object_name_index] : "MyLevel";

				const objectParent = package.getObject(object.super_index);
				const objectParentName = objectParent ? package.nameTable[objectParent.object.object_name_index] : "—";

				const objectPackage = package.getObject(object.package_index);
				const objectPackageName = objectPackage ? package.nameTable[objectPackage.object.object_name_index] : "—";

				exportTableData.push([
					i++,
					package.nameTable[object.object_name_index],
					objectClassName,
					objectParentName,
					objectPackageName,
					`0x${object.serial_offset.toString(16).toUpperCase()}`,
					object.serial_size,
				])
			}

			tables.import = $("#import-table").DataTable({
				data       : importTableData,
				pageLength : 25,
				lengthMenu : [25, 50, 75, 100, 250, 500],
			})

			tables.export = $("#export-table").DataTable({
				data       : exportTableData,
				pageLength : 25,
				lengthMenu : [25, 50, 75, 100, 250, 500],
				columns    : [
					null,
					null,
					null,
					null,
					null,
					{
						createdCell: function(cell, cellData, rowData, rowIndex, colIndex) {
							cell.classList.add("mono");
						}
					},
					{
						render: function (data, type, row, meta) {
							return readableFileSize(data);
						}
					},
				]
			})
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
				createTextBufferTable();
			break;

			case "models":
				if (!$("body").hasClass("loaded-script-three")) {
					loadThreeJs(function() {
						$("body").addClass("loaded-script-three");
						$("[href='#tab-brushes']").click();
					})
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

			default:
			break;
		}
	}

	function populateMeshesTab() {
		const meshObjects = package.getAllMeshObjects();
		const meshesTab = $("#tab-meshes .inner");

		$("[href='#tab-meshes'] .count").text(`(${meshObjects.length})`);

		if (!$("body").hasClass("loaded-script-three")) {
			// Three.js is loading - try again
			setTimeout(populateMeshesTab, 100);
		}

		else if (tabUnpopulated("meshes")) {
			if (tables.meshes) {
				tables.meshes.destroy();
			}

			const meshTableData = [];

			for (let i = 0; i < meshObjects.length; i++) {
				const meshObject = meshObjects[i];

				meshTableData.push([
					i + 1,
					package.nameTable[meshObject.object_name_index],
					package.getObjectNameFromIndex(meshObject.class_index),
					readableFileSize(meshObject.serial_size),
					meshObject
				])
			}

			tables.meshes = $("#mesh-table").DataTable({
				data       : meshTableData,
				pageLength : 25,
				lengthMenu : [25, 50, 75, 100, 250, 500],
			})

			const hasMeshes = meshObjects.length > 0;

			if (hasMeshes) {
				$("#mesh-table tbody tr:nth-of-type(1)").click();
			}

			$(".anim-sequences-wrapper, #mesh-viewer").toggle(hasMeshes);
		}
	}

	function getCurrentMesh() {
		const rowData = tables.animations.row($("#anim-sequences-table tbody .selected")).data();

		// Mesh export table object
		const meshObject = rowData[rowData.length - 2];

		// All data for this mesh
		const meshData = rowData[rowData.length - 1];

		// Selected animation sequence index
		const sequenceIndex = rowData[0] - 1;

		// Data for the selected animation sequence of this mesh (frame count, sequence name, etc.)
		const animSeqData = meshData.anim_sequences[sequenceIndex];

		return {
			mesh_object   : meshObject,
			mesh_data     : meshData,
			anim_seq_data : animSeqData,
		}
	}

	// Create tabs for package contents
	function loadTabs() {
		$(".tabs").tabs({
			activate: function(event, ui) {
				processTabAction(ui.newTab.find("[data-action]").attr("data-action"));
			},
			create: function(event, ui) {
				processTabAction(ui.tab.find("[data-action]").attr("data-action"));
			}
		})

		$("body").addClass("tabs-loaded");
	}

	// Called once on page load to add event listeners, etc.
	function initialisePage() {
		// Dependencies tab - toggle tree view
		$("#tab-dependencies").on("click", "[name='dependency-view']", function() {
			createDependenciesTable(this.value === "tree");
		})

		$("#tab-textures").on("click", ".texture canvas", function() {
			const wrapper = $(this).parents(".texture");
			const textureObject = wrapper.data("texture");

			$(".texture.selected").removeClass("selected");

			wrapper.addClass("selected");

			updateTextureSidebar(this, textureObject);
		})

		// Music tab - playback control
		$("#tab-music").on("click", ".toggle-playback", function() {
			const button = $(this);
			const player = window[button.attr("data-id")].player;

			if (player.isPaused()) {
				player.resume();
				button.attr("data-status", "playing");
			} else {
				player.pause();
				button.attr("data-status", "paused");
			}
		})

		// Music tab - download music file
		$("#tab-music").on("click", ".download", function() {
			const musicData    = window[$(this).attr("data-id")];
			const audioBlobUrl = window.URL.createObjectURL(new Blob([musicData.data.audio_data], {type: "application/octet-stream"}));
			const tempLink     = $("<a />", {
				download : musicData.filename,
				href     : audioBlobUrl,
			})

			tempLink[0].click();
		})

		// Scripts tab - show text buffer contents/add syntax highlighting.
		$("#tab-scripts").on("click", "tbody tr", function() {
			const tableRow = $(this);

			$("#tab-scripts tr.selected").removeClass("selected");
			tableRow.addClass("selected");

			const codeBlock = $("#tab-scripts").find("code");

			const scriptContents = tables.scripts.row(this).data()[4];

			codeBlock.text(scriptContents);

			hljs.highlightBlock(codeBlock[0]);
		})

		// Meshes tab - process selected mesh from table
		$("#mesh-table tbody").on("click", "tr", function() {
			$("#mesh-table tbody .selected").removeClass("selected");

			$(this).addClass("selected");

			const meshObject = tables.meshes.row(this).data()[4];

			// Populate animation sequences table for this mesh
			populateAnimSequencesTable(meshObject);
		})

		// Meshes tab - process selected mesh's animation sequence from table
		$("#anim-sequences-table tbody").on("click", "tr", function() {
			$("#anim-sequences-table tbody .selected").removeClass("selected");

			$(this).addClass("selected");

			const mesh = getCurrentMesh();

			// Playback controls
			const inputs = $("#mesh-viewer .frame-slider, #mesh-viewer .frame-counter");

			// Update max frame #
			inputs.val(0).attr("max", mesh.anim_seq_data.frame_count - 1);

			// Disable if only one frame (more of a visual indication for the user that this isn't animated)
			inputs.attr("disabled", mesh.anim_seq_data.frame_count === 1);
			inputs.attr("title",    mesh.anim_seq_data.frame_count === 1 ? "This sequence only contains one frame" : "");

			// Show first frame of sequence
			playAnimSequence(mesh.mesh_object, mesh.mesh_data, mesh.anim_seq_data, 0);
			// showAnimSequenceFrame(mesh.mesh_object, mesh.mesh_data, mesh.anim_seq_data, 0);
		})

		// Meshes tab - animation frames controlled by range input
		$("#mesh-viewer .frame-slider").on("input", function() {
			$("#mesh-viewer .frame-counter").val(this.value);
		})

		// Meshes tab - animation frames controlled by number input
		$("#mesh-viewer .frame-counter").on("input", function() {
			$("#mesh-viewer .frame-slider").val(this.value);
		})

		// Meshes tab - frame control via any input with this class
		$("#mesh-viewer .frame-control").on("input", function() {
			const frame = parseInt(this.value);
			const mesh  = getCurrentMesh();

			if (frame >= 0 && frame < mesh.anim_seq_data.frame_count) {
				showAnimSequenceFrame(mesh.mesh_object, mesh.mesh_data, mesh.anim_seq_data, frame);
			}
		})

		// Meshes tab - toggle wireframe for models
		$("body").on("click", "#toggle-wireframe", function() {
			if (window.currentMesh) {
				// TODO
				if (window.currentMesh.material.wireframe) {
				} else {
					window.currentMesh.material = new THREE.MeshBasicMaterial({
						morphTargets : true,
						wireframe    : true,
						color        : 0x996619,
					})
				}
			}
		})

		// Brushes tab - process selected brush from table
		$("#brush-table tbody").on("click", "tr", function() {
			$("#brush-table tbody .selected").removeClass("selected");

			$(this).addClass("selected");

			const brushName = tables.brushes.row(this).data()[0];

			getAllBrushInfo(brushName);
		})

		// Brushes tab - show/collapse poly info on click
		$("#poly-details").on("click", ".poly-num", function() {
			const parent = $(this).parents(".poly-node");

			parent.toggleClass("open");

			$(this).find(".toggle").text(parent.hasClass("open") ? "-" : "+");
		})

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
		const canvas  = $(".screenshot canvas")[0];
		const context = canvas.getContext("2d");
		const x       = canvas.width / 2;
		const y       = canvas.height / 2;

		// Reset
		context.clearRect(0, 0, canvas.width, canvas.height);

		// Background
		context.fillStyle = "black";
		context.fillRect(0, 0, canvas.width, canvas.height);

		// Text
		context.font         = "60px Segoe UI";
		context.textAlign    = "center";
		context.textBaseline = "middle";
		context.fillStyle    = "white";
		context.fillText("N/A", x, y);
	}

	/**
	 * Misc / helper functions
	 */
	Array.prototype.naturalSort = function() {
		return this.sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1);
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

		const units = ["kB","MB","GB","TB","PB","EB","ZB","YB"];

		let u = -1;

		do {
			bytes /= thresh;
			++u;
		} while (Math.abs(bytes) >= thresh && u < units.length - 1);

		return bytes.toFixed(1) + " " + units[u];
	}
})