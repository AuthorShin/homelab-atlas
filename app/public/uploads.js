export const UPLOAD_ENDPOINT = '/api/uploads';
export const UPLOAD_WRITE_HEADER = 'X-Atlas-Upload';
export const UPLOAD_LIMITS = Object.freeze({
  bytes: 2_000_000,
  referenceChars: 1_200_000,
});

const UPLOAD_PATH_RE = /^\/api\/uploads\/[0-9a-f]{64}\.(?:png|jpg|webp|svg|ico)$/u;
const IMAGE_DATA_RE = /^data:image\/(?:png|jpeg|webp|svg\+xml|gif);base64,[A-Za-z0-9+/]+={0,2}$/u;
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

async function uploadBlob(blob, { mime, fetcher = globalThis.fetch } = {}) {
  if (!blob || !blob.size) throw new Error('Choose an image file.');
  if (blob.size > UPLOAD_LIMITS.bytes) throw new Error('Image files must be 2 MB or smaller.');
  if (!mime) throw new Error('Choose a PNG, JPG, WebP, SVG, or ICO file.');
  if (typeof fetcher !== 'function') throw new Error('Image uploads are unavailable.');
  const response = await fetcher(UPLOAD_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': mime,
      [UPLOAD_WRITE_HEADER]: '1',
    },
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

export async function uploadImageFile(file, { fetcher = globalThis.fetch } = {}) {
  if (!file || typeof file.size !== 'number' || !file.size) throw new Error('Choose an image file.');
  if (file.size > UPLOAD_LIMITS.bytes) throw new Error('Image files must be 2 MB or smaller.');
  const mime = normalizeMime(file.type, file.name);
  return uploadBlob(file, { mime, fetcher });
}

export async function uploadDataUrl(dataUrl, filename = 'image.png', { fetcher = globalThis.fetch } = {}) {
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
  return uploadBlob(blob, { mime, fetcher });
}

export async function migrateEmbeddedImages(project, { fetcher = globalThis.fetch } = {}) {
  const clone = structuredClone(project);
  const targets = [];
  const add = (object, key, filename) => {
    const value = object?.[key];
    if (typeof value === 'string' && value && !isUploadReference(value) && DATA_URL_RE.test(value)) targets.push({ object, key, filename });
  };
  add(clone, 'favicon', 'favicon.png');
  add(clone, 'background', 'background.png');
  add(clone.branding, 'favicon', 'app-logo.png');
  for (const logo of clone.customLogos || []) add(logo, 'dataUrl', `${logo.id}.png`);
  for (const device of clone.devices || []) for (const group of device.groups || []) add(group, 'logo', 'group-logo.png');
  for (const target of targets) target.object[target.key] = await uploadDataUrl(target.object[target.key], target.filename, { fetcher });
  return clone;
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
  if (isUploadReference(clone.background)) references.add(clone.background);
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
  if (dataUrls.has(clone.background)) clone.background = dataUrls.get(clone.background);
  if (dataUrls.has(clone.favicon)) clone.favicon = dataUrls.get(clone.favicon);
  if (dataUrls.has(clone.branding?.favicon)) clone.branding.favicon = dataUrls.get(clone.branding.favicon);
  for (const logo of clone.customLogos || []) if (dataUrls.has(logo.dataUrl)) logo.dataUrl = dataUrls.get(logo.dataUrl);
  for (const device of clone.devices || []) {
    for (const group of device.groups || []) if (dataUrls.has(group.logo)) group.logo = dataUrls.get(group.logo);
  }
  return clone;
}
