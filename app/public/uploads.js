export const UPLOAD_ENDPOINT = '/api/uploads';
export const UPLOAD_WRITE_HEADER = 'X-Atlas-Upload';
export const UPLOAD_KIND_HEADER = 'X-Atlas-Upload-Kind';
export const VECTORIZE_ENDPOINT = '/api/vectorize';
export const VECTORIZE_JOBS_ENDPOINT = '/api/vectorize/jobs';
export const UPLOAD_LIMITS = Object.freeze({
  bytes: 2_000_000,
  backgroundBytes: 10_000_000,
  referenceChars: 1_200_000,
});

const UPLOAD_PATH_RE = /^\/api\/uploads\/[0-9a-f]{64}\.(?:png|jpg|webp|svg|ico)$/u;
const IMAGE_DATA_RE = /^data:image\/(?:png|jpeg|webp|svg\+xml|gif|x-icon|vnd\.microsoft\.icon);base64,[A-Za-z0-9+/]+={0,2}$/u;
const DATA_URL_RE = /^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/u;
const EXTENSION_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
};
const ACCEPTED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon']);

export function isUploadReference(value, extension = '') {
  return typeof value === 'string' && UPLOAD_PATH_RE.test(value) && (!extension || value.endsWith(extension));
}

export function isImageReference(value, maxChars = UPLOAD_LIMITS.referenceChars) {
  return value === '' || (typeof value === 'string'
    && value.length <= maxChars
    && (isUploadReference(value) || IMAGE_DATA_RE.test(value)));
}

function normalizeMime(type, name = '') {
  let mime = String(type || '').toLowerCase();
  if (mime === 'image/jpg') mime = 'image/jpeg';
  if (mime === 'image/vnd.microsoft.icon') mime = 'image/x-icon';
  if (!mime) mime = EXTENSION_MIME[String(name).split('.').pop().toLowerCase()] || '';
  return ACCEPTED_MIME.has(mime) ? mime : '';
}

async function responseDetail(response) {
  try {
    return (await response.text()).trim();
  } catch {
    return '';
  }
}

export async function uploadBlob(blob, { mime, maxBytes = UPLOAD_LIMITS.bytes, kind = '', fetcher = globalThis.fetch } = {}) {
  if (!blob || !blob.size) throw new Error('Choose an image file.');
  if (blob.size > maxBytes) throw new Error(`Image files must be ${Math.round(maxBytes / 1_000_000)} MB or smaller.`);
  if (!mime) throw new Error('Choose a PNG, JPG, WebP, SVG, or ICO file.');
  if (typeof fetcher !== 'function') throw new Error('Image uploads are unavailable.');
  const headers = {
    'Content-Type': mime,
    [UPLOAD_WRITE_HEADER]: '1',
  };
  if (kind) headers[UPLOAD_KIND_HEADER] = kind;
  const response = await fetcher(UPLOAD_ENDPOINT, {
    method: 'POST',
    headers,
    body: blob,
  });
  const text = await responseDetail(response);
  if (!response.ok) throw new Error(text || `Image upload failed (HTTP ${response.status}).`);
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('Image upload response was not valid JSON.');
  }
  if (!isUploadReference(payload?.url)) throw new Error('Image upload response did not include a valid Atlas upload URL.');
  return payload.url;
}

export async function uploadImageFile(file, { maxBytes = UPLOAD_LIMITS.bytes, kind = '', fetcher = globalThis.fetch } = {}) {
  if (!file || typeof file.size !== 'number' || !file.size) throw new Error('Choose an image file.');
  if (file.size > maxBytes) throw new Error(`Image files must be ${Math.round(maxBytes / 1_000_000)} MB or smaller.`);
  const mime = normalizeMime(file.type, file.name);
  return uploadBlob(file, { mime, maxBytes, kind, fetcher });
}

export async function uploadDataUrl(dataUrl, filename = 'image.png', { maxBytes = UPLOAD_LIMITS.bytes, kind = '', fetcher = globalThis.fetch } = {}) {
  const match = DATA_URL_RE.exec(typeof dataUrl === 'string' ? dataUrl : '');
  if (!match) throw new Error('Image data could not be uploaded.');
  const mime = normalizeMime(match[1], filename);
  if (!mime) throw new Error('Choose a PNG, JPG, WebP, SVG, or ICO file.');
  let binary;
  try {
    binary = atob(match[2]);
  } catch {
    throw new Error('Image data could not be uploaded.');
  }
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime });
  return uploadBlob(blob, { mime, maxBytes, kind, fetcher });
}

export async function createVectorizeJob(payload, { fetcher = globalThis.fetch } = {}) {
  if (typeof fetcher !== 'function') throw new Error('Image vectorization is unavailable.');
  const response = await fetcher(VECTORIZE_JOBS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [UPLOAD_WRITE_HEADER]: '1',
    },
    body: JSON.stringify(payload),
  });
  const text = await responseDetail(response);
  if (!response.ok) throw new Error(text || `Image vectorization failed (HTTP ${response.status}).`);
  let result;
  try { result = JSON.parse(text); } catch { throw new Error('Image vectorization response was not valid JSON.'); }
  if (typeof result?.id !== 'string' || !result.id) throw new Error('Image vectorization did not return a job ID.');
  return result.id;
}

export async function getVectorizeJob(id, { fetcher = globalThis.fetch } = {}) {
  const response = await fetcher(`${VECTORIZE_JOBS_ENDPOINT}/${encodeURIComponent(id)}`, {
    headers: { [UPLOAD_WRITE_HEADER]: '1' },
  });
  const text = await responseDetail(response);
  if (!response.ok) throw new Error(text || `Vectorization status failed (HTTP ${response.status}).`);
  return JSON.parse(text);
}

export async function waitForVectorizeJob(id, { onStatus = () => {}, interval = 500, timeout = 180000, fetcher = globalThis.fetch } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const job = await getVectorizeJob(id, { fetcher });
    onStatus(job);
    if (job.status === 'done') {
      if (!isUploadReference(job.url, '.svg')) throw new Error('Image vectorization did not return a valid Atlas upload URL.');
      return job.url;
    }
    if (job.status === 'failed') throw new Error(job.error || 'Image vectorization failed.');
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error('Image vectorization timed out.');
}

async function requestVectorization(payload, fetcher) {
  if (typeof fetcher !== 'function') throw new Error('Image vectorization is unavailable.');
  const response = await fetcher(VECTORIZE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [UPLOAD_WRITE_HEADER]: '1',
    },
    body: JSON.stringify(payload),
  });
  const text = await responseDetail(response);
  if (!response.ok) throw new Error(text || `Image vectorization failed (HTTP ${response.status}).`);
  let result;
  try { result = JSON.parse(text); } catch { throw new Error('Image vectorization response was not valid JSON.'); }
  if (!isUploadReference(result?.url, '.svg')) throw new Error('Image vectorization did not return a valid Atlas upload URL.');
  return result.url;
}

export async function vectorizeUploadReference(reference, { fetcher = globalThis.fetch } = {}) {
  if (!isUploadReference(reference) || reference.endsWith('.svg')) return reference;
  return requestVectorization({ url: reference }, fetcher);
}

export async function vectorizeDataUrl(dataUrl, { fetcher = globalThis.fetch } = {}) {
  if (!IMAGE_DATA_RE.test(dataUrl) || dataUrl.startsWith('data:image/svg+xml')) return dataUrl;
  return requestVectorization({ data: dataUrl }, fetcher);
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Uploaded image could not be read.'));
    reader.readAsDataURL(blob);
  });
}

export async function inlineUploadReferences(project, { fetcher = globalThis.fetch } = {}) {
  if (typeof fetcher !== 'function') throw new Error('Uploaded images cannot be loaded.');
  const clone = structuredClone(project);
  const references = new Set();
  for (const theme of clone.themes || []) if (isUploadReference(theme.background)) references.add(theme.background);
  if (isUploadReference(clone.favicon)) references.add(clone.favicon);
  if (isUploadReference(clone.branding?.favicon)) references.add(clone.branding.favicon);
  for (const logo of clone.customLogos || []) if (isUploadReference(logo.dataUrl)) references.add(logo.dataUrl);
  for (const device of clone.devices || []) {
    for (const group of device.groups || []) if (isUploadReference(group.logo)) references.add(group.logo);
  }
  if (!references.size) return clone;
  const dataUrls = new Map();
  await Promise.all([...references].map(async reference => {
    const response = await fetcher(reference, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Uploaded image could not be loaded for export (HTTP ${response.status}).`);
    dataUrls.set(reference, await readBlobAsDataUrl(await response.blob()));
  }));
  for (const theme of clone.themes || []) if (dataUrls.has(theme.background)) theme.background = dataUrls.get(theme.background);
  if (dataUrls.has(clone.favicon)) clone.favicon = dataUrls.get(clone.favicon);
  if (dataUrls.has(clone.branding?.favicon)) clone.branding.favicon = dataUrls.get(clone.branding.favicon);
  for (const logo of clone.customLogos || []) if (dataUrls.has(logo.dataUrl)) logo.dataUrl = dataUrls.get(logo.dataUrl);
  for (const device of clone.devices || []) {
    for (const group of device.groups || []) if (dataUrls.has(group.logo)) group.logo = dataUrls.get(group.logo);
  }
  return clone;
}
