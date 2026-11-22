import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { menuImageQueries } from '../data/menuImageQueries.js';

const records = new URL('../../../docs/menu-image-report.json', import.meta.url);
const candidates = new URL('../../../docs/pixabay-candidates.json', import.meta.url);
const report = JSON.parse(await fs.readFile(records, 'utf8'));
const review = JSON.parse(await fs.readFile(candidates, 'utf8'));
const recorded = new Set(report.items.map(item => item.slug));
let added = 0;

for (const item of review.items) {
  if (recorded.has(item.slug)) continue;
  const candidate = item.candidates[0];
  const spec = menuImageQueries[item.slug];
  if (!candidate || !spec) continue;
  const relative = `/images/menu/${spec.folder}/${item.slug}.webp`;
  const file = path.resolve('../frontend/public', '.' + relative);
  try {
    await fs.access(file);
    continue;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const response = await fetch(candidate.downloadUrl);
  if (!response.ok) throw new Error(`Download failed for ${item.slug}`);
  const pixels = await sharp(Buffer.from(await response.arrayBuffer()))
    .resize({ width: 1200, height: 900, fit: 'cover', withoutEnlargement: true })
    .webp({ quality: 82 }).toBuffer();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, pixels, { flag: 'wx' });
  report.items.push({
    name: item.name, slug: item.slug, filename: relative, source: 'Pixabay',
    sourceUrl: candidate.pageUrl, photographer: candidate.photographer, format: 'webp',
    selection: 'candidate 1 from item-specific Pixabay query',
  });
  recorded.add(item.slug);
  await fs.writeFile(records, JSON.stringify(report, null, 2) + '\n');
  added++;
}

console.log(`Added ${added} new menu photos.`);
