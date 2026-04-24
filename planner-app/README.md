# Factory Planning Studio (MVP+)

Eine interaktive 3D-Planungsapplikation im Stil von City-Skylines/SIMS fuer Hallen- und Flaechenplanung.

## Enthaltene Features

- 3D Szene mit Grid und moderner Dark-UI
- Kamera-Steuerung mit Zoom/Pan/Orbit
- Kamera-Presets: Perspektive, Top, Front, Seite
- Asset-Bibliothek mit Kategorien
- Mehrere Formtypen: Rechteck/Box, Rhombus, Zylinder, Kegel, Kugel, Hexagon
- Platzieren von Assets per Klick auf die Flaeche
- ALT fuer freie Platzierung ohne Grid-Snap
- Einzel- und Mehrfachauswahl (STRG / CMD)
- Loeschen-Button + Entf/Backspace
- Transform-Gizmo fuer XYZ bewegen und rotieren
- Inspector fuer Position, Rotation X/Y/Z (Grad), Groesse (Breite/Hoehe/Laenge), Farbe und Asset-Metadaten
- Layout lokal speichern/laden (localStorage)
- Eigene 3D-Assets (GLB/GLTF) lokal hochladen und platzieren
- Undo/Redo Historie mit STRG/CMD+Z und STRG/CMD+Y
- Copy/Paste fuer ausgewaehlte Assets mit STRG/CMD+C und STRG/CMD+V
- Multi-Selection kann gemeinsam verschoben/gedreht werden

## Lokale Entwicklung

```bash
npm install
npm run dev
```

App oeffnen unter: `http://localhost:5173`

## Eigene Assets hochladen und benutzen

1. In der linken Asset-Bibliothek auf **"Eigenes Asset"** klicken.
2. Eine Datei vom Typ **`.glb`** oder **`.gltf`** auswaehlen.
3. Label, Kategorie und Groesse (X/Y/Z in Meter) eingeben.
4. Auf **"Asset zur Bibliothek hinzufuegen"** klicken.
5. Das neue Asset erscheint in der Bibliothek und kann wie alle anderen platziert werden.

Hinweis:
- Upload ist aktuell lokal im Browser (kein Server-Upload).
- GLTF kann externe Dateien referenzieren; fuer den einfachsten Ablauf `.glb` nutzen.

## Wichtige Shortcuts

- `STRG/CMD + Klick`: Mehrfachauswahl
- `ALT`: Frei platzieren ohne Grid-Snap
- `Entf/Backspace`: Auswahl loeschen
- `STRG/CMD + Z`: Undo
- `STRG/CMD + Y` oder `STRG/CMD + SHIFT + Z`: Redo
- `STRG/CMD + C`: Auswahl kopieren
- `STRG/CMD + V`: Kopierte Assets einfuegen

## Produktion testen

```bash
npm run lint
npm run build
```

## Wichtige Shortcuts

- `ALT`: freie Platzierung / freie Verschiebung
- `CTRL/CMD`: Mehrfachauswahl per Klick
- `CTRL/CMD + Z`: Undo
- `CTRL/CMD + SHIFT + Z` oder `CTRL/CMD + Y`: Redo
- `CTRL/CMD + C`: Auswahl kopieren
- `CTRL/CMD + V`: Einfuegen

## Tech Stack

- React 19 + TypeScript
- Vite
- three.js
- @react-three/fiber
- @react-three/drei
