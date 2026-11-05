import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';

const globals = ['indexedDB', 'fetch', 'crypto', 'createImageBitmap', 'OffscreenCanvas', 'Image', 'document'];
const descriptors = new Map(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const replace = (key, value) => Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const originalCreateURL = URL.createObjectURL, originalRevokeURL = URL.revokeObjectURL;
const urls = new Set();
let checks = 0;
async function check(_name, action) { await action(); checks++; }
const errorCode = (code, action) => assert.rejects(action, error => { assert.equal(error.code, code); assert.ok(/[가-힣]/.test(error.message)); return true; });
const HEADER = {
  'image/png': Buffer.from('\x89PNG\r\n\x1a\nfixture', 'latin1'),
  'image/jpeg': Buffer.from('\xff\xd8\xff\xe0fixture', 'latin1'),
  'image/webp': Buffer.from('RIFF0000WEBPfixture', 'latin1'),
  'image/gif': Buffer.from('GIF89a original animated fixture', 'latin1')
};
const rasterBytes = (size, mime = 'image/png') => { const value = Buffer.alloc(size); HEADER[mime].copy(value); return value; };
const asset = (path = 'assets/uploads/photo.png', value = HEADER['image/png'], mime = 'image/png') => ({ path, base64: value.toString('base64'), width: 640, height: 480, mime, previewURL: 'blob:never-store-this-url' });
const draft = () => ({ data: { site: { title: '' }, news: [{ title: '', content: [] }], extra: { preserve: ['unfinished', 'new shape'] } }, baseHead: 'a'.repeat(40), assets: [asset()], updatedAt: '2026-11-03T00:00:00.000Z' });
function memoryIndexedDB() {
  const state = { values: new Map(), opens: 0, reads: 0, writes: 0, closes: 0, stores: new Set(), quota: false, holdWrites: false, delayedWrites: [], failNextWrite: false };
  const database = {
    objectStoreNames: { contains: name => state.stores.has(name) },
    createObjectStore(name) { assert.equal(name, 'drafts'); state.stores.add(name); },
    close() { state.closes++; },
    transaction(name, mode) {
      assert.equal(name, 'drafts'); assert.ok(['readonly', 'readwrite'].includes(mode));
      const transaction = {};
      transaction.objectStore = () => Object.fromEntries(['get', 'put', 'delete'].map(method => [method, (...arguments_) => {
        const request = {};
        const complete = () => {
          if (method !== 'get' && (state.quota || state.failNextWrite)) { state.failNextWrite = false; transaction.onabort?.(); return; }
          if (method === 'get') { state.reads++; request.result = structuredClone(state.values.get(arguments_[0])); }
          if (method === 'put') { assert.equal(mode, 'readwrite'); state.writes++; state.values.set(arguments_[1], structuredClone(arguments_[0])); request.result = arguments_[1]; }
          if (method === 'delete') { assert.equal(mode, 'readwrite'); state.writes++; state.values.delete(arguments_[0]); }
          transaction.oncomplete?.();
        };
        queueMicrotask(() => { if (method !== 'get' && state.holdWrites) state.delayedWrites.push(complete); else complete(); });
        return request;
      }]));
      return transaction;
    }
  };
  return { state, api: { open(name, version) {
    assert.equal(name, 'qmp-visual-editor'); assert.equal(version, 1); state.opens++;
    const request = {};
    queueMicrotask(() => { request.result = database; if (!state.stores.has('drafts')) request.onupgradeneeded?.(); request.onsuccess?.(); });
    return request;
  } } };
}

try {
  replace('fetch', () => { throw new Error('Storage tests must not use the network'); });
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, get() { throw new Error('Storage was opened during module import'); } });
  const { STORAGE_LIMITS, loadLocalDraft, saveLocalDraft, clearLocalDraft, stageImage } = await import('../admin/visual-storage.js');
  const memory = memoryIndexedDB(); replace('indexedDB', memory.api);
  if (!globalThis.crypto) replace('crypto', webcrypto);
  URL.createObjectURL = blob => { const url = originalCreateURL.call(URL, blob); urls.add(url); return url; };
  URL.revokeObjectURL = url => { urls.delete(url); return originalRevokeURL.call(URL, url); };

  await check('empty loads and module imports do not save or replace any draft', async () => {
    assert.equal(memory.state.opens, 0); assert.equal(await loadLocalDraft(), null); assert.equal(memory.state.writes, 0);
  });
  await check('complete current data and staged image survive backup-envelope import', async () => {
    const data = JSON.parse(await readFile(new URL('../content/site.json', import.meta.url), 'utf8'));
    const input = { format: 'qmp-visual-backup', version: 1, ...draft(), data };
    const original = JSON.stringify(input);
    const saved = await saveLocalDraft(input); const restored = await loadLocalDraft();
    assert.deepEqual(restored, saved); assert.deepEqual(restored.data, data); assert.equal(restored.baseHead, input.baseHead); assert.equal(restored.updatedAt, input.updatedAt);
    assert.equal(restored.assets[0].base64, input.assets[0].base64); assert.equal(restored.assets[0].mime, 'image/png');
    assert.equal('previewURL' in restored.assets[0], false); assert.equal('format' in restored, false); assert.equal('version' in restored, false);
    assert.equal('previewURL' in memory.state.values.get('current').assets[0], false); assert.equal(JSON.stringify(input), original);
  });
  await check('unfinished changed-shape drafts remain editable and reads return independent copies', async () => {
    const input = draft(); await saveLocalDraft(input); const writes = memory.state.writes;
    const loaded = await loadLocalDraft(); assert.deepEqual(loaded.data, input.data); loaded.data.extra.preserve.push('caller-only');
    assert.deepEqual((await loadLocalDraft()).data, input.data); assert.equal(memory.state.writes, writes);
  });
  await check('failed transactions preserve every field of the previous draft', async () => {
    const previous = structuredClone(memory.state.values.get('current')); memory.state.quota = true;
    await errorCode('STORAGE_UNAVAILABLE', () => saveLocalDraft({ ...draft(), data: { replace: true } })); memory.state.quota = false;
    assert.deepEqual(memory.state.values.get('current'), previous);
  });
  await check('a delayed old save finishes before a later clear, and reads wait for both', async () => {
    await saveLocalDraft(draft()); memory.state.holdWrites = true;
    const oldSave = saveLocalDraft({ ...draft(), data: { old: 'in-flight edit' } });
    const clear = clearLocalDraft(); const reads = memory.state.reads; const loading = loadLocalDraft();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(memory.state.delayedWrites.length, 1, 'Only the first write may reach IndexedDB');
    assert.equal(memory.state.reads, reads, 'Reads must wait until the queued clear finishes');
    memory.state.holdWrites = false; memory.state.delayedWrites.shift()();
    await oldSave; await clear; assert.equal(await loading, null); assert.equal(memory.state.values.has('current'), false, 'Late old saves must not resurrect a cleared draft');
  });
  await check('a failed delayed save does not poison queued clears, later saves, or reads', async () => {
    await saveLocalDraft(draft()); memory.state.holdWrites = true; memory.state.failNextWrite = true;
    const failed = saveLocalDraft({ ...draft(), data: { discarded: 'will fail' } });
    const rejected = errorCode('STORAGE_UNAVAILABLE', () => failed);
    const clear = clearLocalDraft(); const input = { ...draft(), data: { recovery: { value: 'new edit' } } };
    const recovery = saveLocalDraft(input); const loading = loadLocalDraft(); input.data.recovery.value = 'caller changed later';
    await new Promise(resolve => setImmediate(resolve)); assert.equal(memory.state.delayedWrites.length, 1);
    memory.state.holdWrites = false; memory.state.delayedWrites.shift()();
    await rejected; await clear; await recovery;
    assert.deepEqual((await loading).data, { recovery: { value: 'new edit' } }, 'Queued saves must copy their data at call time');
    await clearLocalDraft(); assert.equal(await loadLocalDraft(), null);
    await saveLocalDraft(draft());
  });
  await check('credentials are refused without opening or altering IndexedDB', async () => {
    const previous = structuredClone(memory.state.values.get('current')); const opens = memory.state.opens;
    for (const data of [{ accessToken: 'secret' }, { nested: { authorization: 'secret' } }, { text: 'github_pat_abcdefghijklmnopqrstuvwxyz12345' }, { text: 'ghp_abcdefghijklmnopqrstuvwxyz12345' }]) await errorCode('VALIDATION', () => saveLocalDraft({ ...draft(), data }));
    await errorCode('VALIDATION', () => saveLocalDraft({ ...draft(), token: 'must-not-store' }));
    assert.equal(memory.state.opens, opens); assert.deepEqual(memory.state.values.get('current'), previous);
  });
  await check('invalid backup versions, baseline revisions, timestamps, and non-JSON values are rejected', async () => {
    for (const value of [{ ...draft(), format: 'other', version: 1 }, { ...draft(), format: 'qmp-visual-backup', version: 2 }, { ...draft(), baseHead: 'not-a-sha' }, { ...draft(), updatedAt: 'invalid' }, { ...draft(), data: { missing: undefined } }]) await errorCode('VALIDATION', () => saveLocalDraft(value));
  });
  await check('imported staged image paths, duplicates, metadata, and base64 are checked', async () => {
    for (const path of ['assets/old.png', 'assets/uploads/../old.png', 'assets/uploads/a/b.png', 'assets/uploads/file.svg', 'https://example.com/file.png', 'assets/uploads/%2e%2e.png']) await errorCode('VALIDATION', () => saveLocalDraft({ ...draft(), assets: [asset(path)] }));
    await errorCode('VALIDATION', () => saveLocalDraft({ ...draft(), assets: [asset(), asset()] }));
    for (const base64 of ['', '%%%!', 'data:image/png;base64,' + HEADER['image/png'].toString('base64'), 'a===']) await errorCode('VALIDATION', () => saveLocalDraft({ ...draft(), assets: [{ ...asset(), base64 }] }));
    await errorCode('VALIDATION', () => saveLocalDraft({ ...draft(), assets: [{ ...asset(), width: 0 }] }));
  });
  await check('backup imports require actual raster signatures matching MIME and extension', async () => {
    for (const invalid of [asset('assets/uploads/file.png', Buffer.from('<svg></svg>')), asset('assets/uploads/file.jpg'), { ...asset(), mime: 'image/webp' }]) await errorCode('VALIDATION', () => saveLocalDraft({ ...draft(), assets: [invalid] }));
    for (const [mime, extension] of [['image/png', 'png'], ['image/jpeg', 'jpeg'], ['image/webp', 'webp'], ['image/gif', 'gif']]) {
      const result = await saveLocalDraft({ ...draft(), assets: [asset(`assets/uploads/file.${extension}`, HEADER[mime], mime)] }); assert.equal(result.assets[0].mime, mime);
    }
  });
  await check('per-image, cumulative, count and JSON limits retain the last good draft', async () => {
    await saveLocalDraft(draft()); const previous = structuredClone(memory.state.values.get('current'));
    await errorCode('LIMIT', () => saveLocalDraft({ ...draft(), assets: [asset('assets/uploads/large.png', rasterBytes(STORAGE_LIMITS.imageBytes + 1))] }));
    const overFive = rasterBytes(5 * 1024 * 1024 + 1);
    await errorCode('LIMIT', () => saveLocalDraft({ ...draft(), assets: [asset('assets/uploads/a.png', overFive), asset('assets/uploads/b.png', overFive)] }));
    await errorCode('LIMIT', () => saveLocalDraft({ ...draft(), assets: Array.from({ length: 51 }, (_, index) => asset(`assets/uploads/a${index}.png`)) }));
    await errorCode('LIMIT', () => saveLocalDraft({ ...draft(), data: { text: 'x'.repeat(STORAGE_LIMITS.jsonBytes) } }));
    assert.deepEqual(memory.state.values.get('current'), previous);
    const five = rasterBytes(5 * 1024 * 1024); await saveLocalDraft({ ...draft(), assets: [asset('assets/uploads/a.png', five), asset('assets/uploads/b.png', five)] });
    assert.equal((await loadLocalDraft()).assets.length, 2);
  });
  await check('a malformed stored draft is reported without deleting it', async () => {
    const corrupt = { ...draft(), assets: [{ ...asset(), base64: 'bad!' }] }; memory.state.values.set('current', structuredClone(corrupt));
    await errorCode('VALIDATION', loadLocalDraft); assert.deepEqual(memory.state.values.get('current'), corrupt);
    await clearLocalDraft(); assert.equal(await loadLocalDraft(), null);
  });

  let width = 4000, height = 1000, bitmapCloses = 0, oversizedPNG = false, failCanvas = false;
  replace('createImageBitmap', async () => ({ width, height, close() { bitmapCloses++; } }));
  const canvases = [];
  class Canvas {
    constructor(w, h) { this.width = w; this.height = h; this.record = { width: w, height: h, encodings: [] }; canvases.push(this.record); }
    getContext(kind, options) { assert.equal(kind, '2d'); assert.equal(options.alpha, true); if (failCanvas) throw new Error('Native error'); return { drawImage: (_source, _x, _y, w, h) => { this.record.draw = [w, h]; } }; }
    async convertToBlob(options) { this.record.encodings.push(options); return new Blob([oversizedPNG && options.type === 'image/png' ? rasterBytes(STORAGE_LIMITS.imageBytes + 1) : HEADER[options.type]], { type: options.type }); }
  }
  replace('OffscreenCanvas', Canvas);
  const file = (value, mime = '') => new Blob([value], { type: mime });
  const release = staged => URL.revokeObjectURL(staged.previewURL);
  await check('JPEG/WebP downscale to 2000px and encode WebP at quality .88', async () => {
    for (const mime of ['image/jpeg', 'image/webp']) {
      const staged = await stageImage(file(HEADER[mime], mime)); assert.equal(staged.width, 2000); assert.equal(staged.height, 500); assert.equal(staged.mime, 'image/webp');
      assert.match(staged.path, /^assets\/uploads\/\d{8}-[a-f0-9-]+\.webp$/); assert.deepEqual(canvases.at(-1).draw, [2000, 500]); assert.deepEqual(canvases.at(-1).encodings[0], { type: 'image/webp', quality: 0.88 }); release(staged);
    }
  });
  await check('PNG keeps its alpha channel and small images are not enlarged', async () => {
    width = 300; height = 600; const staged = await stageImage(file(HEADER['image/png'], 'image/png'));
    assert.equal(staged.width, 300); assert.equal(staged.height, 600); assert.equal(staged.mime, 'image/png'); assert.equal(canvases.at(-1).encodings[0].type, 'image/png'); release(staged);
  });
  await check('oversized PNG output falls back to transparent WebP', async () => {
    oversizedPNG = true; const staged = await stageImage(file(HEADER['image/png'], 'image/png')); oversizedPNG = false;
    assert.equal(staged.mime, 'image/webp'); assert.deepEqual(canvases.at(-1).encodings.map(value => value.type), ['image/png', 'image/webp']); release(staged);
  });
  await check('animated GIF bytes remain original and bypass canvas', async () => {
    width = 5000; height = 800; const before = canvases.length; const staged = await stageImage(file(HEADER['image/gif'], 'image/gif'));
    assert.equal(canvases.length, before); assert.equal(staged.width, 5000); assert.equal(staged.height, 800); assert.equal(staged.base64, HEADER['image/gif'].toString('base64')); assert.match(staged.path, /\.gif$/); release(staged);
  });
  await check('publication upload preserves original bytes and persists its display variants with the draft', async () => {
    width = 2400; height = 1200;
    const {variants, ...original} = await stageImage(file(HEADER['image/png']), {publicationFigure: true});
    assert.equal(original.base64, HEADER['image/png'].toString('base64'));
    assert.deepEqual([original.width, original.height], [2400, 1200]);
    assert.deepEqual(variants.map(({width, height, mime}) => [width, height, mime]), [[320, 160, 'image/webp'], [720, 360, 'image/webp']]);
    const thumbnail = {source: original.path, variants: variants.map(({path, width, height}) => ({src: path, width, height}))};
    await saveLocalDraft({...draft(), data: {imageThumbnail: thumbnail}, assets: [original, ...variants]});
    const restored = await loadLocalDraft();
    assert.deepEqual(restored.data.imageThumbnail, thumbnail);
    assert.deepEqual(restored.assets.map(value => value.path), [original.path, ...variants.map(value => value.path)]);
    release(original);
  });
  await check('small publication thumbnails stay at natural size without duplicate widths', async () => {
    width = 160; height = 80;
    const staged = await stageImage(file(HEADER['image/gif']), {publicationFigure: true});
    assert.equal(staged.base64, HEADER['image/gif'].toString('base64'));
    assert.deepEqual(staged.variants.map(({width, height}) => [width, height]), [[160, 80]]);
    release(staged);
  });
  await check('invalid files and original/GIF size limits fail before decoding', async () => {
    await errorCode('IMAGE', () => stageImage(file(Buffer.from('<svg></svg>'), 'image/svg+xml')));
    await errorCode('IMAGE', () => stageImage(file(Buffer.from('not an image'), 'image/png')));
    await errorCode('LIMIT', () => stageImage({ size: STORAGE_LIMITS.inputBytes + 1, arrayBuffer() { assert.fail('Oversized file must not be read'); } }));
    await errorCode('LIMIT', () => stageImage(file(rasterBytes(STORAGE_LIMITS.imageBytes + 1, 'image/gif'), 'image/gif')));
  });
  await check('decode/canvas failures are Korean errors and close decoded bitmaps', async () => {
    width = 0; height = 1; const before = bitmapCloses; await errorCode('IMAGE', () => stageImage(file(HEADER['image/png']))); assert.equal(bitmapCloses, before + 1);
    width = 100; height = 100; failCanvas = true; await errorCode('IMAGE', () => stageImage(file(HEADER['image/png']))); failCanvas = false; assert.equal(bitmapCloses, before + 2);
  });
  await check('Image and HTML canvas fallbacks work and revoke decoder object URLs', async () => {
    replace('createImageBitmap', async () => { throw new Error('Bitmap unavailable'); }); replace('OffscreenCanvas', undefined);
    replace('Image', class { constructor() { this.naturalWidth = 800; this.naturalHeight = 400; } set src(_value) { queueMicrotask(() => this.onload()); } });
    replace('document', { createElement(tag) { assert.equal(tag, 'canvas'); const result = new Canvas(0, 0); result.convertToBlob = undefined; result.toBlob = (callback, type, quality) => { assert.equal(quality, 0.88); queueMicrotask(() => callback(new Blob([HEADER[type]], { type }))); }; return result; } });
    const before = urls.size; const staged = await stageImage(file(HEADER['image/jpeg'], 'image/jpeg')); assert.equal(staged.width, 800); assert.equal(staged.height, 400); assert.equal(urls.size, before + 1, 'Only the returned preview URL should remain'); release(staged);
  });
  await check('unavailable browser storage leaves local data untouched', async () => {
    replace('indexedDB', undefined); await errorCode('STORAGE_UNAVAILABLE', loadLocalDraft); assert.ok(memory.state.closes > 0);
  });
  assert.equal(urls.size, 0, 'Tests must revoke every preview object URL');
  console.log(`Visual draft storage checks passed: ${checks} scenarios; memory-only browser mocks, no network or Git changes.`);
} finally {
  for (const url of urls) originalRevokeURL.call(URL, url);
  URL.createObjectURL = originalCreateURL; URL.revokeObjectURL = originalRevokeURL;
  for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
}
