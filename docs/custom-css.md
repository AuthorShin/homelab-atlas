# Custom CSS guide

Project CSS is plain CSS stored in the project JSON under **Diagram settings → Custom CSS**. It applies to the editor and the dashboard, and is not written into exported SVG or PNG files. The page allows inline styles so your rules can take effect.

## How it is applied

Atlas injects your text into a `<style id="project-css">` element in the page head. It is rebuilt whenever the project changes, so edits appear immediately. Because it is project data, it is saved with browser autosave, exported in project JSON, and sent to Atlas by the server autosave.

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

## Safety and limits

- CSS is limited to 20,000 characters.
- Only CSS text is injected; scripts and HTML are not accepted.
- Content-Security-Policy still blocks remote scripts, frames, and external stylesheets. Use inline rules and same-origin or `data:` images only.
- Custom CSS cannot reach into exported SVG/PNG files. Those exports contain only the diagram markup, without links, favicons, app branding, background, or CSS.

If a rule appears to do nothing, check the selector in your browser's element inspector and confirm you are editing the project you have open. If a rule breaks the layout, remove it or use undo (`Ctrl/Cmd+Z`) to restore the previous CSS text.
