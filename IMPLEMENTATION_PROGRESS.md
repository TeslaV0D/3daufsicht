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

## Stand 18: Decals, Metadata-Fix, editierbare Feldnamen, Inspector-Hilfen

### Abgeschlossen

- **Bilder / Decals** auf Assets: Texturflächen (Plane + `TextureLoader`) auf gewählter Seite relativ zur Bounding-Box; Parameter Größe, Deckkraft, Offsets, Rotation, Seite; Speicherung in `AssetVisual.decals` (max. 6 Einträge in Sanitize; UI aktuell ein Haupt-Decal).
- **Inspector (? )-Tooltips** (`InspectorHint`, CSS `data-tooltip`) an Farbe, Deckkraft, Sperre, Info-Feldern, Custom Metadata, Decal-Bereich; `ColorPickerPopover` mit optionalem `hint`.
- **Metadata löschen repariert**: `updateAsset` / `updateAssets` mergen `customData` nicht mehr per Spread (entfernte Keys kamen zurück); `mergeAssetMetadata` ersetzt `customData` / `customRows` ganz, wenn im Patch gesetzt.
- **Eigene Namen für Metadata**: `CustomMetadataRow` mit `id`, editierbarem `name`, `value`; `getCustomRows` + Migration aus `customData`; UI Klick auf Feldname → Inline-Edit.
- Hilfsmodul `scene/assetDecalBounds.ts` für Decal-Placement; `AssetInfoModal` nutzt `getCustomRows`.

### Kurzüberblick Features

- Decal-System mit parametrierbarer Fläche (Bounding-Approximation).
- Platzsparende Feldhilfen im Inspector.
- Metadata vollständig löschbar und umbenennbar.

## Stand 19: Globale Info-Icons, Core-Metadaten bearbeiten, Metadata-Layout

### Abgeschlossen

- **Info-Icons überall**: Wiederverwendbare `InfoIcon`-Komponente; zentrale Kurztexte in `planner-app/src/ui/fieldDescriptions.ts`. Erklärungen nur noch als (?)-Tooltip (Hover/Fokus), keine langen `panel-hint`-Absätze an denselben Stellen — u. a. Inspector, Asset-Bibliothek, Vorlagen-Details, Export/Laden, Vorschau, Beleuchtungs-Popover, Boden-Inspector, Mehrfachauswahl.
- **Core-Metadaten**: Name, Beschreibung und Zonen-/Typ im Inspector mit **✎** (Speichern / Abbrechen / Leeren); Zonen-/Typ mit **datalist**-Vorschlägen aus der Szene plus Freitext; **×** zum schnellen Leeren. `patchSimpleMetadata` normalisiert leere Strings zu `undefined` (Felder wirklich leer).
- **Custom Metadata-Layout**: Name und Wert in **einer Zeile** (ca. 30 % / 70 %), Rahmen, Ellipsis bei Overflow, `title` mit vollem Text; Delete **×**; responsive Wrap unter 600px.
- **`InspectorHint`**: dünner Wrapper um `InfoIcon` (Abwärtskompatibilität).

### Kurzüberblick

- Konsistente, platzeffiziente Hilfe-UI.
- Vollständig editierbare Standard-Metadaten inkl. Löschen.
- Geordnetes Custom-Metadata-Raster.

## Stand 20: GIF-Decals & „Als Asset speichern“

### Abgeschlossen

- **GIF-Decals**: Import wie Bilder (`gifuct-js` / `gifDecalParse.ts`); `GifDecalFaceMesh` mit CanvasTexture und Frame-Timing; Inspector: Wiedergabe, Geschwindigkeit, Loop, Frame-Info, Performance-Hinweis; `AssetDecal.mediaKind` / `gif`-Felder persistieren in Save/Export.
- **Custom-Vorlage aus Szene**: `createTemplateFromSceneAsset` + `saveSceneAssetAsTemplate` im Store; UI `SaveAssetFromSceneModal`; Inspector-Button **Als Asset speichern…**; Rechtsklick auf Asset im **Auswahl**-Modus öffnet denselben Dialog; Zuordnung zu **Eigene Assets**.

### Kurzüberblick

- Animierte Decals mit Playback-Kontrolle.
- Bearbeitete Objekte als wiederverwendbare Bibliotheks-Vorlagen.

## Stand 21: Tooltips (Portal), Metadata löschen & Feld-Hilfen, Nebel in Beleuchtung

### Abgeschlossen

- **InfoIcon / Tooltips**: Text erscheint in `document.body` mit `position: fixed`, **z-index 1500** (über Canvas/Panels, unter Modals 2000), Verzögerung ~400 ms, viewport-aware Position (`tooltipPosition.ts`), kein Abschneiden durch `overflow` der Panels.
- **Kern-Metadaten**: Name, Beschreibung und Zonen-/Typ in der Ansicht mit **×** leerbar; leerer Name wird als „—“ angezeigt (Vorlagen-Typ u. a. in der Instanz-Zeile / View-Modal).
- **Custom Metadata**: optionales Feld **`description`** pro Zeile (persistiert); **✎** öffnet Dialog (Name, Wert, eigene (?)-Hilfe); „Hilfe zurücksetzen“ → Standard-Tooltip (`FIELD_DESC.customMetaPair`).
- **Beleuchtung / Nebel**: `LightingSettings` um **`fogEnabled`, `fogColor`, `fogNear`, `fogFar`** erweitert; Steuerung im Beleuchtungs-Popover; Szene-Nebel aus denselben Werten; Presets **Dramatisch, Abend, Nacht**; `STORAGE_VERSION` 7 (ältere Saves erhalten Defaults für Nebel über `sanitizeLighting`).

### Kurzüberblick

- Sichtbare Hilfe-Tooltips überall, wo `InfoIcon` genutzt wird.
- Vollständig leerbare Standard-Metadaten + anpassbare Hilfetexte pro Custom-Feld.
- Nebel editierbar und im Layout gespeichert.

## Stand 22: Favoriten löschen, Multi-Ghost, Beleuchtung-Layout, Perspektive, Migration 1.2.0

### Abgeschlossen

- **Favorit-Farben entfernen:** `ColorPickerPopover` – Liste mit Swatch, Label, **×**; Bestätigungsdialog; `localStorage` unter `factory-color-favorites`.
- **Multi-Platzieren:** State `multiPlaceMode` + bis zu 16 gespeicherte Platzierungs-Positionen als zusätzliche `GhostAssetRenderer` (reduzierte Opazität); `addAsset(..., false)` im Multi-Modus; **ESC** beendet Multi ohne die übrige ESC-Kette zu vermischen.
- **Beleuchtungs-Menü:** Sektionen (Preset mit Dropdown + Buttons, Hauptlicht, Weitere Lichter, Schatten, Atmosphäre, Nebel), `lighting-panel-divider`, typografische Überschriften.
- **Custom-Skalierung:** Bis zu **6** Nachkommastellen im Inspector für `geometry.kind === 'custom'` bzw. Typen aus `customTemplates`.
- **Fokus-Retention:** `transformSuppressFloorUntilRef` + `onTransformPointerChange` an Single-/Multi-Gizmo; Boden-Aktion nach Gizmo wird kurz ignoriert; **ESC** im Edit-Modus: `setSelectedIds([])` (wenn nicht Multi aktiv).
- **Performance:** `PerformanceSettings` im Store/Payload; `PerformanceHud` (FPS, Draw calls, Geometrien); `Canvas` `dpr={[1, maxDpr]}`; Inspector-Toggles.
- **Billboard-Labels:** `Billboard` um `Text` in `AssetRenderer`.
- **Perspektive:** `PerspectiveCameraSettings` + `perspectiveToPosition` / Presets; `AnimatedCameraRig` + initiale `Canvas`-Kamera; Inspector-Panel bei Ansicht Perspektive.
- **Backward compatibility:** `STORAGE_VERSION` **8**, `layoutFormatSemver` **1.2.0**, `finalizeImportedPayload` in `parseStoredPayload`, Slots und `importLayoutFromData`.

### Kurzüberblick

- Layout-Dateien und `localStorage` können ältere `version`-Werte tragen; beim Laden werden fehlende Felder ergänzt. Siehe **`MIGRATION_GUIDE.md`**.

## Stand 23: Ansicht-Menü, große Szenen, Label-Hintergründe

### Abgeschlossen

- **Toolbar „Ansicht“:** Popover wie Werkzeuge/Beleuchtung — Kameras (Perspektive/Top/Front/Seite), Perspektive-Slider, Presets (Standard, Erhöht, Vogel, Isometrisch), Reset, **Custom-Presets** (`perspectiveCustomPresets.ts` / `localStorage`); auch im View Mode.
- **Instancing:** `computeInstancedBoxBatches` + `InstancedBoxBatch` — gleiche Box-Vorlage + gleiche `geometry.params`, opak, ohne Decals, nicht selektiert/gehovered; Klicks mit `instanceId`; optional **Distanz-Culling** pro Instanz in der Batch; `frustumCulled={false}` wegen dynamischer Instanzen.
- **Bibliothek:** `react-window` **v2** `List` mit fester Zeilenhöhe ab `virtualLibraryThreshold`; Schwellwert und Zeilenhöhe im Performance-Panel.
- **Distanz-Culling:** `DistanceCullWrap` um nicht-instanziierte `AssetRenderer`; Schalter + Max-Distanz im Inspector.
- **Performance-HUD:** optional **JS Heap (MB)** wenn `performance.memory` verfügbar (Chrome).
- **Text-Labels:** Inspector-Sektion **Text-Label (Lesbarkeit)** — Hintergrund-Modi, Custom-Farbe, Deckkraft, Padding, Radius, Textfarbe, Canvas-Schriftgröße, Stärke, Schatten, Outline (`TextLabelStyle` / `mergeLabelStyle`).

### Kurzüberblick

- Schnelle Kamera- und Perspektive-Bedienung aus der Toolbar; eigene Kamera-Presets speicherbar.
- Weniger Draw-Calls bei vielen gleichen Kisten/Boxen; flüssigere Bibliothek bei langen Listen; Distanz-Culling ohne Selektions-/Gizmo-Logik zu ändern.

## Stand 24: UI-Bereinigung Ansicht, Label-Farben, Präsentation gesperrt

### Abgeschlossen

- **Toolbar:** Die vier View-Buttons (Perspektive / Top / Front / Seite) entfernt — Umschalten nur noch im **Ansicht**-Menü (Tasten 1–4 unverändert).
- **Inspector:** Kein Kamera-/Ansicht-Hinweis mehr; View-Steuerung nur in der Toolbar.
- **Text-Labels:** Schriftfarbe nur noch über **`ColorPickerPopover`** und `labelStyle.textColor`; Canvas-Textur nutzt **tinycolor** + stabiler **`styleKey`** in `BillboardTextLabel`; Material-Farbwähler für `geometry.kind === 'text'` ausgeblendet (Hinweis auf Label-Sektion).
- **Label-Hintergrund:** Checkbox **Hintergrund anzeigen**; Hintergrundfarbe mit vollem Color Picker; Deckkraft separat; alte Presets Hell/Dunkel werden beim Aktivieren auf Hex-Farben gemappt.
- **Präsentationsmodus:** `onAssetClick` / `onInstancedBoxPointerDown` — **gesperrte** Assets und **Zonen** (`CATEGORY_ZONES`) öffnen kein Info-Modal; Hinweisleiste angepasst.

### Kurzüberblick

- Weniger redundante UI; konsistente Farbwahl für Labels; Präsentation ohne Klicks auf gesperrte/Zonen-Objekte.

## Stand 25: Klick-Erkennung & Präsentation (gesperrte Objekte)

### Klick-Detection & Auswahl

- Auswahl über **`onPointerDown`** statt `onClick` für konsistente Treffer mit Orbit-Steuerung.
- **`Canvas` `raycaster`-Prop** (`PLANNER_RAYCASTER_PROPS`): `Line`- und `Points`-Schwellwerte leicht erhöht (≥ 0,12) für bessere Treffer auf Linien/Punkten, ohne den Raycaster zur Laufzeit zu mutieren.
- **`userData.assetId`** am Asset-Root (`AssetRenderer`) für eindeutige Zuordnung bei Bedarf.
- **Instancing**: nur noch **PointerDown** mit linker Taste; gemeinsame Logik mit regulären Assets über `applyAssetPointerSelect`.

### Präsentationsmodus (View) — gesperrte / Zonen-Assets

- **`assetShowsHoverHighlight`**: kein Hover-Scale/Outline-Effekt für gesperrte oder Zonen-Assets im View-Modus.
- **`onAssetPointerOver`**: bei gesperrt/Zone sofort **`hoveredId`** geleert, damit kein „stecken bleibender“ Hover.
- **`SceneInteractionCursor`**: Zeiger **`pointer`** nur für im View-Modus wirklich anklickbare Assets; sonst **`auto`**.
- Klicks auf gesperrte/Zonen werden weiterhin in **`applyAssetPointerSelect`** ignoriert (kein Info-Modal).

### Kurzüberblick

- Zuverlässigere Objektauswahl; Präsentation ohne ablenkendes Hover-Feedback auf gesperrten Objekten.

## Stand 26: Root-Cause „Deselektion beim Loslassen“ + Boden-Interaktion

### Diagnose

- Beim Auswählen kann das unter dem Cursor liegende **Mesh zwischen `pointerdown` und `pointerup` aus der Szene verschwinden** (z. B. **Instancing** schließt `selectedIds` aus; **Einzel-Auswahl** rendert das Asset nur noch unter `SingleTransformGizmo`).
- Der **Hallenboden** löste zuvor **`onClick`** aus — ein erneuter Raycast beim **Loslassen** traf dann oft den **Boden** → `setSelectedIds([])` → Inspector wirkte wie „verliert Fokus beim Mouse-Up“.

### Fix

- **`FactoryFloor`**: `onClick` → **`onPointerDown`** (Primärtaste) für `onAction` / Deselektion auf leerem Boden.
- **`PlannerApp`**: **`assetPointerSuppressFloorUntilRef`** (~400 ms) nach erfolgreicher Asset-Auswahl im Edit-Modus, zusätzlich zur bestehenden Transform-Sperre — Absicherung gegen verzögerte Doppel-Events.

### Kurzüberblick

- Auswahl bleibt nach dem Loslassen der Maustaste stabil; Klick-Logik bleibt konsistent bei **pointerdown** für Assets und Boden.

## Stand 27: Instancing Opt-in, Achsen-Kameraeinstellungen, Licht-Presets UI

### Performance / Instancing

- **`useInstancing`** Standard: **aus** (`DEFAULT_PERFORMANCE`); **`sanitizePerformanceSettings`**: nur bei `useInstancing === true` aktiv (explizites Opt-in).
- Kurzer Hinweistext zu Instancing-Trade-off im Performance-Bereich (Toolbar **Ansicht**).

### Ansicht (Top / Front / Seite)

- Neuer persistierter Block **`axisViewCameras`** (`TopViewCameraSettings`, `FrontViewCameraSettings`, `SideViewCameraSettings`) in `plannerUi.ts`, Speicher/Import über **`StoredPayload`** und **`finalizeImportedPayload`**.
- **`AnimatedCameraRig`** / **`canvasCamera`**: Achsenansichten aus **`topViewToRig` / `frontViewToRig` / `sideViewToRig`** statt fester Preset-Werte.
- **Ansicht-Menü:** pro aktiver Achsenansicht Slider + **Reset**; Perspektive unverändert inkl. Custom-Presets.

### Beleuchtung

- **Preset-Dropdown** im Beleuchtungs-Toolbar-Panel entfernt; nur noch **Preset-Buttons** (Standard, Studio, …).

### Kurzüberblick

- Standardmäßig alle Objekte normal selektierbar; Instancing nur bei Bedarf; feinere Kamera-Kontrolle für technische Ansichten; schlankeres Licht-Preset-UI.

## Stand 28: Performance im Ansicht-Menü (einklappbar)

### UI

- Alle **Performance-Einstellungen** aus dem Inspector in das **Ansicht**-Popover verschoben.
- Sektion **„Performance“** mit **Chevron**; **Standard: zugeklappt**; Animation über **max-height** + **opacity**.
- **Persistenz:** `localStorage` `factory-planning-view-menu-performance-expanded` (`1` wenn aufgeklappt).

### Monitoring

- **`perf/plannerPerfStats.ts`**: `PerformanceHud` veröffentlicht FPS / Draw-Calls / Geometrien / optional Heap.
- Im geöffneten Performance-Bereich: Live-Liste, wenn HUD im **Edit**-Modus läuft und Daten frisch sind; sonst kurzer Hinweis.

### Kurzüberblick

- Inspector schlanker; Performance zentral unter **Ansicht** mit optionalem Monitoring.

## Stand 29: Kritische Bugfixes (Color Picker, Save, Kamera, Präsentation)

### Color Picker

- **Hex-Input:** 300 ms Debounce; nur ganzes `#RRGGBB` commit; Fehlermarkierung; **SV/Hue:** Drag per Pointer-Down + Capture, kein dauerndes ungebremstes `pointermove` ohne Ziehen.
- Picker-Implementierung: `ColorPickerPopover` (memo) mit getrennter Eingabespur und Commit-Pfad.

### Config Persistence (Refresh + Intervall)

- **`STORAGE_VERSION` 9;** neues `layoutSession` in `factory-layout` (Modus, Tool, Selektion, Info-Fokus, offene Beleuchtung/Boden, linke/rechte Leiste) via `setLayoutSessionSnapshot` + Auto-Save und **30 s** Backup-Intervall; Store initialisiert **selectedIds** aus `layoutSession` und persistiertes Layout.

### Camera

- `OrbitControlsCleanup`: `dispose` beim Unmount; **copy/paste**-Listener: `document.exitPointerLock` wenn nötig; **View-Mode:** `Ctrl/Cmd + C` / `V` nicht mehr durch frühen Return in `handleKeyDown` abgeschnitten.

### Presentation Mode

- Klick: **setSelectedIds +** Info-Referenz; **rechter Inspector** sichtbar und **disabled**-Fieldset in View für nicht-gesperrte Selektion (CSS `workspace--view-with-inspector`); **AssetInfoModal** oben **nur** wenn **Inspector** mit H aus; **500 ms** Ignore nach Mount gegen Close durch denselben Klick.

### Test / QA

- `npm run build` und `npm run lint` im `planner-app` erfolgreich.

**Alle relevanten Commits in Branch `cursor/factory-bugfixes-bb8a`**

## Offene optionale Erweiterungen

- Box-Selection fuer Mehrfachauswahl.
- Kollisions-/Abstandsregeln zwischen Assets.
- Screenshot/PDF-Export aus View Mode.
- Animationspfade fuer bewegliche Assets.
