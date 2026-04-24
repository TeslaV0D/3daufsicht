# Factory Planning Studio (MVP)

Eine interaktive 3D-Planungsapplikation im Stil von City-Skylines/SIMS fuer Hallen- und Flaechenplanung.

## Enthaltene Features

- 3D Szene mit Grid und moderner Dark-UI
- Kamera-Steuerung mit Zoom/Pan/Orbit
- Kamera-Presets: Perspektive, Top, Front, Seite
- Asset-Bibliothek mit Kategorien
- Platzieren von Assets per Klick auf die Flaeche
- ALT fuer freie Platzierung ohne Grid-Snap
- Einzel- und Mehrfachauswahl (STRG / CMD)
- Loeschen-Button + Entf/Backspace
- Transform-Gizmo fuer XYZ bewegen und rotieren
- Inspector fuer Position/Rotation und Asset-Metadaten
- Layout lokal speichern/laden (localStorage)

## Lokale Entwicklung

```bash
npm install
npm run dev
```

App oeffnen unter: `http://localhost:5173`

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
