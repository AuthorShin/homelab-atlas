import { parseProject } from './model.js';
import { verifyCustomLogoDecodes } from './custom-logos.js';
import { UPLOAD_LIMITS, isImageReference, isUploadReference, uploadBlob, uploadDataUrl } from './uploads.js';

export const PROJECT_ZIP_ENTRY = 'project.json';
export const PROJECT_ZIP_MANIFEST = 'manifest.json';
export const PROJECT_ZIP_UPLOADS = 'uploads/';
export const PROJECT_ZIP_FORMAT = 'homelab-atlas-project';
export const PROJECT_ZIP_LIMITS = Object.freeze({
  bytes: 32_000_000,
  entries: 256,
  entryBytes: 12_000_000,
  totalBytes: 32_000_000,
  projectBytes: 2_000_000,
});

const LOCAL_FILE = 0x04034b50;
const CENTRAL_FILE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const UTF8_FLAG = 0x0800;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MIME_BY_EXTENSION = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time: time & 0xffff, date: day & 0xffff };
}

function safeEntryName(name) {
  if (typeof name !== 'string' || !name || name.length > 200) throw new Error('The project ZIP contains an invalid file name.');
  if (name.startsWith('/') || name.includes('\\') || name.includes('\0') || name.split('/').includes('..')) throw new Error('The project ZIP contains an unsafe file name.');
  return name;
}

export function createProjectZip(entries, date = new Date()) {
  const files = entries.map(entry => ({ name: safeEntryName(entry.name), data: entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data) }));
  const seen = new Set();
  for (const file of files) {
    if (seen.has(file.name)) throw new Error(`The project ZIP contains ${file.name} twice.`);
    seen.add(file.name);
  }
  const stamp = dosDateTime(date);
  let localSize = 0;
  let centralSize = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    localSize += 30 + name.length + file.data.length;
    centralSize += 46 + name.length;
  }
  const total = localSize + centralSize + 22;
  const output = new Uint8Array(total);
  const view = new DataView(output.buffer);
  let offset = 0;
  const central = [];
  for (const file of files) {
    const name = encoder.encode(file.name);
    const checksum = crc32(file.data);
    const localOffset = offset;
    view.setUint32(offset, LOCAL_FILE, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, UTF8_FLAG, true);
    view.setUint16(offset + 8, 0, true);
    view.setUint16(offset + 10, stamp.time, true);
    view.setUint16(offset + 12, stamp.date, true);
    view.setUint32(offset + 14, checksum, true);
    view.setUint32(offset + 18, file.data.length, true);
    view.setUint32(offset + 22, file.data.length, true);
    view.setUint16(offset + 26, name.length, true);
    view.setUint16(offset + 28, 0, true);
    output.set(name, offset + 30);
    output.set(file.data, offset + 30 + name.length);
    offset += 30 + name.length + file.data.length;
    central.push({ name, checksum, size: file.data.length, localOffset });
  }
  const centralOffset = offset;
  for (const file of central) {
    view.setUint32(offset, CENTRAL_FILE, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 20, true);
    view.setUint16(offset + 8, UTF8_FLAG, true);
    view.setUint16(offset + 10, 0, true);
    view.setUint16(offset + 12, stamp.time, true);
    view.setUint16(offset + 14, stamp.date, true);
    view.setUint32(offset + 16, file.checksum, true);
    view.setUint32(offset + 20, file.size, true);
    view.setUint32(offset + 24, file.size, true);
    view.setUint16(offset + 28, file.name.length, true);
    view.setUint16(offset + 30, 0, true);
    view.setUint16(offset + 32, 0, true);
    view.setUint16(offset + 34, 0, true);
    view.setUint16(offset + 36, 0, true);
    view.setUint32(offset + 38, 0, true);
    view.setUint32(offset + 42, file.localOffset, true);
    output.set(file.name, offset + 46);
    offset += 46 + file.name.length;
  }
  view.setUint32(offset, END_OF_CENTRAL_DIRECTORY, true);
  view.setUint16(offset + 4, 0, true);
  view.setUint16(offset + 6, 0, true);
  view.setUint16(offset + 8, central.length, true);
  view.setUint16(offset + 10, central.length, true);
  view.setUint32(offset + 12, centralSize, true);
  view.setUint32(offset + 16, centralOffset, true);
  view.setUint16(offset + 20, 0, true);
  return new Blob([output], { type: 'application/zip' });
}

function findEndOfCentralDirectory(view) {
  const minimum = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY) return offset;
  }
  throw new Error('This file is not a readable ZIP archive.');
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot read compressed ZIP archives. Save the project with Homelab Atlas or re-zip it without compression.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readProjectZip(bytes) {
  if (!(bytes instanceof Uint8Array) || !bytes.length) throw new Error('Choose a Homelab Atlas ZIP project.');
  if (bytes.length > PROJECT_ZIP_LIMITS.bytes) throw new Error('Project ZIPs must be 32 MB or smaller.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = findEndOfCentralDirectory(view);
  const count = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  const centralOffset = view.getUint32(end + 16, true);
  if (!count || count > PROJECT_ZIP_LIMITS.entries) throw new Error('The project ZIP contains too many files.');
  if (centralOffset + centralSize > end) throw new Error('The project ZIP central directory is invalid.');
  const entries = new Map();
  let total = 0;
  let offset = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > end || view.getUint32(offset, true) !== CENTRAL_FILE) throw new Error('The project ZIP central directory is invalid.');
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const checksum = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = safeEntryName(decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)));
    if (entries.has(name)) throw new Error(`The project ZIP contains ${name} twice.`);
    if (uncompressedSize > PROJECT_ZIP_LIMITS.entryBytes) throw new Error(`${name} is too large to import.`);
    total += uncompressedSize;
    if (total > PROJECT_ZIP_LIMITS.totalBytes) throw new Error('The project ZIP expands to more than 32 MB.');
    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== LOCAL_FILE) throw new Error(`The project ZIP entry ${name} is invalid.`);
    if (flags & 0x0001) throw new Error('Encrypted ZIP entries are not supported.');
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    if (dataStart + compressedSize > bytes.length) throw new Error(`The project ZIP entry ${name} is truncated.`);
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    let data;
    if (method === 0) data = compressed;
    else if (method === 8) data = await inflateRaw(compressed);
    else throw new Error(`The project ZIP uses unsupported compression for ${name}.`);
    if (data.length !== uncompressedSize) throw new Error(`The project ZIP entry ${name} has the wrong size.`);
    if (crc32(data) !== checksum) throw new Error(`The project ZIP entry ${name} is corrupt.`);
    if (!name.endsWith('/')) entries.set(name, data);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function addImageReference(references, value) {
  if (isImageReference(value) && value) references.add(value);
}

export function projectImageReferences(project) {
  const references = new Set();
  addImageReference(references, project?.favicon);
  addImageReference(references, project?.background);
  addImageReference(references, project?.branding?.favicon);
  for (const logo of project?.customLogos || []) addImageReference(references, logo?.dataUrl);
  for (const device of project?.devices || []) {
    for (const group of device.groups || []) addImageReference(references, group?.logo);
  }
  return references;
}

function rewriteProjectImages(project, replacements) {
  if (!replacements.size) return project;
  const clone = structuredClone(project);
  const rewrite = value => replacements.get(value) || value;
  clone.favicon = rewrite(clone.favicon);
  clone.background = rewrite(clone.background);
  if (clone.branding) clone.branding.favicon = rewrite(clone.branding.favicon);
  for (const logo of clone.customLogos || []) logo.dataUrl = rewrite(logo.dataUrl);
  for (const device of clone.devices || []) {
    for (const group of device.groups || []) group.logo = rewrite(group.logo);
  }
  return clone;
}

function filenameFromReference(reference) {
  return reference.slice(reference.lastIndexOf('/') + 1);
}

function mimeForName(name) {
  return MIME_BY_EXTENSION[String(name).split('.').pop().toLowerCase()] || '';
}

export async function createProjectArchive(project, { fetcher = globalThis.fetch } = {}) {
  if (typeof fetcher !== 'function') throw new Error('Uploaded images cannot be loaded.');
  const entries = [{
    name: PROJECT_ZIP_MANIFEST,
    data: encoder.encode(JSON.stringify({ format: PROJECT_ZIP_FORMAT, formatVersion: 1, schemaVersion: project.schemaVersion }, null, 2)),
  }, {
    name: PROJECT_ZIP_ENTRY,
    data: encoder.encode(JSON.stringify(project, null, 2)),
  }];
  for (const reference of projectImageReferences(project)) {
    if (!isUploadReference(reference)) continue;
    const response = await fetcher(reference, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Uploaded image ${filenameFromReference(reference)} could not be included (HTTP ${response.status}).`);
    const data = new Uint8Array(await response.arrayBuffer());
    if (!data.length) throw new Error(`Uploaded image ${filenameFromReference(reference)} is empty.`);
    if (data.length > PROJECT_ZIP_LIMITS.entryBytes) throw new Error(`Uploaded image ${filenameFromReference(reference)} is too large.`);
    entries.push({ name: `${PROJECT_ZIP_UPLOADS}${filenameFromReference(reference)}`, data });
  }
  return createProjectZip(entries);
}

async function uploadExists(reference, fetcher) {
  const response = await fetcher(reference, { method: 'HEAD', cache: 'no-store' });
  if (!response.ok) throw new Error(`The project ZIP is missing ${PROJECT_ZIP_UPLOADS}${filenameFromReference(reference)}.`);
}

async function restoreProjectImages(project, entries, fetcher) {
  const replacements = new Map();
  for (const reference of projectImageReferences(project)) {
    const uploadOptions = reference === project.background
      ? { maxBytes: UPLOAD_LIMITS.backgroundBytes, kind: 'background' }
      : {};
    if (isUploadReference(reference)) {
      const name = filenameFromReference(reference);
      const data = entries.get(`${PROJECT_ZIP_UPLOADS}${name}`);
      if (data) {
        const mime = mimeForName(name);
        if (!mime) throw new Error(`The project ZIP contains an unsupported image: ${name}.`);
        replacements.set(reference, await uploadBlob(new Blob([data], { type: mime }), { mime, fetcher, ...uploadOptions }));
      } else {
        await uploadExists(reference, fetcher);
      }
    } else if (reference.startsWith('data:')) {
      replacements.set(reference, await uploadDataUrl(reference, 'legacy-image.png', { fetcher, ...uploadOptions }));
    }
  }
  return rewriteProjectImages(project, replacements);
}

function isZip(bytes) {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) && (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08);
}

async function importLegacyProject(text, fetcher) {
  const project = parseProject(text);
  const entries = new Map();
  const restored = await restoreProjectImages(project, entries, fetcher);
  await verifyCustomLogoDecodes(restored.customLogos);
  return { project: restored, legacy: true, images: projectImageReferences(project).size };
}

export async function importProjectFile(file, { fetcher = globalThis.fetch } = {}) {
  if (!file || typeof file.size !== 'number' || !file.size) throw new Error('Choose a Homelab Atlas ZIP project.');
  if (file.size > PROJECT_ZIP_LIMITS.bytes) throw new Error('Project ZIPs must be 32 MB or smaller.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isZip(bytes)) {
    const entries = await readProjectZip(bytes);
    const projectEntry = entries.get(PROJECT_ZIP_ENTRY);
    if (!projectEntry) throw new Error('The ZIP does not contain project.json.');
    if (projectEntry.length > PROJECT_ZIP_LIMITS.projectBytes) throw new Error('project.json is larger than 2 MB.');
    const project = parseProject(decoder.decode(projectEntry));
    const restored = await restoreProjectImages(project, entries, fetcher);
    await verifyCustomLogoDecodes(restored.customLogos);
    return { project: restored, legacy: false, images: projectImageReferences(project).size };
  }
  const text = decoder.decode(bytes);
  if (!file.name?.toLowerCase().endsWith('.json') && !text.trimStart().startsWith('{')) {
    throw new Error('Choose a Homelab Atlas ZIP project. Legacy JSON exports are accepted for migration.');
  }
  if (bytes.length > 2_000_000) throw new Error('Legacy JSON projects must be 2 MB or smaller.');
  return importLegacyProject(text, fetcher);
}
