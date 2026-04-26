export type CameraViewPreset = 'perspective' | 'top' | 'front' | 'side'

export type PlannerShellMode = 'edit' | 'view'

export type PerspectiveSubPreset =
  | 'standard'
  | 'elevated'
  | 'birdsEye'
  | 'isometric'
  | 'custom'

/** Einstellungen nur für `cameraView === 'perspective'` (Orbit um Ursprung). */
export interface PerspectiveCameraSettings {
  subPreset: PerspectiveSubPreset
  /** Entfernung der Kamera zum Zielpunkt (m) */
  distance: number
  /** Zusätzliche Höhe (Y) in m (additiv zur Kugelposition) */
  height: number
  fov: number
  /** Elevationswinkel in Grad (0 = Horizont, 90 = von oben) */
  elevationDeg: number
  /** Azimut in Grad (Rotation um Y) */
  azimuthDeg: number
  /** Orbit-Ziel */
  target: readonly [number, number, number]
}

export const DEFAULT_PERSPECTIVE_CAMERA: PerspectiveCameraSettings = {
  subPreset: 'standard',
  distance: 36,
  height: 0,
  fov: 48,
  elevationDeg: 30,
  azimuthDeg: 45,
  target: [0, 0, 0],
}

const PRESET_TUNINGS: Record<
  Exclude<PerspectiveSubPreset, 'custom'>,
  Partial<PerspectiveCameraSettings>
> = {
  standard: {
    distance: 36,
    height: 0,
    fov: 48,
    elevationDeg: 30,
    azimuthDeg: 45,
  },
  elevated: {
    distance: 42,
    height: 4,
    fov: 50,
    elevationDeg: 42,
    azimuthDeg: 40,
  },
  birdsEye: {
    distance: 28,
    height: 2,
    fov: 42,
    elevationDeg: 78,
    azimuthDeg: 35,
  },
  isometric: {
    distance: 38,
    height: 0,
    fov: 38,
    elevationDeg: 35,
    azimuthDeg: 45,
  },
}

export function perspectivePresetDefaults(
  id: Exclude<PerspectiveSubPreset, 'custom'>,
): PerspectiveCameraSettings {
  const t = PRESET_TUNINGS[id]
  return {
    ...DEFAULT_PERSPECTIVE_CAMERA,
    ...t,
    subPreset: id,
    target: [...DEFAULT_PERSPECTIVE_CAMERA.target] as PerspectiveCameraSettings['target'],
  }
}

export function sanitizePerspectiveCamera(value: unknown): PerspectiveCameraSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_PERSPECTIVE_CAMERA }
  const v = value as Record<string, unknown>
  const subRaw = v.subPreset
  const subPreset: PerspectiveSubPreset =
    subRaw === 'elevated' ||
    subRaw === 'birdsEye' ||
    subRaw === 'isometric' ||
    subRaw === 'custom'
      ? subRaw
      : 'standard'
  const targetRaw = v.target
  let target: PerspectiveCameraSettings['target'] = [...DEFAULT_PERSPECTIVE_CAMERA.target]
  if (Array.isArray(targetRaw) && targetRaw.length >= 3) {
    const x = Number(targetRaw[0])
    const y = Number(targetRaw[1])
    const z = Number(targetRaw[2])
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      target = [x, y, z]
    }
  }
  const num = (x: unknown, fallback: number) => {
    const n = Number(x)
    return Number.isFinite(n) ? n : fallback
  }
  return {
    subPreset,
    distance: Math.max(4, num(v.distance, DEFAULT_PERSPECTIVE_CAMERA.distance)),
    height: num(v.height, DEFAULT_PERSPECTIVE_CAMERA.height),
    fov: Math.min(85, Math.max(20, num(v.fov, DEFAULT_PERSPECTIVE_CAMERA.fov))),
    elevationDeg: Math.min(89, Math.max(0, num(v.elevationDeg, DEFAULT_PERSPECTIVE_CAMERA.elevationDeg))),
    azimuthDeg: Math.min(360, Math.max(0, num(v.azimuthDeg, DEFAULT_PERSPECTIVE_CAMERA.azimuthDeg))),
    target,
  }
}

/** Kamera-Position aus Kugelkoordinaten + Höhen-Offset. */
export function perspectiveToPosition(s: PerspectiveCameraSettings): [number, number, number] {
  const elev = (s.elevationDeg * Math.PI) / 180
  const az = (s.azimuthDeg * Math.PI) / 180
  const r = s.distance
  const y0 = r * Math.sin(elev)
  const h = r * Math.cos(elev)
  const x = h * Math.sin(az)
  const z = h * Math.cos(az)
  return [x + s.target[0], y0 + s.height + s.target[1], z + s.target[2]]
}

/** Achsparallele Draufsicht (Y-up): Kamera über dem Zielpunkt auf der XZ-Ebene. */
export interface TopViewCameraSettings {
  /** Kamera-Höhe Y (m) */
  height: number
  /** Sichtfeld (°) — kleinerer Wert = stärkerer „Zoom“ */
  fov: number
  offsetX: number
  offsetZ: number
}

export const DEFAULT_TOP_VIEW_CAMERA: TopViewCameraSettings = {
  height: 42,
  fov: 48,
  offsetX: 0,
  offsetZ: 0,
}

/** Frontalansicht (+Z zur Szene). */
export interface FrontViewCameraSettings {
  fov: number
  /** Abstand der Kamera entlang +Z (m) */
  distance: number
  heightOffset: number
  sideOffset: number
}

export const DEFAULT_FRONT_VIEW_CAMERA: FrontViewCameraSettings = {
  fov: 48,
  distance: 36,
  heightOffset: 0,
  sideOffset: 0,
}

/** Seitenansicht (+X zur Szene). */
export interface SideViewCameraSettings {
  fov: number
  /** Abstand der Kamera entlang +X (m) */
  distance: number
  heightOffset: number
  depthOffset: number
}

export const DEFAULT_SIDE_VIEW_CAMERA: SideViewCameraSettings = {
  fov: 48,
  distance: 36,
  heightOffset: 0,
  depthOffset: 0,
}

export interface AxisViewCamerasState {
  top: TopViewCameraSettings
  front: FrontViewCameraSettings
  side: SideViewCameraSettings
}

export const DEFAULT_AXIS_VIEW_CAMERAS: AxisViewCamerasState = {
  top: { ...DEFAULT_TOP_VIEW_CAMERA },
  front: { ...DEFAULT_FRONT_VIEW_CAMERA },
  side: { ...DEFAULT_SIDE_VIEW_CAMERA },
}

export type AxisViewRig = {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
  fov: number
}

export function topViewToRig(s: TopViewCameraSettings): AxisViewRig {
  const ox = s.offsetX
  const oz = s.offsetZ
  return {
    position: [ox, s.height, oz + 0.01],
    target: [ox, 0, oz],
    fov: s.fov,
  }
}

export function frontViewToRig(s: FrontViewCameraSettings): AxisViewRig {
  const ty = 2 + s.heightOffset
  const ey = 12 + s.heightOffset
  const sx = s.sideOffset
  return {
    position: [sx, ey, s.distance],
    target: [sx, ty, 0],
    fov: s.fov,
  }
}

export function sideViewToRig(s: SideViewCameraSettings): AxisViewRig {
  const ty = 2 + s.heightOffset
  const ey = 12 + s.heightOffset
  const dz = s.depthOffset
  return {
    position: [s.distance, ey, dz],
    target: [0, ty, dz],
    fov: s.fov,
  }
}

function numAxis(x: unknown, fallback: number) {
  const n = Number(x)
  return Number.isFinite(n) ? n : fallback
}

export function sanitizeTopViewCamera(value: unknown): TopViewCameraSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_TOP_VIEW_CAMERA }
  const v = value as Record<string, unknown>
  return {
    height: Math.min(160, Math.max(4, numAxis(v.height, DEFAULT_TOP_VIEW_CAMERA.height))),
    fov: Math.min(85, Math.max(20, numAxis(v.fov, DEFAULT_TOP_VIEW_CAMERA.fov))),
    offsetX: Math.min(200, Math.max(-200, numAxis(v.offsetX, DEFAULT_TOP_VIEW_CAMERA.offsetX))),
    offsetZ: Math.min(200, Math.max(-200, numAxis(v.offsetZ, DEFAULT_TOP_VIEW_CAMERA.offsetZ))),
  }
}

export function sanitizeFrontViewCamera(value: unknown): FrontViewCameraSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_FRONT_VIEW_CAMERA }
  const v = value as Record<string, unknown>
  return {
    fov: Math.min(85, Math.max(20, numAxis(v.fov, DEFAULT_FRONT_VIEW_CAMERA.fov))),
    distance: Math.min(120, Math.max(6, numAxis(v.distance, DEFAULT_FRONT_VIEW_CAMERA.distance))),
    heightOffset: Math.min(40, Math.max(-40, numAxis(v.heightOffset, DEFAULT_FRONT_VIEW_CAMERA.heightOffset))),
    sideOffset: Math.min(120, Math.max(-120, numAxis(v.sideOffset, DEFAULT_FRONT_VIEW_CAMERA.sideOffset))),
  }
}

export function sanitizeSideViewCamera(value: unknown): SideViewCameraSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SIDE_VIEW_CAMERA }
  const v = value as Record<string, unknown>
  return {
    fov: Math.min(85, Math.max(20, numAxis(v.fov, DEFAULT_SIDE_VIEW_CAMERA.fov))),
    distance: Math.min(120, Math.max(6, numAxis(v.distance, DEFAULT_SIDE_VIEW_CAMERA.distance))),
    heightOffset: Math.min(40, Math.max(-40, numAxis(v.heightOffset, DEFAULT_SIDE_VIEW_CAMERA.heightOffset))),
    depthOffset: Math.min(120, Math.max(-120, numAxis(v.depthOffset, DEFAULT_SIDE_VIEW_CAMERA.depthOffset))),
  }
}

export function sanitizeAxisViewCameras(value: unknown): AxisViewCamerasState {
  if (!value || typeof value !== 'object') {
    return {
      top: { ...DEFAULT_TOP_VIEW_CAMERA },
      front: { ...DEFAULT_FRONT_VIEW_CAMERA },
      side: { ...DEFAULT_SIDE_VIEW_CAMERA },
    }
  }
  const v = value as Record<string, unknown>
  return {
    top: sanitizeTopViewCamera(v.top),
    front: sanitizeFrontViewCamera(v.front),
    side: sanitizeSideViewCamera(v.side),
  }
}

export function cloneAxisViewCameras(s: AxisViewCamerasState): AxisViewCamerasState {
  return {
    top: { ...s.top },
    front: { ...s.front },
    side: { ...s.side },
  }
}

export interface PerformanceSettings {
  /** FPS / Draw-Call Overlay in der Szene */
  showHud: boolean
  /** Obergrenze für devicePixelRatio (große Projekte) */
  maxDpr: number
  /** Nur Metadaten für künftige Optimierungen (LOD-Stufen) */
  lodHintEnabled: boolean
  /** Mehrere gleiche Box-Assets in einem InstancedMesh (nur opake, ohne Decals) */
  useInstancing: boolean
  /** Objekte ab Kamera-Distanz ausblenden (nur Rendering) */
  distanceCullEnabled: boolean
  distanceCullMeters: number
  /** Asset-Bibliothek: react-window ab Schwellwert */
  virtualLibraryScroll: boolean
  virtualLibraryThreshold: number
  libraryRowHeight: number
  /** Nur Metadaten: künftig Schatten-LOD */
  shadowOptimize: boolean
}

export const DEFAULT_PERFORMANCE: PerformanceSettings = {
  showHud: false,
  maxDpr: 2,
  lodHintEnabled: false,
  useInstancing: false,
  distanceCullEnabled: false,
  distanceCullMeters: 280,
  virtualLibraryScroll: true,
  virtualLibraryThreshold: 14,
  libraryRowHeight: 52,
  shadowOptimize: false,
}

export function sanitizePerformanceSettings(value: unknown): PerformanceSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_PERFORMANCE }
  const o = value as Record<string, unknown>
  const maxDpr = Number(o.maxDpr)
  const dist = Number(o.distanceCullMeters)
  const thresh = Number(o.virtualLibraryThreshold)
  const rowH = Number(o.libraryRowHeight)
  return {
    showHud: o.showHud === true,
    maxDpr: Math.min(3, Math.max(1, Number.isFinite(maxDpr) ? maxDpr : DEFAULT_PERFORMANCE.maxDpr)),
    lodHintEnabled: o.lodHintEnabled === true,
    useInstancing: o.useInstancing === true,
    distanceCullEnabled: o.distanceCullEnabled === true,
    distanceCullMeters: Math.min(2000, Math.max(50, Number.isFinite(dist) ? dist : DEFAULT_PERFORMANCE.distanceCullMeters)),
    virtualLibraryScroll: o.virtualLibraryScroll !== false,
    virtualLibraryThreshold: Math.min(200, Math.max(4, Number.isFinite(thresh) ? thresh : DEFAULT_PERFORMANCE.virtualLibraryThreshold)),
    libraryRowHeight: Math.min(80, Math.max(36, Number.isFinite(rowH) ? rowH : DEFAULT_PERFORMANCE.libraryRowHeight)),
    shadowOptimize: o.shadowOptimize === true,
  }
}

/** Alte Saves mit „cabinet“ werden auf Perspektive gemappt. */
export function normalizeCameraViewPreset(value: unknown): CameraViewPreset {
  if (value === 'perspective' || value === 'top' || value === 'front' || value === 'side') {
    return value
  }
  return 'perspective'
}
