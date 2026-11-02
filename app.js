const params=new URLSearchParams(location.search),preview=params.get('preview')==='1';
const page=preview&&params.get('post')?'post-'+params.get('post'):(document.body.dataset.page || 'index');
const mobileNavigation=matchMedia('(max-width:900px)');
function setMenuOpen(open,restoreFocus=false){
 const toggle=document.querySelector('.menu-toggle'),menu=document.getElementById('mobile-navigation');
 if(!toggle||!menu)return;
 if(open&&mobileNavigation.matches){
  if(!menu.open)menu.showModal();
 }else if(menu.open)menu.close();
 const expanded=menu.open;
 toggle.setAttribute('aria-expanded',String(expanded));
 document.documentElement.classList.toggle('menu-open',expanded);
 if(restoreFocus&&mobileNavigation.matches)toggle.focus({preventScroll:true});
}
mobileNavigation.addEventListener('change',()=>{
 const menu=document.getElementById('mobile-navigation'),focusedLink=menu?.contains(document.activeElement)?document.activeElement.closest('a'):null;
 const wasOpen=menu?.open;
 const focusInDesktopNavigation=mobileNavigation.matches&&document.getElementById('main-nav')?.contains(document.activeElement);
 setMenuOpen(false,focusInDesktopNavigation);
 if(wasOpen&&!mobileNavigation.matches){
  const links=[...document.querySelectorAll('#main-nav .nav-item>a')];
  const focusedHref=focusedLink?.closest('.nav-item')?.querySelector('a')?.getAttribute('href');
  const destination=links.find(link=>link.getAttribute('href')===focusedHref)||links.find(link=>link.getAttribute('aria-current')==='page'||link.classList.contains('section-current'))||links[0];
  destination?.focus({preventScroll:true});
 }
});
document.addEventListener('close',event=>{
 if(event.target.id!=='mobile-navigation')return;
 const open=event.target.open;
 document.querySelector('.menu-toggle')?.setAttribute('aria-expanded',String(open));
 document.documentElement.classList.toggle('menu-open',open);
},true);

document.addEventListener('click',event=>{
 const toggle=event.target.closest('.menu-toggle');
 if(toggle){setMenuOpen(toggle.getAttribute('aria-expanded')!=='true');return;}
 const menu=document.getElementById('mobile-navigation');
 if(event.target.closest('.mobile-menu-close')){setMenuOpen(false,true);return;}
 if(menu?.open&&event.target.closest('#mobile-navigation a'))setMenuOpen(false);
 if(menu?.open&&event.target===menu){
  const bounds=menu.getBoundingClientRect();
  if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)setMenuOpen(false,true);
 }
});
document.addEventListener('keydown',event=>{
 if(event.key!=='Tab')return;
 const dialog=document.querySelector('dialog:modal');
 if(!dialog)return;
 const controls=[...dialog.querySelectorAll('a[href],button:not([disabled])')].filter(control=>control.getClientRects().length);
 const first=controls[0],last=controls.at(-1),outside=!dialog.contains(document.activeElement);
 if(event.shiftKey&&(document.activeElement===first||outside)){event.preventDefault();last?.focus();}
 else if(!event.shiftKey&&(document.activeElement===last||outside)){event.preventDefault();first?.focus();}
});
if(preview) {
 try {
  const {render,pageTitle}=await import('./renderer.js');
  let data;
  try {
   const draft=localStorage.getItem('qmp-site-draft');
   if(draft){data=JSON.parse(draft);document.getElementById('preview-notice').hidden=false;}
  }catch(error){console.warn('The local draft could not be read.',error);}
  if(!data){
   const contentURL=new URL('content/site.json',location.href);
   contentURL.searchParams.set('v',new URL(import.meta.url).searchParams.get('v')||'preview');
   const response=await fetch(contentURL);
   if(!response.ok)throw new Error('Content could not be loaded');
   data=await response.json();
  }
  setMenuOpen(false);document.getElementById('site-shell').innerHTML=render(data,page);
  document.title=pageTitle(data,page);
 }catch(error){console.error(error);}
}

const archiveReturnKey='qmp-archive-return';
function archiveURL(value){
 try{
  const url=new URL(value,location.href);
  if(url.origin!==location.origin||!/(?:^|\/)(?:news|activities)\.html$/.test(url.pathname)||url.searchParams.has('post'))return null;
  return url;
 }catch{return null;}
}
function postIDFromURL(url){
 if(url.origin!==location.origin)return '';
 const file=url.pathname.split('/').at(-1),match=file.match(/^post-([a-z0-9][a-z0-9_-]*)\.html$/i);
 if(match)return match[1];
 const id=url.searchParams.get('preview')==='1'?url.searchParams.get('post'):'';
 return id&&/^[a-z0-9][a-z0-9_-]*$/i.test(id)?id:'';
}
function connectArchiveReturn(){
 if(['news','activities'].includes(page)){
  document.querySelectorAll('.highlight-entry .highlight-link').forEach(link=>link.addEventListener('click',()=>{
   const source=archiveURL(location.href),entry=link.closest('.highlight-entry');
   const postId=postIDFromURL(new URL(link.href,location.href));
   if(!source||!postId||postId!==entry?.id)return;
   source.hash=postId;
   try{sessionStorage.setItem(archiveReturnKey,JSON.stringify({postId,url:source.href}));}catch{}
  }));
 }
 if(!page.startsWith('post-'))return;
 const postId=page.slice(5),back=document.querySelector('.post-back:not(.post-back-bottom)');
 if(!back)return;
 const validRecord=record=>record?.postId===postId&&archiveURL(record.url);
 let record=history.state?.qmpArchiveReturn;
 if(!validRecord(record)){
  record=null;
  try{
   const pending=JSON.parse(sessionStorage.getItem(archiveReturnKey)||'null');
   sessionStorage.removeItem(archiveReturnKey);
   const source=validRecord(pending),referrer=archiveURL(document.referrer);
   if(source&&referrer&&source.pathname===referrer.pathname&&source.search===referrer.search)record=pending;
  }catch{}
  if(record){
   try{history.replaceState({...((history.state&&typeof history.state==='object')?history.state:{}),qmpArchiveReturn:record},'',location.href);}catch{}
  }
 }
 const destination=validRecord(record);
 if(destination){destination.hash=postId;back.href=destination.href;}
}
function connect() {
 if(preview) for(const link of document.querySelectorAll('a[href]')) {
   const href=link.getAttribute('href');
   if(/^post-[a-z0-9_-]+\.html$/i.test(href)) {const url=new URL('news.html',location.href);url.searchParams.set('preview','1');url.searchParams.set('post',href.slice(5,-5));link.href=url.pathname+url.search;}
   else if(/^(index|research|people|students|publications|news|activities|join)\.html/.test(href)) {const url=new URL(href,location.href);url.searchParams.set('preview','1');link.href=url.pathname+url.search+url.hash;}
 }
 const search=document.getElementById('publication-search'), year=document.getElementById('publication-year');
 const publicationSearchText=value=>String(value).normalize('NFKD').replace(/\p{M}/gu,'').replace(/[‐‑‒–—−]/g,'-').toLowerCase();
 function filterPublications(){
  if(!search||!year)return;
  if(!year.value)year.value='all';
  const query=publicationSearchText(search.value.trim()), terms=query.split(/\s+/).filter(Boolean), selected=year.value;
  const articles=[...document.querySelectorAll('#publication-results .publication')];
  let count=0;
  articles.forEach(article=>{
   const text=publicationSearchText(article.dataset.search||article.textContent);
   const group=article.closest('.publication-year-group')?.dataset.publicationYear||article.dataset.year;
   const visible=terms.every(term=>text.includes(term))&&(selected==='all'||group===selected);
   article.hidden=!visible;if(visible) count++;
  });
  document.querySelectorAll('#publication-results .publication-year-group').forEach(group=>{
   group.hidden=!group.querySelector('.publication:not([hidden])');
  });
  document.getElementById('result-count').textContent=`${count} publication${count===1?'':'s'}`;
  document.getElementById('no-results').hidden=count!==0;
  const active=!!query||selected!=='all',state=document.getElementById('publication-filter-state');
  if(state){
   state.hidden=!active;
   state.textContent=active?`${count} result${count===1?'':'s'}${selected==='all'?'':' · '+year.selectedOptions[0].textContent}`:'';
  }
  const reset=document.getElementById('publication-filter-reset');
  if(reset)reset.hidden=!active;
 }
 if(search&&year){
  search.addEventListener('input',filterPublications);year.addEventListener('change',filterPublications);
  document.querySelectorAll('[data-clear-publication-filters]').forEach(button=>button.addEventListener('click',()=>{
   search.value='';year.value='all';filterPublications();
   const details=search.closest('details'),target=details&&!details.open?details.querySelector('summary'):search;
   target?.focus({preventScroll:true});
  }));
  filterPublications();
  window.addEventListener('pageshow',filterPublications);
 }
 const viewer=document.getElementById('publication-viewer');
 if(viewer&&typeof viewer.showModal==='function') {
  let figureTrigger;
  document.querySelectorAll('[data-publication-figure]').forEach(link=>link.addEventListener('click',event=>{
   event.preventDefault();figureTrigger=link;
   viewer.querySelector('h2').textContent=link.dataset.figureTitle;
   viewer.querySelector('.figure-viewer-label').textContent=link.dataset.figureLabel;
   const image=viewer.querySelector('img'),thumbnail=link.querySelector('img');
   for(const dimension of ['width','height']){
    if(Number(thumbnail.getAttribute(dimension))>0)image.setAttribute(dimension,thumbnail.getAttribute(dimension));
    else image.removeAttribute(dimension);
   }
   if(Number(image.getAttribute('width'))>0&&Number(image.getAttribute('height'))>0){
    image.style.setProperty('--figure-width',image.getAttribute('width')+'px');
    image.style.setProperty('--figure-ratio',Number(image.getAttribute('width'))/Number(image.getAttribute('height')));
   }else{image.style.removeProperty('--figure-width');image.style.removeProperty('--figure-ratio');}
   image.alt=thumbnail.alt;image.src=link.getAttribute('href');
   const source=viewer.querySelector('.figure-viewer-source');source.hidden=!link.dataset.figureSource;if(link.dataset.figureSource)source.href=link.dataset.figureSource;
   viewer.showModal();viewer.querySelector('button').focus({preventScroll:true});
  }));
  viewer.querySelector('button').addEventListener('click',()=>viewer.close());
  viewer.addEventListener('click',event=>{
   if(event.target!==viewer)return;
   const bounds=viewer.getBoundingClientRect();
   if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)viewer.close();
  });
  viewer.addEventListener('close',()=>figureTrigger?.focus({preventScroll:true}));
 }
 const categoryLinks=[...document.querySelectorAll('.news-categories [data-category]')];
 if(categoryLinks.length){
  const filterNews=category=>{
   const selected=categoryLinks.find(link=>link.dataset.category===category)||categoryLinks[0];
   let count=0;
   categoryLinks.forEach(link=>{if(link===selected)link.setAttribute('aria-current','true');else link.removeAttribute('aria-current');});
   document.querySelectorAll('#news-results .news-entry').forEach(article=>{
    const visible=selected.dataset.category==='all'||article.dataset.category===selected.dataset.category;
    article.hidden=!visible;if(visible)count++;
   });
   document.getElementById('news-count').textContent=`${count} news item${count===1?'':'s'}`;
  };
  const categoryFromURL=()=>new URLSearchParams(location.search).get('category')||'all';
  filterNews(categoryFromURL());
  categoryLinks.forEach(link=>link.addEventListener('click',event=>{
   if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   event.preventDefault();
   const url=new URL(link.href);
   if(url.href!==location.href)history.pushState(null,'',url);
   filterNews(categoryFromURL());
  }));
  window.addEventListener('popstate',()=>filterNews(categoryFromURL()));
  window.addEventListener('pageshow',()=>filterNews(categoryFromURL()));
 }
 connectArchiveReturn();
}
connect();
document.body.dataset.ready='true';
