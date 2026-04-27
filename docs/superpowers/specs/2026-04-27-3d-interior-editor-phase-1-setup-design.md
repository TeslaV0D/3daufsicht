# 3D Interior Editor (Desktop, WPF) — Phase 1 Setup Design (Option A)

Datum: 2026-04-27  
Ziel: Reproduzierbares Repo-Setup (ohne System-SDK), WPF App-Skeleton (.NET 8), NuGet-Baseline, Dark Theme, build-/publish-fähig.

## 1. Scope & Definition of Done (Phase 1)

### In Scope
- Git-Repo-Struktur im Workspace `Interior-Planner` initialisieren.
- **Portable .NET 8 SDK** lokal im Repo unter `tools/dotnet/` installieren (kein Admin).
- `global.json` pinnt das SDK (für deterministische Builds).
- **Lokaler NuGet Package Ordner im Repo** via `NuGet.config` (`.nuget/packages`).
- WPF Solution/Projekt (NET 8, Windows Desktop) anlegen.
- NuGet-Pakete hinzufügen:
  - `HelixToolkit.Wpf`
  - `MaterialDesignThemes`
  - `MaterialDesignColors`
  - `CommunityToolkit.Mvvm`
  - `Microsoft.Xaml.Behaviors.Wpf`
  - `SharpGLTF.Core`
  - `SharpGLTF.Runtime.WPF`
- MaterialDesign **Dark Theme** in `App.xaml` aktivieren, Grundfarben gemäß Spec vorbereiten.
- `dotnet build` läuft erfolgreich über das lokale SDK.
- Publish-Command dokumentiert für Single-File Self-Contained `.exe` (Phase 1 nur verifizieren, nicht funktional ausbauen).
- `README.md` + `DOCUMENTATION.md` initial anlegen/auffüllen (gemäß Projektvorgabe “kein Phase-Abschluss ohne Doku”).

### Out of Scope (kommt später)
- HelixViewport3D Szene, Assets, MVVM-ViewModels, Services, Import, etc. (Phase 2+).
- Installer (NSIS/WiX), Dateiverknüpfungen.

### Definition of Done
- Repo enthält:
  - `tools/dotnet/` (lokales .NET 8 SDK)
  - `global.json`
  - `NuGet.config` (lokaler package folder)
  - WPF Solution + Projekt kompiliert
  - `README.md` + `DOCUMENTATION.md` existieren und beschreiben Build/Publish
- `dotnet --info` via lokalem SDK zeigt .NET 8 SDK.
- `dotnet build` und `dotnet publish ...` funktionieren ohne System-SDK.

## 2. Repository Layout (Phase 1 Zielstruktur)

Workspace-Root: `Interior-Planner/`

```
Interior-Planner/
├─ 3DInteriorEditor/                 # App Root (wie in Spezifikation vorgegeben)
│  ├─ 3DInteriorEditor.sln
│  ├─ src/
│  │  └─ 3DInteriorEditor.App/       # WPF App Projekt
│  │     ├─ 3DInteriorEditor.App.csproj
│  │     ├─ App.xaml
│  │     ├─ App.xaml.cs
│  │     ├─ Views/
│  │     │  └─ MainWindow.xaml
│  │     │     MainWindow.xaml.cs
│  │     └─ (weitere Ordner folgen ab Phase 2)
│  ├─ README.md                      # Projekt-README (repo-lokal)
│  └─ DOCUMENTATION.md               # Laufende Implementierungsdoku
├─ tools/
│  └─ dotnet/                        # Portable .NET 8 SDK (lokal)
├─ .nuget/
│  └─ packages/                      # NuGet global-packages folder (lokal im Repo)
├─ NuGet.config
├─ global.json
└─ docs/
   └─ superpowers/
      └─ specs/
         └─ 2026-04-27-...-design.md
```

Hinweise:
- Die Spezifikation des Users fordert eine Struktur unter `3DInteriorEditor/Models`, `ViewModels`, `Views`, etc.  
  Für Phase 1 wird **nur** das Projektgerüst angelegt; ab Phase 2 wird die Struktur in `src/3DInteriorEditor.App/` umgesetzt.
- Keine Datei > 400 Zeilen (Phase 1 unkritisch, aber bleibt als Leitplanke).

## 3. Tooling: Portable .NET 8 SDK im Repo

### Ziel
Build- und Publish-Fähigkeit ohne systemweit installiertes .NET SDK.

### Mechanik
- `tools/dotnet/` enthält:
  - `dotnet.exe`
  - SDKs/Runtime-Binaries für .NET 8
- Installation über Microsoft `dotnet-install.ps1` (Download, kein MSI).

### Aufruf-Konvention
In allen Doku-Beispielen wird **immer** das lokale dotnet verwendet:

- PowerShell:
  - `.\tools\dotnet\dotnet.exe --info`
  - `.\tools\dotnet\dotnet.exe build`

Optional (aber empfohlen) ein Wrapper-Script:
- `.\dotnet.ps1` ruft `.\tools\dotnet\dotnet.exe` auf, damit Commands kürzer sind.

## 4. NuGet: Packages im Repo halten

### Ziel
NuGet-Packages liegen nicht unter `%USERPROFILE%\.nuget\packages`, sondern unter `.nuget/packages` im Repo.

### Mechanik
`NuGet.config` im Repo-Root setzt:
- `globalPackagesFolder` = `.nuget\packages`

Wichtig:
- Das ist **Cache**. In Git wird standardmäßig **nicht** committed (groß), aber bleibt physisch “im Ordner” wie gewünscht.
- Falls du wirklich *alles* inklusive NuGet-Pakete versionieren willst, wäre das eine separate Entscheidung (nicht empfohlen).

## 5. WPF Project Baseline (.NET 8)

### Target Framework
- `net8.0-windows`
- `UseWPF=true`
- Nullable Reference Types: `Nullable=enable`

### MVVM Baseline
Phase 1 setzt nur die Abhängigkeiten, keine ViewModels.  
Ab Phase 2:
- `CommunityToolkit.Mvvm` mit `[ObservableProperty]`, `[RelayCommand]`
- Keine Business-Logik in Code-Behind.

## 6. UI Theme Baseline (MaterialDesign)

### Ziel
Dunkles, professionelles Theme initial aktiv.

### Mechanik (Phase 1)
- `App.xaml` lädt MaterialDesign ResourceDictionaries (Themes + Defaults).
- Grundfarben/Pallette werden als Ressourcen hinterlegt, so dass Phase 6+ UI konsistent wird.

### Palette (Ressourcen, nicht “Hardcode”)
Folgende Farben werden als `SolidColorBrush` Ressourcen angelegt (Namen TBD in Phase 1 finalisieren, aber hier vorgesehen):
- Hintergrund: `#0f1117`
- Panels: `#1a1d27`
- Elevated: `#242736`
- Hover: `#2d3147`
- Border: `#363a52`
- Text primary: `#e8eaf6`
- Text secondary: `#8c8fa8`
- Accent: `#5c6bc0`
- Accent hover: `#7986cb`
- Danger: `#ef5350`
- Success: `#66bb6a`

## 7. Build & Publish (Phase 1 Dokumentation)

### Build
- `.\tools\dotnet\dotnet.exe build 3DInteriorEditor\3DInteriorEditor.sln -c Debug`

### Publish (Single-file self-contained exe)
Ziel (wie User-Spec):
- Runtime: `win-x64`
- `--self-contained true`
- `PublishSingleFile=true`
- `EnableCompressionInSingleFile=true`

Command (Dokumentationsform):
- `.\tools\dotnet\dotnet.exe publish 3DInteriorEditor\3DInteriorEditor.sln -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true`

Hinweis:
- Single-file WPF Self-contained ist groß; das ist ok.
- Phase 1 prüft nur, dass Publish durchläuft und ein `.exe` erzeugt.

## 8. Git & Commit-Konvention (Projektvorgabe)

### Branching
- Alles geht auf `main` (keine Feature-Branches).

### Commit Message
- Phase 1 Abschluss: `[Phase 1] WPF project setup + local .NET 8 SDK + MaterialDesign theme`

### Doku-Gate
Kein Phase-Abschluss ohne:
- `README.md` aktualisiert
- `DOCUMENTATION.md` ergänzt

## 9. Risiken / offene Punkte (bewusst für Phase 1)

- **SDK Download**: `dotnet-install.ps1` zieht aus dem Internet; muss erreichbar sein.
- **Repo ist derzeit leer**: Es wird ein neues Repo aufgebaut (keine Migration bestehender Web-App Dateien).
- **NuGet im Repo**: `.nuget/packages` kann sehr groß werden; wird standardmäßig ignoriert.

