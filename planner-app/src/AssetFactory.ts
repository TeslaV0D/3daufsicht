import type { Asset, AssetTemplate, GeometryKind } from './types/asset'
import { cloneAsset, FALLBACK_COLOR } from './types/asset'

export const CATEGORY_PRIMITIVE_3D = 'Primitive 3D'
export const CATEGORY_PRIMITIVE_2D = 'Primitive 2D'
export const CATEGORY_LOGISTICS = 'Logistik'
export const CATEGORY_PRODUCTION = 'Produktion'
export const CATEGORY_ZONES = 'Zonen'
export const CATEGORY_PATHS = 'Wege'
export const CATEGORY_LABELS = 'Labels'
export const CATEGORY_CUSTOM = 'Eigene Assets'

export const ASSET_TEMPLATES: AssetTemplate[] = [
  // ========== PRIMITIVE 3D ==========
  {
    type: 'primitive-box',
    label: 'Box',
    category: CATEGORY_PRIMITIVE_3D,
    color: '#5c7cfa',
    scale: [1.5, 1.5, 1.5],
    geometry: { kind: 'box', params: { width: 1, height: 1, depth: 1 } },
    metadata: { name: 'Box' },
  },
  {
    type: 'primitive-sphere',
    label: 'Sphere',
    category: CATEGORY_PRIMITIVE_3D,
    color: '#38d9a9',
    scale: [1.5, 1.5, 1.5],
    geometry: { kind: 'sphere', params: { radius: 0.5, segments: 32, heightSegments: 24 } },
    metadata: { name: 'Sphere' },
  },
  {
    type: 'primitive-cylinder',
    label: 'Cylinder',
    category: CATEGORY_PRIMITIVE_3D,
    color: '#fab005',
    scale: [1.5, 1.5, 1.5],
    geometry: {
      kind: 'cylinder',
      params: { radiusTop: 0.5, radiusBottom: 0.5, height: 1, radialSegments: 32 },
    },
    metadata: { name: 'Cylinder' },
  },
  {
    type: 'primitive-cone',
    label: 'Cone',
    category: CATEGORY_PRIMITIVE_3D,
    color: '#ff6b6b',
    scale: [1.5, 1.5, 1.5],
    geometry: {
      kind: 'cone',
      params: { radius: 0.5, height: 1, radialSegments: 32 },
    },
    metadata: { name: 'Cone' },
  },
  {
    type: 'primitive-torus',
    label: 'Torus',
    category: CATEGORY_PRIMITIVE_3D,
    color: '#d0bfff',
    scale: [1.5, 1.5, 1.5],
    geometry: {
      kind: 'torus',
      params: { radius: 0.5, tube: 0.15, radialSegments: 16, tubularSegments: 48 },
    },
    metadata: { name: 'Torus' },
  },
  {
    type: 'primitive-hexagon',
    label: 'Hexagon',
    category: CATEGORY_PRIMITIVE_3D,
    color: '#74c0fc',
    scale: [2, 1, 2],
    geometry: {
      kind: 'cylinder',
      params: { radiusTop: 0.5, radiusBottom: 0.5, height: 1, radialSegments: 6 },
    },
    metadata: { name: 'Hexagon' },
  },

  // ========== PRIMITIVE 2D ==========
  {
    type: 'primitive-plane',
    label: 'Plane',
    category: CATEGORY_PRIMITIVE_2D,
    color: '#adb5bd',
    scale: [3, 1, 3],
    geometry: { kind: 'plane', params: { width: 1, height: 1 } },
    metadata: { name: 'Plane' },
    visual: { opacity: 0.95, transparent: true, doubleSided: true },
  },
  {
    type: 'primitive-circle',
    label: 'Circle',
    category: CATEGORY_PRIMITIVE_2D,
    color: '#20c997',
    scale: [2, 1, 2],
    geometry: { kind: 'circle', params: { radius: 0.5, segments: 48 } },
    metadata: { name: 'Circle' },
    visual: { opacity: 0.95, transparent: true, doubleSided: true },
  },
  {
    type: 'primitive-ring',
    label: 'Ring',
    category: CATEGORY_PRIMITIVE_2D,
    color: '#f06595',
    scale: [2.5, 1, 2.5],
    geometry: {
      kind: 'ring',
      params: { innerRadius: 0.35, outerRadius: 0.5, segments: 48 },
    },
    metadata: { name: 'Ring' },
    visual: { opacity: 0.95, transparent: true, doubleSided: true },
  },

  // ========== LOGISTIK ==========
  {
    type: 'shelf-block',
    label: 'Regalblock',
    category: CATEGORY_LOGISTICS,
    color: '#2f9e44',
    scale: [1.8, 2.4, 0.8],
    geometry: { kind: 'box', params: { width: 1, height: 1, depth: 1 } },
    metadata: {
      name: 'Regalblock',
      description: 'Standard Regal fuer Bauteile.',
      customData: {
        Bereich: 'Logistik',
        Inhalt: 'Bauteile',
        Reichweite: '2 Tage',
      },
    },
  },
  {
    type: 'forklift',
    label: 'Hubwagen',
    category: CATEGORY_LOGISTICS,
    color: '#f59f00',
    scale: [1.6, 1.1, 2.4],
    geometry: { kind: 'box', params: { width: 1, height: 1, depth: 1 } },
    metadata: {
      name: 'Hubwagen',
      description: 'Mobiler Hubwagen fuer den Materialfluss.',
      customData: {
        Bereich: 'Materialfluss',
        Status: 'Bereit',
        Fahrer: 'M. Keller',
      },
    },
  },
  {
    type: 'crate-stack',
    label: 'Kisten',
    category: CATEGORY_LOGISTICS,
    color: '#8d6e63',
    scale: [1.2, 1.2, 1.2],
    geometry: { kind: 'box', params: { width: 1, height: 1, depth: 1 } },
    metadata: {
      name: 'Kisten',
      description: 'Kistenstapel im Wareneingang.',
      customData: {
        Bereich: 'Wareneingang',
        Inhalt: 'Komponenten',
        Bestand: '32',
      },
    },
  },

  // ========== PRODUKTION ==========
  {
    type: 'production-line',
    label: 'Produktionslinie',
    category: CATEGORY_PRODUCTION,
    color: '#3d8bfd',
    scale: [5, 1.2, 1.8],
    geometry: { kind: 'box', params: { width: 1, height: 1, depth: 1 } },
    metadata: {
      name: 'Produktionslinie',
      description: 'Hauptproduktionslinie fuer Montage.',
      customData: {
        Bereich: 'FA1-Montage',
        Kapazitaet: '60 Teile/h',
        Verantwortlich: 'Team Alpha',
      },
    },
  },
  {
    type: 'workbench',
    label: 'Arbeitsplatz',
    category: CATEGORY_PRODUCTION,
    color: '#f08c00',
    scale: [1.2, 1, 1.2],
    geometry: {
      kind: 'cylinder',
      params: { radiusTop: 0.5, radiusBottom: 0.5, height: 1, radialSegments: 24 },
    },
    metadata: {
      name: 'Arbeitsplatz',
      description: 'Einzel-Arbeitsplatz fuer Montageaufgaben.',
      customData: {
        Bereich: 'FA2-Montage',
        Schicht: 'Frueh',
        Personal: '2',
      },
    },
  },
  {
    type: 'employee',
    label: 'Angestellte',
    category: CATEGORY_PRODUCTION,
    color: '#15aabf',
    scale: [0.8, 1.75, 0.8],
    geometry: {
      kind: 'cylinder',
      params: { radiusTop: 0.5, radiusBottom: 0.5, height: 1, radialSegments: 16 },
    },
    metadata: {
      name: 'Angestellte',
      description: 'Mitarbeiter/in.',
      customData: {
        Bereich: 'Montage',
        Schicht: 'Frueh',
        Anzahl: '1',
      },
    },
  },

  // ========== ZONEN ==========
  {
    type: 'zone-production',
    label: 'Zone: Produktion',
    category: CATEGORY_ZONES,
    color: '#4dabf7',
    scale: [8, 1, 8],
    geometry: { kind: 'plane', params: { width: 1, height: 1 } },
    metadata: {
      name: 'Produktionszone',
      description: 'Bereich fuer Produktionsaktivitaeten.',
      zoneType: 'production',
    },
    visual: { opacity: 0.35, transparent: true, doubleSided: true, hoverEffect: true },
  },
  {
    type: 'zone-storage',
    label: 'Zone: Lager',
    category: CATEGORY_ZONES,
    color: '#8ce99a',
    scale: [6, 1, 6],
    geometry: { kind: 'plane', params: { width: 1, height: 1 } },
    metadata: {
      name: 'Lagerzone',
      description: 'Bereich fuer Lagerung.',
      zoneType: 'storage',
    },
    visual: { opacity: 0.35, transparent: true, doubleSided: true, hoverEffect: true },
  },
  {
    type: 'zone-safety',
    label: 'Zone: Sicherheit',
    category: CATEGORY_ZONES,
    color: '#ffa94d',
    scale: [4, 1, 4],
    geometry: { kind: 'plane', params: { width: 1, height: 1 } },
    metadata: {
      name: 'Sicherheitszone',
      description: 'Gefahrenbereich / Sicherheitsbereich.',
      zoneType: 'safety',
    },
    visual: { opacity: 0.4, transparent: true, doubleSided: true, hoverEffect: true },
  },

  // ========== WEGE ==========
  {
    type: 'path-walkway',
    label: 'Gehweg',
    category: CATEGORY_PATHS,
    color: '#e9ecef',
    scale: [6, 1, 1.2],
    geometry: { kind: 'plane', params: { width: 1, height: 1 } },
    metadata: {
      name: 'Gehweg',
      description: 'Markierter Fussweg.',
      zoneType: 'walkway',
    },
    visual: { opacity: 0.85, transparent: true, doubleSided: true },
  },
  {
    type: 'path-vehicle',
    label: 'Fahrweg',
    category: CATEGORY_PATHS,
    color: '#ffd43b',
    scale: [8, 1, 2],
    geometry: { kind: 'plane', params: { width: 1, height: 1 } },
    metadata: {
      name: 'Fahrweg',
      description: 'Markierter Weg fuer Fahrzeuge.',
      zoneType: 'vehicle-path',
    },
    visual: { opacity: 0.8, transparent: true, doubleSided: true },
  },

  // ========== LABELS ==========
  {
    type: 'label-text',
    label: 'Text-Label',
    category: CATEGORY_LABELS,
    color: '#f8f9fa',
    scale: [1, 1, 1],
    geometry: {
      kind: 'text',
      params: { fontSize: 0.6 },
    },
    metadata: {
      name: 'Text-Label',
      description: 'Frei editierbares Text-Label.',
      text: 'Label',
    },
  },
]

let assetCounter = 0

function generateId(type: string) {
  assetCounter += 1
  const maybeRandom =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${assetCounter.toString(36)}`
  return `${type}-${maybeRandom}`
}

export function createAssetFromTemplate(template: AssetTemplate, overrides?: Partial<Asset>): Asset {
  const asset: Asset = {
    id: generateId(template.type),
    type: template.type,
    category: template.category,
    position: [0, template.scale[1] / 2, 0],
    rotation: [0, 0, 0],
    scale: [...template.scale] as Asset['scale'],
    color: template.color ?? FALLBACK_COLOR,
    geometry: {
      kind: template.geometry.kind,
      params: { ...template.geometry.params },
    },
    metadata: {
      ...(template.metadata ?? {}),
      customData: { ...(template.metadata?.customData ?? {}) },
    },
    visual: template.visual ? { ...template.visual } : undefined,
  }

  if (overrides) {
    return cloneAsset({ ...asset, ...overrides })
  }
  return asset
}

export function createCustomModelTemplate(
  name: string,
  modelUrl: string,
  scale: Asset['scale'] = [2, 2, 2],
): AssetTemplate {
  return {
    type: `custom-${generateId('model')}`,
    label: name,
    category: CATEGORY_CUSTOM,
    color: '#a5b4c4',
    scale,
    geometry: {
      kind: 'custom',
      params: { modelUrl },
    },
    metadata: {
      name,
      description: 'Benutzerdefiniertes GLB/GLTF Modell.',
      customData: {
        Typ: 'Custom Upload',
      },
    },
  }
}

export function getTemplatesByCategory(templates: AssetTemplate[]): Record<string, AssetTemplate[]> {
  const grouped: Record<string, AssetTemplate[]> = {}
  const categoryOrder = [
    CATEGORY_PRIMITIVE_3D,
    CATEGORY_PRIMITIVE_2D,
    CATEGORY_PRODUCTION,
    CATEGORY_LOGISTICS,
    CATEGORY_ZONES,
    CATEGORY_PATHS,
    CATEGORY_LABELS,
    CATEGORY_CUSTOM,
  ]
  for (const category of categoryOrder) {
    grouped[category] = []
  }
  for (const template of templates) {
    const list = grouped[template.category] ?? []
    list.push(template)
    grouped[template.category] = list
  }
  return Object.fromEntries(Object.entries(grouped).filter(([, list]) => list.length > 0))
}

export function geometryKindSupports2D(kind: GeometryKind): boolean {
  return kind === 'plane' || kind === 'circle' || kind === 'ring'
}

export function createDefaultDemoLayout(): Asset[] {
  const productionLine = ASSET_TEMPLATES.find((t) => t.type === 'production-line')!
  const shelf = ASSET_TEMPLATES.find((t) => t.type === 'shelf-block')!
  const zoneProduction = ASSET_TEMPLATES.find((t) => t.type === 'zone-production')!
  const pathWalkway = ASSET_TEMPLATES.find((t) => t.type === 'path-walkway')!

  const assets: Asset[] = [
    createAssetFromTemplate(zoneProduction, {
      position: [0, 0.02, 0],
      scale: [12, 1, 10],
    }),
    createAssetFromTemplate(pathWalkway, {
      position: [0, 0.04, -7],
      scale: [14, 1, 1.2],
    }),
    createAssetFromTemplate(productionLine, {
      position: [0, 0.6, 0],
    }),
    createAssetFromTemplate(productionLine, {
      position: [0, 0.6, 4],
      metadata: {
        name: 'Produktionslinie 2',
        description: 'Hauptproduktionslinie fuer Montage.',
        customData: {
          Bereich: 'FA2-Montage',
          Kapazitaet: '55 Teile/h',
          Verantwortlich: 'Team Beta',
        },
      },
    }),
    createAssetFromTemplate(shelf, {
      position: [-6, 1.2, -6],
      rotation: [0, Math.PI / 4, 0],
    }),
  ]
  return assets
}
