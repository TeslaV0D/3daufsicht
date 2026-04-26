# 3D Interior Editor

Interaktive 3D-Planungsapplikation im Stil von City-Skylines/SIMS für Hallen- und Layoutplanung.

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
- **Praesentationsmodus (View Mode)**: read-only, Klick auf ein **nicht gesperrtes** Asset (keine **Zonen**-Assets) öffnet das Info-Popup mit rein semantischen Infos. **Gesperrte** Objekte und **Zonen** verhalten sich wie nicht vorhanden: kein Hover-Highlight, kein Zeiger-Cursor, keine Selektion/kein Info-Popup; dahinter liegende, nicht gesperrte Objekte bleiben klickbar.
- **Präsentations-Toolbar**: nur **Ansicht**-Menü (alle Kameras Perspektive/Top/Front/Seite, Perspektive-Slider, Presets, Custom-Presets); keine separaten View-Buttons mehr. Badge `VIEW MODE`, Button **„Präsentation beenden (ESC)“** — keine Modus-Tools, keine Beleuchtung, kein Speichern/Laden/Export, kein Shortcuts-„?“-FAB.
- Klarer Mode-Badge (`EDIT MODE` / `VIEW MODE`) in der Top-Bar, fade-Transition beim Wechsel.
- View Mode nutzt weicheres Kamera-Profil; `OrbitControls` werden beim Wechsel per `key={mode}` sauber resettet. **ESC** schließt schichtweise offene UI (Farbwähler, Vorschau, Dialoge, Toolbar-Menüs, Suche) und beendet danach die Präsentation bzw. setzt im Edit-Modus das Auswahl-Tool.

### UI-Stapelreihenfolge (Z-Index)

- Die **Top-Bar** liegt über der Arbeitsfläche, damit **⋮ Werkzeuge** und **Beleuchtung** (fix positioniert) nicht vom WebGL-Canvas verdeckt werden. Canvas `z-index: 0`, Seitenpanels `500`, Toolbar `1000`, Modals `2000`, Shortcuts-Overlay `2500`, Shortcuts-FAB `2490`.
- **Toolbar-Menüs** öffnen am jeweiligen Button mit **Fade-In** (`opacity`), ohne sichtbares Verspringen der Position (Layout in `useLayoutEffect`).

### Inspector & Tooltips

- **Info-Icons (?):** Kurzinfos als **Portal-Tooltip** (`position: fixed`, intelligente Kanten-Position, **z-index 1500**), nicht hinter dem WebGL-Canvas oder in überlaufenden Panels versteckt.
- **Metadata:** Name, Beschreibung und Zonen-/Typ per **×** leerbar; bei Custom-Feldern eigene **Beschreibung für den (?)-Tooltip** (Dialog über **✎** am Feld).

### Beleuchtung & Nebel

- Nebel (**Ein/Aus**, Farbe, Start/Ende) in den Beleuchtungs-Einstellungen; Werte werden **mit dem Layout** in `localStorage` gespeichert (siehe `LightingSettings` / Speichern-Button).

### Dokumentation

- Implementierungs-Chronik und Stände: **`IMPLEMENTATION_PROGRESS.md`** im Repository-Root.
- Layout-Upgrade und alte Saves: **`MIGRATION_GUIDE.md`**.

### Factory Planning Studio – neuere UX-/ Daten-Features

- **Favorit-Farben:** Im erweiterten Farbwähler einzelne Favoriten mit **×** entfernen (mit kurzer Bestätigung); `localStorage` wird aktualisiert.
- **Multi-Platzieren:** Toolbar-Button **Multi** im Platzier-Modus: mehrere Ghosts für bereits gesetzte Positionen, Fokus optional bei bestehender Auswahl; **ESC** beendet den Multi-Modus.
- **Beleuchtungs-Panel:** Gruppen mit Überschriften, Trennlinien; **Licht-Presets** nur als direkte Buttons (kein Dropdown).
- **Skalierung:** Für **Custom-/Import-Assets** feinere Dezimalstellen (6) am Slider/Inspector.
- **Fokus:** Kurze Sperre für Boden-Klicks nach Gizmo-Drag verhindert versehentliches Deselektieren; **ESC** im Edit-Modus leert die Auswahl (wenn kein Multi-Modus aktiv).
- **Performance:** Inspector „Performance“ — HUD (FPS, Draw-Calls, Geometrien, optional JS-Heap in Chrome), max. Pixel-Ratio, **Instancing (Opt-in, standard aus)** für identische opake Boxen ohne Decals (ein `InstancedMesh` pro Gruppe; kann Klick-Selektion für diese Objekte einschränken), **Distanz-Culling**, **virtuelle Bibliotheks-Liste** (`react-window` `List` ab konfigurierbarem Schwellwert), LOD-Hinweis, Schatten-Metadaten-Toggle.
- **Text-Labels:** **`BillboardTextLabel`** mit Canvas-Textur; **Textfarbe** und **Hintergrundfarbe** jeweils mit vollem **`ColorPickerPopover`** (wie andere Objekte, inkl. Favoriten); Hintergrund optional mit **Transparenz**; keine doppelte Material-Farbe für Text-Assets im Inspector.
- **Ansicht / Kamera:** Toolbar **Ansicht** — **Perspektive** mit Live-Slidern, eingebauten und **eigenen Presets** (`localStorage`); **Top, Front, Seite** mit eigenen Slidern (Höhe, FOV, Abstände, Offsets), Werte werden im Layout mit **`axisViewCameras`** gespeichert.
- **Backward Compatibility:** `version: 8`, `layoutFormatSemver: "1.2.0"`, `finalizeImportedPayload` beim Laden/Import.

### Bibliothek & Gruppen (Feinschliff)

- Drag & Drop oder Gruppen-Dialog einer **User-Gruppe**: Vorlage wird als **Kopie** („… (Kopie)“, neue Typ-ID) in die Ziel-Gruppe gelegt; die ursprüngliche Zuordnung bleibt erhalten. Zurück in die **Kategorie (Standard)** wie bisher ohne Duplikat (`assign` entfernt nur die Gruppen-Zuordnung).
- **Leere User-Gruppen** bleiben sichtbar (optional „(leer)“ im Titel); Löschen der Gruppe nur per × und immer mit Bestätigung (auch wenn leer).

### 3D-Szene

- Realistische Beleuchtung mit HDRI-Umgebung (`warehouse`), konfigurierbare Schatten, optional Fog/Hintergrund/Exposure/Bloom; View-Mode mit zusaetzlichem Fill-Light.
- Hallenboden in Betonoptik, dezentes Grid, Hallenrahmen mit Rueck- und Seitenwaenden.
- Orbit-Kamera mit Damping, Zoom-To-Cursor; feste Preset-Richtungen plus **anpassbare Achsenansichten** (gespeichert pro Top/Front/Seite).
- Ghost-Placement-Vorschau beim Platzieren.
- Hover-Feedback ueber Pointer-Enter/Leave mit kurzem Debounce beim Verlassen, damit Submesh-Wechsel die Animation nicht neu starten.

### Objekt-Auswahl & Klicks

- **Zuverlässige Auswahl**: Selektion läuft über **`pointerdown`** (Primärtaste), damit `OrbitControls` und verzögerte `click`-Events die Auswahl nicht „schlucken“.
- **Fokus bleibt beim Loslassen**: Boden-Deselektion nutzt ebenfalls **`pointerdown`** (nicht **`click`**). So wird vermieden, dass nach einem Pick das getroffene Mesh zwischen **Down** und **Up** aus der Szene verschwindet (Wechsel Instancing → Einzelmesh / Gizmo) und der **mouseup**/`click`-Raycast fälschlich den **Boden** trifft — zuvor wirkte das wie „Deselektion beim Loslassen“.
- **Raycasting**: R3F nutzt die **Canvas-Bounding-Box** für Pointer-Normalisierung; **`PLANNER_RAYCASTER_PROPS`** auf dem `Canvas` setzt etwas höhere **Line-/Points-Thresholds** für dünnere Geometrien.
- **Transform-Gizmo**: Klicks auf Gizmo-Handles ändern die Auswahl nicht (Handles liegen außerhalb der Asset-Hit-Tests der Szene).
- **Deselektion**: Leerer Bereich / Boden mit Auswahl-Werkzeug (**pointerdown**), **ESC**, oder wie bisher; kurze Sperre nach Asset-Pick verhindert Race-Conditions mit Boden-Handler.
- **Hover & Cursor**: Im **Edit-Modus** zeigen gesperrte und freie Assets weiterhin Hover-Feedback. Im **View-Modus** nur bei **nicht gesperrten, nicht-Zonen**-Assets; gesperrte/Zonen werden visuell und per Cursor ignoriert.

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
  - **Eigene Assets**: GLB/GLTF/STL-Upload

### Edit-Features

- Asset-Bibliothek links, kategorisiert.
- Platzieren per Klick auf den Boden, `STRG/CMD` fuer freies Platzieren ohne Grid-Snap.
- Auswahl per Klick, `STRG/CMD + Klick` fuer Mehrfachauswahl.
- Transform-Gizmo: Bewegen / Drehen / Skalieren, auch fuer Mehrfachauswahl.
- Inspector:
  - Position X/Y/Z, Rotation X/Y/Z (Grad), Skalierung X/Y/Z
  - Farbe (eigener Farbpicker mit Swatches, RGB, Hex)
  - Name, Beschreibung, Zonen-/Typ (bearbeiten per ✎, leeren; Zone mit Vorschlägen)
  - Custom Metadata (dynamisch hinzufuegen, loeschen)
  - Textinhalt-Feld fuer Label-Assets (Live-Update im 3D-Text)
  - **Decals / Texturen**: PNG, JPEG, WebP und **animierte GIFs** auf Oberflächen; Größe, Transparenz, Position, Seite wie bei Bildern; bei GIFs: Wiedergabe an/aus, Geschwindigkeit (0,5×–2×), Loop oder einmalig, Anzeige Frame-Anzahl / fps (Hinweis Performance, max. 60 Frames beim Abspielen).
  - **Eigene Assets aus der Szene**: Auswahl eines Objekts → **Als Asset speichern…** im Inspector oder **Rechtsklick** auf das Asset (Auswahl-Werkzeug) → Dialog; neue Vorlage in **Eigene Assets** mit Material, Skalierung, Decals (inkl. GIF-Einstellungen) und Metadata je nach Checkboxen.
- Undo/Redo (`STRG/CMD + Z`, `STRG/CMD + Y`, `STRG/CMD + Shift + Z`).
- Copy/Paste (`STRG/CMD + C`, `STRG/CMD + V`).
- Loeschen per Button oder `Entf`/`Backspace`.

### 3D-Modell-Upload

- Formate: `.glb`, `.gltf`, **`.stl`** (max. 20 MB pro Datei).
- STL-Import nutzt den three.js `STLLoader`:
  - Geometrie wird zentriert (`computeBoundingBox` + `center`), normalisiert und auf den Boden gestellt.
  - Standard-Material (grau) mit Farbe aus dem Asset, weil STL keine Materialien enthält.
  - Vertex-Normals werden bei Bedarf berechnet.
- Im Inspector stehen für Modelle folgende Optik-Toggles bereit:
  - **Wireframe** (hilfreich für CAD-Modelle)
  - **Flat Shading** (nur STL, CAD-Look mit erkennbaren Facetten)

### Persistenz

- **Auto-Speichern**: Knopf "Speichern" persistiert das aktuelle Layout als `factory-layout` in `localStorage` (versioniert, mit Custom-Templates).
- **Layout-Slots**: "Als Slot" speichert das aktuelle Layout mit benanntem Slot in `factory-layout-slots`. Mehrere Slots mit Datum/Zeit und Anzahl Assets.
- **Laden-Dialog** (`Laden`-Knopf):
  - Auto-Slot laden
  - Liste aller gespeicherten Slots (laden, umbenennen, loeschen)
  - Externe `.json`-Datei auswaehlen und importieren
- **Export**: Dialog mit **Nur Workspace** (nur Szene + Boden + Licht + nötige eigene Modelle) oder **Komplette Konfiguration** (Bibliothek, Gruppen, Favoriten, Präsentationsmodus, aufgeklappte Sektionen). Dateinamen mit Zeitstempel (`layout_…` / `factory_layout_complete_…`).
- **Import**: JSON-Dateien werden validiert; Workspace-Dateien (`exportKind: workspace`) überschreiben nur die Szene und mergen nötige eigene Vorlagen, die Bibliothek bleibt sonst erhalten.

### UI / Layout

- Feste App-Hoehe (kein Seiten-Scroll), Top-Bar darf umbrechen.
- Panels (Library, Inspector) werden im View Mode per CSS ausgeblendet (nicht unmountet) — Inspector bleibt nach Mode-Wechsel stabil.
- Modal-Animationen (Fade + Scale).

### Asset-Gruppen (Bibliothek)

- Kategorien in der linken Asset-Bibliothek sind anklappbar (Chevron dreht sich, Hohe animiert).
- Expandierter Zustand: nur **aufgeklappte** Sektionen werden unter `factory-library-section-expanded-v2` gespeichert; beim Start sind alle Gruppen zu. **Eigene Assets** steht immer unten in der Liste.
- **Eigene Gruppen**: Button „+ Neue Gruppe“ öffnet einen Dialog; User-Gruppen sind per **×** im Kopf löschbar (mit Bestätigung, falls noch Vorlagen zugeordnet sind).
- **Zuordnung**: Kontextmenü **„In Gruppe verschieben“** oder **Drag & Drop** einer Vorlage auf eine Gruppenzeile (Favoriten sind kein Zuweisungs-Ziel).
- **Kontextmenü (⋮)** pro Vorlage: Einheitliche Zeilen mit **24px-Icon-Spalte** und Text; Favoriten toggeln, Name/Beschreibung/Tags bearbeiten, Gruppe, 3D-Vorschau, Instanz in die Szene einfügen, Details (inkl. Abmessungen), eigene Uploads aus der Bibliothek löschen (mit Bestätigung); Trennlinien zwischen Aktions-Gruppen.
- **Favoriten**: Sektion **„★ Favoriten“** oben; Favoriten und `libraryOrganization` (inkl. optional `templateDisplayOverrides` für eingebaute Vorlagen) werden mit dem Workspace persistiert (**Layout-Version 6**).
- **Liste**: kompakt nur **Anzeigename** (keine Maßzeile); Maße u. a. im Dialog **Details anzeigen**.
- **Import**: **+** rechts neben **„Eigene Assets“** (Tooltip „Asset importieren“); Mehrfach-Import **GLB, GLTF, STL, OBJ, FBX** (max. 20 MB/Datei); feste Bibliotheks-Gruppe **„Eigene Assets“** (`isSpecial`, nicht löschbar).
- Platzierte Szene-Assets erhalten weiterhin optional `groupId` (Template-Kategorie); siehe `IMPLEMENTATION_PROGRESS.md` (Chronik ab Stand 14).

### Hover-Feedback (Bugfix)

- Hover-Highlight und leichte Skalierung bleiben stabil, wenn die Maus ueber komplexe Meshes (z. B. GLTF mit Teilgeometrien) bewegt wird — kein staendiges Neu-Triggern durch Pointer-Flattern zwischen Submeshes.

### Tastenkuerzel (UI)

- Die fruehere statische Shortcuts-Leiste unten im Edit-Modus entfaellt; alle Kuerzel stehen im Dialog ueber den Button „?“ rechts unten.
- Speicher-Rueckmeldungen erscheinen als kompakte Toast-Zeile unten in der Szene.

### Bibliothek & eigene Vorlagen

- Kategorien starten **zugeklappt**; aufgeklappte Sektionen in `factory-library-section-expanded-v2`.
- **Import** nur über **+** bei „Eigene Assets“; Status „Importiert…“ während der Verarbeitung.
- Hochgeladene **eigene** Vorlagen: Kontextmenü **„Löschen“** (mit Bestätigung; alle Szene-Instanzen dieses Typs werden gelöscht).

### Placement & Sperre

- **Ghost**-Vorschau beim Platzieren: kräftigere Darstellung (höhere Deckkraft, Emissive in Asset-Farbe).
- **Gesperrte** Assets in der Szene: hellere Darstellung und dezentes Leuchten (Idle).

### Beleuchtung

- Toolbar **„Beleuchtung“** (Edit-Modus): erweitertes Panel mit Live-Update.
- **Light-Presets**: Studio, Natural, Dramatic, Evening, Night (plus Custom).
- **Mehrere Lichter**: Primary (Richtung per Elevation/Azimut/Distanz), optionales Secondary (Point / Spot / Directional), optionales Fill (automatisch gegenüber dem Hauptlicht), Ambient.
- **Schatten**: Ein/Aus, Qualität Low/Medium/High (512²–2048²), Intensität/Dunkelheit, Weichzeichner, Shadow-Kamera-Größe, Bias.
- **Atmosphäre**: Hintergrundfarbe, **Exposure**, **Gamma** (wirkt auf Licht- und HDRI-Stärke), optionales **Bloom** (Postprocessing).
- **Fog / Nebel**: Ein/Aus, Farbe, **Linear** (Start/Ende in m) oder **Exponentiell** (Dichte 0–1), gespeichert im Workspace.
- Das Beleuchtungs-Popover liegt per **Z-Index** über der 3D-Arbeitsfläche; globale Modals (z. B. Layout laden, Tastenkürzel) bleiben darüber.
- Einstellungen werden mit dem Workspace gespeichert (Feld `lighting` in JSON / `localStorage`; Layout-Version siehe `STORAGE_VERSION` im Store).

### Decals & Texturen

- Bilder **PNG, JPEG, WebP** auf die Asset-Oberfläche legen (Näherung über Bounding-Box / Primitive-Maße).
- Im Inspector unter **Material**: **Bild / Decal** — Import, Entfernen, **Größe** (10–500 %), **Bild-Deckkraft**, **Position** (X/Y), **Rotation**, **Seite** (Oben/Unten/Vorne/Hinten/Links/Rechts oder alle Seiten).
- Daten in `visual.decals` (Data-URL), mit dem Workspace speicherbar.
- 3D-Text-Assets: kein Decal-Block (fokus auf Label-Text).

### Metadata-Felder

- **Name, Beschreibung, Zonen-/Typ**: im Inspector per **✎** bearbeiten (Speichern, Abbrechen, Leeren); Zonen-/Typ mit Vorschlägen aus platzierten Assets und Freitext; **×** leert den Zonen-/Typ schnell.
- **Custom Metadata**: Zeilen mit **stabiler ID**; **Name und Wert** in einer Zeile (links/rechts, mit Ellipsis bei langem Text); Name per Klick editierbar; **×** löscht die Zeile.
- `customRows` im JSON (plus abgeleitetes `customData` für Kompatibilität); Import alter Layouts migriert automatisch.

### Inspector & Beschreibungen

- **Info-Icons (? )** bei den meisten Feld-Labels (Inspector, Bibliothek, Vorlagen-Details, Export/Laden, Beleuchtung, Boden, Stapel-Ansicht): Kurztexte zentral in `planner-app/src/ui/fieldDescriptions.ts`, Anzeige per Hover/Fokus (`InfoIcon`).
- Spart Platz; lange Erklär-Absätze wurden in Tooltips verlagert.

### Sprache / Zeichen

- UI mit **UTF-8** und deutschen **Umlauten** (ä, ö, ü, ß) wo angezeigt; `index.html` mit `lang="de"`.

## Bedienung

- **Auswahl**: Asset anklicken
- **Mehrfachauswahl**: `STRG` + Klick (oder `CMD` auf macOS)
- **Platzieren**: Tool "Platzieren" aktivieren, Asset waehlen, auf Boden klicken
- **Freies Platzieren/Bewegen/Rotieren**: `STRG/CMD` gedrueckt halten
- **Loeschen**: Button "Loeschen" oder `Entf`
- **Abbrechen Platzierung / Info-Popup schliessen**: `Escape`
- **Mode-Wechsel**: `Bearbeiten` / `Praesentation` in der Top-Bar
