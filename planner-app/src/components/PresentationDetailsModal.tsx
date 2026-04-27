import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import {
  getCustomRows,
  resolveAssetOpacity,
  type Asset,
  type AssetMetadata,
} from '../types/asset'

const round2 = (n: number) => Number(n.toFixed(2))
const radToDeg3 = (r: number) => round2((r * 180) / Math.PI)
const PRESENTATION_NOTES_MAX = 12_000

const normalizeNameDesc = (s: string) => (s.trim() === '' ? undefined : s)
const normalizeNotes = (s: string) => {
  const t = s.trim()
  if (t === '') return undefined
  return t.slice(0, PRESENTATION_NOTES_MAX)
}

export type PresentationDetailsModalProps = {
  asset: Asset
  onClose: () => void
  /** Persistiert `name`, `description`, `presentationNotes` in den Metadaten des Assets. */
  onUpdateCoreMetadata: (id: string, metadata: Pick<AssetMetadata, 'name' | 'description' | 'presentationNotes'>) => void
}

/**
 * Vollbild-Details-Dialog im Präsentationsmodus; Leseansicht + Bearbeiten von Name, Beschreibung, Notizen.
 */
function PresentationDetailsModalImpl({ asset, onClose, onUpdateCoreMetadata }: PresentationDetailsModalProps) {
  const headingId = `presentation-details-heading-${useId().replace(/:/g, '')}`
  const openStartedAt = useRef(0)

  const [isEditing, setIsEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState(() => asset.metadata.name ?? '')
  const [descriptionDraft, setDescriptionDraft] = useState(() => asset.metadata.description ?? '')
  const [notesDraft, setNotesDraft] = useState(() => asset.metadata.presentationNotes ?? '')

  useLayoutEffect(() => {
    openStartedAt.current = performance.now()
  }, [])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const onOverlayPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.target !== e.currentTarget) return
      if (performance.now() - openStartedAt.current < 500) return
      onClose()
    },
    [onClose],
  )

  const displayName = asset.metadata.name?.trim() || '—'
  const displayDescription = asset.metadata.description?.trim() || '—'
  const displayNotes = asset.metadata.presentationNotes?.trim() || '—'
  const zone = asset.metadata.zoneType?.trim()
  const opacity = resolveAssetOpacity(asset)
  const customRows = getCustomRows(asset.metadata)

  const startEdit = useCallback(() => {
    setNameDraft(asset.metadata.name ?? '')
    setDescriptionDraft(asset.metadata.description ?? '')
    setNotesDraft(asset.metadata.presentationNotes ?? '')
    setIsEditing(true)
  }, [asset.metadata.name, asset.metadata.description, asset.metadata.presentationNotes])

  const cancelEdit = useCallback(() => {
    setNameDraft(asset.metadata.name ?? '')
    setDescriptionDraft(asset.metadata.description ?? '')
    setNotesDraft(asset.metadata.presentationNotes ?? '')
    setIsEditing(false)
  }, [asset.metadata.name, asset.metadata.description, asset.metadata.presentationNotes])

  const saveEdits = useCallback(() => {
    onUpdateCoreMetadata(asset.id, {
      name: normalizeNameDesc(nameDraft),
      description: normalizeNameDesc(descriptionDraft),
      presentationNotes: normalizeNotes(notesDraft),
    })
    setIsEditing(false)
  }, [asset.id, nameDraft, descriptionDraft, notesDraft, onUpdateCoreMetadata])

  return (
    <div
      className="presentation-details-overlay"
      role="presentation"
      onPointerDown={onOverlayPointerDown}
    >
      <div
        className="presentation-details-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header className="presentation-details-header">
          <div
            className="presentation-details-color-swatch"
            style={{ backgroundColor: asset.color }}
            title={asset.color}
            aria-hidden
          />
          <div>
            <h2 id={headingId} className="presentation-details-title">
              {isEditing ? nameDraft.trim() || '—' : displayName}
            </h2>
            <p className="presentation-details-sub">
              {asset.type} · {asset.category}
              {zone ? ` · ${zone}` : ''}
            </p>
          </div>
          <button
            type="button"
            className="presentation-details-close"
            onClick={onClose}
            aria-label="Schließen"
          >
            ×
          </button>
        </header>

        <div className="presentation-details-body">
          <section>
            <h3 className="presentation-details-section-title">Basis-Informationen</h3>
            {isEditing ? (
              <div className="presentation-details-edit-form">
                <div className="presentation-details-form-row">
                  <label className="presentation-details-form-label" htmlFor="presentation-edit-name">
                    Name
                  </label>
                  <input
                    id="presentation-edit-name"
                    className="presentation-details-input"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    maxLength={200}
                    autoComplete="off"
                  />
                </div>
                <div className="presentation-details-form-row">
                  <label className="presentation-details-form-label" htmlFor="presentation-edit-desc">
                    Beschreibung
                  </label>
                  <textarea
                    id="presentation-edit-desc"
                    className="presentation-details-textarea"
                    value={descriptionDraft}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    rows={4}
                    maxLength={8000}
                  />
                </div>
                <div className="presentation-details-form-row">
                  <label className="presentation-details-form-label" htmlFor="presentation-edit-notes">
                    Notizen
                  </label>
                  <textarea
                    id="presentation-edit-notes"
                    className="presentation-details-textarea presentation-details-textarea--notes"
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={4}
                    maxLength={PRESENTATION_NOTES_MAX}
                    placeholder="Sitzungs- oder Angebots-Notizen …"
                  />
                </div>
                <p className="presentation-details-form-hint">
                  Leere Felder werden in der Szenendatei als leer gespeichert. Notizen erscheinen nur hier, nicht
                  in der Werkstatt-Inspektion.
                </p>
              </div>
            ) : (
              <dl className="presentation-details-dl">
                <div className="presentation-details-row">
                  <dt>Name</dt>
                  <dd>{displayName}</dd>
                </div>
                <div className="presentation-details-row">
                  <dt>Beschreibung</dt>
                  <dd className="presentation-details-multiline">{displayDescription}</dd>
                </div>
                <div className="presentation-details-row">
                  <dt>Notizen</dt>
                  <dd className="presentation-details-multiline">{displayNotes}</dd>
                </div>
                <div className="presentation-details-row">
                  <dt>Typ (Vorlage)</dt>
                  <dd>
                    <code className="presentation-details-mono">{asset.type}</code>
                  </dd>
                </div>
              </dl>
            )}
          </section>

          <section>
            <h3 className="presentation-details-section-title">Transform & Geometrie</h3>
            <dl className="presentation-details-dl">
              <div className="presentation-details-row">
                <dt>Position (X, Y, Z)</dt>
                <dd>
                  {round2(asset.position[0])}, {round2(asset.position[1])},{' '}
                  {round2(asset.position[2])}
                </dd>
              </div>
              <div className="presentation-details-row">
                <dt>Rotation (°)</dt>
                <dd>
                  {radToDeg3(asset.rotation[0])}°, {radToDeg3(asset.rotation[1])}°,{' '}
                  {radToDeg3(asset.rotation[2])}°
                </dd>
              </div>
              <div className="presentation-details-row">
                <dt>Skalierung (X, Y, Z)</dt>
                <dd>
                  {round2(asset.scale[0])} × {round2(asset.scale[1])} × {round2(asset.scale[2])}
                </dd>
              </div>
              <div className="presentation-details-row">
                <dt>Geometrie</dt>
                <dd>
                  <code className="presentation-details-mono">{asset.geometry.kind}</code>
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="presentation-details-section-title">Material</h3>
            <dl className="presentation-details-dl">
              <div className="presentation-details-row presentation-details-color-row">
                <dt>Farbe</dt>
                <dd>
                  <span
                    className="presentation-details-swatch"
                    style={{ backgroundColor: asset.color }}
                    aria-label={`Farbe ${asset.color}`}
                  />
                  <code className="presentation-details-mono">{asset.color}</code>
                </dd>
              </div>
              <div className="presentation-details-row">
                <dt>Deckkraft</dt>
                <dd>{Math.round(opacity * 100)}%</dd>
              </div>
            </dl>
          </section>

          {customRows.length > 0 && (
            <section>
              <h3 className="presentation-details-section-title">Weitere Metadaten</h3>
              <dl className="presentation-details-dl">
                {customRows.map((row) => (
                  <div key={row.id} className="presentation-details-row">
                    <dt title={row.description || row.name}>{row.name}</dt>
                    <dd className="presentation-details-multiline">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>

        <footer className="presentation-details-footer">
          {isEditing ? (
            <>
              <button
                type="button"
                className="presentation-details-btn-secondary"
                onClick={cancelEdit}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="presentation-details-btn-primary"
                onClick={saveEdits}
              >
                Speichern
              </button>
            </>
          ) : (
            <>
              <button type="button" className="presentation-details-btn-edit" onClick={startEdit}>
                Eigenschaften anpassen
              </button>
              <div className="presentation-details-footer-spacer" />
              <button type="button" className="presentation-details-btn-close" onClick={onClose}>
                Schließen
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  )
}

const PresentationDetailsModal = memo(PresentationDetailsModalImpl)
export default PresentationDetailsModal
