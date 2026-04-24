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
- Einzel- und Mehrfachauswahl: normaler Klick ersetzt die Auswahl; **`STRG/CMD + Klick`** fuegt ein Asset hinzu oder entfernt es aus der Mehrfachauswahl.
- Transform-Gizmo: Bewegen / Drehen / Skalieren. **Skalieren** am Gizmo ist **stufenlos** (`scaleSnap` aus); im Inspector: Slider „Alle Achsen gleich“ (feine Schritte) und drei Felder mit bis zu **vier Nachkommastellen**.
- Toolbar-Menue **„⋮ Werkzeuge“**: Ausrichten (Links/Rechts/Mitte, Oben/Unten), Verteilen auf X/Z, Auswahl an Platzierungs-Raster ausrichten — oeffnet als schwebendes Panel, die Leiste bleibt kompakt.
- **Beleuchtung**-Popover ebenfalls **fix positioniert** unterhalb der Toolbar, verschiebt die Button-Reihe nicht.
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
- **Export** (`Export`): Dialog mit zwei Modi:
  - **Nur Workspace**: nur die platzierte Szene, Boden, Beleuchtung, Kamera; benötigte **eigene** Modelle minimal mit dabei; Dateiname z. B. `layout_2026-04-24-12-30-00.json`.
  - **Komplette Konfiguration**: volles Projekt inkl. Bibliothek, Gruppen, Favoriten, Meta, Präsentationsmodus-Zustand (`shellMode`) und aufgeklappte Bibliotheks-Sektionen; Dateiname z. B. `factory_layout_complete_2026-04-24-12-30-00.json`.
- Workspace-Dateien beim **Laden** erkennen den Modus (`exportKind`) und überschreiben nur Szene + Boden + Licht (Bibliothek bleibt erhalten).
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

1. In der Bibliothek die Gruppe **Eigene Assets** (ganz unten) aufklappen und auf das **+** rechts neben dem Gruppennamen klicken — **Asset importieren** (Tooltip).
2. Dateien vom Typ `.glb`, `.gltf`, `.stl`, `.obj`, `.fbx` auswaehlen (max. 20 MB pro Datei, mehrere moeglich).
3. Die Vorlagen erscheinen sofort unter **Eigene Assets** und sind platzierbar.

### Bibliothek: Gruppen beim Start

- Alle Gruppen starten **zugeklappt**; Klick klappt auf oder zu. Der Zustand der aufgeklappten Sektionen wird unter `factory-library-section-expanded-v2` im Browser gespeichert.
- Reihenfolge: **Favoriten** → eingebaute Kategorien (Primitive 3D/2D, Produktion, Logistik, Zonen, Waende, Wege, Labels) → **eigene Gruppen** alphabetisch → **Eigene Assets** immer zuletzt.
- Ein neuer Favorit **oeffnet** die Favoriten-Gruppe nicht automatisch.

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

## Optionale Verbesserungen (Backlog)

- Erweiterte Tastaturkuerzel (z. B. Lock, Favorit, Farbe) und Dokumentation im Shortcuts-Dialog; optional konfigurierbar.
- Asset-Suche / Filter in der Bibliothek.
- Undo/Redo fuer Bibliotheks-Aktionen (Favorit, Gruppe, Farbe, Lock).
- Mehrfachauswahl und Batch-Operationen (Transform, Farbe, Lock, Loeschen).
- Ausrichtungs-Werkzeuge (links/rechts/oben/unten, gleicher Abstand, Raster).
- Snap-to-Grid mit einstellbarer Rasterweite.
- Live-Masse / Koordinaten beim Verschieben.
- Kategorie-Farben in Liste und optional in der Szene.
- Gruppe **Zuletzt verwendet** (letzte platzierten Asset-Typen).
