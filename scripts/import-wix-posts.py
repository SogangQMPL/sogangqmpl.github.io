"""Import the public lab's Wix archive without rewriting its text or photographs.

Requires Python, beautifulsoup4 and Pillow. Run deliberately; it only replaces
the `news` field of content/site.json and records source provenance in docs.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import re
import urllib.request
import xml.etree.ElementTree as ET

from bs4 import BeautifulSoup, NavigableString
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://baahyyjuu.wixsite.com/hyeonjun/'
MEDIA = 'https://static.wixstatic.com/media/'


def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read()


def soup_for(url):
    return BeautifulSoup(fetch(url), 'html.parser', from_encoding='utf-8')


def original_image(image, identifier, ordinal):
    wow = image.find_parent('wow-image')
    info = json.loads(wow.get('data-image-info', '{}')) if wow else {}
    uri = info.get('imageData', {}).get('uri')
    if not uri:
        match = re.search(r'/media/([^/]+)', image.get('src', ''))
        if not match:
            raise ValueError('Cannot resolve original image: ' + str(image))
        uri = match.group(1)
    url = MEDIA + uri
    binary = fetch(url)
    extension = Path(uri).suffix.lower()
    relative = f'assets/posts/{identifier}-{ordinal}{extension}'
    path = ROOT / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(binary)
    with Image.open(BytesIO(binary)) as photo:
        width, height = photo.size
        encoded_width, encoded_height = photo.size
        orientation = photo.getexif().get(274, 1)
        if orientation in [5, 6, 7, 8]:
            width, height = height, width
    block = {'type': 'image', 'src': relative, 'alt': image.get('alt', ''),
             'width': width, 'height': height}
    audit = {'source': url, 'file': relative, 'width': width, 'height': height,
             'encodedWidth': encoded_width, 'encodedHeight': encoded_height,
             'exifOrientation': orientation,
             'bytes': len(binary), 'sha256': sha256(binary).hexdigest()}
    # Ask Wix's image service for an uncropped, aspect-preserving display copy.
    # The full-resolution source bytes above are retained without alteration.
    display_url = url + '/v1/fit/w_1600,h_1600,q_85/preview.webp'
    display_bytes = fetch(display_url)
    display_path = f'assets/posts/{identifier}-{ordinal}-display.webp'
    with Image.open(BytesIO(display_bytes)) as display:
        if display.format != 'WEBP':
            raise ValueError('Unexpected image format from Wix image service.')
        display_width, display_height = display.size
    (ROOT / display_path).write_bytes(display_bytes)
    block.update(src=display_path, fullSrc=relative,
                 width=display_width, height=display_height)
    audit.update(displaySource=display_url, displayFile=display_path,
                 displayWidth=display_width, displayHeight=display_height,
                 displayBytes=len(display_bytes),
                 displaySha256=sha256(display_bytes).hexdigest())
    return block, audit


def inline_children(element):
    children = []
    for string in element.descendants:
        if not isinstance(string, NavigableString):
            continue
        text = str(string)
        if not text:
            continue
        run = {'text': text}
        parents = list(string.parents)
        if any(p.name in ['strong', 'b'] for p in parents):
            run['bold'] = True
        if any(p.name in ['em', 'i'] for p in parents):
            run['italic'] = True
        anchor = next((p for p in parents if p.name == 'a'), None)
        if anchor and anchor.get('href'):
            run['url'] = anchor['href']
        if children and {k: v for k, v in children[-1].items() if k != 'text'} == {k: v for k, v in run.items() if k != 'text'}:
            children[-1]['text'] += text
        else:
            children.append(run)
    return children


def import_post(item):
    soup = soup_for(item['url'])
    ld = next(json.loads(x.text) for x in soup.select('script[type="application/ld+json"]')
              if json.loads(x.text).get('@type') == 'BlogPosting')
    section = soup.select_one('[data-hook="post-description"]')
    if section is None:
        raise ValueError('Missing post content: ' + item['url'])
    elements = section.select('figure[data-hook="figure-IMAGE"], p[data-ricos-paragraph], h1, h2, h3, h4, h5, h6, ul, ol, blockquote')
    blocks, images, ordinal = [], [], 0
    for element in elements:
        if element.name == 'figure':
            for img in element.select('img'):
                ordinal += 1
                block, audit = original_image(img, item['id'], ordinal)
                block['alt'] = block['alt'] or ld['headline']
                caption = element.select_one('figcaption')
                if caption and caption.get_text(strip=True):
                    block['caption'] = caption.get_text(' ', strip=True)
                blocks.append(block)
                images.append(audit)
        elif element.find_parent(['ul', 'ol', 'blockquote']):
            continue
        elif element.get_text(strip=True):
            if element.name in ['ul', 'ol']:
                blocks.append({'type': 'list', 'ordered': element.name == 'ol',
                               'items': [x.get_text(' ', strip=True) for x in element.select('li')]})
            else:
                kind = 'quote' if element.name == 'blockquote' else 'heading' if element.name.startswith('h') else 'paragraph'
                blocks.append({'type': kind, 'text': element.get_text('', strip=False),
                               'children': inline_children(element)})
    # A future archive change must fail explicitly rather than silently drop images.
    content_images = section.select('img')
    if len(images) != len(content_images):
        raise ValueError(f"Unmapped image/gallery content in {item['id']}: {len(images)}/{len(content_images)}")
    unknown_media = section.select('video, audio, iframe, [data-hook*="gallery"]')
    if unknown_media:
        raise ValueError('Unmapped embedded media in ' + item['id'])
    text = '\n\n'.join(b['text'] for b in blocks if b.get('text'))
    original_text = '\n\n'.join(p.get_text('', strip=False) for p in section.select('p[data-ricos-paragraph]') if p.get_text(strip=True))
    if text != original_text:
        raise ValueError('Text block mismatch in ' + item['id'])
    result = dict(item, title=ld['headline'], date=ld['datePublished'][:10],
                  body=text, summary=next((b['text'] for b in blocks if b['type'] == 'paragraph'), ''),
                  content=blocks, source=item['url'])
    if images:
        result['image'] = images[0]['displayFile']
        result['imageAlt'] = blocks[0].get('alt', ld['headline'])
    audit = {'id': item['id'], 'url': item['url'], 'title': ld['headline'],
             'datePublished': ld['datePublished'], 'paragraphCount': len([b for b in blocks if b['type'] == 'paragraph']),
             'imageCount': len(images), 'galleryCount': 0,
             'body': text, 'images': images, 'verifiedAllBodyText': True,
             'verifiedAllContentImages': True}
    return result, audit


def main():
    data_path = ROOT / 'content/site.json'
    data = json.loads(data_path.read_text(encoding='utf-8'))
    news = [n for n in data['news'] if n['category'] != 'Activities']
    xml = fetch(BASE + 'blog-posts-sitemap.xml')
    tree = ET.fromstring(xml)
    ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    sitemap_urls = [n.text for n in tree.findall('s:url/s:loc', ns)]
    if set(sitemap_urls) != {n['url'] for n in news}:
        raise ValueError('The sitemap changed: reconcile all posts before import.')
    with ThreadPoolExecutor(max_workers=4) as executor:
        posts = list(executor.map(import_post, news))
    new_news = [p[0] for p in posts]
    audits = [p[1] for p in posts]
    activities = [n for n in data['news'] if n['category'] == 'Activities']
    soup = soup_for(BASE + 'highlights')
    repeater_items = soup.select('.wixui-repeater__item')
    if not repeater_items:
        repeater_items = soup.select('[data-testid="inlineContent"]')
    images = soup.select('main img') or soup.select('img')
    # The public Activities page contains exactly two standalone entries.
    if len(images) != len(activities):
        raise ValueError('Activities image count changed: reconcile before import.')
    for item, image in zip(activities, images):
        image_container = image.find_parent('div', class_='wixui-image')
        suffix = image_container['id'].split('__')[-1]
        texts = [x.get_text(' ', strip=True) for x in soup.select('[data-testid="richTextElement"]') if x.get('id', '').endswith('__' + suffix)]
        if len(texts) != 2:
            raise ValueError('Cannot associate Activities text and image.')
        date_text, title = texts
        y, m, d = re.findall(r'\d+', date_text)
        block, audit = original_image(image, item['id'], 1)
        block['alt'] = title
        new_item = dict(item, title=title, date=f'{int(y):04}-{int(m):02}-{int(d):02}',
                        body='', summary='', content=[block],
                        image=block['src'], imageAlt=title, source=BASE + 'highlights')
        new_news.append(new_item)
        audits.append({'id': item['id'], 'url': BASE + 'highlights', 'title': title,
                       'originalDateText': date_text, 'body': '', 'paragraphCount': 0,
                       'imageCount': 1, 'galleryCount': 0, 'images': [audit],
                       'verifiedAllBodyText': True, 'verifiedAllContentImages': True,
                       'note': 'Original entry contains date, heading and one photograph; no additional body prose.'})
    data['news'] = new_news
    data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    record = {'sourceBlog': BASE + 'blog', 'sourceActivities': BASE + 'highlights',
              'sourceSitemap': BASE + 'blog-posts-sitemap.xml',
              'fetchedAt': datetime.now(timezone.utc).isoformat(),
              'newsCount': len(news), 'activitiesCount': len(activities),
              'imageCount': sum(p['imageCount'] for p in audits),
              'missingPosts': [], 'missingImages': [], 'posts': audits}
    (ROOT / 'docs/게시물-이관-기록.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Imported {len(news)} news and {len(activities)} activities, {record['imageCount']} unchanged original photographs.")


if __name__ == '__main__':
    main()
