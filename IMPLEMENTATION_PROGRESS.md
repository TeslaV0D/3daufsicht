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

## Stand 2: Fehlerbehebungen nach Nutzerfeedback (umgesetzt)

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

## Stand 3: Erweiterungen fuer Planung und Bedienung (neu umgesetzt)

### 1) Neue Formen + Produktionsobjekte

Ergaenzt:
- Grundformen: Rechteck und Kreis
- Produktionsnahe Assets:
  - Produktionslinie
  - Hubwagen
  - Angestellte
  - Kisten

Alle Objekte sind ueber den Inspector in Farbe und Groesse (X/Y/Z) pro Instanz anpassbar.

### 2) Benutzerdefinierte Farbwahl (ohne System-Color-Picker)

Die Inspector-Farbsteuerung wurde auf ein eigenes UI umgestellt:
- Trigger-Button mit Farbvorschau
- eigenes Popover-Fenster
- vordefinierte Farbswatches
- RGB-Kanaele (R/G/B) als numerische Eingabe
- Hex-Eingabe mit Validierung

Technisch:
- keine Abhaengigkeit mehr von `input type="color"`
- saubere Normalisierung ueber `sanitizeColor(...)`
- Umrechnung zwischen Hex und RGB ueber Hilfsfunktionen

### 3) Inspector- und Transform-Erweiterung

- Position X/Y/Z editierbar
- Rotation X/Y/Z in Grad editierbar
- Groesse (Breite/Hoehe/Laenge) editierbar
- Einzelauswahl und Mehrfachauswahl bleiben fuer Transformations-Gizmo nutzbar
- Snap-Verhalten:
  - Verschieben: Raster-Snap standardmaessig, `ALT` fuer frei
  - Rotieren: Winkel-Snap standardmaessig, `CTRL/CMD` fuer frei

### 4) Daten-/Kompatibilitaet

- Shape-Parsing fuer neue Formen erweitert (`rectangle`, `circle`)
- Layout-Hydration aus `localStorage` bleibt rueckwaertskompatibel

## Relevante Dateien

- `planner-app/src/PlannerApp.tsx`
  - zentrale App-Logik (Assets, Platzierung, Auswahl, Gizmo, Undo/Redo, Copy/Paste, Upload, Inspector)
- `planner-app/src/App.css`
  - Modernes UI-Layout und Styling inkl. eigenem Farb-Popover
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

- Beide Checks erfolgreich (inkl. aktueller Erweiterungen)

## Offene naechste Schritte (optional)

- Box-Selection fuer Mehrfachauswahl
- Import-Dialog mit Startwerten fuer Rotation/Groesse
- Kollisions-/Abstandsregeln
- Export (Screenshot/PDF)
