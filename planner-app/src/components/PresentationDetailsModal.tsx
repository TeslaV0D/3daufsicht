import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef } from 'react'
import { getCustomRows, type Asset } from '../types/asset'

export type PresentationDetailsModalProps = {
  asset: Asset
  onClose: () => void
}

/**
 * Vollbild-Details-Dialog im Präsentationsmodus: nur semantische Metadaten, read-only.
 */
function PresentationDetailsModalImpl({ asset, onClose }: PresentationDetailsModalProps) {
  const headingId = `presentation-details-heading-${useId().replace(/:/g, '')}`
  const openStartedAt = useRef(0)

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

  const name = asset.metadata.name?.trim() || '—'
  const description = asset.metadata.description?.trim() || '—'
  const notes = asset.metadata.presentationNotes?.trim() || '—'
  const zone = asset.metadata.zoneType?.trim()
  const customRows = getCustomRows(asset.metadata)

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
              {name}
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
            <h3 className="presentation-details-section-title">Informationen</h3>
            <dl className="presentation-details-dl">
              <div className="presentation-details-row">
                <dt>Name</dt>
                <dd>{name}</dd>
              </div>
              <div className="presentation-details-row">
                <dt>Beschreibung</dt>
                <dd className="presentation-details-multiline">{description}</dd>
              </div>
              <div className="presentation-details-row">
                <dt>Notizen</dt>
                <dd className="presentation-details-multiline">{notes}</dd>
              </div>
              <div className="presentation-details-row">
                <dt>Typ (Vorlage)</dt>
                <dd>
                  <code className="presentation-details-mono">{asset.type}</code>
                </dd>
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
          <div className="presentation-details-footer-spacer" />
          <button type="button" className="presentation-details-btn-close" onClick={onClose}>
            Schließen
          </button>
        </footer>
      </div>
    </div>
  )
}

const PresentationDetailsModal = memo(PresentationDetailsModalImpl)
export default PresentationDetailsModal
