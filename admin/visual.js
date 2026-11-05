import {render,pageTitle,postFileName} from '../renderer.js';
import * as github from './visual-github.js';
import {renderInspector,getAt,setAt} from './visual-fields.js';
import {loadLocalDraft,saveLocalDraft,clearLocalDraft,stageImage as prepareImage,STORAGE_LIMITS} from './visual-storage.js';

const $=id=>document.getElementById(id),clone=value=>structuredClone(value);
const SITE='https://sogangqmpl.github.io/';
const BACKEND=document.querySelector('meta[name="qmp-backend"]')?.content==='same-origin';
const ROUTES=[['index','Home'],['people','Professor'],['students','Students'],['research','Research'],['publications','Publications'],['news','News'],['activities','Activities'],['join','Join Us']];
let data=null,baseData=null,baseHead='',assets=[],page='index',selection=null,mode='edit',undoStack=[],redoStack=[],connected=false,session=null,token='',publishing=false,draftTimer,frameTimer,saveSequence=0,frameSequence=0,draftDecision=false,loadedDraft=null,inlineEditing=false;
const assetURLs=new Map();
let lastChangeKey='',lastChangeTime=0;
const rootPrefix=new URL('../',import.meta.url).href;
const hostPrefix=new URL('./',import.meta.url).href;
function node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
function message(text,error=false){$('editor-message').textContent=text;$('editor-message').classList.toggle('error',error);}
function activeAssets(content=data, files=assets){const used=JSON.stringify(content);return files.filter(asset=>used.includes(JSON.stringify(asset.path)));}
function sameContent(left,right){if(left===right)return true;if(!left||!right||typeof left!=='object'||typeof right!=='object')return false;if(Array.isArray(left)||Array.isArray(right)){if(!Array.isArray(left)||!Array.isArray(right)||left.length!==right.length)return false;for(let i=0;i<left.length;i++)if(!sameContent(left[i],right[i]))return false;return true;}const keys=Object.keys(left);return keys.length===Object.keys(right).length&&keys.every(key=>Object.hasOwn(right,key)&&sameContent(left[key],right[key]));}
function dirty(){return Boolean(data&&baseData&&!sameContent(data,baseData));}
function setDraftState(text,state=''){$('draft-state').textContent=text;$('draft-indicator').dataset.state=state;}
function controls(){document.querySelector('.editor-workspace').inert=Boolean(draftDecision||publishing);$('backup-button').disabled=draftDecision||!data;$('revisions-button').disabled=draftDecision||publishing;$('import-file').disabled=draftDecision||publishing;const changed=Boolean(dirty());$('undo').disabled=!undoStack.length||publishing;$('redo').disabled=!redoStack.length||publishing;$('publish-button').disabled=draftDecision||!data||publishing||!changed;$('connection-button').disabled=draftDecision||publishing;$('publish-button').textContent=publishing?'게시 중…':'게시하기';$('connection-button').textContent=connected?'GitHub 연결됨':'GitHub 연결';$('connection-button').classList.toggle('connected',connected);}
function snapshot(){return {data:clone(data),assets:assets.map(a=>({...a})),page};}
function restoreSnapshot(value){lastChangeKey='';data=value.data;assets=value.assets;page=value.page;selection=null;renderAll();scheduleSave();}
function change(mutator,label='내용 수정',options={}){
 if(publishing)throw new Error('게시가 끝난 뒤 수정해 주세요.');
 const next=clone(data);
 mutator(next);
 const nextAssets=options.stagedAssets?.length ? [...assets,...options.stagedAssets] : assets;
 if(nextAssets!==assets){
  const used=activeAssets(next,nextAssets);
  const bytes=used.reduce((sum,{base64})=>sum+base64.length/4*3-(base64.endsWith('==')?2:base64.endsWith('=')?1:0),0);
  if(used.length>STORAGE_LIMITS.imageCount||bytes>STORAGE_LIMITS.totalImageBytes)throw new Error('새 그림과 썸네일이 초안 저장 한도(총 10MB 또는 50개 파일)를 넘었습니다. 더 작은 파일을 선택하세요.');
 }
 const now=Date.now();
 if(!options.coalesceKey||options.coalesceKey!==lastChangeKey||now-lastChangeTime>1200){undoStack.push(snapshot());if(undoStack.length>40)undoStack.shift();}
 lastChangeKey=options.coalesceKey||'';
 lastChangeTime=now;
 redoStack=[];
 for(const key of Object.keys(data))delete data[key];
 Object.assign(data,next);
 assets=nextAssets;
 setDraftState('초안 저장 중…','dirty');
 renderAll(options);
 scheduleSave();
 message(label+' · 미리보기에서 확인하세요.');
}
function scheduleSave(){
 if(!data||draftDecision)return;
 clearTimeout(draftTimer);draftTimer=undefined;
 const sequence=++saveSequence;
 const failed=error=>{if(sequence!==saveSequence)return;setDraftState('초안 저장 실패','error');message(error.message||'초안을 저장하지 못했습니다. 백업을 내려받아 보관해 주세요.',true);};
 if(!dirty()&&!activeAssets().length){
  setDraftState('초안 정리 중…','dirty');
  void clearLocalDraft().then(()=>{if(sequence===saveSequence)setDraftState('최신 게시본','saved');}).catch(failed);
  return;
 }
 setDraftState('초안 저장 중…','dirty');
 draftTimer=setTimeout(async()=>{
  if(sequence!==saveSequence)return;
  draftTimer=undefined;
  if(!dirty()&&!activeAssets().length){scheduleSave();return;}
  try{await saveLocalDraft({data:clone(data),baseHead,assets:activeAssets(),updatedAt:new Date().toISOString()});if(sequence===saveSequence)setDraftState(dirty()?'이 브라우저에 초안 저장됨':'최신 게시본','saved');}catch(error){failed(error);}
 },500);
}
function descriptor(el){try{return {...JSON.parse(el.dataset.editDescriptor||'{}'),path:el.dataset.editPath,type:el.dataset.editType,label:el.dataset.editLabel};}catch{return {path:el.dataset.editPath,type:el.dataset.editType,label:el.dataset.editLabel};}}
function select(value){selection=value;document.body.classList.toggle('has-selection',Boolean(value));$('clear-selection').hidden=!value;$('selection-title').textContent=value?.label||'내용 수정';if(value){renderInspector({root:$('inspector'),data,selection:value,onChange:change,stageImage:stage,onChooseRecord:select,resolveImage:path=>{const asset=assets.find(item=>item.path===path);return asset?urlFor(asset):new URL(path,SITE).href;}});}else{$('inspector').replaceChildren(node('div','화면의 글이나 사진을 선택하면 이곳에서 수정할 수 있습니다.','inspector-empty'));}renderItemActions();highlightSelection();}
function highlightSelection(){const doc=$('site-preview').contentDocument;if(!doc)return;doc.querySelectorAll('.editor-selected').forEach(el=>el.classList.remove('editor-selected'));if(selection?.path){[...doc.querySelectorAll('[data-edit-path],[data-edit-item]')].filter(el=>el.dataset.editPath===selection.path||el.dataset.editItem===selection.path).forEach(el=>el.classList.add('editor-selected'));}}
function selectedItemPath(){if(!selection)return '';const path=selection.path||'';if(/^\/(news|people|publications|underReview)\/\d+(?:\/|$)/.test(path))return path.match(/^\/(?:news|people|publications|underReview)\/\d+/)[0];const topic=path.match(/^\/research\/\d+\/topics\/\d+/);if(topic)return topic[0];const area=path.match(/^\/research\/\d+/);return area?.[0]||'';}
function renderItemActions(){const path=selectedItemPath();$('item-actions').hidden=!path||/\/(content|detailSections|detailImages)\//.test(selection?.path||'');const button=$('delete-item');button.textContent=path.startsWith('/news/')?'게시물 삭제':path.startsWith('/publications/')||path.startsWith('/underReview/')?'논문 삭제':path.startsWith('/people/')?'구성원 삭제':'주제 삭제';button.disabled=path.startsWith('/research/')&&!path.includes('/topics/');if(path){const parts=path.split('/'),index=Number(parts.pop()),parent=getAt(data,parts.join('/'));$('move-up').disabled=!index;$('move-down').disabled=index>=parent.length-1;}}
function navigate(next,fragment=''){
 if(next===page&&fragment){
  const target=$('site-preview').contentDocument?.getElementById(fragment);
  if(target){target.scrollIntoView();return;}
 }
 if(inlineEditing)$('site-preview').contentDocument.activeElement?.blur();
 page=next;
 selection=null;
 renderAll({fragment});
}
function renderPages(){$('pages').replaceChildren(...ROUTES.map(([id,title])=>{const b=node('button',title);b.type='button';b.setAttribute('aria-current',String(page===id||page.startsWith('post-')&&id===(isActivities()?'activities':'news')));b.addEventListener('click',()=>navigate(id));return b;}));$('page-name').textContent=page.startsWith('post-')?'게시물':ROUTES.find(([id])=>id===page)?.[1]||page;}
function isActivities(){return page==='activities'||page.startsWith('post-')&&data.news.find(item=>item.id===page.slice(5))?.category==='Activities';}
function collection(){if(page==='people'||page==='students')return 'people';if(page==='publications')return 'publications';if(['news','activities'].includes(page)||page.startsWith('post-'))return 'news';if(page==='research')return 'research';return '';}
function recordLabel(value){return value.title||value.name||'새 항목';}
function renderItems(){const key=collection(),list=$('item-list');list.replaceChildren();$('add-item').hidden=!key||page==='people';$('content-heading').textContent=({people:'구성원',publications:'논문',news:'게시물',research:'연구 주제'})[key]||'페이지 내용';if(!key){const b=node('button','기본 정보 수정','list-item');b.addEventListener('click',()=>select({path:page==='join'?'/join':'/hero',type:'record',label:page==='join'?'모집 안내':'홈 첫 화면'}));list.append(b);const global=node('button','연구실 정보 · 연락처','list-item');global.addEventListener('click',()=>select({path:'/site',type:'record',label:'연구실 기본 정보'}));list.append(global);if(page==='index'){const a=node('button','상단 모집 안내문','list-item');a.addEventListener('click',()=>select({path:'/announcement',type:'record',label:'상단 안내문'}));list.append(a);}return;}
 let entries=data[key].map((item,index)=>({item,index}));if(key==='people')entries=entries.filter(({item})=>page==='people'?/principal investigator|^pi$|교수/i.test(item.role||''):!/principal investigator|^pi$|교수/i.test(item.role||''));if(key==='news')entries=entries.filter(({item})=>isActivities()?item.category==='Activities':item.category!=='Activities').sort((a,b)=>b.item.date.localeCompare(a.item.date));if(key==='publications')entries.sort((a,b)=>b.item.year-a.item.year);
 for(const {item,index} of entries){const b=node('button',undefined,'list-item');b.append(node('span',recordLabel(item),'item-name'),node('small',[item.date||item.year||item.role||'',item.category||''].filter(Boolean).join(' · '),'item-meta'));b.addEventListener('click',()=>{if(key==='news'){page='post-'+item.id;renderPages();renderFrame();}select({path:`/${key}/${index}`,type:'record',label:recordLabel(item)});});list.append(b);if(key==='research')for(const [j,topic] of (item.topics||[]).entries()){const sub=node('button','↳ '+topic.title,'list-item sub-item');sub.addEventListener('click',()=>select({path:`/research/${index}/topics/${j}`,type:'record',label:topic.title}));list.append(sub);}}
 if(key==='publications'){const b=node('button','+ 심사 중 논문 추가','list-item');b.addEventListener('click',()=>addRecord('underReview'));list.append(b);for(const [i,item] of (data.underReview||[]).entries()){const b=node('button','심사 중 · '+item.title,'list-item sub-item');b.addEventListener('click',()=>select({path:`/underReview/${i}`,type:'record',label:'심사 중 논문'}));list.append(b);}}
 if(key==='research'){const b=node('button','+ 세부 연구 주제 추가','list-item');b.addEventListener('click',()=>{const area=selection?.path?.match(/^\/research\/(\d+)/)?.[1]||'0';addRecord('topic',Number(area));});list.append(b);}}
function renderAll(options={}){if(!data)return;renderPages();renderItems();renderFrame(options.fragment);if(!options.preserveInspector){if(selection)select(selection);else select(null);}controls();}
function frameHTML(){
 let html=render(data,page,{editable:true});
 const staged=new Map(activeAssets().map(asset=>[asset.path,urlFor(asset)]));
 for(const [path,url] of staged){
  html=html.replaceAll('src="'+path+'"','src="'+url+'"').replaceAll('href="'+path+'"','href="'+url+'"');
 }
 html=html.replace(/\bsrcset="([^"]+)"/g,(_match,srcset)=>{
  const entries=srcset.split(', ').map(entry=>entry.replace(/^assets\/uploads\/\S+/,path=>staged.get(path)||path));
  return `srcset="${entries.join(', ')}"`;
 });
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${SITE}"><link rel="stylesheet" href="${new URL('../styles.css',import.meta.url).href}"><style>html{scrollbar-gutter:stable}body{min-height:100vh}.editing [data-edit-path]{cursor:pointer}.editing [data-edit-path]:hover{outline:2px dashed #5d8ac2;outline-offset:4px}.editing .editor-selected{outline:2px solid #2764a3!important;outline-offset:5px}.editing [contenteditable=true]{cursor:text;outline:2px solid #2764a3;background:#fff;min-width:1em}*{scroll-margin-top:30px}</style></head><body class="${mode==='edit'?'editing':''}" data-page="${page}"><div id="preview-notice" hidden></div><div id="site-shell">${html}</div><script type="module" src="${new URL('../app.js',import.meta.url).href}"></script></body></html>`;
}
function renderFrame(fragment=''){
 clearTimeout(frameTimer);
 const sequence=++frameSequence;
 frameTimer=setTimeout(()=>{
  const frame=$('site-preview');
  let scrollY=0;
  try{if(frame.dataset.page===page)scrollY=frame.contentWindow.scrollY||0;}catch{}
  frame.dataset.page=page;
  frame.onload=()=>{
   if(sequence!==frameSequence)return;
   const doc=frame.contentDocument;
   doc.addEventListener('click',frameClick,true);
   doc.addEventListener('dblclick',inlineEdit,true);
   highlightSelection();
   const target=fragment&&doc.getElementById(fragment);
   if(target)target.scrollIntoView();
   else if(scrollY)frame.contentWindow.scrollTo(0,scrollY);
  };
  frame.srcdoc=frameHTML();
 },100);
}
function localPage(href){
 try{
  const url=new URL(href,SITE);
  if(url.origin!==new URL(SITE).origin)return null;
  const file=url.pathname.split('/').at(-1);
  if(ROUTES.some(([id])=>file===id+'.html')||/^post-[a-z0-9_-]+\.html$/i.test(file)){
   return {page:file.slice(0,-5),fragment:decodeURIComponent(url.hash.slice(1))};
  }
 }catch{}
 return null;
}
function frameClick(event){if(event.target.closest('summary'))return;
 const jump=event.target.closest('.research-jump a[href^="#"]');
 if(jump){event.preventDefault();jump.ownerDocument.getElementById(jump.hash.slice(1))?.scrollIntoView();return;}
 const category=event.target.closest('a[data-category]');if(category){event.preventDefault();event.stopImmediatePropagation();const value=category.dataset.category,doc=category.ownerDocument;let count=0;doc.querySelectorAll('#news-results>article[data-category]').forEach(el=>{el.hidden=value!=='all'&&el.dataset.category!==value;if(!el.hidden)count++;});doc.querySelectorAll('a[data-category]').forEach(el=>{if(el.dataset.category===value)el.setAttribute('aria-current','true');else el.removeAttribute('aria-current');});const status=doc.getElementById('news-count');if(status)status.textContent=count+' news items';return;}
 if(inlineEditing&&event.target.isContentEditable)return;
 const field=event.target.closest('[data-edit-path]');if(mode==='edit'&&field){event.preventDefault();event.stopImmediatePropagation();select(descriptor(field));return;}
 const link=event.target.closest('a[href]');
 if(link){
  const target=localPage(link.getAttribute('href'));
  if(target){event.preventDefault();event.stopImmediatePropagation();navigate(target.page,target.fragment);return;}
  if(mode==='edit'){event.preventDefault();event.stopImmediatePropagation();const item=event.target.closest('[data-edit-item]');if(item)select({path:item.dataset.editItem,type:'record',label:'내용 수정'});return;}
 }
 if(mode==='edit'){const item=event.target.closest('[data-edit-item]');if(item){event.preventDefault();select({path:item.dataset.editItem,type:'record',label:'내용 수정'});}}}
function inlineEdit(event){if(mode!=='edit'||publishing)return;const el=event.target.closest('[data-edit-path]');if(!el||!['text','multiline','email'].includes(el.dataset.editType))return;event.preventDefault();event.stopImmediatePropagation();const d=descriptor(el),original=getAt(data,d.path);inlineEditing=true;el.contentEditable='true';el.addEventListener('paste',ev=>{ev.preventDefault();const plain=ev.clipboardData.getData('text/plain'),selection=el.ownerDocument.getSelection();if(selection?.rangeCount){const range=selection.getRangeAt(0);range.deleteContents();const text=el.ownerDocument.createTextNode(plain);range.insertNode(text);range.setStartAfter(text);range.collapse(true);selection.removeAllRanges();selection.addRange(range);}});el.focus();const range=el.ownerDocument.createRange();range.selectNodeContents(el);const s=el.ownerDocument.getSelection();s.removeAllRanges();s.addRange(range);let cancelled=false;el.addEventListener('keydown',ev=>{if(ev.key==='Escape'){cancelled=true;el.blur();}if(ev.key==='Enter'&&d.type!=='multiline'){ev.preventDefault();el.blur();}},{capture:true});el.addEventListener('blur',()=>{const value=el.innerText.replace(/\r/g,'').trim();inlineEditing=false;el.contentEditable='false';if(!cancelled&&value!==String(original||''))change(draft=>setAt(draft,d.path,value),d.label+' 수정');else renderFrame();},{once:true});}
function urlFor(asset){if(asset.previewURL)return asset.previewURL;if(assetURLs.has(asset.path))return assetURLs.get(asset.path);const binary=atob(asset.base64),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:asset.mime||'image/webp'}));assetURLs.set(asset.path,url);return url;}
async function stage(file,options){
 if(publishing)throw new Error('게시가 끝난 뒤 사진을 추가해 주세요.');
 return prepareImage(file,options);
}
function addRecord(kind=collection(),parent=0){const id=kind+'-'+crypto.randomUUID(),date=new Date().toLocaleDateString('sv-SE');let item;if(kind==='news')item={id,title:'새 게시물',date,category:isActivities()?'Activities':'Conferences',body:'',summary:'',content:[{type:'paragraph',text:'내용을 입력하세요.'}]};else if(kind==='people')item={id,name:'새 구성원',role:page==='people'?'Principal Investigator':'Master’s student',description:'',email:'',image:'',url:''};else if(kind==='publications')item={id,title:'새 논문',authors:'',journal:'',year:new Date().getFullYear(),doi:'',url:'',labAuthors:[],featured:false};else if(kind==='underReview')item={id,title:'새 원고',authors:'',labAuthors:[]};else if(kind==='research')item={id,title:'새 연구 분야',summary:'',topics:[]};else if(kind==='topic')item={id,title:'새 세부 주제',summary:'',focus:[],paperIds:[],detailSections:[]};else return;
 let path;change(draft=>{const arr=kind==='topic'?(draft.research[parent].topics||=([])):(draft[kind]||=([]));arr.push(item);path=kind==='topic'?`/research/${parent}/topics/${arr.length-1}`:`/${kind}/${arr.length-1}`;},'새 항목 추가');if(kind==='news')page='post-'+id;renderAll();select({path,type:'record',label:recordLabel(item)});}
function itemMove(direction){const path=selectedItemPath();if(!path)return;const parts=path.split('/'),index=Number(parts.pop()),parent=parts.join('/'),other=index+direction;const list=getAt(data,parent);if(other<0||other>=list.length)return;change(draft=>{const a=getAt(draft,parent);[a[index],a[other]]=[a[other],a[index]];},'순서 변경');select({path:parent+'/'+other,type:'record',label:recordLabel(getAt(data,parent+'/'+other))});}
function askConfirm(title,description,accept='삭제'){return new Promise(resolve=>{$('confirm-title').textContent=title;$('confirm-description').textContent=description;$('confirm-accept').textContent=accept;const dialog=$('confirm-dialog');const finish=value=>{dialog.close();$('confirm-accept').onclick=null;$('confirm-cancel').onclick=null;resolve(value);};$('confirm-accept').onclick=()=>finish(true);$('confirm-cancel').onclick=()=>finish(false);dialog.oncancel=event=>{event.preventDefault();finish(false);};dialog.showModal();});}
async function deleteItem(){const path=selectedItemPath();if(!path)return;const item=getAt(data,path);if(!await askConfirm('이 항목을 삭제할까요?',recordLabel(item)+' · 게시 전에는 되돌릴 수 있습니다.'+(path.startsWith('/publications/')?' 연구 주제의 논문 연결도 함께 제거됩니다.':'')))return;
 const parts=path.split('/'),index=Number(parts.pop());selection=null;change(draft=>{getAt(draft,parts.join('/')).splice(index,1);if(path.startsWith('/publications/')){const clean=value=>{if(!value||typeof value!=='object')return;for(const key of Object.keys(value)){if(['paperIds','sourcePaperIds'].includes(key)&&Array.isArray(value[key]))value[key]=value[key].filter(id=>id!==item.id);else if(typeof value[key]==='object')clean(value[key]);}};clean(draft.research);}},'항목 삭제');if(page==='post-'+item.id)navigate(item.category==='Activities'?'activities':'news');}
function renderDesign(){const panel=$('design-panel');panel.replaceChildren(node('h2','사이트 디자인'),node('p','글과 사진은 그대로 두고 색상과 간격을 조절합니다.','panel-note'));const defs=[['primaryColor','기본 색상','color','#002e5d'],['accentColor','강조 색상','color','#7860bb'],['pageWidth','PC 본문 너비','range',1280,1000,1500],['pageGutter','PC 좌우 여백','range',40,20,72],['spacing','섹션 간격','range',32,20,48]];for(const [key,label,type,fallback,min,max] of defs){const wrap=node('label',undefined,'visual-field');wrap.append(node('span',label));const input=document.createElement('input');input.type=type;input.value=data.appearance?.[key]??fallback;if(min){input.min=min;input.max=max;input.step=1;}const output=node('output',String(input.value)+(type==='range'?'px':''));input.addEventListener('input',()=>output.textContent=input.value+(type==='range'?'px':''));input.addEventListener('change',()=>{change(draft=>{draft.appearance||={};draft.appearance[key]=type==='range'?Number(input.value):input.value;},'디자인 변경');});wrap.append(input,output);panel.append(wrap);}const reset=node('button','기존 디자인으로 되돌리기');reset.onclick=()=>{change(draft=>delete draft.appearance,'디자인 초기화');renderDesign();};panel.append(reset);}
async function api(path,options={}){const response=await fetch('/api/'+path,{...options,credentials:'same-origin',headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(session?.csrf?{'X-CSRF-Token':session.csrf}:{}),...options.headers}});let value;try{value=await response.json();}catch{throw new Error('서버 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.');}if(!response.ok){const error=new Error(value.message||'연결을 확인해 주세요.');error.code=value.code||value.error;if(error.code==='AUTH_REQUIRED'){connected=false;controls();}throw error;}return value;}
async function getSnapshot(sha){return BACKEND?api('state'+(sha?'?sha='+encodeURIComponent(sha):'')):(sha?github.loadRevision({sha,token}):github.loadSnapshot({token}));}
function connectionDialog(){if(draftDecision){message('위에서 초안을 이어서 편집할지, 현재 홈페이지로 시작할지 먼저 선택해 주세요.');return;}const box=$('connection-content');box.replaceChildren();if(connected){box.append(node('p',(session?.user?.login||'SogangQMPL')+' 계정으로 연결되어 있습니다.'));const b=node('button','연결 해제');b.onclick=async()=>{try{if(BACKEND)await api('disconnect',{method:'POST',body:'{}'});token='';session=null;connected=false;controls();$('connection-dialog').close();message('GitHub 연결을 해제했습니다. 초안은 이 브라우저에 남아 있습니다.');}catch(e){message(e.message,true);}};box.append(b);}else if(BACKEND){if(session?.configured){box.append(node('p','SogangQMPL 계정으로 연결하면 여기서 바로 게시할 수 있습니다.'));const link=node('a','GitHub로 연결','button primary');link.href='/auth/github';link.target='_top';link.addEventListener('click',async event=>{event.preventDefault();clearTimeout(draftTimer);try{await saveLocalDraft({data:clone(data),baseHead,assets:activeAssets(),updatedAt:new Date().toISOString()});location.assign('/auth/github');}catch(e){message(e.message,true);}});box.append(link);}else{box.append(node('p','관리자의 최초 GitHub 연결 설정이 필요합니다. 화면 편집과 초안 저장은 지금 사용할 수 있습니다.'));const p=node('p','연결 설정이 완료되면 이곳에 GitHub 로그인 버튼이 표시됩니다.','dialog-note');box.append(p);}}else{box.append(node('p','공용 GitHub 계정의 이 저장소 전용 연결키를 입력하세요. 연결키는 현재 탭에서만 사용하며 저장하지 않습니다.'));const input=document.createElement('input');input.type='password';input.autocomplete='off';input.placeholder='GitHub 연결키';input.setAttribute('aria-label','GitHub 연결키');const b=node('button','연결','primary');b.onclick=async()=>{b.disabled=true;try{const next=input.value.trim();if(!next)throw new Error('연결키를 입력하세요.');await github.loadSnapshot({token:next});token=next;connected=true;input.value='';controls();$('connection-dialog').close();message('GitHub에 연결했습니다. 변경 내용을 게시할 수 있습니다.');}catch(e){message(e.message,true);}finally{b.disabled=false;}};box.append(input,b);const link=node('a','연결키 발급 안내 ↗');link.href='https://github.com/settings/personal-access-tokens/new?name=QMPL%20website%20editor&description=Publish%20SogangQMPL%20website&target_name=SogangQMPL&contents=write';link.target='_blank';link.rel='noopener noreferrer';box.append(link,node('p','Only select repositories에서 sogangqmpl.github.io만 선택하고 Contents의 Read and write 권한을 사용하세요.','dialog-note'));} $('connection-dialog').showModal();}
async function requestPublish(){if(!dirty()||publishing)return;if(!connected){connectionDialog();return;}try{github.validateSiteData(data);}catch(e){message(e.message,true);return;}$('publish-review').replaceChildren(node('p','수정한 홈페이지 내용이 공개됩니다.','change-summary'));if(activeAssets().length)$('publish-review').append(node('p','새 사진 '+activeAssets().length+'개를 함께 게시합니다.'));$('publish-message').value='';$('publish-dialog').showModal();}
async function publish(){if(publishing)return;$('publish-dialog').close();publishing=true;controls();message('변경 내용과 사진을 GitHub에 저장하고 있습니다…');const publishedData=clone(data);const payload={data:publishedData,baseHead,assets:activeAssets().map(({path,base64})=>({path,base64})),message:$('publish-message').value.trim()||'홈페이지 내용 수정'};try{const result=BACKEND?await api('publish',{method:'POST',body:JSON.stringify(payload)}):await github.publishSnapshot({...payload,token});baseHead=result.sha;baseData=clone(publishedData);assets=[];undoStack=[];redoStack=[];await clearLocalDraft();setDraftState('GitHub 저장 완료 · 배포 중','saved');message('저장했습니다. 홈페이지에 반영될 때까지 기다려 주세요.');let completed=false;for(let i=0;i<24;i++){await new Promise(r=>setTimeout(r,i?8000:3000));const status=BACKEND?await api('deployment?sha='+encodeURIComponent(result.sha)):await github.getDeploymentStatus({sha:result.sha,token});if(status.state==='success'){completed=true;setDraftState('게시 완료','saved');message('게시 완료 · 홈페이지에서 수정된 내용을 확인할 수 있습니다.');break;}if(status.state==='failure')throw new Error('GitHub 저장은 완료됐지만 홈페이지 배포에 실패했습니다. 게시 이력에서 상태를 확인해 주세요.');}if(!completed){setDraftState('GitHub 저장 완료','saved');message('저장했습니다. 배포가 계속 진행 중입니다. 잠시 뒤 홈페이지를 확인해 주세요.');}}catch(e){if(e.code==='CONFLICT')message('다른 사람이 먼저 게시했습니다. 초안은 보관했습니다. 백업을 받은 뒤 최신 홈페이지를 불러와 변경 내용을 확인해 주세요.',true);else message(e.message||'게시하지 못했습니다. 초안은 보관되어 있습니다.',true);scheduleSave();}finally{publishing=false;controls();}}
async function revisions(){const box=$('revision-list');box.replaceChildren(node('p','게시 이력을 불러오는 중…'));$('revisions-dialog').showModal();try{const entries=BACKEND?await api('revisions'):await github.listRevisions({token});const rows=Array.isArray(entries)?entries:entries.revisions||[];box.replaceChildren();for(const item of rows.slice(0,20)){const entry=node('div',undefined,'revision-entry');entry.append(node('strong',item.message.split('\n')[0]),node('small',item.date?new Date(item.date).toLocaleString('ko-KR'):''));const button=node('button','이 내용 불러오기');button.onclick=async()=>{if(dirty()&&!await askConfirm('현재 초안을 바꿀까요?','지금 편집 중인 내용은 백업으로 보관한 뒤 진행하세요.','불러오기'))return;button.disabled=true;try{const historic=await getSnapshot(item.sha);change(draft=>{for(const k of Object.keys(draft))delete draft[k];Object.assign(draft,clone(historic.data));},'이전 게시 내용 불러옴');$('revisions-dialog').close();message('이전 내용을 불러왔습니다. 화면에서 확인한 뒤 게시하기를 누르세요.');}catch(e){message(e.message,true);}finally{button.disabled=false;}};entry.append(button);box.append(entry);}if(!rows.length)box.append(node('p','표시할 게시 이력이 없습니다.'));}catch(e){box.replaceChildren(node('p',e.message));}}
function downloadBackup(){const backup={format:'qmp-visual-backup',version:1,data,baseHead,assets:activeAssets().map(({previewURL,...asset})=>asset),updatedAt:new Date().toISOString()};const blob=new Blob([JSON.stringify(backup,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='qmpl-backup-'+new Date().toLocaleDateString('sv-SE')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('내용과 새 사진을 함께 백업했습니다. 이 편집기의 불러오기에서 복원할 수 있습니다.');}
async function start(){try{const [snapshotResult,draftResult,sessionResult]=await Promise.allSettled([getSnapshot(),loadLocalDraft(),BACKEND?api('session'):Promise.resolve(null)]);if(snapshotResult.status!=='fulfilled')throw snapshotResult.reason;const snapshotValue=snapshotResult.value;data=snapshotValue.data;baseData=clone(data);baseHead=snapshotValue.head;if(sessionResult.status==='fulfilled'){session=sessionResult.value;connected=Boolean(session?.connected);}if(draftResult.status==='fulfilled'&&draftResult.value){loadedDraft=draftResult.value;if(!sameContent(loadedDraft.data,data)||loadedDraft.assets?.length){draftDecision=true;$('draft-banner').hidden=false;}}renderAll();setDraftState('최신 게시본','saved');message('글과 사진을 클릭해 수정하세요. 게시하기 전까지 공개 홈페이지는 바뀌지 않습니다.');const q=new URLSearchParams(location.search);if(q.get('github')==='connected')message('GitHub 연결을 완료했습니다. 초안을 이어서 편집한 뒤 게시할 수 있습니다.');if(q.get('github')==='error')message('GitHub 연결을 완료하지 못했습니다. 연결 버튼에서 다시 시도해 주세요.',true);}catch(e){message((e.message||'홈페이지를 불러오지 못했습니다.')+' 새로고침 후 다시 확인해 주세요.',true);}}
$('undo').onclick=()=>{if(undoStack.length){redoStack.push(snapshot());restoreSnapshot(undoStack.pop());}};$('redo').onclick=()=>{if(redoStack.length){undoStack.push(snapshot());restoreSnapshot(redoStack.pop());}};
$('clear-selection').onclick=$('inspector-close').onclick=()=>select(null);
$('edit-mode').onclick=()=>{mode='edit';document.body.classList.remove('preview-mode');$('edit-mode').setAttribute('aria-pressed','true');$('preview-mode').setAttribute('aria-pressed','false');$('canvas-hint').textContent='글과 사진을 클릭하면 오른쪽에서 수정할 수 있습니다.';renderFrame();};
$('preview-mode').onclick=()=>{mode='preview';document.body.classList.add('preview-mode');$('edit-mode').setAttribute('aria-pressed','false');$('preview-mode').setAttribute('aria-pressed','true');$('canvas-hint').textContent='미리보기 · 메뉴와 링크, 펼침 기능을 직접 확인하세요.';select(null);renderFrame();};
$('desktop-mode').onclick=()=>{$('canvas-frame').classList.remove('mobile');$('desktop-mode').setAttribute('aria-pressed','true');$('mobile-mode').setAttribute('aria-pressed','false');};$('mobile-mode').onclick=()=>{$('canvas-frame').classList.add('mobile');$('desktop-mode').setAttribute('aria-pressed','false');$('mobile-mode').setAttribute('aria-pressed','true');};
$('pages-tab').onclick=()=>{$('pages-tab').setAttribute('aria-pressed','true');$('design-tab').setAttribute('aria-pressed','false');$('page-panel').hidden=false;$('design-panel').hidden=true;};$('design-tab').onclick=()=>{$('pages-tab').setAttribute('aria-pressed','false');$('design-tab').setAttribute('aria-pressed','true');$('page-panel').hidden=true;$('design-panel').hidden=false;renderDesign();};
$('add-item').onclick=()=>addRecord();$('move-up').onclick=()=>itemMove(-1);$('move-down').onclick=()=>itemMove(1);$('delete-item').onclick=deleteItem;$('help-button').onclick=()=>$('help-dialog').showModal();$('connection-button').onclick=connectionDialog;$('publish-button').onclick=requestPublish;$('confirm-publish').onclick=publish;$('cancel-publish').onclick=()=>$('publish-dialog').close();$('revisions-button').onclick=revisions;$('backup-button').onclick=downloadBackup;
$('resume-draft').onclick=()=>{data=clone(loadedDraft.data);assets=loadedDraft.assets||[];baseHead=loadedDraft.baseHead||baseHead;draftDecision=false;$('draft-banner').hidden=true;renderAll();setDraftState('초안 이어서 편집 중','saved');message('이전 초안을 불러왔습니다. 게시하기 전에 화면을 확인하세요.');};$('dismiss-draft').onclick=async()=>{if(!await askConfirm('현재 게시본으로 시작할까요?','이 브라우저의 이전 편집 초안을 지우고 현재 홈페이지에서 시작합니다.','시작하기'))return;await clearLocalDraft();draftDecision=false;$('draft-banner').hidden=true;loadedDraft=null;data=clone(baseData);assets=[];selection=null;undoStack=[];redoStack=[];renderAll();setDraftState('최신 게시본','saved');};
$('import-file').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>16*1024*1024)throw new Error('백업 파일은 16MB 이하로 선택해 주세요.');const raw=JSON.parse(await file.text());const envelope=raw?.format==='qmp-visual-backup'?raw:{data:raw,assets:[]};const value=envelope.data;github.validateSiteData(value);if(dirty()&&!await askConfirm('백업 내용을 불러올까요?','현재 편집 중인 내용 대신 선택한 백업을 불러옵니다.','불러오기'))return;const restored=await saveLocalDraft({data:value,baseHead,assets:envelope.assets||[],updatedAt:new Date().toISOString()});undoStack.push(snapshot());redoStack=[];data=clone(restored.data);assets=restored.assets||[];selection=null;renderAll();scheduleSave();message('내용과 사진을 백업에서 불러왔습니다. 확인 후 게시해 주세요.');}catch(e){message(e.message||'백업 파일을 읽지 못했습니다.',true);}event.target.value='';};
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.target.closest('input,textarea,[contenteditable=true]')){e.preventDefault();(e.shiftKey?$('redo'):$('undo')).click();}});
window.addEventListener('beforeunload',event=>{if(dirty()||publishing){event.preventDefault();event.returnValue='';}});
start();
