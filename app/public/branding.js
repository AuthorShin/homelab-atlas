import { applyDocumentFavicon, validateFaviconDataUrl } from './favicon.js';

export const BRANDING_ENDPOINT = '/api/branding';
export const BRANDING_WRITE_HEADER = 'X-Atlas-Branding';
export const BRANDING_LIMITS = Object.freeze({
  name: 60,
  tabTitle: 80,
});
export const DEFAULT_BRANDING = Object.freeze({
  name: 'Homelab Atlas',
  tabTitle: '',
  favicon: '',
});

const KEYS = ['name', 'tabTitle', 'favicon'];
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f]/;

function brandingFaviconError(error) {
  const message = error instanceof Error ? error.message : 'The app logo is invalid.';
  return new Error(message.replace(/^Favicon\b/, 'App logo'));
}

export function normalizeBranding(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('App branding must be an object.');
  if (Object.keys(value).some(key => !KEYS.includes(key))) throw new Error('App branding has an invalid structure.');
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!name) throw new Error('An app name is required.');
  if ([...name].length > BRANDING_LIMITS.name) throw new Error(`The app name must be ${BRANDING_LIMITS.name} characters or fewer.`);
  if (CONTROL_RE.test(name)) throw new Error('The app name contains unsupported control characters.');
  const tabTitle = typeof value.tabTitle === 'string' ? value.tabTitle.trim() : '';
  if ([...tabTitle].length > BRANDING_LIMITS.tabTitle) throw new Error(`The browser tab title must be ${BRANDING_LIMITS.tabTitle} characters or fewer.`);
  if (CONTROL_RE.test(tabTitle)) throw new Error('The browser tab title contains unsupported control characters.');
  const favicon = value.favicon === undefined ? '' : value.favicon;
  if (typeof favicon !== 'string') throw new Error('The app logo must be empty, a PNG data URL, or an Atlas PNG upload.');
  try {
    validateFaviconDataUrl(favicon, { allowSVG: true });
  } catch (error) {
    throw brandingFaviconError(error);
  }
  return { name, tabTitle, favicon };
}

export function effectiveBrandLogo(branding, projectFavicon = '') {
  if (typeof branding?.favicon === 'string' && branding.favicon) return branding.favicon;
  return typeof projectFavicon === 'string' ? projectFavicon : '';
}

export function brandingTabTitle(branding, { projectTitle = '', dashboard = false } = {}) {
  const name = branding?.name || DEFAULT_BRANDING.name;
  const custom = typeof branding?.tabTitle === 'string' ? branding.tabTitle.trim() : '';
  if (custom) return dashboard && projectTitle ? `${projectTitle} · ${custom}` : custom;
  if (dashboard) return projectTitle ? `${projectTitle} · ${name} Dashboard` : `${name} Dashboard`;
  return name;
}

export function applyBranding(branding, {
  projectFavicon = '',
  projectTitle = '',
  dashboard = false,
  brandLabel = '',
  document: documentRef = globalThis.document,
} = {}) {
  const normalized = normalizeBranding(branding || DEFAULT_BRANDING);
  const logo = effectiveBrandLogo(normalized, projectFavicon);
  if (!documentRef) return { branding: normalized, logo };
  const brand = documentRef.querySelector?.('.brand');
  if (brand) brand.setAttribute('aria-label', brandLabel || `${normalized.name} home`);
  const nameNode = documentRef.querySelector?.('[data-brand-name]');
  if (nameNode) nameNode.textContent = normalized.name;
  const mark = documentRef.querySelector?.('[data-brand-mark]');
  if (mark) {
    mark.classList.toggle('has-logo', Boolean(logo));
    mark.style.backgroundImage = logo ? `url("${logo}")` : '';
  }
  applyDocumentFavicon(logo, documentRef);
  documentRef.title = brandingTabTitle(normalized, { projectTitle, dashboard });
  return { branding: normalized, logo };
}

function errorMessage(error) {
  return error instanceof Error ? error.message : 'App branding could not be read.';
}

async function responseDetail(response) {
  try {
    return (await response.text()).trim();
  } catch {
    return '';
  }
}

async function requestBranding(fetcher, options) {
  if (typeof fetcher !== 'function') throw new Error('App branding storage is unavailable.');
  return fetcher(BRANDING_ENDPOINT, { cache: 'no-store', ...options });
}

export async function fetchServerBranding(fetcher = globalThis.fetch) {
  const response = await requestBranding(fetcher, {
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const detail = await responseDetail(response);
    throw new Error(detail || `App branding could not be loaded (HTTP ${response.status}).`);
  }
  const text = await response.text();
  try {
    return normalizeBranding(JSON.parse(text));
  } catch (error) {
    throw new Error(`App branding could not be read: ${errorMessage(error)}`);
  }
}

export async function saveServerBranding(branding, fetcher = globalThis.fetch) {
  const body = JSON.stringify(normalizeBranding(branding));
  const response = await requestBranding(fetcher, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      [BRANDING_WRITE_HEADER]: '1',
    },
    body,
  });
  if (response.status === 204) return;
  const detail = await responseDetail(response);
  throw new Error(detail || `App branding could not be saved (HTTP ${response.status}).`);
}

export async function clearServerBranding(fetcher = globalThis.fetch) {
  const response = await requestBranding(fetcher, {
    method: 'DELETE',
    headers: { [BRANDING_WRITE_HEADER]: '1' },
  });
  if (response.status === 204 || response.status === 404) return;
  const detail = await responseDetail(response);
  throw new Error(detail || `App branding could not be cleared (HTTP ${response.status}).`);
}
