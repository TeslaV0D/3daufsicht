# Kurzstatus

Ausführliche Chronik: [../IMPLEMENTATION_PROGRESS.md](../IMPLEMENTATION_PROGRESS.md) (Abschnitt „Stand 15“).

**Hinweis:** Unter Windows entspricht ein Root-Dateiname `implementation_progress.md` oft derselben Datei wie `IMPLEMENTATION_PROGRESS.md` (Groß-/Kleinschreibung). Diese Kurzfassung liegt deshalb unter `docs/`.

## Abgeschlossen

- **Stand 15**: Import-`+` nur bei „Eigene Assets“; Gruppe unten; alle Gruppen starten zu (`factory-library-section-expanded-v2`); Export-Dialog Workspace vs. komplette Konfiguration; Wände-Kategorisierung entfernt; Kontextmenü „Löschen“.
- Asset-Gruppen: früher nur eingeklappte in LS — jetzt nur **aufgeklappte** explizit gespeichert.
- Eigene Assets: Löschen (×) inkl. Szenen-Instanzen und Persistenz
- Ghost-Vorschau kräftiger (Opacity + Emissive)
- Umlaute in UI und `lang="de"`
- Gesperrte Assets: heller + Glow
- Beleuchtungs-Panel in der Toolbar; Settings in Save/Load; Popover-Z-Index über Canvas
- Eigene Bibliotheks-Gruppen, Favoriten, Vorlagen per Kontextmenü & Drag & Drop; `templateDisplayOverrides` für Meta eingebauter Vorlagen; Layout **Version 6**
- Präsentationsmodus: Toolbar nur Ansichten + Beenden (ESC); Bibliotheksliste ohne Maße in der Zeile
- Kontextmenü mit ausgerichteter Icon-Spalte; Batch-Import (GLB/GLTF/STL/OBJ/FBX); spezielle Bibliotheks-Gruppe „Eigene Assets“ (`isSpecial`)

## Bugfixes

- **ESC im Vorlagen-Preview**: `TemplatePreviewDialog` nutzt einen `keydown`-Listener in der **Capture-Phase** auf `window` (damit er vor dem globalen Planner-Handler läuft), plus Fokus auf dem Backdrop (`tabIndex={-1}`) und `aria-modal` am Dialog. Overlay-Klick schließt weiterhin.

## Backlog (Ideen)

Siehe IMPLEMENTATION_PROGRESS.md → Stand 15 → „Optionale Erweiterungen“.
