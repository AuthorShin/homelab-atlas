import { effectiveAppearance } from './model.js';

const PROJECT_STYLE_ID = 'project-css';

export function applyProjectAppearance(project, { document: documentRef = globalThis.document } = {}) {
  if (!documentRef) return;
  let style = documentRef.getElementById(PROJECT_STYLE_ID);
  if (!style) {
    style = documentRef.createElement('style');
    style.id = PROJECT_STYLE_ID;
    documentRef.head.append(style);
  }
  const appearance = effectiveAppearance(project);
  style.textContent = appearance.css;
  const background = appearance.background.trim();
  const scope = appearance.scope;
  const stageBackground = Boolean(background) && scope !== 'diagram';
  const root = documentRef.documentElement;
  if (stageBackground) root.style.setProperty('--project-background-image', `url("${background.replace(/["\\\n\r]/gu, '')}")`);
  else root.style.removeProperty('--project-background-image');
  documentRef.body?.classList.toggle('has-project-background', stageBackground);
}
