# Troubleshooting

Find the symptom that matches what you're seeing. Browser developer tools and `docker compose logs` can help, but remove private details before sharing any output.

Start with the [FAQ](/faq) for setup, dashboard, storage, layout, and saving explanations. The table below is the shorter symptom checklist.

| Symptom | Action |
|---|---|
| Project is empty at another URL | Use the same browser profile, hostname, port, and protocol. If you changed the address, import a saved project ZIP. |
| “Not saved — storage unavailable” | Allow site storage, leave private mode, and check the browser's storage quota or policy. If the project is still open, save a project ZIP right away. |
| Another-tab conflict banner | Save a project ZIP from the current tab first. Then choose **Keep my edits** or **Load saved version** based on which copy you want. |
| Import rejected | Make sure it is a Homelab Atlas project ZIP no larger than 32 MB, with schema-version-12 `project.json`, or a legacy JSON export from schema version 1 through 11 for migration, no larger than 2 MB. Unknown keys, duplicate or unsafe IDs, unknown logo IDs, bad references, malformed links, missing images, and invalid favicons are rejected. |
| Custom logo upload rejected | Use a PNG, JPG, WebP, or safe SVG no larger than 2 MB, 4096px per side, or 16 million pixels. Atlas stores it as SVG at up to 512px, with the source image rendered into the SVG container. Active or externally loaded SVG content is rejected. |
| Favicon or app-logo upload rejected | Use a PNG, JPG, WebP, SVG, or ICO no larger than 2 MB, 4096px per side, or 16 million pixels. Atlas resizes it to a square PNG up to 128px. Active or externally loaded SVG content is rejected. |
| App branding does not change | Check the status line under **Diagram settings → App branding**. Branding is saved with the project, so also check the project save status. If the server copy cannot be written, make sure the container has a writable `atlas-data` volume or that `ATLAS_DATA_DIR` points to a writable directory, then check `docker compose logs atlas`. Refresh another open tab after saving. |
| Header still shows the old logo | The saved app logo wins over the project tab icon. Remove the app logo to fall back to the project tab icon, or upload a new app logo. Reload a tab that was open before the change. |
| Service link rejected | Leave the field empty or use a complete `http://` or `https://` URL up to 2,048 characters with no spaces. Bare hostnames, relative paths, and other schemes are rejected. |
| Dashboard tile does not open | The service has no valid link, or the saved project is invalid. Check the link in the editor's **Apps** tab. Only linked services become anchors. |
| Dashboard shows the example | This browser origin has no autosaved project, the server has no default project, and there is no older browser default. Open the editor and import or create a project; every edit autosaves a new default. |
| Default project does not load | Atlas uses the default only when no autosaved project exists. Clear this browser's autosave or use a fresh browser profile. The default is stored on the server, not in the browser. |
| Default project cannot be saved | Make sure the container has a writable `atlas-data` volume or that `ATLAS_DATA_DIR` points to a writable directory, then check `docker compose logs atlas`. The browser autosave still works without it. |
| Port 8080 already in use | Stop the conflicting service or use a different local port as shown below. |
| Released container does not start | Run `docker compose -f compose.release.yaml config`, then use the same `-f compose.release.yaml` argument with `pull`, `ps`, and `logs atlas`. Also confirm the GHCR package is public. |
| Source-built container does not start | Run `docker compose config`, rebuild it, check `docker compose ps`, and read `docker compose logs atlas`. |
| Health check fails | Try `curl http://localhost:8080/healthz`. Make sure the container is running and listening on the interface you expected. |
| Labels collide or cards are too tall | Shorten labels, use Compact density, adjust 1–4 columns, reorder devices, arrange device cards, or use **Fit page**/**Fit width**. Device cards cannot be resized below their content. |
| PNG export fails or is reduced | Simplify the diagram, try another current browser, or export SVG. PNG is capped at 36 MP and 16,384 px per side. |

## Use another port

With the direct Go server:

```sh
PORT=8081 go run ./app
```

For a source build, build the image and publish a different host port:

```sh
docker compose build
docker compose run --rm -p 127.0.0.1:8081:8080 atlas
```

Open `http://localhost:8081`. The browser treats port 8081 as a different site from port 8080, so the autosave from 8080 does not appear. Save a project ZIP and import it, or open a fresh browser profile to load the autosaved server default.

For the released image, Compose `run` does not publish the service's normal ports. Add the alternate mapping yourself:

```sh
docker compose -f compose.release.yaml run --rm -p 127.0.0.1:8081:8080 atlas
```

Leave the port inside the container at 8080. There is no `ATLAS_PORT` setting.

## Import validation details

Atlas checks the entire import before replacing your current project. If the archive is rejected, the current project stays open. Common causes include:

- a ZIP larger than 32,000,000 bytes, more than 256 files, or an entry over 8,000,000 bytes
- missing or oversized `project.json`
- a missing uploaded image that is neither in the ZIP nor already on the server
- a corrupt, encrypted, or unsupported ZIP entry
- unsupported or missing `schemaVersion`
- unknown object keys or invalid field types
- a current-schema file with a `discovery` key
- IDs that are duplicated, longer than 64 characters, or contain unsupported characters
- unknown bundled or custom logo IDs
- service counts outside 1–99
- service links that are not empty or complete `http://`/`https://` URLs
- a favicon that is not empty, a PNG upload reference, or a canonical PNG data URL at 128px or smaller
- a connection to a missing endpoint or to itself
- collection or text limits described in [project format](/project-format)

Older projects are validated in their original schema before migration. Schema 7 and 8 gain the schema-9, schema-10, schema-11, and schema-12 fields. Discovery data from schema 5 and 6 is removed; a malformed legacy binding still causes the import to be rejected. Legacy embedded images are uploaded during the import. If the storage or import problem continues, replace any private details with fictional data before opening a [bug report](https://github.com/AuthorShin/homelab-atlas/issues/new?template=bug_report.yml).

## App branding

The editor and dashboard read app branding from the current project's `branding` object. The app name replaces the header label, the optional tab title changes the browser tab, and the app logo becomes both the header mark and tab icon. Branding travels with the project ZIP and the autosaved default.

- If the app logo upload or name change is rejected, the previous branding stays in the project.
- If another browser still shows the old branding, refresh it or switch away from and back to the tab.
- If no app logo is saved, Atlas uses the project tab icon, then the default Atlas mark.
- Clearing site data removes the browser autosave; a fresh load uses the server default, which includes the last autosaved branding.
- Removing the `atlas-data` volume removes the autosaved default project, including its branding.

## Dashboard and default project

The dashboard reads the browser autosave first and asks the same Atlas server for the shared default only when there is no usable autosave.

- **Saved project** means an autosaved project was found.
- **Server default** means no autosave existed and the default saved on the Atlas server was used.
- **Browser default** means an older browser-stored default was used because the server had none.
- **Example project** means none of those existed.
- **Saved project unavailable**, **Browser default unavailable**, or **Storage unavailable** means a stored value could not be read or storage is blocked. The example is shown instead.

The dashboard falls back to the example when a saved project is corrupt. Open the editor to import a good backup. **Refresh** re-reads the current browser origin and the server default; it does not replace an existing autosave.

Every project change updates the server default without overwriting another browser's existing autosave. To test the default, clear this browser's site data or use a fresh browser profile, then reload. Editing a project loaded from the default creates a normal autosave.
