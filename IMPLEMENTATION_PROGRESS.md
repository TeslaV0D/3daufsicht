# Implementierungsdokumentation: 3D Factory Planner

## Projektziel

Interaktive 3D-Planungsapplikation fuer Hallen-/Fabriklayout mit City-Skylines/SIMS-aehnlicher Bedienung und modernem Look, mit klarer Trennung zwischen Edit- und Praesentationsmodus.

## Stand 1: MVP-Grundlage

- React + TypeScript + Vite App unter `planner-app`.
- 3D-Szene mit `three.js`, `@react-three/fiber`, `@react-three/drei`.
- Kamera: Zoom / Pan / Orbit, Kamera-Presets (Perspektive, Top, Front, Seite).
- Asset-Workflow: Bibliothek, Platzieren, Einzel-/Mehrfachauswahl, Loeschen.
- Inspector: Position/Rotation editierbar, Metadaten editierbar.
- Persistenz: Speichern/Laden in `localStorage`.

## Stand 2: Stabilisierungen

- `TransformControls` sauber an selektiertes Mesh gebunden; `OrbitControls` waehrend Drag deaktiviert.
- Robuste Input-Validierung (`parseFiniteInput`, `isVector3Tuple` mit `Number.isFinite`).
- Kontrollierte Inspector-Eingaben mit Draft-State (Commit nur bei gueltigen Werten).

## Stand 3: Erweiterungen (Formen + Produktionsobjekte)

- Grundformen: Rechteck, Kreis.
- Produktionsnahe Assets: Produktionslinie, Hubwagen, Angestellte, Kisten.
- Farbe und Groesse (X/Y/Z) pro Instanz anpassbar.

## Stand 4: Visual Upgrade + Steuerungsanpassung

- `ALT` ersetzt durch `STRG/CMD` fuer freie Platzierung/Bewegung.
- Neue Komponenten: `Lighting.tsx`, `FactoryFloor.tsx`, `FactoryWalls.tsx`.
- HDRI-Environment (`warehouse`), weichere Kamera (`enableDamping`, `zoomToCursor`).

## Stand 5: Unified Asset System + Praesentationsmodus (View Mode)

### Datengetrieben

- Einheitliches `Asset`-Datenmodell (`src/types/asset.ts`): `type`, `category`, `position`, `rotation`, `scale`, `color`, `geometry { kind, params }`, `metadata { name, description, zoneType, text, customData }`, `visual { opacity, emissive, hoverEffect, ... }`.
- `AssetFactory` (`src/AssetFactory.ts`) mit Templates fuer: Primitive 3D (Box, Sphere, Cylinder, Cone, Torus, Hexagon), Primitive 2D (Plane, Circle, Ring), Produktion, Logistik, Zonen (als Plane-Assets mit Opacity), Wege, Labels.
- Keine hardcodierten Zonen/Wege mehr.
- `useAssetsStore.ts` kapselt State, History (Undo/Redo), Selection, Clipboard, Persistenz.

### Komponenten

- `AssetRenderer.tsx` — universeller Renderer fuer alle Geometrien + GLB/GLTF (`useGLTF`).
- `AssetInfoModal.tsx` — Floating Modal fuer View Mode.
- `ViewModeOverlay.tsx` — staerkeres Lighting fuer Praesentation.

### Save/Load

- Versionierte Payload unter `factory-layout` in `localStorage`:
  ```ts
  { version: 2, assets: Asset[], customTemplates?: AssetTemplate[] }
  ```
- Vollstaendige Validierung (`sanitizeAsset` + `sanitizeVector3` + `sanitizeColor`).
- Rueckwaertskompatibel zu altem Array-Format.

## Stand 6: Bugfixes Popup + Inspector

- `AssetInfoModal`: Outside-Click und ESC schliessen das Popup sauber; `stopPropagation` auf Modal-eigenem Click.
- Inspector und Library-Panel werden **immer** gemountet — Visibility nur ueber CSS (`workspace.view-mode .panel { opacity: 0; pointer-events: none; }`). Dadurch verschwindet der Inspector nach Mode-Wechsel nicht mehr.
- Mode-Badge `EDIT MODE` / `VIEW MODE` mit farblichem Akzent und Glow.
- Smooth Transitions (Fade + Grid-Columns-Animation).
- Modal-Animation (Scale + Fade Entry), `max-height` + Scroll.
- Pointer-Cursor im View Mode.

## Stand 7: Mode-Separation + Layout-Fixes

### Saubere Inhalte im View-Mode-Popup

- `AssetInfoModal` zeigt **nur semantische Informationen**: Name, Kategorie, Zone-Typ, Beschreibung, Custom Metadata. Keine Transform-Daten (Position, Rotation, Scale, Typ-ID, Geometry-Kind).

### Layout ohne Scroll

- `html, body, #root { height: 100%; overflow: hidden; }`.
- `.planner-shell { height: 100vh; max-height: 100vh; overflow: hidden; }`.
- `.workspace`, `.scene-wrapper` und `canvas` auf feste Fuellhoehe/-breite (`height: 100%`, `width: 100%`).
- Top-Bar darf umbrechen (`flex-wrap: wrap`) ohne die Shell zu strecken (`flex: 0 0 auto`).
- Responsive-Fallbacks mit `minmax(0, ...)` und Panel-`max-height`.

### Kamera-Reset bei Mode-Wechsel

- `<OrbitControls key={`orbit-${mode}`} ... />` erzwingt harten Reset.
- Pro Mode eigene Parameter:
  - View: `dampingFactor: 0.1`, `minDistance: 4`, `maxDistance: 120`, ruhigere `rotateSpeed`/`zoomSpeed`.
  - Edit: bisherige Werte (0.08 damping, 6–85 distance).

## Stand 8: Text-Labels, Datei-Persistenz, Hover-Fix, Docs

### Editierbare Text-Labels

- `metadata.text` im `AssetMetadata`-Schema ergaenzt (`src/types/asset.ts`), mit Sanitizer.
- `AssetRenderer` zieht fuer `geometry.kind === 'text'` zuerst `asset.metadata.text`, dann `geometry.params.text`, dann `'Label'`.
- Default-Template `label-text` legt den Text jetzt in `metadata.text` ab statt in `params.text`.
- Inspector zeigt fuer Text-Assets ein `Textinhalt`-Feld (max. 160 Zeichen), Live-Update im Rendering.

### Datei-basiertes Save / Load

- Neue Store-API (`useAssetsStore.ts`):
  - `slots`, `saveSlot(name)`, `loadSlot(id)`, `deleteSlot(id)`, `renameSlot(id, name)` — mehrere benannte Layouts in `localStorage` unter `factory-layout-slots`.
  - `exportLayout(suggestedName?)` — laedt das aktuelle Layout als `.json` runter (Blob + `a.download`).
  - `importLayoutFromFile(file)` / `importLayoutFromData(data)` — FileReader + Validierung.
- Neue Komponente `LoadLayoutModal.tsx`:
  - Button "Auto-Layout laden" (entspricht altem `load()`).
  - Liste gespeicherter Slots (laden, umbenennen, loeschen).
  - "Datei auswaehlen" fuer externe `.json`-Imports.
- Toolbar-Buttons:
  - `Speichern` → Auto-Slot.
  - `Als Slot` → benannter Slot.
  - `Laden` → oeffnet Modal.
  - `Export` → `.json`-Download.

### Hover-Stabilitaet

- `AssetRenderer` nutzt jetzt `onPointerEnter` / `onPointerLeave` (statt `onPointerOver` / `onPointerOut`).  
  Folge: Keine wiederholten Enter/Leave-Events bei Mausbewegung innerhalb des Asset-Subtrees — Hover-State flickert nicht mehr.
- `PlannerApp` verwendet `setHoveredId((current) => current === asset.id ? current : asset.id)`, um unnoetige Re-Renders zu vermeiden.

### Dokumentation

- `README.md` und `IMPLEMENTATION_PROGRESS.md` aktualisiert mit den neuen Features und Bedienung.

## Relevante Dateien

- `planner-app/src/PlannerApp.tsx` — Hauptlogik, Modus, Tools, Inspector, Toolbar, Modals.
- `planner-app/src/AssetFactory.ts` — Templates + Kategorien + Demo-Layout.
- `planner-app/src/store/useAssetsStore.ts` — State-Hook, History, Persistenz, Slots, Import/Export.
- `planner-app/src/types/asset.ts` — `Asset`-Typen, Sanitizer, Fallbacks.
- `planner-app/src/components/AssetRenderer.tsx` — universeller 3D-Renderer (alle Geometrien, Text, GLB).
- `planner-app/src/components/AssetInfoModal.tsx` — semantisches View-Mode-Popup.
- `planner-app/src/components/LoadLayoutModal.tsx` — Load/Import-Dialog.
- `planner-app/src/components/ViewModeOverlay.tsx` — View-Mode-Lighting.
- `planner-app/src/components/Lighting.tsx`, `FactoryFloor.tsx`, `FactoryWalls.tsx` — Szenen-Bausteine.
- `planner-app/src/App.css` — modernes UI-Layout, Transitions, Modals, Mode-Badge.
- `planner-app/src/index.css` — globale Basisstile, Kein-Scroll-Layout.

## Test- und Qualitaetsstand

Ausgefuehrte Checks:

- `npm run lint`
- `npm run build`

Ergebnis: beide Checks erfolgreich.

## Stand 9: STL-Import

### Erweiterte Dateiformate

- Upload erlaubt jetzt `.glb`, `.gltf` und `.stl` (Validierung per Extension, Groessenlimit 20 MB, fehlerfreundliches Toast-Feedback).
- `GeometryParams` um `modelFormat: 'gltf' | 'glb' | 'stl'` erweitert; `AssetVisual` um `flatShading` fuer CAD-Optik.
- `createCustomModelTemplate(name, url, { modelFormat })` legt das Format persistent im Template ab — Save/Load und Slots bleiben kompatibel.

### STLModel-Komponente

- Neue Komponente `STLModel` in `AssetRenderer.tsx` laedt per `useLoader(STLLoader, url)` aus `three/examples/jsm/loaders/STLLoader`.
- Post-Processing beim Laden:
  - `computeVertexNormals()` (falls fehlend oder Flat Shading erzwungen).
  - `computeBoundingBox()` + `center()` fuer Ursprungs-Centering.
  - Automatische Skalierung auf `asset.scale` (max-Dim-Normalisierung).
  - Y-Offset so, dass das Modell auf dem Boden sitzt.
- Standard-`meshStandardMaterial` (grau default, Farbe aus Asset). `wireframe` und `flatShading` reagieren live auf die Inspector-Toggles.

### Renderer-Integration

- `'custom'`-Case in `GeometryMesh` verzweigt nach `modelFormat`:
  - STL → `<STLModel />`
  - GLB/GLTF → bestehendes `<UploadedModel />` (drei/`useGLTF`).
- Fallback-Box bleibt fuer beide Pfade gleich (Suspense-Fallback).

### Inspector-Erweiterung

- Fuer `geometry.kind === 'custom'` neuer Abschnitt "Modell-Optik" mit:
  - **Wireframe**-Toggle (GLB/GLTF + STL).
  - **Flat Shading**-Toggle (nur STL).
- Beide werden in `asset.visual` persistiert und fliessen in die Material-Config.

### Kompatibilitaet

- STL-Assets sind voll in das bestehende System integriert: auswaehlbar, transformierbar (Gizmo), Save/Load (data-URL-persistent), View-Mode-Popup, Hover-Feedback.

## Stand 10: Bibliotheks-Gruppen, Submesh-Hover, Shortcuts-UI

### Abgeschlossen

- **Asset-Gruppen (anklappbar)**: Template-Kategorien in der linken Bibliothek mit Chevron-Toggle; Zustand in `localStorage` (`factory-template-group-expanded`); CSS-Uebergang fuer Hoehe/Opacity.
- **Hover (Ergaenzung zu Stand 8)**: Zusaetzlich Debounce beim Pointer-Leave in `PlannerApp` (50 ms), damit Wechsel zwischen GLTF-Submeshes `hoveredId` nicht mehr flattern.
- **Unten-Leiste entfernt**: Edit-Modus ohne Shortcuts-Zeile unten; Speicher-Feedback als Toast (`.save-feedback-toast`); View-Hint fuer Praesentationsmodus leicht nach oben versetzt, um Platz fuer den Toast zu lassen.
- **Datenmodell**: Optionales `groupId` auf `Asset`; beim Platzieren aus Template wird `groupId` auf `template.category` gesetzt; `sanitizeAsset` / `cloneAsset` kompatibel.

### Details

- Gruppen expandierbar/kollabierbar; nur expanded zeigen die Template-Buttons.
- Shortcuts ausschliesslich im Modal (bestehende `ShortcutsModal`-Daten, keine Duplikation der Listen-Logik).

## Stand 11: Bibliothek-Defaults, Custom-Delete, Ghost, Umlaute, Lock-Glow, Lighting-Panel

### Abgeschlossen

- **Gruppen standardmäßig aufgeklappt**: `localStorage` unter `factory-template-group-expanded` speichert nur noch **eingeklappte** Kategorien (`true`); fehlender Key = aufgeklappt. Migration: alte Einträge mit Wert `false` (eingeklappt) werden übernommen.
- **Eigene Vorlagen löschen**: Pro Eintrag in „Eigene Assets“ (und andere Custom-Templates) ein **×**-Button; Bestätigungsdialog; `removeCustomTemplate` entfernt Vorlage und **alle** Szene-Instanzen dieses `type`; persistiert über Save/Export wie bisher.
- **Placement-Ghost**: höhere Opazität, Asset-Farbe leicht abgedunkelt, **Emissive** aus Template-Farbe (sichtbarer „Glow“).
- **Umlaute**: UI-Strings und `lang="de"` in `index.html`; Kategorie „Wände“ und Beschreibungstexte mit **ä/ö/ü/ß** wo sinnvoll.
- **Gesperrte Assets heller**: Primitive + GLTF: Aufhellung statt Abdunklung; dezentes Dauer-Emissive im Idle-Zustand.
- **Beleuchtung**: `LightingSettings` im Store, **STORAGE_VERSION 5**, Save/Load/Slots/Export; Toolbar **„Beleuchtung“** mit Popover (Typ Directional/Point/Spot, Intensitäten, Farben, Position, Schatten, HDRI-Stärke, Presets). `Lighting.tsx` steuert Edit- und Präsentationsmodus (letzterer behält Zusatz-Fill-Lights).

## Stand 12: Bibliothek-Organisation (User-Gruppen, Favoriten, DnD) + Lighting-Z-Index

### Abgeschlossen

- **Beleuchtungs-Popover**: `.top-bar` und `.toolbar-popover.lighting-popover` mit höherem `z-index` über der Workspace-/Canvas-Ebene; Modals (`layout-modal`, Shortcuts, „Neue Gruppe“-Dialog) mit noch höherem `z-index`, damit sie sichtbar bleiben.
- **`libraryOrganization`**: User-definierte Gruppen (`userGroups`), Zuordnung `templateTypeToUserGroup`, Favoriten-Liste `favoriteTemplateTypes`; **STORAGE_VERSION 6** inkl. Save/Load/Slots/Import/Export/Reset.
- **`buildLibrarySections`** (`src/types/libraryOrganization.ts`): Reihenfolge **Favoriten** → User-Gruppen → eingebaute Kategorien (ohne an User-Gruppen vergebene Types).
- **UI** (`PlannerApp.tsx`): „+ Neue Gruppe“, Modal, Stern-Toggle, Gruppen-Dropdown, Drag & Drop auf Gruppen (Favoriten ohne Drop-Zuweisung), Löschen von User-Gruppen mit Bestätigung bei zugeordneten Vorlagen.
- **Styles**: Bibliothek-Toolbar, Favoriten-Button, Gruppen-Select, Drop-Highlight, Gruppen-Dialog in `App.css`.

## Stand 13: Präsentations-Toolbar, Bibliotheks-Kontextmenü, kompakte Liste

### Abgeschlossen

- **Präsentation**: Top-Bar zeigt nur `VIEW MODE`, **Präsentation beenden (ESC)** und die vier Ansichten (ohne Cabinet); Speichern/Laden/Export/Beleuchtung/Edit-Aktionen ausgeblendet; Shortcuts-FAB nur im Edit-Modus. Bei Wechsel in die Präsentation wird eine aktive **Cabinet**-Ansicht auf **Perspektive** gesetzt.
- **ESC in View**: schließt zuerst das Asset-Info-Popup, sonst Rückkehr in den Bearbeiten-Modus.
- **Bibliothek**: Stern-Icon entfernt; **⋮**-Menü (fixed, z-index 2400) mit Favorit, Meta-Bearbeitung, Gruppen-Dialog, 3D-Vorschau (`TemplatePreviewDialog`), Duplikat in die Szene, Details-Dialog, Löschen nur für eigene Uploads.
- **`templateDisplayOverrides`** in `libraryOrganization` für Anzeige/Meta eingebauter Vorlagen; eigene Vorlagen werden direkt in `customTemplates` geändert (`updateTemplateLibraryMeta` im Store).
- **Liste**: keine Maßangaben mehr in der Zeile; Styles für Kontextmenü, Meta-/Gruppen-/Details-Dialoge, Vorschau in `App.css`.

## Stand 14: Kontextmenü-Layout, Batch-Import, OBJ/FBX, Gruppe „Eigene Assets“

### Abgeschlossen

- **Kontextmenü**: Icon-Spalte 24px, 12px Abstand zum Label, Padding 10×12px, Hover-Zeile `#2a2a2a`, Danger-Hover dunkelrot; Gruppierungs-Divider zwischen Favorit / Organisation / Aktionen / Löschen.
- **„+ Importieren“**: Mehrfach-Dateiauswahl; `importCustomModelTemplatesBatch` im Store; Loading-State; Toasts bei Erfolg/Fehler; Formate **OBJ** und **FBX** zusätzlich (Renderer: `OBJLoader` / `FBXLoader`, Normierung wie STL).
- **Bibliotheks-Gruppe**: feste ID `ug-eigene-assets-import`, `isSpecial`, nicht löschbar; Reservierung des Namens für „Neue Gruppe“; `mergeLibraryOrgWithUserTemplates` / Migration für `isUserAsset`-Vorlagen ohne Zuordnung.
- **`AssetTemplate`**: optionale Felder `isUserAsset`, `createdAt`; Gruppen-Dialog listet „Eigene Assets“ explizit; Details-Dialog zeigt Import-Datum.

## Stand 15: Import neben „Eigene Assets“, Start-Zustand Bibliothek, Export-Modi

### Abgeschlossen

- **Import-Button**: `+` nur bei der Gruppe **Eigene Assets** (Tooltip „Asset importieren“), Dateiauswahl GLTF/GLB/OBJ/FBX/STL; Mehrfach-Import; kein separater Import in der Toolbar.
- **Gruppe „Eigene Assets“**: feste Position **unten**; `ensureEigeneAssetsUserGroup` / Sortierung in `buildLibrarySections` angepasst; eingebaute Kategorien in fester Reihenfolge (`BUILTIN_LIBRARY_SECTION_ORDER`).
- **Startup**: alle Bibliotheks-Sektionen **zu**; Persistenz `factory-library-section-expanded-v2` (nur `true` = ausgeklappt); Favoriten oeffnen sich nicht automatisch beim Hinzufuegen.
- **Entfernt**: Checkbox „Import unter Wände kategorisieren“.
- **Export** (`ExportLayoutModal` + Store): **Nur Workspace** vs. **Komplette Konfiguration** (`exportKind`, Timestamp-Dateinamen); Complete inkl. `shellMode`, `librarySectionExpanded`; Workspace-Import (`applyWorkspacePayload`) laesst Bibliothek bestehen und merged nur noetige `customTemplates`.
- **Kontextmenü**: Eintrag „Aus Bibliothek löschen“ → Label **Löschen** (weiterhin nur fuer eigene Uploads).

### Optionale Erweiterungen (priorisierte Ideen)

1. Tastaturkuerzel erweitern (Lock, Favorit, Color Picker) + Shortcuts-Modal.
2. Asset-Suche in der Bibliothek.
3. Undo/Redo fuer Nicht-Transform-Aktionen.
4. Multi-Select & Batch-Ops.
5. Alignment-Tools.
6. Snap-to-Grid konfigurierbar.
7. Live-Messungen / Koordinaten.
8. Kategorie-Farben.
9. „Zuletzt verwendet“-Gruppe.

## Stand 16: Toolbar-Popovers, Bibliothek klonen, globales ESC, UI-Feinschliff

- **Stacking / Z-Index**: `.top-bar` mit `z-index: 1000` über `.workspace` (`0`); `scene-wrapper` / Canvas `0`; `.panel` `500`; Modals `2000`; Shortcuts-Overlay `2500`; Shortcuts-FAB `2490`; Bibliotheks-Kontextmenü `1000` — Werkzeuge- & Beleuchtungsmenüs nicht mehr hinter dem Canvas. **Ursache** war die DOM-Reihenfolge (Workspace nach Top-Bar ohne eigene Stapelreihenfolge).
- **Menü-Animation (⋮ Werkzeuge / Beleuchtung)**: Flackern und horizontaler Sprung beim Öffnen behoben — Positions-Layout **synchron** in `useLayoutEffect` (Reflow `offsetHeight`, Höhe-Fallback `scrollHeight`, zweiter Layout-Durchlauf), Fade-In nur über **`opacity` 0→1** (`0.15s ease-out`, danach `pointer-events: auto`); kein verschachteltes `requestAnimationFrame` mehr für die Position.
- **⋮ Werkzeuge / Beleuchtung**: Popover am Button verankert (`getBoundingClientRect`, viewport-aware, max. Höhe mit Scroll); Klasse `toolbar-popover--anchored`.
- **Cabinet-Ansicht** entfernt; alte `cameraView: cabinet` in Saves → Perspektive (`normalizeCameraViewPreset`).
- **User-Gruppe**: Zuordnen per DnD/Dialog erzeugt **Kopie** (`cloneTemplateToUserGroup`, Label „… (Kopie)“); Standard-Kategorie ohne Duplikat (`assignTemplateToUserGroup(…, null)`).
- **Leere User-Gruppen** bleiben; „(leer)“ im Titel; Gruppe löschen immer mit Bestätigung.
- **ESC**: zentral im Planner (`keydown`, `capture: true`); Farbwähler-Stack `planner-app/src/colorPickerEscapeStack.ts`; schichtweise: Picker → Vorschau → Laden/Export → Bibliotheksdialoge → Shortcuts → View-Info → Kontextmenü → Toolbar-Menüs → Boden-Inspector → Suche → Modus; redundante ESC-Listener in mehreren Modals entfernt.

### Dokumentation

- Projekt-Chronik nur noch in dieser Datei **`IMPLEMENTATION_PROGRESS.md`** (Root). Der Ordner **`docs/`** wurde entfernt.

## Offene optionale Erweiterungen

- Box-Selection fuer Mehrfachauswahl.
- Kollisions-/Abstandsregeln zwischen Assets.
- Screenshot/PDF-Export aus View Mode.
- Animationspfade fuer bewegliche Assets.
