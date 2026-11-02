import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {render,pages,escapeHTML,pageTitle,postFileName,findPost} from '../renderer.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=JSON.parse(await readFile(path.join(root,'content/site.json'),'utf8'));
const stylesheetVersion=createHash('sha256').update(await readFile(path.join(root,'styles.css'))).digest('hex').slice(0,12);
const rendererVersion=createHash('sha256').update(await readFile(path.join(root,'renderer.js'))).digest('hex').slice(0,12);
const appSource=(await readFile(path.join(root,'app.js'),'utf8')).replaceAll("'./renderer.js'",`'./renderer.js?v=${rendererVersion}'`);
const appVersion=createHash('sha256').update(appSource).update(await readFile(path.join(root,'content/site.json'))).digest('hex').slice(0,12);
const template=(await readFile(path.join(root,'template.html'),'utf8'))
 .replace('href="styles.css"',`href="styles.css?v=${stylesheetVersion}"`)
 .replace('src="app.js"',`src="app.js?v=${appVersion}"`);
const output=path.join(root,'dist');
await mkdir(output,{recursive:true});
const allPages=[...pages,...data.news.map(n=>'post-'+n.id)];
for(const page of allPages){
 const title=pageTitle(data,page),post=findPost(data,page),description=post?(post.body||post.summary||post.title):data.site.description;
 let html=template.replaceAll('%%TITLE%%',escapeHTML(title)).replaceAll('%%DESCRIPTION%%',escapeHTML(description)).replaceAll('%%PAGE%%',page).replace('%%CONTENT%%',render(data,page));
 if(post)html=html.replace('property="og:type" content="website"','property="og:type" content="article"');
 await writeFile(path.join(output,post?postFileName(post):page+'.html'),html);
}
for(const post of data.news){
 for(const alias of post.aliases||[]){
  const target=postFileName(post),title=escapeHTML(post.title);
  await writeFile(path.join(output,postFileName({id:alias})),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="0;url=${target}"><link rel="canonical" href="${target}"><title>${title}</title><p>This post has been combined with the event record.</p><p><a href="${target}">${title}</a></p></html>`);
 }
}
for(const item of ['styles.css','app.js','renderer.js','assets','content','admin']) await cp(path.join(root,item),path.join(output,item),{recursive:true});
await writeFile(path.join(output,'app.js'),appSource);
const guide=await readFile(path.join(root,'관리안내.md'),'utf8');
const inline=s=>escapeHTML(s).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
let list='',guideHTML='';
for(const line of guide.split(/\r?\n/)){
 const heading=line.match(/^(#{1,3}) (.*)/),ordered=line.match(/^\d+\. (.*)/),bullet=line.match(/^- (.*)/);
 const kind=ordered?'ol':bullet?'ul':'';
 if(list&&kind!==list){guideHTML+=`</${list}>`;list='';}
 if(kind){if(!list){list=kind;guideHTML+=`<${kind}>`;}guideHTML+=`<li>${inline((ordered||bullet)[1])}</li>`;}
 else if(heading){const level=heading[1].length;guideHTML+=`<h${level}>${inline(heading[2])}</h${level}>`;}
 else if(line.trim())guideHTML+=`<p>${inline(line)}</p>`;
}
if(list)guideHTML+=`</${list}>`;
await writeFile(path.join(output,'admin/guide.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>홈페이지 관리 안내 | QMP Lab</title><style>body{font:16px/1.9 system-ui,sans-serif;max-width:830px;margin:40px auto;padding:24px;color:#222222;background:#ffffff}h1,h2,h3{line-height:1.45}h2{margin-top:48px;border-top:1px solid #d9d9d9;padding-top:28px}li{margin-block:13px}a{color:#002e5d}code{background:#eeeeee;padding:2px 5px;overflow-wrap:anywhere}p,li{overflow-wrap:anywhere}</style><a href="./">← 편집기로 돌아가기</a>${guideHTML}</html>`);
await writeFile(path.join(output,'.nojekyll'),'');
await writeFile(path.join(output,'404.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Page not found | QMP Lab</title><style>body{font:18px/1.8 system-ui;max-width:650px;margin:12vh auto;padding:24px;color:#222222;background:#ffffff}a{color:#002e5d}</style><h1>We couldn’t find that page.</h1><p>The page may have moved. Use your browser’s Back button to return to the previous page.</p><p>QMP Lab · Sogang University</p></html>`);
console.log(`Built ${pages.length} pages + ${data.news.length} posts, editor and assets → ${output}`);
