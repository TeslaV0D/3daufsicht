# Implementierungsdokumentation: 3D Factory Planner

## Projektziel

Interaktive 3D-Planungsapplikation fuer Hallen-/Fabriklayout mit City-Skylines/SIMS-aehnlicher Bedienung und modernem Look.

## Stand 1: MVP-Grundlage (bereits umgesetzt)

- React + TypeScript + Vite App unter `planner-app` erstellt
- 3D-Szene mit `three.js`, `@react-three/fiber`, `@react-three/drei`
- Kamera:
  - Zoom
  - Pan
  - Orbit
  - Presets: Perspektive, Top, Front, Seite
- Asset-Workflow:
  - Asset-Bibliothek links
  - Platzieren per Klick auf den Boden
  - ALT fuer freies Platzieren (ohne Grid-Snap)
  - Einzel- und Mehrfachauswahl (STRG/CMD)
  - Loeschen per Button und Entf/Backspace
- Inspector:
  - Position/Rotation editierbar
  - Asset-Metadaten editierbar
- Persistenz:
  - Speichern/Laden in `localStorage`

## Stand 2: Fehlerbehebungen nach Nutzerfeedback (aktuell umgesetzt)

### 1) Verschieben/Drehen funktionierte nicht stabil

Problem:
- Transform-Gizmo war nicht sauber an das selektierte Objekt gebunden.
- Visuell konnte die Achse in der Szenenmitte erscheinen statt am Asset.

Loesung:
- `TransformControls` jetzt direkt mit dem selektierten Mesh-Ref verknuepft:
  - `object={meshRef}`
- Beim Draggen wird OrbitControls deaktiviert, danach wieder aktiviert.
- Transformationen schreiben Position/Rotation in den Zustand zurueck.

### 2) Asset verschwand bei Werteingaben im Inspector

Problem:
- Zwischenzustaende bei Number-Input (z. B. leer, unvollstaendig) konnten zu ungueltigen Zahlen fuehren.
- Ungueltige Werte verursachten ungueltige Position/Rotation (z. B. `NaN`) und damit Rendering-Probleme.

Loesung:
- Robuste Validierung eingefuehrt:
  - `parseFiniteInput(...)`
  - `isVector3Tuple(...)` validiert auch Endlichkeit (`Number.isFinite`)
- Position/Rotation werden nur uebernommen, wenn gueltig.
- Zusaetzlich kontrollierte Eingabefelder mit lokalem Draft-Zustand:
  - Bearbeitung bleibt fluessig
  - Commit nur bei gueltiger Zahl
  - Ungueltige Zwischenwerte werden nicht in das Asset-Modell geschrieben

### 3) Eigenschaften aendern

Status:
- Metadatenbearbeitung im Inspector ist aktiv und bleibt erhalten.
- Position/Rotation-Eigenschaften koennen stabil geaendert werden.

## Relevante Dateien

- `planner-app/src/App.tsx`
  - Szene, Kamera, Auswahl, Platzierung, TransformControls, Inspector-Logik
- `planner-app/src/App.css`
  - Modernes UI-Layout und Styling
- `planner-app/src/index.css`
  - Globale Basisstile
- `README.md`
  - Projekt- und Bedienungsbeschreibung
- `planner-app/README.md`
  - App-spezifisches Setup und Feature-Ueberblick

## Test- und Qualitaetsstand

Ausgefuehrte Checks:

- `npm run lint`
- `npm run build`

Ergebnis:

- Beide Checks erfolgreich.

## Offene naechste Schritte (optional)

- Undo/Redo fuer Bearbeitungen
- Box-Selection fuer Mehrfachauswahl
- Import echter GLB-Modelle statt Platzhalter-Geometrien
- Kollisions-/Abstandsregeln
- Export (Screenshot/PDF)
