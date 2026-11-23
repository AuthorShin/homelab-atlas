# Getting started

Homelab Atlas runs in your browser and is served from your own machine. The published Docker image is the easiest way to run it.

## Requirements

- Docker Engine or Docker Desktop with Compose v2
- A current desktop browser

You only need Git if you're building from source. Running without Docker requires Go 1.26 or newer. Node.js is only needed for tests, logo maintenance, and work on these docs. Python is used only by the release-file tests.

Manual diagrams need only Atlas and a browser. There is no scanner, collector, or external service to configure.

## Install the released image

Download the release Compose file, then start the container:

```sh
curl -fsSLO https://github.com/AuthorShin/homelab-atlas/releases/download/v0.14.0/compose.release.yaml
docker compose -f compose.release.yaml up -d
```

Open `http://localhost:8080`. Verify the server if needed:

```sh
curl http://localhost:8080/healthz
```

A healthy response is `ok`. By default, the Compose file pulls `ghcr.io/authorshin/homelab-atlas:0.14.0`. It only listens on the machine running Docker, keeps the container read-only, drops its capabilities, and enables the no-new-privileges setting. The optional default project and app branding are kept in the `atlas-data` volume.

## Pin and update versions

To pin a version, create `.env` next to `compose.release.yaml`:

```dotenv
ATLAS_VERSION=0.14.0
```

When you want to update, change `ATLAS_VERSION` in `.env` to a version that has been published. Then pull it and recreate the container without changing the hostname or port:

```sh
docker compose -f compose.release.yaml pull
docker compose -f compose.release.yaml up -d
```

Save an editable JSON project before you update or downgrade. Your working project is stored by the browser. The optional default project and app branding are stored in the `atlas-data` volume, which Compose keeps across normal updates. Atlas 0.14.0 uses schema version 8 and imports schema versions 1 through 7. Existing inventory, uploaded logos, connections, manual layouts, and service links are preserved. Discovery data from older projects is discarded, and older service-link fields are kept or filled with an empty link. Schema-7 projects gain an empty favicon. Atlas does not migrate projects backward; older releases cannot open schema version 8.

The image tags work like this:

- `0.14.0` and `v0.14.0` identify this release.
- `0.14` moves to the newest compatible 0.14 patch.
- `latest` moves to the newest stable release.
- A published image digest never changes; the [release guide](/releases/) explains how to pin one.

## Build from source

Install Git, clone the repository, and build the current source:

```sh
git clone https://github.com/AuthorShin/homelab-atlas.git
cd homelab-atlas
docker compose up --build -d
```

Update a source deployment with:

```sh
git pull --ff-only
docker compose up --build -d
```

Stop a released-image deployment with:

```sh
docker compose -f compose.release.yaml down
```

Stop a source-built deployment from its checkout with:

```sh
docker compose down
```

## Run without Docker {#direct-go-fallback}

From a source checkout, run:

```sh
go run ./app
```

For the portable release, extract the ZIP and move into its top-level directory first:

```sh
unzip homelab-atlas-0.14.0.zip
cd homelab-atlas-0.14.0
go run ./app
```

Open `http://localhost:8080`. The server exposes the embedded editor and dashboard assets plus the default-project and app-branding endpoints, and by default only listens on the same machine. Running from a source checkout or release ZIP creates a `data/` directory for the default project and app branding; set `ATLAS_DATA_DIR` to choose another writable directory.

## Open it from another computer {#trusted-lan-access}

Atlas has no login system. Only make it available on a LAN you trust:

```sh
ATLAS_BIND=0.0.0.0 docker compose -f compose.release.yaml up -d
```

Open `http://<server-address>:8080` from the other computer. The browser sees that address as a different site from `localhost`, so it has separate browser storage. Save JSON before changing the hostname, port, or protocol. Do not expose Homelab Atlas directly to the public internet.

The server has no login, API token, or host allowlist. Each browser keeps its own autosave. The optional default project is stored on the server, so a new browser or device with no autosave opens it; a browser that already has an autosave keeps that copy. App branding is stored on the server too, so every browser sees the same app name and logo. Use **File → Save project** on the first computer and **Import project** on the other when you want to move a project that already has local edits. Anyone who can reach the instance can read or replace the default project and app branding, so do not expose Homelab Atlas directly to the public internet.

## First diagram

1. Open **File** and choose **Load example** to explore or **Start empty**.
2. Add a device from the inventory rail.
3. Select its card or inventory row to open the inspector.
4. Add a service group and local logo tiles.
5. Add an optional `http://` or `https://` link to a service in its **Apps** tab.
6. Choose **File → Save project** before sharing or changing origins.

Open **Dashboard** in the top bar to see the same project as a read-only tile view. If this browser has no autosaved project, the dashboard falls back to the default project saved on the Atlas server and then to the example. Use **File → Save as default project** when you want a project to open automatically on new devices and in fresh browsers.

The [annotated editor overview](/editor#editor-guide) covers the controls. The [dashboard guide](/dashboard) explains links and the default project. The [privacy and deployment page](/privacy) explains what stays in the browser and why Atlas should stay off the public internet. For setup or storage failures, check the [FAQ](/faq).
