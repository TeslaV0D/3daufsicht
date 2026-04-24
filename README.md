# 3daufsicht

Interaktive 3D-Planungsapplikation im Stil von City-Skylines/SIMS fuer Hallen- und Layoutplanung.

## Projekt starten

Die App liegt unter `planner-app`.

```bash
cd planner-app
npm install
npm run dev
```

Produktionsbuild:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

## Umgesetzte Features

### Modus-Trennung

- **Edit-Modus**: volle Bearbeitung (Platzieren, Gizmos, Inspector, Library, Undo/Redo).
- **Praesentationsmodus (View Mode)**: read-only, Klick auf Asset oeffnet Info-Popup mit rein semantischen Infos (Name, Beschreibung, Kategorie, Custom Metadata).
- Klarer Mode-Badge (`EDIT MODE` / `VIEW MODE`) in der Top-Bar, fade-Transition beim Wechsel.
- View Mode nutzt weicheres Kamera-Profil; `OrbitControls` werden beim Wechsel per `key={mode}` sauber resettet.

### 3D-Szene

- Realistische Beleuchtung mit HDRI-Umgebung (`warehouse`), Schatten in der gesamten Szene, View-Mode mit staerkerem Lighting und zusaetzlichem Fill-Light.
- Hallenboden in Betonoptik, dezentes Grid, Hallenrahmen mit Rueck- und Seitenwaenden.
- Orbit-Kamera mit Damping, Zoom-To-Cursor, Kamera-Presets (Perspektive, Top, Front, Seite).
- Ghost-Placement-Vorschau beim Platzieren.
- Hover-Feedback ueber `onPointerEnter` / `onPointerLeave` fuer flackerfreies Highlight mit leichtem Scale- und Glow-Effekt.

### Unified Asset System

- Einheitliches `Asset`-Datenmodell (`type`, `category`, `position`, `rotation`, `scale`, `color`, `geometry { kind, params }`, `metadata`, `visual`).
- Keine hardcodierten Zonen/Wege/Formen mehr — alles entsteht aus Templates:
  - **Primitive 3D**: Box, Sphere, Cylinder, Cone, Torus, Hexagon
  - **Primitive 2D**: Plane, Circle, Ring
  - **Produktion**: Produktionslinie, Arbeitsplatz, Angestellte
  - **Logistik**: Regalblock, Hubwagen, Kisten
  - **Zonen**: Produktion, Lager, Sicherheit (als Plane-Assets mit Opacity)
  - **Wege**: Gehweg, Fahrweg (als schmale Plane-Assets)
  - **Labels**: frei editierbare 3D-Texte
  - **Eigene Assets**: GLB/GLTF-Upload

### Edit-Features

- Asset-Bibliothek links, kategorisiert.
- Platzieren per Klick auf den Boden, `STRG/CMD` fuer freies Platzieren ohne Grid-Snap.
- Auswahl per Klick, `STRG/CMD + Klick` fuer Mehrfachauswahl.
- Transform-Gizmo: Bewegen / Drehen / Skalieren, auch fuer Mehrfachauswahl.
- Inspector:
  - Position X/Y/Z, Rotation X/Y/Z (Grad), Skalierung X/Y/Z
  - Farbe (eigener Farbpicker mit Swatches, RGB, Hex)
  - Name, Beschreibung, Zone-/Typ-Hinweis
  - Custom Metadata (dynamisch hinzufuegen, loeschen)
  - Textinhalt-Feld fuer Label-Assets (Live-Update im 3D-Text)
- Undo/Redo (`STRG/CMD + Z`, `STRG/CMD + Y`, `STRG/CMD + Shift + Z`).
- Copy/Paste (`STRG/CMD + C`, `STRG/CMD + V`).
- Loeschen per Button oder `Entf`/`Backspace`.

### Persistenz

- **Auto-Speichern**: Knopf "Speichern" persistiert das aktuelle Layout als `factory-layout` in `localStorage` (versioniert, mit Custom-Templates).
- **Layout-Slots**: "Als Slot" speichert das aktuelle Layout mit benanntem Slot in `factory-layout-slots`. Mehrere Slots mit Datum/Zeit und Anzahl Assets.
- **Laden-Dialog** (`Laden`-Knopf):
  - Auto-Slot laden
  - Liste aller gespeicherten Slots (laden, umbenennen, loeschen)
  - Externe `.json`-Datei auswaehlen und importieren
- **Export**: "Export"-Knopf lädt ein `.json`-File mit dem gesamten Layout herunter (inkl. Version und Custom-Templates).
- **Import**: JSON-Dateien werden validiert (Position/Rotation/Scale als finite Zahlen), inkompatible Felder werden durch Defaults ersetzt.

### UI / Layout

- Feste App-Hoehe (kein Seiten-Scroll), Top-Bar darf umbrechen.
- Panels (Library, Inspector) werden im View Mode per CSS ausgeblendet (nicht unmountet) — Inspector bleibt nach Mode-Wechsel stabil.
- Modal-Animationen (Fade + Scale).

## Bedienung

- **Auswahl**: Asset anklicken
- **Mehrfachauswahl**: `STRG` + Klick (oder `CMD` auf macOS)
- **Platzieren**: Tool "Platzieren" aktivieren, Asset waehlen, auf Boden klicken
- **Freies Platzieren/Bewegen/Rotieren**: `STRG/CMD` gedrueckt halten
- **Loeschen**: Button "Loeschen" oder `Entf`
- **Abbrechen Platzierung / Info-Popup schliessen**: `Escape`
- **Mode-Wechsel**: `Bearbeiten` / `Praesentation` in der Top-Bar
