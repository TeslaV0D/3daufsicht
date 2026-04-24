# Factory Planning Studio

Interaktive 3D-Planungsapplikation im Stil von City-Skylines/SIMS fuer Hallen- und Flaechenplanung.

## Enthaltene Features

### Modi

- **Edit-Modus**: volle Bearbeitung (Platzieren, Gizmos, Inspector, Library).
- **Praesentationsmodus (View Mode)**: read-only, Klick auf Asset oeffnet ein semantisches Info-Popup (nur Name, Beschreibung, Kategorie, Custom Metadata — keine Transform-Daten).
- Mode-Badge (`EDIT MODE` / `VIEW MODE`), weichere Kamera und staerkeres Lighting im View Mode.

### 3D Szene

- Hallen-Optik mit HDRI-Licht (`warehouse`), Schatten, Boden und Waenden.
- Orbit-Kamera mit `enableDamping`, `zoomToCursor`, Kamera-Presets (Perspektive / Top / Front / Seite).
- Ghost-Placement Preview beim Platzieren.
- Hover-Feedback (leichter Scale- und Glow-Effekt) stabil dank `onPointerEnter` / `onPointerLeave`.

### Unified Asset System

- Alles ist ein `Asset` (`type`, `category`, `position`, `rotation`, `scale`, `color`, `geometry`, `metadata`, `visual`).
- Templates in Kategorien:
  - **Primitive 3D**: Box, Sphere, Cylinder, Cone, Torus, Hexagon
  - **Primitive 2D**: Plane, Circle, Ring
  - **Produktion**: Produktionslinie, Arbeitsplatz, Angestellte
  - **Logistik**: Regalblock, Hubwagen, Kisten
  - **Zonen** (Plane-Assets mit Opacity): Produktion, Lager, Sicherheit
  - **Wege**: Gehweg, Fahrweg
  - **Labels**: editierbare 3D-Texte
  - **Eigene Assets**: GLB/GLTF/STL Upload

### Editieren

- Mehrere Formtypen, alle ueber Inspector anpassbar (Groesse, Farbe, Metadaten).
- Einzel- und Mehrfachauswahl (`STRG/CMD + Klick`).
- Transform-Gizmo: Bewegen / Drehen / Skalieren.
- Inspector: Position, Rotation (Grad), Skalierung, Farbe, Name, Beschreibung, Zone-Typ, Custom Metadata, **Textinhalt** fuer Label-Assets.
- Ghost-Placement, Snap-Toggle mit `STRG/CMD`.
- Undo/Redo, Copy/Paste.

### Persistenz

- **Auto-Speichern** (`Speichern`): aktuelles Layout in `localStorage` (`factory-layout`, versioniert).
- **Layout-Slots** (`Als Slot`): beliebig viele benannte Slots in `factory-layout-slots`.
- **Lade-Dialog** (`Laden`):
  - Auto-Slot laden.
  - Liste gespeicherter Slots (Laden, Umbenennen, Loeschen).
  - Externe `.json` Datei auswaehlen und importieren.
- **Export** (`Export`): aktuelles Layout als `.json` Datei herunterladen.
- **Import**: robuste Validierung (Position/Rotation/Scale als finite Zahlen, Fallbacks).

### UI

- Feste App-Hoehe, kein Seiten-Scroll.
- Panels bleiben im View Mode gemountet (Visibility per CSS), damit der Inspector nach Mode-Wechseln nicht verschwindet.
- Modal-Animationen (Scale + Fade).

## Lokale Entwicklung

```bash
npm install
npm run dev
```

App oeffnen unter: `http://localhost:5173`

## Eigene Assets hochladen und benutzen

1. In der linken Asset-Bibliothek auf **"Eigene Assets hochladen (GLB/GLTF/STL)"** klicken.
2. Datei vom Typ `.glb`, `.gltf` oder `.stl` auswaehlen (max. 20 MB).
3. Das neue Asset-Template erscheint in der Kategorie **Eigene Assets** und ist direkt platzierbar.

Hinweise:
- Upload ist lokal im Browser (kein Server-Upload).
- GLTF kann externe Dateien referenzieren; fuer den einfachsten Ablauf `.glb` nutzen.
- STL-Dateien enthalten nur Geometrie — Material/Farbe werden ueber den Inspector gesteuert.
- Im Inspector sind **Wireframe** und (nur STL) **Flat Shading** aktivierbar.

## Wichtige Shortcuts

- `STRG/CMD + Klick`: Mehrfachauswahl
- `STRG/CMD`: freie Platzierung / freie Bewegung / freie Rotation
- `Entf/Backspace`: Auswahl loeschen
- `STRG/CMD + Z`: Undo
- `STRG/CMD + Y` oder `STRG/CMD + Shift + Z`: Redo
- `STRG/CMD + C`: Auswahl kopieren
- `STRG/CMD + V`: Kopierte Assets einfuegen
- `Escape`: Info-Popup / Lade-Dialog schliessen, Platzierung abbrechen

## Produktion testen

```bash
npm run lint
npm run build
```

## Tech Stack

- React 19 + TypeScript
- Vite
- three.js
- @react-three/fiber
- @react-three/drei
