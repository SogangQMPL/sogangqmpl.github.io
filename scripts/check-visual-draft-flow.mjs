import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../admin/visual.js',import.meta.url),'utf8');
function extract(name){
 const start=source.indexOf(`function ${name}(`);
 assert(start>=0,`Missing ${name}`);
 let depth=0,quote='',escaped=false,opened=false;
 for(let index=source.indexOf('{',start);index<source.length;index++){
  const char=source[index];
  if(quote){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char===quote)quote='';continue;}
  if(['"',"'",'`'].includes(char)){quote=char;continue;}
  if(char==='{'){depth++;opened=true;}
  else if(char==='}'&&--depth===0&&opened)return source.slice(start,index+1);
 }
 throw new Error(`Could not extract ${name}`);
}
const functions=['sameContent','dirty','scheduleSave'].map(extract).join('\n');
assert.match(source,/!sameContent\(loadedDraft\.data,data\)\|\|loadedDraft\.assets\?\.length/,'Startup must use the same key-order-insensitive comparison');
const original={hero:{title:'Original'},site:{title:'Lab',email:'lab@example.edu'}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function harness(initial=original){
 const timers=new Map(),operations=[],statuses=[],messages=[];
 let nextTimer=0,stored=structuredClone(initial),queue=Promise.resolve();
 function write(kind,payload){
  const gate=deferred(),operation={kind,payload:structuredClone(payload),gate,started:false};operations.push(operation);
  const result=queue.then(async()=>{operation.started=true;await gate.promise;stored=kind==='clear'?null:structuredClone(operation.payload);return stored;});
  queue=result.catch(()=>{});return result;
 }
 const context={data:structuredClone(initial),baseData:structuredClone(original),baseHead:'a'.repeat(40),draftDecision:false,draftTimer:undefined,saveSequence:0,active:[],clone:structuredClone,Date,
  activeAssets:()=>context.active,
  setTimeout(callback,delay){assert.equal(delay,500);const id=++nextTimer;timers.set(id,callback);return id;},
  clearTimeout(id){timers.delete(id);},
  saveLocalDraft:value=>write('save',value),clearLocalDraft:()=>write('clear',null),
  setDraftState:(text,state)=>statuses.push({text,state}),message:(text,error)=>messages.push({text,error})};
 vm.runInNewContext(functions+'\nglobalThis.testAPI={sameContent,dirty,scheduleSave};',context);
 return {context,api:context.testAPI,timers,operations,statuses,messages,get stored(){return stored;},
  fire(){const [id,callback]=timers.entries().next().value;timers.delete(id);return callback();}};
}

{
 const h=harness();
 const reordered={site:{email:'lab@example.edu',title:'Lab'},hero:{title:'Original'}};
 assert(h.api.sameContent(original,reordered));h.context.data=reordered;assert.equal(h.api.dirty(),false);
 assert.equal(h.api.sameContent({items:[1,2]},{items:[2,1]}),false);
 assert.equal(h.api.sameContent({a:{text:'One'}},{a:{text:'Two'}}),false);
}
{
 const edited=structuredClone(original);edited.hero.title='Edited';const h=harness(edited);
 h.api.scheduleSave();const cancelled=[...h.timers.values()][0];
 h.context.data=structuredClone(original);h.api.scheduleSave();
 assert.equal(h.api.dirty(),false);assert.equal(h.timers.size,0);
 assert.equal(h.operations.length,1);assert.equal(h.operations[0].kind,'clear','Clean Undo must clear immediately, without another 500ms timer');
 await cancelled();assert.equal(h.operations.length,1,'A superseded timer must never persist a clean or stale draft');
 h.operations[0].gate.resolve();await tick();assert.equal(h.stored,null);assert.equal(h.statuses.at(-1).text,'최신 게시본');
}
{
 const edited=structuredClone(original);edited.hero.title='Edited';const h=harness(edited);
 h.api.scheduleSave();const oldSave=h.fire();await tick();assert(h.operations[0].started);
 h.context.data=structuredClone(original);h.api.scheduleSave();
 assert.deepEqual(h.operations.map(operation=>operation.kind),['save','clear']);assert.equal(h.operations[1].started,false);
 h.operations[0].gate.resolve();await oldSave;await tick();
 assert.equal(h.statuses.at(-1).text,'초안 정리 중…','An old successful save must not overwrite the latest clear status');
 h.operations[1].gate.resolve();await tick();assert.equal(h.stored,null);
}
{
 const edited=structuredClone(original);edited.hero.title='Edited';const h=harness(edited);
 h.api.scheduleSave();const oldSave=h.fire();await tick();
 h.context.data=structuredClone(original);h.api.scheduleSave();h.operations[0].gate.reject(new Error('Old write failed'));
 await oldSave;await tick();assert.equal(h.messages.length,0,'A stale save failure must not replace the latest status with an error');
 h.operations[1].gate.resolve();await tick();assert.equal(h.stored,null);assert.equal(h.statuses.at(-1).text,'최신 게시본');
}
{
 const h=harness();h.api.scheduleSave();await tick();
 h.context.data.hero.title='New edit';h.api.scheduleSave();const save=h.fire();
 h.operations[0].gate.resolve();await tick();assert.equal(h.statuses.at(-1).text,'초안 저장 중…','An older clear must not mark a newer edit as clean');
 h.operations[1].gate.resolve();await save;assert.equal(h.stored.data.hero.title,'New edit');assert.equal(h.statuses.at(-1).text,'이 브라우저에 초안 저장됨');
}
{
 const edited=structuredClone(original);edited.hero.title='Edited';const h=harness(edited);
 h.api.scheduleSave();const save=h.fire();await tick();h.operations[0].gate.reject(new Error('Quota exceeded'));await save;
 assert.equal(h.statuses.at(-1).state,'error');assert.equal(h.messages.at(-1).text,'Quota exceeded');
}
{
 const edited=structuredClone(original);edited.hero.title='Just published';const h=harness(edited);
 h.api.scheduleSave();h.context.baseData=structuredClone(edited);await h.fire();
 assert.deepEqual(h.operations.map(operation=>operation.kind),['clear'],'A pending timer must not recreate a clean draft after publication');
 h.operations[0].gate.resolve();await tick();assert.equal(h.stored,null);
}
console.log('Visual draft flow passed: deep comparison, immediate clean clear, cancelled timer guard, ordered save/clear, stale-status suppression and current failure reporting.');
