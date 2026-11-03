// Nothing is opened, saved, or decoded until an exported function is called.
export const STORAGE_LIMITS = Object.freeze({ imageBytes: 8 * 1024 * 1024, totalImageBytes: 10 * 1024 * 1024, inputBytes: 32 * 1024 * 1024, jsonBytes: 5 * 1024 * 1024, longestEdge: 2000, imageCount: 50 });
const DATABASE = 'qmp-visual-editor', STORE = 'drafts', DRAFT_KEY = 'current';
const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const SECRET_KEY = /^(?:token|githubToken|accessToken|access_token|refreshToken|refresh_token|clientSecret|client_secret|privateKey|authorization|password|credentials?)$/i;
const SHA = /^[a-f0-9]{40}$/i;

export class DraftStorageError extends Error {
  constructor(code, message) { super(message); this.name = 'DraftStorageError'; this.code = code; }
}
const fail = (code, message) => { throw new DraftStorageError(code, message); };
const object = value => Boolean(value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
const sizeOf = text => new TextEncoder().encode(text).byteLength;
function draftData(value) {
  let nodes = 0;
  function check(item, depth = 0) {
    if (++nodes > 100000 || depth > 30) fail('VALIDATION', '초안 자료가 너무 크거나 복잡합니다.');
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
    if (typeof item === 'number' && Number.isFinite(item)) return;
    if (Array.isArray(item)) { item.forEach(child => check(child, depth + 1)); return; }
    if (!object(item)) fail('VALIDATION', '초안은 홈페이지 JSON 자료여야 합니다.');
    for (const [key, child] of Object.entries(item)) {
      if (SECRET_KEY.test(key) || ['__proto__', 'prototype', 'constructor'].includes(key)) fail('VALIDATION', 'GitHub 연결 정보는 초안에 저장할 수 없습니다.');
      check(child, depth + 1);
    }
  }
  if (!object(value)) fail('VALIDATION', '저장할 홈페이지 초안이 필요합니다.');
  check(value);
  const serialized = JSON.stringify(value);
  if (sizeOf(serialized) > STORAGE_LIMITS.jsonBytes) fail('LIMIT', '홈페이지 초안은 5MB 이하여야 합니다.');
  if (/(?:github_pat_[a-z0-9_]{20,}|gh[pousr]_[a-z0-9]{20,})/i.test(serialized)) fail('VALIDATION', '초안에 GitHub 연결 정보가 포함되어 있습니다. 해당 내용을 지운 뒤 저장하세요.');
  return JSON.parse(serialized);
}
function base64Bytes(value) {
  if (typeof value !== 'string' || !value) fail('VALIDATION', '초안 사진 파일의 인코딩을 확인하세요.');
  if (value.length > Math.ceil(STORAGE_LIMITS.imageBytes / 3) * 4) fail('LIMIT', '사진 한 장은 8MB 이하여야 합니다.');
  if (value.length % 4 || !/^[a-z0-9+/]+={0,2}$/i.test(value)) fail('VALIDATION', '초안 사진 파일의 인코딩을 확인하세요.');
  return value.length / 4 * 3 - (value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0);
}
function draftAssets(value = []) {
  if (!Array.isArray(value) || value.length > STORAGE_LIMITS.imageCount) fail('LIMIT', '사진은 한 번에 최대 50장까지 보관할 수 있습니다.');
  let total = 0; const paths = new Set();
  return value.map(asset => {
    if (!object(asset) || typeof asset.path !== 'string' || !/^assets\/uploads\/[a-z0-9][a-z0-9._-]{0,179}\.(?:webp|png|jpe?g|gif)$/i.test(asset.path) || asset.path.includes('..') || paths.has(asset.path)) fail('VALIDATION', '초안 사진의 저장 경로를 확인하세요.');
    paths.add(asset.path);
    if (!TYPES.has(asset.mime) || !Number.isInteger(asset.width) || !Number.isInteger(asset.height) || asset.width < 1 || asset.height < 1) fail('VALIDATION', '초안 사진의 형식과 크기를 확인하세요.');
    const bytes = base64Bytes(asset.base64); total += bytes;
    if (bytes > STORAGE_LIMITS.imageBytes || total > STORAGE_LIMITS.totalImageBytes) fail('LIMIT', '사진 한 장은 8MB, 초안 사진 전체는 10MB 이하여야 합니다.');
    let actualType;
    try { actualType = imageType(Uint8Array.from(atob(asset.base64.slice(0, 32)), char => char.charCodeAt(0)).buffer); }
    catch { fail('VALIDATION', '초안 사진의 실제 이미지 형식을 확인하세요.'); }
    const extensionType = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }[asset.path.split('.').at(-1).toLowerCase()];
    if (actualType !== asset.mime || extensionType !== asset.mime) fail('VALIDATION', '초안 사진의 확장자와 이미지 형식이 일치하지 않습니다.');
    return { path: asset.path, width: asset.width, height: asset.height, base64: asset.base64, mime: asset.mime };
  });
}
function normalizedDraft(value) {
  if (!object(value)) fail('VALIDATION', '저장할 초안이 필요합니다.');
  if (Object.keys(value).some(key => SECRET_KEY.test(key))) fail('VALIDATION', 'GitHub 연결 정보는 초안에 저장할 수 없습니다.');
  if ((value.format !== undefined || value.version !== undefined) && (value.format !== 'qmp-visual-backup' || value.version !== 1)) fail('VALIDATION', '지원하는 편집기 백업 파일이 아닙니다.');
  const baseHead = value.baseHead === undefined ? '' : value.baseHead;
  if (typeof baseHead !== 'string' || (baseHead && !SHA.test(baseHead))) fail('VALIDATION', '초안의 기준 버전을 확인하세요.');
  const updatedAt = value.updatedAt === undefined ? new Date().toISOString() : value.updatedAt;
  if (typeof updatedAt !== 'string' || !Number.isFinite(Date.parse(updatedAt))) fail('VALIDATION', '초안 저장 시간을 확인하세요.');
  return { data: draftData(value.data), baseHead, assets: draftAssets(value.assets), updatedAt };
}
function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new DraftStorageError('STORAGE_UNAVAILABLE', '이 브라우저에서 초안 저장 공간을 사용할 수 없습니다.'));
    let request; let settled = false;
    try { request = globalThis.indexedDB.open(DATABASE, 1); } catch { return reject(new DraftStorageError('STORAGE_UNAVAILABLE', '브라우저의 초안 저장 권한을 확인하세요.')); }
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
    request.onerror = () => { settled = true; reject(new DraftStorageError('STORAGE_UNAVAILABLE', '초안 저장 공간을 열지 못했습니다. 브라우저 저장 설정을 확인하세요.')); };
    request.onblocked = () => { settled = true; reject(new DraftStorageError('STORAGE_UNAVAILABLE', '다른 편집기 탭을 닫은 뒤 다시 저장하세요.')); };
    request.onsuccess = () => { if (settled) request.result.close(); else { settled = true; resolve(request.result); } };
  });
}
async function transaction(mode, operation) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      let tx; let request;
      try { tx = database.transaction(STORE, mode); request = operation(tx.objectStore(STORE)); }
      catch { return reject(new DraftStorageError('STORAGE_UNAVAILABLE', '브라우저 초안 저장 공간을 사용할 수 없습니다.')); }
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () => reject(new DraftStorageError('STORAGE_UNAVAILABLE', '초안을 저장하지 못했습니다. 저장 공간을 확인하세요. 이전 초안은 유지됩니다.'));
    });
  } finally { database.close(); }
}
export async function loadLocalDraft() { const value = await transaction('readonly', store => store.get(DRAFT_KEY)); return value === undefined ? null : normalizedDraft(value); }
export async function saveLocalDraft(value) { const draft = normalizedDraft(value); await transaction('readwrite', store => store.put(draft, DRAFT_KEY)); return draft; }
export async function clearLocalDraft() { await transaction('readwrite', store => store.delete(DRAFT_KEY)); return true; }

function imageType(buffer) {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 16));
  const text = String.fromCharCode(...bytes);
  if (text.startsWith('\x89PNG\r\n\x1a\n')) return 'image/png';
  if (text.startsWith('\xff\xd8\xff')) return 'image/jpeg';
  if (/^GIF8[79]a/.test(text)) return 'image/gif';
  if (text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP') return 'image/webp';
  fail('IMAGE', 'PNG·JPG·WebP·GIF 사진만 사용할 수 있습니다. SVG와 그 밖의 파일은 지원하지 않습니다.');
}
async function decodeImage(blob) {
  if (typeof globalThis.createImageBitmap === 'function') {
    try { const bitmap = await globalThis.createImageBitmap(blob, { imageOrientation: 'from-image' }); return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() }; } catch { /* Older browsers may need an Image element. */ }
  }
  if (typeof globalThis.Image !== 'function' || typeof URL.createObjectURL !== 'function') fail('IMAGE', '이 브라우저에서 사진을 읽을 수 없습니다. 다른 브라우저를 사용해 주세요.');
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const image = new globalThis.Image(); image.decoding = 'async';
    image.onload = () => resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) });
    image.onerror = () => { URL.revokeObjectURL(url); reject(new DraftStorageError('IMAGE', '사진 파일이 손상되었거나 읽을 수 없습니다.')); };
    image.src = url;
  });
}
function canvas(width, height) {
  const result = typeof globalThis.OffscreenCanvas === 'function' ? new globalThis.OffscreenCanvas(width, height) : globalThis.document?.createElement('canvas');
  if (!result) fail('IMAGE', '이 브라우저에서 사진 크기를 조절할 수 없습니다.');
  result.width = width; result.height = height; return result;
}
async function encodeImage(canvas, type) {
  try {
    const blob = typeof canvas.convertToBlob === 'function' ? await canvas.convertToBlob({ type, quality: 0.88 }) : await new Promise(resolve => canvas.toBlob(resolve, type, 0.88));
    if (!blob || !TYPES.has(blob.type) || blob.type === 'image/gif') fail('IMAGE', '사진 파일을 변환하지 못했습니다.');
    return blob;
  } catch (error) { if (error instanceof DraftStorageError) throw error; fail('IMAGE', '사진 파일을 변환하지 못했습니다.'); }
}
async function base64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer()); const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += 32768) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)));
  return btoa(chunks.join(''));
}
function uploadPath(mime) {
  const date = new Date(); const stamp = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('');
  let id;
  if (typeof globalThis.crypto?.randomUUID === 'function') id = globalThis.crypto.randomUUID();
  else if (typeof globalThis.crypto?.getRandomValues === 'function') id = [...globalThis.crypto.getRandomValues(new Uint8Array(16))].map(value => value.toString(16).padStart(2, '0')).join('');
  else fail('IMAGE', '안전한 사진 파일 이름을 만들 수 없습니다. HTTPS 주소에서 편집기를 열어 주세요.');
  const extension = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif' }[mime];
  return `assets/uploads/${stamp}-${id}.${extension}`;
}
export async function stageImage(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || !Number.isFinite(file.size) || file.size < 1) fail('IMAGE', '업로드할 사진 파일을 선택하세요.');
  if (file.size > STORAGE_LIMITS.inputBytes) fail('LIMIT', '원본 사진은 32MB 이하여야 합니다.');
  let buffer;
  try { buffer = await file.arrayBuffer(); } catch { fail('IMAGE', '사진 파일을 읽지 못했습니다.'); }
  if (!(buffer instanceof ArrayBuffer) || !buffer.byteLength) fail('IMAGE', '사진 파일을 읽지 못했습니다.');
  if (buffer.byteLength > STORAGE_LIMITS.inputBytes) fail('LIMIT', '원본 사진은 32MB 이하여야 합니다.');
  const mime = imageType(buffer);
  if (mime === 'image/gif' && buffer.byteLength > STORAGE_LIMITS.imageBytes) fail('LIMIT', '움직이는 GIF는 원본을 보존하므로 8MB 이하 파일을 선택하세요.');
  const original = new Blob([buffer], { type: mime });
  const decoded = await decodeImage(original);
  try {
    if (!Number.isInteger(decoded.width) || !Number.isInteger(decoded.height) || decoded.width < 1 || decoded.height < 1) fail('IMAGE', '사진의 가로·세로 크기를 확인할 수 없습니다.');
    let output = original, width = decoded.width, height = decoded.height;
    if (mime !== 'image/gif') {
      const scale = Math.min(1, STORAGE_LIMITS.longestEdge / Math.max(width, height));
      width = Math.max(1, Math.round(width * scale)); height = Math.max(1, Math.round(height * scale));
      const drawing = canvas(width, height); const context = drawing.getContext('2d', { alpha: true });
      if (!context) fail('IMAGE', '사진 크기를 조절할 수 없습니다.');
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'; context.drawImage(decoded.source, 0, 0, width, height);
      output = await encodeImage(drawing, mime === 'image/png' ? 'image/png' : 'image/webp');
      if (mime === 'image/png' && output.size > STORAGE_LIMITS.imageBytes) output = await encodeImage(drawing, 'image/webp');
    }
    if (!output.size || output.size > STORAGE_LIMITS.imageBytes) fail('LIMIT', '변환한 사진이 8MB를 넘습니다. 더 작은 사진을 선택하세요.');
    const encoded = await base64(output); const path = uploadPath(output.type);
    if (typeof URL.createObjectURL !== 'function') fail('IMAGE', '사진 미리보기를 만들 수 없습니다.');
    return { path, width, height, base64: encoded, mime: output.type, previewURL: URL.createObjectURL(output) };
  } catch (error) { if (error instanceof DraftStorageError) throw error; fail('IMAGE', '사진을 변환하지 못했습니다. 다른 사진으로 다시 시도하세요.'); }
  finally { decoded.close(); }
}
