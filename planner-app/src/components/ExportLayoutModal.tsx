import { useState } from 'react'
import type { LayoutExportKind } from '../store/useAssetsStore'
import InfoIcon from './InfoIcon'
import { FIELD_DESC } from '../ui/fieldDescriptions'

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
        <h3 id="export-layout-title" className="inspector-inline-label">
          Export
          <InfoIcon title="Modus wählen und Layout als JSON-Datei herunterladen." />
        </h3>

        <fieldset className="export-layout-fieldset">
          <legend className="sr-only">Export-Modus</legend>
          <label className="export-layout-option">
            <input
              type="radio"
              name="export-kind"
              checked={kind === 'workspace'}
              onChange={() => setKind('workspace')}
            />
            <span className="inspector-inline-label">
              <span className="export-layout-option-label">Nur Workspace</span>
              <InfoIcon title={FIELD_DESC.exportWorkspace} />
            </span>
          </label>

          <label className="export-layout-option">
            <input
              type="radio"
              name="export-kind"
              checked={kind === 'complete'}
              onChange={() => setKind('complete')}
            />
            <span className="inspector-inline-label">
              <span className="export-layout-option-label">Komplette Konfiguration</span>
              <InfoIcon title={FIELD_DESC.exportComplete} />
            </span>
          </label>
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
