# Development

The app uses browser JavaScript and the Go standard library, with no runtime packages to install. Node.js is used for tests, building logo data, and this documentation site. Python is retained for deterministic release packaging tests.

At startup, the Go server prepares reusable gzip representations for compressible embedded assets when they are smaller than the originals. Static responses use encoding-specific ETags and `Cache-Control: no-cache` revalidation. The backend endpoints are `/api/default-project`, which stores one optional shared default project, and `/api/branding`, which stores the optional app name, tab title, and logo. Both use `ATLAS_DATA_DIR` (default `data/`; `/data` in the container). There is no discovery, collector, account, or database API.

The final container includes `LICENSE` and `THIRD_PARTY_NOTICES.md` under `/usr/share/licenses/homelab-atlas/`.

## Source layout

| Path | Purpose |
|---|---|
| `app/public/` | Embedded editor, dashboard, logos, sources, and upstream licenses |
| `app/main.go` | Embedded assets and the server plus the `healthcheck` command |
| `app/server.go` | Restricted static server for the editor and dashboard |
| `app/default_project.go` | Shared default-project storage and `/api/default-project` |
| `app/branding.go` | App branding validation and `/api/branding` |
| `app/file_store.go` | Atomic JSON file storage used by app branding |
| `deploy/` | Dockerfile and source/released Compose recipes |
| `tools/scripts/` | Repeatable icon and release artifact tools |
| `tools/tests/` | Node model/storage/dashboard tests and Python release tests |
| `docs/` | VitePress documentation and sample files |
| `compose.yaml` | Default source Compose configuration |

## Checks

Use Go 1.26, Node.js 20 or newer, and Python 3.10 or newer:

```sh
npm test
go test -race ./...
go vet ./...
npm run build:icons
npm run check:icons
docker compose config
docker compose --project-directory . -f deploy/compose.release.yaml config
python3 tools/scripts/release.py v0.14.0 --output dist
```

`npm test` checks logo data, runs the Node tests, runs `go test ./...`, and runs the Python release tests. Release files go into the ignored `dist/` directory, and the release workflow checks their checksums too.

Node tests cover the project schema, migrations, link and favicon validation, app branding and tab-title fallback, default-project storage and fallback order, dashboard links, custom logos, and layout calculations. Go tests cover static serving, `/dashboard`, compression, caching, security headers, the default-project and branding APIs, and legacy discovery-route 404s.

## Documentation

The docs keep their VitePress dependency inside `docs/`:

```sh
npm --prefix docs ci
npm --prefix docs run dev
npm --prefix docs run build
npm --prefix docs run preview
```

The configured base path is `/homelab-atlas/`, even when you run the docs locally. The dev server prints the full local URL. Use that URL when checking links and images.

### Guide screenshots

Annotated guide screenshots live in `docs/public/guides/`; their crops, marks, arrows, and captions live in `docs/.vitepress/theme/guide-figures.ts`. Capture only fictional data at a disposable origin. Never use a user lab, credentials, or private addresses. When the UI changes, update the source image dimensions, crop, and marks together. No separate capture toolchain is required.

## Adding or updating logos

1. Use a legitimate, pinned SVG source with a license that allows it to be included.
2. Add or replace the SVG in `app/public/logos/`.
3. Add its metadata to `app/public/catalog.js`, including the light/dark contrast plate sets if it needs them.
4. Add the exact source and license information to `app/public/licenses/logo-sources.json`.
5. Update `docs/THIRD_PARTY_NOTICES.md` and add any license file that applies.
6. Run `npm run build:icons` and `npm run check:icons`.
7. Include the generated `app/public/icon-data.js` change.

Keep the logos in the repository. Do not load them, fonts, or other images from a CDN at runtime. Product names and trademarks still belong to their owners; see [THIRD_PARTY_NOTICES.md on GitHub](https://github.com/AuthorShin/homelab-atlas/blob/main/docs/THIRD_PARTY_NOTICES.md).

Project uploads are different from bundled logos. They are decoded by the browser, converted to PNG, limited to 512px and 200,000 data-URL characters each, and stored only in project JSON. Imports validate PNG structure, native zlib output within a fixed bound, and native browser image decoding. Projects allow 32 uploads and 1,200,000 total custom data-URL characters. Original files are limited to 2,000,000 bytes, 4096px per side, and 16 million pixels. A project favicon uses the same upload checks, is stored as a square PNG no larger than 128px, and is limited to 120,000 data-URL characters. An app logo uses the same browser upload checks but is stored on the server in `branding.json`, not in the project. The branding JSON is limited to 200 KB and validated again by Go before it is written atomically.

## Preparing a release

Update the root package version, the default tag in `deploy/compose.release.yaml`, the release notes, and `docs/changelog.md` together. Run the app, docs, Compose, and release-file checks before pushing a strict `vMAJOR.MINOR.PATCH` tag. The [release guide](/releases/) has the full checklist and the first-package visibility step.
