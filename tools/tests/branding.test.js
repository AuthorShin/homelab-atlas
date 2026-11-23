import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRANDING_ENDPOINT, BRANDING_LIMITS, BRANDING_WRITE_HEADER, DEFAULT_BRANDING,
  applyBranding, brandingTabTitle, clearServerBranding, effectiveBrandLogo,
  fetchServerBranding, normalizeBranding, saveServerBranding,
} from '../../app/public/branding.js';
import { DEFAULT_FAVICON_PATH } from '../../app/public/favicon.js';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const response = (status, body = '') => ({
  status,
  ok: status >= 200 && status < 300,
  text: async () => body,
});

test('branding defaults, limits, and endpoint are stable', () => {
  assert.deepEqual(DEFAULT_BRANDING, { name: 'Homelab Atlas', tabTitle: '', favicon: '' });
  assert.equal(Object.isFrozen(DEFAULT_BRANDING), true);
  assert.equal(BRANDING_ENDPOINT, '/api/branding');
  assert.equal(BRANDING_WRITE_HEADER, 'X-Atlas-Branding');
  assert.equal(BRANDING_LIMITS.name, 60);
  assert.equal(BRANDING_LIMITS.tabTitle, 80);
});

test('branding normalization trims text and validates the logo', () => {
  assert.deepEqual(normalizeBranding({ name: '  Acme Lab  ', tabTitle: '  Acme Atlas  ', favicon: '' }), {
    name: 'Acme Lab', tabTitle: 'Acme Atlas', favicon: '',
  });
  assert.deepEqual(normalizeBranding({ name: 'Acme', tabTitle: '', favicon: PNG }), { name: 'Acme', tabTitle: '', favicon: PNG });
  for (const value of [
    null, [], {}, { name: '   ', tabTitle: '', favicon: '' },
    { name: 'Acme', tabTitle: '', favicon: '', extra: true },
    { name: 'a'.repeat(BRANDING_LIMITS.name + 1), tabTitle: '', favicon: '' },
    { name: 'Acme', tabTitle: 'a'.repeat(BRANDING_LIMITS.tabTitle + 1), favicon: '' },
    { name: 'Acme\nLab', tabTitle: '', favicon: '' },
    { name: 'Acme\u0085Lab', tabTitle: '', favicon: '' },
    { name: 'Acme', tabTitle: 'Tab\tName', favicon: '' },
    { name: 'Acme', tabTitle: '', favicon: 'https://example.test/logo.png' },
    { name: 'Acme', tabTitle: '', favicon: 'data:image/svg+xml;base64,PHN2Zz4=' },
  ]) assert.throws(() => normalizeBranding(value), /App |app |logo|name|title/i, String(JSON.stringify(value)).slice(0, 60));
});

test('logo and tab-title resolution prefer the saved app logo and fall back to the project icon', () => {
  const branding = { name: 'Acme Lab', tabTitle: '', favicon: PNG };
  assert.equal(effectiveBrandLogo(branding), PNG);
  assert.equal(effectiveBrandLogo(branding, 'project-logo'), PNG);
  assert.equal(effectiveBrandLogo({ ...branding, favicon: '' }, 'project-logo'), 'project-logo');
  assert.equal(effectiveBrandLogo({ ...branding, favicon: '' }, ''), '');
  assert.equal(brandingTabTitle(branding), 'Acme Lab');
  assert.equal(brandingTabTitle(branding, { dashboard: true, projectTitle: 'Home Lab' }), 'Home Lab · Acme Lab Dashboard');
  const custom = { ...branding, tabTitle: 'My Atlas' };
  assert.equal(brandingTabTitle(custom), 'My Atlas');
  assert.equal(brandingTabTitle(custom, { dashboard: true, projectTitle: 'Home Lab' }), 'Home Lab · My Atlas');
});

test('applying branding updates the header, tab icon, and title', () => {
  const link = { id: 'app-favicon', rel: 'icon', type: '', href: '' };
  const brand = { labels: {}, setAttribute: (key, value) => { brand.labels[key] = value; } };
  const name = { textContent: 'Old name' };
  const classes = new Set();
  const mark = {
    style: {},
    classList: {
      toggle: (value, enabled) => enabled ? classes.add(value) : classes.delete(value),
    },
  };
  const documentRef = {
    title: '',
    getElementById: id => id === 'app-favicon' ? link : null,
    querySelector: selector => ({
      '.brand': brand,
      '[data-brand-name]': name,
      '[data-brand-mark]': mark,
    })[selector] || null,
  };
  const branding = { name: 'Acme Lab', tabTitle: '', favicon: PNG };
  const result = applyBranding(branding, {
    projectFavicon: '',
    projectTitle: 'Home Lab',
    dashboard: true,
    brandLabel: 'Acme Lab editor',
    document: documentRef,
  });
  assert.equal(result.logo, PNG);
  assert.equal(brand.labels['aria-label'], 'Acme Lab editor');
  assert.equal(name.textContent, 'Acme Lab');
  assert.equal(classes.has('has-logo'), true);
  assert.equal(mark.style.backgroundImage, `url("${PNG}")`);
  assert.equal(link.type, 'image/png');
  assert.equal(link.href, PNG);
  assert.equal(documentRef.title, 'Home Lab · Acme Lab Dashboard');

  applyBranding({ name: 'Acme Lab', tabTitle: 'My Atlas', favicon: '' }, {
    projectFavicon: 'project-logo',
    document: documentRef,
  });
  assert.equal(mark.style.backgroundImage, 'url("project-logo")');
  assert.equal(link.href, 'project-logo');
  assert.equal(documentRef.title, 'My Atlas');

  applyBranding({ name: 'Acme Lab', tabTitle: '', favicon: '' }, { document: documentRef });
  assert.equal(classes.has('has-logo'), false);
  assert.equal(mark.style.backgroundImage, '');
  assert.equal(link.type, 'image/svg+xml');
  assert.equal(link.href, DEFAULT_FAVICON_PATH);
  assert.equal(documentRef.title, 'Acme Lab');
});

test('server branding is fetched without caching', async () => {
  const branding = { name: 'Acme Lab', tabTitle: 'Acme Atlas', favicon: PNG };
  let call;
  const loaded = await fetchServerBranding(async (url, options) => {
    call = { url, options };
    return response(200, JSON.stringify(branding));
  });
  assert.equal(call.url, BRANDING_ENDPOINT);
  assert.equal(call.options.cache, 'no-store');
  assert.deepEqual(loaded, branding);
  assert.equal(await fetchServerBranding(async () => response(404)), null);
  await assert.rejects(fetchServerBranding(async () => response(500, 'storage unavailable\n')), /storage unavailable/);
  await assert.rejects(fetchServerBranding(async () => response(200, '{not json')), /could not be read/i);
  await assert.rejects(fetchServerBranding(async () => response(200, JSON.stringify({ name: '' }))), /app|name/i);
});

test('saving and clearing branding uses the guarded write endpoint', async () => {
  const branding = { name: 'Acme Lab', tabTitle: '', favicon: PNG };
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return response(204);
  };
  await saveServerBranding({ ...branding, name: '  Acme Lab  ' }, fetcher);
  assert.equal(calls[0].url, BRANDING_ENDPOINT);
  assert.equal(calls[0].options.method, 'PUT');
  assert.equal(calls[0].options.headers[BRANDING_WRITE_HEADER], '1');
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].options.body), branding);

  await clearServerBranding(fetcher);
  assert.equal(calls[1].options.method, 'DELETE');
  assert.equal(calls[1].options.headers[BRANDING_WRITE_HEADER], '1');

  await assert.rejects(saveServerBranding({ name: '', tabTitle: '', favicon: '' }, fetcher), /name/i);
  await assert.rejects(saveServerBranding(branding, async () => response(413, 'too large\n')), /too large/);
});
