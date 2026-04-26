import ColorPickerPopover from './ColorPickerPopover'
import {
  applyLightPreset,
  cloneLighting,
  DEFAULT_LIGHTING,
  shadowMapSizeForQuality,
  sphericalToCartesian,
  type LightPresetId,
  type LightingSettings,
  type SecondaryLightType,
} from '../types/lighting'
import { sanitizeColor } from '../types/asset'

const PRESET_OPTIONS: { id: Exclude<LightPresetId, 'custom'>; label: string }[] = [
  { id: 'studio', label: 'Studio' },
  { id: 'natural', label: 'Natural' },
  { id: 'dramatic', label: 'Dramatic' },
  { id: 'evening', label: 'Evening' },
  { id: 'night', label: 'Night' },
]

const SWATCH_MAIN = [
  { label: 'Warm', color: '#fff3dd' },
  { label: 'Kühl', color: '#ddeeff' },
  { label: 'Neutral', color: '#ffffff' },
]

export default function LightingToolbarPanel({
  lighting,
  setLighting,
}: {
  lighting: LightingSettings
  setLighting: (patch: Partial<LightingSettings>) => void
}) {
  const custom = (patch: Partial<LightingSettings>) =>
    setLighting({ ...patch, lightPreset: 'custom' })

  const syncMainFromSpherical = (base: LightingSettings, patch: Partial<LightingSettings>) => {
    const next = { ...base, ...patch }
    const pos = sphericalToCartesian(
      next.primaryDistance,
      next.primaryElevationDeg,
      next.primaryAzimuthDeg,
    )
    setLighting({
      ...patch,
      mainPosition: pos,
      lightPreset: 'custom',
    })
  }

  const onShadowQuality = (q: LightingSettings['shadowQuality']) => {
    setLighting({
      shadowQuality: q,
      shadowMapSize: shadowMapSizeForQuality(q),
      lightPreset: 'custom',
    })
  }

  const activeExtra =
    (lighting.secondaryEnabled ? 1 : 0) + (lighting.fillEnabled ? 1 : 0)
  const tooBright = lighting.mainIntensity > 2.65 && lighting.exposure > 1.35
  const tooDark = lighting.mainIntensity < 0.25 && lighting.ambientIntensity < 0.12

  return (
    <div className="lighting-toolbar-panel">
      <div className="lighting-section">
        <p className="lighting-section-title">Light-Preset</p>
        <label className="metadata-field lighting-preset-select">
          Preset
          <select
            value={lighting.lightPreset === 'custom' ? 'custom' : lighting.lightPreset}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'custom') {
                setLighting({ lightPreset: 'custom' })
                return
              }
              setLighting(applyLightPreset(v as Exclude<LightPresetId, 'custom'>))
            }}
          >
            <option value="custom">Custom</option>
            {PRESET_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="lighting-section">
        <p className="lighting-section-title">Primary (Hauptlicht)</p>
        <label className="lighting-field">
          Typ
          <div className="lighting-radio-row">
            {(['directional', 'point', 'spot'] as const).map((t) => (
              <label key={t} className="lighting-radio">
                <input
                  type="radio"
                  name="mainLightType"
                  checked={lighting.mainType === t}
                  onChange={() => custom({ mainType: t })}
                />
                {t === 'directional' ? 'Directional' : t === 'point' ? 'Point' : 'Spot'}
              </label>
            ))}
          </div>
        </label>

        <label className="opacity-slider-field">
          Intensität ({lighting.mainIntensity.toFixed(2)})
          <input
            type="range"
            min={0}
            max={3}
            step={0.05}
            value={lighting.mainIntensity}
            onChange={(e) => custom({ mainIntensity: Number(e.target.value) })}
          />
        </label>
        {(tooBright || tooDark) && (
          <p className="lighting-hint lighting-hint--warn">
            {tooBright
              ? 'Sehr hell — Highlights können ausfressen.'
              : 'Sehr dunkel — Szene evtl. schwer lesbar.'}
          </p>
        )}

        <div className="lighting-swatch-row">
          <span className="lighting-swatch-label">Schnellfarben</span>
          {SWATCH_MAIN.map((s) => (
            <button
              key={s.label}
              type="button"
              className="lighting-swatch-btn"
              title={s.label}
              style={{ background: s.color }}
              onClick={() => custom({ mainColor: s.color })}
            />
          ))}
        </div>
        <ColorPickerPopover
          label="Farbe"
          value={lighting.mainColor}
          onCommit={(c) => custom({ mainColor: sanitizeColor(c) })}
        />

        <label className="opacity-slider-field">
          Distanz ({lighting.primaryDistance.toFixed(0)} m)
          <input
            type="range"
            min={8}
            max={90}
            step={1}
            value={lighting.primaryDistance}
            onChange={(e) =>
              syncMainFromSpherical(lighting, { primaryDistance: Number(e.target.value) })
            }
          />
        </label>
        <label className="opacity-slider-field">
          Elevation ({lighting.primaryElevationDeg.toFixed(0)}°)
          <input
            type="range"
            min={0}
            max={90}
            step={1}
            value={lighting.primaryElevationDeg}
            onChange={(e) =>
              syncMainFromSpherical(lighting, { primaryElevationDeg: Number(e.target.value) })
            }
          />
        </label>
        <label className="opacity-slider-field">
          Azimut ({lighting.primaryAzimuthDeg.toFixed(0)}°)
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={lighting.primaryAzimuthDeg}
            onChange={(e) =>
              syncMainFromSpherical(lighting, { primaryAzimuthDeg: Number(e.target.value) })
            }
          />
        </label>

        {lighting.mainType === 'spot' && (
          <>
            <label className="opacity-slider-field">
              Spot-Winkel ({lighting.spotAngle.toFixed(2)})
              <input
                type="range"
                min={0.2}
                max={1.1}
                step={0.02}
                value={lighting.spotAngle}
                onChange={(e) => custom({ spotAngle: Number(e.target.value) })}
              />
            </label>
            <label className="opacity-slider-field">
              Penumbra ({lighting.spotPenumbra.toFixed(2)})
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={lighting.spotPenumbra}
                onChange={(e) => custom({ spotPenumbra: Number(e.target.value) })}
              />
            </label>
          </>
        )}
      </div>

      <div className="lighting-section">
        <p className="lighting-section-title">Secondary (optional)</p>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={lighting.secondaryEnabled}
            onChange={(e) => custom({ secondaryEnabled: e.target.checked })}
          />
          <span>Aktivieren</span>
        </label>
        {lighting.secondaryEnabled ? (
          <>
            <label className="lighting-field">
              Typ
              <div className="lighting-radio-row">
                {(['point', 'spot', 'directional'] as SecondaryLightType[]).map((t) => (
                  <label key={t} className="lighting-radio">
                    <input
                      type="radio"
                      name="secondaryLightType"
                      checked={lighting.secondaryType === t}
                      onChange={() => custom({ secondaryType: t })}
                    />
                    {t === 'directional' ? 'Dir.' : t === 'point' ? 'Point' : 'Spot'}
                  </label>
                ))}
              </div>
            </label>
            <label className="opacity-slider-field">
              Intensität ({lighting.secondaryIntensity.toFixed(2)})
              <input
                type="range"
                min={0}
                max={3}
                step={0.05}
                value={lighting.secondaryIntensity}
                onChange={(e) => custom({ secondaryIntensity: Number(e.target.value) })}
              />
            </label>
            <ColorPickerPopover
              label="Farbe"
              value={lighting.secondaryColor}
              onCommit={(c) => custom({ secondaryColor: sanitizeColor(c) })}
            />
            <p className="lighting-subheading">Position (m)</p>
            <div className="vector-grid lighting-mini-grid">
              <label className="metadata-field">
                X
                <input
                  type="number"
                  step={0.5}
                  value={lighting.secondaryPosition[0]}
                  onChange={(e) =>
                    custom({
                      secondaryPosition: [
                        Number(e.target.value),
                        lighting.secondaryPosition[1],
                        lighting.secondaryPosition[2],
                      ],
                    })
                  }
                />
              </label>
              <label className="metadata-field">
                Y
                <input
                  type="number"
                  step={0.5}
                  value={lighting.secondaryPosition[1]}
                  onChange={(e) =>
                    custom({
                      secondaryPosition: [
                        lighting.secondaryPosition[0],
                        Number(e.target.value),
                        lighting.secondaryPosition[2],
                      ],
                    })
                  }
                />
              </label>
              <label className="metadata-field">
                Z
                <input
                  type="number"
                  step={0.5}
                  value={lighting.secondaryPosition[2]}
                  onChange={(e) =>
                    custom({
                      secondaryPosition: [
                        lighting.secondaryPosition[0],
                        lighting.secondaryPosition[1],
                        Number(e.target.value),
                      ],
                    })
                  }
                />
              </label>
            </div>
            {lighting.secondaryType !== 'directional' ? (
              <label className="opacity-slider-field">
                Reichweite ({lighting.secondaryDistance.toFixed(0)} m)
                <input
                  type="range"
                  min={10}
                  max={150}
                  step={2}
                  value={lighting.secondaryDistance}
                  onChange={(e) => custom({ secondaryDistance: Number(e.target.value) })}
                />
              </label>
            ) : null}
            {lighting.secondaryType === 'spot' ? (
              <>
                <label className="opacity-slider-field">
                  Spot-Winkel ({lighting.secondarySpotAngle.toFixed(2)})
                  <input
                    type="range"
                    min={0.2}
                    max={1.1}
                    step={0.02}
                    value={lighting.secondarySpotAngle}
                    onChange={(e) => custom({ secondarySpotAngle: Number(e.target.value) })}
                  />
                </label>
                <label className="opacity-slider-field">
                  Penumbra ({lighting.secondarySpotPenumbra.toFixed(2)})
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={lighting.secondarySpotPenumbra}
                    onChange={(e) => custom({ secondarySpotPenumbra: Number(e.target.value) })}
                  />
                </label>
              </>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="lighting-section">
        <p className="lighting-section-title">Fill (gegenüber Primary)</p>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={lighting.fillEnabled}
            onChange={(e) => custom({ fillEnabled: e.target.checked })}
          />
          <span>Aktivieren</span>
        </label>
        {lighting.fillEnabled ? (
          <>
            <label className="opacity-slider-field">
              Intensität ({lighting.fillIntensity.toFixed(2)})
              <input
                type="range"
                min={0}
                max={2.5}
                step={0.05}
                value={lighting.fillIntensity}
                onChange={(e) => custom({ fillIntensity: Number(e.target.value) })}
              />
            </label>
            <ColorPickerPopover
              label="Farbe"
              value={lighting.fillColor}
              onCommit={(c) => custom({ fillColor: sanitizeColor(c) })}
            />
            <p className="lighting-hint">Position automatisch gegenüber dem Hauptlicht.</p>
          </>
        ) : null}
      </div>

      <div className="lighting-section">
        <p className="lighting-section-title">Ambient</p>
        <label className="opacity-slider-field">
          Intensität ({lighting.ambientIntensity.toFixed(2)})
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.02}
            value={lighting.ambientIntensity}
            onChange={(e) => custom({ ambientIntensity: Number(e.target.value) })}
          />
        </label>
        <ColorPickerPopover
          label="Farbe"
          value={lighting.ambientColor}
          onCommit={(c) => custom({ ambientColor: sanitizeColor(c) })}
        />
      </div>

      <div className="lighting-section">
        <p className="lighting-section-title">Schatten</p>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={lighting.castShadow}
            onChange={(e) => custom({ castShadow: e.target.checked })}
          />
          <span>Schatten aktivieren</span>
        </label>
        <label className="metadata-field">
          Qualität
          <select
            value={lighting.shadowQuality}
            onChange={(e) => onShadowQuality(e.target.value as LightingSettings['shadowQuality'])}
          >
            <option value="low">Low (512²)</option>
            <option value="medium">Medium (1024²)</option>
            <option value="high">High (2048²)</option>
          </select>
        </label>
        <p className="lighting-hint">Höhere Qualität: schärfere Schatten, mehr GPU-Last.</p>
        <label className="opacity-slider-field">
          Schatten-Intensität / Dunkelheit ({lighting.shadowIntensity.toFixed(2)})
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={lighting.shadowIntensity}
            onChange={(e) => custom({ shadowIntensity: Number(e.target.value) })}
          />
        </label>
        <label className="opacity-slider-field">
          Weichzeichner / Blur ({lighting.shadowRadius.toFixed(2)})
          <input
            type="range"
            min={0}
            max={3}
            step={0.05}
            value={Math.min(3, lighting.shadowRadius)}
            onChange={(e) => custom({ shadowRadius: Number(e.target.value) })}
          />
        </label>
        <label className="opacity-slider-field">
          Shadow-Kamera Größe ({lighting.shadowCameraSize.toFixed(0)})
          <input
            type="range"
            min={50}
            max={500}
            step={5}
            value={lighting.shadowCameraSize}
            onChange={(e) => custom({ shadowCameraSize: Number(e.target.value) })}
          />
        </label>
        <label className="opacity-slider-field">
          Shadow Bias ({lighting.shadowBias.toFixed(4)})
          <input
            type="range"
            min={0.0001}
            max={0.001}
            step={0.00005}
            value={lighting.shadowBias}
            onChange={(e) => custom({ shadowBias: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="lighting-section">
        <p className="lighting-section-title">Atmosphäre &amp; Fog</p>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={lighting.fogEnabled}
            onChange={(e) => custom({ fogEnabled: e.target.checked })}
          />
          <span>Fog aktivieren</span>
        </label>
        {lighting.fogEnabled ? (
          <>
            <ColorPickerPopover
              label="Fog-Farbe"
              value={lighting.fogColor}
              onCommit={(c) => custom({ fogColor: sanitizeColor(c) })}
            />
            {lighting.fogType === 'exponential' ? (
              <label className="opacity-slider-field">
                Fog-Dichte ({lighting.fogDensity.toFixed(2)})
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={lighting.fogDensity}
                  onChange={(e) => custom({ fogDensity: Number(e.target.value) })}
                />
              </label>
            ) : (
              <p className="lighting-hint">Linearer Fog: Dichte über Start/Ende.</p>
            )}
            <label className="opacity-slider-field">
              Fog-Start ({lighting.fogNear.toFixed(1)} m)
              <input
                type="range"
                min={0}
                max={100}
                step={0.5}
                value={lighting.fogNear}
                onChange={(e) => custom({ fogNear: Number(e.target.value) })}
              />
            </label>
            <label className="opacity-slider-field">
              Fog-Ende ({lighting.fogFar.toFixed(1)} m)
              <input
                type="range"
                min={5}
                max={500}
                step={5}
                value={lighting.fogFar}
                onChange={(e) => custom({ fogFar: Number(e.target.value) })}
              />
            </label>
            <label className="lighting-field">
              Fog-Typ
              <div className="lighting-radio-row">
                <label className="lighting-radio">
                  <input
                    type="radio"
                    name="fogType"
                    checked={lighting.fogType === 'linear'}
                    onChange={() => custom({ fogType: 'linear' })}
                  />
                  Linear
                </label>
                <label className="lighting-radio">
                  <input
                    type="radio"
                    name="fogType"
                    checked={lighting.fogType === 'exponential'}
                    onChange={() => custom({ fogType: 'exponential' })}
                  />
                  Exponential
                </label>
              </div>
            </label>
          </>
        ) : null}

        <ColorPickerPopover
          label="Hintergrund"
          value={lighting.backgroundColor}
          onCommit={(c) => custom({ backgroundColor: sanitizeColor(c) })}
        />
        <label className="opacity-slider-field">
          Exposure ({lighting.exposure.toFixed(2)})
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.02}
            value={lighting.exposure}
            onChange={(e) => custom({ exposure: Number(e.target.value) })}
          />
        </label>
        <label className="opacity-slider-field">
          Gamma ({lighting.gamma.toFixed(2)})
          <input
            type="range"
            min={0.5}
            max={2.5}
            step={0.05}
            value={lighting.gamma}
            onChange={(e) => custom({ gamma: Number(e.target.value) })}
          />
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={lighting.bloomEnabled}
            onChange={(e) => custom({ bloomEnabled: e.target.checked })}
          />
          <span>Bloom</span>
        </label>
        {lighting.bloomEnabled ? (
          <label className="opacity-slider-field">
            Bloom-Stärke ({lighting.bloomIntensity.toFixed(2)})
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={lighting.bloomIntensity}
              onChange={(e) => custom({ bloomIntensity: Number(e.target.value) })}
            />
          </label>
        ) : null}
        <label className="opacity-slider-field">
          HDRI-Umgebung ({lighting.environmentIntensity.toFixed(2)})
          <input
            type="range"
            min={0}
            max={2.5}
            step={0.05}
            value={lighting.environmentIntensity}
            onChange={(e) => custom({ environmentIntensity: Number(e.target.value) })}
          />
        </label>
      </div>

      {activeExtra >= 2 ? (
        <p className="lighting-hint lighting-hint--perf">
          Mehrere Zusatzlichter aktiv — kann die FPS senken.
        </p>
      ) : null}

      <div className="lighting-section lighting-section--actions">
        <button
          type="button"
          className="lighting-reset-btn"
          onClick={() => setLighting(cloneLighting(DEFAULT_LIGHTING))}
        >
          Auf Standard zurücksetzen
        </button>
      </div>
    </div>
  )
}
