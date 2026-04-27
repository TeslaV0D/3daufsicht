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
- ⏳ Next: Phase 3 (`DefaultAssets.cs` — 12 built-in templates)

