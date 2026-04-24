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

## Umgesetzte MVP-Features

- 3D-Szene mit Raster und realistischer Beleuchtung
- Zoom / Pan / Orbit Kamera
- Kamera-Presets: Perspektive, Top, Front, Seite
- Asset-Bibliothek mit Kategorien
- Platzieren per Klick in der Szene
- ALT gedrueckt: freies Platzieren ohne Grid-Snap
- Auswahl per Klick
- STRG/CTRL gedrueckt: Mehrfachauswahl
- XYZ bewegen und Rotieren (Transform-Gizmo bei Einzelauswahl)
- Inspector mit Asset-Infos (Metadaten editierbar)
- Loeschen-Button und Entf/Backspace
- Speichern/Laden des Layouts in `localStorage`

## Bedienung

- **Auswahl**: Asset anklicken
- **Mehrfachauswahl**: `STRG` + Klick (oder `CMD` auf macOS)
- **Platzieren**: Tool "Platzieren" aktivieren, Asset waehlen, auf Boden klicken
- **Freies Platzieren**: `ALT` gedrueckt halten
- **Loeschen**: Button "Loeschen" oder `Entf`
- **Abbrechen Platzierung**: `Escape`
