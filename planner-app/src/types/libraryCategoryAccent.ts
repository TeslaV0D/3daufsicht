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
} from '../AssetFactory'

/** Akzentfarbe für Bibliotheks-Sektion / Kategorie (Listen-Border, selektierter Outline). */
export const LIBRARY_CATEGORY_ACCENTS: Record<string, string> = {
  [CATEGORY_PRIMITIVE_3D]: '#4dabf7',
  [CATEGORY_PRIMITIVE_2D]: '#51cf66',
  [CATEGORY_PRODUCTION]: '#ff922b',
  [CATEGORY_LOGISTICS]: '#ff6b6b',
  [CATEGORY_ZONES]: '#ffd43b',
  [CATEGORY_WALLS]: '#adb5bd',
  [CATEGORY_PATHS]: '#a0785a',
  [CATEGORY_LABELS]: '#9775fa',
  /** Kategorie „Eigene Assets“ / User-Gruppe gleiche Bezeichnung */
  [CATEGORY_CUSTOM]: '#22b8cf',
  '★ Favoriten': '#fcc419',
  '⏱ Zuletzt verwendet': '#868e96',
}

export function libraryAccentForSectionTitle(title: string): string {
  return LIBRARY_CATEGORY_ACCENTS[title] ?? '#74c0fc'
}
