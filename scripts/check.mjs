import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {render,pages,safeURL,postFileName,escapeHTML,sortedPublications} from '../renderer.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=JSON.parse(await readFile(path.join(root,'content/site.json'),'utf8'));
for(const key of ['site','hero','join']) assert(data[key]&&typeof data[key]==='object',`Missing ${key}`);
if(data.hero.image){assert(safeURL(data.hero.image),'Unsafe home image');if(data.hero.image.startsWith('assets/'))await access(path.join(root,data.hero.image));}
if(data.publicationYearGroups!==undefined){
 assert(Array.isArray(data.publicationYearGroups),'publicationYearGroups must be an array');
 for(const period of data.publicationYearGroups)assert(Number.isInteger(period.from)&&Number.isInteger(period.to)&&period.from<=period.to,'Invalid publication year range');
}
if(data.underReview!==undefined)assert(Array.isArray(data.underReview),'underReview must be an array');
const ids=new Set();
for(const key of ['research','publications','news','people',...(data.underReview?['underReview']:[])]){
 assert(Array.isArray(data[key]),`${key} must be an array`);
 for(const item of data[key]){
  assert(item.id&&!ids.has(item.id),`Missing or duplicate id: ${item.id}`);ids.add(item.id);
  assert(item.title||item.name,`Missing title/name: ${item.id}`);
  if(item.url) assert(safeURL(item.url),`Unsafe URL: ${item.id}`);
  for(const field of ['image','icon'])if(item[field]){assert(safeURL(item[field]),`Unsafe ${field}: ${item.id}`);if(item[field].startsWith('assets/'))await access(path.join(root,item[field]));}
  if(key==='underReview'){
   assert(typeof item.authors==='string'&&item.authors.trim(),`Missing manuscript authors: ${item.id}`);
   if(item.labAuthors!==undefined)assert(Array.isArray(item.labAuthors)&&item.labAuthors.every(name=>typeof name==='string'&&name.trim()),`Invalid manuscript lab authors: ${item.id}`);
   for(const [name,personId] of Object.entries(item.authorAliases||{}))assert(item.authors.includes(name)&&data.people.some(person=>person.id===personId),`Invalid manuscript author alias: ${item.id}`);
  }
  if(key==='publications')assert(Number.isInteger(Number(item.year))&&Number(item.year)>=1900,`Invalid year: ${item.id}`);
  if(key==='publications'&&item.image){
   assert(item.imageAlt&&item.imageLabel,`Publication figure description missing: ${item.id}`);
   assert(safeURL(item.imageSource),`Publication figure source missing: ${item.id}`);
   if(item.imageWidth||item.imageHeight)assert(Number(item.imageWidth)>0&&Number(item.imageHeight)>0,`Invalid figure size: ${item.id}`);
  }
  if(key==='news'){
   if(item.excerpt!==undefined)assert(typeof item.excerpt==='string',`Invalid post excerpt: ${item.id}`);
   if(item.facts!==undefined)assert(Array.isArray(item.facts)&&item.facts.every(f=>f&&typeof f.label==='string'&&typeof f.value==='string'),`Invalid news facts: ${item.id}`);
   assert(/^\d{4}-\d{2}(?:-\d{2})?$/.test(item.date),`Invalid date: ${item.id}`);
   assert(/^[a-z0-9][a-z0-9_-]*$/i.test(item.id),`Unsafe post id: ${item.id}`);
   if(item.content){
    assert(Array.isArray(item.content),`Post content must be an array: ${item.id}`);
    for(const block of item.content){
     assert(['paragraph','heading','image','list','quote'].includes(block.type),`Unknown post block: ${item.id}`);
     if(block.type==='image'){
      assert(block.src?.startsWith('assets/')&&safeURL(block.src),`Post image must be local: ${item.id}`);
      await access(path.join(root,block.src));
      if(block.fullSrc){assert(block.fullSrc.startsWith('assets/')&&safeURL(block.fullSrc),`Original post image must be local: ${item.id}`);await access(path.join(root,block.fullSrc));}
      if(block.width||block.height)assert(Number(block.width)>0&&Number(block.height)>0,`Invalid post image size: ${item.id}`);
     }
     if(block.type==='list')assert(Array.isArray(block.items),`Post list must contain items: ${item.id}`);
     for(const run of block.children||[])if(run.url)assert(safeURL(run.url),`Unsafe post link: ${item.id}`);
    }
   }
  }
 }
}
const publicationIds=new Set(data.publications.map(p=>p.id));
const postRouteIds=new Set(data.news.map(post=>post.id));
for(const post of data.news){
 if(post.aliases!==undefined)assert(Array.isArray(post.aliases),`Invalid post aliases: ${post.id}`);
 for(const alias of post.aliases||[]){
  assert(typeof alias==='string'&&/^[a-z0-9][a-z0-9_-]*$/i.test(alias),`Unsafe post alias: ${alias}`);
  assert(!postRouteIds.has(alias),`Duplicate post route: ${alias}`);postRouteIds.add(alias);
 }
}
for(const category of data.research){
 if(category.scope!==undefined)assert(Array.isArray(category.scope)&&category.scope.every(value=>typeof value==='string'&&value.trim()),`Invalid research interests: ${category.id}`);
 for(const id of [...(category.paperIds||[]),...(category.sourcePaperIds||[])])assert(publicationIds.has(id),`Unknown research paper: ${id}`);
 for(const topic of category.topics||[]){
  assert(topic.id&&!ids.has(topic.id),`Duplicate topic id: ${topic.id}`);ids.add(topic.id);
  assert(topic.title,`Missing topic title: ${topic.id}`);
  for(const id of topic.paperIds||[])assert(publicationIds.has(id),`Unknown topic paper: ${id}`);
  if(topic.image){assert(safeURL(topic.image),`Unsafe topic image: ${topic.id}`);if(topic.image.startsWith('assets/'))await access(path.join(root,topic.image));}
  if(topic.detailImages!==undefined)assert(Array.isArray(topic.detailImages),`Invalid detail images: ${topic.id}`);
  if(topic.detailSections!==undefined){
   assert(Array.isArray(topic.detailSections),`Invalid research detail sections: ${topic.id}`);
   for(const section of topic.detailSections){
    assert(section&&typeof section.title==='string'&&typeof section.body==='string'&&Array.isArray(section.images),`Invalid research detail section: ${topic.id}`);
    assert(section.body.trim()||section.images.length,`Empty research detail section: ${topic.id}`);
   }
  }
  const detailFigures=[...(topic.detailImages||[]),...(topic.detailSections||[]).flatMap(section=>section.images)];
  for(const image of detailFigures){
    assert(image&&safeURL(image.src),`Unsafe detail image: ${topic.id}`);
    if(image.src.startsWith('assets/'))await access(path.join(root,image.src));
    if(image.fullSrc){assert(safeURL(image.fullSrc),`Unsafe original detail image: ${topic.id}`);if(image.fullSrc.startsWith('assets/'))await access(path.join(root,image.fullSrc));}
    assert(typeof image.alt==='string'&&image.alt.trim(),`Missing detail image description: ${topic.id}`);
    if(image.width||image.height)assert(Number(image.width)>0&&Number(image.height)>0,`Invalid detail image size: ${topic.id}`);
  }
  if(topic.schematic){assert(safeURL(topic.schematic),`Unsafe schematic: ${topic.id}`);if(topic.schematic.startsWith('assets/'))await access(path.join(root,topic.schematic));assert(topic.schematicAlt,`Schematic description missing: ${topic.id}`);}
  if(topic.schematicWidth||topic.schematicHeight)assert(Number(topic.schematicWidth)>0&&Number(topic.schematicHeight)>0,`Invalid schematic size: ${topic.id}`);
  if(topic.focus!==undefined)assert(Array.isArray(topic.focus)&&topic.focus.every(value=>typeof value==='string'&&value.trim()),`Invalid research focus: ${topic.id}`);
 }
}
for(const page of [...pages,...data.news.map(n=>'post-'+n.id)]){const html=render(data,page);assert.equal((html.match(/<h1\b/g)||[]).length,1,`${page}: one h1 required`);assert(html.includes('id="main"'),`${page}: main missing`);}
const citations=[...render(data,'publications').matchAll(/<p class="pub-journal">(.*?)<\/p>/g)].map(match=>match[1].replace(/<[^>]+>/g,''));
assert.deepEqual(citations,sortedPublications(data).map(p=>escapeHTML(p.journal)),'Citation formatting must preserve every journal, volume, page and year');
for(const post of data.news){
 const archive=post.category==='Activities'?'activities':'news';
 assert(render(data,archive).includes(`href="${postFileName(post)}"`),`Post link missing: ${post.id}`);
 assert(!render(data,'post-'+post.id).includes('href="https://baahyyjuu.wixsite.com/'),`Post navigates to Wix: ${post.id}`);
}
assert(!safeURL('javascript:alert(1)'));assert(!safeURL('assets/../../secret'));
const injected=structuredClone(data);injected.people[0].name='<img src=x onerror=alert(1)>';assert(!render(injected,'people').includes('<img src=x'));
injected.news[0].content=[{type:'paragraph',children:[{text:'<script>alert(1)</script>',url:'javascript:alert(1)'}]}];
const injectedPost=render(injected,'post-'+injected.news[0].id);assert(!injectedPost.includes('<script>alert'));assert(!injectedPost.includes('href="javascript:'));
console.log(`Content integrity passed: ${data.publications.length} publications, ${data.people.length} people, ${pages.length} pages + ${data.news.length} posts. Local images, post routes and safe rendering verified.`);
