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

- Undo/Redo + 3D interaction are still placeholders; wiring to `HistoryService` and the viewport comes in later phases.

