import type { Asset } from '../types/asset'

export interface AssetInfoModalProps {
  asset: Asset
  onClose: () => void
}

export default function AssetInfoModal({ asset, onClose }: AssetInfoModalProps) {
  const name = asset.metadata.name ?? asset.type
  const description = asset.metadata.description ?? 'Keine Beschreibung vorhanden.'
  const zoneType = asset.metadata.zoneType
  const customData = asset.metadata.customData ?? {}
  const customEntries = Object.entries(customData)

  return (
    <div className="asset-info-modal" role="dialog" aria-labelledby="asset-info-title">
      <div className="asset-info-header">
        <div className="asset-info-color-pill" style={{ backgroundColor: asset.color }} />
        <div className="asset-info-title-block">
          <h3 id="asset-info-title">{name}</h3>
          <p>
            {asset.category}
            {zoneType ? ` - ${zoneType}` : ''}
          </p>
        </div>
        <button type="button" className="asset-info-close" onClick={onClose} aria-label="Schliessen">
          x
        </button>
      </div>

      <p className="asset-info-description">{description}</p>

      <div className="asset-info-meta">
        <div>
          <span className="asset-info-label">Typ</span>
          <span>{asset.type}</span>
        </div>
        <div>
          <span className="asset-info-label">Form</span>
          <span>{asset.geometry.kind}</span>
        </div>
        <div>
          <span className="asset-info-label">Position</span>
          <span>
            {asset.position.map((v) => v.toFixed(1)).join(' / ')}
          </span>
        </div>
        <div>
          <span className="asset-info-label">Skalierung</span>
          <span>
            {asset.scale.map((v) => v.toFixed(1)).join(' / ')}
          </span>
        </div>
      </div>

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
