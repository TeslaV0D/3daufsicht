import { useState } from 'react'
import type { LayoutExportKind } from '../store/useAssetsStore'

export interface ExportLayoutModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (kind: LayoutExportKind) => void
}

export default function ExportLayoutModal({ open, onClose, onConfirm }: ExportLayoutModalProps) {
  const [kind, setKind] = useState<LayoutExportKind>('workspace')

  if (!open) return null

  return (
    <div
      className="library-dialog-backdrop"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        className="library-dialog export-layout-dialog"
        role="dialog"
        aria-labelledby="export-layout-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="export-layout-title">Export</h3>
        <p className="export-layout-intro">Modus wählen und als JSON-Datei herunterladen.</p>

        <fieldset className="export-layout-fieldset">
          <legend className="sr-only">Export-Modus</legend>
          <label className="export-layout-option">
            <input
              type="radio"
              name="export-kind"
              checked={kind === 'workspace'}
              onChange={() => setKind('workspace')}
            />
            <span className="export-layout-option-label">Nur Workspace</span>
            <span
              className="export-layout-info"
              title="Nur die aktuell platzierte Szene speichern (schnell & klein)"
              aria-label="Nur die aktuell platzierte Szene speichern (schnell & klein)"
            >
              ?
            </span>
          </label>
          <p className="export-layout-hint">
            Speichert nur platzierte Assets mit Position, Rotation, Farbe, Beleuchtung und Boden.
            Benötigte eigene Modelle werden minimal mit abgelegt.
          </p>

          <label className="export-layout-option">
            <input
              type="radio"
              name="export-kind"
              checked={kind === 'complete'}
              onChange={() => setKind('complete')}
            />
            <span className="export-layout-option-label">Komplette Konfiguration</span>
            <span
              className="export-layout-info"
              title="Alles speichern: Metadaten aller Assets, Gruppen, Favoriten, Beleuchtung (umfassend)"
              aria-label="Alles speichern: Metadaten aller Assets, Gruppen, Favoriten, Beleuchtung (umfassend)"
            >
              ?
            </span>
          </label>
          <p className="export-layout-hint">
            Volles Projekt: Bibliothek, Gruppen, Favoriten, Ansicht, Präsentationsmodus und
            Bibliotheks-Zustand (aufgeklappte Gruppen).
          </p>
        </fieldset>

        <div className="library-dialog-actions">
          <button
            type="button"
            onClick={() => {
              onConfirm(kind)
              onClose()
            }}
          >
            Exportieren
          </button>
          <button type="button" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
