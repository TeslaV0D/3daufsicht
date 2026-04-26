import { useState } from 'react'
import type { Asset } from '../types/asset'
import type { SaveSceneAssetTemplateOptions } from '../AssetFactory'
import InfoIcon from './InfoIcon'
import { FIELD_DESC } from '../ui/fieldDescriptions'

function decalSummary(asset: Asset): string {
  const decals = asset.visual?.decals ?? []
  if (decals.length === 0) return 'Keine'
  let gifs = 0
  let imgs = 0
  for (const d of decals) {
    const g =
      d.mediaKind === 'gif' ||
      d.imageUrl.startsWith('data:image/gif') ||
      /\.gif$/i.test(d.imageName)
    if (g) gifs += 1
    else imgs += 1
  }
  const parts: string[] = []
  if (imgs) parts.push(`${imgs} Bild${imgs !== 1 ? 'er' : ''}`)
  if (gifs) parts.push(`${gifs} GIF`)
  return parts.join(', ')
}

function SaveAssetFromSceneForm({
  asset,
  onClose,
  onSave,
}: {
  asset: Asset
  onClose: () => void
  onSave: (opts: SaveSceneAssetTemplateOptions) => void
}) {
  const [name, setName] = useState(() => asset.metadata.name?.trim() || asset.type)
  const [description, setDescription] = useState(() => asset.metadata.description ?? '')
  const [zoneType, setZoneType] = useState(() => asset.metadata.zoneType ?? '')
  const [saveMaterial, setSaveMaterial] = useState(true)
  const [saveScale, setSaveScale] = useState(true)
  const [saveDecals, setSaveDecals] = useState(true)
  const [saveMetadata, setSaveMetadata] = useState(true)

  const scalePct = `${Math.round(asset.scale[0] * 100)}% / ${Math.round(asset.scale[1] * 100)}% / ${Math.round(asset.scale[2] * 100)}%`

  return (
    <div
      className="library-dialog-backdrop"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        className="library-dialog save-asset-dialog"
        role="dialog"
        aria-labelledby="save-asset-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="save-asset-title" className="inspector-inline-label">
          Als Asset speichern
          <InfoIcon title={FIELD_DESC.saveFromSceneTitle} />
        </h3>

        <label className="library-dialog-field">
          <span className="inspector-inline-label">
            Name
            <InfoIcon title={FIELD_DESC.saveFromSceneName} />
          </span>
          <input
            className="library-dialog-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="library-dialog-field">
          <span className="inspector-inline-label">
            Beschreibung
            <InfoIcon title={FIELD_DESC.saveFromSceneDescription} />
          </span>
          <textarea
            className="library-dialog-textarea"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <label className="library-dialog-field">
          <span className="inspector-inline-label">
            Zonen-/Typ
            <InfoIcon title={FIELD_DESC.saveFromSceneZone} />
          </span>
          <input
            className="library-dialog-input"
            value={zoneType}
            onChange={(e) => setZoneType(e.target.value)}
          />
        </label>

        <fieldset className="save-asset-fieldset">
          <legend className="save-asset-legend">In Vorlage übernehmen</legend>
          <label className="checkbox-field save-asset-check">
            <input
              type="checkbox"
              checked={saveMaterial}
              onChange={(e) => setSaveMaterial(e.target.checked)}
            />
            <span className="inspector-inline-label">
              Material &amp; Farbe
              <InfoIcon title={FIELD_DESC.saveFromSceneMaterial} />
            </span>
          </label>
          <label className="checkbox-field save-asset-check">
            <input
              type="checkbox"
              checked={saveScale}
              onChange={(e) => setSaveScale(e.target.checked)}
            />
            <span className="inspector-inline-label">
              Größe &amp; Skalierung
              <InfoIcon title={FIELD_DESC.saveFromSceneScale} />
            </span>
          </label>
          <label className="checkbox-field save-asset-check">
            <input
              type="checkbox"
              checked={saveDecals}
              onChange={(e) => setSaveDecals(e.target.checked)}
            />
            <span className="inspector-inline-label">
              Decals / Bilder / GIFs
              <InfoIcon title={FIELD_DESC.saveFromSceneDecals} />
            </span>
          </label>
          <label className="checkbox-field save-asset-check">
            <input
              type="checkbox"
              checked={saveMetadata}
              onChange={(e) => setSaveMetadata(e.target.checked)}
            />
            <span className="inspector-inline-label">
              Metadata (Custom-Felder)
              <InfoIcon title={FIELD_DESC.saveFromSceneMetadata} />
            </span>
          </label>
        </fieldset>

        <p className="save-asset-preview">
          Skalierung: {saveScale ? scalePct : '1:1:1 (Standard)'}
          <br />
          Decals: {saveDecals ? decalSummary(asset) : '—'}
        </p>

        <div className="library-dialog-actions">
          <button
            type="button"
            onClick={() => {
              onSave({
                label: name.trim() || asset.type,
                description: description.trim(),
                zoneType: zoneType.trim(),
                saveMaterial,
                saveScale,
                saveDecals,
                saveMetadata,
              })
            }}
          >
            Speichern
          </button>
          <button type="button" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SaveAssetFromSceneModal({
  open,
  asset,
  onClose,
  onSave,
}: {
  open: boolean
  asset: Asset | null
  onClose: () => void
  onSave: (opts: SaveSceneAssetTemplateOptions) => void
}) {
  if (!open || !asset) return null
  return <SaveAssetFromSceneForm asset={asset} onClose={onClose} onSave={onSave} />
}
