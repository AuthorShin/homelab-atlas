# Dashboard and default project

The dashboard is a read-only view of the project stored in your browser. It uses the same diagram as the editor and turns linked service tiles into clickable links. It does not add accounts or discovery.

## Open the dashboard

Choose **Dashboard** in the editor's top bar, or open `/dashboard` on the same host and port. Use **Edit diagram** to return to the editor.

The dashboard reads:

1. the autosaved project in this browser origin
2. the default project saved on this Atlas server, when there is no autosaved project
3. an older browser default, when neither exists
4. the included example, when none exists

The source is shown in the top bar and in a notice above the diagram. **Refresh** re-reads browser storage and the server default. The dashboard also updates when another tab saves the project, when storage changes, and when the tab becomes visible again. A custom browser-tab icon saved with the project is applied to the dashboard tab when no app logo is set; otherwise the app logo or default Atlas mark is used.

## App branding

Open **Diagram settings → App branding** in the editor to set the app name, optional browser-tab title, and header logo. Branding is part of the project JSON, so the dashboard reads it from the project it is displaying. The name and logo travel with saved JSON and the autosaved default.

Branding is stored in the `branding` object of the project, not in a separate server file. Editing branding changes the open project and its autosave. The app logo is used in the header and tab first; if none is set, Atlas falls back to the project tab icon and then the default Atlas mark.

The default-project endpoint is not authenticated and Atlas has no user roles. Anyone who can reach the instance can read or replace the shared default project. Keep Atlas on localhost or a trusted LAN.

## Service links

Add or edit a link in the device inspector's **Apps** tab. Leave it empty for a tile without a link, or use a complete `http://` or `https://` URL. Links are limited to 2,048 characters and cannot contain spaces.

On the dashboard, every valid link wraps its service tile. Selecting the tile opens the URL in a new tab with `noopener`, `noreferrer`, and `no-referrer` behavior. Atlas does not probe, proxy, or preload the address. A tile with an invalid or empty link stays visible but is not clickable.

Links are dashboard-only. They are part of saved JSON and browser storage, but SVG and PNG exports contain only the diagram. That separation keeps private admin URLs out of images you share.

The **status** in the dashboard top bar shows how many services have links, for example `3 of 58 services linked`. When the project comes from the default path it shows `Server default`, `Browser default`, or `Example project` instead.

## Default project

The editor automatically saves the current project as the default on the Atlas server after every change. New devices and fresh browsers open that project when they have no usable local autosave. There is no manual save or clear action.

The default is stored in the container's `atlas-data` volume and served by the same Atlas instance. That makes it available to every browser and device that opens Atlas, without an account or sync service. It does not overwrite an autosave that already exists in a browser.

The default is separate from autosave:

- If an autosaved project exists, Atlas opens that project and leaves the default alone.
- If no autosaved project exists, Atlas loads the default and shows **Using default project**.
- Loading the default does not immediately create an autosave. The first edit creates one, and that browser keeps its own copy from then on.
- **Load example** and **Start empty** remain explicit actions and do not change the default unless you save the new project as the default.
- Clearing the default does not change the project currently open in the editor.
- `docker compose down` keeps the `atlas-data` volume. `docker compose down -v` removes it. Save JSON if you need a backup outside the volume.

Anyone who can reach the Atlas instance can read the default project and replace it. Keep Atlas on localhost or a trusted LAN. See [Privacy and deployment](/privacy) for the deployment boundary.

## Privacy and limits

The dashboard runs in your browser and asks only the same Atlas server for the default project when no autosave exists. Service links are stored in the project and in `localStorage`, so treat a saved JSON file and the container volume as private when they contain internal addresses.

The dashboard is read-only on purpose. Layout edits, imports, exports, and default management stay in the editor. See [Sharing and backup](/sharing) for transfer and [Privacy and deployment](/privacy) for the deployment boundary.
