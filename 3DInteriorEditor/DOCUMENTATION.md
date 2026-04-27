# Documentation — 3D Interior Editor (Desktop)

## Phase 1 (Setup)

### What’s implemented

- Portable local **.NET 8 SDK** installed under `tools/dotnet/` (not committed).
- NuGet packages cached under `.nuget/packages/` via `NuGet.config` (not committed).
- WPF solution `3DInteriorEditor.sln` with a minimal app shell.
- MaterialDesignThemes wired in `App.xaml` with dark theme baseline.

### How to build

```powershell
.\dotnet.cmd build .\3DInteriorEditor\3DInteriorEditor.sln -c Debug
```

### How to publish

```powershell
.\dotnet.cmd publish .\3DInteriorEditor\3DInteriorEditor.sln -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true
```

Alternatively, from repo root run **`publish-app.cmd`**, which publishes the app project to **`artifacts/DesktopApp/`** (self-contained **win-x64** single-file for end users).

### Notes

- SharpGLTF: The spec mentions `SharpGLTF.Runtime.WPF`, but the available NuGet package is `SharpGLTF.Runtime`. We use `SharpGLTF.Runtime` + `SharpGLTF.Core` as the baseline.

## Phase 2 (Domain models)

### What’s implemented

- `Constants.cs`: centralized numeric/string constants for snap, history, autosave paths, schema version, etc.
- Enums (serialized as strings in JSON):
  - `Models/Enums/AssetShapeKind`
  - `Models/Enums/ShadowQuality`
  - `Models/Enums/HdriPreset`
- Persisted document model (`System.Text.Json`-friendly):
  - `Models/LayoutFile` (root JSON document)
  - `Models/AssetDefinition`, `Models/PlacedAsset`
  - `Models/TextLabel`, `Models/Decal`
  - `Models/LightingSettings`, `Models/HistorySnapshot`
  - `Models/JsonVector3` (meters/vector data in layout files)

### Conventions

- Vectors in layout JSON use `JsonVector3` with **X/Y/Z doubles** in meters.
- Colors are **hex strings** (e.g. `#RRGGBB`) at the data layer; WPF `Color` conversion comes later in `Helpers/ColorHelper`.
- `LayoutFile.SchemaVersion` is always `Constants.LayoutSchemaVersion` (`v3`).

## Phase 3 (Built-in asset templates)

### What’s implemented

- `Data/DefaultAssets.cs`:
  - Stable IDs under `DefaultAssets.Ids.*`
  - Category labels under `DefaultAssets.Categories.*`
  - `DefaultAssets.All` exposes the built-in `AssetDefinition` templates (dimensions/colors/shapes + metadata key templates).

### Notes

- The original requirements doc headline says “12 default assets”, but the detailed bullet list enumerates additional “Basis” templates too. `DefaultAssets.All` follows the **explicit template bullets** (unique definitions).

## Phase 4 (Persistence + undo/redo services)

### What’s implemented

- `Services/FileService`:
  - Async JSON load/save for `*.3dei` using `System.Text.Json`
  - Helper export for `.json` exports (`ExportJsonAsync`)
  - Utility `WriteRawJsonAsync` for migration/import scenarios
- `Services/Serialization/AppJson`:
  - Shared serializer options (**camelCase** JSON; enums as strings via `JsonStringEnumConverter`)
- `Services/HistoryService`:
  - Undo/redo stacks capped to `Constants.MaxHistoryEntries`
  - Deep snapshots via JSON roundtrip (`DeepCopy`)
- `Services/AutoSaveService`:
  - Background timer loop (`Constants.AutoSaveIntervalSeconds`)
  - Marshals “should save?” + “build layout” callbacks via captured `SynchronizationContext` when provided (future UI thread wiring)
  - Writes into `%APPDATA%\\3DInteriorEditor\\AutoSave\\…` directory (caller chooses filename)

### JSON naming

- Persisted JSON uses **camelCase** property names (`AppJson.Options`), even though C# models use PascalCase properties.

## Phase 5 (MVVM skeleton)

### What’s implemented

- ViewModels (`CommunityToolkit.Mvvm`):
  - `ViewModels/MainViewModel`: owns `LayoutFile`, window title formatting, optional load/save via `Microsoft.Win32` dialogs (early wiring)
  - `ViewModels/AssetLibraryViewModel`: binds to built-in definitions + supports search filtering
  - `ViewModels/InspectorViewModel`: placeholder selection header until selection exists
- Composition:
  - `App.xaml.cs` constructs `MainViewModel` and assigns `MainWindow.DataContext`

### Notes

- Phase 5 focuses on **state ownership** and MVVM seams. Phase 6 adds the main chrome (menu/toolbar/sidebars) and binds it to VM commands.

## Phase 6 (Main window chrome)

### What’s implemented

- `Views/MainWindow.xaml`:
  - `Grid` shell: fixed **240px** left sidebar, **280px** right sidebar, **48px** toolbar row, **28px** status row, centered **viewport placeholder** (`TextBlock`)
  - `Menu` + `Command` key bindings for early `MainViewModel` file actions (New/Open/Save/Save As)
- `Views/ToolbarView.xaml`:
  - **48px** row with primary file actions bound to `MainViewModel` (`New`, `Open`, `Save`, `Save As`) plus a mode badge (`ModeLabel`)
- `Views/AssetLibraryPanel.xaml`:
  - Search box + refresh (`RefreshFilterCommand`) + `ItemsControl` bound to `AssetLibraryViewModel.FilteredDefinitions`
  - Bottom line shows filtered count via `FilteredCount`
- `Views/InspectorPanel.xaml`:
  - Header bound to `InspectorViewModel.HeaderText` + a small summary card (`PlacedAssets.Count`, `AssetDefinitions.Count`)
- ViewModel polish:
  - `AssetLibraryViewModel`: `RefreshFilterCommand`, `FilteredCount`, and explicit filter refresh notifications

### Notes

- Phase 6 intentionally stopped at chrome + MVVM seams; Phase 7 adds the 3D viewport host. Undo/redo remains service-level until wired to the UI.

## Phase 7 (3D viewport host)

### What’s implemented

- `Views/ViewportPanel.xaml`:
  - `HelixToolkit.Wpf` `HelixViewport3D` as the central editor viewport (`ZoomExtentsWhenLoaded`, `RotateAroundMouseDownPoint`)
  - Default **Y-up** scene: `PerspectiveCamera`, `SunLight`, ground-aligned `GridLinesVisual3D` (XZ plane), thin `BoxVisual3D` ground slab, `CoordinateSystemVisual3D`
  - On-screen hint for mouse controls (rotate / pan / zoom)
- `Views/MainWindow.xaml`: center column hosts `ViewportPanel` instead of the Phase 6 placeholder text

### Notes

- Navigation uses Helix **built-in** camera handlers (no custom manipulation code in this phase). Scene graph content for placed assets arrives in a later phase.

## Phase 8 (Scene graph — placed assets)

### What’s implemented

- `Scene/PlacedAssetVisualFactory.cs`: maps `AssetShapeKind` to Helix primitives (`BoxVisual3D`, `SphereVisual3D`, `TruncatedConeVisual3D` for cylinder/cone); hex/rhombus/circle fall back to box for now.
- `Scene/PlacedAssetScenePresenter.cs`: rebuilds dynamic `ModelVisual3D` children from `MainViewModel.PlacedAssets` (world transform from position + Euler degrees X→Y→Z); registers visuals for hit-testing.
- `Helpers/ColorHexHelper.cs`: parses `#RRGGBB` / `#AARRGGBB` for diffuse materials.
- `ViewModels/MainViewModel.cs`: `PlaceAssetFromLibraryCommand` lays instances on the XZ plane with spacing; `ApplyViewportPick` / `ClearViewportSelection` drive the inspector status line.
- `Views/ViewportPanel`: `Viewport3DHelper.FindHits` on the inner `Viewport` + **Strg+Linksklick** selection (marks event handled so camera drag does not steal the gesture).
- `Views/AssetLibraryPanel`: **double-click** a template row to place an instance.

### Notes

- Imported mesh rendering was added in **Phase 14** (see below).

## Phase 9 (Undo / Redo UX)

### What’s implemented

- `HistoryService` integration in `MainViewModel`:
  - **`History.Push`** records the document state **before** `PlaceAssetFromLibrary` runs (deep-copied lists + selection ids via `DeepCopy`).
  - **`Undo` / `Redo`** commands capture `HistorySnapshot`, move between undo/redo stacks (`PushRedo` / `PushUndo`), then **`ApplySnapshot`** rebuilds `PlacedAssets`, syncs layout, restores inspector selection, and **`MarkDirty`**.
- UI:
  - **Toolbar**: separator + undo/redo icon buttons (`UndoCommand`, `RedoCommand`).
  - **Menu** `Bearbeiten`: Rückgängig / Wiederholen with gesture hints.
  - **Shortcuts**: Strg+Z / Strg+Y on the main window (`KeyBinding`).
- Commands use **`CanExecute`** (`History.CanUndo` / `History.CanRedo`); **`NotifyUndoRedoCommands`** runs after placement, undo/redo, new layout, and successful open.

### Notes

- Undo history is cleared on **Neu** and **Öffnen** (`History.Clear`). Further editing actions should call the same **`History.Push`** pattern before mutating scene data.

## Phase 10 (Selection plumbing + highlight)

### What’s implemented

- Selection state:
  - `MainViewModel.SelectedAssetIds` stores the selection as **instance ids** (stable across rebuilds).
  - `SyncSelectionToInspector()` projects ids back to `PlacedAsset` references and calls `Inspector.SetSelection(...)`.
  - History restore (`ApplySnapshot`) now restores both placed assets **and** selection ids.
- Viewport highlight:
  - `PlacedAssetScenePresenter` rebuilds visuals on both asset changes and selection changes.
  - `PlacedAssetVisualFactory` applies a simple accent tint when `isSelected`.
- Inspector UI:
  - `InspectorPanel` lists selected asset ids and shows the selection count.

### Notes

- Currently, selection changes are **not** pushed into undo/redo history on their own (only captured as part of edit snapshots like placement). This keeps the history focused on document edits.

## Phase 11 (Keyboard transforms)

### What’s implemented

- `MainViewModel` edit commands (all capture history **before** mutation):
  - `DeleteSelectedCommand`: deletes selected placed assets (Delete key).
  - `NudgeSelectedCommand`: moves selection on the ground plane (arrow keys) in steps of `Constants.SnapUnitDefault`.
  - `RotateSelectedCommand`: rotates selection around Y (Q/E) in steps of `Constants.RotationSnapDegrees`.
- `MainWindow` key bindings:
  - Arrow keys → `NudgeSelectedCommand` (Forward/Back/Left/Right)
  - `Q` / `E` → rotate left/right
  - `Delete` → delete selection
- `InspectorPanel` now shows `PositionMeters` and `RotationDegrees` for selected assets (read-only).

### Notes

- This phase intentionally uses **keyboard transforms** to avoid introducing a full gizmo/drag-manipulation system yet.

## Phase 12 (Duplicate + fine steps)

### What’s implemented

- Duplicate:
  - `MainViewModel.DuplicateSelectedCommand` duplicates selected instances (new ids) with offset `Constants.PasteOffsetX/Z`.
  - Bound to **Ctrl+D** and available in **Bearbeiten → Duplizieren** and the toolbar.
- Fine steps:
  - `NudgeSelectedCommand` supports `*Fine` directions (Shift+Arrow) for \(0.1 \times\) `Constants.SnapUnitDefault`.
  - `RotateSelectedCommand` supports `*Fine` (Shift+Q/E) using 5° steps.
- UI polish:
  - Toolbar buttons for Duplicate / Delete.
  - Viewport hint text updated with the new shortcuts.

### Notes

- Duplicate uses the same undo pattern as other edits: history is captured **before** mutation.

## Phase 13 (Inspector transform editing)

### What’s implemented

- `ViewModels/MainViewModel.InspectorEditing.cs` (partial `MainViewModel`):
  - String text fields for **position (m)** and **rotation (deg)** for a **single** selected instance.
  - `ApplyInspectorTransformCommand` records a `History` snapshot, then updates the `PlacedAsset` in `PlacedAssets`.
  - `ResetInspectorTransformCommand` reloads the text fields from the current scene state.
  - Numbers are parsed with `CultureInfo.InvariantCulture` (use a **`.`** decimal separator in the text fields).
- `Views/InspectorPanel.xaml` shows the editor when `IsInspectorTransformVisible` and provides **Übernehmen** / **Zurücksetzen** actions.
- `SyncSelectionToInspector` and keyboard nudges/rotations keep the text fields in sync with the selected instance.
- `BootstrapLayoutCollections` also clears `SelectedAssetIds` so new/loaded documents do not keep stale selection.

### Notes

- The transform editor is only available for **exactly one** selected item. For multiple selection, the panel still shows the list, but the editor is hidden.

## Phase 14 (Imported glTF / glB rendering)

### What’s implemented

- **Path resolution** (`Scene/ImportedModelPathResolver.cs`): `AssetDefinition.ImportedModelPath` resolves to an absolute path when it is rooted, relative to the **layout file directory**, or relative to the **application base directory** (for shipped `samples/` content).
- **Loading** (`Scene/GltfModelLoader.cs`): SharpGLTF **Runtime** decodes meshes, evaluates the default scene’s bounding box (with bind pose), then builds WPF `MeshGeometry3D` parts. Geometry is **centered** and **uniformly scaled** so the full model fits inside the instance’s `DimensionsMeters` (axis-aligned tight box).
- **Viewport** (`Scene/PlacedAssetVisualFactory.cs`, `Scene/PlacedAssetScenePresenter.cs`): When a resolved `.gltf`/`.glb` loads successfully, instances render as imported **triangle meshes**; per-primitive diffuse can follow glTF **factor** data (see Phase 21). Otherwise the definition’s **primitive** shape is used.
- **Sample asset**: `Data/DefaultAssets` includes **“glTF-Beispiel (Würfel)”** (`builtin.imported-sample-box`) pointing at `samples/built-in-box.gltf` (+ `built-in-box.bin`), copied next to the executable via the `.csproj` `samples/**` rule.
- **Caching**: Decoded mesh parts are cached by file path, last-write time, and target dimensions to avoid reloading on every viewport rebuild.

### Notes

- **Textures**: **baseColorTexture** / **diffuseTexture** sampling (Phase 22) plus per-primitive **factor** tint (Phase 21). Normal maps, metallic-roughness textures, occlusion, etc. are still ignored.
- Skinning / animation / morph targets are not evaluated beyond the default **bind pose** for placement and bounds.

## Phase 15 (Viewport drag translate)

### What’s implemented

- **Shift+Drag translation** in the viewport (`Views/ViewportPanel.xaml(.cs)`):
  - **Shift + left mouse drag** moves a placed instance on a plane parallel to the floor (XZ) at the asset’s current **Y** height.
  - Drag starts when the cursor hits a placed asset (hit-tested via `PlacedAssetScenePresenter`).
  - Drag forces **single selection** (so we edit exactly one instance).
- **Undo integration** (`ViewModels/MainViewModel.ViewportDragging.cs`):
  - A single `History.Push(...)` is taken **once** at drag start.
  - During drag, updates do **not** push additional history entries.
  - Inspector transform text fields update live via `RefreshInspectorTransformFieldsFromScene()`.

### Notes

- This is a “gizmo-light” interaction that avoids conflicting with Helix camera orbit/pan/zoom gestures.
- **Rotate-drag** is Phase 16; **scale-drag** is Phase 17.
- Requires **`TransformMode.Translate`** (toolbar / Phase 20).

## Phase 16 (Viewport drag rotate — yaw)

### What’s implemented

- **Alt+Drag rotate** (`Views/ViewportPanel.xaml(.cs)`): **Alt + left mouse drag** rotates the picked instance around **world Y** (yaw). Horizontal mouse movement scales rotation using `Constants.ViewportRotateDragDegreesPerPixel`.
- Requires **Edit mode** and **`TransformMode.Rotate`** (toolbar / Phase 20).
- Same undo rules as Phase 15: **`History.Push(...)` once** at drag start; live inspector rotation fields during drag (`MainViewModel.ViewportDragging.cs`).

### Notes

- Pitch/roll viewport drags remain **out of scope** for this phase.

## Phase 17 (Viewport drag scale — uniform)

### What’s implemented

- **Strg+Umschalt+Drag scale** (`Views/ViewportPanel.xaml(.cs)`): **Ctrl+Shift + left mouse drag** uniformly scales `PlacedAsset.DimensionsMeters` from the dimensions captured at drag start.
- Vertical mouse movement adjusts a **uniform multiplier** (`Constants.ViewportScaleDragMultiplierPerPixel`; drag **up** increases size). The multiplier is clamped (`ViewportScaleDragMinMultiplier` … `ViewportScaleDragMaxMultiplier`); each axis is then clamped to `Constants.MinAssetDimension`.
- Requires **Edit mode** and **`TransformMode.Scale`** (toolbar / Phase 20).
- Undo/history matches prior viewport drags: **`History.Push(...)` once** at drag start (`MainViewModel.ViewportDragging.cs`).

### Notes

- Typed **non-uniform** dimensions editing is Phase 18 (inspector); viewport drag scaling remains uniform.

## Phase 18 (Inspector dimensions + color)

### What’s implemented

- **`ViewModels/MainViewModel.InspectorEditing.cs`** extended with invariant text fields for **dimensions** (width X · height Y · depth Z in meters) and **color** (`#RRGGBB`; `#AARRGGBB` accepted when parsing).
- **`ApplyInspectorAppearanceCommand`**: **`History.Push(...)`** then updates `PlacedAssets` via **`CloneAsset(..., dimensionsMeters, colorHex)`**. Values below `Constants.MinAssetDimension` are clamped upward on apply.
- **`ResetInspectorAppearanceCommand`** reloads fields from the scene.
- **Swatches**: inspector binds to `Constants.DefaultColorSwatches` (`InspectorColorPalette`) with click-to-copy into the hex field (`PickInspectorColorSwatchCommand`).
- **`Helpers/HexStringToColorConverter.cs`**: XAML converter for palette preview squares.
- **`Views/InspectorPanel.xaml`**: second editor card (**Maße / Farbe**) visible under the same rule as Phase 13 (**exactly one** selected asset).

### Notes

- Applying appearance does **not** implicitly apply transform text fields (two independent **Übernehmen** actions).

## Phase 19 (Inspector metadata)

### What’s implemented

- **`ViewModels/InspectorMetadataRowViewModel.cs`**: one row = **key** (read-only) + **ValueText** (editable).
- **`ViewModels/MainViewModel.InspectorMetadata.cs`**: `InspectorMetadataRows` is built for the **single** selected `PlacedAsset` by merging **definition** `MetadataTemplates` keys and **instance** `Metadata.Keys` (sorted).
- **`ApplyInspectorMetadataCommand`**: **`History.Push(...)`**, then **`CloneAsset(..., metadata: dict)`** storing the edited dictionary (`MainViewModel.CloneAsset` extended with optional metadata replace).
- **`InspectorMetadataEmptyVisible`** + caption when the merged key set is empty but one asset remains selected.

### Notes

- Metadata edits are independent of transform / Maße+Farb **Übernehmen** buttons.

## Phase 20 (Transform toolbar + gesture gating)

### What’s implemented

- **`Views/ToolbarView.xaml`**: **Transform** segment with three tools (**Verschieben / Drehen / Skalieren**) bound to `SetTransformToolCommand` (`TransformMode` enum via `x:Static`). Active tool shows an **accent border** (`IsTransformTranslateActive` / `Rotate` / `Scale`).
- **`MainViewModel`**: computed flags + `OnTransformModeChanged` notifications; status text updates when switching tools.
- **`Views/ViewportPanel.xaml.cs`**: drag gestures are **gated** by `MainViewModel.TransformMode` (**Translate** ↔ Shift+drag, **Rotate** ↔ Alt+drag, **Scale** ↔ Ctrl+Shift+drag), in addition to **Edit mode**.
- **`Views/ViewportPanel.xaml`**: legend text references the toolbar mode.

### Notes

- Presentation mode (`EditorMode.View`) still blocks transform drags via existing edit checks.

## Phase 21 (glTF material factor → viewport diffuse)

### What’s implemented

- **`Scene/ImportedMeshPart.cs`**: bundles `MeshGeometry3D` with optional diffuse RGB parsed from the primitive’s glTF material.
- **`Scene/GltfModelLoader.cs`**: For each primitive, reads **`FindChannel("BaseColor")`** (metallic roughness) or **`FindChannel("Diffuse")`** (Specular-Glossiness) and converts the channel **`Color`** (linear RGB factor) to sRGB-ish **WPF `Color`** bytes. **Textures are not sampled** — factor-only mapping for this phase.
- **`Scene/PlacedAssetVisualFactory.cs`**: Builds one **`GeometryModel3D`** per imported part with **`MaterialHelper.CreateMaterial`** per resolved color: **selection** still forces the accent tint (**`#7986CB`**); otherwise **factor RGB** wins when present, else **`PlacedAsset.ColorHex`** as before.
- **`Helpers/ColorHexHelper.cs`**: **`ToRgbHex`** for bridging WPF colors back into the existing hex brush path.

### Notes

- Cached imports include factor data in the **`ImportedMeshPart`** list keyed like geometry (path, mtime, target dimensions).

## Phase 22 (glTF baseColor / diffuse texture in viewport)

### What’s implemented

- **`Scene/GltfAlbedoResolver.cs`**: Reads **BaseColor** / **Diffuse** channels; decodes **`MemoryImage`** (PNG/JPEG/WebP via **`BitmapImage`**) from **`Texture.PrimaryImage`**. Returns factor RGB plus optional **`ImageSource`** and the channel’s **`TextureCoordinate`** set index.
- **`Scene/GltfModelLoader.cs`**: For each primitive with a decodable texture and matching **`TEXCOORD_N`** (`IMeshPrimitiveDecoder.GetTextureCoord`), fills **`MeshGeometry3D.TextureCoordinates`** with **V flipped** (\(1 - v\)) for glTF ↔ WPF bitmap convention. **`KHR_texture_transform`** (scale → rotate → offset) is applied in Phase 23 when present.
- **`Scene/ImportedMeshPart.cs`**: Optional **`BaseColorTexture`** (`ImageSource`) alongside **`BaseColorRgb`** (factor tint).
- **`Scene/PlacedAssetVisualFactory.cs`**: Uses **`ImageBrush`** + **`MaterialHelper.CreateMaterial`** for textured parts; **`ApplyBaseColorFactorTint`** walks **`MaterialGroup`** children and sets **`DiffuseMaterial.Color`** to approximate **factor × texture**. **Selection** still replaces materials with the accent tint.

### Notes

- Unsupported or undecodable images (e.g. **KTX2** without a decoder) fall back to **factor-only** / placement color when possible.
- Texture **sampler** wrap modes: see Phase 24.

## Phase 23 (`KHR_texture_transform` on base / diffuse UVs)

### What’s implemented

- **`Scene/GltfTextureUvTransform.cs`**: Applies **KHR_texture_transform** in **glTF UV space** before the WPF **V flip**: **scale** (component-wise), **rotation** (radians, CCW about origin), **translation** (**offset**).
- **`Scene/GltfAlbedoResolver.cs`**: Passes **`TextureTransform`** from the resolved **BaseColor** / **Diffuse** channel and honors **`TextureCoordinateOverride`** when choosing the **`TEXCOORD_*`** slot.
- **`Scene/GltfModelLoader.cs`**: Runs transformed UVs into **`MeshGeometry3D.TextureCoordinates`** for textured parts.

### Notes

- If **`TextureCoordinateOverride`** points at a missing UV set on the primitive, sampling falls back (no texture mapping) like any other mismatch.
- Sampler wrap / repeat behavior is unchanged from Phase 22 (**ImageBrush** tiling approximation).

## Phase 24 (glTF sampler wrap → `ImageBrush.TileMode`)

### What’s implemented

- **`Scene/GltfSamplerImageBrushMapping.cs`**: Maps **`TextureSampler.WrapS` / `WrapT`** (`TextureWrapMode`) to **`TileMode`**: **clamp+clamp** → **`None`** (single tile); **mirrored+mirrored** → **`FlipXY`**; **mirrored** on one axis → **`FlipX`** / **`FlipY`**; otherwise **`Tile`** (repeat/repeat or mixed repeat+clamp approximated as tiling).
- **`Scene/GltfAlbedoResolver.cs`**: Reads **`texture.Sampler`** for the resolved base/diffuse **`Schema2.Texture`** (defaults **REPEAT** when no sampler / sentinel wrap `0`).
- **`Scene/ImportedMeshPart.cs`**: **`BaseColorWrapS` / `BaseColorWrapT`** when a textured import is active.
- **`Scene/PlacedAssetVisualFactory.cs`**: Sets **`ImageBrush.TileMode`** from the mapping instead of always **`Tile`**.

### Notes

- WPF uses **one** `TileMode` for both UV axes; **mixed** wrap (e.g. clamp S + repeat T) is **approximated** as **`Tile`**.
- **Min/mag filter** mapping: see Phase 25.

## Phase 25 (glTF sampler min/mag → `BitmapScalingMode`)

### What’s implemented

- **`Scene/GltfSamplerBitmapScalingMapping.cs`**: Maps **`TextureSampler.MagFilter`** / **`MinFilter`** to **`BitmapScalingMode`**: **`NearestNeighbor`** when magnification is **NEAREST** or minification is **NEAREST** / **NEAREST_MIPMAP_NEAREST**; otherwise **`HighQuality`** (linear-ish upscaling).
- **`Scene/GltfAlbedoResolver.cs`**: Reads **`sampler.MagFilter`** / **`sampler.MinFilter`** (defaults **LINEAR** / **DEFAULT** when no sampler).
- **`Scene/ImportedMeshPart.cs`**: **`BaseColorBitmapScalingMode`** when texturing is active.
- **`Scene/PlacedAssetVisualFactory.cs`**: **`RenderOptions.SetBitmapScalingMode`** on the **`ImageBrush`** before **`Freeze`**.

### Notes

- **Mip chains** are not sampled in WPF like a GPU; **min filter** only influences the nearest-vs-smooth **bitmap scaling** heuristic above.
- Other **`TextureMipMapFilter`** values (e.g. **LINEAR_MIPMAP_LINEAR**) follow the **`HighQuality`** path.

## Phase 26 (glTF `doubleSided` → WPF back material)

### What’s implemented

- **`Scene/GltfModelLoader.cs`**: Reads **`Schema2.Material.DoubleSided`** per primitive (default **false** when the material is missing, matching glTF).
- **`Scene/ImportedMeshPart.cs`**: **`DoubleSided`** flag.
- **`Scene/PlacedAssetVisualFactory.cs`**: For each **`GeometryModel3D`**, sets **`BackMaterial`** to the same material only when **`DoubleSided`** is true **or** the instance is **selected** (selection still tints the full shell for visibility). When **false** and not selected, **`BackMaterial`** is **null** so WPF does not render the back side of the mesh (culling-style).

### Notes

- This is a **rasterization** approximation; it is not a full glTF **front-face** / winding test, but it matches the common “no back pass” reading of **`doubleSided: false`** for the viewport.

## Phase 27 (glTF alpha mode + base-color factor alpha)

### What’s implemented

- **`Scene/GltfAlbedoResolver.cs`**: Base color factor includes **alpha** (**`Vector4.W`**) via **`Color.FromArgb`**.
- **`Scene/GltfModelLoader.cs`**: Copies **`material.alpha`** (**`AlphaMode`**) and **`material.alphaCutoff`** per primitive (cutoff default **0.5** when absent, matching glTF).
- **`Scene/ImportedMeshPart.cs`**: **`AlphaMode`** + **`AlphaCutoff`** alongside **`BaseColorRgb`** (**`Color`** may carry **A &lt; 255**).
- **`Helpers/ColorHexHelper.cs`**: **`ToDiffuseBrush(Color)`** overload for brushes that preserve alpha.
- **`Scene/PlacedAssetVisualFactory.cs`**: **BLEND** uses full **factor** tint alpha on diffuse / textured paths; **OPAQUE** / **MASK** force **factor** tint **A = 255** for the multiplier (texture pixels can still carry alpha from PNG/JPEG). **Selection** remains an opaque accent.

### Notes

- **MASK** / **`alphaCutoff`** does **not** implement **alpha testing** (no per-pixel discard); textures may still show soft edges via bitmap alpha.
- **Viewport** transparency sorting for overlapping translucent meshes is **not** addressed (general WPF 3D limitation).

