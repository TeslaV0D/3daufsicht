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

## Umgesetzte Features (MVP+)

- 3D-Szene mit Raster und realistischer Beleuchtung
- Zoom / Pan / Orbit Kamera
- Kamera-Presets: Perspektive, Top, Front, Seite
- Asset-Bibliothek mit Kategorien inkl. Produktions-Assets:
  - Produktionslinie
  - Angestellte
  - Kisten
  - Hubwagen
- Mehrere Formtypen: Box, Rechteck, Kreis, Rhombus, Zylinder, Kegel, Kugel, Hexagon
- Platzieren per Klick in der Szene
- STRG/CMD gedrueckt: freies Platzieren ohne Grid-Snap (ALT entfernt)
- Auswahl per Klick
- STRG/CTRL gedrueckt: Mehrfachauswahl
- XYZ bewegen und Rotieren (Transform-Gizmo bei Einzel- und Mehrfachauswahl)
- Inspector mit:
  - Position X/Y/Z
  - Rotation X/Y/Z in Grad
  - Groesse (Breite/Hoehe/Laenge)
  - Farbe
  - Metadaten
- Eigene 3D-Assets hochladen (GLB/GLTF)
- Undo/Redo (STRG/CMD + Z, STRG/CMD + Y, STRG/CMD + SHIFT + Z)
- Copy/Paste (STRG/CMD + C / V)
- Speichern/Laden des Layouts in `localStorage`
- Realistische Hallen-Visuals:
  - Physikalischeres Licht mit HDRI-Umgebung (`warehouse`)
  - Schatten in der gesamten Szene
  - Hallenboden in Betonoptik + dezenteres Grid
  - Hallenrahmen mit Rueck- und Seitenwaenden
  - Damping-Kamera fuer fluessigere Navigation
  - Ghost-Placement Vorschau beim Platzieren

## Bedienung

- **Auswahl**: Asset anklicken
- **Mehrfachauswahl**: `STRG` + Klick (oder `CMD` auf macOS)
- **Platzieren**: Tool "Platzieren" aktivieren, Asset waehlen, auf Boden klicken
- **Freies Platzieren/Bewegen/Rotieren**: `STRG/CMD` gedrueckt halten
- **Loeschen**: Button "Loeschen" oder `Entf`
- **Abbrechen Platzierung**: `Escape`
