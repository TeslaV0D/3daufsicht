# 3daufsicht

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
- **Praesentationsmodus (View Mode)**: read-only, Klick auf Asset oeffnet Info-Popup mit rein semantischen Infos (Name, Beschreibung, Kategorie, Custom Metadata).
- **Präsentations-Toolbar**: nur Kamera-Presets (Perspektive, Top, Front, Seite; ohne früheres „Cabinet“), Badge `VIEW MODE`, Button **„Präsentation beenden (ESC)“** — keine Modus-Tools, keine Beleuchtung, kein Speichern/Laden/Export, kein Shortcuts-„?“-FAB.
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

### Bibliothek & Gruppen (Feinschliff)

- Drag & Drop oder Gruppen-Dialog einer **User-Gruppe**: Vorlage wird als **Kopie** („… (Kopie)“, neue Typ-ID) in die Ziel-Gruppe gelegt; die ursprüngliche Zuordnung bleibt erhalten. Zurück in die **Kategorie (Standard)** wie bisher ohne Duplikat (`assign` entfernt nur die Gruppen-Zuordnung).
- **Leere User-Gruppen** bleiben sichtbar (optional „(leer)“ im Titel); Löschen der Gruppe nur per × und immer mit Bestätigung (auch wenn leer).

### 3D-Szene

- Realistische Beleuchtung mit HDRI-Umgebung (`warehouse`), Schatten in der gesamten Szene, View-Mode mit staerkerem Lighting und zusaetzlichem Fill-Light.
- Hallenboden in Betonoptik, dezentes Grid, Hallenrahmen mit Rueck- und Seitenwaenden.
- Orbit-Kamera mit Damping, Zoom-To-Cursor, Kamera-Presets (Perspektive, Top, Front, Seite).
- Ghost-Placement-Vorschau beim Platzieren.
- Hover-Feedback ueber Pointer-Enter/Leave mit kurzem Debounce beim Verlassen, damit Submesh-Wechsel die Animation nicht neu starten.

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

- Toolbar **„Beleuchtung“** (Edit-Modus): Hauptlicht-Typ (Directional / Point / Spot), Intensitäten, Farben, Position, Schatten, HDRI-Stärke, Presets.
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
