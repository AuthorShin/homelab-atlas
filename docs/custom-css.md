# Custom CSS guide

Theme CSS is plain CSS stored with each theme in the project under **Diagram settings → Manage themes → Edit**. Only the active theme's CSS is applied. It affects the editor and the dashboard, and is not written into exported SVG or PNG files. The page allows inline styles so your rules can take effect.

## How it is applied

Atlas injects the active theme's text into a `<style id="project-css">` element in the page head. It is rebuilt whenever the project changes or a different theme is activated, so edits appear immediately. Because it is project data, themes are saved with browser autosave, included in the saved project ZIP, and sent to Atlas by the server autosave.

Use stable selectors from the editor and dashboard markup:

- `.stage` — the canvas area behind the diagram
- `#canvas` — the editor's scrolling canvas
- `#diagram` — the dashboard diagram container
- `.svg` / `svg` — the rendered diagram
- `.topbar`, `.brand`, `.inspector`, `.rail` — editor chrome
- `.dashboard-notice` — dashboard notice banner

Prefer low-specificity rules and avoid `!important` unless you need to override a built-in rule.

## Examples

Tint the editor canvas:

```css
.stage { background: #101820; }
```

Give the dashboard diagram a soft rounded frame:

```css
#diagram svg { border-radius: 14px; box-shadow: 0 20px 60px #0008; }
```

Hide a piece of editor chrome you do not use:

```css
.inspector .help { display: none; }
```

Highlight a theme-specific element:

```css
.diagram.theme-light .topbar { background: #eef2f8; color: #17212b; }
```

## Device card backgrounds

Each device is a `<g data-device="…">` element in the inline diagram SVG, and its card background is the first `<rect>` inside that group. Use `:first-of-type` so you do not restyle the network and service tiles inside the card:

```css
/* Every device card */
g[data-device] > rect:first-of-type {
  fill: #1b2430;
  stroke: #55d6c9;
  stroke-width: 2;
}
```

Target one device with the ID from `project.json` (for example `dev-storage`):

```css
g[data-device="dev-storage"] > rect:first-of-type {
  fill: #2a1f3d;
}
```

The same rule works in the editor and the dashboard because both render the diagram as inline SVG. The theme sets the default `fill` and `stroke` as attributes, and these CSS declarations override them. Device IDs are stable in the project, so the rule survives renames and moves. Use the browser element inspector if you are not sure which card is which, or open the saved project ZIP and read `project.json`.

## Safety and limits

- CSS is limited to 20,000 characters per theme and 120,000 across all themes.
- Only CSS text is injected; scripts and HTML are not accepted.
- Content-Security-Policy still blocks remote scripts, frames, and external stylesheets. Use inline rules and same-origin or `data:` images only.
- Custom CSS cannot reach into exported SVG/PNG files. Those exports contain only the diagram markup, without links, favicons, app branding, or CSS. The active theme's background image (or today's random pick) is drawn into the exported SVG when **Background placement** includes the diagram, but CSS is not.

If a rule appears to do nothing, check the selector in your browser's element inspector and confirm you are editing the project you have open. If a rule breaks the layout, remove it or use undo (`Ctrl/Cmd+Z`) to restore the previous CSS text.
