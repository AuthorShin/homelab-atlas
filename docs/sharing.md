# Sharing and backup

A project ZIP is your editable project file. SVG and PNG are images of it. The dashboard is a read-only browser view of the same project.

Atlas saves schema version 12. A project ZIP contains `project.json` and every uploaded image used by the project, including theme backgrounds. Imports from schema versions 1 through 11 preserve inventory, custom logos, connections, manual layout, service links, branding, and per-group settings; the old CSS/background pair becomes a starting theme. Discovery data from older projects is discarded. Valid schema-5 service links are kept; other older services gain an empty link. Older Atlas versions cannot open schema version 12. Legacy JSON exports are accepted only as a migration path; their embedded images are uploaded to Atlas.

## Browser autosave

Changes autosave to `localStorage` in the current browser profile. The browser keeps separate storage for each hostname, port, and protocol. The server also receives an autosaved copy as the default project in the `atlas-data` volume on every change. App branding is part of the project JSON, including its autosaved default.

A project can appear missing after you:

- clear site data
- use a private browsing session
- switch browsers or browser profiles
- open the app through a different hostname, port, or protocol

Use **Save project** regularly, especially before updates or before changing the address you use to open Atlas. The ZIP is self-contained, so it is also the safest backup of uploaded logos and backgrounds.

## Default project

The editor automatically saves the current project to the container's `atlas-data` volume after every change. When a browser opens Atlas and has no autosaved project, it loads this default instead of the included example. Loading it does not immediately create an autosave; the first edit does.

The default is separate from autosave and from **Load example** / **Start empty**. The current project is autosaved to the server after every change, but each browser's autosave still takes precedence. Because the default lives on the Atlas server, a new device or fresh browser profile opens it. A browser that already has an autosave keeps that autosave. See [Dashboard and default project](/dashboard).

App branding is part of the project. **Diagram settings → App branding** stores the app name, optional tab title, and app logo reference in the `branding` object of the project. It is included in **Save project** ZIP files and the autosaved default, and changing it edits the current project.

## Project ZIP backup and transfer

Open **File** and choose **Save project** to download one ZIP containing `project.json`, a small manifest, and every uploaded image used by the project. To move it to another browser or address, choose **File → Import project** and select that ZIP. Atlas restores the project, uploads the included images to the new Atlas server, and only then replaces the current project. You can undo an import during the same page session, but reloading clears the undo history.

There is no JSON export in the File menu. If you have a JSON backup from an older Atlas version, **Import project** accepts it as a migration path: Atlas validates the old schema, uploads any embedded images, and saves the result as the current schema.

Try the [complete fictional example on GitHub](https://github.com/AuthorShin/homelab-atlas/blob/main/docs/example.json), or choose **Load example** in the editor.

## Concurrent tabs

If another tab changes the saved project, the current tab stops before overwriting it and offers:

- **Keep my edits**: replace the browser's saved copy with this tab's project
- **Load saved version**: load the other tab's saved copy here
- **Download my project**: save this tab as a project ZIP before deciding

Try not to edit the same project in several tabs. These choices help you recover from a conflict, but they do not turn Atlas into a collaborative editor.

## Export formats

Choose **Export**, then select SVG or PNG. Export creates an image; it does not replace the editable project ZIP downloaded by **Save project**.

| Format | Best for | Important behavior |
|---|---|---|
| Project ZIP | Backup, transfer, later editing | `project.json` plus every uploaded image; the only editable-project backup |
| SVG | Documentation, scaling, print | Vector image with the bundled logos included |
| PNG | Chats, wikis, broad compatibility | Rendered at 3× when possible, capped at 36 megapixels and 16,384 px per side |

SVG and PNG files cannot be imported to restore a project. Atlas may reduce a large PNG to stay within browser limits. Use SVG when you need to scale the image without a fixed resolution.

Service links are used only by the dashboard. They never appear in SVG or PNG output. The dashboard is not another file format; it reads the same browser-stored project as the editor.

The Export dialog checks **Hide network details** each time it opens. The same previewed filter applies to SVG and PNG, replacing IP addresses, MAC addresses, URLs, and emails with `[hidden]`. **Also hide text** accepts literal custom names, one per line. It is session-only and never changes the project, autosave, project ZIP, or undo history.

## Before you post it {#share-intentionally}

Filtering cannot identify every private hostname, domain, role, network label, or service name. Add custom terms and inspect the preview. Text baked into uploaded logos is unchanged, and a project ZIP always contains the full editable project. Only share what you mean to share. The included example and documentation screenshots use fictional data.
