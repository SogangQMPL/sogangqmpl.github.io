const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);
const inspectorRuns = new WeakMap();
const stagedPreviews = new Map();

function pointerParts(path) {
  if (path === '') return [];
  if (typeof path !== 'string' || !path.startsWith('/') || /~(?![01])/.test(path)) throw new Error('편집할 항목을 다시 선택해 주세요.');
  return path.slice(1).split('/').map((part) => {
    const key = part.replaceAll('~1', '/').replaceAll('~0', '~');
    if (forbiddenKeys.has(key)) throw new Error('이 항목은 편집할 수 없습니다.');
    return key;
  });
}

export function getAt(data, path) {
  return pointerParts(path).reduce((value, key) => value && typeof value === 'object' && Object.hasOwn(value, key) ? value[key] : undefined, data);
}

export function setAt(data, path, value) {
  const parts = pointerParts(path);
  if (!parts.length) throw new Error('수정할 항목을 선택해 주세요.');
  let current = data;
  for (let index = 0; index < parts.length; index++) {
    const key = parts[index];
    if (!current || typeof current !== 'object') throw new Error('편집할 항목이 변경되었습니다. 다시 선택해 주세요.');
    if (Array.isArray(current) && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) > current.length)) throw new Error('편집할 항목의 순서가 변경되었습니다. 다시 선택해 주세요.');
    if (index === parts.length - 1) current[key] = value;
    else {
      if (!Object.hasOwn(current, key) || current[key] == null) current[key] = /^(0|[1-9]\d*)$/.test(parts[index + 1]) ? [] : {};
      current = current[key];
    }
  }
  return data;
}

function removeAt(data, path) {
  const parts = pointerParts(path), key = parts.pop();
  const parent = parts.reduce((value, part) => value && typeof value === 'object' && Object.hasOwn(value, part) ? value[part] : undefined, data);
  if (parent && typeof parent === 'object' && !Array.isArray(parent)) delete parent[key];
}

function element(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function plainText(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  return Array.isArray(value.children) ? value.children.map(plainText).join('') : String(value.text || '');
}

function validURL(value, {image = false, internal = false} = {}) {
  if (!value) return true;
  if (image && /^(?:\.\/)?assets\/[a-z0-9_./%() -]+$/i.test(value) && !value.includes('..')) return true;
  if (internal && /^[a-z0-9_-]+\.html(?:[?#][^\s<>"']*)?$/i.test(value)) return true;
  if (!/^https:\/\/[^\s<>"']+$/i.test(value)) return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function imageURL(value) {
  if (stagedPreviews.has(value)) return stagedPreviews.get(value);
  return /^(?:\.\/)?assets\//.test(value || '') ? new URL('../' + value.replace(/^\.\//, ''), import.meta.url).href : value;
}

function syncPostText(data, path) {
  const match = path.match(/^\/news\/(\d+)\/content\/\d+(?:\/|$)/);
  if (!match) return;
  const post = data.news?.[Number(match[1])];
  if (!post || !Array.isArray(post.content)) return;
  const text = post.content.filter((block) => ['paragraph', 'quote'].includes(block.type)).map(plainText).filter(Boolean).join('\n\n');
  post.body = text;
  post.summary = text;
}

function relatedRecord(path) {
  const parts = pointerParts(path);
  if (parts[0] === 'research' && parts[2] === 'topics' && parts[3] !== undefined) return '/research/' + parts[1] + '/topics/' + parts[3];
  if (['news', 'people', 'publications', 'underReview', 'research'].includes(parts[0]) && parts[1] !== undefined) return '/' + parts.slice(0, 2).join('/');
  if (['site', 'hero', 'announcement', 'join'].includes(parts[0])) return '/' + parts[0];
  return '';
}

export function renderInspector({root, data, selection, onChange, stageImage, onChooseRecord, resolveImage}) {
  const doc = root.ownerDocument, run = {};
  const previewImage = value => resolveImage ? resolveImage(value) : imageURL(value);
  inspectorRuns.set(root, run);
  root.replaceChildren();
  const alive = () => inspectorRuns.get(root) === run && root.contains(heading);
  const feedback = element(doc, 'p', '', 'field-feedback');
  feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
  const message = (text, error = false) => { if (alive()) { feedback.textContent = text; feedback.classList.toggle('error', error); } };
  async function commit(mutator, label, options = {}) {
    if (!alive()) return false;
    try { await onChange(mutator, label, options); message(options.preserveInspector ? '' : '변경 내용을 반영했습니다.'); return true; }
    catch (error) { message(error?.message || '변경을 반영하지 못했습니다. 다시 시도해 주세요.', true); return false; }
  }
  const heading = element(doc, 'div', undefined, 'inspector-heading');
  heading.append(element(doc, 'h2', selection?.label || '내용 편집'));
  root.append(heading);
  if (!selection?.path) {
    root.append(element(doc, 'p', '화면에서 바꿀 글이나 사진을 선택하세요.', 'empty-inspector'));
    return () => inspectorRuns.delete(root);
  }

  function chooseRecord(path, label) {
    if (onChooseRecord) onChooseRecord({path, type: 'record', label});
  }
  function applyButton(target, action, label = '적용') {
    const actions = element(doc, 'div', undefined, 'field-actions'), button = element(doc, 'button', label);
    button.type = 'button';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try { await action(); } finally { if (alive()) button.disabled = false; }
    });
    actions.append(button); target.append(actions);
    return button;
  }
  function fieldWrapper(spec, target) {
    const wrapper = element(doc, 'div', undefined, 'visual-field');
    const label = element(doc, 'label', spec.label || '내용');
    wrapper.append(label);
    if (spec.hint) wrapper.append(element(doc, 'small', spec.hint, 'field-hint'));
    target.append(wrapper);
    return {wrapper, label};
  }
  function basicField(spec, target) {
    const value = getAt(data, spec.path), {wrapper, label} = fieldWrapper(spec, target);
    const isOptions = Array.isArray(spec.options), multiline = ['multiline', 'list'].includes(spec.type);
    const input = element(doc, isOptions ? 'select' : multiline ? 'textarea' : 'input');
    const id = 'visual-field-' + Math.random().toString(36).slice(2); input.id = id; label.htmlFor = id;
    if (isOptions) {
      const options = spec.options.map((option) => typeof option === 'string' ? [option, option] : [option.value, option.label]);
      if (value && !options.some(([key]) => key === value)) options.push([value, value + ' (현재 값)']);
      options.forEach(([key, text]) => { const option = element(doc, 'option', text); option.value = key; input.append(option); });
    } else if (!multiline) input.type = spec.type === 'boolean' ? 'checkbox' : spec.type === 'number' ? 'number' : spec.type === 'email' ? 'email' : 'text';
    if (spec.type === 'boolean') input.checked = Boolean(value);
    else input.value = spec.type === 'list' ? (Array.isArray(value) ? value : []).join('\n') : Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value);
    if (multiline) input.rows = spec.type === 'list' ? 4 : 5;
    if (spec.type === 'url') input.inputMode = 'url';
    if (spec.type === 'number') { input.step = '1'; if (spec.min !== undefined) input.min = String(spec.min); if (spec.max !== undefined) input.max = String(spec.max); }
    wrapper.append(input);
    async function saveField() {
      let next = spec.type === 'boolean' ? input.checked : input.value;
      if (spec.type === 'url' && !validURL(next.trim(), {internal: spec.path === '/announcement/url', image: Boolean(spec.imageURL)})) { message(spec.imageURL ? '이미지 파일 주소 또는 https:// 주소를 입력하세요.' : 'https://로 시작하는 주소를 입력하세요.', true); return; }
      if (spec.type === 'email' && next && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(next)) { message('이메일 주소를 확인해 주세요.', true); return; }
      if (spec.type === 'date') {
        const match = next.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
        if (!match || +match[2] < 1 || +match[2] > 12 || (match[3] && (+match[3] < 1 || +match[3] > new Date(+match[1], +match[2], 0).getDate()))) { message('날짜를 YYYY-MM-DD 또는 YYYY-MM 형식으로 입력하세요.', true); return; }
      }
      if (spec.type === 'number') {
        next = Number(input.value);
        if (!input.value.trim() || !Number.isFinite(next) || !Number.isInteger(next) || (spec.min !== undefined && next < spec.min) || (spec.max !== undefined && next > spec.max)) { message('허용 범위의 정수를 입력하세요.', true); return; }
      }
      if (spec.type === 'list') next = [...new Set(input.value.split(/\n/).map((part) => part.trim()).filter(Boolean))];
      else if (Array.isArray(value) && spec.type === 'multiline') next = input.value.split(/[,\n]+/).map((part) => part.trim()).filter(Boolean);
      if (JSON.stringify(next) === JSON.stringify(getAt(data, spec.path))) { message(''); return; }
      await commit((draft) => {
        setAt(draft, spec.path, next);
        const legacy = spec.path.match(/^\/news\/(\d+)\/(body|summary)$/);
        if (legacy && !draft.news[+legacy[1]].content?.length) { draft.news[+legacy[1]].body = next; draft.news[+legacy[1]].summary = next; }
      }, (spec.label || '내용') + ' 수정', {preserveInspector:true, coalesceKey:spec.path});
    }
    input.addEventListener('change', saveField);
    if (['text', 'multiline', 'list'].includes(spec.type)) input.addEventListener('input', saveField);
    applyButton(wrapper, saveField);
    if (spec.urlPath && spec.urlPath !== spec.path) basicField({path: spec.urlPath, type: 'url', label: '연결 주소 (선택)'}, wrapper);
    if (spec.labAuthorsPath) basicField({path: spec.labAuthorsPath, type: 'list', label: '강조할 연구실 저자', hint: '저자 목록과 같은 이름을 한 줄에 한 명씩 입력하세요. †와 *는 제외합니다.'}, wrapper);
  }

  function relationField(spec, target) {
    const collection = spec.collection || '/publications', source = getAt(data, collection) || [], selected = new Set(getAt(data, spec.path) || []);
    const {wrapper, label} = fieldWrapper(spec, target), search = element(doc, 'input', undefined, 'relation-search');
    search.type = 'search'; search.placeholder = '제목 · 저자 · 연도로 찾기'; label.append(search);
    const count = element(doc, 'p', selected.size + '편 선택', 'relation-count'), list = element(doc, 'div', undefined, 'relation-options');
    wrapper.append(count, list);
    const saveRelation = () => JSON.stringify([...selected]) === JSON.stringify(getAt(data, spec.path) || []) ? undefined : commit((draft) => setAt(draft, spec.path, [...selected]), '관련 논문 연결 수정', {preserveInspector:true, coalesceKey:spec.path});
    source.forEach((paper, index) => {
      const row = element(doc, 'div', undefined, 'relation-option'), option = element(doc, 'label'), checkbox = element(doc, 'input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(paper.id);
      option.append(checkbox, element(doc, 'span', paper.title + (paper.year ? ' (' + paper.year + ')' : ''))); row.append(option);
      checkbox.addEventListener('change', () => { if (checkbox.checked) selected.add(paper.id); else selected.delete(paper.id); count.textContent = selected.size + '편 선택'; void saveRelation(); });
      if (onChooseRecord) { const open = element(doc, 'button', '논문 정보'); open.type = 'button'; open.addEventListener('click', () => chooseRecord(collection + '/' + index, '논문 정보')); row.append(open); }
      row.dataset.search = [paper.title, paper.authors, paper.year, paper.journal].join(' ').toLocaleLowerCase(); list.append(row);
    });
    search.addEventListener('input', () => { const query = search.value.trim().toLocaleLowerCase(); for (const row of list.children) row.hidden = !row.dataset.search.includes(query); });
    applyButton(wrapper, saveRelation);
  }

  function imageField(spec, target) {
    const publicationPath = spec.path.match(/^\/publications\/\d+(?=\/image$)/)?.[0];
    if (publicationPath) spec = {
      altPath: publicationPath + '/imageAlt', widthPath: publicationPath + '/imageWidth',
      heightPath: publicationPath + '/imageHeight', cropPath: publicationPath + '/imagePreview',
      sourcePath: publicationPath + '/imageSource', imageLabelPath: publicationPath + '/imageLabel',
      thumbnailPath: publicationPath + '/imageThumbnail', ...spec
    };
    const sourceObject = spec.path.endsWith('/src') ? getAt(data, spec.path.slice(0, -4)) : null;
    if (sourceObject && typeof sourceObject === 'object' && ('caption' in sourceObject || sourceObject.type === 'image')) spec = {captionPath: spec.path.slice(0, -4) + '/caption', ...spec};
    const {wrapper, label} = fieldWrapper(spec, target), preview = element(doc, 'img', undefined, 'image-preview');
    const current = getAt(data, spec.path) || ''; preview.alt = spec.altPath ? getAt(data, spec.altPath) || '선택한 사진' : '선택한 사진';
    preview.hidden = !current; if (current) preview.src = spec.previewURL || previewImage(current);
    label.append(preview);
    const controls = element(doc, 'div', undefined, 'image-controls'), upload = element(doc, 'input', undefined, 'image-upload');
    upload.type = 'file'; upload.accept = 'image/jpeg,image/png,image/webp,image/gif'; upload.setAttribute('aria-label', '새 사진 파일 선택'); controls.append(upload); wrapper.append(controls);
    let altInput;
    if (spec.altPath) {
      const altLabel = element(doc, 'label', '사진 설명'), alt = element(doc, 'input'); alt.type = 'text'; alt.value = getAt(data, spec.altPath) || ''; altLabel.append(alt); wrapper.append(altLabel); altInput = alt;
      const saveAlt = () => {
        preview.alt = alt.value || '선택한 사진';
        return alt.value === (getAt(data, spec.altPath) || '') ? undefined : commit((draft) => setAt(draft, spec.altPath, alt.value), '사진 설명 수정', {preserveInspector:true, coalesceKey:spec.altPath});
      };
      alt.addEventListener('input', saveAlt); alt.addEventListener('change', saveAlt); applyButton(wrapper, saveAlt);
    }
    if (spec.captionPath) basicField({path: spec.captionPath, type: 'multiline', label: '사진 아래 설명 (선택)'}, wrapper);
    function replaceImage(path, metadata = {}, options = {}) {
      return commit((draft) => {
        setAt(draft, spec.path, path);
        const review = metadata.review;
        if (spec.altPath && altInput) setAt(draft, spec.altPath, review ? review.alt : altInput.value);
        if (review) {
          setAt(draft, spec.imageLabelPath, review.label);
          if (review.source) setAt(draft, spec.sourcePath, review.source);
          else removeAt(draft, spec.sourcePath);
        }
        if (spec.fullSrcPath) setAt(draft, spec.fullSrcPath, path);
        for (const [field, value] of [[spec.widthPath, metadata.width], [spec.heightPath, metadata.height]]) if (field) {
          if (Number.isFinite(value) && value > 0) setAt(draft, field, Math.round(value)); else removeAt(draft, field);
        }
        if (spec.cropPath) removeAt(draft, spec.cropPath);
        if (spec.thumbnailPath) {
          if (metadata.variants?.length) {
            const variants = metadata.variants.map(({path, width, height}) => ({src: path, width, height}));
            setAt(draft, spec.thumbnailPath, {source: path, variants});
          } else removeAt(draft, spec.thumbnailPath);
        }
      }, (spec.label || '사진') + ' 교체', options);
    }

    async function stageAndReplace(file, review) {
      let original;
      let applied = false;
      try {
        const {variants = [], ...staged} = await stageImage(file, {publicationFigure: Boolean(review)});
        original = staged;
        if (!alive()) return false;
        if (!staged.path || !validURL(staged.path, {image: true})) throw new Error('사진을 준비하지 못했습니다. 다른 파일로 다시 시도해 주세요.');
        if (!resolveImage && staged.previewURL) stagedPreviews.set(staged.path, staged.previewURL);
        applied = await replaceImage(staged.path, {...staged, variants, review}, {stagedAssets: [staged, ...variants]});
        return applied;
      } finally {
        if (!applied && original?.previewURL) {
          stagedPreviews.delete(original.path);
          URL.revokeObjectURL(original.previewURL);
        }
      }
    }

    let reviewReplacement;
    if (publicationPath) {
      const panel = element(doc, 'fieldset', undefined, 'figure-review');
      panel.hidden = true;
      panel.append(element(doc, 'legend', '새 논문 그림 확인'));
      const selected = element(doc, 'p', '', 'field-hint');
      const previous = element(doc, 'p', '', 'field-hint');
      const reuse = element(doc, 'button', '기존 출처와 그림 이름 가져오기');
      reuse.type = 'button';
      panel.append(selected, previous, reuse);
      function reviewInput(text, mode) {
        const label = element(doc, 'label', text);
        const input = element(doc, 'input');
        input.type = 'text';
        if (mode) input.inputMode = mode;
        label.append(input);
        panel.append(label);
        return input;
      }
      const figureLabel = reviewInput('새 그림 이름');
      figureLabel.placeholder = '예: Figure 2, Graphical abstract';
      const source = reviewInput('새 그림의 출처 페이지 주소', 'url');
      source.placeholder = 'https://…';
      panel.append(element(doc, 'small', '연결할 공개 출처 페이지가 없으면 주소를 비워 두세요.', 'field-hint'));
      const alt = reviewInput('새 그림 설명 (선택)');
      const checkLabel = element(doc, 'label', undefined, 'figure-review-check');
      const checked = element(doc, 'input');
      checked.type = 'checkbox';
      checkLabel.append(checked, doc.createTextNode('이 그림의 출처와 이름을 확인했습니다.'));
      const status = element(doc, 'p', '', 'field-feedback');
      status.setAttribute('role', 'status');
      const actions = element(doc, 'div', undefined, 'field-actions');
      const cancel = element(doc, 'button', '취소');
      const apply = element(doc, 'button', '그림 교체', 'primary');
      cancel.type = apply.type = 'button';
      actions.append(cancel, apply);
      panel.append(checkLabel, status, actions);
      wrapper.append(panel);
      let candidate;
      const reviewMessage = (text, error = false) => {
        status.textContent = text;
        status.classList.toggle('error', error);
      };
      reviewReplacement = next => {
        if (panel.disabled) return;
        candidate = next;
        selected.textContent = next.file?.name || next.path;
        const oldLabel = getAt(data, spec.imageLabelPath) || '';
        const oldSource = getAt(data, spec.sourcePath) || '';
        previous.textContent = [oldLabel, oldSource].filter(Boolean).join(' · ');
        previous.hidden = reuse.hidden = !previous.textContent;
        if (previous.textContent) previous.textContent = '기존 그림 정보 · ' + previous.textContent;
        figureLabel.value = source.value = alt.value = '';
        checked.checked = false;
        reviewMessage('');
        panel.hidden = false;
        figureLabel.focus();
      };
      reuse.addEventListener('click', () => {
        figureLabel.value = getAt(data, spec.imageLabelPath) || '';
        source.value = getAt(data, spec.sourcePath) || '';
        checked.checked = false;
        figureLabel.focus();
      });
      for (const input of [figureLabel, source]) input.addEventListener('input', () => { checked.checked = false; });
      cancel.addEventListener('click', () => {
        const trigger = candidate?.file ? upload : address;
        candidate = null;
        panel.hidden = true;
        trigger.focus();
      });
      apply.addEventListener('click', async () => {
        if (!candidate || panel.disabled) return;
        const review = {label: figureLabel.value.trim(), source: source.value.trim(), alt: alt.value.trim()};
        if (!review.label) { reviewMessage('새 그림 이름을 입력하세요.', true); figureLabel.focus(); return; }
        if (!validURL(review.source)) { reviewMessage('출처 페이지는 https://로 시작하는 주소를 입력하세요.', true); source.focus(); return; }
        if (!checked.checked) { reviewMessage('출처와 이름을 확인한 뒤 확인란을 선택하세요.', true); checked.focus(); return; }
        panel.disabled = upload.disabled = true;
        reviewMessage(candidate.file ? '원본과 표시용 썸네일을 준비하고 있습니다…' : '그림 주소를 바꾸고 있습니다…');
        try {
          const applied = candidate.file ? await stageAndReplace(candidate.file, review) : await replaceImage(candidate.path, {review});
          if (alive() && !applied) reviewMessage(feedback.textContent || '그림을 교체하지 못했습니다.', true);
          if (alive() && applied) panel.hidden = true;
        } catch (error) {
          if (alive()) reviewMessage(error?.message || '그림을 교체하지 못했습니다.', true);
        } finally {
          if (alive()) { panel.disabled = false; upload.disabled = typeof stageImage !== 'function'; }
        }
      });
    }

    upload.disabled = typeof stageImage !== 'function';
    upload.addEventListener('change', async () => {
      const file = upload.files?.[0];
      upload.value = '';
      if (!file) return;
      if (reviewReplacement) { reviewReplacement({file}); return; }
      upload.disabled = true;
      message('사진을 준비하고 있습니다…');
      try { await stageAndReplace(file); }
      catch (error) { message(error?.message || '사진을 올리지 못했습니다.', true); }
      finally { if (alive()) upload.disabled = false; }
    });
    const extra = element(doc, 'details', undefined, 'image-extra'); extra.append(element(doc, 'summary', '이미지 주소 · 추가 정보'));
    const addressLabel = element(doc, 'label', '사진 주소'), address = element(doc, 'input'); address.type = 'text'; address.inputMode = 'url'; address.value = current; addressLabel.append(address); extra.append(addressLabel);
    async function saveAddress() {
      const next = address.value.trim();
      if (!next || !validURL(next, {image: true})) { message('사진 파일을 선택하거나 사용할 이미지 주소를 입력하세요.', true); return; }
      if (next === getAt(data, spec.path)) return;
      if (reviewReplacement) { reviewReplacement({path: next}); return; }
      const applied = await replaceImage(next, {}, {preserveInspector:true, coalesceKey:spec.path});
      if (applied && alive()) { preview.src = previewImage(next); preview.hidden = false; }
    }
    if (!reviewReplacement) address.addEventListener('change', saveAddress);
    applyButton(extra, saveAddress, reviewReplacement ? '사진 주소로 교체' : '적용');
    if (spec.fullSrcPath) basicField({path: spec.fullSrcPath, type: 'url', label: '고해상도 원본 주소 (선택)', imageURL: true, hint: '별도 원본이 없다면 비워 두어도 됩니다.'}, extra);
    if (spec.sourcePath) basicField({path: spec.sourcePath, type: 'url', label: '그림 출처 페이지 (선택)'}, extra);
    if (spec.imageLabelPath) basicField({path: spec.imageLabelPath, type: 'text', label: '그림 이름'}, extra);
    wrapper.append(extra);
  }

  function richField(spec, target) {
    const isTitle = spec.type === 'publication-title', value = getAt(data, spec.path);
    const segmentsPath = spec.segmentsPath || spec.path.replace(/\/title$/, '/titleSegments');
    const storedSegments = isTitle ? getAt(data, segmentsPath) : undefined;
    const validSegments = isTitle && Array.isArray(storedSegments) && storedSegments.every(segment => segment && typeof segment.text === 'string' && (segment.italic === undefined || typeof segment.italic === 'boolean')) && storedSegments.map(segment => segment.text).join('') === value;
    const block = isTitle && typeof value === 'string' ? {type:'paragraph', text:value, ...(validSegments ? {children:storedSegments.map(segment => ({text:segment.text, ...(segment.italic ? {italic:true} : {})}))} : {})} : value;
    if (!block || typeof block !== 'object') { message('본문을 다시 선택해 주세요.', true); return; }
    if (block.type === 'list') {
      const text = (block.items || []).map(plainText).join('\n'), {wrapper, label} = fieldWrapper({...spec, hint: '한 줄에 한 항목을 입력하세요.'}, target), input = element(doc, 'textarea'); input.rows = 6; input.value = text; label.append(input);
      const orderedLabel = element(doc, 'label', '번호가 있는 목록'), ordered = element(doc, 'input'); ordered.type = 'checkbox'; ordered.checked = Boolean(block.ordered); orderedLabel.prepend(ordered); wrapper.append(orderedLabel);
      const saveList = () => {
        const current = getAt(data, spec.path);
        if (Boolean(current.ordered) === ordered.checked && (current.items || []).map(plainText).join('\n') === input.value) return;
        return commit((draft) => {
          const actual = getAt(draft, spec.path); actual.ordered = ordered.checked;
          if (input.value !== (actual.items || []).map(plainText).join('\n')) actual.items = input.value.split(/\n/).map((line) => line.trim()).filter(Boolean);
          syncPostText(draft, spec.path);
        }, '본문 목록 수정', {preserveInspector:true, coalesceKey:spec.path});
      };
      input.addEventListener('input', saveList); input.addEventListener('change', saveList); ordered.addEventListener('change', saveList); applyButton(wrapper, saveList);
      return;
    }
    const {wrapper} = fieldWrapper({...spec, hint: isTitle ? '기울일 글자만 선택한 뒤 기울임을 누르세요. 제목 내용과 서식을 함께 저장합니다.' : '글자를 선택한 뒤 굵게·기울임·링크를 적용하세요.'}, target), toolbar = element(doc, 'div', undefined, 'rich-toolbar'), editor = element(doc, 'div', undefined, 'rich-editor');
    editor.contentEditable = 'true'; editor.setAttribute('role', 'textbox'); editor.setAttribute('aria-multiline', isTitle ? 'false' : 'true'); editor.setAttribute('aria-label', spec.label || '본문'); editor.spellcheck = false;
    function appendText(parent, text) { String(text).split('\n').forEach((line, index) => { if (index) parent.append(doc.createElement('br')); parent.append(doc.createTextNode(line)); }); }
    for (const run of Array.isArray(block.children) ? block.children : [{text: block.text || ''}]) {
      let parent = editor;
      if (run.bold) { const strong = element(doc, 'strong'); parent.append(strong); parent = strong; }
      if (run.italic) { const em = element(doc, 'em'); parent.append(em); parent = em; }
      if (run.url && validURL(run.url)) { const link = element(doc, 'a'); link.href = run.url; parent.append(link); parent = link; }
      appendText(parent, run.text || '');
    }
    let savedRange, dirty = false;
    const rememberRange = () => { const current = doc.getSelection(); if (current?.rangeCount && editor.contains(current.anchorNode) && editor.contains(current.focusNode)) savedRange = current.getRangeAt(0).cloneRange(); };
    for (const event of ['keyup', 'mouseup', 'input']) editor.addEventListener(event, () => { rememberRange(); if (event === 'input') { dirty = true; void saveRich(); } });
    function restoreRange() { editor.focus(); if (savedRange) { const current = doc.getSelection(); current.removeAllRanges(); current.addRange(savedRange); } }
    function toolbarButton(text, action) { const button = element(doc, 'button', text); button.type = 'button'; button.addEventListener('pointerdown', (event) => { rememberRange(); event.preventDefault(); }); button.addEventListener('click', action); toolbar.append(button); return button; }
    if (!isTitle) toolbarButton('굵게', () => { restoreRange(); doc.execCommand('bold'); dirty = true; rememberRange(); void saveRich(); });
    toolbarButton('기울임', () => { restoreRange(); doc.execCommand('italic'); dirty = true; rememberRange(); void saveRich(); });
    const links = element(doc, 'div', undefined, 'rich-link-controls'); links.hidden = true;
    const linkInput = element(doc, 'input'); linkInput.type = 'url'; linkInput.placeholder = 'https://…'; linkInput.setAttribute('aria-label', '연결할 웹 주소');
    if (!isTitle) toolbarButton('링크', () => {
      rememberRange(); links.hidden = !links.hidden;
      if (!links.hidden) {
        const node = savedRange?.commonAncestorContainer, anchor = (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.('a');
        linkInput.value = anchor && editor.contains(anchor) ? anchor.getAttribute('href') || '' : '';
        linkInput.focus();
      }
    });
    const setLink = element(doc, 'button', '링크 적용'), clearLink = element(doc, 'button', '링크 해제'); setLink.type = clearLink.type = 'button'; links.append(linkInput, setLink, clearLink);
    setLink.addEventListener('click', () => {
      const url = linkInput.value.trim(); if (!url || !validURL(url)) { message('https://로 시작하는 링크 주소를 입력하세요.', true); return; }
      restoreRange();
      if (!savedRange || savedRange.collapsed) { const link = element(doc, 'a', url); link.href = url; const current = doc.getSelection(); if (current?.rangeCount) { const range = current.getRangeAt(0); range.deleteContents(); range.insertNode(link); range.setStartAfter(link); range.collapse(true); current.removeAllRanges(); current.addRange(range); } else editor.append(link); }
      else doc.execCommand('createLink', false, url);
      dirty = true; rememberRange(); links.hidden = true; void saveRich();
    });
    clearLink.addEventListener('click', () => { restoreRange(); doc.execCommand('unlink'); dirty = true; rememberRange(); links.hidden = true; void saveRich(); });
    if (isTitle) editor.addEventListener('keydown', event => {
      if (event.key === 'Enter' || ((event.ctrlKey || event.metaKey) && ['b', 'k'].includes(event.key.toLowerCase()))) event.preventDefault();
    });
    editor.addEventListener('paste', (event) => { event.preventDefault(); const text = event.clipboardData?.getData('text/plain') || ''; doc.execCommand('insertText', false, isTitle ? text.replace(/[\r\n]+/g, ' ') : text); dirty = true; void saveRich(); });
    editor.addEventListener('drop', (event) => { event.preventDefault(); message('사진은 사진 항목에서 파일을 선택해 주세요.'); });
    if (isTitle) wrapper.append(toolbar, editor); else wrapper.append(toolbar, links, editor);
    function serializedRuns() {
      const runs = [];
      const append = (text, marks = {}) => {
        if (!text) return;
        const run = {text: isTitle ? text.replace(/[\r\n]+/g, ' ') : text, ...(!isTitle && marks.bold ? {bold: true} : {}), ...(marks.italic ? {italic: true} : {}), ...(!isTitle && marks.url ? {url: marks.url} : {})}, previous = runs.at(-1);
        if (previous && previous.bold === run.bold && previous.italic === run.italic && previous.url === run.url) previous.text += run.text; else runs.push(run);
      };
      function visit(node, marks = {}) {
        if (node.nodeType === 3) { append(node.nodeValue || '', marks); return; }
        if (node.nodeType !== 1 || ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'IMG'].includes(node.tagName)) return;
        if (node.tagName === 'BR') { append('\n', marks); return; }
        const blockElement = ['DIV', 'P', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(node.tagName);
        if (blockElement && runs.length && !runs.at(-1).text.endsWith('\n')) append('\n');
        const next = {...marks};
        if (['B', 'STRONG'].includes(node.tagName)) next.bold = true;
        if (['I', 'EM'].includes(node.tagName)) next.italic = true;
        const weight = node.style?.fontWeight, italic = node.style?.fontStyle;
        if (weight === 'normal' || weight === '400') delete next.bold;
        else if (weight === 'bold' || /^(600|700|800|900)$/.test(weight || '')) next.bold = true;
        if (italic === 'normal') delete next.italic;
        else if (italic === 'italic') next.italic = true;
        if (node.tagName === 'A' && validURL(node.getAttribute('href') || '')) { const url = node.getAttribute('href'); if (url) next.url = url; }
        for (const child of node.childNodes) visit(child, next);
        if (blockElement && node.nextSibling && runs.length && !runs.at(-1).text.endsWith('\n')) append('\n');
      }
      for (const child of editor.childNodes) visit(child);
      return runs;
    }
    async function saveRich() {
      if (!dirty) return;
      const runs = serializedRuns(), text = runs.map((run) => run.text).join(''), children = runs.some((run) => run.bold || run.italic || run.url) ? runs : undefined, current = getAt(data, spec.path);
      if (isTitle) {
        const segments = runs.some(run => run.italic) ? runs : undefined;
        if (current === text && JSON.stringify(getAt(data, segmentsPath)) === JSON.stringify(segments)) { dirty = false; return; }
        const ok = await commit(draft => {
          setAt(draft, spec.path, text);
          if (segments) setAt(draft, segmentsPath, segments); else removeAt(draft, segmentsPath);
        }, '논문 제목 수정', {preserveInspector:true, coalesceKey:spec.path});
        if (ok) dirty = false;
        return;
      }
      if (current.text === text && JSON.stringify(current.children) === JSON.stringify(children)) { dirty = false; return; }
      const ok = await commit((draft) => { const actual = getAt(draft, spec.path); actual.text = text; if (children) actual.children = children; else delete actual.children; syncPostText(draft, spec.path); }, '본문 수정', {preserveInspector:true, coalesceKey:spec.path});
      if (ok) dirty = false;
    }
    applyButton(wrapper, saveRich);
    if (isTitle && spec.urlPath && spec.urlPath !== spec.path) basicField({path:spec.urlPath, type:'url', label:'연결 주소 (선택)'}, wrapper);
  }

  function imageSelection(path, label = '본문 사진') {
    return {path: path + '/src', type: 'image', label, altPath: path + '/alt', fullSrcPath: path + '/fullSrc', widthPath: path + '/width', heightPath: path + '/height', captionPath: path + '/caption', sourcePath: path + '/sourceURL', ...(path.startsWith('/research/') ? {thumbnailPath: path + '/imageThumbnail'} : {})};
  }
  function selectField(spec) { if (onChooseRecord) onChooseRecord(spec); }
  function rowAction(target, label, action, disabled = false) {
    const button = element(doc, 'button', label); button.type = 'button'; button.disabled = disabled;
    button.addEventListener('click', action); target.append(button); return button;
  }
  function itemRow(target, title, previewText) {
    const row = element(doc, 'article', undefined, 'content-record'); row.append(element(doc, 'h4', title, 'content-record-title'));
    if (previewText) row.append(element(doc, 'p', previewText.slice(0, 100), 'content-record-preview'));
    const actions = element(doc, 'div', undefined, 'content-record-actions'); row.append(actions); target.append(row);
    return {row, actions};
  }
  function ensurePostContent(post) {
    if (post.content?.length) return post.content;
    post.content = [];
    if (post.body || post.summary) post.content.push({type: 'paragraph', text: post.body || post.summary});
    if (post.image) post.content.push({type: 'image', src: post.image, alt: post.imageAlt || '', caption: ''});
    return post.content;
  }
  function postContentFields(path, target) {
    const post = getAt(data, path), blocks = Array.isArray(post.content) ? post.content : [];
    const group = element(doc, 'section', undefined, 'content-records'); group.append(element(doc, 'h3', '게시물 본문'));
    const add = element(doc, 'div', undefined, 'content-add-actions'); group.append(add);
    const labels = {paragraph:'문단', heading:'소제목', image:'사진', list:'목록', quote:'인용'};
    for (const type of ['paragraph', 'image', 'heading', 'list']) rowAction(add, '+ ' + labels[type], async () => {
      let index;
      const ok = await commit((draft) => {
        const content = ensurePostContent(getAt(draft, path)); index = content.length;
        content.push(type === 'image' ? {type, src:'', alt:'', caption:''} : type === 'list' ? {type, items:[], ordered:false} : {type, text:''});
        syncPostText(draft, path + '/content/0');
      }, labels[type] + ' 추가');
      if (ok) selectField(type === 'image' ? imageSelection(path + '/content/' + index) : {path:path + '/content/' + index, type:'richtext', label:labels[type] + ' 편집'});
    });
    if (!blocks.length) group.append(element(doc, 'p', '문단과 사진을 표시할 순서대로 추가하세요.', 'record-note'));
    blocks.forEach((block, index) => {
      const blockPath = path + '/content/' + index, label = labels[block.type] || '내용';
      const {actions} = itemRow(group, (index + 1) + '. ' + label, block.type === 'image' ? block.caption || block.alt || '사진을 선택해 주세요.' : block.type === 'list' ? (block.items || []).map(plainText).join(' · ') : plainText(block));
      rowAction(actions, '편집', () => selectField(block.type === 'image' ? imageSelection(blockPath) : {path:blockPath, type:'richtext', label:label + ' 편집'}), !onChooseRecord);
      for (const [text, offset] of [['위로', -1], ['아래로', 1]]) rowAction(actions, text, () => commit((draft) => {
        const content = getAt(draft, path + '/content'); [content[index], content[index + offset]] = [content[index + offset], content[index]];
        syncPostText(draft, blockPath);
      }, '본문 순서 변경'), index + offset < 0 || index + offset >= blocks.length);
      rowAction(actions, '삭제', () => commit((draft) => {
        const actual = getAt(draft, path), removed = actual.content.splice(index, 1)[0];
        if (removed.type === 'image' && actual.image === removed.src) {
          const next = actual.content.find((item) => item.type === 'image' && item.src);
          if (next) { actual.image = next.src; actual.imageAlt = next.alt || ''; }
          else { delete actual.image; delete actual.imageAlt; }
        }
        syncPostText(draft, blockPath);
      }, label + ' 삭제'));
    });
    target.append(group);
  }
  function researchImageFields(path, target) {
    const images = getAt(data, path) || [], group = element(doc, 'section', undefined, 'content-records');
    group.append(element(doc, 'h4', '상세 그림'));
    const add = element(doc, 'div', undefined, 'content-add-actions'); group.append(add);
    rowAction(add, '+ 사진', async () => {
      let index;
      const ok = await commit((draft) => { let items = getAt(draft, path); if (!Array.isArray(items)) { setAt(draft, path, []); items = getAt(draft, path); } index = items.length; items.push({src:'', alt:'', caption:''}); }, '상세 그림 추가');
      if (ok) selectField(imageSelection(path + '/' + index, '상세 연구 그림'));
    });
    images.forEach((image, index) => {
      const {actions} = itemRow(group, '그림 ' + (index + 1), image.caption || image.alt || '사진을 선택해 주세요.');
      rowAction(actions, '편집', () => selectField(imageSelection(path + '/' + index, '상세 연구 그림')), !onChooseRecord);
      for (const [text, offset] of [['위로', -1], ['아래로', 1]]) rowAction(actions, text, () => commit((draft) => { const items = getAt(draft, path); [items[index], items[index + offset]] = [items[index + offset], items[index]]; }, '상세 그림 순서 변경'), index + offset < 0 || index + offset >= images.length);
      rowAction(actions, '삭제', () => commit((draft) => getAt(draft, path).splice(index, 1), '상세 그림 삭제'));
    });
    target.append(group);
  }
  function researchSectionFields(path, target) {
    const topic = getAt(data, path), sections = topic.detailSections || [], group = element(doc, 'section', undefined, 'content-records');
    group.append(element(doc, 'h3', '상세 설명'));
    const add = element(doc, 'div', undefined, 'content-add-actions'); group.append(add);
    rowAction(add, '+ 설명 추가', async () => {
      let index;
      const ok = await commit((draft) => {
        const actual = getAt(draft, path);
        if (!Array.isArray(actual.detailSections)) actual.detailSections = actual.description || actual.detailImages?.length ? [{title:'', body:actual.description || '', images:actual.detailImages || []}] : [];
        index = actual.detailSections.length; actual.detailSections.push({title:'', body:'', images:[]});
      }, '연구 상세 설명 추가');
      if (ok) chooseRecord(path + '/detailSections/' + index, '상세 설명 편집');
    });
    if (!sections.length) group.append(element(doc, 'p', '소제목과 설명을 추가한 뒤 관련 그림을 붙이세요.', 'record-note'));
    sections.forEach((section, index) => {
      const sectionPath = path + '/detailSections/' + index, {row, actions} = itemRow(group, section.title || '설명 ' + (index + 1), section.body || '설명을 입력해 주세요.');
      rowAction(actions, '설명 편집', () => chooseRecord(sectionPath, '상세 설명 편집'), !onChooseRecord);
      for (const [text, offset] of [['위로', -1], ['아래로', 1]]) rowAction(actions, text, () => commit((draft) => { const items = getAt(draft, path + '/detailSections'); [items[index], items[index + offset]] = [items[index + offset], items[index]]; }, '상세 설명 순서 변경'), index + offset < 0 || index + offset >= sections.length);
      rowAction(actions, '삭제', () => commit((draft) => getAt(draft, path + '/detailSections').splice(index, 1), '상세 설명 삭제'));
      researchImageFields(sectionPath + '/images', row);
    });
    target.append(group);
  }

  function recordFields(spec, target) {
    const value = getAt(data, spec.path), parts = pointerParts(spec.path), fields = [], base = spec.path;
    const add = (key, label, type = 'text', extra = {}) => fields.push({path: base + '/' + key, label, type, ...extra});
    const image = (key, label, extra = {}) => add(key, label, 'image', extra);
    if (Array.isArray(value)) {
      value.forEach((item, index) => { const button = element(doc, 'button', item.title || item.name || '항목 ' + (index + 1), 'record-link'); button.type = 'button'; button.addEventListener('click', () => chooseRecord(base + '/' + index, item.title || item.name || '항목 편집')); target.append(button); });
      if (!value.length) target.append(element(doc, 'p', '아직 등록된 항목이 없습니다. 추가 메뉴에서 새 항목을 만드세요.', 'record-note'));
      return;
    }
    if (!value || typeof value !== 'object') { target.append(element(doc, 'p', '화면에서 편집할 글이나 사진을 다시 선택하세요.', 'record-note')); return; }
    if (value.type && ['paragraph', 'heading', 'quote', 'list'].includes(value.type)) { richField({...spec, type: 'richtext'}, target); return; }
    if (value.type === 'image' || (parts.at(-2) === 'images' && 'src' in value)) {
      image('src', '사진', {altPath: base + '/alt', fullSrcPath: base + '/fullSrc', widthPath: base + '/width', heightPath: base + '/height', captionPath:base+'/caption', ...('sourceURL' in value ? {sourcePath: base + '/sourceURL'} : {}), ...(parts[0] === 'research' ? {thumbnailPath: base + '/imageThumbnail'} : {})});
    } else if (parts[0] === 'site') {
      add('title', '연구실 정식 이름'); add('group', '연구 그룹명'); add('affiliation', '소속'); add('email', '대표 이메일', 'email'); add('address', '주소'); add('description', '사이트 소개', 'multiline');
    } else if (parts[0] === 'hero') {
      add('title', '메인 연구실 이름', 'multiline', {hint: '줄바꿈한 모양으로 제목에 표시됩니다.'}); image('image', '메인 그림', {altPath: base + '/imageAlt'});
    } else if (parts[0] === 'announcement') {
      add('enabled', '홈 공지 표시', 'boolean'); add('title', '공지 제목'); add('body', '공지 내용', 'multiline'); add('url', '연결 주소 (선택)', 'url');
    } else if (parts[0] === 'join') {
      add('title', '모집 제목'); add('description', '모집 안내', 'multiline'); add('office', '교수실'); add('laboratory', '실험실');
    } else if (parts[0] === 'people') {
      add('name', '이름'); add('role', '직위 · 과정', 'text', {options: [{value:'Principal Investigator',label:'교수'},{value:'PhD student',label:'박사과정'},{value:'Master’s student',label:'석사과정'},{value:'Undergraduate researcher',label:'학부연구생'},{value:'Postdoctoral researcher',label:'박사후연구원'},{value:'Alumni',label:'졸업생'}]}); add('email', '이메일', 'email'); add('description', '소개 · 경력 · 학력', 'multiline'); image('image', '인물 사진'); add('url', '개인 홈페이지 (선택)', 'url');
    } else if (['publications', 'underReview'].includes(parts[0])) {
      add('title', '논문 제목', 'publication-title', {segmentsPath:base+'/titleSegments'}); add('authors', '저자', 'multiline', {hint:'원고 순서대로 입력하세요. 공동 기여 †, 교신저자 *는 이름 뒤에 붙입니다.'}); add('labAuthors', '강조할 연구실 저자', 'list', {hint:'저자 목록과 같은 이름을 한 줄에 한 명씩 입력하세요. †와 *는 제외합니다.'});
      if (parts[0] === 'publications') { add('journal', '학술지 · 권 · 페이지'); add('year', '연도', 'number', {min:1900,max:2100}); add('doi', 'DOI (선택)'); image('image', '논문 대표 그림'); add('featured', '홈 대표 논문에 표시', 'boolean'); }
      add('url', '논문 · 원고 링크 (선택)', 'url');
    } else if (parts[0] === 'news') {
      add('title', '게시물 제목'); add('date', '날짜', 'date', {hint:'예: 2026-10-27'}); add('category', '분류', 'text', {options:['Awards','Conferences','Activities']}); add('excerpt', '목록 소개 (선택)', 'multiline', {hint:'비우면 본문 앞부분을 표시합니다. 본문은 화면에서 문단을 선택해 편집하세요.'}); image('image', '목록 대표 사진', {altPath:base+'/imageAlt'}); if (!value.content?.length) add('body', '본문', 'multiline');
      target.append(element(doc, 'p', '아래에서 문단과 사진을 추가하고, 화면에서도 직접 선택해 편집할 수 있습니다.', 'record-note'));
    } else if (parts[0] === 'research' && parts.at(-2) === 'detailSections') {
      add('title', '소제목 (선택)'); add('body', '상세 설명', 'multiline');
    } else if (parts[0] === 'research' && parts[2] === 'topics' && parts.length === 4) {
      add('title', '하위 연구 주제명'); add('summary', '짧은 소개', 'multiline'); add('focus', '연구 초점', 'list', {hint:'한 줄에 한 항목을 입력하세요.'}); image('schematic', '주제 도식', {altPath:base+'/schematicAlt',widthPath:base+'/schematicWidth',heightPath:base+'/schematicHeight',thumbnailPath:base+'/schematicThumbnail'}); add('paperIds', '관련 논문', 'relation', {collection:'/publications'});
    } else if (parts[0] === 'research' && parts.length === 2) {
      add('title', '연구 분야명'); add('summary', '연구 분야 소개', 'multiline'); image('icon', '분야 아이콘'); image('image', '분야 개념도', {altPath:base+'/imageAlt'});
    } else if (typeof value.title === 'string') add('title', '표시 제목');
    if (!fields.length) target.append(element(doc, 'p', '화면에서 편집할 글이나 사진을 선택하세요.', 'record-note'));
    for (const field of fields) renderField(field, target);
    if (parts[0] === 'news' && parts.length === 2) postContentFields(base, target);
    if (parts[0] === 'research' && parts[2] === 'topics' && parts.length === 4) researchSectionFields(base, target);
    if (parts[0] === 'research' && parts.at(-2) === 'detailSections') researchImageFields(base + '/images', target);
  }

  function renderField(spec, target) {
    if (spec.type === 'image') {
      const value = getAt(data, spec.path);
      imageField(value && typeof value === 'object' && 'src' in value ? {...imageSelection(spec.path, spec.label), ...spec, path:spec.path + '/src'} : spec, target);
    }
    else if (spec.type === 'richtext' || spec.type === 'publication-title') richField(spec, target);
    else if (spec.type === 'relation') relationField(spec, target);
    else if (spec.type === 'record') recordFields(spec, target);
    else basicField(spec, target);
  }
  try {
    const content = element(doc, 'div', undefined, 'record-fields'); root.append(content);
    renderField(selection, content);
    const record = relatedRecord(selection.path);
    if (onChooseRecord && selection.type !== 'record' && record && record !== selection.path) {
      const open = element(doc, 'button', '이 항목의 전체 설정', 'record-link'); open.type = 'button'; open.addEventListener('click', () => chooseRecord(record, '항목 설정')); root.append(open);
    }
  } catch (error) { message(error?.message || '편집할 항목을 불러오지 못했습니다.', true); }
  root.append(feedback);
  return () => { if (alive()) inspectorRuns.delete(root); };
}
