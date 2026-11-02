export const pages = ['index', 'research', 'people', 'students', 'publications', 'news', 'activities', 'join'];
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e = escapeHTML;
export function safeURL(value, fallback = '') {
  const url = String(value ?? '').trim();
  if (/^https:\/\/[^\s]+$/i.test(url)) return url;
  if (/^(?:\.\/)?assets\/[a-z0-9_./%() -]+$/i.test(url) && !url.includes('..')) return url;
  return fallback;
}
const external = (url, text, cls = '') => safeURL(url) ? `<a class="${cls}" href="${e(safeURL(url))}" target="_blank" rel="noopener noreferrer">${text}<span class="sr-only"> (opens in a new tab)</span></a>` : `<span>${text}</span>`;
const mail = (email, text) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email || '') ? `<a href="mailto:${e(email)}">${e(text || email).replace('@','@<wbr>')}</a>` : '';
const paragraphs = value => String(value || '').split(/\n+/).filter(Boolean).map(v => `<p>${e(v)}</p>`).join('');
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
 const post=findPost(data,page),labels={people:'Professor',students:'Students',activities:'Activities',join:'Join Us'};
 return (page==='index'?'':(post?.title||labels[page]||page[0].toUpperCase()+page.slice(1))+' | ')+data.site.title;
}
const sectionTitle = (title, link, label) => `<div class="section-heading"><h2>${title}</h2>${link ? `<a class="more-link" href="${link}" aria-label="${label}"><span>More</span><span aria-hidden="true">→</span></a>` : ''}</div>`;


function header(data,page) {
 const member=['people','students'].includes(page),highlights=['news','activities'].includes(page)||page.startsWith('post-');
 const link=(id,label,active=false)=>`<a href="${id}.html" ${page===id?'aria-current="page"':active?'class="section-current"':''}>${label}</a>`;
 const navigation=()=>`<div class="nav-item">${link('index','Home')}</div>
     <div class="nav-item has-submenu">${link('people','Member',member)}<div class="nav-dropdown">${link('people','Professor')}${link('students','Students')}</div></div>
     <div class="nav-item">${link('publications','Publication')}</div>
     <div class="nav-item">${link('research','Research')}</div>
     <div class="nav-item has-submenu">${link('news','Highlights',highlights)}<div class="nav-dropdown">${link('news','News')}${link('activities','Activities')}</div></div>`;
 return `<header class="site-header"><div class="container header-inner">
   <a class="brand" href="index.html" aria-label="${e(data.site.title)} — Home"><span>${e(data.site.group)}</span><small>@ Sogang Univ.</small></a>
   <button class="menu-toggle" type="button" aria-expanded="false" aria-haspopup="dialog" aria-controls="mobile-navigation"><span class="menu-label">Menu</span><span class="menu-icon" aria-hidden="true">☰</span></button>
   <nav id="main-nav" aria-label="Main navigation">${navigation()}</nav>
 </div><dialog id="mobile-navigation" class="mobile-menu" aria-labelledby="mobile-menu-title"><div class="mobile-menu-heading"><h2 id="mobile-menu-title">Menu</h2><button class="mobile-menu-close" type="button" aria-label="Close menu" autofocus><span aria-hidden="true">×</span></button></div><nav class="mobile-menu-links" aria-label="Mobile navigation">${navigation()}</nav></dialog></header>`;
}

function footer(data) {
 return `<footer class="site-footer"><div class="container footer-inner"><span class="footer-affiliation">${e(data.site.affiliation)}</span><div class="footer-contact"><span class="footer-address">${e(data.site.address)}</span><span class="footer-email">${mail(data.site.email)}</span><span class="copyright">© ${new Date().getUTCFullYear()}</span></div></div></footer>`;
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
function pubEntry(p,number,compact=false) {
 const image=!compact&&safeURL(p.image),label=p.imageLabel||'Research figure';
 const crop=p.imagePreview,hasCrop=crop&&[crop.x,crop.y,crop.width,crop.height].every(Number.isFinite)&&crop.x>=0&&crop.y>=0&&crop.width>0&&crop.height>0&&crop.x+crop.width<=1&&crop.y+crop.height<=1&&p.imageWidth>0&&p.imageHeight>0;
 const imageHTML=`<img src="${e(image)}" alt="${e(p.imageAlt||label+' from '+p.title)}" loading="lazy"${p.imageWidth&&p.imageHeight?` width="${Number(p.imageWidth)}" height="${Number(p.imageHeight)}"`:''}${hasCrop?` style="position:absolute;max-width:none;max-height:none;width:${100/crop.width}%;height:auto;left:${-100*crop.x/crop.width}%;top:${-100*crop.y/crop.height}%"`:''}>`;
 const thumbnail=hasCrop?`<span class="pub-figure-panel" style="--preview-ratio:${p.imageWidth*crop.width/(p.imageHeight*crop.height)};aspect-ratio:var(--preview-ratio)">${imageHTML}</span>`:imageHTML;
 const figure=image?`<figure class="pub-figure"><a class="pub-figure-link" href="${e(image)}" data-publication-figure data-figure-title="${e(p.title)}" data-figure-label="${e(label)}" data-figure-source="${e(safeURL(p.imageSource))}" aria-label="View full-size figure — ${e(p.title)}">${thumbnail}</a></figure>`:'';
 return `<article class="publication${compact?' publication-short':' publication-illustrated'+(image?' has-figure':'')}" data-year="${e(p.year)}">
   ${compact?'':`<span class="pub-index">${number}.</span>`}
   ${figure}
   <div class="pub-content"><h3>${external(p.url||(p.doi?'https://doi.org/'+p.doi:''),e(p.title))}</h3>
   <p class="authors">${publicationAuthors(p)}</p>
   <p class="pub-journal">${e(p.journal)}</p></div>
 </article>`;
}
function newsEntry(n) {
 return `<article class="news-entry compact" id="${e(n.id)}"><time datetime="${e(n.date)}">${e(date(n.date))}</time><div class="news-content"><h3><a href="${e(postFileName(n))}">${e(n.title)}</a></h3></div></article>`;
}
function highlightExcerpt(n) {
 const text=(n.content||[]).filter(block=>['paragraph','quote'].includes(block.type)).map(block=>Array.isArray(block.children)?block.children.map(run=>String(run.text||'')).join(''):String(block.text||'')).map(value=>value.trim()).filter(Boolean);
 return (n.excerpt?.trim()?n.excerpt.split(/\n+/):text.length?text:String(n.summary||n.body||'').split(/\n+/)).map(value=>value.trim()).filter(Boolean).slice(0,2);
}
function highlightEntry(n) {
 const firstPhoto=(n.content||[]).find(block=>block.type==='image'),image=safeURL(n.image)||safeURL(firstPhoto?.src);
 const size=image===safeURL(firstPhoto?.src)&&firstPhoto?.width&&firstPhoto?.height?` width="${Number(firstPhoto.width)}" height="${Number(firstPhoto.height)}"`:'';
 const excerpt=highlightExcerpt(n);
 return `<article class="news-entry highlight-entry${image?' has-image':''}" id="${e(n.id)}"><a class="highlight-link" href="${e(postFileName(n))}" aria-labelledby="${e(n.id)}-title" aria-describedby="${e(n.id)}-date">${image?`<figure class="highlight-image"><img src="${e(image)}" alt="${e(n.imageAlt||firstPhoto?.alt||n.title)}" loading="lazy"${size}></figure>`:''}<div class="highlight-copy"><h2 id="${e(n.id)}-title">${e(n.title)}</h2><time id="${e(n.id)}-date" datetime="${e(n.date)}">${e(date(n.date))}</time>${excerpt.length?`<div class="highlight-excerpt">${excerpt.map(text=>`<p>${e(text)}</p>`).join('')}</div>`:''}</div></a></article>`;
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
function postBlock(block) {
 if(block.type==='image'){
  const src=safeURL(block.src);if(!src)return '';const fullSrc=safeURL(block.fullSrc)||src;
  const size=Number(block.width)>0&&Number(block.height)>0?` width="${Number(block.width)}" height="${Number(block.height)}"`:'';
  return `<figure class="post-photo"><a href="${e(fullSrc)}" target="_blank" rel="noopener noreferrer" aria-label="${e(block.alt||'Photo')} — View full-size photo"><img src="${e(src)}" alt="${e(block.alt||'')}"${size} loading="lazy"></a>${block.caption?`<figcaption>${e(block.caption)}</figcaption>`:''}</figure>`;
 }
 if(block.type==='heading')return `<h2>${postInline(block)}</h2>`;
 if(block.type==='quote')return `<blockquote>${postInline(block)}</blockquote>`;
 if(block.type==='list'){
  const tag=block.ordered?'ol':'ul';
  return `<${tag}>${(block.items||[]).map(item=>`<li>${typeof item==='string'?e(item):postInline(item)}</li>`).join('')}</${tag}>`;
 }
 return `<p>${postInline(block)}</p>`;
}
function postPage(data,page) {
 const post=findPost(data,page);
 if(!post)return `<main id="main" class="container page-layout post-page">${pageIntro('Post not found','This post may have been removed from the draft.')}<a href="news.html">Back to News</a></main>`;
 const activity=post.category==='Activities',archive=activity?'activities':'news',label=activity?'Activities':'News';
 const siblings=sortedNews(data).filter(n=>(n.category==='Activities')===activity),index=siblings.findIndex(n=>n.id===post.id);
 const older=siblings[index+1],newer=siblings[index-1];
 const blocks=post.content?.length?post.content:[{type:'paragraph',text:post.body||post.summary},...(post.image?[{type:'image',src:post.image,alt:post.imageAlt||post.title}]:[])];
 const adjacent=(item,direction)=>item?`<a class="post-${direction.toLowerCase()}" href="${e(postFileName(item))}"><span>${direction}</span>${e(item.title)}</a>`:`<span></span>`;
 return `<main id="main" class="container page-layout post-page"><a class="post-back" href="${archive}.html">← ${label}</a><article class="post"><header class="post-header"><p class="post-category">${e(post.category)}</p><h1>${e(post.title)}</h1><time datetime="${e(post.date)}">${e(date(post.date))}</time></header><div class="post-body">${blocks.map(postBlock).join('')}</div></article><nav class="post-navigation" aria-label="More ${label.toLowerCase()} posts">${adjacent(older,'Previous')}${adjacent(newer,'Next')}</nav><a class="post-back post-back-bottom" href="${archive}.html">All ${label.toLowerCase()}</a></main>`;
}


function home(data) {
 const chosen=sortedPublications(data).filter(p=>p.featured),selected=(chosen.length?chosen:sortedPublications(data)).slice(0,3);
 const hero=data.hero||{},heroImage=safeURL(hero.image);
 const intro=`<section class="home-hero${heroImage?'':' home-hero-text-only'}" aria-labelledby="home-lab-name"><h1 id="home-lab-name" class="home-hero-title">${e(hero.title||data.site.title)}</h1>${heroImage?`<figure class="home-hero-figure"><svg class="home-image-filter" width="0" height="0" aria-hidden="true" focusable="false"><defs><filter id="home-lattice-tint" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feColorMatrix type="matrix" values="0.9098039215686274 0 0 0 0 0.7568627450980392 0 0 0 0.15294117647058825 0.3803921568627451 0 0 0 0.5294117647058824 0 0 0 1 0"/></filter></defs></svg><img src="${e(heroImage)}" alt="${e(hero.imageAlt||'')}" width="513" height="529" fetchpriority="high"></figure>`:''}</section>`;
 const notice=data.announcement||{enabled:true,title:data.join.title,body:data.site.email,url:'join.html'};
 const href=/^https:\/\//i.test(notice.url||'')?safeURL(notice.url):/^[a-z-]+\.html(?:#[\w-]+)?$/.test(notice.url||'')?notice.url:'';
 const announcement=notice.enabled?`<section class="announcement" aria-label="Announcement"><h2>${href?`<a href="${e(href)}">${e(notice.title)}</a>`:e(notice.title)}</h2>${notice.body?`<div class="announcement-body">${notice.body.trim()===data.site.email?mail(data.site.email):paragraphs(notice.body)}</div>`:''}</section>`:'';
 return `<main id="main" class="container page-layout home">${intro}${announcement}
   <section class="home-news home-section">${sectionTitle('News','news.html','More news')}<div class="news-list">${sortedNews(data).filter(n=>n.category!=='Activities').slice(0,3).map(newsEntry).join('')}</div></section>
   <section class="home-publications home-section">${sectionTitle('Publications','publications.html','More publications')}<div class="publication-list">${selected.map((p,i)=>pubEntry(p,i,true)).join('')}</div></section>
 </main>`;
}
const pageIntro = (title, description) => `<header class="page-intro"><h1>${title}</h1>${description?`<p>${e(description)}</p>`:''}</header>`;


function researchPage(data) {
 const lookup=new Map(data.publications.map(p=>[p.id,p]));
 const areaIcon=r=>safeURL(r.icon)?`<img class="area-icon" src="${e(safeURL(r.icon))}" alt="" aria-hidden="true" width="80" height="80">`:'';
 const originalFigure=image=>{
  const src=safeURL(image.src);if(!src)return '';
  const fullSrc=safeURL(image.fullSrc)||src;
  const size=Number(image.width)>0&&Number(image.height)>0?` width="${Number(image.width)}" height="${Number(image.height)}"`:'';
  return `<figure class="research-original-figure"><a href="${e(fullSrc)}" target="_blank" rel="noopener noreferrer" aria-label="Open image — ${e(image.caption||image.alt||'Research diagram')}"><img src="${e(src)}" alt="${e(image.alt||'')}"${size} loading="lazy"></a>${image.caption?`<figcaption>${e(image.caption)}</figcaption>`:''}</figure>`;
 };
 const papersFor=ids=>[...new Set(ids||[])].map(id=>lookup.get(id)).filter(Boolean).sort((a,b)=>Number(b.year)-Number(a.year));
 const topic=(t,groupIndex,topicIndex)=>{
   const papers=papersFor(t.paperIds);
   const shortTitles=new Map((t.outcomes||[]).filter(o=>o.paperIds?.length===1).map(o=>[o.paperIds[0],o.title]));
   const summary=t.summary||t.description,description=t.description&&t.description!==summary?t.description:'';
   const schematic=safeURL(t.schematic)||safeURL(t.image);
   const schematicSize=Number(t.schematicWidth)>0&&Number(t.schematicHeight)>0?` width="${Number(t.schematicWidth)}" height="${Number(t.schematicHeight)}"`:'';
   const detailImages=Array.isArray(t.detailImages)?t.detailImages:(t.image?[{src:t.image,alt:t.imageAlt||t.title}]:[]);
   return `<article class="research-topic" id="${e(t.id)}"><header class="topic-heading"><span class="topic-number" aria-hidden="true">${groupIndex+1}.${topicIndex+1}</span><h3>${e(t.title)}</h3></header>
     <div class="topic-layout${schematic?'':' topic-text-only'}">${schematic?`<figure class="topic-schematic"><a href="${e(schematic)}" target="_blank" rel="noopener noreferrer" aria-label="Open schematic — ${e(t.title)}"><img src="${e(schematic)}" alt="${e(t.schematicAlt||t.imageAlt||t.title)}"${schematicSize} loading="lazy"></a></figure>`:''}
     <div class="topic-body">${t.focus?.length?`<ul class="topic-focus" aria-label="Research focus">${t.focus.map(f=>`<li>${e(f)}</li>`).join('')}</ul>`:''}${summary?`<p class="topic-summary">${e(summary)}</p>`:''}
     ${papers.length?`<div class="topic-evidence"><p class="result-label">Related papers</p><ul class="result-list">${papers.map(paper=>`<li data-paper-id="${e(paper.id)}">${external(paper.url||(paper.doi?'https://doi.org/'+paper.doi:''),e(shortTitles.get(paper.id)||paper.title))}<span class="result-citation">${e(paper.journal||paper.year)}</span></li>`).join('')}</ul></div>`:''}
     ${description||detailImages.length?`<details class="topic-more"><summary aria-label="DETAIL — ${e(t.title)}"><span class="topic-more-label">DETAIL</span><span class="topic-more-icon" aria-hidden="true"></span></summary><div class="topic-more-content">${paragraphs(description)}${detailImages.map(originalFigure).join('')}</div></details>`:''}</div></div>
   </article>`;
 };
 return `<main id="main" class="container page-layout research-page">${pageIntro('Research','')}
   <nav class="research-themes" aria-label="Research areas and topics">${data.research.map((r,i)=>`<div class="theme-index" data-area="${e(r.id)}"><a href="#${e(r.id)}">${areaIcon(r)}<span class="theme-index-title"><span class="theme-number" aria-hidden="true">0${i+1}</span><strong>${e(r.title)}</strong></span></a><ul>${(r.topics||[]).map((t,j)=>`<li><a href="#${e(t.id)}"><span class="index-topic-number">${i+1}.${j+1}</span>${e(t.title)}</a></li>`).join('')}</ul></div>`).join('')}</nav>
   <div class="research-groups">${data.research.map((r,i)=>`<section class="research-group" data-area="${e(r.id)}" id="${e(r.id)}" aria-labelledby="${e(r.id)}-title"><header class="theme-heading">${areaIcon(r)}<div class="theme-title"><span class="theme-number" aria-hidden="true">0${i+1}</span><h2 id="${e(r.id)}-title">${e(r.title)}</h2></div><p>${e(r.summary)}</p></header><div class="theme-content"><div class="research-topics">${(r.topics||[]).map((t,j)=>topic(t,i,j)).join('')}</div></div></section>`).join('')}</div>
   <details class="original-research-map"><summary>Research map</summary><a href="assets/research/original-overview.webp" target="_blank" rel="noopener noreferrer"><img src="assets/research/original-overview.webp" alt="Two-dimensional materials supporting quantum information, solid-state physics and semiconductor devices" loading="lazy" width="1500" height="844"></a><div class="theme-map-diagrams">${data.research.filter(r=>safeURL(r.image)).map(r=>`<figure><img src="${e(safeURL(r.image))}" alt="${e(r.imageAlt||r.title)}" width="420" height="300" loading="lazy"><figcaption>${e(r.title)}</figcaption></figure>`).join('')}</div></details>
 </main>`;
}

const isPI=p=>/principal investigator|^pi$|교수/i.test(p.role||'');
function memberNavigation(current) {
 return `<nav class="member-navigation" aria-label="Member pages"><a href="people.html" ${current==='people'?'aria-current="page"':''}>Professor</a><a href="students.html" ${current==='students'?'aria-current="page"':''}>Students</a></nav>`;
}
const biographyContent=value=>String(value||'').split(/\n+/).filter(Boolean).map(line=>{
 if(/^(Experience|Professional Experiences|Education)$/i.test(line.trim()))return `<h4>${e(line.trim())}</h4>`;
 const dated=line.match(/^(\d{4}\.\d{2} - (?:present|\d{4}\.\d{2}):)(.*)$/);
 return dated?`<p><strong class="biography-date">${e(dated[1])}</strong>${e(dated[2])}</p>`:`<p>${e(line)}</p>`;
}).join('');
function personCard(p,professor=false) {
 return `<article class="person-card ${professor?'professor-card':'student-card'}"><img src="${e(safeURL(p.image,'assets/portrait.svg'))}" alt="${e(p.name)}" loading="lazy" width="${professor?160:120}" height="${professor?200:150}"><div class="person-info"><h3>${e(p.name)}</h3>${professor?'':`<p class="person-role">${e(p.role)}</p>`}${professor?`<p>${mail(p.email)}</p>${p.description?`<div class="biography">${biographyContent(p.description)}</div>`:''}`:`${p.description?paragraphs(p.description):''}${mail(p.email)}`}${p.url?external(p.url,'Personal website','person-profile'):''}</div></article>`;
}
function peoplePage(data) {
 return `<main id="main" class="container page-layout interior">${pageIntro('Professor','')}${memberNavigation('people')}<section class="professors">${data.people.filter(isPI).map(p=>personCard(p,true)).join('')}</section></main>`;
}
function studentsPage(data) {
 const members=data.people.filter(p=>!isPI(p));
 return `<main id="main" class="container page-layout interior">${pageIntro('Students','')}${memberNavigation('students')}<section class="students-list">${members.map(p=>personCard(p)).join('')}</section></main>`;
}
function publicationsPage(data) {
 const underReview=data.underReview?.length?`<section class="under-review" aria-labelledby="under-review-heading"><h2 id="under-review-heading">Under review</h2>${data.underReview.map(p=>`<article class="under-review-entry" data-manuscript-id="${e(p.id)}"><div class="pub-content"><h3>${safeURL(p.url)?external(p.url,e(p.title)):e(p.title)}</h3><p class="authors">${publicationAuthors(p)}</p></div></article>`).join('')}</section>`:'';
 const pubs=sortedPublications(data), periods=data.publicationYearGroups||[], years=[...new Set(pubs.map(p=>publicationYearGroup(p.year,periods)))];
 const groups=new Map(years.map(year=>[year,[]]));
 pubs.forEach(paper=>groups.get(publicationYearGroup(paper.year,periods)).push(paper));
 const groupedPubs=[...groups].map(([year,papers])=>`<section class="publication-year-group" data-publication-year="${e(year)}" aria-labelledby="publication-year-${e(year)}"><h2 class="publication-year-title" id="publication-year-${e(year)}">${e(publicationYearLabel(year))}</h2>${papers.map((paper,index)=>pubEntry(paper,papers.length-index)).join('')}</section>`).join('');
 const viewer=`<dialog id="publication-viewer" class="publication-viewer" aria-labelledby="publication-figure-title"><div class="figure-viewer-heading"><h2 id="publication-figure-title"></h2><button class="figure-viewer-close" type="button" aria-label="Close figure">×</button></div><p class="figure-viewer-label"></p><img class="figure-viewer-image" alt=""><a class="figure-viewer-source" target="_blank" rel="noopener noreferrer">Figure source ↗</a></dialog>`;
 return `<main id="main" class="container page-layout interior">${pageIntro('Publications','')}${underReview}<section class="archive"><details class="publication-filters"><summary><span>Search &amp; filter</span><span class="filter-toggle-icon" aria-hidden="true"></span></summary><div class="archive-tools"><label class="search-field"><span>Search</span><input id="publication-search" type="search" placeholder="title, author, journal or DOI" autocomplete="off"></label><label class="year-field"><span>Year</span><select id="publication-year"><option value="all">All years</option>${years.map(y=>`<option value="${e(y)}">${e(publicationYearLabel(y))}</option>`).join('')}</select></label><span id="result-count" role="status">${pubs.length} publications</span></div></details><div class="publication-list" id="publication-results">${groupedPubs}</div><p id="no-results" hidden>No publications match your search. Try a different keyword or year.</p></section>${viewer}</main>`;
}

function highlightNavigation(current) {
 return `<nav class="member-navigation" aria-label="Highlights pages"><a href="news.html" ${current==='news'?'aria-current="page"':''}>News</a><a href="activities.html" ${current==='activities'?'aria-current="page"':''}>Activities</a></nav>`;
}
function newsPage(data) {
 const items=sortedNews(data).filter(n=>n.category!=='Activities'),categories=[['all','All'],['Awards','Awards'],['Conferences','Conferences']];
 return `<main id="main" class="container page-layout interior">${pageIntro('News','')}${highlightNavigation('news')}<section class="archive"><nav class="news-categories" aria-label="News categories">${categories.map(([value,label])=>`<a href="news.html${value==='all'?'':'?category='+value}" data-category="${value}"${value==='all'?' aria-current="true"':''}>${label}</a>`).join('')}</nav><p class="sr-only" id="news-count" role="status"></p><div class="news-list news-archive" id="news-results">${items.map(highlightEntry).join('')}</div></section></main>`;
}
function activitiesPage(data) {
 const items=sortedNews(data).filter(n=>n.category==='Activities');
 return `<main id="main" class="container page-layout interior">${pageIntro('Activities','')}${highlightNavigation('activities')}<section class="news-list activities-list">${items.map(highlightEntry).join('')}</section></main>`;
}
function joinPage(data) {
 return `<main id="main" class="container page-layout interior">${pageIntro('Join Us','')}
   <section class="join-copy"><h2 lang="ko">${e(data.join.title)}</h2><p lang="ko">${e(data.join.description)}</p><p>${mail(data.site.email)}</p></section>
   <section class="contact-details"><h2>Contact</h2><p>Hyeonjun Baek</p><p>${e(data.site.affiliation)}</p><p>${e(data.site.address)}</p></section>
 </main>`;
}
export function render(data, page='index') {
 const content={index:home,research:researchPage,people:peoplePage,students:studentsPage,publications:publicationsPage,news:newsPage,activities:activitiesPage,join:joinPage};
 return header(data,page)+(page.startsWith('post-')?postPage(data,page):(content[page]||home)(data))+footer(data);
}
