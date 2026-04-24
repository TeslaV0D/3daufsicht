# Kurzstatus (Factory Planning Studio)

Langfassung: siehe [IMPLEMENTATION_PROGRESS.md](./IMPLEMENTATION_PROGRESS.md) (Abschnitt „Stand 8“).

## Abgeschlossen

- Asset-Gruppen (anklappbar) — LocalStorage, Chevron, Animation
- Hover-Highlight stabil bei Bewegung ueber komplexe Meshes (Debounce beim Leave)
- Unten-Leiste mit Shortcuts entfernt — Kuerzel nur im „?“-Modal; Save-Feedback als Toast

## Details

- Gruppen expandierbar/kollapsierbar; persistierter Zustand pro Kategorie
- Hover triggert nicht bei jedem Submesh-Wechsel neu
- Bottom Bar entfernt; Shortcuts im Menue rechts unten
