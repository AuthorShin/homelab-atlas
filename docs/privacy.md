# Privacy and deployment

Atlas runs on your own machine, but you still need to think about where you expose it and what you type into it.

## Where your data goes {#data-flow}

The editor and dashboard have:

- no accounts or login
- no database and no background sync
- no telemetry, analytics, external fonts, or AI calls
- no background polling or network discovery
- a local bundled logo catalog

The Go process serves embedded editor and dashboard files. Your working project stays in the browser's `localStorage`. The only server-side project data is the optional default project stored in the `atlas-data` volume so new devices can load it. The same volume stores the optional app name, tab title, and logo used across devices. Atlas creates JSON or image files only when you choose to download them. Service links are opened only when you select a linked tile on the dashboard.

## Browser and server storage

Autosave and the older browser-default fallback use `localStorage` on the current browser origin. The browser keeps separate storage for each hostname, port, protocol, and profile. Clearing site data removes the autosaved project and any older browser default.

The default project saved with **File → Save as default project** is different: it is written to the container's `atlas-data` volume and shared by every browser and device that opens this Atlas instance. It is used only when a browser has no autosaved project. It can contain the same inventory and private service URLs as any other saved project. Anyone who can reach Atlas can read and replace it.

App branding is separate from project data. It is stored in `branding.json` in the same `atlas-data` volume and read by the editor and dashboard on load. It contains only the app name, optional tab title, and a PNG data URL for the logo. Changing it does not send or replace the current project.

The server does not receive autosaved edits, and it does not synchronize open editors. Each browser's autosave stays local.

## Documentation is separate

This GitHub Pages site only hosts the documentation. It does not run the editor or dashboard and cannot read or edit the project in your browser. GitHub handles its own hosting and access logs under its policies.

## Where to run it {#deployment-boundary}

Run the app on localhost or a LAN you trust. Atlas has no login screen, user roles, or built-in TLS. There is no API token or discovery endpoint to configure. The APIs are the default-project and app-branding endpoints, and neither is authenticated. Do not put Atlas directly on the public internet.

If you bind Compose to `0.0.0.0`, anyone who can reach port 8080 can open the editor, read or replace the shared default project, and read or replace app branding. Each browser still has its own autosave, but the app itself has no authentication. Keep the default localhost binding unless you need access from a trusted LAN, and use a reverse proxy with authentication if you need stronger protection.

## Before you share {#content-and-sharing}

Atlas only sees what you type or load from a project file. The SVG and PNG Export dialog hides IP addresses, MAC addresses, URLs, and emails by default. You can list custom hostnames, domains, or other names as literal terms. The preview shows the filtered result before download. Service links never appear in SVG or PNG exports, even when they are present in the dashboard.

That filter does not make a diagram anonymous. It does not guess which arbitrary names are private, inspect text baked into uploaded logos, filter screenshots, or change saved JSON. Before sharing any file, still check for:

- addresses, hostnames, and private domains
- device roles or hardware details
- VLAN and relationship labels
- service names that reveal sensitive capabilities
- private service links in saved JSON

The documentation screenshots use a fictional sample. See [sharing and backup](/sharing) for details about each file format.
