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

