export const pages = ['index', 'research', 'people', 'students', 'publications', 'news', 'activities', 'join'];
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e = escapeHTML;
export function safeURL(value, fallback = '') {
  const url = String(value ?? '').trim();
  if (/^https:\/\/[^\s]+$/i.test(url)) return url;
  if (/^(?:\.\/)?assets\/[a-z0-9_./%() -]+$/i.test(url) && !url.includes('..')) return url;
  return fallback;
}
const external = (url, text, cls = '', attributes = '') => safeURL(url) ? `<a class="${cls}"${attributes} href="${e(safeURL(url))}" target="_blank" rel="noopener noreferrer">${text}<span class="sr-only"> (opens in a new tab)</span></a>` : `<span${attributes}>${text}</span>`;
const mail = (email, text, attributes = '') => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email || '') ? `<a${attributes} href="mailto:${e(email)}">${e(text || email).replace('@','@<wbr>')}</a>` : '';
const language = value => /[가-힣]/.test(String(value||'')) ? ' lang="ko"' : '';
const paragraphs = value => String(value || '').split(/\n+/).filter(Boolean).map(v => `<p${language(v)}>${e(v)}</p>`).join('');
const date = value => String(value || '').replaceAll('-','.');
export const sortedNews = data => [...data.news].sort((a,b) => String(b.date).localeCompare(String(a.date)));
export const sortedPublications = data => [...data.publications].sort((a,b) => Number(b.year) - Number(a.year));
export const publicationYearGroup=(year,periods=[])=>{
 const period=periods.find(period=>Number(year)>=period.from&&Number(year)<=period.to);
 return period?`${period.from}-${period.to}`:String(year);
};
const publicationYearLabel=group=>group.replace(/^(\d{4})-(\d{4})$/,'$1–$2');
export const postFileName = item => `post-${item.id}.html`;
export const findPost = (data,page) => page.startsWith('post-') ? data.news.find(n=>n.id===page.slice(5)) : undefined;
export function pageTitle(data,page) {
 const post=findPost(data,page),labels={people:'Professor',students:'Students',activities:'Activities',join:'Join Us','404':'404 · Page not found'};
 return (page==='index'?'':(post?.title||labels[page]||page[0].toUpperCase()+page.slice(1))+' | ')+data.site.title;
}
export function appearanceCSS(data) {
 const settings=data?.appearance;
 if(!settings||typeof settings!=='object'||Array.isArray(settings))return '';
 const variables=[];
 const color=value=>{
  if(typeof value!=='string')return '';
  const hex=value.trim().toLowerCase();
  if(/^#[0-9a-f]{6}$/.test(hex))return hex;
  return /^#[0-9a-f]{3}$/.test(hex)?'#'+[...hex.slice(1)].map(digit=>digit+digit).join(''):'';
 };
 const primary=color(settings.primaryColor),accent=color(settings.accentColor);
 if(primary)variables.push(`--navy:${primary}`);
 if(accent)variables.push(`--purple:${accent}`,`--purple-text:${accent}`);
 for(const [key,variable,min,max] of [['pageWidth','--page-width',1000,1500],['pageGutter','--page-gutter',20,72],['spacing','--layout-gap',20,48]]){
  const value=settings[key];
  if(typeof value==='number'&&Number.isFinite(value))variables.push(`${variable}:${Math.min(max,Math.max(min,Math.round(value)))}px`);
 }
 return variables.length?`:root{${variables.join(';')}}@media(max-width:600px){:root{--page-gutter:20px;--layout-gap:24px}}`:'';
}
const sectionTitle = (title, link, label) => `<div class="section-heading"><h2>${title}</h2>${link ? `<a class="more-link" href="${link}"><span>${label}</span><span aria-hidden="true">→</span></a>` : ''}</div>`;

function thumbnailImage(display,source,sizes,crop=null) {
 if(display?.source!==source||!Array.isArray(display.variants)||JSON.stringify(display.crop??null)!==JSON.stringify(crop))return null;
 const variants=display.variants.filter(v=>safeURL(v?.src).startsWith('assets/')&&Number.isInteger(v.width)&&v.width>0&&Number.isInteger(v.height)&&v.height>0).sort((a,b)=>a.width-b.width);
 if(!variants.length)return null;
 const {src,width,height}=variants.at(-1);
 return {src,width,height,responsive:variants.length>1?` srcset="${e(variants.map(v=>`${v.src} ${v.width}w`).join(', '))}" sizes="${sizes}"`:''};
}
const zoomIcon='<span class="figure-zoom" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5M7.5 10.5h6m-3-3v6"/></svg></span>';
function zoomLink({image,original=image,title,label='',source='',width,height,crop,originalAlt='',cls=''},content) {
 const dimensions=Number(width)>0&&Number(height)>0?` data-figure-width="${Number(width)}" data-figure-height="${Number(height)}"`:'';
 const panel=crop?` data-figure-crop="${e(JSON.stringify(crop))}"`:'';
 return `<a class="figure-trigger${cls?' '+cls:''}" href="${e(original)}" target="_blank" rel="noopener noreferrer" data-figure-image="${e(image)}" data-figure-title="${e(title)}" data-figure-label="${e(label)}" data-figure-source="${e(source)}"${originalAlt?` data-figure-original-alt="${e(originalAlt)}"`:''}${dimensions}${panel} aria-label="Enlarge image — ${e(title)}">${content}${zoomIcon}</a>`;
}
const figureViewer = `<dialog id="image-viewer" class="publication-viewer" aria-labelledby="figure-viewer-title">
 <div class="figure-viewer-heading"><h2 id="figure-viewer-title"></h2><button class="figure-viewer-close" type="button" aria-label="Close image">×</button></div>
 <p class="figure-viewer-label"></p>
 <div class="figure-viewer-tools">
  <div class="figure-viewer-modes" role="group" aria-label="Image view" hidden><button type="button" data-figure-mode="panel" aria-pressed="true">Selected panel</button><button type="button" data-figure-mode="full" aria-pressed="false">Full figure</button></div>
  <div class="figure-viewer-scale" role="group" aria-label="Image zoom"><button class="figure-viewer-zoom" type="button" aria-label="Zoom in">+</button><button class="figure-viewer-fit" type="button">Fit to screen</button></div>
 </div>
 <div class="figure-viewer-viewport" role="region" aria-label="Figure. Scroll to move around the zoomed image."><div class="figure-viewer-frame"><img class="figure-viewer-image" alt=""></div></div>
 <div class="figure-viewer-links"><a class="figure-viewer-original" target="_blank" rel="noopener noreferrer">Open original image ↗</a><a class="figure-viewer-source" target="_blank" rel="noopener noreferrer">Figure source ↗</a></div>
</dialog>`;

function editContext(data, enabled = false) {
 const edit=(path,type,label,descriptor={})=>enabled&&path?` data-edit-path="${e(path)}" data-edit-type="${e(type)}" data-edit-label="${e(label)}" data-edit-descriptor="${e(JSON.stringify({path,type,label,...descriptor}))}"`:'';
 edit.enabled=Boolean(enabled);
 edit.item=(path,label='')=>enabled&&path?` data-edit-item="${e(path)}"${label?` data-edit-item-label="${e(label)}"`:''}`:'';
 edit.collection=(path,label='')=>enabled&&path?` data-edit-collection="${e(path)}"${label?` data-edit-collection-label="${e(label)}"`:''}`:'';
 edit.path=(collection,item)=>{const index=(data[collection]||[]).findIndex(value=>value.id===item.id);return index<0?'':`/${collection}/${index}`;};
 edit.paragraphs=(value,path,label)=>enabled?`<div${edit(path,'multiline',label)}>${paragraphs(value)}</div>`:paragraphs(value);
 return edit;
}


function header(data,page,edit) {
 const member=['people','students'].includes(page),highlights=['news','activities'].includes(page)||page.startsWith('post-');
 const prefix=page==='404'?'/':'';
 const link=(id,label,state=page===id?' aria-current="page"':'')=>`<a href="${prefix}${id}.html"${state}>${label}</a>`;
 const group=(mobile,id,label,active,first,children)=>mobile
  ?`<div class="nav-item"><span class="nav-group-label${active?' section-current':''}" id="mobile-nav-${id}">${label}</span><div class="nav-dropdown" role="group" aria-labelledby="mobile-nav-${id}">${children}</div></div>`
  :`<div class="nav-item has-submenu">${link(first,label,active?' class="section-current"':'')}<button type="button" class="nav-submenu-toggle" aria-label="${label} submenu" aria-expanded="false" aria-controls="nav-${id}"></button><div class="nav-dropdown" id="nav-${id}">${children}</div></div>`;
 const navigation=mobile=>`<div class="nav-item">${link('index','Home')}</div>
     ${group(mobile,'member','Member',member,'people',link('people','Professor')+link('students','Students'))}
     <div class="nav-item">${link('publications','Publication')}</div>
     <div class="nav-item">${link('research','Research')}</div>
     ${group(mobile,'highlights','Highlights',highlights,'news',link('news','News')+link('activities','Activities'))}`;
 return `<header class="site-header"><div class="container header-inner">
   <a class="brand" href="${prefix}index.html" aria-label="${e(data.site.title)} — Home"><span${edit('/site/group','text','연구 그룹명')}>${e(data.site.group)}</span><small>@ Sogang Univ.</small></a>
   <button class="menu-toggle" type="button" aria-expanded="false" aria-haspopup="dialog" aria-controls="mobile-navigation"><span class="menu-label">Menu</span><span class="menu-icon" aria-hidden="true">☰</span></button>
   <nav id="main-nav" aria-label="Main navigation">${navigation(false)}</nav>
 </div><dialog id="mobile-navigation" class="mobile-menu" aria-labelledby="mobile-menu-title"><div class="mobile-menu-heading"><h2 id="mobile-menu-title">Menu</h2><button class="mobile-menu-close" type="button" aria-label="Close menu" autofocus><span aria-hidden="true">×</span></button></div><nav class="mobile-menu-links" aria-label="Mobile navigation">${navigation(true)}</nav></dialog></header>`;
}

function footer(data,page,edit) {
 const contactHref=page==='404'?'/join.html#contact-heading':'join.html#contact-heading';
 return `<footer class="site-footer"><div class="container footer-inner"><span class="footer-affiliation"${edit('/site/affiliation','text','소속')}>${e(data.site.affiliation)}</span><div class="footer-contact"><a class="footer-address" href="${contactHref}"${edit('/site/address','text','연구실 주소')}>${e(data.site.address)}</a><span class="footer-email"${edit('/site/email','email','대표 이메일')}>${mail(data.site.email)}</span><span class="copyright">© ${new Date().getUTCFullYear()}</span></div></div></footer>`;
}
function publicationAuthors(p) {
 const authors=Array.isArray(p.authors)?p.authors.join(', '):String(p.authors||'');
 const labAuthors=new Set(Array.isArray(p.labAuthors)?p.labAuthors:[]);
 return authors.split(/(,\s*|;\s*|\band\s+)/).map(part=>{
   const [,leading,name,markers,trailing]=part.match(/^(\s*)(.*?)([*†‡]*)(\s*)$/s);
   const author=labAuthors.has(name)?`<strong class="lab-author">${e(name)}</strong>`:e(name);
   const roles=[markers.includes('†')?'Equal contribution':'',markers.includes('*')?'Corresponding author':''].filter(Boolean).join('; ');
   return `${e(leading)}${author}${markers?`<sup class="author-markers"${roles?` aria-label="${e(roles)}" title="${e(roles)}"`:''}>${e(markers)}</sup>`:''}${e(trailing)}`;
 }).join('');
}
function publicationCitation(value) {
 const text=String(value||''),at=text.search(/\s+(?:\d+(?:\([^)]*\))?,|\(\d{4}\))/);
 const name=at<0?text:text.slice(0,at),details=at<0?'':text.slice(at);
 return `<span class="journal-name">${e(name)}</span>${details?`<span class="citation-details">${e(details)}</span>`:''}`;
}
export function publicationTitle(paper, displayTitle = paper.title) {
 const title=String(displayTitle||''),segments=paper.titleSegments;
 if(title!==paper.title||!Array.isArray(segments)||!segments.length||segments.some(run=>!run||typeof run.text!=='string'||(run.italic!==undefined&&typeof run.italic!=='boolean'))||segments.map(run=>run.text).join('')!==title)return e(title);
 return segments.map(run=>run.italic?`<em>${e(run.text)}</em>`:e(run.text)).join('');
}
function pubEntry(p,number,compact=false,edit) {
 const path=edit.path('publications',p);
 const image=!compact&&safeURL(p.image),label=p.imageLabel||'Research figure';
 const crop=p.imagePreview,hasCrop=crop&&[crop.x,crop.y,crop.width,crop.height].every(Number.isFinite)&&crop.x>=0&&crop.y>=0&&crop.width>0&&crop.height>0&&crop.x+crop.width<=1&&crop.y+crop.height<=1&&p.imageWidth>0&&p.imageHeight>0;
 const display=image&&thumbnailImage(p.imageThumbnail,image,'(max-width: 600px) min(360px, calc(100vw - 64px)), (max-width: 800px) 180px, 220px',hasCrop?[crop.x,crop.y,crop.width,crop.height]:null);
 const cropInCSS=hasCrop&&!display, width=display?.width||p.imageWidth,height=display?.height||p.imageHeight;
 const imageHTML=`<img src="${e(display?.src||image)}"${display?.responsive||''} alt="${e(p.imageAlt||label+' from '+p.title)}" loading="lazy" decoding="async"${width&&height?` width="${Number(width)}" height="${Number(height)}"`:''}${cropInCSS?` style="position:absolute;max-width:none;max-height:none;width:${100/crop.width}%;height:auto;left:${-100*crop.x/crop.width}%;top:${-100*crop.y/crop.height}%"`:''}${edit(path+'/image','image','논문 그림',{altPath:path+'/imageAlt',widthPath:path+'/imageWidth',heightPath:path+'/imageHeight',cropPath:path+'/imagePreview',sourcePath:path+'/imageSource',imageLabelPath:path+'/imageLabel'})}>`;
 const thumbnail=cropInCSS?`<span class="pub-figure-panel" style="--preview-ratio:${p.imageWidth*crop.width/(p.imageHeight*crop.height)};aspect-ratio:var(--preview-ratio)">${imageHTML}</span>`:imageHTML;
 const figure=image?`<figure class="pub-figure">${zoomLink({image,title:p.title,label,source:safeURL(p.imageSource),width:p.imageWidth,height:p.imageHeight,crop:hasCrop?crop:null,originalAlt:hasCrop?`Full ${label.toLowerCase()} from ${p.title}`:'',cls:'pub-figure-link'},thumbnail)}</figure>`:'';
 return `<article class="publication${compact?' publication-short':' publication-illustrated'+(image?' has-figure':'')}" data-year="${e(p.year)}" data-search="${e([p.title,p.authors,p.journal,p.doi].join(' '))}" data-publication-url="${e(safeURL(p.url))}" data-publication-doi="${e(p.doi||'')}" data-publication-figure-source="${e(safeURL(p.imageSource))}"${edit.item(path,'논문')}>
   ${compact?'':`<span class="pub-index">${number}.</span>`}
   <div class="pub-content"><h3${edit(path+'/title','publication-title','논문 제목',{segmentsPath:path+'/titleSegments',urlPath:path+'/url',doiPath:path+'/doi'})}>${external(p.url||(p.doi?'https://doi.org/'+p.doi:''),publicationTitle(p))}</h3>
   <p class="authors"${edit(path+'/authors','multiline','논문 저자',{labAuthorsPath:path+'/labAuthors'})}>${publicationAuthors(p)}</p>
   <p class="pub-journal"${edit(path+'/journal','text','학술지 · 권 · 페이지')}>${publicationCitation(p.journal)}</p></div>
   ${figure}
 </article>`;
}
function newsEntry(n,edit) {
 const path=edit.path('news',n);
 return `<article class="news-entry compact" id="${e(n.id)}"${edit.item(path,'게시물')}><time datetime="${e(n.date)}"${edit(path+'/date','date','게시 날짜')}>${e(date(n.date))}</time><div class="news-content"><h3${edit(path+'/title','text','게시물 제목')}><a href="${e(postFileName(n))}">${e(n.title)}</a></h3></div></article>`;
}
function highlightExcerpt(n) {
 const text=(n.content||[]).filter(block=>['paragraph','quote'].includes(block.type)).map(block=>Array.isArray(block.children)?block.children.map(run=>String(run.text||'')).join(''):String(block.text||'')).map(value=>value.trim()).filter(Boolean);
 return (n.excerpt?.trim()?n.excerpt.split(/\n+/):text.length?text:String(n.summary||n.body||'').split(/\n+/)).map(value=>value.trim()).filter(Boolean).slice(0,2);
}
function highlightProse(text,n) {
 if(n.category!=='Awards')return e(text);
 const block=!n.excerpt?.trim()&&(n.content||[]).find(block=>['paragraph','quote'].includes(block.type)&&(Array.isArray(block.children)?block.children.map(run=>String(run.text||'')).join(''):String(block.text||'')).trim()===text);
 if(block&&Array.isArray(block.children))return postInline({children:block.children.map(({text,bold,italic})=>({text,bold,italic}))});
 return e(text).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replaceAll('\n','<br>');
}
function highlightEntry(n,edit) {
 const path=edit.path('news',n),firstPhotoIndex=(n.content||[]).findIndex(block=>block.type==='image');
 const firstPhoto=(n.content||[]).find(block=>block.type==='image'),image=safeURL(n.image)||safeURL(firstPhoto?.src);
 const display=image&&thumbnailImage(n.imageThumbnail,image,'(max-width: 800px) min(640px, calc(100vw - 48px)), 400px');
 const dimensions=display||(image===safeURL(firstPhoto?.src)?firstPhoto:null);
 const size=dimensions?.width&&dimensions?.height?` width="${Number(dimensions.width)}" height="${Number(dimensions.height)}"`:'';
 const excerpt=highlightExcerpt(n);
 const excerptAttributes=text=>{
  if(n.excerpt?.trim())return edit(path+'/excerpt','multiline','목록 소개');
  const blockIndex=(n.content||[]).findIndex(block=>['paragraph','quote'].includes(block.type)&&(Array.isArray(block.children)?block.children.map(run=>String(run.text||'')).join(''):String(block.text||'')).trim()===text);
  return blockIndex>=0?edit(path+'/content/'+blockIndex,'richtext','게시물 본문'):edit(path+'/'+(n.summary?'summary':'body'),'multiline','게시물 소개');
 };
 const imagePath=safeURL(n.image)?path+'/image':path+'/content/'+firstPhotoIndex+'/src';
 const imageDescriptor=safeURL(n.image)?{altPath:path+'/imageAlt'}:{altPath:path+'/content/'+firstPhotoIndex+'/alt',widthPath:path+'/content/'+firstPhotoIndex+'/width',heightPath:path+'/content/'+firstPhotoIndex+'/height',fullSrcPath:path+'/content/'+firstPhotoIndex+'/fullSrc'};
 const details=excerpt.length?`<div class="highlight-excerpt">${excerpt.map(text=>`<p${language(text)}${excerptAttributes(text)}>${highlightProse(text,n)}</p>`).join('')}</div>`:'';
 const meta=`<time id="${e(n.id)}-date" datetime="${e(n.date)}"${edit(path+'/date','date','게시 날짜')}>${e(date(n.date))}</time>`;
 const figure=image?`<figure class="highlight-image"><img src="${e(display?.src||image)}"${display?.responsive||''} alt="${e(n.imageAlt||firstPhoto?.alt||n.title)}" loading="lazy" decoding="async"${size}${edit(imagePath,'image','목록 대표 사진',imageDescriptor)}></figure>`:'';
 return `<article class="news-entry highlight-entry${image?' has-image':''}" id="${e(n.id)}" data-category="${e(n.category)}"${edit.item(path,n.category==='Activities'?'활동':'소식')}><a class="highlight-link" href="${e(postFileName(n))}" aria-labelledby="${e(n.id)}-title" aria-describedby="${e(n.id)}-date"><div class="highlight-copy"><h2 id="${e(n.id)}-title"${language(n.title)}${edit(path+'/title','text','게시물 제목')}>${e(n.title)}</h2>${n.category==='Activities'?meta:`<div class="highlight-meta"><span class="highlight-category"${edit(path+'/category','text','게시물 분류',{options:['Awards','Conferences','Activities']})}>${e(n.category)}</span>${meta}</div>`}</div>${figure}${details}</a></article>`;
}

function postInline(block) {
 if(!Array.isArray(block.children))return e(block.text||'').replaceAll('\n','<br>');
 return block.children.map(run=>{
  let text=e(run.text||'').replaceAll('\n','<br>');
  if(run.bold)text=`<strong>${text}</strong>`;
  if(run.italic)text=`<em>${text}</em>`;
  if(run.url&&safeURL(run.url))text=external(run.url,text);
  return text;
 }).join('');
}
function postBlock(block,edit,path,legacyField='',coverThumbnail) {
 if(block.type==='image'){
  const src=safeURL(block.src);if(!src)return '';const fullSrc=safeURL(block.fullSrc)||src;
  const size=Number(block.width)>0&&Number(block.height)>0?` width="${Number(block.width)}" height="${Number(block.height)}"`:'';
  const imagePath=legacyField?path+'/image':path+'/src',descriptor=legacyField?{altPath:path+'/imageAlt'}:{altPath:path+'/alt',widthPath:path+'/width',heightPath:path+'/height',fullSrcPath:path+'/fullSrc'};
  const photo=`<img src="${e(src)}" alt="${e(block.alt||'')}"${size} loading="lazy" decoding="async"${edit(imagePath,'image','본문 사진',descriptor)}>`;
  const cover=thumbnailImage(coverThumbnail,src,'(max-width: 600px) calc(100vw - 48px), calc(100vw - 56px)');
  const responsivePhoto=cover?.responsive?`<picture><source media="(max-width: 800px)"${cover.responsive}>${photo}</picture>`:photo;
  return `<figure class="post-photo"${legacyField?'':edit.item(path,'본문 사진')}>${zoomLink({image:fullSrc,title:block.alt||'Photo',label:block.caption,width:fullSrc===src?block.width:undefined,height:fullSrc===src?block.height:undefined},responsivePhoto)}${block.caption?`<figcaption${language(block.caption)}${edit(path+'/caption','text','사진 아래 설명')}>${e(block.caption)}</figcaption>`:''}</figure>`;
 }
 const lang=language(block.text||(block.children||[]).map(run=>run.text).join(' '));
 const attributes=edit(legacyField?path+'/'+legacyField:path,legacyField?'multiline':'richtext',block.type==='heading'?'본문 소제목':block.type==='quote'?'인용문':block.type==='list'?'본문 목록':'게시물 본문')+(legacyField?'':edit.item(path,'본문 내용'));
 if(block.type==='heading')return `<h2${lang}${attributes}>${postInline(block)}</h2>`;
 if(block.type==='quote')return `<blockquote${lang}${attributes}>${postInline(block)}</blockquote>`;
 if(block.type==='list'){
  const tag=block.ordered?'ol':'ul';
  return `<${tag}${attributes}>${(block.items||[]).map(item=>`<li>${typeof item==='string'?e(item):postInline(item)}</li>`).join('')}</${tag}>`;
 }
 return `<p${lang}${attributes}>${postInline(block)}</p>`;
}
function postPage(data,page,edit) {
 const post=findPost(data,page);
 if(!post)return `<main id="main" tabindex="-1" class="container page-layout post-page">${pageIntro('Post not found','This post may have been removed from the draft.')}<a href="news.html">Back to News</a></main>`;
 const activity=post.category==='Activities',archive=activity?'activities':'news',label=activity?'Activities':'News';
 const path=edit.path('news',post),hasContent=Boolean(post.content?.length);
 const siblings=sortedNews(data).filter(n=>(n.category==='Activities')===activity);
 const blocks=post.content?.length?post.content:[{type:'paragraph',text:post.body||post.summary},...(post.image?[{type:'image',src:post.image,alt:post.imageAlt||post.title}]:[])];
 const adjacent=(item,side,label)=>item?`<a class="post-${side}" href="${e(postFileName(item))}"><span>${label}</span>${e(item.title)}</a>`:'<span></span>';
 const navigation=(items,filtered=false)=>{
  const index=items.findIndex(n=>n.id===post.id),older=items[index+1],newer=items[index-1];
  if(!older&&!newer)return '';
  return `<nav class="post-navigation" aria-label="More ${e((filtered?post.category:label).toLowerCase())} posts"${filtered?' data-filtered-posts hidden':''}>${adjacent(older,'previous','Older post')}${adjacent(newer,'next','Newer post')}</nav>`;
 };
 const body=blocks.map((block,index)=>postBlock(block,edit,hasContent?path+'/content/'+index:path,hasContent?'':post.body?'body':'summary',post.imageThumbnail)).join('');
 return `<main id="main" tabindex="-1" class="container page-layout post-page" data-post-category="${e(post.category)}"><a class="post-back" href="${archive}.html">← ${label}</a><article class="post"${edit.item(path,'게시물')}><header class="post-header"><p class="post-category"${edit(path+'/category','text','게시물 분류',{options:['Awards','Conferences','Activities']})}>${e(post.category)}</p><h1${language(post.title)}${edit(path+'/title','text','게시물 제목')}>${e(post.title)}</h1><time datetime="${e(post.date)}"${edit(path+'/date','date','게시 날짜')}>${e(date(post.date))}</time></header><div class="post-body"${edit.collection(path+'/content','게시물 내용')}>${body}</div></article>${navigation(siblings)}${activity?'':navigation(siblings.filter(n=>n.category===post.category),true)}<a class="post-back post-back-bottom" href="${archive}.html">All ${label.toLowerCase()}</a></main>`;
}


function homeHeroFigure(image, alt, attributes='') {
 return image?`<figure class="home-hero-figure"><svg class="home-image-filter" width="0" height="0" aria-hidden="true" focusable="false"><defs><filter id="home-lattice-tint" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feColorMatrix type="matrix" values="0.9098039215686274 0 0 0 0 0.7568627450980392 0 0 0 0.15294117647058825 0.3803921568627451 0 0 0 0.5294117647058824 0 0 0 1 0"/></filter></defs></svg><img src="${e(image)}" alt="${e(alt||'')}" width="513" height="529" fetchpriority="high"${attributes}></figure>`:'';
}

function home(data,page,edit) {
 const chosen=sortedPublications(data).filter(p=>p.featured),selected=(chosen.length?chosen:sortedPublications(data)).slice(0,3);
 const hero=data.hero||{},heroImage=safeURL(hero.image);
 const intro=`<section class="home-hero${heroImage?'':' home-hero-text-only'}" aria-labelledby="home-lab-name"${edit.item('/hero','홈 소개')}><h1 id="home-lab-name" class="home-hero-title"${edit(hero.title?'/hero/title':'/site/title','multiline','홈 연구실 이름')}>${e(hero.title||data.site.title)}</h1>${homeHeroFigure(heroImage,hero.imageAlt,edit('/hero/image','image','홈 연구 그림',{altPath:'/hero/imageAlt'}))}</section>`;
 const notice=data.announcement||{enabled:true,title:data.join.title,body:data.site.email,url:'join.html'};
 const href=/^https:\/\//i.test(notice.url||'')?safeURL(notice.url):/^[a-z-]+\.html(?:#[\w-]+)?$/.test(notice.url||'')?notice.url:'';
 const announcementBody=!notice.body?'':notice.body.trim()===data.site.email
  ?`<div class="announcement-body">(<span${edit('/announcement/body','multiline','홈 공지 내용')}>${mail(data.site.email)}</span>)</div>`
  :`<div class="announcement-body"${edit('/announcement/body','multiline','홈 공지 내용')}>${paragraphs(notice.body)}</div>`;
 const announcement=notice.enabled?`<section class="announcement" aria-label="Announcement"${edit.item('/announcement','홈 공지')}><h2${language(notice.title)}${edit('/announcement/title','text','홈 공지 제목',{urlPath:'/announcement/url'})}>${href?`<a href="${e(href)}">${e(notice.title)}</a>`:e(notice.title)}</h2>${announcementBody}</section>`:'';
 return `<main id="main" tabindex="-1" class="container page-layout home">${intro}${announcement}
   <section class="home-news home-section">${sectionTitle('News','news.html','More news')}<div class="news-list"${edit.collection('/news','소식')}>${sortedNews(data).filter(n=>n.category!=='Activities').slice(0,3).map(n=>newsEntry(n,edit)).join('')}</div></section>
   <section class="home-publications home-section">${sectionTitle('Publications','publications.html','More papers')}<div class="publication-list"${edit.collection('/publications','논문')}>${selected.map((p,i)=>pubEntry(p,i,true,edit)).join('')}</div></section>
 </main>`;
}
function notFoundPage(data) {
 const hero=data.hero||{};
 const image=safeURL(hero.image).replace(/^(?:\.\/)?assets\//,'/assets/');
 return `<main id="main" tabindex="-1" class="container page-layout not-found">
   <section class="home-hero${image?'':' home-hero-text-only'}" aria-labelledby="not-found-title">
     <div>
       <p class="not-found-code">404</p>
       <h1 id="not-found-title" class="home-hero-title">Page not found</h1>
       <p class="not-found-description">The page may have moved or the address may be incorrect.</p>
       <a class="not-found-home" href="/"><span aria-hidden="true">←</span> Back to Home</a>
     </div>
     ${homeHeroFigure(image,hero.imageAlt)}
   </section>
 </main>`;
}
const pageIntro = (title, description) => `<header class="page-intro"><h1>${title}</h1>${description?`<p>${e(description)}</p>`:''}</header>`;


function researchPage(data,page,edit) {
 const lookup=new Map(data.publications.map(p=>[p.id,p]));
 const areaIcon=r=>safeURL(r.icon)?`<img class="area-icon" src="${e(safeURL(r.icon))}" alt="" aria-hidden="true" width="80" height="80"${edit(edit.path('research',r)+'/icon','image','연구 분야 아이콘')}>`:'';
 const shortAreaTitles={'Quantum Information':'Quantum info','Solid-State Physics':'Solid-state','Semiconductor Devices':'Devices'};
 const areaLinks=data.research.map((area,index)=>{
  const shortTitle=Object.hasOwn(shortAreaTitles,area.title)?shortAreaTitles[area.title]:area.title;
  const number=String(index+1).padStart(2,'0');
  return `<a href="#${e(area.id)}" data-area="${e(area.id)}" aria-label="${e(area.title)}"><span class="research-flag-number" aria-hidden="true">${number}</span><span class="research-jump-full">${e(area.title)}</span><span class="research-jump-short">${e(shortTitle)}</span></a>`;
 }).join('');
 const originalFigure=(image,path,legacy=false)=>{
  const src=safeURL(image.src);if(!src)return '';
  const fullSrc=safeURL(image.fullSrc)||src;
  const display=thumbnailImage(image.imageThumbnail,src,'(max-width: 600px) calc(100vw - 40px), (max-width: 900px) min(760px, calc(100vw - 80px)), min(560px, 48vw)');
  const width=display?.width||image.width,height=display?.height||image.height;
  const size=Number(width)>0&&Number(height)>0?` width="${Number(width)}" height="${Number(height)}"`:'';
  const imagePath=legacy?path+'/image':path+'/src',descriptor=legacy?{altPath:path+'/imageAlt'}:{altPath:path+'/alt',widthPath:path+'/width',heightPath:path+'/height',fullSrcPath:path+'/fullSrc',sourcePath:path+'/sourceURL',thumbnailPath:path+'/imageThumbnail'};
  const imageURL=fullSrc.startsWith('assets/')||/\.(?:webp|png|jpe?g|gif|svg)(?:[?#]|$)/i.test(fullSrc)?fullSrc:src;
  const source=fullSrc!==imageURL?fullSrc:safeURL(image.sourceURL);
  const figure=`<img src="${e(display?.src||src)}"${display?.responsive||''} alt="${e(image.alt||'')}"${size} loading="lazy" decoding="async"${edit(imagePath,'image','상세 연구 그림',descriptor)}>`;
  return `<figure class="research-original-figure"${legacy?'':edit.item(path,'상세 연구 그림')}>${zoomLink({image:imageURL,original:fullSrc,title:image.alt||'Research diagram',label:image.caption,source,width:imageURL===src?image.width:undefined,height:imageURL===src?image.height:undefined},figure)}${image.caption?`<figcaption${language(image.caption)}${edit(path+'/caption','text','연구 그림 설명')}>${e(image.caption)}</figcaption>`:''}</figure>`;
 };
 const papersFor=ids=>[...new Set(ids||[])].map(id=>lookup.get(id)).filter(Boolean).sort((a,b)=>Number(b.year)-Number(a.year));
 const topic=(t,groupIndex,topicIndex)=>{
   const category=data.research[groupIndex],categoryPath=edit.path('research',category),path=categoryPath+'/topics/'+category.topics.findIndex(value=>value.id===t.id);
   const papers=papersFor(t.paperIds);
   const shortTitles=new Map((t.outcomes||[]).filter(o=>o.paperIds?.length===1).map(o=>[o.paperIds[0],o.title]));
   const summary=t.summary||t.description,description=t.description&&t.description!==summary?t.description:'';
   const schematic=safeURL(t.schematic)||safeURL(t.image);
   const display=schematic&&thumbnailImage(t.schematicThumbnail,schematic,'(max-width: 600px) calc(100vw - 48px), (max-width: 1100px) 520px, 420px');
   const width=display?.width||t.schematicWidth,height=display?.height||t.schematicHeight;
   const schematicSize=Number(width)>0&&Number(height)>0?` width="${Number(width)}" height="${Number(height)}"`:'';
   const credit=t.schematicCredit,creditHTML=credit?.source===schematic&&credit?.text?`<figcaption class="topic-figure-credit">Image: ${external(credit.url,e(credit.text))}${credit.license?` · ${external(credit.licenseURL,e(credit.license))}`:''}${credit.note?` · ${e(credit.note)}`:''}</figcaption>`:'';
   const schematicHTML=schematic?`<img src="${e(display?.src||schematic)}"${display?.responsive||''} alt="${e(t.schematicAlt||t.imageAlt||t.title)}"${schematicSize} loading="lazy" decoding="async"${edit(path+(safeURL(t.schematic)?'/schematic':'/image'),'image','연구 주제 도식',{altPath:path+(safeURL(t.schematic)?'/schematicAlt':'/imageAlt'),...(safeURL(t.schematic)?{widthPath:path+'/schematicWidth',heightPath:path+'/schematicHeight',thumbnailPath:path+'/schematicThumbnail'}:{})})}>`:'';
   const detailImages=Array.isArray(t.detailImages)?t.detailImages:(t.image?[{src:t.image,alt:t.imageAlt||t.title}]:[]);
   const sections=Array.isArray(t.detailSections)?t.detailSections.filter(section=>section&&(section.title?.trim()||section.body?.trim()||section.images?.length)):null;
   const detailContent=sections?sections.map((section,index)=>{
    const sectionPath=path+'/detailSections/'+t.detailSections.indexOf(section);
    const images=Array.isArray(section.images)?section.images:[],wide=images.some(image=>Number(image.width)/Number(image.height)>2.4),heading=section.title?.trim()||'';
    const imageLeft=images.length>0&&!wide&&section.imageLeft===true;
    const titleID=`${t.id}-detail-${index+1}`;
    return `<section class="research-detail-section${images.length?' has-detail-figures':''}${wide?' wide-detail-figure':''}${imageLeft?' detail-figure-left':''}"${heading?` aria-labelledby="${e(titleID)}"`:''}${edit.item(sectionPath,'연구 상세 설명')}><div class="research-detail-copy">${heading?`<h4 id="${e(titleID)}"${language(heading)}${edit(sectionPath+'/title','text','상세 설명 제목')}>${e(heading)}</h4>`:''}${edit.paragraphs(section.body,sectionPath+'/body','연구 상세 내용')}</div>${images.length?`<div class="research-detail-media"${edit.collection(sectionPath+'/images','상세 연구 그림')}>${images.map((image,imageIndex)=>originalFigure(image,sectionPath+'/images/'+imageIndex)).join('')}</div>`:''}</section>`;
   }).join(''):edit.paragraphs(description,path+'/description','연구 상세 내용')+detailImages.map((image,index)=>originalFigure(image,Array.isArray(t.detailImages)?path+'/detailImages/'+index:path,!Array.isArray(t.detailImages))).join('');
   return `<article class="research-topic" id="${e(t.id)}"${edit.item(path,'하위 연구 주제')}><header class="topic-heading"><span class="topic-number" aria-hidden="true">${groupIndex+1}.${topicIndex+1}</span><h3${edit(path+'/title','text','하위 연구 주제명')}>${e(t.title)}</h3></header>
     <div class="topic-layout${schematic?'':' topic-text-only'}"><div class="topic-body">${summary?`<p class="topic-summary"${edit(path+(t.summary?'/summary':'/description'),'multiline','연구 주제 소개')}>${e(summary)}</p>`:''}${t.focus?.length?`<ul class="topic-focus" aria-label="Research focus"${edit(path+'/focus','list','연구 초점')}>${t.focus.map(f=>`<li>${e(f)}</li>`).join('')}</ul>`:''}</div>
     ${schematic?`<figure class="topic-schematic">${zoomLink({image:schematic,title:t.title,source:safeURL(credit?.url),width:t.schematicWidth,height:t.schematicHeight},schematicHTML)}${creditHTML}</figure>`:''}</div>
     ${detailContent?`<details class="topic-more"><summary aria-label="Research details — ${e(t.title)}"><span class="topic-more-label">Research details</span><span class="topic-more-icon" aria-hidden="true"></span></summary><div class="topic-more-content"${edit.collection(path+'/detailSections','연구 상세 설명')}>${detailContent}</div></details>`:''}
     ${papers.length?`<div class="topic-evidence"><p class="result-label"${edit(path+'/paperIds','relation','관련 논문 연결',{collection:'/publications'})}>Related papers</p><ul class="result-list">${papers.map(paper=>{const paperPath=edit.path('publications',paper),outcomeIndex=(t.outcomes||[]).findLastIndex(outcome=>outcome.paperIds?.length===1&&outcome.paperIds[0]===paper.id),titlePath=outcomeIndex>=0?path+'/outcomes/'+outcomeIndex+'/title':paperPath+'/title';return `<li data-paper-id="${e(paper.id)}">${external(paper.url||(paper.doi?'https://doi.org/'+paper.doi:''),publicationTitle(paper,shortTitles.get(paper.id)||paper.title),'',edit(titlePath,outcomeIndex>=0?'text':'publication-title',outcomeIndex>=0?'관련 논문 표시 제목':'논문 제목',{urlPath:paperPath+'/url',segmentsPath:paperPath+'/titleSegments'}))}<span class="result-citation"${edit(paperPath+(paper.journal?'/journal':'/year'),paper.journal?'text':'number','논문 서지 정보')}>${publicationCitation(paper.journal||paper.year)}</span></li>`;}).join('')}</ul></div>`:''}
   </article>`;
 };
 return `<main id="main" tabindex="-1" class="container page-layout research-page">${pageIntro('Research')}
   <div class="research-layout">
   ${areaLinks?`<nav class="research-jump" aria-label="Research areas">${areaLinks}</nav>`:''}
   <div class="research-groups"${edit.collection('/research','연구 분야')}>${data.research.map((r,i)=>{const path=edit.path('research',r);return `<section class="research-group" data-area="${e(r.id)}" id="${e(r.id)}" aria-labelledby="${e(r.id)}-title"${edit.item(path,'연구 분야')}><header class="theme-heading">${areaIcon(r)}<div class="theme-title"><span class="theme-number" aria-hidden="true">0${i+1}</span><h2 id="${e(r.id)}-title"${edit(path+'/title','text','연구 분야명')}>${e(r.title)}</h2></div><p${edit(path+'/summary','multiline','연구 분야 소개')}>${e(r.summary)}</p></header><div class="theme-content"><div class="research-topics"${edit.collection(path+'/topics','하위 연구 주제')}>${(r.topics||[]).map((t,j)=>topic(t,i,j)).join('')}</div></div></section>`;}).join('')}</div>
   </div>
   <details class="original-research-map"><summary>Research map</summary>${zoomLink({image:'assets/research/original-overview.webp',title:'Research map',width:1500,height:844},'<img src="assets/research/original-overview.webp" alt="Two-dimensional materials supporting quantum information, solid-state physics and semiconductor devices" loading="lazy" width="1500" height="844">')}<div class="theme-map-diagrams">${data.research.filter(r=>safeURL(r.image)).map(r=>{const path=edit.path('research',r),image=safeURL(r.image);return `<figure>${zoomLink({image,title:r.title},`<img src="${e(image)}" alt="${e(r.imageAlt||r.title)}" width="420" height="300" loading="lazy"${edit(path+'/image','image','분야 개념도',{altPath:path+'/imageAlt'})}>`)}<figcaption${edit(path+'/title','text','연구 분야명')}>${e(r.title)}</figcaption></figure>`;}).join('')}</div></details>
 </main>`;
}

const isPI=p=>/principal investigator|^pi$|교수/i.test(p.role||'');
function memberNavigation(current) {
 return `<nav class="member-navigation" aria-label="Member pages"><a href="people.html" ${current==='people'?'aria-current="page"':''}>Professor</a><a href="students.html" ${current==='students'?'aria-current="page"':''}>Students</a></nav>`;
}
const biographyContent=value=>String(value||'').split(/\n+/).filter(Boolean).map(line=>{
 if(/^(Experience|Professional Experiences|Education)$/i.test(line.trim()))return `<h3>${e(line.trim())}</h3>`;
 const dated=line.match(/^(\d{4}\.\d{2} - (?:present|\d{4}\.\d{2}):)(.*)$/);
 return dated?`<p><strong class="biography-date">${e(dated[1])}</strong>${e(dated[2])}</p>`:`<p>${e(line)}</p>`;
}).join('');
function personCard(p,professor=false,edit) {
 const path=edit.path('people',p);
 const display=p.imageDisplay,validDisplay=display?.source===p.image&&/^assets\/people\/display\/[a-z0-9-]+$/.test(display.base||'');
 const widths=validDisplay&&Array.isArray(display.widths)?[...new Set(display.widths.filter(w=>Number.isInteger(w)&&w>=32&&w<=1024))].sort((a,b)=>a-b):[];
 const defaultWidth=widths.find(w=>w>=(professor?200:150))||widths.at(-1);
 const image=defaultWidth?`${display.base}-${defaultWidth}.webp`:safeURL(p.image,'assets/portrait.svg');
 const responsive=widths.length?` srcset="${e(widths.map(w=>`${display.base}-${w}.webp ${w}w`).join(', '))}" sizes="${professor?'(max-width: 360px) 96px, (max-width: 600px) 120px, 160px':'(max-width: 600px) 112px, (max-width: 760px) 128px, 120px'}"`:'';
 const biography=professor&&p.description?`<div class="biography"${edit(path+'/description','multiline','경력 · 학력')}>${biographyContent(p.description)}</div>`:'';
 return `<article class="person-card ${professor?'professor-card':'student-card'}"${edit.item(path,professor?'교수':'학생')}><img src="${e(image)}"${responsive} alt="${e(p.name)}" loading="lazy" decoding="async" width="${professor?160:120}" height="${professor?200:150}"${edit(path+'/image','image','구성원 사진')}><div class="person-info"><h2${edit(path+'/name','text','이름')}>${e(p.name)}</h2>${professor?`<p${edit(path+'/email','email','이메일')}>${mail(p.email)}</p>`:`<p class="person-role"${edit(path+'/role','text','직위 · 과정')}>${e(p.role)}</p>${p.description?edit.paragraphs(p.description,path+'/description','구성원 소개'):''}${mail(p.email,undefined,edit(path+'/email','email','이메일'))}`}${p.url?external(p.url,'Personal website','person-profile',edit(path+'/url','url','개인 홈페이지 주소')):''}</div>${biography}</article>`;
}
function peoplePage(data,page,edit) {
 return `<main id="main" tabindex="-1" class="container page-layout interior">${pageIntro('Professor','')}${memberNavigation('people')}<section class="professors"${edit.collection('/people','교수')}>${data.people.filter(isPI).map(p=>personCard(p,true,edit)).join('')}</section></main>`;
}
function studentsPage(data,page,edit) {
 const members=data.people.filter(p=>!isPI(p));
 return `<main id="main" tabindex="-1" class="container page-layout interior">${pageIntro('Students','')}${memberNavigation('students')}<section class="students-list"${edit.collection('/people','학생')}>${members.map(p=>personCard(p,false,edit)).join('')}</section></main>`;
}
function publicationsPage(data,page,edit) {
 const underReview=data.underReview?.length?`<section class="under-review" aria-labelledby="under-review-heading"${edit.collection('/underReview','심사 중 논문')}><h2 id="under-review-heading">Under review</h2>${data.underReview.map(p=>{const path=edit.path('underReview',p);return `<article class="under-review-entry" data-manuscript-id="${e(p.id)}"${edit.item(path,'심사 중 논문')}><div class="pub-content"><h3${edit(path+'/title','publication-title','원고 제목',{segmentsPath:path+'/titleSegments',urlPath:path+'/url'})}>${safeURL(p.url)?external(p.url,publicationTitle(p)):publicationTitle(p)}</h3><p class="authors"${edit(path+'/authors','multiline','원고 저자',{labAuthorsPath:path+'/labAuthors'})}>${publicationAuthors(p)}</p></div></article>`;}).join('')}</section>`:'';
 const pubs=sortedPublications(data), periods=data.publicationYearGroups||[], years=[...new Set(pubs.map(p=>publicationYearGroup(p.year,periods)))];
 const groups=new Map(years.map(year=>[year,[]]));
 pubs.forEach(paper=>groups.get(publicationYearGroup(paper.year,periods)).push(paper));
 const groupedPubs=[...groups].map(([year,papers])=>`<section class="publication-year-group" data-publication-year="${e(year)}" aria-labelledby="publication-year-${e(year)}"><h2 class="publication-year-title" id="publication-year-${e(year)}">${e(publicationYearLabel(year))}</h2>${papers.map((paper,index)=>pubEntry(paper,papers.length-index,false,edit)).join('')}</section>`).join('');
 return `<main id="main" tabindex="-1" class="container page-layout interior">${pageIntro('Publications','')}${underReview}<section class="archive">
  <div class="publication-filter-controls">
   <details class="publication-filters">
    <summary><span>Search published papers</span><span class="filter-toggle-icon" aria-hidden="true"></span><span id="publication-filter-state" class="filter-state" hidden><span id="publication-filter-query"></span><span id="publication-filter-count"></span></span></summary>
    <div class="archive-tools"><label class="search-field"><span>Search</span><input id="publication-search" type="search" spellcheck="false" autocapitalize="none" aria-controls="publication-results" placeholder="Title, author, journal, DOI or link" autocomplete="off"></label><label class="year-field"><span>Year</span><select id="publication-year" aria-controls="publication-results"><option value="all">All years</option>${years.map(y=>`<option value="${e(y)}">${e(publicationYearLabel(y))}</option>`).join('')}</select></label><button id="publication-filter-reset" class="text-action" type="button" data-clear-publication-filters hidden>Clear filters</button><span id="result-count" role="status">${pubs.length} publications</span></div>
   </details>
   <button id="publication-filter-clear" class="text-action" type="button" data-clear-publication-filters aria-label="Clear publication filters" hidden>Clear</button>
  </div>
  <div class="publication-list" id="publication-results"${edit.collection('/publications','논문')}>${groupedPubs}</div>
  <p id="no-results" hidden>No published papers match your search. <button class="text-action" type="button" data-clear-publication-filters>Clear filters</button></p>
 </section></main>`;
}

function highlightNavigation(current) {
 return `<nav class="member-navigation" aria-label="Highlights pages"><a href="news.html" ${current==='news'?'aria-current="page"':''}>News</a><a href="activities.html" ${current==='activities'?'aria-current="page"':''}>Activities</a></nav>`;
}
function newsPage(data,page,edit) {
 const items=sortedNews(data).filter(n=>n.category!=='Activities'),categories=[['all','All'],['Awards','Awards'],['Conferences','Conferences']];
 return `<main id="main" tabindex="-1" class="container page-layout interior">${pageIntro('News','')}${highlightNavigation('news')}<section class="archive"><nav class="news-categories" aria-label="News categories">${categories.map(([value,label])=>`<a href="news.html${value==='all'?'':'?category='+value}" data-category="${value}"${value==='all'?' aria-current="true"':''}>${label}</a>`).join('')}</nav><p class="sr-only" id="news-count" role="status"></p><div class="news-list news-archive" id="news-results"${edit.collection('/news','소식')}>${items.map(item=>highlightEntry(item,edit)).join('')}</div></section></main>`;
}
function activitiesPage(data,page,edit) {
 const items=sortedNews(data).filter(n=>n.category==='Activities');
 return `<main id="main" tabindex="-1" class="container page-layout interior">${pageIntro('Activities','')}${highlightNavigation('activities')}<section class="news-list activities-list"${edit.collection('/news','활동')}>${items.map(item=>highlightEntry(item,edit)).join('')}</section></main>`;
}
function joinPage(data,page,edit) {
 const ricciHallMap='https://www.google.com/maps/embed?pb=!1m5!3m3!1m2!1s0x357c98bcfd85c72d%3A0xd41e7652fbe4e84a!2z7ISc6rCV64yA7ZWZ6rWQIOumrOy5mOqzvO2Vmeq0gA!5e0!3m2!1sko!2skr!4v1793846536710!5m2!1sko!2skr';
 const ricciHallDirections='https://www.google.com/maps/dir/?api=1&destination=Ricci%20Hall%2C%20Sogang%20University&destination_place_id=ChIJLceF_byYfDURSujk-1J2HtQ';
 return `<main id="main" tabindex="-1" class="container page-layout interior">${pageIntro('Join Us','')}
   <section class="join-copy"${edit.item('/join','모집 안내')}><h2 lang="ko"${edit('/join/title','text','모집 제목')}>${e(data.join.title)}</h2><p lang="ko"${edit('/join/description','multiline','모집 안내 내용')}>${e(data.join.description)}</p><p${edit('/site/email','email','대표 이메일')}>${mail(data.site.email)}</p></section>
   <section class="contact-details" aria-labelledby="contact-heading">
    <h2 id="contact-heading" tabindex="-1">Contact</h2>
    <div class="contact-layout">
     <div><p>Hyeonjun Baek</p><p${edit('/site/affiliation','text','소속')}>${e(data.site.affiliation)}</p><p${edit('/site/address','text','연구실 주소')}>${e(data.site.address)}</p>${data.join.office?`<p${edit('/join/office','text','교수실')}>Office: ${e(data.join.office)}</p>`:''}${data.join.laboratory?`<p${edit('/join/laboratory','text','실험실')}>Laboratory: ${e(data.join.laboratory)}</p>`:''}</div>
     <figure class="contact-map">
      <figcaption>Ricci Hall (R Building) <span lang="ko">리치과학관</span></figcaption>
      <iframe src="${e(ricciHallMap)}" title="Google Maps pin for Ricci Hall (R Building), Sogang University" width="640" height="320" referrerpolicy="strict-origin-when-cross-origin"></iframe>
      ${external(ricciHallDirections,'Directions in Google Maps <span aria-hidden="true">↗</span>','contact-map-link')}
     </figure>
    </div>
   </section>
 </main>`;
}
export function render(data, page='index', options={}) {
 const edit=editContext(data,Boolean(options.editable));
 const appearance=appearanceCSS(data);
 const content={index:home,research:researchPage,people:peoplePage,students:studentsPage,publications:publicationsPage,news:newsPage,activities:activitiesPage,join:joinPage,'404':notFoundPage};
 const showViewer=page==='publications'||page==='research'||page.startsWith('post-');
 return (appearance?`<style data-site-appearance>${appearance}</style>`:'')+header(data,page,edit)+(page.startsWith('post-')?postPage(data,page,edit):(content[page]||home)(data,page,edit))+footer(data,page,edit)+(showViewer?figureViewer:'');
}
