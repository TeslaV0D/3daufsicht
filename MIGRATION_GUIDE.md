# Migration Guide – Backward Compatibility

## Upgrading from older layouts (v1.0 / numeric `version` kleiner als 8)

When you load an older configuration (including legacy JSON arrays of assets only), the app runs **`finalizeImportedPayload`**: missing fields are filled with safe defaults, and the stored **`version`** is set to the current schema (**8**). The field **`layoutFormatSemver`** is set to **`1.2.0`** on export/save.

**No manual steps required** for typical upgrades:

- All assets and transforms remain available.
- Custom templates and library organization are preserved where present.
- Lighting, floor, and camera view preset (`perspective` / `top` / …) stay intact.
- **New in schema 8:** `perspectiveCamera` (orbit distance, height, FOV, angles) and `performanceSettings` (HUD, max DPR, LOD flag). If absent, defaults are applied automatically.

## What changed in 1.2.0 (layout format)

- **Perspective tuning** persisted per project (Inspector → „Perspektive“ when view is Perspektive).
- **Performance** options (FPS overlay, pixel ratio cap) in the Inspector.
- **Semantic version** string `layoutFormatSemver: "1.2.0"` alongside numeric `version: 8`.

## Troubleshooting

1. Open the browser **developer console** for parse/migration errors.
2. Try **Export** before risky operations, then **Import** after updating.
3. If local storage is corrupted, clear site data only after exporting if possible.

## Version reference

| Numeric `version` | Notes |
|-------------------|--------|
| 1–7 | Older layouts; upgraded on load to 8 with defaults for new fields. |
| 8   | Current: includes `perspectiveCamera`, `performanceSettings`, `layoutFormatSemver`. |

**Current layout format:** `1.2.0` (`LAYOUT_FORMAT_SEMVER` in code).
