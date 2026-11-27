# Editor guide

You enter your devices and services, and Atlas starts with an automatic layout. You can arrange device cards yourself when you need a specific composition. The same project also powers a read-only [dashboard](/dashboard) with clickable service links.

<GuideFigure name="editor" />

## Start from a sample or empty project

Open **File** and choose **Load example** to replace the current project with the included fictional sample, or **Start empty** for a blank project. Atlas asks before doing either one, and you can undo it until you reload the page. **Import project** opens a Homelab Atlas project ZIP, and **Save project** downloads one ZIP containing the project plus every uploaded image. Legacy JSON exports are accepted only for migration; their embedded images are uploaded to Atlas automatically. Every project change is autosaved as the default on the Atlas server for new devices and fresh browsers. See [Dashboard and default project](/dashboard).

## Add and organize devices

Choose **Add device** in the inventory on the left, then pick a template such as Server, NAS, Hypervisor, Media server, AI server, Raspberry Pi, or Cloud server. The Router, Switch, Wi-Fi, and Internet templates add network nodes instead of device cards.

Use **Search inventory** to filter devices by name or role and network nodes by name or kind. It only changes the visible list. Your selection and project stay intact. On a narrow screen, open or close the inventory with the **Inventory** button in the canvas header.

Select a network node to edit its name, kind, accent, and logos. **Logo** starts on Auto, which follows the node kind. **Secondary logo** can show an optional backup provider in the same node. Both selectors include the bundled catalog and uploaded project logos. Choosing Auto or None clears the corresponding explicit choice.

Select a device to open its inspector:

- **Details** covers identity, the **Network / VLAN** label, device icon, and hardware facts
- **Apps** covers named service groups and their services
- **Layout** covers exact X, Y, Width, and Height position fields

The duplicate button copies a device and gives the copy new internal IDs. Use the arrow buttons to reorder devices or services. Deleting a device or network node also deletes its connections.

## Add service tiles

Open the device inspector's **Apps** tab and add a service group. The group-level **Apps** button opens the Add services flow, where you can search the logo catalog and select more than one service. Selections stay checked across searches. Click the logo beside an existing service to replace it without changing its name, count, ID, or position.

Each group can have an optional logo and a name. In the diagram the group name appears to the right of its 32px logo, vertically centered, so the label stays readable. Click a group in the inspector to reveal the **Side by side** checkbox; groups marked this way share a row up to the **Columns** setting in **Diagram appearance**. Side-by-side groups hide the app labels inside their tiles and show only the app logos, so narrow rows stay readable; hover a tile to see its app name. The checkbox is hidden again when you click elsewhere, which keeps the group editor compact.

<GuideFigure name="service-logos" />

Choose **Upload logo** in any picker to add a PNG, JPG, WebP, or SVG file up to 2 MB. Check the preview, edit its name, and choose a transparent, light, or dark background. Uploaded logos are stored as SVG at up to 512px; the source image is rendered into the SVG container. Uploaded logos appear first under **Uploaded** and can be reused throughout the project. In the multi-service picker, uploaded drafts are only saved when selected services are added. Cancel leaves the project unchanged.

You can change a service name and set its instance count from 1 through 99. **Icon size** sets that service's icon from 16 to 64 diagram units in both grid tiles and service rows; very large values are limited by the tile height. **Show name** hides the label and turns the full name into a hover tooltip. Long names are always shown on one line with an ellipsis, and the native tooltip keeps the complete text. **Add custom service** still adds a named tile with the included generic icon.

Groups with one or two services use readable horizontal rows. Groups with three or four services use a compact icon grid, and larger groups use a denser grid. Atlas keeps the service order you set.

## Service links

Each service can have an optional link in the device inspector's **Apps** tab. Leave the field empty for no link, or enter a complete URL beginning with `http://` or `https://`. Links are limited to 2,048 characters and cannot contain spaces. Invalid values are rejected when you leave the field.

Links are used only by the [dashboard](/dashboard). They are stored in project JSON and browser storage, and they are deliberately omitted from SVG and PNG exports. Atlas does not check whether a link is reachable or open it in the background.

## Dashboard and default project

Choose **Dashboard** in the top bar, or open `/dashboard`, for a read-only view of the project saved in this browser. Linked service tiles open in a new tab. The dashboard falls back to the default project saved on the Atlas server when no autosaved project exists, then to the included example. See [Dashboard and default project](/dashboard) for details.

The editor automatically saves the current project as the default on the Atlas server after every change, so new devices and fresh browsers open the latest project. The default is stored separately from each browser's autosave. When you open Atlas and no autosaved project exists, the default loads without immediately creating an autosave; your first edit does.

## App branding

Choose **Diagram settings → App branding** to change the name shown beside the header logo, an optional browser-tab title, and an uploaded app logo. The logo is also used as the browser-tab icon. Atlas accepts PNG, JPG, WebP, SVG, or ICO files up to 2 MB and stores a square PNG up to 128px. **Remove** clears the saved app logo.

Branding is stored in the project JSON (`branding` object), so it travels with the project and its autosaved default. Changing branding edits the open project and creates an autosave, just like any other project change.

The app logo wins in the header and tab. If no app logo is saved, Atlas uses the current project's tab icon, then the default Atlas mark. App branding is never drawn into SVG or PNG exports. See [Dashboard and default project](/dashboard) for the server storage and trust boundary.

## Appearance

Choose **Diagram settings** in the canvas header to change:

- project subtitle
- Navy, Light, or Midnight diagram theme
- 1–4 columns
- Comfortable or Compact density
- themes (background images, custom CSS, and placement)
- project tab icon
- VLAN chip names and colors

Choose **Manage themes** to open the theme gallery. Each theme has its own name, background image, custom CSS, and **Background placement**: **Stage and diagram** (the default) shows the image around the diagram and behind its content, **Stage only** keeps it to the canvas, and **Diagram only** draws it behind devices and cards and into SVG and PNG exports. Background images accept PNG, JPG, WebP, SVG, or ICO up to 10 MB and are stored on the Atlas server. Use **Use** to activate a theme, and **Add**, **Duplicate**, **Edit**, or **Delete** to manage the gallery. **Random background each day** picks one gallery background by date, so the editor and dashboard agree; the active theme still supplies the CSS and placement.

The **Project tab icon** under **Diagram appearance** belongs to the project. Use **Upload tab icon** to give this project its own browser-tab icon. Atlas accepts PNG, JPG, WebP, SVG, or ICO files up to 2 MB and stores a square PNG up to 128px in the project. **Remove** restores the default Atlas mark. The project icon is used when no app logo is saved, appears in the editor and dashboard tabs, and is not drawn into SVG or PNG exports.

The project title is in the top bar. These settings change your diagram. They are separate from the light/dark switch on this documentation site.

## Preview and layout

Use zoom, **Fit page**, or **Fit width** at the bottom left of the canvas to adjust the preview. You can select devices and network nodes in the preview with a pointer or keyboard.

**Focus canvas** at the bottom right hides the inventory and inspector. Select a card or press `Escape` to leave focus view. On mobile, opening **Inventory** also leaves focus view so the drawer is visible.

Automatic layout uses inventory order, column count, content length, and density. Choose **Arrange** in the canvas header to move or resize device cards without moving network nodes or VLANs. Drag a card to move it or use its lower-right handle to resize it. Movement snaps to an 8-unit grid, nearby card edges and centers, and a 24-unit vertical gap. Hold `Alt` while dragging to bypass snapping.

With a card selected in Arrange mode, arrow keys move it by 8 units and `Shift` increases that to 32. `Alt` plus an arrow resizes it. The device inspector's **Layout** tab accepts exact X, Y, Width, and Height values.

**Columns** still controls the poster width. Cards stay inside that width, and their minimum height grows when their hardware or services need more room. A larger height adds whitespace. New or duplicated devices appear below existing manually placed cards. **Auto layout** in the canvas header clears all saved card rectangles; use **Undo** if you change your mind.

Manual positions are part of the project JSON and appear in SVG and PNG exports. Arrange handles, selection outlines, and alignment guides are editor-only.

## Undo and redo

Use the top-bar buttons or:

- Undo: `Ctrl+Z` on Windows/Linux, `Command+Z` on macOS
- Redo: `Ctrl+Shift+Z` on Windows/Linux, `Command+Shift+Z` on macOS

These shortcuts do not run while you are typing in a field. Undo history only lasts for the current page session, and reloading clears it. Read [sharing and backup](/sharing) before importing a project or updating Atlas.
