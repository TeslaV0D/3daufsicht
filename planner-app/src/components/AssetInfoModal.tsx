import { useEffect, useRef } from 'react'
import type { Asset } from '../types/asset'

export interface AssetInfoModalProps {
  asset: Asset
  onClose: () => void
}

export default function AssetInfoModal({ asset, onClose }: AssetInfoModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (modalRef.current?.contains(target)) return
      onClose()
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [onClose])

  const name = asset.metadata.name ?? asset.type
  const description = asset.metadata.description ?? 'Keine Beschreibung vorhanden.'
  const zoneType = asset.metadata.zoneType
  const customData = asset.metadata.customData ?? {}
  const customEntries = Object.entries(customData)

  return (
    <div
      className="asset-info-modal"
      role="dialog"
      aria-labelledby="asset-info-title"
      ref={modalRef}
      key={asset.id}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="asset-info-header">
        <div className="asset-info-color-pill" style={{ backgroundColor: asset.color }} />
        <div className="asset-info-title-block">
          <h3 id="asset-info-title">{name}</h3>
          <p>
            {asset.category}
            {zoneType ? ` - ${zoneType}` : ''}
          </p>
        </div>
        <button
          type="button"
          className="asset-info-close"
          onClick={onClose}
          aria-label="Schliessen"
        >
          x
        </button>
      </div>

      <p className="asset-info-description">{description}</p>

      {customEntries.length > 0 && (
        <div className="asset-info-custom">
          <h4>Details</h4>
          <dl>
            {customEntries.map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}
