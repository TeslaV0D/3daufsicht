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

- Imported mesh paths (`AssetDefinition.ImportedModelPath`) are not rendered yet — definitions still draw as primitives using instance dimensions.

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

