import type { AssetTemplate } from './asset'
import {
  CATEGORY_CUSTOM,
  CATEGORY_LABELS,
  CATEGORY_LOGISTICS,
  CATEGORY_PATHS,
  CATEGORY_PRIMITIVE_2D,
  CATEGORY_PRIMITIVE_3D,
  CATEGORY_PRODUCTION,
  CATEGORY_WALLS,
  CATEGORY_ZONES,
  getTemplatesByCategory,
} from '../AssetFactory'

/** Reihenfolge der eingebauten Kategorien in der Bibliothek (ohne User-Gruppen). */
export const BUILTIN_LIBRARY_SECTION_ORDER = [
  CATEGORY_PRIMITIVE_3D,
  CATEGORY_PRIMITIVE_2D,
  CATEGORY_PRODUCTION,
  CATEGORY_LOGISTICS,
  CATEGORY_ZONES,
  CATEGORY_WALLS,
  CATEGORY_PATHS,
  CATEGORY_LABELS,
  CATEGORY_CUSTOM,
] as const

export const FAVORITES_SECTION_ID = '__favorites__'

export const RECENTS_SECTION_ID = '__recents__'

/** Max. Einträge in „Zuletzt verwendet“ (eindeutige Template-Typen). */
export const RECENT_TEMPLATES_MAX = 5

/** Feste Bibliotheks-Gruppe für per „+ Importieren“ hinzugefügte Modelle (nicht löschbar). */
export const EIGENE_ASSETS_USER_GROUP_ID = 'ug-eigene-assets-import'
export const EIGENE_ASSETS_USER_GROUP_LABEL = 'Eigene Assets'

export interface UserTemplateGroup {
  id: string
  label: string
  /** Reserviert: z. B. Import-Gruppe — kein Löschen, kein doppeltes Anlegen per „Neue Gruppe“. */
  isSpecial?: boolean
}

/** Display overrides for built-in templates (custom uploads are edited on the template object). */
export interface TemplateDisplayOverride {
  label?: string
  description?: string
  tags?: string[]
}

export interface LibraryOrganizationState {
  userGroups: UserTemplateGroup[]
  /** If set, template appears under this user group instead of its built-in category. */
  templateTypeToUserGroup: Record<string, string>
  favoriteTemplateTypes: string[]
  /** Zuletzt platzierte Vorlagen (max. 5, neueste zuerst, eindeutige `type`). */
  recentTemplateTypes?: string[]
  templateDisplayOverrides?: Record<string, TemplateDisplayOverride>
}

export const DEFAULT_LIBRARY_ORGANIZATION: LibraryOrganizationState = {
  userGroups: [],
  templateTypeToUserGroup: {},
  favoriteTemplateTypes: [],
  recentTemplateTypes: [],
  templateDisplayOverrides: {},
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function sanitizeTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out: string[] = []
  for (const item of value) {
    if (typeof item === 'string' && item.trim().length > 0) out.push(item.trim())
  }
  return out.length > 0 ? out : undefined
}

export function sanitizeLibraryOrganization(value: unknown): LibraryOrganizationState {
  const base: LibraryOrganizationState = {
    userGroups: [],
    templateTypeToUserGroup: {},
    favoriteTemplateTypes: [],
    recentTemplateTypes: [],
    templateDisplayOverrides: {},
  }
  if (!isRecord(value)) return base

  if (Array.isArray(value.userGroups)) {
    for (const g of value.userGroups) {
      if (!isRecord(g)) continue
      const id = typeof g.id === 'string' && g.id.length > 0 ? g.id : ''
      const label = typeof g.label === 'string' && g.label.trim().length > 0 ? g.label.trim() : ''
      if (!id || !label) continue
      if (id === EIGENE_ASSETS_USER_GROUP_ID) {
        base.userGroups.push({
          id: EIGENE_ASSETS_USER_GROUP_ID,
          label: EIGENE_ASSETS_USER_GROUP_LABEL,
          isSpecial: true,
        })
        continue
      }
      const isSpecial = g.isSpecial === true
      base.userGroups.push(isSpecial ? { id, label, isSpecial: true } : { id, label })
    }
  }

  if (isRecord(value.templateTypeToUserGroup)) {
    for (const [type, gid] of Object.entries(value.templateTypeToUserGroup)) {
      if (typeof type === 'string' && type.length > 0 && typeof gid === 'string' && gid.length > 0) {
        if (gid === EIGENE_ASSETS_USER_GROUP_ID) {
          if (!base.userGroups.some((g) => g.id === EIGENE_ASSETS_USER_GROUP_ID)) {
            base.userGroups.push({
              id: EIGENE_ASSETS_USER_GROUP_ID,
              label: EIGENE_ASSETS_USER_GROUP_LABEL,
              isSpecial: true,
            })
          }
          base.templateTypeToUserGroup[type] = gid
          continue
        }
        if (base.userGroups.some((g) => g.id === gid)) {
          base.templateTypeToUserGroup[type] = gid
        }
      }
    }
  }

  if (Array.isArray(value.favoriteTemplateTypes)) {
    const favSet = new Set<string>()
    for (const t of value.favoriteTemplateTypes) {
      if (typeof t === 'string' && t.length > 0) favSet.add(t)
    }
    base.favoriteTemplateTypes = [...favSet]
  }

  if (Array.isArray(value.recentTemplateTypes)) {
    const seen = new Set<string>()
    const r: string[] = []
    for (const t of value.recentTemplateTypes) {
      if (typeof t === 'string' && t.length > 0 && !seen.has(t)) {
        seen.add(t)
        r.push(t)
        if (r.length >= RECENT_TEMPLATES_MAX) break
      }
    }
    base.recentTemplateTypes = r
  }

  if (isRecord(value.templateDisplayOverrides)) {
    const o: Record<string, TemplateDisplayOverride> = {}
    for (const [type, raw] of Object.entries(value.templateDisplayOverrides)) {
      if (typeof type !== 'string' || type.length === 0 || !isRecord(raw)) continue
      const entry: TemplateDisplayOverride = {}
      if (typeof raw.label === 'string' && raw.label.trim()) entry.label = raw.label.trim()
      if (typeof raw.description === 'string') entry.description = raw.description
      const tags = sanitizeTags(raw.tags)
      if (tags) entry.tags = tags
      if (Object.keys(entry).length > 0) o[type] = entry
    }
    base.templateDisplayOverrides = o
  }

  return base
}

export function ensureEigeneAssetsUserGroup(org: LibraryOrganizationState): LibraryOrganizationState {
  const next = cloneLibraryOrganization(org)
  if (next.userGroups.some((g) => g.id === EIGENE_ASSETS_USER_GROUP_ID)) return next
  next.userGroups = [
    ...next.userGroups,
    {
      id: EIGENE_ASSETS_USER_GROUP_ID,
      label: EIGENE_ASSETS_USER_GROUP_LABEL,
      isSpecial: true,
    },
  ]
  return next
}

export function pushRecentTemplateType(
  org: LibraryOrganizationState,
  templateType: string,
): LibraryOrganizationState {
  if (!templateType) return org
  const next = cloneLibraryOrganization(org)
  const cur = [...(next.recentTemplateTypes ?? [])]
  const filtered = cur.filter((t) => t !== templateType)
  next.recentTemplateTypes = [templateType, ...filtered].slice(0, RECENT_TEMPLATES_MAX)
  return next
}

export function removeTypeFromRecents(
  org: LibraryOrganizationState,
  templateType: string,
): LibraryOrganizationState {
  const next = cloneLibraryOrganization(org)
  const cur = next.recentTemplateTypes ?? []
  next.recentTemplateTypes = cur.filter((t) => t !== templateType)
  return next
}

export function pruneRecentsToExistingTypes(
  org: LibraryOrganizationState,
  validTypes: Set<string>,
): LibraryOrganizationState {
  const cur = org.recentTemplateTypes ?? []
  const nextList = cur.filter((t) => validTypes.has(t))
  if (nextList.length === cur.length) return org
  const next = cloneLibraryOrganization(org)
  next.recentTemplateTypes = nextList
  return next
}

export function migrateUserAssetTemplateAssignments(
  templates: AssetTemplate[],
  org: LibraryOrganizationState,
): LibraryOrganizationState {
  const next = ensureEigeneAssetsUserGroup(org)
  const map = { ...next.templateTypeToUserGroup }
  let changed = false
  for (const t of templates) {
    if (t.isUserAsset && !map[t.type]) {
      map[t.type] = EIGENE_ASSETS_USER_GROUP_ID
      changed = true
    }
  }
  if (!changed) return next
  return { ...next, templateTypeToUserGroup: map }
}

export function mergeLibraryOrgWithUserTemplates(
  org: LibraryOrganizationState | undefined,
  customTemplates: AssetTemplate[],
): LibraryOrganizationState {
  const base = cloneLibraryOrganization(sanitizeLibraryOrganization(org))
  return migrateUserAssetTemplateAssignments(customTemplates, base)
}

export function cloneLibraryOrganization(s: LibraryOrganizationState): LibraryOrganizationState {
  const ov = s.templateDisplayOverrides
  return {
    userGroups: s.userGroups.map((g) => ({
      id: g.id,
      label: g.label,
      ...(g.isSpecial ? { isSpecial: true as const } : {}),
    })),
    templateTypeToUserGroup: { ...s.templateTypeToUserGroup },
    favoriteTemplateTypes: [...s.favoriteTemplateTypes],
    recentTemplateTypes: s.recentTemplateTypes ? [...s.recentTemplateTypes] : [],
    templateDisplayOverrides: ov
      ? Object.fromEntries(
          Object.entries(ov).map(([k, v]) => [
            k,
            {
              label: v.label,
              description: v.description,
              tags: v.tags ? [...v.tags] : undefined,
            },
          ]),
        )
      : {},
  }
}

export function applyTemplateDisplayOverrides(
  template: AssetTemplate,
  org: LibraryOrganizationState,
): AssetTemplate {
  const o = org.templateDisplayOverrides?.[template.type]
  if (!o) return template
  const tags = o.tags?.filter((t) => t.length > 0)
  return {
    ...template,
    label: o.label?.trim() ? o.label.trim() : template.label,
    metadata: {
      ...template.metadata,
      name: o.label?.trim() ? o.label.trim() : template.metadata?.name,
      description:
        o.description !== undefined ? o.description : template.metadata?.description,
      customData: {
        ...(template.metadata?.customData ?? {}),
        ...(tags?.length ? { Tags: tags.join(', ') } : {}),
      },
    },
  }
}

export interface LibrarySection {
  sectionKey: string
  title: string
  templates: AssetTemplate[]
  kind: 'favorites' | 'recents' | 'user' | 'builtin'
  userGroupId?: string
  deletable?: boolean
}

export function buildLibrarySections(
  templates: AssetTemplate[],
  org: LibraryOrganizationState,
): LibrarySection[] {
  const byType = new Map(templates.map((t) => [t.type, t]))
  const assignedToUser = new Set(Object.keys(org.templateTypeToUserGroup))

  const sections: LibrarySection[] = []

  const favoriteTemplates = org.favoriteTemplateTypes
    .map((type) => byType.get(type))
    .filter((t): t is AssetTemplate => !!t)
  sections.push({
    sectionKey: FAVORITES_SECTION_ID,
    title: '★ Favoriten',
    templates: favoriteTemplates,
    kind: 'favorites',
  })

  const recentTemplates = (org.recentTemplateTypes ?? [])
    .map((type) => byType.get(type))
    .filter((t): t is AssetTemplate => !!t)
  sections.push({
    sectionKey: RECENTS_SECTION_ID,
    title: '⏱ Zuletzt verwendet',
    templates: recentTemplates,
    kind: 'recents',
  })

  const others = org.userGroups
    .filter((g) => g.id !== EIGENE_ASSETS_USER_GROUP_ID)
    .sort((a, b) => a.label.localeCompare(b.label, 'de'))
  const eigene = org.userGroups.filter((g) => g.id === EIGENE_ASSETS_USER_GROUP_ID)
  const sortedUserGroups = [...others, ...eigene]

  for (const g of sortedUserGroups) {
    const list = templates.filter((t) => org.templateTypeToUserGroup[t.type] === g.id)
    sections.push({
      sectionKey: `user:${g.id}`,
      title: g.label,
      templates: list,
      kind: 'user',
      userGroupId: g.id,
      deletable: !g.isSpecial,
    })
  }

  const builtinGrouped = getTemplatesByCategory(templates)
  for (const category of BUILTIN_LIBRARY_SECTION_ORDER) {
    const list = builtinGrouped[category]
    if (!list?.length) continue
    const visible = list.filter((t) => !assignedToUser.has(t.type))
    if (visible.length === 0) continue
    sections.push({
      sectionKey: `builtin:${category}`,
      title: category,
      templates: visible,
      kind: 'builtin',
    })
  }

  return sections
}
