const params=new URLSearchParams(location.search),preview=document.body.dataset.page!=='404'&&params.get('preview')==='1';
const page=preview&&params.get('post')?'post-'+params.get('post'):(document.body.dataset.page || 'index');
const mobileNavigation=matchMedia('(max-width:900px)');
const openedDesktopSubmenu=()=>document.querySelector('#main-nav .nav-submenu-toggle[aria-expanded="true"]');
let hoveredDesktopSubmenu=null;
function setDesktopSubmenu(next=null,hovered=false){
 const current=openedDesktopSubmenu();
 if(current!==next){
  current?.setAttribute('aria-expanded','false');
  next?.setAttribute('aria-expanded','true');
 }
 hoveredDesktopSubmenu=hovered?next:null;
}
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
 setDesktopSubmenu();
 setMenuOpen(false,focusInDesktopNavigation);
 if(wasOpen&&!mobileNavigation.matches){
  const links=[...document.querySelectorAll('#main-nav a')];
  const focusedHref=focusedLink?.getAttribute('href');
  const destination=links.find(link=>link.getAttribute('href')===focusedHref)||links.find(link=>link.getAttribute('aria-current')==='page'||link.classList.contains('section-current'))||links[0];
  const dropdown=destination?.closest('.nav-dropdown');
  if(dropdown)setDesktopSubmenu(dropdown.previousElementSibling);
  destination?.focus({preventScroll:true});
 }
});
document.addEventListener('close',event=>{
 if(event.target.id!=='mobile-navigation')return;
 const open=event.target.open;
 document.querySelector('.menu-toggle')?.setAttribute('aria-expanded',String(open));
 document.documentElement.classList.toggle('menu-open',open);
},true);

document.addEventListener('pointerover',event=>{
 if(event.pointerType!=='mouse'||mobileNavigation.matches)return;
 const group=event.target.closest('#main-nav .has-submenu');
 if(!group||group.contains(event.relatedTarget))return;
 const toggle=group.querySelector('.nav-submenu-toggle'),current=openedDesktopSubmenu();
 if(toggle===current||current?.nextElementSibling.contains(document.activeElement))return;
 setDesktopSubmenu(toggle,true);
});
document.addEventListener('pointerout',event=>{
 if(event.pointerType!=='mouse')return;
 const group=hoveredDesktopSubmenu?.parentElement;
 if(group?.contains(event.target)&&!group.contains(event.relatedTarget)&&!group.contains(document.activeElement))setDesktopSubmenu();
});
document.addEventListener('focusout',event=>{
 const group=openedDesktopSubmenu()?.parentElement;
 if(group?.contains(event.target)&&!group.contains(event.relatedTarget))setDesktopSubmenu();
});
document.addEventListener('click',event=>{
 const submenuToggle=event.target.closest('#main-nav .nav-submenu-toggle'),current=openedDesktopSubmenu();
 if(submenuToggle){
  setDesktopSubmenu(submenuToggle===current?null:submenuToggle);
  return;
 }
 if(current&&!current.parentElement.contains(event.target))setDesktopSubmenu();
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
 if(event.key==='Escape'){
  const toggle=openedDesktopSubmenu();
  if(!toggle||document.querySelector('dialog:modal'))return;
  const restoreFocus=toggle.nextElementSibling.contains(document.activeElement);
  setDesktopSubmenu();
  if(restoreFocus)toggle.focus({preventScroll:true});
  event.preventDefault();
  return;
 }
 if(event.key!=='Tab')return;
 const dialog=document.querySelector('dialog:modal');
 if(!dialog)return;
 const controls=[...dialog.querySelectorAll('a[href],button:not([disabled]),[tabindex="0"]')].filter(control=>control.getClientRects().length);
 const first=controls[0],last=controls.at(-1),outside=!dialog.contains(document.activeElement);
 if(event.shiftKey&&(document.activeElement===first||outside)){event.preventDefault();last?.focus();}
 else if(!event.shiftKey&&(document.activeElement===last||outside)){event.preventDefault();first?.focus();}
});
document.documentElement.classList.add('nav-disclosures-ready');
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

function setPostCategory(link,category){
 const url=new URL(link.href);
 url.searchParams.set('category',category);
 link.href=url.href;
}
function connectArchiveReturn(){
 if(page==='activities')document.querySelectorAll('.highlight-link').forEach(link=>setPostCategory(link,'all'));
 const post=document.querySelector('.post-page[data-post-category]');
 if(!post)return;
 const category=params.get('category');
 const filtered=post.dataset.postCategory===category&&(category==='Awards'||category==='Conferences');
 if(!filtered&&category!=='all')return;
 post.querySelectorAll('.post-back').forEach(link=>{
  const url=new URL(link.href);
  url.hash=page.slice(5);
  if(filtered){
   url.searchParams.set('category',category);
   link.textContent=link.classList.contains('post-back-bottom')?'Back to '+category.toLowerCase():'← '+category;
  }
  link.href=url.href;
 });
 post.querySelectorAll('.post-navigation').forEach(nav=>{
  nav.hidden=filtered!==nav.hasAttribute('data-filtered-posts');
  if(!nav.hidden)nav.querySelectorAll('a').forEach(link=>setPostCategory(link,category));
 });
}
function connectResearchNavigation(){
 const nav=document.querySelector('.research-jump');
 if(!nav)return;
 const layout=nav.parentElement;
 const areas=[...nav.querySelectorAll('a[data-area]')].map(link=>({
  link,
  section:document.getElementById(link.dataset.area),
 })).filter(area=>area.section);
 if(!areas.length)return;

 let frame=null,currentLink=null;
 function updateCurrentArea(){
  frame=null;
  // The flag, its gap to the article, and its focus outline must fit in the actual gutter.
  const layoutBounds=layout.getBoundingClientRect();
  const gutter=mobileNavigation.matches?0:layoutBounds.left;
  const rail=gutter>=188?'full':gutter>=116?'compact':null;
  if(rail!==layout.getAttribute('data-research-rail')){
   if(rail)layout.setAttribute('data-research-rail',rail);
   else layout.removeAttribute('data-research-rail');
  }
  const root=document.documentElement;
  if(rail){
   // Keep the rail at its unscrolled height, with room for all flags in short windows.
   const top=Math.max(0,Math.min(layoutBounds.top+window.scrollY,root.clientHeight-nav.offsetHeight-24));
   const inset=`${Math.round(top)}px`;
   if(nav.style.getPropertyValue('--research-rail-top')!==inset)nav.style.setProperty('--research-rail-top',inset);
  }
  const readingLine=rail?60:Math.max(60,nav.getBoundingClientRect().bottom+24);
  const atBottom=window.scrollY>0&&root.scrollHeight-root.clientHeight-window.scrollY<=2;
  const current=atBottom?areas.at(-1):areas.findLast(area=>area.section.getBoundingClientRect().top<=readingLine)||areas[0];
  if(current.link===currentLink)return;
  currentLink?.removeAttribute('aria-current');
  currentLink=current.link;
  currentLink.setAttribute('aria-current','location');
 }
 function scheduleUpdate(){
  if(frame===null)frame=requestAnimationFrame(updateCurrentArea);
 }

 updateCurrentArea();
 window.addEventListener('scroll',scheduleUpdate,{passive:true});
 for(const event of ['resize','load','pageshow','hashchange'])window.addEventListener(event,scheduleUpdate);
 if(typeof ResizeObserver==='function'){
  const observer=new ResizeObserver(scheduleUpdate);
  observer.observe(nav);
  for(const area of areas)observer.observe(area.section);
 }
}
function connect() {
 if(preview) for(const link of document.querySelectorAll('a[href]')) {
   const href=link.getAttribute('href');
   if(/^post-[a-z0-9_-]+\.html$/i.test(href)) {const url=new URL('news.html',location.href);url.searchParams.set('preview','1');url.searchParams.set('post',href.slice(5,-5));link.href=url.pathname+url.search;}
   else if(/^(index|research|people|students|publications|news|activities|join)\.html/.test(href)) {const url=new URL(href,location.href);url.searchParams.set('preview','1');link.href=url.pathname+url.search+url.hash;}
 }
 const search=document.getElementById('publication-search'), year=document.getElementById('publication-year');
 const publicationSearchText=value=>String(value).normalize('NFKD').replace(/\p{M}/gu,'').replace(/[‐‑‒–—−]/g,'-').toLowerCase();
 const copiedForms=value=>{
  const cleaned=value.replace(/^(?:doi:\s*)?[\s“‘"'(<\[]*/i,'');
  return [...new Set([cleaned,cleaned.replace(/[.,;:!?\])>”’"']+$/u,'')])].filter(Boolean);
 };
 const publicationURL=value=>{
  if(!/^(?:https?:\/\/|(?:[a-z0-9-]+\.)+[a-z]{2,}\/)[^\s]+$/i.test(value||''))return null;
  try{
   const url=new URL(/^https?:\/\//i.test(value)?value:'https://'+value);
   const host=url.hostname.replace(/^www\./i,'');
   const path=publicationSearchText(decodeURIComponent(url.pathname).replace(/\/+$/,''));
   const articlePath=path.replace(/(\/articles\/[^/]+)\/(?:figures|tables)\/\d+$/,'$1').replace(/\.pdf$|\/(?:full|abstract|epdf|pdf)$/,'');
   return {source:host+path+url.search+url.hash,article:host+articlePath,doi:path.match(/\/(10\.\d{4,9}\/.+)$/)?.[1]||''};
  }catch{return null;}
 };
 function filterPublications(){
  if(!search||!year)return;
  if(!year.value)year.value='all';
  const raw=search.value.trim(), selected=year.value, copied=copiedForms(raw);
  const pastedURLs=copied.map(publicationURL).filter(Boolean);
  const pastedDOIs=copied.filter(value=>/^10\.\d{4,9}\/\S+$/i.test(value)).map(publicationSearchText);
  const terms=publicationSearchText(raw.replace(/^doi:\s*/i,'')).split(/\s+/).filter(Boolean);
  const articles=[...document.querySelectorAll('#publication-results .publication')];
  let count=0;
  articles.forEach(article=>{
   const text=publicationSearchText(article.dataset.search||article.textContent);
   const group=article.closest('.publication-year-group')?.dataset.publicationYear||article.dataset.year;
   const doi=publicationSearchText(article.dataset.publicationDoi||'');
   const matches=pastedURLs.length
    ?pastedURLs.some(url=>url.article===publicationURL(article.dataset.publicationUrl)?.article||url.source===publicationURL(article.dataset.publicationFigureSource)?.source||(doi&&url.doi&&(url.doi===doi||url.doi.replace(/\.pdf$/,'')===doi)))
    :pastedDOIs.includes(doi)||terms.every(term=>text.includes(term));
   const visible=matches&&(selected==='all'||group===selected);
   article.hidden=!visible;if(visible) count++;
  });
  document.querySelectorAll('#publication-results .publication-year-group').forEach(group=>{
   group.hidden=!group.querySelector('.publication:not([hidden])');
  });
  document.getElementById('result-count').textContent=`${count} publication${count===1?'':'s'}`;
  document.getElementById('no-results').hidden=count!==0;
  const active=!!raw||selected!=='all';
  search.closest('details').toggleAttribute('data-active',active);
  document.getElementById('publication-filter-state').hidden=!active;
  const queryLabel=document.getElementById('publication-filter-query');
  queryLabel.hidden=!raw;
  queryLabel.textContent=raw?`“${raw}”`:'';
  document.getElementById('publication-filter-count').textContent=`${count} result${count===1?'':'s'}${selected==='all'?'':' · '+year.selectedOptions[0].textContent}`;
  document.getElementById('publication-filter-reset').hidden=!active;
  document.getElementById('publication-filter-clear').hidden=!active;
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
 const viewer=document.getElementById('image-viewer');
 if(viewer&&typeof viewer.showModal==='function') {
  let figureTrigger,crop,mode,fitWidth=0;
  const close=viewer.querySelector('.figure-viewer-close'),image=viewer.querySelector('img');
  const source=viewer.querySelector('.figure-viewer-source'),original=viewer.querySelector('.figure-viewer-original');
  const label=viewer.querySelector('.figure-viewer-label'),modes=viewer.querySelector('.figure-viewer-modes');
  const viewport=viewer.querySelector('.figure-viewer-viewport'),frame=viewer.querySelector('.figure-viewer-frame');
  const zoom=viewer.querySelector('.figure-viewer-zoom'),fit=viewer.querySelector('.figure-viewer-fit');
  const setFrame=()=>{
   const {figureWidth,figureHeight}=figureTrigger.dataset;
   const width=image.naturalWidth||Number(figureWidth),height=image.naturalHeight||Number(figureHeight);
   frame.hidden=!(width&&height);
   if(frame.hidden)return;
   const panel=mode==='panel'?crop:null;
   const visibleWidth=width*(panel?.width||1),visibleHeight=height*(panel?.height||1);
   frame.style.setProperty('--figure-ratio',visibleWidth/visibleHeight);
   frame.style.setProperty('--figure-natural-width',`${visibleWidth}px`);
   frame.style.setProperty('--figure-image-width',panel?`${100/panel.width}%`:'100%');
   frame.style.setProperty('--figure-image-left',panel?`${-100*panel.x/panel.width}%`:'0');
   frame.style.setProperty('--figure-image-top',panel?`${-100*panel.y/panel.height}%`:'0');
  };
  const resetZoom=()=>{
   fitWidth=0;
   frame.style.removeProperty('--figure-zoom-width');
   viewport.removeAttribute('tabindex');
   viewport.scrollTo(0,0);
   zoom.setAttribute('aria-disabled',String(frame.hidden));
  };
  const setMode=value=>{
   mode=value;
   const {figureTitle,figureLabel,figureOriginalAlt}=figureTrigger.dataset;
   const thumbnailAlt=figureTrigger.querySelector('img').alt;
   label.textContent=mode==='panel'?(crop.label||'Selected panel'):figureLabel;
   label.hidden=!label.textContent;
   image.alt=mode==='panel'?(thumbnailAlt||`Selected panel from ${figureTitle}`):(figureOriginalAlt||thumbnailAlt||figureTitle);
   modes.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.figureMode===mode)));
   setFrame();
   resetZoom();
  };
  modes.addEventListener('click',event=>{
   const value=event.target.dataset.figureMode;
   if(value&&value!==mode)setMode(value);
  });
  zoom.addEventListener('click',()=>{
   if(zoom.getAttribute('aria-disabled')==='true')return;
   const current=frame.getBoundingClientRect();
   fitWidth||=current.width;
   if(!fitWidth)return;
   const width=Math.min(current.width*1.5,fitWidth*6);
   const centerX=(viewport.scrollLeft+viewport.clientWidth/2-frame.offsetLeft)/current.width;
   const centerY=(viewport.scrollTop+viewport.clientHeight/2-frame.offsetTop)/current.height;
   frame.style.setProperty('--figure-zoom-width',`${width}px`);
   viewport.tabIndex=0;
   viewport.scrollTo(frame.offsetLeft+centerX*width-viewport.clientWidth/2,frame.offsetTop+centerY*frame.offsetHeight-viewport.clientHeight/2);
   zoom.setAttribute('aria-disabled',String(width>=fitWidth*6));
  });
  fit.addEventListener('click',resetZoom);
  image.addEventListener('load',()=>{
   if(!viewer.open)return;
   setFrame();
   if(!fitWidth)resetZoom();
  });
  document.querySelectorAll('[data-figure-image]').forEach(link=>link.addEventListener('click',event=>{
   if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
   event.preventDefault();figureTrigger=link;
   viewer.querySelector('h2').textContent=link.dataset.figureTitle;
   const {figureSource,figureImage,figureCrop}=link.dataset;
   crop=JSON.parse(figureCrop||'null');
   const thumbnail=link.querySelector('img');
   const imageURL=link.href.startsWith('blob:')?link.href:thumbnail.src.startsWith('blob:')?thumbnail.src:figureImage;
   image.src=imageURL;
   original.href=imageURL;
   source.hidden=!figureSource;
   if(figureSource)source.href=figureSource;
   else source.removeAttribute('href');
   modes.hidden=!crop;
   setMode(crop?'panel':'full');
   viewer.showModal();viewer.scrollTop=0;close.focus({preventScroll:true});
  }));
  close.addEventListener('click',()=>viewer.close());
  viewer.addEventListener('click',event=>{
   if(event.target!==viewer)return;
   const bounds=viewer.getBoundingClientRect();
   if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)viewer.close();
  });
  viewer.addEventListener('close',()=>{
   image.removeAttribute('src');
   figureTrigger?.focus({preventScroll:true});
  });
 }
 const categoryLinks=[...document.querySelectorAll('.news-categories [data-category]')];
 if(categoryLinks.length){
  const filterNews=category=>{
   const selected=categoryLinks.find(link=>link.dataset.category===category)||categoryLinks[0];
   let count=0;
   categoryLinks.forEach(link=>{if(link===selected)link.setAttribute('aria-current','true');else link.removeAttribute('aria-current');});
   document.querySelectorAll('#news-results .news-entry').forEach(article=>{
    const visible=selected.dataset.category==='all'||article.dataset.category===selected.dataset.category;
    article.hidden=!visible;
    if(visible){count++;setPostCategory(article.querySelector('.highlight-link'),selected.dataset.category);}
   });
   document.getElementById('news-count').textContent=`${count} news item${count===1?'':'s'}`;
  };
  const categoryFromURL=()=>new URLSearchParams(location.search).get('category')||'all';
  filterNews(categoryFromURL());
  const returnEntry=document.getElementById(location.hash.slice(1));
  if(returnEntry?.matches('.highlight-entry:not([hidden])'))returnEntry.scrollIntoView();
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
 connectResearchNavigation();
}
connect();
document.body.dataset.ready='true';
