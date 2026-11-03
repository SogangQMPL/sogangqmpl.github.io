// Shared by the browser editor and the optional authenticated server.
// Credentials live only in the caller's memory and are never part of a snapshot.
export const DEFAULT_REPOSITORY = Object.freeze({ owner: 'SogangQMPL', repo: 'sogangqmpl.github.io', branch: 'main' });
export const PUBLICATION_LIMITS = Object.freeze({ jsonBytes: 5 * 1024 * 1024, assetBytes: 10 * 1024 * 1024, totalAssetBytes: 30 * 1024 * 1024, assetCount: 50 });
const API = 'https://api.github.com';
const API_VERSION = '2026-03-10';
const CONTENT_PATH = 'content/site.json';
const SHA = /^[a-f0-9]{40}$/i;
const ID = /^[a-z0-9][a-z0-9_-]{0,159}$/i;
const REPO_URL = `https://github.com/${DEFAULT_REPOSITORY.owner}/${DEFAULT_REPOSITORY.repo}`;

export class GitHubPublishError extends Error {
  constructor(code, message, status = 0) { super(message); this.name = 'GitHubPublishError'; this.code = code; this.status = status; }
}
const invalid = message => { throw new GitHubPublishError('VALIDATION', message); };
const object = value => Boolean(value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
const bytes = value => new TextEncoder().encode(value).byteLength;
function configuration(options) {
  for (const key of ['owner', 'repo', 'branch']) if (options[key] !== undefined && options[key] !== DEFAULT_REPOSITORY[key]) invalid('이 편집기는 지정된 연구실 저장소의 main 브랜치만 사용합니다.');
  return DEFAULT_REPOSITORY;
}
function credential(value = '') {
  if (typeof value !== 'string' || /\s/.test(value)) invalid('GitHub 연결 정보를 다시 확인하세요.');
  return value;
}
function sha(value) { if (typeof value !== 'string' || !SHA.test(value)) invalid('유효한 기준 버전이 필요합니다. 최신 내용을 다시 불러오세요.'); return value; }
function safeURL(value, { local = true, internal = false } = {}) {
  if (typeof value !== 'string') return false;
  if (!value) return true;
  if (internal && /^(?:index|research|people|students|publications|news|activities|join)\.html(?:#[a-z0-9_-]+)?$/i.test(value)) return true;
  if (local && /^(?:\.\/)?assets\/[a-z0-9_./%() -]+$/i.test(value)) {
    try { const decoded = decodeURIComponent(value); return !decoded.includes('..') && !/[\\?#\u0000-\u001f]/.test(decoded); } catch { return false; }
  }
  if (/\s/.test(value)) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
function strings(item, keys, context) { for (const key of keys) if (item[key] !== undefined && typeof item[key] !== 'string') invalid(`${context}의 글자 입력값을 확인하세요.`); }
function stringList(value, context) { if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim())) invalid(`${context} 목록을 확인하세요.`); }
function links(item, keys, context, options) { for (const key of keys) if (item[key] !== undefined && !safeURL(item[key], options)) invalid(`${context}의 주소는 안전한 https:// 주소 또는 허용된 이미지 경로여야 합니다.`); }
function dimensions(item, keys, context) { for (const key of keys) if (item[key] !== undefined && (typeof item[key] !== 'number' || !Number.isFinite(item[key]) || item[key] <= 0)) invalid(`${context}의 그림 크기를 확인하세요.`); }
function inline(value) {
  if (!object(value)) invalid('게시물의 문장 형식을 확인하세요.');
  strings(value, ['text', 'url'], '게시물'); links(value, ['url'], '게시물');
  for (const key of ['bold', 'italic']) if (value[key] !== undefined && typeof value[key] !== 'boolean') invalid('게시물의 강조 형식을 확인하세요.');
  if (value.children !== undefined) { if (!Array.isArray(value.children)) invalid('게시물의 문장 목록을 확인하세요.'); value.children.forEach(inline); }
}
function image(value, context, localOnly = false) {
  if (!object(value)) invalid(`${context}의 그림 항목을 확인하세요.`);
  strings(value, ['src', 'fullSrc', 'alt', 'caption', 'sourceURL', 'source'], context);
  for (const key of ['src', 'fullSrc']) if (value[key] !== undefined && (!safeURL(value[key]) || (localOnly && value[key] && !/^(?:\.\/)?assets\//.test(value[key])))) invalid(`${context}의 그림 주소를 확인하세요.`);
  if (!value.src?.trim() || !value.alt?.trim()) invalid(`${context}의 그림 주소와 설명을 입력하세요.`);
  links(value, ['sourceURL'], context, { local: false }); dimensions(value, ['width', 'height'], context);
}

/** Validate and copy JSON without changing caller-owned content or unknown metadata. */
export function validateSiteData(value) {
  let count = 0;
  function json(item, depth = 0) {
    if (++count > 100000 || depth > 30) invalid('홈페이지 자료가 너무 크거나 복잡합니다.');
    if (item === null || typeof item === 'boolean') return;
    if (typeof item === 'string') { if (item.length > 500000) invalid('한 항목의 글이 너무 깁니다.'); return; }
    if (typeof item === 'number') { if (!Number.isFinite(item)) invalid('숫자 입력값을 확인하세요.'); return; }
    if (Array.isArray(item)) { if (item.length > 10000) invalid('목록에 항목이 너무 많습니다.'); item.forEach(child => json(child, depth + 1)); return; }
    if (!object(item)) invalid('전체 홈페이지 JSON 객체가 필요합니다.');
    for (const [key, child] of Object.entries(item)) { if (['__proto__', 'prototype', 'constructor'].includes(key)) invalid('허용되지 않은 자료 필드가 있습니다.'); json(child, depth + 1); }
  }
  json(value);
  if (!object(value) || ['site', 'hero', 'join'].some(key => !object(value[key]))) invalid('연구실 기본 정보가 포함된 전체 홈페이지 자료가 필요합니다.');
  for (const key of ['site', 'hero', 'join']) strings(value[key], ['title', 'shortName', 'group', 'description', 'image', 'imageAlt', 'email', 'address', 'affiliation', 'office', 'laboratory'], '기본 정보');
  if (!value.site.title?.trim() || typeof value.hero.title !== 'string' || typeof value.join.title !== 'string' || typeof value.join.description !== 'string') invalid('연구실 이름과 모집 안내를 확인하세요.');
  links(value.site, ['repositoryUrl'], '기본 정보', { local: false }); links(value.hero, ['image'], '홈 화면');
  if (value.announcement !== undefined) {
    if (!object(value.announcement)) invalid('공지 형식을 확인하세요.');
    strings(value.announcement, ['title', 'body', 'url'], '공지'); links(value.announcement, ['url'], '공지', { internal: true, local: false });
    if (value.announcement.enabled !== undefined && typeof value.announcement.enabled !== 'boolean') invalid('공지 표시 설정을 확인하세요.');
  }
  const ids = new Set();
  function identity(item, titleKey = 'title') {
    if (!object(item) || typeof item.id !== 'string' || !ID.test(item.id) || ids.has(item.id)) invalid('항목 ID가 없거나 중복되었습니다.');
    ids.add(item.id); if (typeof item[titleKey] !== 'string' || !item[titleKey].trim()) invalid('항목 제목 또는 이름을 입력하세요.');
  }
  for (const key of ['research', 'publications', 'news', 'people', 'underReview']) {
    const list = value[key];
    if (key === 'underReview' && list === undefined) continue;
    if (!Array.isArray(list)) invalid('연구·논문·소식·구성원 목록이 포함된 전체 자료가 필요합니다.');
    for (const item of list) {
      identity(item, key === 'people' ? 'name' : 'title');
      strings(item, ['title', 'name', 'authors', 'journal', 'date', 'category', 'role', 'description', 'summary', 'excerpt', 'body', 'image', 'imageAlt', 'icon', 'url'], '항목');
      if (['publications', 'underReview'].includes(key) && item.titleSegments !== undefined) {
        if (!Array.isArray(item.titleSegments) || item.titleSegments.length > 1000 || item.titleSegments.some(run => !object(run) || typeof run.text !== 'string' || (run.italic !== undefined && typeof run.italic !== 'boolean'))) invalid('논문 제목의 기울임꼴 서식을 확인하세요.');
      }
      links(item, ['image', 'icon', 'url', 'imageSource'], '항목');
      if (item.labAuthors !== undefined) stringList(item.labAuthors, '연구실 저자');
      if (key === 'publications' && (!Number.isInteger(Number(item.year)) || Number(item.year) < 1900 || Number(item.year) > 2100)) invalid('논문 출판 연도를 확인하세요.');
      if (key === 'underReview' && !item.authors?.trim()) invalid('심사 중 논문의 저자를 입력하세요.');
      if (key !== 'news') continue;
      const date = item.date?.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
      if (!date || +date[2] < 1 || +date[2] > 12 || (date[3] && (+date[3] < 1 || +date[3] > new Date(Date.UTC(+date[1], +date[2], 0)).getUTCDate()))) invalid('소식 날짜를 실제 YYYY-MM 또는 YYYY-MM-DD 형식으로 입력하세요.');
      if (item.facts !== undefined && (!Array.isArray(item.facts) || item.facts.some(fact => !object(fact) || typeof fact.label !== 'string' || typeof fact.value !== 'string'))) invalid('보관된 수상 정보 형식을 확인하세요.');
      if (item.content !== undefined) {
        if (!Array.isArray(item.content)) invalid('게시물 내용은 문단과 그림 목록이어야 합니다.');
        for (const block of item.content) {
          if (!object(block) || !['paragraph', 'heading', 'image', 'list', 'quote'].includes(block.type)) invalid('게시물 내용 형식을 확인하세요.');
          if (block.type === 'image') image(block, '게시물', true);
          else if (block.type === 'list') {
            if (!Array.isArray(block.items)) invalid('게시물 목록 항목을 확인하세요.');
            block.items.forEach(item => { if (typeof item !== 'string') inline(item); });
          } else inline(block);
        }
      }
    }
  }
  const publicationIds = new Set(value.publications.map(item => item.id));
  function paperIds(item) { for (const key of ['paperIds', 'sourcePaperIds']) if (item[key] !== undefined) { stringList(item[key], '관련 논문'); if (item[key].some(id => !publicationIds.has(id))) invalid('연결한 관련 논문을 먼저 등록하세요.'); } }
  for (const category of value.research) {
    paperIds(category); if (category.scope !== undefined) stringList(category.scope, '연구 관심 분야');
    if (category.topics !== undefined && !Array.isArray(category.topics)) invalid('하위 연구 주제 목록을 확인하세요.');
    for (const topic of category.topics || []) {
      identity(topic); paperIds(topic);
      strings(topic, ['summary', 'description', 'image', 'imageAlt', 'schematic', 'schematicAlt', 'source', 'status'], '연구 주제'); links(topic, ['image', 'schematic', 'source'], '연구 주제');
      if (topic.outcomes !== undefined) {
        if (!Array.isArray(topic.outcomes)) invalid('연구 결과 목록을 확인하세요.');
        for (const outcome of topic.outcomes) { if (!object(outcome) || typeof outcome.title !== 'string') invalid('연구 결과의 표시 제목을 확인하세요.'); paperIds(outcome); }
      }
      if (topic.focus !== undefined) stringList(topic.focus, '연구 초점');
      dimensions(topic, ['schematicWidth', 'schematicHeight'], '연구 주제');
      if (topic.detailImages !== undefined) { if (!Array.isArray(topic.detailImages)) invalid('상세 그림 목록을 확인하세요.'); topic.detailImages.forEach(item => image(item, '연구 상세')); }
      if (topic.detailSections !== undefined) {
        if (!Array.isArray(topic.detailSections)) invalid('상세 설명 목록을 확인하세요.');
        for (const section of topic.detailSections) {
          if (!object(section) || typeof section.title !== 'string' || typeof section.body !== 'string' || !Array.isArray(section.images) || (!section.body.trim() && !section.images.length)) invalid('상세 설명의 본문이나 그림을 입력하세요.');
          section.images.forEach(item => image(item, '연구 상세'));
        }
      }
    }
  }
  const routes = new Set(value.news.map(post => post.id));
  for (const post of value.news) if (post.aliases !== undefined) {
    if (!Array.isArray(post.aliases)) invalid('게시물 이전 주소 목록을 확인하세요.');
    for (const alias of post.aliases) { if (typeof alias !== 'string' || !ID.test(alias) || routes.has(alias)) invalid('게시물 이전 주소가 중복되었거나 올바르지 않습니다.'); routes.add(alias); }
  }
  if (value.publicationYearGroups !== undefined && (!Array.isArray(value.publicationYearGroups) || value.publicationYearGroups.some(period => !object(period) || !Number.isInteger(period.from) || !Number.isInteger(period.to) || period.from > period.to))) invalid('논문 연도 묶음을 확인하세요.');
  const serialized = JSON.stringify(value);
  if (bytes(serialized) > PUBLICATION_LIMITS.jsonBytes) invalid('홈페이지 자료는 5MB 이하여야 합니다.');
  return JSON.parse(serialized);
}

function assetsToPublish(assets = []) {
  if (!Array.isArray(assets) || assets.length > PUBLICATION_LIMITS.assetCount) invalid('사진은 한 번에 최대 50장까지 올릴 수 있습니다.');
  let total = 0; const paths = new Set();
  return assets.map(asset => {
    if (!object(asset) || typeof asset.path !== 'string' || !/^assets\/uploads\/[a-z0-9][a-z0-9._-]{0,179}\.(?:webp|png|jpe?g|gif)$/i.test(asset.path) || asset.path.includes('..') || paths.has(asset.path)) invalid('사진은 assets/uploads 폴더의 중복되지 않는 이미지 파일이어야 합니다.');
    paths.add(asset.path);
    if (typeof asset.base64 !== 'string' || asset.base64.length > Math.ceil(PUBLICATION_LIMITS.assetBytes / 3) * 4 + 1024) invalid('사진 한 장은 10MB 이하여야 합니다.');
    const base64 = asset.base64.replace(/[\r\n\t ]/g, '');
    if (!base64 || base64.length % 4 !== 0 || !/^[a-z0-9+/]+={0,2}$/i.test(base64)) invalid('사진 파일의 인코딩을 확인하세요.');
    const size = base64.length / 4 * 3 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
    total += size;
    if (size > PUBLICATION_LIMITS.assetBytes || total > PUBLICATION_LIMITS.totalAssetBytes) invalid('사진 한 장은 10MB, 한 번에 올리는 사진은 총 30MB 이하여야 합니다.');
    const header = atob(base64.slice(0, 32)); const extension = asset.path.split('.').at(-1).toLowerCase();
    const valid = extension === 'png' ? header.startsWith('\x89PNG\r\n\x1a\n') : ['jpg', 'jpeg'].includes(extension) ? header.startsWith('\xff\xd8\xff') : extension === 'gif' ? /^GIF8[79]a/.test(header) : header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP';
    if (!valid) invalid('파일 확장자와 실제 이미지 형식이 일치하지 않습니다.');
    return { path: asset.path, base64, size };
  });
}

// This helper only receives paths assembled by the fixed-repository operations below.
async function requestGitHub(path, { token = '', fetchImpl = globalThis.fetch, method = 'GET', body, accept = 'application/vnd.github+json' } = {}) {
  if (typeof path !== 'string' || !path.startsWith(`/repos/${DEFAULT_REPOSITORY.owner}/${DEFAULT_REPOSITORY.repo}/`) || path.includes('..') || path.includes('#') || /[\r\n\\]/.test(path)) invalid('허용되지 않은 GitHub API 요청입니다.');
  if (typeof fetchImpl !== 'function') invalid('GitHub 연결 기능을 사용할 수 없습니다.');
  const headers = { Accept: accept, 'X-GitHub-Api-Version': API_VERSION, 'User-Agent': 'Sogang-QMPL-Editor' };
  const secret = credential(token); if (secret) headers.Authorization = `Bearer ${secret}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try { response = await fetchImpl(API + path, { method, headers, credentials: 'omit', redirect: 'error', cache: 'no-store', ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
  catch { throw new GitHubPublishError('NETWORK', 'GitHub 연결이 끊겼습니다. 초안을 유지하고 다시 확인하세요.'); }
  if (!response.ok) {
    const limited = response.status === 429 || (response.status === 403 && response.headers?.get?.('x-ratelimit-remaining') === '0');
    if (limited) {
      const retry = Number(response.headers?.get?.('retry-after') || NaN);
      const reset = Number(response.headers?.get?.('x-ratelimit-reset') || NaN) - Date.now() / 1000;
      const seconds = Number.isFinite(retry) && retry > 0 ? retry : Number.isFinite(reset) && reset > 0 ? reset : 0;
      const wait = seconds > 0 && seconds <= 86400 ? `약 ${Math.max(1, Math.ceil(seconds / 60))}분 뒤 다시 시도하세요.` : '잠시 후 다시 시도하세요.';
      const error = new GitHubPublishError('RATE_LIMIT', `GitHub 요청 한도를 초과했습니다. ${wait} 초안은 유지됩니다.`, response.status);
      if (seconds > 0 && seconds <= 86400) error.retryAfter = Math.ceil(seconds);
      throw error;
    }
    const code = response.status === 401 ? 'AUTH_REQUIRED' : response.status === 403 ? 'FORBIDDEN' : 'HTTP_ERROR';
    throw new GitHubPublishError(code, response.status === 401 ? 'GitHub 연결 정보가 만료되었거나 올바르지 않습니다.' : response.status === 403 ? '이 저장소를 수정할 권한과 GitHub 사용 제한을 확인하세요.' : `GitHub 요청을 완료하지 못했습니다. (${response.status})`, response.status);
  }
  try { return await response.json(); } catch { throw new GitHubPublishError('INVALID_RESPONSE', 'GitHub 응답을 확인하지 못했습니다. 초안을 유지하세요.'); }
}
const prefix = `/repos/${DEFAULT_REPOSITORY.owner}/${DEFAULT_REPOSITORY.repo}`;
const readOptions = options => ({ token: credential(options.token), fetchImpl: options.fetchImpl });
async function head(options) { const result = await requestGitHub(`${prefix}/git/ref/heads/main`, options); return sha(result?.object?.sha); }
function revision(commit) { return { sha: sha(commit.sha), message: typeof commit.message === 'string' ? commit.message : '', date: commit.committer?.date || commit.author?.date || '' }; }
async function snapshotAt(commitSha, options) {
  const commit = await requestGitHub(`${prefix}/git/commits/${sha(commitSha)}`, options);
  const tree = sha(commit?.tree?.sha);
  const data = validateSiteData(await requestGitHub(`${prefix}/contents/${CONTENT_PATH}?ref=${commitSha}`, { ...options, accept: 'application/vnd.github.raw+json' }));
  return { ...DEFAULT_REPOSITORY, data, head: sha(commitSha), tree, revision: revision(commit) };
}
export async function loadSnapshot(options = {}) { configuration(options); const request = readOptions(options); return snapshotAt(await head(request), request); }
export async function loadRevision(options = {}) { configuration(options); return snapshotAt(sha(options.sha), readOptions(options)); }
export async function listRevisions(options = {}) {
  configuration(options);
  const result = await requestGitHub(`${prefix}/commits?path=content%2Fsite.json&sha=main&per_page=30`, readOptions(options));
  if (!Array.isArray(result)) throw new GitHubPublishError('INVALID_RESPONSE', '수정 이력을 확인하지 못했습니다.');
  return result.map(item => ({ sha: sha(item.sha), message: item.commit?.message || '', date: item.commit?.committer?.date || item.commit?.author?.date || '', url: `${REPO_URL}/commit/${sha(item.sha)}` }));
}

export async function publishSnapshot(options = {}) {
  configuration(options);
  const token = credential(options.token); if (!token) throw new GitHubPublishError('AUTH_REQUIRED', '게시하려면 GitHub에 연결하세요.');
  const baseHead = sha(options.baseHead);
  const data = validateSiteData(options.data);
  const content = JSON.stringify(data, null, 2) + '\n';
  if (bytes(content) > PUBLICATION_LIMITS.jsonBytes) invalid('홈페이지 자료는 5MB 이하여야 합니다.');
  if (token.length >= 8 && content.includes(token)) invalid('홈페이지 자료에 연결 정보가 포함되어 있습니다. 해당 내용을 지운 뒤 다시 게시하세요.');
  const assets = assetsToPublish(options.assets);
  const message = options.message === undefined ? 'Update lab website content' : options.message;
  if (typeof message !== 'string' || !message.trim() || message.length > 500) invalid('게시 메시지는 1~500자의 글자로 입력하세요.');
  const request = { token, fetchImpl: options.fetchImpl };
  if (await head(request) !== baseHead) throw new GitHubPublishError('CONFLICT', '다른 수정이 먼저 게시되었습니다. 초안을 보관하고 최신 내용을 다시 불러오세요.', 409);
  const base = await requestGitHub(`${prefix}/git/commits/${baseHead}`, request);
  const treeEntries = [{ path: CONTENT_PATH, mode: '100644', type: 'blob', content }];
  // Sequential uploads avoid GitHub secondary limits and never publish a partial tree.
  for (const asset of assets) {
    const blob = await requestGitHub(`${prefix}/git/blobs`, { ...request, method: 'POST', body: { content: asset.base64, encoding: 'base64' } });
    treeEntries.push({ path: asset.path, mode: '100644', type: 'blob', sha: sha(blob.sha) });
  }
  const tree = await requestGitHub(`${prefix}/git/trees`, { ...request, method: 'POST', body: { base_tree: sha(base?.tree?.sha), tree: treeEntries } });
  const commit = await requestGitHub(`${prefix}/git/commits`, { ...request, method: 'POST', body: { message: message.trim(), tree: sha(tree.sha), parents: [baseHead] } });
  const newHead = sha(commit.sha);
  const result = { sha: newHead, previousHead: baseHead, tree: sha(tree.sha), commitUrl: `${REPO_URL}/commit/${newHead}`, reconciled: false };
  // Recheck after uploads, then rely on fast-forward-only ref updates for the final race.
  if (await head(request) !== baseHead) throw new GitHubPublishError('CONFLICT', '다른 수정이 먼저 게시되었습니다. 초안은 유지되며 공개 내용은 덮어쓰지 않았습니다.', 409);
  try {
    const updated = await requestGitHub(`${prefix}/git/refs/heads/main`, { ...request, method: 'PATCH', body: { sha: newHead, force: false } });
    if (updated?.object?.sha !== newHead) throw new GitHubPublishError('INVALID_RESPONSE', '게시 결과를 다시 확인하고 있습니다.');
  }
  catch (error) {
    let actual;
    try { actual = await head(request); } catch { throw new GitHubPublishError('PUBLISH_UNCERTAIN', '게시 결과를 확인할 수 없습니다. 초안을 보관하고 GitHub 게시 상태를 먼저 확인하세요.'); }
    if (actual === newHead) return { ...result, reconciled: true };
    if (actual !== baseHead) throw new GitHubPublishError('CONFLICT', '다른 수정이 먼저 게시되었습니다. 초안은 유지되며 공개 내용은 덮어쓰지 않았습니다.', 409);
    throw error;
  }
  return result;
}

export async function getDeploymentStatus(options = {}) {
  configuration(options); const requestedSha = sha(options.sha);
  const result = await requestGitHub(`${prefix}/actions/workflows/pages.yml/runs?branch=main&event=push&head_sha=${requestedSha}&per_page=10`, readOptions(options));
  if (!Array.isArray(result.workflow_runs)) throw new GitHubPublishError('INVALID_RESPONSE', '게시 상태를 확인하지 못했습니다.');
  const run = result.workflow_runs.find(item => item.head_sha === requestedSha);
  const state = !run ? 'pending' : run.status === 'completed' ? run.conclusion === 'success' ? 'success' : 'failure' : run.status === 'in_progress' ? 'building' : 'pending';
  const runId = Number.isSafeInteger(run?.id) && run.id > 0 ? run.id : null;
  return { sha: requestedSha, state, status: run?.status || null, conclusion: run?.conclusion || null, runId, url: runId ? `${REPO_URL}/actions/runs/${runId}` : `${REPO_URL}/actions` };
}
