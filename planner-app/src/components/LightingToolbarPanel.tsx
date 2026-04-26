import ColorPickerPopover from './ColorPickerPopover'
import InfoIcon from './InfoIcon'
import {
  cloneLighting,
  DEFAULT_LIGHTING,
  shadowMapSizeForQuality,
  sphericalToCartesian,
  type LightingSettings,
  type SecondaryLightType,
} from '../types/lighting'
import { sanitizeColor } from '../types/asset'
import { FIELD_DESC } from '../ui/fieldDescriptions'

const PRESETS: Record<string, Partial<LightingSettings>> = {
  Standard: {},
  Studio: {
    mainIntensity: 1.45,
    ambientIntensity: 0.32,
    environmentIntensity: 1.1,
    mainColor: '#fff8f0',
    shadowRadius: 3,
    fogColor: '#c5d0de',
    fogNear: 50,
    fogFar: 150,
  },
  Dunkel: {
    mainIntensity: 0.75,
    ambientIntensity: 0.12,
    environmentIntensity: 0.65,
    mainColor: '#d4e5ff',
    fogColor: '#2a3140',
    fogNear: 35,
    fogFar: 120,
  },
  Natürlich: {
    mainIntensity: 1.15,
    ambientIntensity: 0.28,
    environmentIntensity: 1.25,
    mainColor: '#fff3dd',
    mainPosition: [14, 28, 18],
    fogColor: '#a8b8c8',
    fogNear: 60,
    fogFar: 160,
  },
  Dramatisch: {
    mainIntensity: 1.55,
    ambientIntensity: 0.1,
    environmentIntensity: 0.75,
    mainColor: '#ffe8d4',
    fogEnabled: true,
    fogColor: '#1e2430',
    fogNear: 25,
    fogFar: 130,
  },
  Abend: {
    mainIntensity: 0.95,
    ambientIntensity: 0.18,
    environmentIntensity: 0.9,
    mainColor: '#ffd4a8',
    mainPosition: [10, 20, 22],
    fogColor: '#4a3f52',
    fogNear: 40,
    fogFar: 165,
  },
  Nacht: {
    mainIntensity: 0.55,
    ambientIntensity: 0.08,
    environmentIntensity: 0.45,
    mainColor: '#a8c8ff',
    fogColor: '#0a0e14',
    fogNear: 18,
    fogFar: 100,
  },
}

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

  return (
    <div className="lighting-toolbar-panel">
      <section className="lighting-panel-section">
        <h4 className="lighting-panel-section-title">
          Licht-Preset
          <InfoIcon title={FIELD_DESC.lightingPresets} className="lighting-panel-help-icon" />
        </h4>
        <div className="lighting-presets lighting-presets--compact">
          {Object.keys(PRESETS).map((name) => (
            <button
              key={name}
              type="button"
              className="lighting-preset-btn"
              onClick={() =>
                name === 'Standard'
                  ? setLighting(cloneLighting(DEFAULT_LIGHTING))
                  : setLighting({ ...cloneLighting(DEFAULT_LIGHTING), ...PRESETS[name] })
              }
            >
              {name}
            </button>
          ))}
        </div>
      </section>

      <hr className="lighting-panel-divider" />

      <section className="lighting-panel-section">
        <h4 className="lighting-panel-section-title">Hauptlicht (Primary)</h4>
        <label className="lighting-field">
          <span className="inspector-inline-label">
            Lichttyp
            <InfoIcon title={FIELD_DESC.lightingMainType} />
          </span>
          <div className="lighting-radio-row">
            {(['directional', 'point', 'spot'] as const).map((t) => (
              <label key={t} className="lighting-radio">
                <input
                  type="radio"
                  name="mainLightType"
                  checked={lighting.mainType === t}
                  onChange={() => setLighting({ mainType: t })}
                />
                {t === 'directional' ? 'Directional' : t === 'point' ? 'Point' : 'Spot'}
              </label>
            ))}
          </div>
        </label>

        <label className="opacity-slider-field">
          <span className="inspector-inline-label">
            Intensität ({lighting.mainIntensity.toFixed(2)})
            <InfoIcon title={FIELD_DESC.lightingMainIntensity} />
          </span>
          <input
            type="range"
            min={0}
            max={3}
            step={0.05}
            value={lighting.mainIntensity}
            onChange={(e) => setLighting({ mainIntensity: Number(e.target.value) })}
          />
        </label>

        <ColorPickerPopover
          label="Farbe"
          hint={FIELD_DESC.lightingMainColor}
          value={lighting.mainColor}
          onCommit={(c) => setLighting({ mainColor: sanitizeColor(c) })}
        />

        <p className="lighting-subheading inspector-inline-label lighting-panel-nested">
          Position (Kugelkoordinaten)
          <InfoIcon title={FIELD_DESC.lightingPosition} />
        </p>
        <div className="vector-grid lighting-mini-grid lighting-panel-nested">
        <label className="metadata-field">
          X
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
      </section>

      <hr className="lighting-panel-divider" />

      <section className="lighting-panel-section">
      <div className="lighting-section">
        <p className="lighting-section-title lighting-panel-section-title">Secondary (optional)</p>
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
        <p className="lighting-section-title lighting-panel-section-title">Fill (gegenüber Primary)</p>
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
        <p className="lighting-section-title lighting-panel-section-title">Ambient</p>
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
        <p className="lighting-section-title lighting-panel-section-title">Schatten</p>
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
        <p className="lighting-section-title lighting-panel-section-title">Atmosphäre</p>
        <ColorPickerPopover
          label="Hintergrund"
          hint="Farbe hinter der Szene (Canvas-Hintergrund)."
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
          <span className="inspector-inline-label">
            HDRI-Stärke ({lighting.environmentIntensity.toFixed(2)})
            <InfoIcon title={FIELD_DESC.lightingEnvironmentIntensity} />
          </span>
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

      <p className="lighting-subheading inspector-inline-label lighting-panel-section-title">
        Nebel (Fog)
        <InfoIcon title={FIELD_DESC.lightingFogToggle} />
      </p>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={lighting.fogEnabled}
          onChange={(e) => setLighting({ fogEnabled: e.target.checked })}
        />
        <span>Nebel aktiv</span>
      </label>
      <label className="lighting-field">
        <span className="inspector-inline-label">Nebel-Typ</span>
        <div className="lighting-radio-row">
          <label className="lighting-radio">
            <input
              type="radio"
              name="fogTypeToolbar"
              checked={lighting.fogType === 'linear'}
              onChange={() => custom({ fogType: 'linear' })}
            />
            Linear
          </label>
          <label className="lighting-radio">
            <input
              type="radio"
              name="fogTypeToolbar"
              checked={lighting.fogType === 'exponential'}
              onChange={() => custom({ fogType: 'exponential' })}
            />
            Exponential
          </label>
        </div>
      </label>
      {lighting.fogType === 'exponential' ? (
        <label className="opacity-slider-field">
          Nebel-Dichte ({lighting.fogDensity.toFixed(2)})
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={lighting.fogDensity}
            onChange={(e) => custom({ fogDensity: Number(e.target.value) })}
          />
        </label>
      ) : null}
      <ColorPickerPopover
        label="Nebelfarbe"
        hint={FIELD_DESC.lightingFogColor}
        value={lighting.fogColor}
        onCommit={(c) => setLighting({ fogColor: sanitizeColor(c) })}
      />
      <label className="metadata-field">
        <span className="inspector-inline-label">
          Nebel Start (m)
          <InfoIcon title={FIELD_DESC.lightingFogNear} />
        </span>
        <input
          type="number"
          min={1}
          max={400}
          step={1}
          value={lighting.fogNear}
          onChange={(e) => setLighting({ fogNear: Number(e.target.value) })}
        />
      </label>
      <label className="metadata-field">
        <span className="inspector-inline-label">
          Nebel Ende (m)
          <InfoIcon title={FIELD_DESC.lightingFogFar} />
        </span>
        <input
          type="number"
          min={5}
          max={700}
          step={1}
          value={lighting.fogFar}
          onChange={(e) => setLighting({ fogFar: Number(e.target.value) })}
        />
      </label>
    </section>
    </div>
  )
}
