import { useMemo, useState } from 'react'

export interface ShortcutRow {
  keys: string
  action: string
}

export interface ShortcutCategory {
  title: string
  rows: ShortcutRow[]
}

const SHORTCUT_DATA: ShortcutCategory[] = [
  {
    title: 'Auswahl & Modus',
    rows: [
      { keys: 'Klick', action: 'Einzelnes Asset auswählen' },
      { keys: 'STRG/CMD + Klick', action: 'Zur Mehrfachauswahl hinzufügen oder entfernen' },
      { keys: 'Escape', action: 'Schichtweise: Farbwähler, Vorschau, Dialoge, Menüs, Suche; dann Auswahl-Tool' },
      { keys: 'E', action: 'Bearbeiten ↔ Präsentation' },
      { keys: 'H', action: 'Inspector-Panel ein/aus' },
      { keys: 'M', action: 'Asset-Bibliothek ein/aus' },
    ],
  },
  {
    title: 'Platzieren',
    rows: [
      { keys: 'Platzieren-Tool', action: 'Klicks auf Assets werden ignoriert' },
      { keys: 'STRG/CMD', action: 'Freie Platzierung / freies Verschieben am Gizmo' },
    ],
  },
  {
    title: 'Transform (Auswahl-Modus)',
    rows: [
      { keys: 'G', action: 'Bewegen (Translate)' },
      { keys: 'R', action: 'Drehen' },
      { keys: 'S', action: 'Skalieren (stufenlos am Gizmo)' },
      { keys: 'Toolbar', action: 'Gizmo nur wenn Auswahl freigeschaltet' },
      { keys: '⋮ Werkzeuge', action: 'Ausrichten, Verteilen, Raster (Menü)' },
    ],
  },
  {
    title: 'Assets bearbeiten (Auswahl-Modus)',
    rows: [
      { keys: 'D', action: 'Ausgewählte löschen' },
      { keys: 'Entf / Backspace', action: 'Ausgewählte löschen' },
      { keys: 'L', action: 'Sperren / Entsperren (Auswahl)' },
      { keys: 'F', action: 'Favoriten: alle Typen hinzufügen oder alle entfernen' },
      { keys: 'C', action: 'Farbauswahl öffnen' },
      { keys: 'STRG/CMD + C', action: 'Kopieren' },
      { keys: 'STRG/CMD + V', action: 'Einfügen' },
      { keys: 'Shift + C', action: 'Kopieren' },
      { keys: 'Shift + V', action: 'Einfügen' },
    ],
  },
  {
    title: 'Ansicht',
    rows: [
      { keys: '1', action: 'Kamera: Perspektive' },
      { keys: '2', action: 'Kamera: Top' },
      { keys: '3', action: 'Kamera: Front' },
      { keys: '4', action: 'Kamera: Seite' },
      { keys: 'Toolbar', action: 'Perspektive · Top · Front · Seite' },
      { keys: 'Maus', action: 'Orbit, Zoom, Pan' },
    ],
  },
  {
    title: 'Rückgängig',
    rows: [
      { keys: 'STRG/CMD + Z', action: 'Undo' },
      { keys: 'STRG/CMD + Shift + Z / Y', action: 'Redo' },
      { keys: 'Z', action: 'Undo (Auswahl-Modus, kein Eingabefeld fokussiert)' },
      { keys: 'Shift + Z', action: 'Redo (Auswahl-Modus)' },
    ],
  },
  {
    title: 'Bibliothek',
    rows: [
      { keys: 'Suchfeld', action: 'Live-Filter (Name, Beschreibung, Tags)' },
      { keys: '× / Escape', action: 'Suche zurücksetzen' },
    ],
  },
]

export default function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return SHORTCUT_DATA
    return SHORTCUT_DATA.map((cat) => ({
      ...cat,
      rows: cat.rows.filter(
        (r) =>
          r.keys.toLowerCase().includes(q) || r.action.toLowerCase().includes(q),
      ),
    })).filter((c) => c.rows.length > 0)
  }, [filter])

  if (!open) return null

  return (
    <div
      className="shortcuts-modal-overlay"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        className="shortcuts-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shortcuts-modal-header">
          <h2 id="shortcuts-title">Tastenkürzel</h2>
          <button type="button" className="shortcuts-close" onClick={onClose} aria-label="Schließen">
            &times;
          </button>
        </div>
        <input
          type="search"
          className="shortcuts-search"
          placeholder="Filtern …"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="shortcuts-body">
          {filtered.map((cat) => (
            <section key={cat.title} className="shortcuts-section">
              <h3>{cat.title}</h3>
              <ul>
                {cat.rows.map((r) => (
                  <li key={`${cat.title}-${r.keys}`}>
                    <kbd className="shortcuts-kbd">{r.keys}</kbd>
                    <span className="shortcuts-arrow">&#8594;</span>
                    <span>{r.action}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
