# FAQ

Short answers to common setup, dashboard, storage, and layout questions. See [Troubleshooting](/troubleshooting) for a symptom checklist.

## Getting started

### What do I need to make a diagram?

A running Atlas server and a current browser. There is no account, AI service, scanner, collector, or external API to configure. See [Getting started](/getting-started).

### Can Atlas discover devices or services automatically?

No. Atlas only shows what you add manually or load from a project file. There is no discovery, scanning, Docker inventory, or network probing. See [Networking](/networking).

### Why is my project empty after changing the URL or updating Atlas?

Autosave belongs to the browser origin: protocol, hostname, and port. Use the same browser profile and origin, or import a JSON backup. Atlas does not synchronize autosaved edits; the optional default project is the only project data stored in the container volume. See [trusted LAN access](/getting-started#trusted-lan-access) and [sharing and backup](/sharing).

### Why can’t I find or upload a custom logo?

Search filters the current catalog; clear it to see every tile. Uploads must be PNG, JPG, WebP, or safe SVG, at most 2 MB, 4096px per side, and 16 million pixels. Atlas converts them to PNG at up to 512px. See [Add service tiles](/editor#add-service-tiles) and [Troubleshooting](/troubleshooting).

### Why was my project import rejected?

The whole file must pass schema and reference validation before Atlas replaces the open project. Check its size, schema version, IDs, logos, connections, service links, and favicon. Version-8 files cannot contain a `discovery` field. The current project stays unchanged after rejection. See [Import validation details](/troubleshooting#import-validation-details).

## Dashboard and service links

### How do I open the dashboard?

Choose **Dashboard** in the editor's top bar, or open `/dashboard` on the same host and port. The dashboard is read-only and uses the project saved in the current browser, or the shared default when this browser has no autosave. See [Dashboard and default project](/dashboard).

### Why is a service tile not clickable?

A tile becomes a link only when its service has a valid `http://` or `https://` URL. Check the **Apps** tab in the editor. Empty, bare-hostname, relative, and non-HTTP links are not used.

### Do service links appear in SVG or PNG exports?

No. Links are dashboard-only. SVG and PNG exports contain the diagram and never embed the URLs. Saved JSON and browser storage do contain them. See [Exporting](/exporting).

### Does Atlas check whether a link is online?

No. The dashboard does not probe, proxy, or preload a link. It opens the URL only when you select the tile, in a new tab with no referrer. Availability depends on your network and the target service.

### Why does the dashboard show the example or the default project?

If this browser origin has no autosaved project, the dashboard falls back to the default project saved on the Atlas server, then to an older browser default, then to the included example. The top bar and notice identify which source is shown.

### How do I choose a starting project?

Open the project in the editor and choose **File → Save as default project**. Any browser or device that opens this Atlas server without an autosave loads it. **File → Clear default project** removes it without changing the project currently open. Each browser keeps its own autosave, which takes precedence over the default.

### Does the dashboard work on my phone or another computer?

Yes. A new device or fresh browser profile opens the default project saved on the Atlas server. A browser that already has an autosave keeps that copy. Use **File → Save project** and **Import project** when you want to move a project that already has local edits. See [Sharing and backup](/sharing).

### Can I safely share a project that has service links?

Treat it as private when the links contain internal hostnames or admin paths. Links never enter image exports, but they remain in saved JSON and browser storage. Use the Export privacy filter for diagram text, and review JSON before sharing it.

## Layout and saving

### Why did Undo stop working after a reload?

Undo history lasts only for the current page session. Save project JSON for durable editing and backup. Reloading clears the history.

### Does private export remove every secret? {#private-export-limits}

No. Image filtering hides recognized addresses, URLs, emails, and literal custom terms. Add private hostnames explicitly. Text baked into uploaded logos is unchanged, service links are not part of images, and editable JSON always retains the full facts. Inspect the preview and keep JSON private; see [Exporting](/exporting).
