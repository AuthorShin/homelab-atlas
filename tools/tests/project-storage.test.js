import test from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA_VERSION, sampleProject } from '../../app/public/model.js';
import {
  DEFAULT_PROJECT_ENDPOINT, DEFAULT_PROJECT_STORAGE_KEY, DEFAULT_PROJECT_WRITE_HEADER, PROJECT_STORAGE_KEY,
  clearServerDefaultProject, decodeProjectRecord, decodeStoredProject, fetchServerDefaultAvailable,
  fetchServerDefaultProject, isSampleProject, resolveStoredProject, saveServerDefaultProject,
} from '../../app/public/project-storage.js';

const record = project => JSON.stringify({ tab: 'test-tab', data: JSON.stringify(project) });
const response = (status, body = '') => ({
  status,
  ok: status >= 200 && status < 300,
  text: async () => body,
});

test('project storage keys and default endpoint are stable', () => {
  assert.equal(PROJECT_STORAGE_KEY, 'homelab-atlas.project');
  assert.equal(DEFAULT_PROJECT_STORAGE_KEY, 'homelab-atlas.default-project');
  assert.equal(DEFAULT_PROJECT_ENDPOINT, '/api/default-project');
  assert.equal(DEFAULT_PROJECT_WRITE_HEADER, 'X-Atlas-Default');
});

test('the untouched sample project is identifiable', () => {
  assert.equal(isSampleProject(sampleProject()), true);
  const edited = sampleProject();
  edited.title = 'Edited';
  assert.equal(isSampleProject(edited), false);
});

test('server default projects are fetched from the same origin without caching', async () => {
  const project = sampleProject();
  let call;
  const loaded = await fetchServerDefaultProject(async (url, options) => {
    call = { url, options };
    return response(200, JSON.stringify(project));
  });
  assert.equal(call.url, DEFAULT_PROJECT_ENDPOINT);
  assert.equal(call.options.cache, 'no-store');
  assert.deepEqual(loaded, project);

  assert.equal(await fetchServerDefaultProject(async () => response(404, 'missing')), null);
  await assert.rejects(fetchServerDefaultProject(async () => response(500, 'server failed\n')), /server failed/);
});

test('server default availability treats missing or unavailable storage as absent', async () => {
  assert.equal(await fetchServerDefaultAvailable(async () => response(200)), true);
  assert.equal(await fetchServerDefaultAvailable(async () => response(404)), false);
  assert.equal(await fetchServerDefaultAvailable(async () => response(503)), false);
});

test('saving and clearing the server default uses the guarded write endpoint', async () => {
  const project = sampleProject();
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return response(204);
  };
  await saveServerDefaultProject(project, fetcher);
  assert.equal(calls[0].url, DEFAULT_PROJECT_ENDPOINT);
  assert.equal(calls[0].options.method, 'PUT');
  assert.equal(calls[0].options.headers[DEFAULT_PROJECT_WRITE_HEADER], '1');
  assert.deepEqual(JSON.parse(calls[0].options.body), project);

  await clearServerDefaultProject(fetcher);
  assert.equal(calls[1].options.method, 'DELETE');
  assert.equal(calls[1].options.headers[DEFAULT_PROJECT_WRITE_HEADER], '1');

  await assert.rejects(saveServerDefaultProject(project, async () => response(413, 'too large\n')), /too large/);
});

test('project resolution prefers edits, then the server default, then the legacy browser default', async () => {
  const edited = sampleProject();
  edited.title = 'Edited';
  const server = sampleProject();
  server.title = 'Server default';
  const browser = sampleProject();
  browser.title = 'Browser default';

  const saved = await resolveStoredProject(record(edited), record(browser), async () => response(200, JSON.stringify(server)));
  assert.equal(saved.source, 'saved');
  assert.equal(saved.project.title, 'Edited');

  const serverDefault = await resolveStoredProject(record(sampleProject()), record(browser), async () => response(200, JSON.stringify(server)));
  assert.equal(serverDefault.source, 'server-default');
  assert.equal(serverDefault.project.title, 'Server default');

  const legacyDefault = await resolveStoredProject(record(sampleProject()), record(browser), async () => response(404));
  assert.equal(legacyDefault.source, 'default');
  assert.equal(legacyDefault.project.title, 'Browser default');

  const sample = await resolveStoredProject(null, null, async () => response(404));
  assert.equal(sample.source, 'sample');

  const unavailable = await resolveStoredProject(record(sampleProject()), record(browser), async () => response(503, 'unavailable\n'));
  assert.equal(unavailable.source, 'default');
  assert.match(unavailable.serverError, /unavailable/);

  let requested = false;
  const corrupt = await resolveStoredProject('{not json', record(browser), async () => { requested = true; return response(200, JSON.stringify(server)); });
  assert.equal(corrupt.source, 'error');
  assert.equal(requested, false);
});

test('stored project decoding prefers the saved project and falls back to the browser default', () => {
  const saved = sampleProject();
  saved.title = 'Saved project';
  const fallback = sampleProject();
  fallback.title = 'Browser default';

  const savedDecoded = decodeStoredProject(record(saved), record(fallback));
  assert.equal(savedDecoded.source, 'saved');
  assert.equal(savedDecoded.project.title, 'Saved project');

  const defaultDecoded = decodeStoredProject(null, record(fallback));
  assert.equal(defaultDecoded.source, 'default');
  assert.equal(defaultDecoded.project.title, 'Browser default');
  assert.equal(defaultDecoded.project.schemaVersion, SCHEMA_VERSION);

  const sampleDecoded = decodeStoredProject(null, null);
  assert.equal(sampleDecoded.source, 'sample');
  assert.equal(sampleDecoded.project.title, sampleProject().title);
});

test('invalid stored records report errors instead of throwing', () => {
  const saved = decodeStoredProject('{not json', null);
  assert.equal(saved.source, 'error');
  assert.match(saved.error, /JSON/i);
  assert.equal(saved.project.schemaVersion, SCHEMA_VERSION);

  const fallback = decodeStoredProject(null, JSON.stringify({ tab: 'x', data: JSON.stringify({ schemaVersion: 999 }) }));
  assert.equal(fallback.source, 'error');
  assert.match(fallback.error, /browser default/i);
  assert.equal(fallback.project.schemaVersion, SCHEMA_VERSION);
});

test('decodeProjectRecord requires a complete storage record', () => {
  const project = sampleProject();
  assert.deepEqual(decodeProjectRecord(record(project)), project);
  assert.equal(decodeProjectRecord(''), null);
  assert.throws(() => decodeProjectRecord(JSON.stringify({ data: project })), /incomplete/);
});
