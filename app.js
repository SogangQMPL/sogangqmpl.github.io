import {render, sortedNews, sortedPublications, publicationYearGroup, pageTitle} from './renderer.js';
const params=new URLSearchParams(location.search),preview=params.get('preview')==='1';
const page=preview&&params.get('post')?'post-'+params.get('post'):(document.body.dataset.page || 'index');
document.addEventListener('click',event=>{
 const toggle=event.target.closest('.menu-toggle');
 if(!toggle)return;
 const nav=document.getElementById('main-nav');
 const open=toggle.getAttribute('aria-expanded')!=='true';
 toggle.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open);
});
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape')return;
 const toggle=document.querySelector('.menu-toggle'),nav=document.getElementById('main-nav');
 if(toggle&&toggle.getAttribute('aria-expanded')==='true'){toggle.setAttribute('aria-expanded','false');nav.classList.remove('open');toggle.focus();}
});
let data;
try {
  const response=await fetch('content/site.json');
  if(!response.ok) throw new Error('Content could not be loaded');
  data=await response.json();
  if(preview) {
    const draft=localStorage.getItem('qmp-site-draft');
    if(draft) { data=JSON.parse(draft); document.getElementById('preview-notice').hidden=false; }
  }
  if(preview)document.getElementById('site-shell').innerHTML=render(data,page);
  document.title=pageTitle(data,page);
} catch(error) { console.error(error); }
function connect() {
 if(preview) for(const link of document.querySelectorAll('a[href]')) {
   const href=link.getAttribute('href');
   if(/^post-[a-z0-9_-]+\.html$/i.test(href)) {const url=new URL('news.html',location.href);url.searchParams.set('preview','1');url.searchParams.set('post',href.slice(5,-5));link.href=url.pathname+url.search;}
   else if(/^(index|research|people|students|publications|news|activities|join)\.html/.test(href)) {const url=new URL(href,location.href);url.searchParams.set('preview','1');link.href=url.pathname+url.search+url.hash;}
 }
 const search=document.getElementById('publication-search'), year=document.getElementById('publication-year');
 function filterPublications(){
  const query=search.value.trim().toLowerCase(), selected=year.value;
  const list=sortedPublications(data); let count=0;
  document.querySelectorAll('#publication-results .publication').forEach((article,i)=>{
   const p=list[i], text=[p.title,p.authors,p.journal,p.doi].join(' ').toLowerCase();
   const visible=(!query||text.includes(query))&&(selected==='all'||publicationYearGroup(p.year,data.publicationYearGroups)===selected);
   article.hidden=!visible;if(visible) count++;
  });
  document.querySelectorAll('#publication-results .publication-year-group').forEach(group=>{
   group.hidden=!group.querySelector('.publication:not([hidden])');
  });
  document.getElementById('result-count').textContent=`${count} publication${count===1?'':'s'}`;
  document.getElementById('no-results').hidden=count!==0;
 }
 if(data&&search) {search.addEventListener('input',filterPublications);year.addEventListener('change',filterPublications);}
 const viewer=document.getElementById('publication-viewer');
 if(viewer&&typeof viewer.showModal==='function') {
  let figureTrigger;
  document.querySelectorAll('[data-publication-figure]').forEach(link=>link.addEventListener('click',event=>{
   event.preventDefault();figureTrigger=link;
   viewer.querySelector('h2').textContent=link.dataset.figureTitle;
   viewer.querySelector('.figure-viewer-label').textContent=link.dataset.figureLabel;
   const image=viewer.querySelector('img');image.src=link.getAttribute('href');image.alt=link.querySelector('img').alt;
   const source=viewer.querySelector('.figure-viewer-source');source.hidden=!link.dataset.figureSource;if(link.dataset.figureSource)source.href=link.dataset.figureSource;
   viewer.showModal();viewer.querySelector('button').focus();
  }));
  viewer.querySelector('button').addEventListener('click',()=>viewer.close());
  viewer.addEventListener('click',event=>{if(event.target===viewer)viewer.close();});
  viewer.addEventListener('close',()=>figureTrigger?.focus());
 }
 const categoryLinks=[...document.querySelectorAll('.news-categories [data-category]')];
 if(data&&categoryLinks.length){
  const news=sortedNews(data).filter(n=>n.category!=='Activities');
  const filterNews=category=>{
   const selected=categoryLinks.find(link=>link.dataset.category===category)||categoryLinks[0];
   let count=0;
   categoryLinks.forEach(link=>{if(link===selected)link.setAttribute('aria-current','true');else link.removeAttribute('aria-current');});
   document.querySelectorAll('#news-results .news-entry').forEach((article,i)=>{
    const visible=selected.dataset.category==='all'||news[i].category===selected.dataset.category;
    article.hidden=!visible;if(visible)count++;
   });
   document.getElementById('news-count').textContent=`${count} news items`;
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
 }
}
connect();
document.body.dataset.ready='true';
