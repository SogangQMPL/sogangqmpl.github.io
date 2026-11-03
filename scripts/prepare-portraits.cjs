/*
 * Prepare responsive portraits from the original Wix files recorded in
 * docs/원본자료.json. Requires sharp; no project dependency is added.
 *
 *   node scripts/prepare-portraits.cjs [original-directory]
 *
 * If sharp is available outside this project, set SHARP_MODULE to its module
 * directory. The original-directory defaults to ../portrait-work/originals,
 * relative to the repository. Missing originals are fetched into that cache.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

let sharp;
try {
  sharp = require(process.env.SHARP_MODULE || 'sharp');
} catch (error) {
  console.error('This script needs sharp. Set SHARP_MODULE to an existing sharp module directory, or make sharp available to Node.');
  process.exit(1);
}

const repository = path.resolve(__dirname, '..');
const originalDirectory = path.resolve(repository, process.argv[2] || '../portrait-work/originals');
const displayDirectory = path.join(repository, 'assets', 'people', 'display');
const auditPath = path.join(repository, 'docs', 'portrait-display-sources.json');
const studentWidths = [112, 120, 128, 140, 150, 160, 168, 180, 192, 224, 240, 256, 336, 360, 384];
const professorWidths = [140, 160, 175, 200, 210, 240, 280, 320];
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const relative = file => path.relative(repository, file).split(path.sep).join('/');

// Equivalent to object-fit:cover in a 4:5 frame with object-position:center 25%.
// Extraction coordinates use whole source pixels, so half-pixel crop edges are
// rounded to the nearest pixel before the single antialiased resize.
function portraitCrop(width, height) {
  const cropWidth = Math.min(width, Math.round(height * 4 / 5));
  const cropHeight = Math.min(height, Math.round(width * 5 / 4));
  return {
    left: Math.round((width - cropWidth) * 0.5),
    top: Math.round((height - cropHeight) * 0.25),
    width: cropWidth,
    height: cropHeight,
  };
}

async function getOriginal(person, slug) {
  const url = new URL(person.image);
  if (url.protocol !== 'https:' || url.hostname !== 'static.wixstatic.com') {
    throw new Error(`Unexpected original source for ${person.name}: ${person.image}`);
  }
  const extension = path.extname(url.pathname).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) {
    throw new Error(`Unsupported original image extension for ${person.name}`);
  }
  const cacheFile = path.join(originalDirectory, `${slug}${extension}`);
  try {
    return { bytes: await fs.readFile(cacheFile), cacheFile };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Original fetch failed (${response.status}): ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await sharp(bytes).metadata();
  await fs.mkdir(originalDirectory, { recursive: true });
  await fs.writeFile(cacheFile, bytes);
  return { bytes, cacheFile };
}

(async () => {
  const sources = JSON.parse(await fs.readFile(path.join(repository, 'docs', '원본자료.json'), 'utf8'));
  await fs.mkdir(displayDirectory, { recursive: true });
  const portraits = [];
  for (const person of sources.people) {
    const slug = path.basename(person.localImage, path.extname(person.localImage));
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Invalid portrait slug: ${slug}`);
    const original = await getOriginal(person, slug);
    const metadata = await sharp(original.bytes).metadata();

    // Decode the full source before resizing. This avoids JPEG decoder thumbnail
    // shortcuts and avoids a second reduction of an existing Wix thumbnail.
    const decoded = await sharp(original.bytes).rotate().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
    const crop = portraitCrop(decoded.info.width, decoded.info.height);
    const professor = person.role === 'Principal Investigator';
    const requestedWidths = professor ? professorWidths : studentWidths;
    const widths = requestedWidths.filter(width => width <= crop.width && Math.round(width * 5 / 4) <= crop.height);
    if (!widths.length) throw new Error(`Original is too small for the requested portrait sizes: ${slug}`);
    const variants = [];
    for (const width of widths) {
      const height = Math.round(width * 5 / 4);
      const filename = `${slug}-${width}.webp`;
      const output = await sharp(decoded.data, { raw: { width: decoded.info.width, height: decoded.info.height, channels: decoded.info.channels } })
        .extract(crop)
        .resize(width, height, { fit: 'fill', kernel: 'lanczos3', withoutEnlargement: true, fastShrinkOnLoad: false })
        .webp({ lossless: true, effort: 6 })
        .toBuffer();
      const outputPath = path.join(displayDirectory, filename);
      await fs.writeFile(outputPath, output);
      variants.push({ path: relative(outputPath), width, height, bytes: output.length, sha256: sha256(output) });
    }
    const record = {
      name: person.name,
      slug,
      role: person.role,
      source: {
        url: person.image,
        recordedIn: 'docs/원본자료.json',
        cacheFile: relative(original.cacheFile),
        bytes: original.bytes.length,
        sha256: sha256(original.bytes),
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        orientation: metadata.orientation || 1,
      },
      crop,
      widths,
      omittedWidthsAboveNativeResolution: requestedWidths.filter(width => !widths.includes(width)),
      totalVariantBytes: variants.reduce((sum, item) => sum + item.bytes, 0),
      variants,
    };
    portraits.push(record);
    console.log(`${slug}: ${widths.join(', ')} (${record.totalVariantBytes} bytes)`);
  }
  const audit = {
    sourceRoster: 'docs/원본자료.json#people',
    generator: 'scripts/prepare-portraits.cjs',
    recipe: {
      source: 'Recorded Wix originals; fully decoded before extraction and resizing',
      crop: '4:5 object-fit:cover; horizontal center; vertical 25%; source coordinates rounded to nearest pixel',
      color: 'EXIF orientation applied; sRGB output',
      resize: 'One Lanczos3 reduction from the cropped original; no enlargement',
      outputHeight: 'round(width * 5 / 4)',
      encoding: { format: 'webp', lossless: true, effort: 6 },
      imageAdjustments: 'None: no blur, masks, sharpening, face edits, or generative processing',
    },
    requestedWidths: { students: studentWidths, professor: professorWidths },
    tools: { sharp: sharp.versions.sharp, libvips: sharp.versions.vips, webp: sharp.versions.webp },
    summary: {
      portraits: portraits.length,
      variants: portraits.reduce((sum, person) => sum + person.variants.length, 0),
      sourceBytes: portraits.reduce((sum, person) => sum + person.source.bytes, 0),
      outputBytes: portraits.reduce((sum, person) => sum + person.totalVariantBytes, 0),
    },
    portraits,
  };
  await fs.writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  console.log(`Prepared ${audit.summary.variants} lossless WebP variants for ${audit.summary.portraits} portraits (${audit.summary.outputBytes} bytes).`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
