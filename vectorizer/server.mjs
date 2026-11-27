import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CoreSession } from 'openvector';

const PORT = Number(process.env.PORT || 8081);
const MAX_BYTES = 2_000_000;
const session = new CoreSession();

const MIME_EXTENSION = {
  'image/png': '.png',
  'image/jpeg': '.jpeg',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
};

function normalizeSvg(svg) {
  return svg.replace(/<svg\b([^>]*)>/i, (match, attributes) => {
    const viewBox = /viewBox\s*=\s*["']([^"']+)["']/i.exec(attributes);
    if (!viewBox) return match;
    const parts = viewBox[1].trim().split(/[\s,]+/);
    const width = parts[2];
    const height = parts[3];
    if (!width || !height || !Number.isFinite(Number(width)) || !Number.isFinite(Number(height))) return match;
    const cleaned = attributes.replace(/\s(?:width|height)\s*=\s*["'][^"']*["']/gi, '');
    return `<svg${cleaned} width="${width}px" height="${height}px">`;
  });
}

function vectorize(bytes, mediaType) {
  const extension = MIME_EXTENSION[mediaType];
  if (!extension) throw new Error('unsupported source format');
  const filename = `upload${extension}`;
  const document = session.createDocument();
  document.setSource(Buffer.from(bytes), filename);
  document.shrinkSource();
  const result = document.runAutomatic({ extension });
  if (result?.fitting?.status !== 0) throw new Error('tracing failed');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-vector-'));
  try {
    const output = path.join(directory, 'trace.svg');
    const saved = document.saveVector(output, { layout: 'cutouts' });
    if (saved.status !== 0 || saved.error) throw new Error(saved.error?.message || 'export failed');
    const svg = fs.readFileSync(output, 'utf8').trim();
    if (!/^\s*<svg[\s>]/i.test(svg)) throw new Error('export produced no SVG');
    if (/<script\b|\son[a-z]+\s*=|<foreignObject\b/i.test(svg)) throw new Error('export contains unsafe content');
    return normalizeSvg(svg);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new Error('too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const server = http.createServer(async (request, response) => {
  if (request.url === '/healthz') {
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end('ok');
    return;
  }
  if (request.url !== '/vectorize' || request.method !== 'POST') {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('not found');
    return;
  }
  try {
    const contentType = String(request.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!MIME_EXTENSION[contentType]) {
      response.writeHead(415, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'unsupported source format' }));
      return;
    }
    const bytes = await readBody(request);
    if (!bytes.length) throw new Error('empty image');
    const svg = vectorize(bytes, contentType);
    response.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' });
    response.end(svg);
  } catch (error) {
    const status = error.message === 'too large' ? 413 : 422;
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: error.message || 'vectorization failed' }));
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`vectorizer listening on ${PORT}`));
