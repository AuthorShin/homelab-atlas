# Project format

**File → Save project** downloads a ZIP archive. It contains `project.json` (schema version 12), a small `manifest.json`, and every uploaded image the project references, under `uploads/`. **File → Import project** accepts that ZIP after strict validation. It also accepts legacy JSON exports from schema versions 1 through 11 as a migration path; embedded images in those files are uploaded to Atlas and replaced with upload references.

The current project stays open if any validation or upload step fails. Atlas never writes a project back to disk in JSON form: the editable backup is the ZIP.

## Archive layout

| Entry | Required | Meaning |
|---|---|---|
| `project.json` | Yes | The project, at most 2 MB, matching the schema below |
| `manifest.json` | No | `{ "format": "homelab-atlas-project", "formatVersion": 1, "schemaVersion": 12 }` |
| `uploads/<sha256>.<ext>` | For each upload reference | The exact image bytes served by `/api/uploads` |

`<ext>` is `png`, `jpg`, `webp`, `svg`, or `ico`. On import, Atlas uploads each included image to the destination server and rewrites the project to the returned `/api/uploads/...` reference. A referenced upload that is neither included in the ZIP nor already present on the server rejects the import. Files with unsafe names, duplicate names, encryption, unsupported compression, or a failed CRC are rejected.

## Migrating an older JSON backup

A legacy JSON export is still accepted by **File → Import project**. Atlas validates it in its original schema, applies the migrations below, uploads any embedded `data:` images, and validates the result as schema version 12. There is no JSON export in the File menu, and a ZIP is the only format that preserves uploaded images without embedding them in the project text.

## Top-level fields

| Field | Type | Meaning |
|---|---|---|
| `schemaVersion` | integer | Must be `12` |
| `revision` | integer | Browser conflict/change revision, from 0 through 1,000,000,000 |
| `title`, `subtitle` | string | Diagram heading text, at most 120 characters each |
| `theme` | string | `navy`, `light`, or `midnight` |
| `columns` | integer | Device layout columns, 1–4; also the maximum groups per side-by-side row |
| `density` | string | `comfortable` or `compact` |
| `favicon` | string | Empty, or a PNG upload reference; legacy PNG data URLs are still accepted |
| `branding` | object | App name, optional tab title, and optional app logo |
| `themes` | array | 1–24 themes; each has `id`, `label`, `css`, `background`, `backgroundScope` |
| `activeTheme` | string | ID of the theme currently applied |
| `dailyBackground` | boolean | Pick a gallery background by date instead of using the active theme's image |
| `networkRow`, `vlanRow` | string | `top` or `bottom` placement for each header row |
| `layout` | object | Device-card layout mode and saved rectangles |
| `customLogos` | array | Reusable uploaded logos |
| `networks` | array | Network node records |
| `vlans` | array | VLAN chip records |
| `devices` | array | Device cards, hardware facts, groups, and services |
| `connections` | array | Directed logical relationships between network/device endpoints |

`branding` has exactly `name`, `tabTitle`, and `favicon`. The name is trimmed, nonempty text up to 60 characters. The tab title is trimmed text up to 80 characters and may be empty. The logo is empty, an image upload reference, or a legacy image data URL. Branding is project data; it is not a server-wide setting.

Schema version 11 has no `discovery` field. A current file containing one is rejected as an unknown key.

Each theme's `backgroundScope` is `stage`, `diagram`, or `both`. `stage` shows the image on the canvas around the diagram, `diagram` draws it behind the diagram content and into SVG/PNG exports, and `both` does both. When `dailyBackground` is on, the date selects one theme background for everyone; the active theme still supplies the CSS and scope. CSS is limited to 20,000 characters per theme and 120,000 in total. Older projects migrate their single CSS/background pair into one starting theme.

## Record fields

| Record | Exact fields |
|---|---|
| Network | `id`, `name`, `kind`, `accent`, `icon`, `secondaryIcon` |
| VLAN | `id`, `name`, `color` |
| Device | `id`, `name`, `role`, `icon`, `accent`, `network`, `hardware`, `groups` |
| Group | `id`, `name`, `logo`, `sideBySide`, `services` |
| Service | `id`, `logo`, `name`, `count`, `link`, `iconSize`, `showName` |
| Connection | `id`, `from`, `to`, `label` |
| Layout | `mode`, `cards` |
| Layout card | `id`, `x`, `y`, `w`, `h` |
| Custom logo | `id`, `label`, `dataUrl`, `background` |

`sideBySide` is a boolean. Groups marked this way share one row, up to the project's `columns` setting. The group `logo` is empty or an image reference. A custom logo `dataUrl` is a PNG or SVG upload reference, or a safe legacy image data URL.

Colors use six-digit hexadecimal values such as `#55d6c9`. A device `icon`, service `logo`, or nonempty network logo field must exist in the bundled catalog or `customLogos`. An empty network `icon` selects the automatic kind-based mark; an empty `secondaryIcon` means no secondary mark. A service `count` must be an integer from 1 through 99. `iconSize` is an integer from 16 through 64 diagram units and applies to both grid tiles and service rows; the renderer clamps very large values to the available tile height. `showName` is a boolean; when false the label becomes a native SVG tooltip with the full name. Side-by-side groups always hide service names.

## Images and upload references

An image reference is either an empty string, a server upload path, or a legacy base64 image data URL. Upload paths look like `/api/uploads/<sha256>.<ext>` and are content-addressed under `<ATLAS_DATA_DIR>/uploads`. Images uploaded through the editor are always stored this way; new uploads are never embedded in `project.json`. The PNG-only `favicon` field remains narrower than general image fields. Background images can be up to 10 MB; other image uploads are limited to 2 MB.

Legacy data URLs are accepted so older projects still open. They are converted to upload references when a legacy JSON project is imported, or when a ZIP's `project.json` still contains them.

## Service links

Every service has a `link` field. Use an empty string when the service has no link. Otherwise it must be a complete `http://` or `https://` URL no longer than 2,048 characters and containing no whitespace. The URL must include a hostname. Links such as `ftp://`, `javascript:`, relative paths, and bare hostnames are rejected.

Links appear only on the [dashboard](/dashboard). They are not rendered into SVG or PNG exports. They are stored in the project ZIP and browser storage, so treat a project backup as private when it contains internal service URLs.

## Migration

Imports are validated in their original schema before migration, then validated again as schema version 12. The current project stays open if any step fails.

| Old schema | Migration |
|---|---|
| 1 | Add `layout` with automatic mode and no saved cards |
| 1–2 | Add empty network `icon` and `secondaryIcon` fields |
| 1–3 | Add an empty `customLogos` array |
| 5–6 | Remove `discovery`; add empty service links except for valid schema-5 links, which are kept |
| 7–8 | Add empty `css`, `background`, `networkRow`, `vlanRow`, and group `logo` fields |
| 1–8 | Add the default `branding` block and `sideBySide: false` to every group |
| 9 | Add a default `branding` block; convert the per-device `groupLayout` toggle into each group's `sideBySide` flag |
| 9–10 | Add `backgroundScope: "both"` |
| 11 | Move `css`/`background`/`backgroundScope` into one theme; add `activeTheme`, `dailyBackground`, and per-service `iconSize`/`showName` |
| 1–11 | Add empty service links where needed, then replace every remaining legacy image data URL with an upload reference |

Schema-5 projects came in two variants: upstream projects with discovery data and fork projects with service links. Both are accepted. Discovery bindings are validated before they are discarded, so malformed legacy data does not silently pass. Raw discovery snapshots were never stored in the project.

## Custom logos

Custom logo IDs start with `custom-` and use the same safe ASCII ID characters, with a total limit of 64 characters. Labels are trimmed, nonempty text up to 120 characters. `background` is `none`, `light`, or `dark`. `dataUrl` is a PNG or SVG upload reference, a canonical `data:image/png;base64,...` value, or a self-contained `data:image/svg+xml;base64,...` value. Uploaded logos are stored as SVG. Remote URLs, blob URLs, nested SVG data URLs, extra fields, duplicates, and IDs colliding with catalog or project records are rejected.

## Favicon

The optional project favicon is uploaded from **Diagram settings → Diagram appearance → Project tab icon → Upload tab icon**. Atlas accepts PNG, JPG, WebP, SVG, or ICO files up to 2 MB, 4096px per side, and 16 million pixels. It converts the image to a square PNG with a maximum side of 128px and uploads it. Leave the field empty to use the default Atlas mark. The project favicon is shown in the editor and dashboard browser tabs when no app logo is saved, is part of the project ZIP, and is never rendered into SVG or PNG diagrams.

App branding is part of this schema. **Diagram settings → App branding** stores the app name, optional tab title, and app logo reference in the project's `branding` object. It travels with project ZIPs, project imports, and the autosaved default. Service links, favicons, branding, and theme CSS are excluded from SVG and PNG exports; the active theme's background (or today's random pick) is drawn into the exported SVG.

## IDs and references

Every network, VLAN, device, group, service, and connection needs a unique ID across the whole project. IDs must match:

```text
^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$
```

Connection `from` and `to` values must point to two different existing network or device IDs. VLAN, group, and service IDs cannot be used as connection endpoints.

## Device layout

`layout.mode` is `auto` or `manual`. Automatic layout requires an empty `cards` array. Each manual card ID references one existing device, with no duplicates. A device may be omitted; Atlas places it below the saved cards until its position is saved.

Coordinates are integer diagram units relative to the upper-left of the device region, not browser pixels. `x` and `y` range from 0 through 100,000. Width ranges from 240 through 100,000 and height from 100 through 100,000. Atlas clamps cards to the poster width and treats the rendered content height as the effective minimum.

## Limits

| Item | Limit |
|---|---:|
| Project ZIP file | 32,000,000 bytes |
| ZIP entries | 256 |
| One ZIP entry, expanded | 12,000,000 bytes |
| All ZIP entries, expanded | 32,000,000 bytes |
| `project.json` | 2,000,000 bytes |
| Legacy JSON import file | 2,000,000 bytes |
| Any text field | 120 characters |
| Service link | 2,048 characters |
| Custom CSS | 20,000 characters |
| Devices | 80 |
| Network nodes | 30 |
| VLAN chips | 30 |
| Connections | 160 |
| Service groups, total | 160 |
| Services, total | 800 |
| Hardware facts per device | 12 |
| Manual card rectangles | No more than the device count |
| Custom logos | 32 |
| Image reference | 1,200,000 characters |
| Original logo upload | 2,000,000 bytes; 4096px per side; 16,000,000 pixels |
| Background upload | 10,000,000 bytes |
| Stored custom logo SVG | 512px per side; 400,000 data-URL characters (legacy PNG 200,000) |
| Legacy custom data URLs, total | 1,200,000 characters |
| Stored favicon PNG | 128px per side; 120,000 data-URL characters |

The group limit applies to each device array and to the whole project. Each object only accepts the keys listed above. Extra fields are rejected rather than preserved.

## Minimal valid project

```json
{
  "schemaVersion": 12,
  "revision": 1,
  "title": "Small Lab",
  "subtitle": "Fictional example",
  "theme": "navy",
  "columns": 1,
  "density": "comfortable",
  "favicon": "",
  "branding": {
    "name": "Homelab Atlas",
    "tabTitle": "",
    "favicon": ""
  },
  "themes": [
    { "id": "theme-default", "label": "Default", "css": "", "background": "", "backgroundScope": "both" }
  ],
  "activeTheme": "theme-default",
  "dailyBackground": false,
  "networkRow": "top",
  "vlanRow": "top",
  "layout": {
    "mode": "auto",
    "cards": []
  },
  "customLogos": [],
  "networks": [],
  "vlans": [],
  "devices": [],
  "connections": []
}
```

For a full example with every record type, see [`docs/example.json` on GitHub](https://github.com/AuthorShin/homelab-atlas/blob/main/docs/example.json). Atlas does not have a separate schema file. The server APIs are the shared default project, app branding, and image uploads.
