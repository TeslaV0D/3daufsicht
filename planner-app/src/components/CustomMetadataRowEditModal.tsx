import { useState } from 'react'
import type { CustomMetadataRow } from '../types/asset'
import InfoIcon from './InfoIcon'
import { FIELD_DESC } from '../ui/fieldDescriptions'

function FormBody({
  row,
  defaultDescriptionHint,
  onClose,
  onSave,
}: {
  row: CustomMetadataRow
  defaultDescriptionHint: string
  onClose: () => void
  onSave: (name: string, value: string, description: string) => void
}) {
  const [name, setName] = useState(() => row.name)
  const [value, setValue] = useState(() => row.value)
  const [description, setDescription] = useState(() => row.description ?? '')

  return (
    <div
      className="library-dialog-backdrop"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        className="library-dialog custom-meta-edit-dialog"
        role="dialog"
        aria-labelledby="custom-meta-edit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="custom-meta-edit-title" className="inspector-inline-label">
          Feld bearbeiten
          <InfoIcon title={FIELD_DESC.customMetaFieldEdit} />
        </h3>

        <label className="library-dialog-field">
          <span>Feldname</span>
          <input
            className="library-dialog-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
          />
        </label>

        <label className="library-dialog-field">
          <span>Feldwert</span>
          <textarea
            className="library-dialog-textarea"
            rows={4}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>

        <label className="library-dialog-field">
          <span className="subtle-hint">
            Eigene Beschreibung für (?)-Tooltip (optional)
          </span>
          <textarea
            className="library-dialog-textarea"
            rows={3}
            value={description}
            placeholder={`Standard: ${defaultDescriptionHint}`}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />
        </label>

        <p className="subtle-hint custom-meta-default-hint">
          Standard-Hilfe: <em>{defaultDescriptionHint}</em>
        </p>

        <div className="library-dialog-actions">
          <button
            type="button"
            onClick={() => {
              const n = name.trim()
              if (!n) return
              onSave(n, value, description.trim())
            }}
          >
            Speichern
          </button>
          <button
            type="button"
            className="subtle-delete"
            onClick={() => {
              const n = name.trim()
              if (!n) return
              onSave(n, value, '')
            }}
          >
            Hilfe zurücksetzen
          </button>
          <button type="button" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CustomMetadataRowEditModal({
  open,
  row,
  defaultDescriptionHint,
  onClose,
  onSave,
}: {
  open: boolean
  row: CustomMetadataRow | null
  defaultDescriptionHint: string
  onClose: () => void
  onSave: (rowId: string, name: string, value: string, description: string) => void
}) {
  if (!open || !row) return null
  return (
    <FormBody
      key={row.id}
      row={row}
      defaultDescriptionHint={defaultDescriptionHint}
      onClose={onClose}
      onSave={(name, value, description) => {
        onSave(row.id, name, value, description)
        onClose()
      }}
    />
  )
}
