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

### Fertige Desktop-App (ein Doppelklick, keine .NET-Installation)

Im **Repository-Root** (`Interior-Planner`) liegt **`publish-app.cmd`**. Einmal ausführen (Doppelklick oder in PowerShell):

```text
.\publish-app.cmd
```

Damit wird unter **`artifacts\DesktopApp\`** eine **selbstständige** Windows-x64-Variante gebaut (**.NET-Laufzeit und Abhängigkeiten** sind in der **Single-File**-EXE enthalten bzw. werden beim Start automatisch entpackt — **kein** `dotnet run` und **kein** SDK auf dem Zielrechner nötig).

**Endnutzer:** den Ordner **`artifacts\DesktopApp`** komplett weitergeben (z. B. als ZIP) und **`3DInteriorEditor.App.exe`** starten. Neben der EXE können Hilfsdateien liegen (z. B. `samples\`); den **ganzen Ordner** mitgeben, nicht nur die eine Datei.

**Hinweis:** Zum **Bauen** brauchst du weiterhin das portable SDK unter `tools\dotnet\` (siehe Phase 1 in `DOCUMENTATION.md`). Das ist nur auf dem **Entwickler-PC** nötig, nicht beim Anwender.

## Steuerung (Blender-ähnlich)

- **Kamera:** MMB drehen · **Shift+MMB** schwenken · **Mausrad** zoomen · optional **Zoom am Mauszeiger** in den Einstellungen · **Home** alles einpassen · **F** / **Num .** Auswahl einpassen · **Num 7/1/3** orthogonale Ansichten · **Num 0** Standard-Perspektive.
- **Auswahl:** **LMB** ersetzt die Auswahl · **Shift+LMB** toggle · **Alt+LMB** alle gleiche Vorlage · Klick ins Leere deselektiert · **A** alles auswählen / nichts (toggle) · **B** Box Select · **C** Circle Select · **/** Local View (Isolate) · **RMB** Kontextmenü.
- **Transform:** **G / R / S** · dann ziehen · **Shift+X** / **Shift+Z** Verschieben nur auf Welt-X bzw. Welt-Z (Boden-Ebene XZ).
- **Datei:** **Strg+Shift+I** glTF/glB-Import (neue Vorlage + Platzierung) · **Strg+Shift+E** JSON-Export des Layouts · **Strg+,** Einstellungen (UI-Skalierung, Zoom-Option).
- **Esc** beendet Box-/Circle-Modus und hebt Achsen-Lock auf.

Details: `DOCUMENTATION.md` → **Blender-style viewport & workspace shell** und die folgenden Unterabschnitte (Box/Circle, Isolate, Import/Export, Einstellungen).

## Status

- ✅ Phase 1: project setup, local .NET 8 SDK + NuGet cache, WPF scaffold, MaterialDesign dark theme baseline
- ✅ Phase 2: `Constants.cs`, enums, and persisted layout models (`Models/*`)
- ✅ Phase 3: `Data/DefaultAssets.cs` built-in library templates (IDs + categories + defaults)
- ✅ Phase 4: `Services/*` file IO + auto-save loop + undo/redo history (no UI wiring yet)
- ✅ Phase 5: MVVM skeleton (`MainViewModel`, `AssetLibraryViewModel`, `InspectorViewModel`) + window composition
- ✅ Phase 6: main window chrome (menu, 48px toolbar, 240/280 sidebars, status bar) + Asset Library / Inspector panels bound to VMs
- ✅ Phase 7: `HelixViewport3D` viewport host + built-in orbit / pan / zoom (reference grid + coordinate triad)
- ✅ Phase 8: scene sync for `PlacedAssets` (primitive shapes via Helix), double-click library to place, Strg+click pick → inspector
- ✅ Phase 9: undo/redo UX (`HistoryService`: snapshot before placement, toolbar + Bearbeiten menu + Strg+Z / Strg+Y)
- ✅ Phase 10: selection model (selected ids in `MainViewModel`), Ctrl+click toggle selection, viewport highlight + inspector selection list
- ✅ Phase 11: keyboard transforms (move/rotate/delete) with undo snapshots + inspector shows pos/rot
- ✅ Phase 12: duplicate selection (Ctrl+D) + fine move/rotate steps (Shift modifiers) + toolbar/edit menu shortcuts
- ✅ Phase 13: inspector transform editor (single selection) with apply/reset, invariant number parsing, history on apply
- ✅ Phase 14: glTF/glB mesh import rendering (`ImportedModelPath`), path resolution vs layout + app `samples/`, uniform fit to instance dimensions, built-in sample cube asset
- ✅ Phase 15: viewport drag translate (Shift+Drag) on XZ plane with undo snapshot + inspector live update
- ✅ Phase 16: viewport drag rotate yaw (Alt+Drag) with undo snapshot + inspector live update
- ✅ Phase 17: viewport drag uniform scale (Strg+Umschalt+Drag) with undo snapshot
- ✅ Phase 18: inspector dimensions + color (#RRGGBB), palette swatches, undo on apply (single selection)
- ✅ Phase 19: inspector metadata key/value editor (template + instance keys), undo on apply (single selection)
- ✅ Phase 20: toolbar transform modes (translate / rotate / scale) + viewport drag gestures gated by active mode
- ✅ Phase 21: glTF **baseColor** / **diffuse** **factor** → per-part viewport diffuse
- ✅ Phase 22: glTF **baseColorTexture** / **diffuseTexture** + UVs (`TEXCOORD_*`) → **ImageBrush** viewport materials (factor tint multiply approximated)
- ✅ Phase 23: **KHR_texture_transform** (scale/rotate/offset + optional `texCoord` override) on base/diffuse UVs
- ✅ Phase 24: glTF **sampler wrap** (S/T) → WPF **`ImageBrush.TileMode`** (mixed axes approximated)
- ✅ Phase 25: glTF **sampler min/mag** → **`RenderOptions.BitmapScalingMode`** on **`ImageBrush`** (nearest vs smooth heuristic; no GPU mips)
- ✅ Phase 26: glTF **`doubleSided`** → **`GeometryModel3D.BackMaterial`** only when double-sided or **selected** (single-sided culling style)
- ✅ Phase 27: glTF **`AlphaMode`** + **`alphaCutoff`** stored; **BLEND** uses base-color factor **alpha** on diffuse (MASK cutout / depth sort not implemented)
- ⏳ Next: further polish / UX (per-axis wrap if needed, …)

