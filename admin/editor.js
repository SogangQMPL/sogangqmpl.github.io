'use strict';
(() => {
  const STORAGE_KEY = 'qmp-site-draft';
  const $ = (id) => document.getElementById(id);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const sections = [
    { key: 'basic', label: '기본 정보', help: '홈 상단 공지와 연구실 기본 정보, 모집 안내를 관리합니다.' },
    { key: 'news', label: '소식 · Activities', help: 'Conferences는 행사당 한 글에 발표자·참석자·사진을 모으고, 개인 수상은 Awards에 별도로 올립니다. Activities 분류는 활동 페이지에 표시됩니다.' },
    { key: 'publications', label: '논문', help: '공개 화면은 최신 연도순입니다. 위로·아래로는 같은 연도 안의 순서를 바꿉니다. 대표 논문은 최신순 최대 3편을 홈에 표시합니다.' },
    { key: 'underReview', label: '심사 중 논문', help: 'Publications 검색창 위의 Under review에 표시됩니다. 제목·저자·연구실 저자 강조를 관리하며 게재 연도나 학술지 정보는 필요하지 않습니다.' },
    { key: 'people', label: '구성원', help: '연구실 구성원 정보를 관리합니다. 공개할 수 있는 정보만 입력해 주세요.' },
    { key: 'research', label: '연구 분야', help: '3개 연구 주제 아래의 하위 주제와 관련 논문을 관리합니다. 순서대로 공개 화면에 표시됩니다.' }
  ];
  const fields = {
    site: [
      ['title', '연구실 정식 명칭', 'text', true], ['shortName', '짧은 이름'],
      ['group', '그룹명'], ['affiliation', '소속'], ['email', '대표 이메일', 'email'],
      ['address', '주소', 'text', true], ['description', '연구실 한 문단 소개', 'textarea', true],
      ['repositoryUrl', 'GitHub 저장소 주소', 'url', true, '저장소를 만든 후 https://github.com/소유자/저장소 형식으로 입력하세요.']
    ],
    announcement: [ ['enabled', '홈 상단 공지 표시', 'checkbox', true], ['title', '공지 제목', 'text', true], ['body', '공지 내용', 'textarea', true], ['url', '공지 링크', 'noticeurl', true, '예: join.html 또는 https://로 시작하는 주소. 링크가 필요 없으면 비워 두세요.'] ],
    hero: [ ['title', '메인 랩 이름', 'textarea', true, '줄바꿈한 모양대로 큰 제목에 표시됩니다. 예: Quantum / Materials & Photonics / Lab을 세 줄로 입력하세요.'], ['image', '메인 대표 그림', 'image', true, '랩 이름 오른쪽에 표시할 그림입니다. 현재 Wix 원본 assets/lab-overview.webp를 사용합니다.'], ['imageAlt', '대표 그림 설명', 'text', true, '그림이 보이지 않을 때 읽을 수 있는 설명입니다.'] ],
    join: [ ['title', '모집 제목', 'text', true], ['description', '모집 안내', 'textarea', true] ],
    news: [ ['date', '날짜', 'text', false, '예: 2026-10-15 또는 2026-10'], ['category', '분류', 'text', false, '예: Awards, Conferences, Activities'], ['title', '게시물 제목', 'text', true, 'Awards는 제목 뒤에 수상자 이름을 붙이고, Conferences는 행사명 뒤에 Poster/Oral Presentation 등 확인된 발표 형식을 붙입니다. 개인 이름과 발표 내용·참석자는 본문에 적어 주세요.'], ['excerpt', '목록 소개 (선택)', 'textarea', true, '비워 두면 게시물 본문 앞부분을 최대 두 문단 자동으로 표시합니다. 목록에 별도 소개를 쓰려면 입력하세요.'], ['body', '이전 본문 (보관)', 'textarea', true, '본문 블록이 없는 이전 게시물에서 사용합니다. 새 게시물의 본문과 사진은 아래 게시물 내용에서 입력하세요.'], ['url', 'Wix 원문 · 출처 주소', 'url', true, '이 주소는 원문 기록용입니다. 방문자는 이 홈페이지 안의 게시물에서 내용을 읽습니다.'], ['image', '목록 대표 사진 주소', 'image', true, 'assets/posts/파일명.jpg 또는 https:// 이미지 주소. 본문 사진은 아래 사진 블록에서 관리합니다.'], ['imageAlt', '대표 사진 설명', 'text', true, '사진에 담긴 활동이나 연구 내용을 짧게 설명해 주세요.'] ],
    publications: [ ['title', '논문 제목', 'text', true], ['authors', '저자', 'textarea', true, '저자 순서대로 쉼표로 구분하세요. 교수님·연구실 구성원은 풀네임으로 작성합니다. 원문에서 확인한 공동 기여 저자는 †, 교신저자는 *를 이름 뒤에 붙이세요. 예: Seongwon Gim†, Hyeonjun Baek*.'], ['labAuthors', '연구실 저자 (굵게·밑줄)', 'ids', true, '이 논문의 교수님·연구실 구성원 이름을 저자 목록과 같은 풀네임으로 쉼표로 구분하세요. 예: Seongwon Gim, Hyeonjun Baek. 공동 기여·교신저자 기호 †와 *는 제외합니다. 이니셜이 같은 외부 연구자는 이름을 임의로 바꾸지 마세요.'], ['journal', '학술지 · 권 · 페이지', 'text', true], ['year', '출판 연도', 'number'], ['doi', 'DOI', 'text', false, '예: 10.1038/… (없으면 비워 두세요)'], ['url', '논문 링크', 'url', true], ['image', '논문 대표 그림', 'image', true, '예: assets/publications/pub-01.jpg. 해당 논문의 visual abstract 또는 구조 그림을 사용합니다.'], ['imageAlt', '그림 설명', 'text', true], ['imageLabel', '그림 이름', 'text', false, '확대창과 출처 기록에 사용하는 이름입니다. 예: Graphical abstract, Figure 1. 목록의 그림 아래에는 표시하지 않습니다.'], ['imageSource', '그림 출처 페이지', 'url', true, '출판사의 해당 논문 또는 그림 페이지 https:// 주소를 입력합니다.'], ['featured', '홈 화면의 대표 논문에 표시', 'checkbox', true] ],
    underReview: [ ['title', '논문 제목', 'text', true], ['authors', '저자', 'textarea', true, '원고에 표기한 이름과 순서를 쉼표로 구분해 입력하세요. 공동 기여는 †, 교신저자는 *를 이름 뒤에 붙이세요. 원고에 확인된 표시만 입력합니다.'], ['labAuthors', '연구실 저자 (굵게·밑줄)', 'ids', true, '저자 목록과 같은 이름으로 입력하세요. 예: Yongju Jeong, Dianne Lee, Hyeonjun Baek. †와 *는 제외합니다. Dianne Lee는 이지현 학생의 원고 표기 이름입니다.'], ['url', '원고 링크 (선택)', 'url', true, '공개 원고나 preprint가 있을 때만 https:// 주소를 입력하세요. 링크가 없으면 비워 둡니다.'] ],
    people: [ ['name', '이름'], ['role', '직위 · 과정', 'role', false, '교수님 분류는 Principal Investigator 값으로 연결됩니다. 기존의 다른 역할도 보존됩니다.'], ['description', '소개', 'textarea', true], ['email', '이메일', 'email'], ['image', '사진 주소', 'image', true, 'assets/파일명.jpg 또는 https:// 이미지 주소. 실제 파일 업로드는 GitHub에서 별도로 해주세요.'], ['url', '개인 홈페이지 링크', 'url', true] ],
    research: [ ['title', '연구 분야명', 'text', true], ['icon', '분야 아이콘', 'image', true, '상단 목차와 분야 제목에 함께 표시합니다. 예: assets/research/area-quantum.svg'], ['kicker', '작은 제목'], ['summary', '짧은 소개', 'textarea', true], ['description', '자세한 소개', 'textarea', true], ['image', '분야 개념도 (Research map)', 'image', true, '하단 Research map을 펼쳤을 때 표시하는 분야 그림입니다. assets/파일명.svg 또는 https:// 이미지 주소를 입력하세요.'], ['imageAlt', '그림 설명', 'text', true, '그림이 보이지 않을 때 읽을 수 있는 설명입니다.'], ['paperIds', '원본 분야별 논문 ID (보관)', 'ids', true, '원본 분야 연결 기록입니다. 공개 화면의 논문 목록은 아래 각 하위 주제의 관련 논문 ID에서 관리하세요.'] ],
    topic: [ ['title', '하위 주제명', 'text', true], ['summary', '짧은 소개', 'textarea', true, '기본 화면에 표시하는 한 문장입니다. 연구 목표와 방법만 간결하게 입력하세요.'], ['focus', '연구 초점', 'ids', true, '세부 주제의 설명 위에 표시할 연구 항목을 쉼표로 구분하세요. Single-photon sources·SPDC 등 기존 10개 항목을 유지하고 일반적인 방법론 키워드는 줄여 주세요.'], ['schematic', '기본 schematic', 'image', true, '세부 주제에서 항상 보이는 도식입니다. 예: assets/research/topic-moire.svg'], ['schematicAlt', 'Schematic 설명', 'text', true, '그림의 물리적 개념을 짧게 설명해 주세요.'], ['description', '자세한 설명', 'textarea', true, 'DETAIL을 펼쳤을 때 표시합니다.'], ['image', '원본 자료 그림', 'image', true, 'DETAIL 그림 목록이 없는 기존 항목에서만 사용합니다. 아래 목록을 모두 지우면 DETAIL에 그림을 표시하지 않습니다. 여러 그림은 아래 목록에서 관리하세요.'], ['imageAlt', '그림 설명', 'text', true], ['paperIds', '관련 논문 ID', 'ids', true, '이 세부 주제의 Related papers에 표시합니다. 예: pub-02, pub-03. 관련 게재 논문이 없으면 비워 두세요.'], ['status', '연구 상태', 'text', false, '진행 중은 Research direction, 관련 논문이 있으면 Published research를 사용하세요. 기존 값을 확인하고 수정하세요.'], ['source', '원문 출처', 'url', true] ]
  };
  let data = null;
  let current = 'basic';
  let unsaved = false;
  let history = [];
  let inputSequence = 0;

  function node(tag, text, className) {
    const result = document.createElement(tag);
    if (text !== undefined) result.textContent = text;
    if (className) result.className = className;
    return result;
  }
  function status(message, error = false) {
    $('status').textContent = message;
    $('status').classList.toggle('error', error);
  }
  function remember() {
    history.push(clone(data));
    if (history.length > 25) history.shift();
    $('undo').disabled = false;
  }
  function changed() {
    unsaved = true;
    status('변경 내용은 이 화면에 있습니다. 초안 저장 또는 다운로드로 보관해 주세요.');
  }
  function shape(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('파일 맨 위는 JSON 객체여야 합니다.');
    ['site', 'hero', 'join'].forEach((key) => {
      if (!value[key] || typeof value[key] !== 'object' || Array.isArray(value[key])) throw new Error(key + ' 항목이 포함된 전체 site.json 파일을 불러오세요.');
    });
    if (value.announcement !== undefined && (!value.announcement || typeof value.announcement !== 'object' || Array.isArray(value.announcement))) throw new Error('announcement 항목은 공지 객체여야 합니다.');
    if (value.announcement?.enabled !== undefined && typeof value.announcement.enabled !== 'boolean') throw new Error('공지 enabled 값은 true 또는 false여야 합니다.');
    if (value.underReview === undefined) value.underReview = [];
    const ids = new Set();
    ['research', 'publications', 'underReview', 'news', 'people'].forEach((key) => {
      if (!Array.isArray(value[key]) || value[key].some((item) => !item || typeof item !== 'object' || Array.isArray(item))) throw new Error(key + ' 항목이 포함된 전체 site.json 파일을 불러오세요.');
      value[key].forEach((item) => {
        if (typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)) throw new Error(key + ' 목록에 없거나 중복된 id가 있습니다.');
        ids.add(item.id);
      });
    });
    if (value.publicationYearGroups !== undefined && (!Array.isArray(value.publicationYearGroups) || value.publicationYearGroups.some((period) => !period || !Number.isInteger(period.from) || !Number.isInteger(period.to) || period.from > period.to))) throw new Error('논문 연도 묶음은 올바른 시작·끝 연도 목록이어야 합니다.');
    [...value.publications, ...value.underReview].forEach((paper) => {
      if (paper.labAuthors !== undefined && (!Array.isArray(paper.labAuthors) || paper.labAuthors.some((name) => typeof name !== 'string'))) throw new Error('연구실 저자는 이름을 담은 목록이어야 합니다.');
    });
    value.underReview.forEach((paper) => {
      if (paper.authors !== undefined && typeof paper.authors !== 'string') throw new Error('심사 중 논문의 저자는 쉼표로 구분한 글자로 입력해야 합니다.');
      if (paper.authorAliases !== undefined && (!paper.authorAliases || typeof paper.authorAliases !== 'object' || Array.isArray(paper.authorAliases) || Object.values(paper.authorAliases).some((alias) => typeof alias !== 'string'))) throw new Error('심사 중 논문의 저자 별칭은 이름과 식별자를 연결한 객체여야 합니다.');
    });
    value.research.forEach((category) => {
      if (category.paperIds !== undefined && !Array.isArray(category.paperIds)) throw new Error('연구 주제의 paperIds는 논문 ID 목록이어야 합니다.');
      if (category.topics !== undefined && (!Array.isArray(category.topics) || category.topics.some((topic) => !topic || typeof topic !== 'object' || Array.isArray(topic)))) throw new Error('연구 주제의 topics는 하위 주제 목록이어야 합니다.');
      (category.topics || []).forEach((topic) => {
        if (typeof topic.id !== 'string' || !topic.id.trim() || ids.has(topic.id)) throw new Error('하위 주제의 id가 없거나 중복되었습니다.');
        ids.add(topic.id);
        if (topic.paperIds !== undefined && !Array.isArray(topic.paperIds)) throw new Error('하위 주제의 paperIds는 논문 ID 목록이어야 합니다.');
        if (topic.focus !== undefined && (!Array.isArray(topic.focus) || topic.focus.some((label) => typeof label !== 'string'))) throw new Error('연구 초점은 짧은 키워드 목록이어야 합니다.');
        if (topic.detailImages !== undefined && (!Array.isArray(topic.detailImages) || topic.detailImages.some((image) => !image || typeof image !== 'object' || Array.isArray(image)))) throw new Error('DETAIL 그림은 그림 항목을 담은 목록이어야 합니다.');
        (topic.detailImages || []).forEach((image) => {
          if (['src', 'fullSrc', 'alt', 'caption'].some((field) => image[field] !== undefined && typeof image[field] !== 'string')) throw new Error('DETAIL 그림의 주소와 설명은 글자로 입력해야 합니다.');
        });
      });
    });
    value.news.forEach((post) => {
      if (post.excerpt !== undefined && typeof post.excerpt !== 'string') throw new Error('목록 소개는 글자로 입력해야 합니다.');
      if (post.content !== undefined && (!Array.isArray(post.content) || post.content.some((block) => !block || typeof block !== 'object' || Array.isArray(block)))) throw new Error('게시물 content는 문단·사진 블록 목록이어야 합니다.');
      (post.content || []).forEach((block) => {
        if (block.children !== undefined && (!Array.isArray(block.children) || block.children.some((run) => !run || typeof run !== 'object' || Array.isArray(run)))) throw new Error('게시물 문단의 children은 글자·링크 목록이어야 합니다.');
        if (block.items !== undefined && !Array.isArray(block.items)) throw new Error('게시물 목록의 items는 항목 목록이어야 합니다.');
      });
    });
    return value;
  }
  function controls(enabled) {
    ['save', 'preview', 'download'].forEach((id) => $(id).disabled = !enabled);
  }
  function renderNav() {
    $('sections').replaceChildren();
    sections.forEach((section) => {
      const button = node('button', section.label);
      button.type = 'button';
      button.setAttribute('aria-current', String(current === section.key));
      if (section.key !== 'basic') button.append(node('span', String((data[section.key] || []).length), 'count'));
      button.addEventListener('click', () => { current = section.key; render(); });
      $('sections').append(button);
    });
  }
  function renderField(owner, definition, target, onTitle, onValue) {
    const [key, label, kind = 'text', wide = false, hint] = definition;
    const field = node('div', undefined, 'field' + (wide ? ' wide' : ''));
    const id = 'field-' + (++inputSequence);
    const input = document.createElement(['textarea','ids'].includes(kind) ? 'textarea' : kind === 'role' ? 'select' : 'input');
    input.id = id;
    input.dataset.field = key;
    const originalArray = kind === 'ids' || Array.isArray(owner[key]);
    if (kind === 'checkbox') {
      input.type = 'checkbox'; input.checked = Boolean(owner[key]);
      const checkLabel = node('label', undefined, 'checkbox'); checkLabel.htmlFor = id;
      checkLabel.append(input, document.createTextNode(label)); field.append(checkLabel);
    } else {
      if (input.tagName === 'INPUT') input.type = ['email', 'number'].includes(kind) ? kind : 'text';
      if (kind === 'role') {
        const roles = [['', '직위를 선택하세요'], ['Principal Investigator', '교수 · Principal Investigator'], ['PhD student', '박사과정 · PhD student'], ['Master’s student', '석사과정 · Master’s student'], ['Undergraduate researcher', '학부연구생 · Undergraduate researcher'], ['Postdoctoral researcher', '박사후연구원 · Postdoctoral researcher'], ['Alumni', '졸업생 · Alumni']];
        if (owner[key] && !roles.some(([value]) => value === owner[key])) roles.push([owner[key], owner[key] + ' (기존 값)']);
        roles.forEach(([value, label]) => { const option = node('option', label); option.value = value; input.append(option); });
      }
      if (kind === 'number') { input.min = '1900'; input.max = '2100'; input.step = '1'; }
      if (kind === 'url' || kind === 'image' || kind === 'noticeurl') input.inputMode = 'url';
      input.value = Array.isArray(owner[key]) ? owner[key].join(', ') : owner[key] == null ? '' : String(owner[key]);
      if (kind === 'textarea' || kind === 'ids') input.rows = 3;
      const fieldLabel = node('label', label); fieldLabel.htmlFor = id;
      field.append(fieldLabel, input);
    }
    if (hint) { const small = node('small', hint); small.id = id + '-hint'; input.setAttribute('aria-describedby', small.id); field.append(small); }
    let editStarted = false;
    input.addEventListener('focus', () => { editStarted = false; });
    input.addEventListener(kind === 'checkbox' ? 'change' : 'input', () => {
      if (!editStarted) { remember(); editStarted = true; }
      let value = kind === 'checkbox' ? input.checked : kind === 'number' && input.value !== '' ? Number(input.value) : input.value;
      if (originalArray) value = input.value.split(kind === 'ids' ? /[,\n]+/ : ',').map((part) => part.trim()).filter(Boolean);
      if (kind === 'ids') value = [...new Set(value)];
      if (key === 'image' && owner[key] !== value && owner.imagePreview) delete owner.imagePreview;
      if (key === 'schematic' && owner[key] !== value) { delete owner.schematicWidth; delete owner.schematicHeight; }
      owner[key] = value;
      if (onValue) onValue(key, value);
      changed();
      if (onTitle && ['title', 'name', 'date', 'year', 'role', 'category'].includes(key)) onTitle();
    });
    target.append(field);
  }
  function paperReference() {
    const reference = node('details', undefined, 'entry');
    reference.append(node('summary', '논문 ID 확인'));
    const list = node('ul');
    (data.publications || []).forEach((paper) => {
      const row = node('li');
      row.append(node('code', paper.id), document.createTextNode(' — ' + paper.title + ' (' + paper.year + ')'));
      list.append(row);
    });
    const body = node('div', undefined, 'entry-body'); body.append(list); reference.append(body);
    return reference;
  }
  function openResearch(categoryIndex, topicIndex) {
    const category = $('editor').querySelector('details[data-entry-index="' + categoryIndex + '"]');
    if (!category) return;
    category.open = true;
    const topic = topicIndex === undefined ? null : category.querySelector('details[data-topic-index="' + topicIndex + '"]');
    if (topic) topic.open = true;
    (topic || category).querySelector('input,textarea,select')?.focus();
  }
  const researchImageFields = [
    ['src', '그림 파일 주소', 'image', true, 'assets/research/파일명.webp 또는 https:// 이미지 주소를 입력하세요. 파일 업로드는 GitHub에서 따로 진행합니다.'],
    ['fullSrc', '고해상도 원본 주소 (선택)', 'image', true, '별도 원본 파일이 있으면 입력하세요. 비워 두면 위 그림 파일을 확대합니다.'],
    ['alt', '그림 설명', 'text', true, '그림이 보이지 않을 때도 내용을 이해할 수 있도록 설명해 주세요.'],
    ['caption', '그림 아래 설명 (선택)', 'textarea', true]
  ];
  function openResearchImage(categoryIndex, topicIndex, imageIndex) {
    openResearch(categoryIndex, topicIndex);
    const topic = $('editor').querySelector('details[data-entry-index="' + categoryIndex + '"] details[data-topic-index="' + topicIndex + '"]');
    const entry = topic?.querySelector('details[data-research-image-index="' + imageIndex + '"]');
    if (entry) { entry.open = true; entry.querySelector('input,textarea')?.focus(); }
  }
  function renderResearchImages(topic, categoryIndex, topicIndex, target) {
    const wrapper = node('section', undefined, 'post-content-editor');
    wrapper.append(node('h4', 'DETAIL 그림', 'group-heading'), node('p', '그림을 원문 순서대로 추가하세요. 이 목록이 있으면 위의 원본 자료 그림 대신 목록의 그림들이 DETAIL에 표시됩니다. 목록이 비면 기본 원본 그림을 사용합니다.', 'panel-note'));
    const add = node('button', '+ DETAIL 그림 추가'); add.type = 'button';
    add.addEventListener('click', () => {
      remember();
      if (!topic.detailImages) topic.detailImages = [];
      topic.detailImages.push({ src: '', alt: '', caption: '' });
      changed(); render(); openResearchImage(categoryIndex, topicIndex, topic.detailImages.length - 1);
    });
    wrapper.append(add);
    (topic.detailImages || []).forEach((image, imageIndex) => {
      const entry = node('details', undefined, 'entry content-block'); entry.dataset.researchImageIndex = String(imageIndex);
      const summary = node('summary'); const title = node('div', undefined, 'entry-title');
      const updateTitle = () => { title.textContent = (imageIndex + 1) + '. ' + String(image.caption || image.alt || image.src || '그림 주소를 입력하세요').slice(0, 90); };
      updateTitle(); summary.append(title); entry.append(summary);
      const body = node('div', undefined, 'entry-body'); const group = node('div', undefined, 'fields');
      const preview = node('img', undefined, 'post-image-preview'); preview.loading = 'lazy';
      const updateImage = () => {
        const valid = image.src && safeLink(image.src, true); preview.hidden = !valid;
        if (valid) preview.src = image.src.startsWith('assets/') ? '../' + image.src : image.src.startsWith('./assets/') ? '../' + image.src.slice(2) : image.src;
        else preview.removeAttribute('src');
        preview.alt = image.alt || image.caption || '연구 그림 미리보기';
      };
      let previousSrc = image.src;
      researchImageFields.forEach((field) => renderField(image, field, group, null, (key, value) => {
        if (key === 'src' && value !== previousSrc) {
          ['width', 'height', 'source', 'sourceURL', 'fullSrc'].forEach((metadata) => delete image[metadata]);
          const fullSrcInput = group.querySelector('[data-field="fullSrc"]'); if (fullSrcInput) fullSrcInput.value = '';
          previousSrc = value;
        }
        updateTitle(); updateImage();
      }));
      updateImage(); body.append(preview, group);
      const actions = node('div', undefined, 'entry-actions');
      [['↑ 위로', -1], ['↓ 아래로', 1]].forEach(([label, direction]) => {
        const button = node('button', label); button.type = 'button'; button.disabled = imageIndex + direction < 0 || imageIndex + direction >= topic.detailImages.length;
        button.setAttribute('aria-label', 'DETAIL 그림 ' + (imageIndex + 1) + ' ' + label);
        button.addEventListener('click', () => { remember(); [topic.detailImages[imageIndex], topic.detailImages[imageIndex + direction]] = [topic.detailImages[imageIndex + direction], topic.detailImages[imageIndex]]; changed(); render(); openResearchImage(categoryIndex, topicIndex, imageIndex + direction); });
        actions.append(button);
      });
      const remove = node('button', '그림 삭제', 'danger'); remove.type = 'button';
      remove.addEventListener('click', () => { remember(); topic.detailImages.splice(imageIndex, 1); changed(); render(); openResearch(categoryIndex, topicIndex); status('DETAIL 그림을 삭제했습니다. 되돌리기로 복구할 수 있습니다.'); });
      actions.append(remove); body.append(actions); entry.append(body); wrapper.append(entry);
    });
    target.append(wrapper);
  }
  function renderTopics(category, categoryIndex, target) {
    const wrapper = node('section', undefined, 'topics-editor');
    wrapper.append(node('h3', '하위 주제', 'group-heading'));
    const add = node('button', '+ 하위 주제 추가'); add.type = 'button';
    add.addEventListener('click', () => {
      remember();
      if (!category.topics) category.topics = [];
      const topic = { id: 'topic-' + (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now().toString(36)) };
      fields.topic.forEach(([key,,kind]) => topic[key] = kind === 'ids' ? [] : '');
      category.topics.unshift(topic); changed(); render(); openResearch(categoryIndex, 0);
    });
    wrapper.append(add);
    if (!(category.topics || []).length) wrapper.append(node('p', '하위 주제를 추가하세요.', 'empty'));
    (category.topics || []).forEach((topic, topicIndex) => {
      const entry = node('details', undefined, 'entry'); entry.dataset.topicIndex = String(topicIndex);
      const summary = node('summary'); const title = node('div', undefined, 'entry-title');
      const update = () => { title.textContent = topic.title || '제목 없는 하위 주제'; };
      update(); summary.append(title); entry.append(summary);
      const body = node('div', undefined, 'entry-body'); const group = node('div', undefined, 'fields');
      fields.topic.forEach((field) => renderField(topic, field, group, update)); body.append(group);
      renderResearchImages(topic, categoryIndex, topicIndex, body);
      const actions = node('div', undefined, 'entry-actions');
      [['↑ 위로', -1], ['↓ 아래로', 1]].forEach(([label, direction]) => {
        const button = node('button', label); button.type = 'button';
        button.disabled = topicIndex + direction < 0 || topicIndex + direction >= category.topics.length;
        button.setAttribute('aria-label', (topic.title || '하위 주제') + ' ' + label);
        button.addEventListener('click', () => {
          remember(); [category.topics[topicIndex], category.topics[topicIndex + direction]] = [category.topics[topicIndex + direction], category.topics[topicIndex]];
          changed(); render(); openResearch(categoryIndex, topicIndex + direction);
        }); actions.append(button);
      });
      const remove = node('button', '하위 주제 삭제', 'danger'); remove.type = 'button';
      remove.addEventListener('click', () => {
        remember(); category.topics.splice(topicIndex, 1); changed(); render(); openResearch(categoryIndex);
        status('하위 주제를 삭제했습니다. 되돌리기로 복구할 수 있습니다.');
      }); actions.append(remove);
      body.append(actions); entry.append(body); wrapper.append(entry);
    });
    target.append(wrapper);
  }
  const blockLabels = { paragraph: '문단', heading: '소제목', image: '사진', list: '목록', quote: '인용' };
  function blockText(value) {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    if (Array.isArray(value.children)) return value.children.map(blockText).join('');
    return String(value.text || '');
  }
  function openPost(index, blockIndex) {
    const entry = $('editor').querySelector('details[data-entry-index="' + index + '"]');
    if (!entry) return;
    entry.open = true;
    const block = blockIndex === undefined ? null : entry.querySelector('details[data-block-index="' + blockIndex + '"]');
    if (block) block.open = true;
    (block || entry).querySelector('input,textarea,select')?.focus();
  }
  function renderPostContent(post, postIndex, target) {
    const wrapper = node('section', undefined, 'post-content-editor');
    wrapper.append(node('h3', '게시물 내용', 'group-heading'), node('p', '문단과 사진을 표시할 순서대로 추가하세요. 기존 원문의 강조·링크는 해당 문단을 수정하기 전까지 보존됩니다.', 'panel-note'));
    const addControls = node('div', undefined, 'block-add-controls');
    const type = node('select'); type.id = 'block-type-' + postIndex;
    const typeLabel = node('label', '추가할 내용'); typeLabel.htmlFor = type.id;
    Object.entries(blockLabels).forEach(([value, label]) => { const option = node('option', label); option.value = value; type.append(option); });
    const add = node('button', '+ 내용 추가'); add.type = 'button';
    add.addEventListener('click', () => {
      remember();
      if (!post.content) post.content = [];
      post.content.push(type.value === 'image' ? { type: 'image', src: '', alt: '', caption: '' } : type.value === 'list' ? { type: 'list', items: [], ordered: false } : { type: type.value, text: '' });
      changed(); render(); openPost(postIndex, post.content.length - 1);
    });
    const preview = node('button', '게시물 미리보기 ↗'); preview.type = 'button';
    preview.addEventListener('click', () => { if (saveDraft()) { window.open('../news.html?preview=1&post=' + encodeURIComponent(post.id), '_blank', 'noopener'); status('저장한 초안의 게시물을 열었습니다. 공개 홈페이지는 바뀌지 않습니다.'); } });
    addControls.append(typeLabel, type, add, preview); wrapper.append(addControls);
    if (!(post.content || []).length) wrapper.append(node('p', '본문 블록이 없습니다. 위의 요약을 본문으로 사용하거나 문단·사진을 추가하세요.', 'panel-note'));
    (post.content || []).forEach((block, blockIndex) => {
      const entry = node('details', undefined, 'entry content-block'); entry.dataset.blockIndex = String(blockIndex);
      const summary = node('summary'); const title = node('div', undefined, 'entry-title');
      const updateTitle = () => { title.textContent = (blockIndex + 1) + '. ' + (blockLabels[block.type] || block.type || '기존 내용') + ' — ' + String(block.type === 'image' ? block.caption || block.alt || block.src || '사진 주소를 입력하세요' : block.type === 'list' ? (block.items || []).map(blockText).join(' · ') : blockText(block)).slice(0, 90); };
      updateTitle(); summary.append(title); entry.append(summary);
      const body = node('div', undefined, 'entry-body'); const group = node('div', undefined, 'fields');
      if (block.type === 'image') {
        const preview = node('img', undefined, 'post-image-preview'); preview.alt = block.alt || '게시물 사진 미리보기';
        const updateImage = () => { const valid = block.src && safeLink(block.src, true); preview.hidden = !valid; if (valid) preview.src = block.src.startsWith('assets/') ? '../' + block.src : block.src.startsWith('./assets/') ? '../' + block.src.slice(2) : block.src; preview.alt = block.alt || '게시물 사진 미리보기'; };
        [['src', '사진 파일 주소', 'image', true, 'assets/posts/파일명.jpg처럼 입력합니다. 파일 업로드는 GitHub에서 따로 진행하세요.'], ['fullSrc', '원본 사진 주소 (선택)', 'image', true, '고해상도 원본이 별도로 있으면 입력합니다. 비워 두면 위 사진 파일로 원본을 봅니다.'], ['alt', '사진 설명', 'text', true], ['caption', '사진 아래 설명', 'textarea', true]].forEach((field) => renderField(block, field, group, null, () => { updateTitle(); updateImage(); }));
        updateImage(); body.append(preview);
      } else if (block.type === 'list') {
        const edit = { text: (block.items || []).map(blockText).join('\n') };
        renderField(edit, ['text', '목록 항목', 'textarea', true, '한 줄에 한 항목을 입력하세요. 이 목록을 수정하면 항목 안의 강조와 링크는 일반 글자로 바뀝니다.'], group, null, () => { block.items = edit.text.split(/\n/).map((item) => item.trim()).filter(Boolean); updateTitle(); });
        renderField(block, ['ordered', '번호가 있는 목록', 'checkbox', true], group);
      } else if (['paragraph', 'heading', 'quote'].includes(block.type)) {
        const edit = { text: blockText(block) };
        renderField(edit, ['text', blockLabels[block.type] + ' 내용', 'textarea', true, block.children?.length ? '이 문단을 수정하면 원문의 강조와 문장 안 링크는 일반 글자로 바뀝니다.' : undefined], group, null, () => { block.text = edit.text; delete block.children; updateTitle(); });
      } else {
        group.append(node('p', '이 내용은 원문 형식을 보존해 저장합니다. 수정이 필요하면 새 문단이나 사진을 추가해 대체하세요.', 'panel-note'));
      }
      body.append(group);
      const actions = node('div', undefined, 'entry-actions');
      [['↑ 위로', -1], ['↓ 아래로', 1]].forEach(([label, direction]) => {
        const button = node('button', label); button.type = 'button'; button.disabled = blockIndex + direction < 0 || blockIndex + direction >= post.content.length;
        button.setAttribute('aria-label', (blockLabels[block.type] || '본문 내용') + ' ' + (blockIndex + 1) + ' ' + label);
        button.addEventListener('click', () => { remember(); [post.content[blockIndex], post.content[blockIndex + direction]] = [post.content[blockIndex + direction], post.content[blockIndex]]; changed(); render(); openPost(postIndex, blockIndex + direction); }); actions.append(button);
      });
      const remove = node('button', '내용 삭제', 'danger'); remove.type = 'button';
      remove.addEventListener('click', () => { remember(); post.content.splice(blockIndex, 1); changed(); render(); openPost(postIndex); status('본문 내용을 삭제했습니다. 되돌리기로 복구할 수 있습니다.'); });
      actions.append(remove); body.append(actions); entry.append(body); wrapper.append(entry);
    });
    target.append(wrapper);
  }
  function render() {
    if (!data) return;
    renderNav();
    const panel = $('editor'); panel.replaceChildren();
    const section = sections.find((item) => item.key === current);
    const header = node('div', undefined, 'panel-header');
    const heading = node('div'); heading.append(node('h2', section.label), node('p', section.help)); header.append(heading);
    panel.append(header);
    if (current === 'basic') {
      [['announcement', '홈 상단 공지'], ['site', '연구실 기본 정보'], ['join', '모집 안내'], ['hero', '홈 첫 화면']].forEach(([key, title]) => {
        if (!data[key]) data[key] = key === 'announcement' ? { enabled: true, title: data.join.title || '', body: data.join.description || '', url: 'join.html' } : {};
        panel.append(node('h3', title, 'group-heading'));
        if (key === 'hero') panel.append(node('p', '큰 랩 이름과 대표 그림을 관리합니다. 그 아래에는 홈 상단 공지, News, Publications가 표시됩니다.', 'panel-note'));
        const group = node('div', undefined, 'fields'); group.dataset.group = key;
        fields[key].forEach((field) => renderField(data[key], field, group)); panel.append(group);
      });
      return;
    }
    if (current === 'research') panel.append(paperReference());
    const add = node('button', '+ 새 항목 추가', 'primary'); add.type = 'button';
    add.addEventListener('click', () => {
      remember();
      if (!data[current]) data[current] = [];
      const item = { id: current + '-' + (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now().toString(36)) };
      fields[current].forEach(([key,,kind]) => item[key] = kind === 'checkbox' ? false : kind === 'ids' ? [] : kind === 'number' ? new Date().getFullYear() : '');
      if (current === 'research') item.topics = [];
      if (current === 'news') { item.date = new Date().toLocaleDateString('sv-SE'); item.content = []; }
      data[current].unshift(item); changed(); render();
      const first = panel.querySelector('details[data-entry-index="0"]'); if (first) { first.open = true; first.querySelector('input,textarea,select')?.focus(); }
    }); header.append(add);
    const entries = data[current] || [];
    if (!entries.length) panel.append(node('p', '아직 등록된 항목이 없습니다. 새 항목을 추가해 보세요.', 'empty'));
    entries.forEach((item, index) => {
      const entry = node('details', undefined, 'entry'); entry.dataset.entryIndex = String(index);
      const summary = node('summary'); const text = node('div', undefined, 'entry-title'); const meta = node('div', undefined, 'entry-meta');
      const updateTitle = () => { text.replaceChildren(document.createTextNode(item.title || item.name || '제목 없는 새 항목'), meta); meta.textContent = [item.date || item.year || '', item.category || item.role || ''].filter(Boolean).join(' · '); };
      updateTitle(); summary.append(text); entry.append(summary);
      const body = node('div', undefined, 'entry-body'); const group = node('div', undefined, 'fields');
      fields[current].forEach((field) => renderField(item, field, group, updateTitle)); body.append(group);
      if (current === 'research') renderTopics(item, index, body);
      if (current === 'news') renderPostContent(item, index, body);
      const actions = node('div', undefined, 'entry-actions');
      [['↑ 위로', -1], ['↓ 아래로', 1]].forEach(([label, direction]) => {
        const button = node('button', label); button.type = 'button'; button.disabled = index + direction < 0 || index + direction >= entries.length;
        button.setAttribute('aria-label', (item.title || item.name || '항목') + ' ' + label);
        button.addEventListener('click', () => { remember(); [entries[index], entries[index + direction]] = [entries[index + direction], entries[index]]; changed(); render(); }); actions.append(button);
      });
      const remove = node('button', '항목 삭제', 'danger'); remove.type = 'button';
      remove.addEventListener('click', () => { remember(); entries.splice(index, 1); changed(); render(); status('항목을 삭제했습니다. 상단의 되돌리기로 복구할 수 있습니다.'); }); actions.append(remove);
      body.append(actions); entry.append(body); panel.append(entry);
    });
  }
  function safeLink(value, image = false) {
    if (!value) return true;
    if (image && /^(?:\.\/)?assets\/[A-Za-z0-9_./%() \-]+$/.test(value) && !value.includes('..')) return true;
    if (/\s/.test(value)) return false;
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
  }
  function safeNoticeLink(value) {
    if (!value) return true;
    if (/^(?:index|research|people|students|publications|news|activities|join)\.html(?:#[A-Za-z0-9_-]+)?$/.test(value)) return true;
    return safeLink(value);
  }
  function validate() {
    try { shape(data); } catch (error) { status(error.message, true); return false; }
    const errors = [];
    const publicationIds = new Set((data.publications || []).map((paper) => paper.id));
    function checkFields(item, definitions, context) {
      definitions.forEach(([field, label, kind]) => {
        const value = item[field]; let message = '';
        if ((kind === 'url' || kind === 'image') && value && !safeLink(String(value), kind === 'image')) message = label + ': https:// 주소' + (kind === 'image' ? ' 또는 assets/ 상대경로' : '') + '를 입력하세요.';
        if (kind === 'noticeurl' && value && !safeNoticeLink(String(value))) message = '공지 링크: join.html 같은 내부 페이지 또는 https:// 주소를 입력하세요.';
        if (kind === 'number' && (value === undefined || value === '' || !Number.isInteger(Number(value)) || Number(value) < 1900 || Number(value) > 2100)) message = label + ': 1900~2100 사이의 연도를 입력하세요.';
        if (kind === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) message = label + ': 이메일 형식을 확인하세요.';
        if (kind === 'ids' && value !== undefined) {
          if (!Array.isArray(value)) message = label + ': 쉼표로 구분한 목록을 입력하세요.';
          else if (field === 'paperIds') {
            const unknown = value.filter((id) => !publicationIds.has(id));
            if (unknown.length) message = '등록되지 않은 논문 ID: ' + unknown.join(', ') + '. 논문 ID 확인 목록을 참고하세요.';
          }
        }
        if (context.key === 'news' && field === 'date') {
          const dateMatch = String(value || '').match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
          const validDate = dateMatch && Number(dateMatch[2]) >= 1 && Number(dateMatch[2]) <= 12 && (!dateMatch[3] || (Number(dateMatch[3]) >= 1 && Number(dateMatch[3]) <= new Date(Number(dateMatch[1]), Number(dateMatch[2]), 0).getDate()));
          if (!validDate) message = '소식 날짜를 YYYY-MM 또는 YYYY-MM-DD 형식의 실제 날짜로 입력하세요.';
        }
        if (message) errors.push({ ...context, field, message });
      });
    }
    ['announcement', 'site', 'hero', 'join', 'research', 'publications', 'underReview', 'news', 'people'].forEach((key) => {
      const basic = ['announcement', 'site', 'hero', 'join'].includes(key);
      const list = Array.isArray(data[key]) ? data[key] : [data[key] || {}];
      list.forEach((item, index) => {
        const context = { key: basic ? 'basic' : key, group: basic ? key : undefined, index };
        const nameField = key === 'people' ? 'name' : 'title';
        if (!basic && !String(item[nameField] || '').trim()) errors.push({ ...context, field: nameField, message: (key === 'people' ? '구성원 이름' : '항목 제목') + '을 입력하거나 빈 항목을 삭제해 주세요.' });
        if (key === 'announcement' && item.enabled && !String(item.title || '').trim() && !String(item.body || '').trim()) errors.push({ ...context, field: 'title', message: '공지를 표시하려면 제목 또는 내용을 입력하세요.' });
        checkFields(item, fields[key], context);
        if (key === 'research') (item.topics || []).forEach((topic, topicIndex) => {
          const topicContext = { key: 'research', index, topicIndex };
          if (!String(topic.title || '').trim()) errors.push({ ...topicContext, field: 'title', message: '하위 주제명을 입력하거나 빈 하위 주제를 삭제해 주세요.' });
          checkFields(topic, fields.topic, topicContext);
          (topic.detailImages || []).forEach((image, imageIndex) => {
            const imageContext = { ...topicContext, imageIndex };
            checkFields(image, researchImageFields, imageContext);
            if (!String(image.src || '').trim()) errors.push({ ...imageContext, field: 'src', message: 'DETAIL 그림 파일 주소를 입력하거나 빈 그림 항목을 삭제하세요.' });
            if (!String(image.alt || '').trim()) errors.push({ ...imageContext, field: 'alt', message: 'DETAIL 그림 설명을 입력하세요.' });
          });
        });
        if (key === 'news') (item.content || []).forEach((block, blockIndex) => {
          const blockContext = { key: 'news', index, blockIndex };
          if (block.type === 'image' && (!String(block.src || '').trim() || !safeLink(block.src, true))) errors.push({ ...blockContext, field: 'src', message: '본문 사진 주소에 assets/posts/파일명.jpg 또는 https:// 주소를 입력하거나 빈 사진 블록을 삭제하세요.' });
          if (block.type === 'image' && block.fullSrc && !safeLink(block.fullSrc, true)) errors.push({ ...blockContext, field: 'fullSrc', message: '원본 사진 주소는 assets/posts/파일명.jpg 또는 https:// 주소를 입력하거나 비워 두세요.' });
          const checkRuns = (value) => {
            if (!value || typeof value !== 'object') return;
            if (value.url && !safeLink(value.url)) errors.push({ ...blockContext, field: 'text', message: '게시물 본문의 링크는 https:// 주소를 사용하세요. 해당 문단을 일반 글자로 수정해 링크를 제거할 수도 있습니다.' });
            if (Array.isArray(value.children)) value.children.forEach(checkRuns);
          };
          checkRuns(block); (block.items || []).forEach(checkRuns);
        });
      });
    });
    if (errors.length) {
      const error = errors[0]; current = error.key; render();
      let target = current === 'basic' ? $('editor').querySelector('[data-group="' + error.group + '"]') : $('editor').querySelector('details[data-entry-index="' + error.index + '"]');
      if (current !== 'basic' && target) {
        target.open = true;
        if (error.topicIndex !== undefined) {
          target = target.querySelector('details[data-topic-index="' + error.topicIndex + '"]');
          if (target) target.open = true;
        }
        if (error.blockIndex !== undefined) {
          target = target.querySelector('details[data-block-index="' + error.blockIndex + '"]');
          if (target) target.open = true;
        }
        if (error.imageIndex !== undefined) {
          target = target?.querySelector('details[data-research-image-index="' + error.imageIndex + '"]');
          if (target) target.open = true;
        }
      }
      status(error.message, true);
      const input = target?.querySelector('[data-field="' + error.field + '"]');
      if (input) input.focus(); else $('editor').focus();
      return false;
    }
    return true;
  }
  function saveDraft() {
    if (!validate()) return false;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); unsaved = false; $('draft-notice').hidden = false; status('이 브라우저에 초안을 저장했습니다. 공개 홈페이지에는 아직 반영되지 않았습니다.'); return true; }
    catch { status('브라우저에 초안을 저장할 수 없습니다. site.json을 다운로드해 보관해 주세요.', true); return false; }
  }
  $('save').addEventListener('click', saveDraft);
  $('preview').addEventListener('click', () => { if (saveDraft()) { window.open('../' + (current === 'underReview' ? 'publications.html' : 'index.html') + '?preview=1', '_blank', 'noopener'); status('초안을 저장하고 미리보기를 열었습니다. 공개 홈페이지는 바뀌지 않습니다.'); } });
  $('download').addEventListener('click', () => {
    if (!validate()) return;
    const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = node('a'); link.href = url; link.download = 'site.json'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    unsaved = false; status('다운로드를 요청했습니다. 받은 site.json을 GitHub의 content/site.json에 덮어 올리고 Commit해야 게시됩니다.');
  });
  $('undo').addEventListener('click', () => { if (!history.length) return; data = history.pop(); $('undo').disabled = !history.length; changed(); render(); status('직전 수정을 되돌렸습니다. 초안을 다시 저장해 주세요.'); });
  $('restore-draft').addEventListener('click', () => {
    try { const stored = localStorage.getItem(STORAGE_KEY); if (!stored) throw new Error('저장된 초안이 없습니다.'); const restored = shape(JSON.parse(stored)); if (data) remember(); data = restored; controls(true); changed(); render(); status('저장된 초안을 불러왔습니다. 미리보기로 확인해 주세요.'); }
    catch (error) { status('초안을 불러오지 못했습니다: ' + error.message, true); }
  });
  $('discard-draft').addEventListener('click', () => { try { localStorage.removeItem(STORAGE_KEY); $('draft-notice').hidden = true; status('저장 초안만 지웠습니다. 현재 편집 화면과 공개 사이트는 바뀌지 않았습니다.'); } catch { status('이 브라우저에서 초안을 지울 수 없습니다.', true); } });
  $('import-file').addEventListener('change', async (event) => {
    const file = event.target.files[0]; if (!file) return;
    try { if (file.size > 5 * 1024 * 1024) throw new Error('파일은 5MB 이하여야 합니다.'); const imported = shape(JSON.parse(await file.text())); if (data) remember(); data = imported; controls(true); changed(); render(); status('파일을 불러왔습니다. 내용을 확인한 후 미리보기 또는 다운로드하세요.'); }
    catch (error) { status('파일을 불러오지 못했습니다: ' + error.message, true); } finally { event.target.value = ''; }
  });
  window.addEventListener('beforeunload', (event) => { if (unsaved) { event.preventDefault(); event.returnValue = ''; } });
  try { $('draft-notice').hidden = !localStorage.getItem(STORAGE_KEY); } catch { /* File download is available without localStorage. */ }
  fetch('../content/site.json', { cache: 'no-store' }).then((response) => { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); }).then((value) => { data = shape(value); controls(true); render(); status('현재 사이트 정보를 불러왔습니다. 편집할 항목을 선택하세요.'); }).catch((error) => { console.error('Content editor initialization failed:', error); status('사이트 정보를 읽을 수 없습니다. 로컬 미리보기 서버에서 열거나 site.json 파일을 불러오세요.', true); });
})();
