import {readFile,writeFile,mkdir,cp,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {render,pages,escapeHTML,pageTitle,postFileName,findPost,safeURL} from '../renderer.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=JSON.parse(await readFile(path.join(root,'content/site.json'),'utf8'));
const stylesheetVersion=createHash('sha256').update(await readFile(path.join(root,'styles.css'))).digest('hex').slice(0,12);
const rendererVersion=createHash('sha256').update(await readFile(path.join(root,'renderer.js'))).digest('hex').slice(0,12);
const appSource=(await readFile(path.join(root,'app.js'),'utf8')).replaceAll("'./renderer.js'",`'./renderer.js?v=${rendererVersion}'`);
const appVersion=createHash('sha256').update(appSource).update(await readFile(path.join(root,'content/site.json'))).digest('hex').slice(0,12);
const template=(await readFile(path.join(root,'template.html'),'utf8'))
 .replace('%%ROOT%%styles.css',`%%ROOT%%styles.css?v=${stylesheetVersion}`)
 .replace('%%ROOT%%app.js',`%%ROOT%%app.js?v=${appVersion}`);
const output=path.join(root,'dist');
const siteURL='https://sogangqmpl.github.io/';
const pageDescriptions={
 research:'Explore quantum information, solid-state physics and semiconductor devices based on two-dimensional materials at Sogang QMPL.',
 people:'Meet Hyeonjun Baek, assistant professor of physics at Sogang University, and see his professional experience and education.',
 students:'Meet the students of the Quantum Materials & Photonics Lab at Sogang University.',
 publications:'Browse papers from the H. Baek Research Group on excitons, quantum light, photonics and semiconductor devices.',
 news:'Read the latest awards and conference presentations from the Quantum Materials & Photonics Lab.',
 activities:'See photos and updates from activities at the Quantum Materials & Photonics Lab.',
 join:'Find recruitment information and contact details for graduate students and undergraduate researchers at Sogang QMPL.',
};
const heroImage=safeURL(data.hero?.image);
const shareCard=!heroImage||heroImage==='assets/lab-overview.webp';
const pageShareImage=shareCard?'assets/lab-share.jpg':heroImage;
const pageShareAlt=shareCard?'Quantum Materials & Photonics Lab, Sogang University, beside the lab’s triangular lattice image.':data.hero?.imageAlt||data.site.title;
await mkdir(output,{recursive:true});
const allPages=[...pages,...data.news.map(n=>'post-'+n.id),'404'];
for(const page of allPages){
 const notFound=page==='404',title=pageTitle(data,page),post=findPost(data,page),description=post?(post.body||post.summary||post.title):notFound?'Page not found.':pageDescriptions[page]||data.site.description;
 let html=template.replaceAll('%%ROOT%%',notFound?'/':'').replaceAll('%%TITLE%%',escapeHTML(title)).replaceAll('%%DESCRIPTION%%',escapeHTML(description)).replaceAll('%%PAGE%%',page).replace('%%CONTENT%%',render(data,page));
 if(notFound)html=html.replace('  <title>','  <meta name="robots" content="noindex">\n  <title>');
 if(post){
  const canonical=new URL(postFileName(post),siteURL).href;
  const photos=(post.content||[]).filter(block=>block.type==='image'&&safeURL(block.src));
  const cover=safeURL(post.image)||safeURL(photos[0]?.src);
  const photo=photos.find(block=>block.src===cover);
  const share=post.shareImage?.source===cover&&safeURL(post.shareImage.src)?post.shareImage:null;
  const tags=[`<meta property="og:type" content="article">`,`<meta property="og:url" content="${escapeHTML(canonical)}">`,`<link rel="canonical" href="${escapeHTML(canonical)}">`];
  if(cover){
   tags.push(`<meta property="og:image" content="${escapeHTML(new URL(share?.src||cover,siteURL).href)}">`);
   tags.push(`<meta property="og:image:alt" content="${escapeHTML(post.imageAlt||photo?.alt||post.title)}">`);
   if(share&&Number.isInteger(share.width)&&Number.isInteger(share.height)){
    tags.push(`<meta property="og:image:width" content="${share.width}">`,`<meta property="og:image:height" content="${share.height}">`);
   }
  }
  html=html.replace('<meta property="og:type" content="website">',tags.join('\n  '));
 }else if(!notFound){
  const canonical=new URL(page==='index'?'':page+'.html',siteURL).href;
  const tags=['<meta property="og:type" content="website">',`<meta property="og:url" content="${escapeHTML(canonical)}">`,`<link rel="canonical" href="${escapeHTML(canonical)}">`,
   `<meta property="og:image" content="${escapeHTML(new URL(pageShareImage,siteURL).href)}">`,`<meta property="og:image:alt" content="${escapeHTML(pageShareAlt)}">`,
   '<meta name="twitter:card" content="summary_large_image">'];
  if(shareCard)tags.push('<meta property="og:image:width" content="1200">','<meta property="og:image:height" content="630">');
  html=html.replace('<meta property="og:type" content="website">',tags.join('\n  '));
 }
 await writeFile(path.join(output,post?postFileName(post):page+'.html'),html);
}
for(const post of data.news){
 for(const alias of post.aliases||[]){
  const target=postFileName(post),title=escapeHTML(post.title);
  await writeFile(path.join(output,postFileName({id:alias})),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="0;url=${target}"><link rel="canonical" href="${target}"><title>${title}</title><p>This post has been combined with the event record.</p><p><a href="${target}">${title}</a></p></html>`);
 }
}
for(const item of ['styles.css','app.js','renderer.js','assets','content','admin']) await cp(path.join(root,item),path.join(output,item),{recursive:true});
const buildSHA=String(process.env.GITHUB_SHA||'').trim().toLowerCase();
const revisionPath=path.join(output,'content/revision.json');
if(/^[a-f0-9]{40}$/.test(buildSHA)){
 const contentSha256=createHash('sha256').update(await readFile(path.join(output,'content/site.json'))).digest('hex');
 await writeFile(revisionPath,JSON.stringify({version:1,sha:buildSHA,contentSha256})+'\n');
}else{
 try{await unlink(revisionPath);}catch(error){if(error.code!=='ENOENT')throw error;}
}
await writeFile(path.join(output,'app.js'),appSource);
const adminEditorVersion=createHash('sha256').update(await readFile(path.join(root,'admin/editor.js'))).digest('hex').slice(0,12);
const adminStyleVersion=createHash('sha256').update(await readFile(path.join(root,'admin/editor.css'))).digest('hex').slice(0,12);
await writeFile(path.join(output,'admin/index.html'),(await readFile(path.join(root,'admin/index.html'),'utf8')).replace('src="editor.js"',`src="editor.js?v=${adminEditorVersion}"`).replace('href="editor.css"',`href="editor.css?v=${adminStyleVersion}"`));
const guide=await readFile(path.join(root,'관리안내.md'),'utf8');
const inline=s=>escapeHTML(s).replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
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
console.log(`Built ${pages.length} pages + ${data.news.length} posts, editor and assets → ${output}`);
