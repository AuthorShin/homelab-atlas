import { parseProject, sampleProject } from './model.js';

export const PROJECT_STORAGE_KEY = 'homelab-atlas.project';
export const DEFAULT_PROJECT_STORAGE_KEY = 'homelab-atlas.default-project';
export const DEFAULT_PROJECT_ENDPOINT = '/api/default-project';
export const DEFAULT_PROJECT_WRITE_HEADER = 'X-Atlas-Default';

export function decodeProjectRecord(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  const record = JSON.parse(raw);
  if (!record || typeof record.data !== 'string') throw new Error('The saved project record is incomplete.');
  return parseProject(record.data);
}

export function isSampleProject(project) {
  try {
    return JSON.stringify(project) === JSON.stringify(sampleProject());
  } catch {
    return false;
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : 'The saved project could not be read.';
}

async function responseDetail(response) {
  try {
    return (await response.text()).trim();
  } catch {
    return '';
  }
}

async function requestDefaultProject(fetcher, options) {
  if (typeof fetcher !== 'function') throw new Error('Default project loading is unavailable.');
  return fetcher(DEFAULT_PROJECT_ENDPOINT, { cache: 'no-store', ...options });
}

export async function fetchServerDefaultProject(fetcher = globalThis.fetch) {
  const response = await requestDefaultProject(fetcher, {
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const detail = await responseDetail(response);
    throw new Error(detail || `The default project could not be loaded (HTTP ${response.status}).`);
  }
  return parseProject(await response.text());
}

export async function fetchServerDefaultAvailable(fetcher = globalThis.fetch) {
  const response = await requestDefaultProject(fetcher, { method: 'HEAD' });
  if (response.status === 404 || response.status === 503) return false;
  if (response.ok) return true;
  const detail = await responseDetail(response);
  throw new Error(detail || `The default project could not be checked (HTTP ${response.status}).`);
}

export async function saveServerDefaultProject(project, fetcher = globalThis.fetch) {
  const body = JSON.stringify(project);
  if (!body) throw new Error('This project could not be saved.');
  const response = await requestDefaultProject(fetcher, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      [DEFAULT_PROJECT_WRITE_HEADER]: '1',
    },
    body,
  });
  if (response.status === 204) return;
  const detail = await responseDetail(response);
  throw new Error(detail || `The default project could not be saved (HTTP ${response.status}).`);
}

export async function clearServerDefaultProject(fetcher = globalThis.fetch) {
  const response = await requestDefaultProject(fetcher, {
    method: 'DELETE',
    headers: { [DEFAULT_PROJECT_WRITE_HEADER]: '1' },
  });
  if (response.status === 204 || response.status === 404) return;
  const detail = await responseDetail(response);
  throw new Error(detail || `The default project could not be cleared (HTTP ${response.status}).`);
}

export async function resolveStoredProject(savedRaw = null, browserDefaultRaw = null, fetcher = globalThis.fetch) {
  if (typeof savedRaw === 'string' && savedRaw) {
    try {
      const project = decodeProjectRecord(savedRaw);
      if (!isSampleProject(project)) return { project, source: 'saved' };
    } catch (error) {
      return { project: sampleProject(), source: 'error', error: errorMessage(error) };
    }
  }
  let serverError = null;
  try {
    const project = await fetchServerDefaultProject(fetcher);
    if (project) return { project, source: 'server-default' };
  } catch (error) {
    serverError = errorMessage(error);
  }
  if (typeof browserDefaultRaw === 'string' && browserDefaultRaw) {
    try {
      const project = decodeProjectRecord(browserDefaultRaw);
      return { project, source: 'default', ...(serverError ? { serverError } : {}) };
    } catch (error) {
      return { project: sampleProject(), source: 'default-error', error: errorMessage(error), ...(serverError ? { serverError } : {}) };
    }
  }
  return { project: sampleProject(), source: 'sample', ...(serverError ? { serverError } : {}) };
}

export function decodeStoredProject(raw, defaultRaw = null) {
  if (typeof raw === 'string' && raw) {
    try {
      return { project: decodeProjectRecord(raw), source: 'saved' };
    } catch (error) {
      return { project: sampleProject(), source: 'error', error: errorMessage(error) };
    }
  }
  if (typeof defaultRaw === 'string' && defaultRaw) {
    try {
      return { project: decodeProjectRecord(defaultRaw), source: 'default' };
    } catch (error) {
      return { project: sampleProject(), source: 'error', error: `The browser default project could not be read. ${errorMessage(error)}` };
    }
  }
  return { project: sampleProject(), source: 'sample' };
}
