import ColorPickerPopover from './ColorPickerPopover'
import InfoIcon from './InfoIcon'
import { cloneLighting, DEFAULT_LIGHTING, type LightingSettings } from '../types/lighting'
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
  return (
    <div className="lighting-toolbar-panel">
      <div className="lighting-presets-wrap">
        <div className="lighting-presets">
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
        <InfoIcon title={FIELD_DESC.lightingPresets} className="lighting-panel-help-icon" />
      </div>

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
          Hauptlicht ({lighting.mainIntensity.toFixed(2)})
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

      <label className="opacity-slider-field">
        <span className="inspector-inline-label">
          Umgebung ({lighting.ambientIntensity.toFixed(2)})
          <InfoIcon title={FIELD_DESC.lightingAmbientIntensity} />
        </span>
        <input
          type="range"
          min={0}
          max={1.5}
          step={0.02}
          value={lighting.ambientIntensity}
          onChange={(e) => setLighting({ ambientIntensity: Number(e.target.value) })}
        />
      </label>

      <ColorPickerPopover
        label="Lichtfarbe"
        hint={FIELD_DESC.lightingMainColor}
        value={lighting.mainColor}
        onCommit={(c) => setLighting({ mainColor: sanitizeColor(c) })}
      />

      <ColorPickerPopover
        label="Umgebungsfarbe"
        hint={FIELD_DESC.lightingAmbientColor}
        value={lighting.ambientColor}
        onCommit={(c) => setLighting({ ambientColor: sanitizeColor(c) })}
      />

      <p className="lighting-subheading inspector-inline-label">
        Lichtposition (m)
        <InfoIcon title={FIELD_DESC.lightingPosition} />
      </p>
      <div className="vector-grid lighting-mini-grid">
        <label className="metadata-field">
          X
          <input
            type="number"
            step={0.5}
            value={lighting.mainPosition[0]}
            onChange={(e) =>
              setLighting({
                mainPosition: [
                  Number(e.target.value),
                  lighting.mainPosition[1],
                  lighting.mainPosition[2],
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
            value={lighting.mainPosition[1]}
            onChange={(e) =>
              setLighting({
                mainPosition: [
                  lighting.mainPosition[0],
                  Number(e.target.value),
                  lighting.mainPosition[2],
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
            value={lighting.mainPosition[2]}
            onChange={(e) =>
              setLighting({
                mainPosition: [
                  lighting.mainPosition[0],
                  lighting.mainPosition[1],
                  Number(e.target.value),
                ],
              })
            }
          />
        </label>
      </div>

      {lighting.mainType === 'spot' && (
        <>
          <label className="opacity-slider-field">
            <span className="inspector-inline-label">
              Spot-Winkel ({lighting.spotAngle.toFixed(2)})
              <InfoIcon title={FIELD_DESC.lightingSpotAngle} />
            </span>
            <input
              type="range"
              min={0.2}
              max={1.1}
              step={0.02}
              value={lighting.spotAngle}
              onChange={(e) => setLighting({ spotAngle: Number(e.target.value) })}
            />
          </label>
          <label className="opacity-slider-field">
            <span className="inspector-inline-label">
              Penumbra ({lighting.spotPenumbra.toFixed(2)})
              <InfoIcon title={FIELD_DESC.lightingSpotPenumbra} />
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={lighting.spotPenumbra}
              onChange={(e) => setLighting({ spotPenumbra: Number(e.target.value) })}
            />
          </label>
        </>
      )}

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={lighting.castShadow}
          onChange={(e) => setLighting({ castShadow: e.target.checked })}
        />
        <span className="inspector-inline-label">
          Schatten
          <InfoIcon title={FIELD_DESC.lightingCastShadow} />
        </span>
      </label>

      <label className="metadata-field">
        <span className="inspector-inline-label">
          Schatten-Kartengröße
          <InfoIcon title={FIELD_DESC.lightingShadowMapSize} />
        </span>
        <select
          value={lighting.shadowMapSize}
          onChange={(e) =>
            setLighting({
              shadowMapSize: Number(e.target.value) as 512 | 1024 | 2048,
            })
          }
        >
          <option value={512}>512</option>
          <option value={1024}>1024</option>
          <option value={2048}>2048</option>
        </select>
      </label>

      <label className="opacity-slider-field">
        <span className="inspector-inline-label">
          Schatten-Weichzeichner ({lighting.shadowRadius.toFixed(1)})
          <InfoIcon title={FIELD_DESC.lightingShadowRadius} />
        </span>
        <input
          type="range"
          min={0}
          max={10}
          step={0.25}
          value={lighting.shadowRadius}
          onChange={(e) => setLighting({ shadowRadius: Number(e.target.value) })}
        />
      </label>

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
          onChange={(e) => setLighting({ environmentIntensity: Number(e.target.value) })}
        />
      </label>

      <p className="lighting-subheading inspector-inline-label">
        Nebel
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
    </div>
  )
}
