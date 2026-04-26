import type { Asset, AssetMetadata, AssetTemplate, GeometryKind, ModelFormat } from './types/asset'
import {
  cloneAsset,
  DEFAULT_TEXT_LABEL_STYLE,
  FALLBACK_COLOR,
  isFiniteNumber,
  sanitizeMetadata,
} from './types/asset'

export const CATEGORY_PRIMITIVE_3D = 'Primitive 3D'
export const CATEGORY_PRIMITIVE_2D = 'Primitive 2D'
export const CATEGORY_LOGISTICS = 'Logistik'
export const CATEGORY_PRODUCTION = 'Produktion'
export const CATEGORY_ZONES = 'Zonen'
export const CATEGORY_WALLS = 'Wände'
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
      description: 'Standard Regal für Bauteile.',
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
      description: 'Mobiler Hubwagen für den Materialfluss.',
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
      description: 'Hauptproduktionslinie für Montage.',
      customData: {
        Bereich: 'FA1-Montage',
        Kapazität: '60 Teile/h',
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
      description: 'Einzel-Arbeitsplatz für Montageaufgaben.',
      customData: {
        Bereich: 'FA2-Montage',
        Schicht: 'Früh',
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
        Schicht: 'Früh',
        Anzahl: '1',
      },
    },
  },

  // ========== WÄNDE ==========
  {
    type: 'wall-segment',
    label: 'Wandsegment',
    category: CATEGORY_WALLS,
    color: '#c5ced8',
    scale: [80.7, 8, 0.35],
    geometry: { kind: 'box', params: { width: 1, height: 1, depth: 1 } },
    metadata: {
      name: 'Wand',
      description: 'Wandsegment wie andere Assets positionierbar.',
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
      description: 'Bereich für Produktionsaktivitäten.',
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
      description: 'Bereich für Lagerung.',
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
      description: 'Markierter Fußweg.',
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
      description: 'Markierter Weg für Fahrzeuge.',
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
      params: { fontSize: 0.6, labelStyle: { ...DEFAULT_TEXT_LABEL_STYLE } },
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
    groupId: template.category,
    position: [0, template.scale[1] / 2, 0],
    rotation: [0, 0, 0],
    scale: [...template.scale] as Asset['scale'],
    color: template.color ?? FALLBACK_COLOR,
    geometry: {
      kind: template.geometry.kind,
      params: { ...template.geometry.params },
    },
    metadata: sanitizeMetadata({
      ...(template.metadata ?? {}),
      customData: { ...(template.metadata?.customData ?? {}) },
    }),
    visual: template.visual ? { ...template.visual } : undefined,
  }

  let next: Asset = asset
  const fmt = asset.geometry.params.modelFormat ?? 'glb'
  if (asset.geometry.kind === 'custom' && (fmt === 'glb' || fmt === 'gltf')) {
    next = { ...asset, materialMode: 'original' as const }
  }
  if (template.materialMode) {
    next = { ...next, materialMode: template.materialMode }
  }
  if (template.opacity != null && isFiniteNumber(template.opacity)) {
    next = {
      ...next,
      opacity: Math.min(1, Math.max(0, template.opacity)),
    }
  }
  if (overrides) {
    return cloneAsset({ ...next, ...overrides })
  }
  return next
}

export interface SaveSceneAssetTemplateOptions {
  label: string
  description: string
  zoneType: string
  saveMaterial: boolean
  saveScale: boolean
  saveDecals: boolean
  saveMetadata: boolean
}

/** Neues Bibliotheks-Template aus einem platzierten Asset (Eigene Assets). */
export function createTemplateFromSceneAsset(
  asset: Asset,
  options: SaveSceneAssetTemplateOptions,
): AssetTemplate {
  const type = `custom-${generateId('saved')}`
  const label = options.label.trim() || 'Gespeichertes Asset'
  const geometry: Asset['geometry'] = {
    kind: asset.geometry.kind,
    params: { ...asset.geometry.params },
  }

  let metadata: AssetMetadata
  if (options.saveMetadata) {
    metadata = sanitizeMetadata({
      ...asset.metadata,
      name: options.label.trim() || asset.metadata.name,
      description:
        options.description.trim() ||
        asset.metadata.description ||
        '',
      zoneType:
        options.zoneType.trim() ||
        asset.metadata.zoneType ||
        undefined,
    })
  } else {
    metadata = sanitizeMetadata({
      name: label,
      description: options.description.trim(),
      zoneType: options.zoneType.trim() || undefined,
    })
  }

  let visual: Asset['visual'] | undefined
  if (options.saveDecals && asset.visual?.decals?.length) {
    visual = {
      ...(asset.visual ?? {}),
      decals: asset.visual.decals.map((d) => ({ ...d })),
    }
  } else if (options.saveMaterial && asset.visual) {
    const rest = { ...asset.visual }
    delete rest.decals
    visual = Object.keys(rest).length ? { ...rest } : undefined
  }

  const color = options.saveMaterial ? asset.color : FALLBACK_COLOR
  const scale: Asset['scale'] = options.saveScale
    ? ([asset.scale[0], asset.scale[1], asset.scale[2]] as Asset['scale'])
    : [1, 1, 1]

  const template: AssetTemplate = {
    type,
    label,
    category: CATEGORY_CUSTOM,
    color,
    scale,
    geometry,
    metadata,
    visual,
    isUserAsset: true,
    createdAt: Date.now(),
  }

  if (options.saveMaterial && asset.opacity != null && isFiniteNumber(asset.opacity)) {
    template.opacity = Math.min(1, Math.max(0, asset.opacity))
  }
  if (options.saveMaterial && asset.materialMode) {
    template.materialMode = asset.materialMode
  }

  return template
}

export function createCustomModelTemplate(
  name: string,
  modelUrl: string,
  options: {
    scale?: Asset['scale']
    modelFormat?: ModelFormat
    category?: string
    description?: string
    isUserAsset?: boolean
    createdAt?: number
  } = {},
): AssetTemplate {
  const modelFormat: ModelFormat = options.modelFormat ?? 'glb'
  const scale = options.scale ?? [2, 2, 2]
  const category = options.category ?? CATEGORY_CUSTOM
  const defaultDescription =
    modelFormat === 'stl'
      ? 'Benutzerdefiniertes STL Modell (CAD/Mesh).'
      : modelFormat === 'obj'
        ? 'Importiertes OBJ-Modell.'
        : modelFormat === 'fbx'
          ? 'Importiertes FBX-Modell.'
          : 'Benutzerdefiniertes GLB/GLTF Modell.'
  const description =
    options.description ??
    (options.isUserAsset ? 'Importiertes Asset' : defaultDescription)
  const createdAt = options.createdAt ?? (options.isUserAsset ? Date.now() : undefined)
  const customData: Record<string, string> = {
    Typ: options.isUserAsset ? 'Import' : 'Custom Upload',
    Format: modelFormat.toUpperCase(),
  }
  if (createdAt !== undefined) {
    customData['Importiert am'] = new Date(createdAt).toLocaleString('de-DE')
  }
  return {
    type: `custom-${generateId('model')}`,
    label: name,
    category,
    color: '#a5b4c4',
    scale,
    geometry: {
      kind: 'custom',
      params: { modelUrl, modelFormat },
    },
    metadata: {
      name,
      description,
      customData,
    },
    ...(options.isUserAsset ? { isUserAsset: true as const, createdAt } : {}),
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
    CATEGORY_WALLS,
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
  const wallSeg = ASSET_TEMPLATES.find((t) => t.type === 'wall-segment')!

  const assets: Asset[] = [
    createAssetFromTemplate(wallSeg, {
      position: [0, 4, -40.175],
      scale: [80.7, 8, 0.35],
    }),
    createAssetFromTemplate(wallSeg, {
      position: [-40.175, 4, 0],
      scale: [0.35, 8, 80.7],
    }),
    createAssetFromTemplate(wallSeg, {
      position: [40.175, 4, 0],
      scale: [0.35, 8, 80.7],
    }),
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
        description: 'Hauptproduktionslinie für Montage.',
        customData: {
          Bereich: 'FA2-Montage',
          Kapazität: '55 Teile/h',
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
