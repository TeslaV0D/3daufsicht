# 3D Interior Editor (Desktop)

Native Windows desktop app for interactive 3D interior / factory layout planning.

## Build (local portable SDK)

From repo root:

```powershell
.\dotnet.cmd build .\3DInteriorEditor\3DInteriorEditor.sln -c Debug
```

## Publish (single-file, self-contained)

```powershell
.\dotnet.cmd publish .\3DInteriorEditor\3DInteriorEditor.sln -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true
```

## Status

- ✅ Phase 1: project setup, local .NET 8 SDK + NuGet cache, WPF scaffold, MaterialDesign dark theme baseline
- ✅ Phase 2: `Constants.cs`, enums, and persisted layout models (`Models/*`)
- ✅ Phase 3: `Data/DefaultAssets.cs` built-in library templates (IDs + categories + defaults)
- ✅ Phase 4: `Services/*` file IO + auto-save loop + undo/redo history (no UI wiring yet)
- ✅ Phase 5: MVVM skeleton (`MainViewModel`, `AssetLibraryViewModel`, `InspectorViewModel`) + window composition
- ✅ Phase 6: main window chrome (menu, 48px toolbar, 240/280 sidebars, status bar) + Asset Library / Inspector panels bound to VMs
- ✅ Phase 7: `HelixViewport3D` viewport host + built-in orbit / pan / zoom (reference grid + coordinate triad)
- ✅ Phase 8: scene sync for `PlacedAssets` (primitive shapes via Helix), double-click library to place, Strg+click pick → inspector
- ⏳ Next: transforms / gizmos, mesh import rendering, undo-redo UX

