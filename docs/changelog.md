# Changelog

This file lists the notable changes in each Homelab Atlas release.

## [0.19.3] - 2026-11-29

### Changed

- Logo tracing now uses a fixed 12-color advanced profile instead of automatic classification and palette search. Uploads are much faster and produce simpler paths; smooth gradients are approximated with color bands.
- The vectorizer returns a descriptive error when an image produces no fitted geometry, and Atlas includes export status details in tracing failures.
- The vectorizer HTTP client timeout is now 100 seconds, and Nginx Proxy Manager settings for long traces and large uploads are documented.

### Fixed

- The service inspector's **Icon size** and **Show name** controls now span the full row beside the logo instead of falling into the narrow logo column and wrapping awkwardly.
- **File → Convert existing images to vectors** now skips images that cannot be traced, converts the rest, and reports how many were skipped instead of aborting the whole action.

## [0.19.2] - 2026-11-28

### Changed

- Commented out the `--line` and `--line-soft` CSS variable declarations. Declarations that reference them no longer produce a border or divider line, matching the appearance you get by unchecking them in browser DevTools.

## [0.19.1] - 2026-11-27

### Changed

- Restored the `--line` and `--line-soft` variables and the borders that use them, including input/button/dialog borders and the top-bar divider. The interface keeps its controls framed as before.

## [0.19.0] - 2026-11-27

### Added

- Uploaded custom logos, group logos, and the app logo are now traced to true SVG with OpenVector. The tracing engine runs in a separate internal `vectorizer` container.
- Added **File → Convert existing images to vectors**, which converts already-uploaded raster logos and legacy raster data URLs to SVG. Backgrounds, the project tab icon, and existing SVG files are left alone.
- Both Compose files now include the vectorizer container; the deployment requires both containers.

### Changed

- The app logo SVG is also used as the browser tab icon when no project tab icon is set. The project tab icon stays PNG.
- Backgrounds remain raster uploads and are not traced.

### Fixed

- Logo and app-logo uploads fail with a clear error when the vectorizer is unavailable instead of silently storing a raster image.

## [0.18.0] - 2026-11-27

### Added

- Added a **Themes** gallery under **Diagram settings → Manage themes**. Each theme carries its own CSS, background image, and background placement. **Use** activates a theme; **Add**, **Duplicate**, **Edit**, and **Delete** manage the gallery. **Random background each day** picks a gallery background by date, so the editor and dashboard always agree.
- Added per-service **Icon size** (16–64 diagram units) and **Show name** controls. Hidden and truncated names keep the full text in a native tooltip.
- Long service labels now render on one line with an ellipsis instead of wrapping to two lines.

### Changed

- The diagram group logo is now 32px with the group name beside it instead of underneath.
- Project schema is now version 12. The old project CSS and background fields migrate into a starting theme; services gain `iconSize` and `showName`. Schema 1–11 projects migrate automatically.

### Removed

- Removed the standalone project **Custom CSS** box and the project-level **Background image** / **Background placement** controls. CSS and backgrounds now live in themes.
- Removed the `--line` and `--line-soft` CSS variables and the borders that used them, including the top-bar divider.

## [0.17.0] - 2026-11-27

### Added

- Added **Background placement** under **Diagram appearance**, with **Stage and diagram**, **Stage only**, and **Diagram only** options. Older projects default to **Stage and diagram**, which matches the previous behavior.
- Background images can be up to 10 MB. Other image uploads keep their 2 MB limit.

### Changed

- Uploaded custom logos and group logos are now stored as SVG instead of PNG. The source image is rendered at up to 512px and embedded in a self-contained SVG container, so JPG, PNG, WebP, and SVG uploads all become SVG files.
- Groups marked **Side by side** hide the app labels inside their tiles and show only the app logos, which keeps narrow side-by-side rows readable. Hovering a tile still shows its app name.
- Project schema is now version 11, adding `backgroundScope`. Schema 1–10 projects migrate automatically with `backgroundScope: "both"`.

### Fixed

- Fixed **File → Export** failing with `Background must be empty or a valid image upload reference` when the project uses a large uploaded background. Export now validates the stored project before it inlines uploaded images, so the size limit for stored references no longer rejects a valid export.
- ICO images (`data:image/x-icon` and `data:image/vnd.microsoft.icon`) are accepted as background and group logo data URLs, matching the ICO upload support.

## [0.16.1] - 2026-11-25

### Added

- **File → Save project** now downloads one ZIP containing `project.json`, a manifest, and every uploaded image; **File → Import project** restores that archive and uploads its images to the destination Atlas server. Legacy JSON exports from schema versions 1 through 9 remain accepted only as a migration path.
- Added a browser-native ZIP reader and writer so save and import do not depend on a library or network request.

### Changed

- Group names now render directly under the group logo, and the group logo remove button sits beside the logo instead of overlapping it.
- The **Side by side with other marked groups** checkbox appears only while its group is selected, keeping the group editor compact. The wording now describes the behavior instead of implying a per-device toggle.
- The File menu no longer offers a JSON export.

### Fixed

- Fixed new groups and services failing validation with `Group logo must be empty or a valid image upload reference` because newly created groups omitted `logo` and `sideBySide`. Current-schema projects with those two fields missing are repaired when they load.
- Fixed the group **Apps** button not opening the Add services picker.
- Fixed the misplaced close icon after a group logo was added.

### Removed

- Removed **File → Move embedded images to Atlas**. New uploads are always stored in the Atlas upload directory; legacy embedded images are migrated automatically when an old project is imported.

## [0.16.0] - 2026-11-24

### Added

- Moved app branding (name, browser-tab title, and logo) into project JSON under **Diagram settings → App branding**. The editor and dashboard now read `project.branding`; the server `/api/branding` endpoint is no longer used by the UI.
- Added debounced autosave of the current project to `/api/default-project` on every change, replacing the manual **Save as default project** / **Clear default project** actions.
- Added a per-group **Side-by-side** checkbox, replacing the per-device toggle. Ticked groups use the **Columns** value from **Diagram appearance**; older projects migrate their device setting into per-group flags.
- Added **File → Move embedded images to Atlas**, which uploads existing data URLs and replaces them with `/api/uploads` references.
- Added a **Custom CSS** documentation page.

### Changed

- Image fields (app logo, project tab icon, custom logos, group logos, and background image) now use `/data` upload references instead of embedded data URLs.
- The background image is now drawn inside the exported SVG behind all diagram content, sized to the full viewBox instead of an A4-like page.
- Project schema is now version 10, adding `branding` and per-group `sideBySide` and removing `device.groupLayout`. Schema-9 projects migrate automatically.
- Service links, favicons, app branding, and custom CSS remain excluded from SVG and PNG exports.

## [0.15.0] - 2026-11-24

### Added

- Added group ordering with up/down buttons in the device inspector's **Apps** tab, plus an optional per-group logo shown to the left of the group name, including for unnamed groups.
- Added a per-device **Side-by-side groups** toggle that uses the **Columns** value from **Diagram appearance** (1 → 1, 2 → 2, 3 → 3, 4 → 4).
- Added project-only **Custom CSS** and a project **Background image** setting. Custom CSS is stored in project JSON and applies in the editor and dashboard; the background image is stored on the Atlas server.
- Added **Network row** and **VLAN row** placement settings (Top or Bottom, independently) under **Diagram appearance**.
- Added `/api/uploads` for server-side image uploads. New app logos, project tab icons, custom logos, group logos, and background images live in the `atlas-data` volume under `uploads/`. Legacy data URLs remain valid.
- Added schema version 9 with `css`, `background`, `networkRow`, `vlanRow`, `device.groupLayout`, and `group.logo`. Schema-8 projects migrate automatically.

### Changed

- Image uploads are addressed by a server URL instead of being embedded as data URLs. The browser inlines them when exporting so logos still appear in SVG and PNG images.
- The Content-Security-Policy allows inline styles for project CSS. Custom CSS, the background image, service links, favicons, and app branding are still excluded from exported SVG and PNG files.

## [0.14.0] - 2026-11-23

### Added

- Added app-wide branding under **Diagram settings → App branding**. The app name, optional browser-tab title, and uploaded logo are stored on the Atlas server and applied in the editor, dashboard, and browser tabs on every device.
- Added `/api/branding` with atomic JSON storage in the `atlas-data` volume, strict validation, a 200 KB limit, and write-header and content-type checks.
- Added an app logo fallback order: saved app logo, then the project tab icon, then the default Atlas mark.

### Changed

- Kept the existing per-project tab icon under **Diagram settings → Diagram appearance → Project tab icon**, where it is used when no app logo is saved.
- Changing app branding no longer edits the current project or creates an autosave.
- Updated documentation, troubleshooting, and release metadata for v0.14.0.

## [0.13.0] - 2026-11-22

### Added

- Added a shared default project stored in the container's `atlas-data` volume. **File → Save as default project** makes the current project open on new devices and fresh browser profiles; **Clear default project** removes it. Each browser's autosave still takes precedence.
- Added `/api/default-project` with size, JSON-shape, and write-header checks. The endpoint reports a clear error when no writable data directory is available.
- Added an `atlas-data` volume to both Compose files and updated container smoke tests to save and clear the default.

### Changed

- Replaced the browser-only default with the shared default while keeping older browser-stored defaults as a fallback.
- A browser with an untouched example autosave now prefers the shared default.
- Updated documentation, troubleshooting, and release metadata for v0.13.0.

## [0.12.1] - 2026-11-19

### Added

- Added a per-project browser-tab icon under **Diagram settings → Appearance**. Upload PNG, JPG, WebP, SVG, or ICO files up to 2 MB; Atlas stores a square PNG up to 128px in the project, applies it in the editor and dashboard, and keeps it out of SVG and PNG exports.
- Added schema version 8 with a `favicon` field. Schema-7 projects migrate automatically, gain an empty favicon, and keep their service links.

### Changed

- Updated the release downloads, image tags, and documentation for v0.12.1.

## [0.12.0] - 2026-11-18

### Added

- Added a read-only `/dashboard` view of the browser-stored project, with clickable service tiles and live updates when the project changes.
- Added optional `http://` and `https://` service links. Links stay dashboard-only and never appear in SVG or PNG exports.
- Added **File → Save as browser default** and **Clear browser default** actions. When no autosaved project exists, the editor and dashboard fall back to the browser default before the example.
- Added a dedicated dashboard guide and expanded project-format, storage, and troubleshooting documentation.

### Changed

- Removed discovery, scanning, Docker collector, Nmap, and Hawser features, including their UI, API, settings, deployment profiles, environment variables, tests, and documentation.
- Saved projects now use schema version 7. Imports from schema versions 1 through 6 drop discovery data, preserve valid schema-5 service links, and add empty links where needed.
- The Go server is now a static editor and dashboard server with no project, discovery, or collector API.
- Diagram and image export output for inventory, placement, and styling is otherwise unchanged.

## [0.11.1] - 2026-10-28

### Fixed

- Focus canvas now uses the full tablet width when the inspector was open.

## [0.11.0] - 2026-10-28

### Changed

- Reworked the editor into a calmer workspace with separate inventory, canvas, and inspector areas.
- Added a File menu and split device editing into **Details**, **Apps**, and **Layout** tabs.
- Clarified app rows, dialogs, canvas controls, and mobile access to Undo and Redo.
- Kept diagram and export output unchanged; schema version 6 projects, saved layouts, Docker collectors, and discovery imports remain compatible.
- Updated current downloads, image tags, Compose defaults, screenshots, and documentation for v0.11.0.
- Added no runtime dependency.

## [0.10.0] - 2026-10-28

### Added

- Added a guided Choose, Find, and Review discovery flow with method-specific setup, a Homelab ports preset, and collapsed advanced scan options.
- Added unchecked findings, **Select all shown** for the current filtered page, **Clear selection** for the current device, and retained choices while reviewing multiple devices.
- Added focused guide figures for Docker readiness, network scanning, and both review paths.

### Changed

- Discovery readiness failures now stay with their method and offer an in-place retry without misreporting missing setup.
- Repository source is consolidated under `app/`, `deploy/`, and `tools/`; the source ZIP uses `app/` and `deploy/` and omits development tools.
- Current downloads, image tags, Compose defaults, and documentation now point to v0.10.0.

## [0.9.0] - 2026-10-28

### Added

- Added explicit bounded IPv4 Nmap TCP scans with private-range defaults, fixed safety limits, Stop support, and the existing unchecked multi-host review.
- Added opt-in local Docker builds with Nmap while keeping the published image scanner-free.

### Changed

- Nmap XML import and live results now share the same normalized identities, explicit Apply flow, layout protection, bindings, and Undo behavior.

## [0.8.0] - 2026-10-27

### Added

- Added bounded Nmap XML import with multi-host, ping-only host, TCP/UDP endpoint, IPv6, and MAC-stable identity review.
- Added host cards and device-level discovery bindings without automatic scanning or diagram changes.

### Changed

- Discovery now keeps manual geometry fixed, supports reviewing several imported hosts, and applies each host as one undo step.
- Saved projects now use schema version 6; schema versions 1 through 5 migrate without changing existing inventory or layout.

## [0.7.0] - 2026-10-27

### Added

- Added previewed SVG and PNG privacy filtering for IP addresses, MAC addresses, URLs, emails, and optional literal custom terms.
- Added Hawser Standard-mode inventory compatibility through the existing restricted Docker collector.

### Changed

- Export filtering is session-only and preserves project JSON, autosave, undo history, uploaded image bytes, card geometry, and canvas dimensions.
- Hawser and Portainer credentials are mutually exclusive, validated at startup, and never forwarded across redirects.

## [0.6.0] - 2026-10-27

### Added

- Added explicit Docker discovery through a restricted, authenticated collector or sanitized snapshot import.
- Added a review dialog for adding services or linking findings to existing services, with nothing selected initially and one-step undo.
- Added a Go server with embedded editor assets, discovery source proxying, and `healthcheck` and `collect` commands.

### Changed

- Saved projects now use schema version 5 with discovery bindings; schema versions 1 through 4 upgrade without changing existing inventory or manual layout.
- Container images now use a static Go binary and an optional isolated `discovery` Compose profile.
- The Go server now precompresses eligible embedded assets once and serves encoding-specific ETags with cache revalidation.

## [0.5.0] - 2026-10-25

### Added

- Added accessible visual pickers for device, service, and network logos.
- Added previewed PNG, JPG, WebP, and SVG uploads stored as reusable project PNGs.

### Changed

- Saved projects now use schema version 4 and embed uploaded assets for offline use and exports.
- Schema versions 1 through 3 now upgrade while preserving inventory, manual layouts, revisions, and existing network logo choices.

## [0.4.0] - 2026-10-25

### Added

- Added searchable primary and optional secondary logos for network nodes.
- Added 27 locally bundled marks for major US and European internet providers, including country and brand aliases.

### Changed

- Saved projects now use schema version 3. Schema-version-1 and schema-version-2 imports upgrade while preserving existing content and manual layouts.

## [0.3.0] - 2026-10-25

### Added

- Added Arrange mode for moving and resizing device cards with pointer, keyboard, numeric, grid, and alignment-guide controls.
- Added undoable **Auto layout** reset while preserving manual positions and sizes in saved projects and exports.

### Changed

- Saved projects now use schema version 2. Schema-version-1 imports upgrade automatically to automatic layout.

## [0.2.0] - 2026-10-25

### Changed

- Refined diagram typography, hardware facts, CPU badges, service groups, network cards, and multi-column layout.
- Reworked the editor with quieter controls, inventory search, focused canvas view, and a mobile inventory drawer.
- Combined SVG and PNG choices under **Export** while keeping editable JSON under **Save project**.
- Kept schema-version 1 project files compatible with the updated editor.

## [0.1.0] - 2026-10-25

### Added

- Editor for devices, hardware notes, grouped services, network nodes, VLAN chips, and connections.
- Automatic layouts with three diagram themes, two spacing options, and one to four columns.
- Browser autosave, multi-tab conflict handling, and checked JSON import/export.
- SVG and high-resolution PNG export with included local logos.
- Docker Compose deployment, a portable Python/static ZIP, and Linux AMD64 and ARM64 images on GHCR.
- Documentation for setup, editing, backups, privacy, troubleshooting, development, and the project format.

[0.1.0]: https://github.com/aiden0rchad/homelab-atlas/releases/tag/v0.1.0
[0.2.0]: https://github.com/aiden0rchad/homelab-atlas/releases/tag/v0.2.0
[0.3.0]: https://github.com/aiden0rchad/homelab-atlas/releases/tag/v0.3.0
[0.4.0]: https://github.com/aiden0rchad/homelab-atlas/releases/tag/v0.4.0
[0.5.0]: https://github.com/aiden0rchad/homelab-atlas/releases/tag/v0.5.0
[0.6.0]: https://github.com/aiden0rchad/homelab-atlas/releases/tag/v0.6.0
[0.7.0]: https://github.com/aiden0rchad/homelab-atlas/releases/tag/v0.7.0
[0.8.0]: https://github.com/aiden0rchad/homelab-atlas/releases/tag/v0.8.0
[0.9.0]: https://github.com/aiden0rchad/homelab-atlas/releases/tag/v0.9.0
[0.10.0]: https://github.com/aiden0rchad/homelab-atlas/releases/tag/v0.10.0
[0.11.0]: https://github.com/aiden0rchad/homelab-atlas/releases/tag/v0.11.0
[0.11.1]: https://github.com/aiden0rchad/homelab-atlas/releases/tag/v0.11.1
[0.12.0]: https://github.com/AuthorShin/homelab-atlas/releases/tag/v0.12.0
[0.12.1]: https://github.com/AuthorShin/homelab-atlas/releases/tag/v0.12.1
[0.13.0]: https://github.com/AuthorShin/homelab-atlas/releases/tag/v0.13.0
[0.14.0]: https://github.com/AuthorShin/homelab-atlas/releases/tag/v0.14.0
[0.15.0]: https://github.com/AuthorShin/homelab-atlas/releases/tag/v0.15.0
[0.16.0]: https://github.com/AuthorShin/homelab-atlas/releases/tag/v0.16.0
[0.16.1]: https://github.com/AuthorShin/homelab-atlas/releases/tag/v0.16.1
[0.17.0]: https://github.com/AuthorShin/homelab-atlas/releases/tag/v0.17.0
[0.18.0]: https://github.com/AuthorShin/homelab-atlas/releases/tag/v0.18.0
[0.19.0]: https://github.com/AuthorShin/homelab-atlas/releases/tag/v0.19.0
[0.19.1]: https://github.com/AuthorShin/homelab-atlas/releases/tag/v0.19.1
[0.19.2]: https://github.com/AuthorShin/homelab-atlas/releases/tag/v0.19.2
[0.19.3]: https://github.com/AuthorShin/homelab-atlas/releases/tag/v0.19.3
