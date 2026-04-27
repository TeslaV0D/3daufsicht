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

