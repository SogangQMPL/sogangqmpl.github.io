import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_REPOSITORY, PUBLICATION_LIMITS, validateSiteData, loadSnapshot, loadRevision, listRevisions, publishSnapshot, getDeploymentStatus } from '../admin/visual-github.js';

const BASE = 'a'.repeat(40), BASE_TREE = 'b'.repeat(40), BLOB = 'c'.repeat(40), TREE = 'd'.repeat(40), COMMIT = 'e'.repeat(40), OTHER = 'f'.repeat(40);
const TOKEN = 'test-credential-not-for-publication';
const API_PATH = '/repos/SogangQMPL/sogangqmpl.github.io';
const copy = value => structuredClone(value);
const response = (body, status = 200, headers = {}) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(headers), json: async () => copy(body) });
const fixture = () => ({
  site: { title: 'Test lab', group: 'Research group', email: 'lab@example.com', address: 'Seoul', affiliation: 'University' },
  hero: { title: 'Test lab', image: '', imageAlt: '' }, join: { title: 'Join', description: 'Contact us.', office: 'R1021', laboratory: 'R303' },
  research: [{ id: 'research-1', title: 'Research', topics: [{ id: 'topic-1', title: 'Topic', paperIds: ['paper-1'], focus: ['Excitons'], detailSections: [{ title: '', body: 'Overview', images: [] }] }] }],
  publications: [{ id: 'paper-1', title: 'Paper', authors: 'Researcher', year: 2026, journal: 'Journal' }],
  people: [{ id: 'person-1', name: 'Researcher', role: 'Principal Investigator', email: 'lab@example.com' }], underReview: [],
  news: [{ id: 'news-1', title: 'Award', date: '2026-11-03', category: 'Awards', facts: [{ label: 'Recipient', value: 'Researcher' }], content: [{ type: 'paragraph', text: 'Researcher won an award.', children: [{ text: 'Researcher', bold: true }, { text: ' won an award.' }] }] }],
  provenance: { note: 'Preserve unknown metadata.' }
});
const png = bytes => { const buffer = Buffer.alloc(bytes); Buffer.from('\x89PNG\r\n\x1a\n', 'latin1').copy(buffer); return buffer.toString('base64'); };
const asset = (path = 'assets/uploads/photo.png') => ({ path, base64: png(32) });
function github(options = {}) {
  const state = { head: options.head || BASE, headReads: 0, calls: [], blobs: [], trees: [], commits: [], patchCount: 0 };
  const source = options.data || fixture();
  const fetchImpl = async (address, init = {}) => {
    const url = new URL(address);
    assert.equal(url.origin, 'https://api.github.com', 'Credentials must never reach another origin');
    assert.ok(url.pathname.startsWith(API_PATH + '/'));
    assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store');
    assert.equal(init.headers['User-Agent'], 'Sogang-QMPL-Editor');
    if (init.headers.Authorization) assert.equal(init.headers.Authorization, `Bearer ${TOKEN}`);
    assert.equal(url.search.includes(TOKEN), false);
    const call = { path: url.pathname, search: url.search, method: init.method, headers: { ...init.headers }, body: init.body ? JSON.parse(init.body) : undefined };
    state.calls.push(call);
    if (options.onRequest) await options.onRequest(call, state);
    if (options.httpStatus) return response({ message: TOKEN }, options.httpStatus, options.responseHeaders);
    if (call.method === 'GET' && url.pathname === API_PATH + '/git/ref/heads/main') {
      state.headReads++;
      if (options.advanceBeforePatch && state.headReads === 2) state.head = OTHER;
      if (options.failReconcile && state.headReads >= 3) return response({}, 503);
      return response({ object: { sha: state.head } });
    }
    if (call.method === 'GET' && url.pathname.startsWith(API_PATH + '/git/commits/')) {
      const sha = url.pathname.split('/').at(-1);
      return response({ sha, tree: { sha: BASE_TREE }, message: 'Saved revision', committer: { date: '2026-11-03T00:00:00Z' } });
    }
    if (call.method === 'GET' && url.pathname === API_PATH + '/contents/content/site.json') {
      assert.equal(init.headers.Accept, 'application/vnd.github.raw+json');
      assert.ok([BASE, COMMIT, OTHER].includes(url.searchParams.get('ref')), 'Content must be pinned to a commit');
      return response(source);
    }
    if (call.method === 'GET' && url.pathname === API_PATH + '/commits') return response([{ sha: BASE, commit: { message: 'Update content', committer: { date: '2026-11-03T00:00:00Z' } } }]);
    if (call.method === 'GET' && url.pathname === API_PATH + '/actions/workflows/pages.yml/runs') return response({ workflow_runs: options.runs || [] });
    if (call.method === 'POST' && url.pathname === API_PATH + '/git/blobs') {
      if (options.failBlob) return response({}, 422);
      state.blobs.push(call.body); return response({ sha: BLOB });
    }
    if (call.method === 'POST' && url.pathname === API_PATH + '/git/trees') { state.trees.push(call.body); return response({ sha: TREE }); }
    if (call.method === 'POST' && url.pathname === API_PATH + '/git/commits') { state.commits.push(call.body); return response({ sha: COMMIT }); }
    if (call.method === 'PATCH' && url.pathname === API_PATH + '/git/refs/heads/main') {
      state.patchCount++; assert.deepEqual(call.body, { sha: COMMIT, force: false });
      if (options.advanceDuringPatch) { state.head = OTHER; return response({}, 422); }
      if (options.patchFails) throw new Error('Transport error containing ' + TOKEN);
      state.head = COMMIT;
      if (options.applyThenDisconnect) throw new Error('Transport error containing ' + TOKEN);
      return response(options.badPatchResponse ? {} : { object: { sha: COMMIT } });
    }
    throw new Error('Unexpected mocked GitHub route');
  };
  return { state, fetchImpl };
}
const publish = (mock, changes = {}) => publishSnapshot({ token: TOKEN, data: fixture(), baseHead: BASE, fetchImpl: mock.fetchImpl, ...changes });
const expectCode = (code, operation) => assert.rejects(operation, error => { assert.equal(error.code, code); assert.equal(error.message.includes(TOKEN), false); return true; });
let assertions = 0;
async function check(name, action) { await action(); assertions++; }

await check('current site and unknown metadata survive validation', async () => {
  const actual = JSON.parse(await readFile(new URL('../content/site.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateSiteData(actual), actual);
  const original = fixture(), validated = validateSiteData(original); assert.deepEqual(validated, original); assert.notEqual(validated, original);
});
await check('load at immutable repository HEAD, not cached Pages content', async () => {
  const mock = github(); const result = await loadSnapshot({ fetchImpl: mock.fetchImpl, method: 'PATCH' });
  assert.equal(result.head, BASE); assert.equal(result.tree, BASE_TREE); assert.deepEqual(result.data, fixture()); assert.equal(result.revision.sha, BASE);
  assert.ok(mock.state.calls.every(call => call.method === 'GET' && !call.headers.Authorization));
  assert.ok(mock.state.calls.at(-1).search.includes(BASE));
});
await check('revision listing and historical loading do not move the branch', async () => {
  const mock = github(); const history = await listRevisions({ fetchImpl: mock.fetchImpl }); assert.equal(history[0].sha, BASE);
  const snapshot = await loadRevision({ sha: COMMIT, fetchImpl: mock.fetchImpl }); assert.equal(snapshot.head, COMMIT); assert.equal(mock.state.head, BASE);
  assert.ok(mock.state.calls.every(call => call.method === 'GET'));
});
await check('data and pictures are published in one complete tree and one non-forced commit', async () => {
  const mock = github(); const data = fixture(), uploads = [asset()]; const before = JSON.stringify({ data, uploads });
  const result = await publish(mock, { data, assets: uploads });
  assert.equal(mock.state.head, COMMIT); assert.equal(result.sha, COMMIT); assert.equal(result.reconciled, false); assert.equal(result.previousHead, BASE);
  assert.equal(mock.state.blobs.length, 1); assert.equal(mock.state.trees.length, 1); assert.equal(mock.state.commits.length, 1); assert.equal(mock.state.patchCount, 1);
  assert.equal(mock.state.blobs[0].encoding, 'base64');
  const tree = mock.state.trees[0]; assert.equal(tree.base_tree, BASE_TREE); assert.deepEqual(tree.tree.map(entry => entry.path), ['content/site.json', 'assets/uploads/photo.png']);
  assert.deepEqual(JSON.parse(tree.tree[0].content), data); assert.equal(tree.tree[1].sha, BLOB);
  assert.deepEqual(mock.state.commits[0].parents, [BASE]); assert.equal(mock.state.commits[0].tree, TREE);
  assert.equal(JSON.stringify({ data, uploads }), before, 'Publishing must not mutate the draft');
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
});
await check('publish freezes its input before the first network wait', async () => {
  let release, reached;
  const waiting = new Promise(resolve => { reached = resolve; }); const gate = new Promise(resolve => { release = resolve; });
  const mock = github({ onRequest: async (_call, state) => { if (state.calls.length === 1) { reached(); await gate; } } });
  const data = fixture(), uploads = [asset()]; const pending = publish(mock, { data, assets: uploads }); await waiting;
  data.site.title = 'A later unsaved edit'; uploads[0].base64 = 'invalid'; uploads.push(asset('assets/uploads/later.png')); release(); await pending;
  assert.equal(JSON.parse(mock.state.trees[0].tree[0].content).site.title, 'Test lab'); assert.equal(mock.state.blobs.length, 1);
});
await check('stale drafts stop before any upload', async () => {
  const mock = github({ head: OTHER }); const draft = fixture(); const before = JSON.stringify(draft);
  await expectCode('CONFLICT', () => publish(mock, { data: draft, assets: [asset()] })); assert.equal(mock.state.calls.length, 1); assert.equal(mock.state.patchCount, 0); assert.equal(JSON.stringify(draft), before);
});
await check('concurrent publication during uploads preserves other changes', async () => {
  const mock = github({ advanceBeforePatch: true }); await expectCode('CONFLICT', () => publish(mock)); assert.equal(mock.state.head, OTHER); assert.equal(mock.state.patchCount, 0);
});
await check('last-moment reference races never force overwrite', async () => {
  const mock = github({ advanceDuringPatch: true }); await expectCode('CONFLICT', () => publish(mock)); assert.equal(mock.state.head, OTHER); assert.equal(mock.state.patchCount, 1);
});
await check('an applied ref update with a lost response is reconciled without retrying the write', async () => {
  const mock = github({ applyThenDisconnect: true }); const result = await publish(mock); assert.equal(result.reconciled, true); assert.equal(mock.state.head, COMMIT); assert.equal(mock.state.patchCount, 1);
});
await check('malformed successful ref responses are reconciled', async () => {
  const mock = github({ badPatchResponse: true }); const result = await publish(mock); assert.equal(result.reconciled, true); assert.equal(mock.state.patchCount, 1);
});
await check('unapplied writes and unverifiable writes are distinguished', async () => {
  const mock = github({ patchFails: true }); await expectCode('NETWORK', () => publish(mock)); assert.equal(mock.state.head, BASE);
  const uncertain = github({ patchFails: true, failReconcile: true }); await expectCode('PUBLISH_UNCERTAIN', () => publish(uncertain)); assert.equal(uncertain.state.patchCount, 1);
});
await check('partial uploads never update the public branch', async () => {
  const mock = github({ failBlob: true }); await expectCode('HTTP_ERROR', () => publish(mock, { assets: [asset()] })); assert.equal(mock.state.head, BASE); assert.equal(mock.state.trees.length, 0); assert.equal(mock.state.patchCount, 0);
});
await check('invalid credentials and API errors do not echo response bodies', async () => {
  const mock = github({ httpStatus: 403 }); await expectCode('FORBIDDEN', () => publish(mock));
  await expectCode('AUTH_REQUIRED', () => publish(github(), { token: '' }));
  await expectCode('VALIDATION', () => publish(github(), { token: 'bad\nheader' }));
  const data = fixture(); data.site.description = TOKEN; await expectCode('VALIDATION', () => publish(github(), { data }));
});
await check('exhausted 403 limits are distinguishable from forbidden access and explain when to retry', async () => {
  const mock = github({ httpStatus: 403, responseHeaders: { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + 120) } });
  await assert.rejects(() => publish(mock), error => {
    assert.equal(error.code, 'RATE_LIMIT'); assert.equal(error.status, 403); assert.match(error.message, /요청 한도/); assert.match(error.message, /분 뒤 다시 시도/); assert.match(error.message, /초안은 유지/);
    assert.ok(error.retryAfter > 0 && error.retryAfter <= 121); assert.equal(error.message.includes(TOKEN), false); return true;
  });
  assert.equal(mock.state.patchCount, 0);
  const limited = github({ httpStatus: 429, responseHeaders: { 'Retry-After': '90' } });
  await assert.rejects(() => loadSnapshot({ fetchImpl: limited.fetchImpl }), error => { assert.equal(error.code, 'RATE_LIMIT'); assert.equal(error.retryAfter, 90); assert.match(error.message, /약 2분/); return true; });
  const forbidden = github({ httpStatus: 403, responseHeaders: { 'X-RateLimit-Remaining': '5' } });
  await expectCode('FORBIDDEN', () => publish(forbidden));
});
await check('repository, route, and asset allowlists reject before networking', async () => {
  for (const change of [{ owner: 'other' }, { repo: '../other' }, { branch: 'other' }, { baseHead: '../../refs/main' }]) {
    const mock = github(); await expectCode('VALIDATION', () => publish(mock, change)); assert.equal(mock.state.calls.length, 0);
  }
  for (const path of ['content/site.json', '.github/workflows/pages.yml', 'assets/image.png', 'assets/uploads/../image.png', 'assets/uploads/a/b.png', 'assets/uploads/a.svg', 'https://example.com/a.png', 'assets/uploads/%2e%2e.png']) {
    const mock = github(); await expectCode('VALIDATION', () => publish(mock, { assets: [asset(path)] })); assert.equal(mock.state.calls.length, 0);
  }
  await expectCode('VALIDATION', () => publish(github(), { assets: [asset(), asset()] }));
});
await check('image encoding, formats, and all size boundaries are enforced', async () => {
  for (const base64 of ['data:image/png;base64,' + png(32), '%%%!', Buffer.from('<svg></svg>').toString('base64')]) await expectCode('VALIDATION', () => publish(github(), { assets: [{ path: 'assets/uploads/photo.png', base64 }] }));
  await expectCode('VALIDATION', () => publish(github(), { assets: [asset('assets/uploads/photo.jpg')] }));
  await expectCode('VALIDATION', () => publish(github(), { assets: Array.from({ length: 51 }, (_, index) => asset(`assets/uploads/p${index}.png`)) }));
  await expectCode('VALIDATION', () => publish(github(), { assets: [{ path: 'assets/uploads/large.png', base64: png(PUBLICATION_LIMITS.assetBytes + 1) }] }));
  const maximum = png(PUBLICATION_LIMITS.assetBytes);
  await expectCode('CONFLICT', () => publish(github({ head: OTHER }), { assets: [{ path: 'assets/uploads/maximum.png', base64: maximum }] }));
  await expectCode('CONFLICT', () => publish(github({ head: OTHER }), { assets: ['a', 'b', 'c'].map(name => ({ path: `assets/uploads/${name}.png`, base64: maximum })) }));
  const eightMB = png(8 * 1024 * 1024);
  await expectCode('VALIDATION', () => publish(github(), { assets: ['a', 'b', 'c', 'd'].map(name => ({ path: `assets/uploads/${name}.png`, base64: eightMB })) }));
});
await check('full content validation catches routes, unsafe URLs, and broken associations', async () => {
  const changes = [
    data => { delete data.research; }, data => { data.people[0].id = data.news[0].id; }, data => { data.news[0].date = '2026-02-30'; },
    data => { data.news[0].aliases = ['news-1']; }, data => { data.hero.image = 'javascript:alert(1)'; }, data => { data.hero.image = 'assets/%2e%2e/secret.png'; },
    data => { data.research[0].topics[0].paperIds = ['missing']; }, data => { data.research[0].topics[0].detailSections[0].body = ''; },
    data => { data.news[0].content[0].children[0].url = 'https://name:secret@example.com'; }, data => { data.news[0].content[0].children[0].bold = 'yes'; },
    data => { data.research[0].topics[0].outcomes = 'wrong'; }, data => { Object.assign(data, JSON.parse('{"__proto__":{"polluted":true}}')); }
  ];
  for (const change of changes) { const data = fixture(); change(data); const mock = github(); await expectCode('VALIDATION', () => publish(mock, { data })); assert.equal(mock.state.calls.length, 0); }
});
await check('deployment polling matches the requested commit and never writes', async () => {
  for (const [status, conclusion, expected] of [['queued', null, 'pending'], ['in_progress', null, 'building'], ['completed', 'success', 'success'], ['completed', 'failure', 'failure'], ['completed', 'cancelled', 'failure']]) {
    const mock = github({ runs: [{ head_sha: COMMIT, id: 123, status, conclusion }] }); const result = await getDeploymentStatus({ sha: COMMIT, fetchImpl: mock.fetchImpl });
    assert.equal(result.state, expected); assert.equal(result.sha, COMMIT); assert.equal(result.url, 'https://github.com/SogangQMPL/sogangqmpl.github.io/actions/runs/123'); assert.ok(mock.state.calls.every(call => call.method === 'GET' && !call.headers.Authorization));
  }
  const mock = github({ runs: [{ head_sha: OTHER, id: 456, status: 'completed', conclusion: 'success' }] }); assert.equal((await getDeploymentStatus({ sha: COMMIT, fetchImpl: mock.fetchImpl })).state, 'pending');
});

assert.deepEqual(DEFAULT_REPOSITORY, { owner: 'SogangQMPL', repo: 'sogangqmpl.github.io', branch: 'main' });
console.log(`Visual GitHub publication checks passed: ${assertions} scenarios; no network or repository writes performed.`);
