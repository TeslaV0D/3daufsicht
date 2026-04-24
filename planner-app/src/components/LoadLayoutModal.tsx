import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { LayoutSlot } from '../store/useAssetsStore'

export interface LoadLayoutModalProps {
  slots: LayoutSlot[]
  onClose: () => void
  onLoadSlot: (id: string) => boolean
  onDeleteSlot: (id: string) => void
  onRenameSlot: (id: string, name: string) => void
  onLoadFile: (file: File) => Promise<boolean>
  onLoadCurrent: () => boolean
}

function formatDate(ts: number) {
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return ''
  }
}

export default function LoadLayoutModal({
  slots,
  onClose,
  onLoadSlot,
  onDeleteSlot,
  onRenameSlot,
  onLoadFile,
  onLoadCurrent,
}: LoadLayoutModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const showFeedback = useCallback((kind: 'ok' | 'error', message: string) => {
    setFeedback({ kind, message })
    window.setTimeout(() => setFeedback(null), 2200)
  }, [])

  const handleLoadCurrent = useCallback(() => {
    const ok = onLoadCurrent()
    if (ok) {
      showFeedback('ok', 'Aktuelles Layout geladen')
      onClose()
    } else {
      showFeedback('error', 'Kein aktuelles Layout gefunden')
    }
  }, [onClose, onLoadCurrent, showFeedback])

  const handleLoadSlot = useCallback(
    (id: string) => {
      const ok = onLoadSlot(id)
      if (ok) {
        showFeedback('ok', 'Layout geladen')
        onClose()
      } else {
        showFeedback('error', 'Konnte Layout nicht laden')
      }
    },
    [onClose, onLoadSlot, showFeedback],
  )

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      const ok = await onLoadFile(file)
      if (ok) {
        showFeedback('ok', `Datei geladen: ${file.name}`)
        onClose()
      } else {
        showFeedback('error', 'Datei konnte nicht gelesen werden.')
      }
    },
    [onClose, onLoadFile, showFeedback],
  )

  const startRename = useCallback((slot: LayoutSlot) => {
    setRenamingId(slot.id)
    setRenameDraft(slot.name)
  }, [])

  const commitRename = useCallback(() => {
    if (renamingId) {
      onRenameSlot(renamingId, renameDraft)
    }
    setRenamingId(null)
    setRenameDraft('')
  }, [onRenameSlot, renameDraft, renamingId])

  return (
    <div
      className="layout-modal-backdrop"
      ref={backdropRef}
      onMouseDown={(event) => {
        if (event.target === backdropRef.current) onClose()
      }}
      role="presentation"
    >
      <div
        className="layout-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="layout-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="layout-modal-header">
          <h3 id="layout-modal-title">Layout laden</h3>
          <button
            type="button"
            className="asset-info-close"
            aria-label="Schliessen"
            onClick={onClose}
          >
            x
          </button>
        </div>

        <section className="layout-modal-section">
          <div className="layout-modal-section-header">
            <h4>Aktuelles Auto-Layout</h4>
            <button type="button" onClick={handleLoadCurrent}>
              Auto-Layout laden
            </button>
          </div>
          <p className="panel-hint">
            Das zuletzt automatisch gespeicherte Layout (Speichern-Button).
          </p>
        </section>

        <section className="layout-modal-section">
          <div className="layout-modal-section-header">
            <h4>Gespeicherte Layouts ({slots.length})</h4>
          </div>
          {slots.length === 0 ? (
            <p className="panel-hint">Noch keine Slots gespeichert.</p>
          ) : (
            <ul className="layout-slot-list">
              {slots.map((slot) => (
                <li key={slot.id} className="layout-slot">
                  <div className="layout-slot-info">
                    {renamingId === slot.id ? (
                      <input
                        autoFocus
                        className="layout-slot-rename-input"
                        value={renameDraft}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') commitRename()
                          if (event.key === 'Escape') {
                            setRenamingId(null)
                            setRenameDraft('')
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="layout-slot-title"
                        onClick={() => startRename(slot)}
                        title="Umbenennen"
                      >
                        {slot.name}
                      </button>
                    )}
                    <small>
                      {slot.assetCount} Assets — {formatDate(slot.savedAt)}
                    </small>
                  </div>
                  <div className="layout-slot-actions">
                    <button type="button" onClick={() => handleLoadSlot(slot.id)}>
                      Laden
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => onDeleteSlot(slot.id)}
                      aria-label="Loeschen"
                    >
                      Loeschen
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="layout-modal-section">
          <div className="layout-modal-section-header">
            <h4>Externe Datei laden</h4>
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              Datei auswaehlen
            </button>
          </div>
          <p className="panel-hint">
            Erwartet ein mit &quot;Export&quot; erstelltes <code>.json</code>-Layout.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </section>

        {feedback && (
          <div className={`layout-modal-feedback ${feedback.kind}`}>{feedback.message}</div>
        )}
      </div>
    </div>
  )
}
