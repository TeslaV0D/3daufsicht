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

## Offene optionale Erweiterungen

- Box-Selection fuer Mehrfachauswahl.
- Kollisions-/Abstandsregeln zwischen Assets.
- Screenshot/PDF-Export aus View Mode.
- Animationspfade fuer bewegliche Assets.
