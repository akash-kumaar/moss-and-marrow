import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import sharp from 'sharp';
import MenuItem from '../models/MenuItem.js';
import { menuImageQueries } from '../data/menuImageQueries.js';

const [slug, candidateId] = process.argv.slice(2);
if (!slug || !candidateId) throw new Error('Usage: npm run images:approve -- <menu-slug> <candidate-id>');
const docs = new URL('../../../docs/', import.meta.url);
const review = JSON.parse(await fs.readFile(new URL('pixabay-candidates.json', docs), 'utf8'));
const item = review.items.find(row => row.slug === slug);
const candidate = item?.candidates.find(row => String(row.id) === candidateId);
if (!candidate || !menuImageQueries[slug]) throw new Error('Candidate missing from the reviewed menu.');
const folder = menuImageQueries[slug].folder;
const relative = `/images/menu/${folder}/${slug}-pixabay-${candidate.id}.webp`;
const file = fileURLToPath(new URL(`../../../frontend/public${relative}`, import.meta.url));

try {
  await mongoose.connect(process.env.MONGODB_URI);
  if (!await MenuItem.exists({ slug })) throw new Error('Menu item missing from the database.');
  const response = await fetch(candidate.downloadUrl);
  if (!response.ok) throw new Error('Image download failed.');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(await response.arrayBuffer()))
    .resize({ width: 1200, height: 900, fit: 'cover', withoutEnlargement: true })
    .webp({ quality: 82 }).toFile(file);
  const updated = await MenuItem.updateOne({ slug }, { $set: {
    image: relative, imageSource: 'Pixabay', imageSourceUrl: candidate.pageUrl,
    imagePhotographer: candidate.photographer, imageAttribution: `Photo by ${candidate.photographer} via Pixabay`,
    imageFormat: 'webp', imageIsIllustrative: false,
  } });
  if (!updated.matchedCount) throw new Error('Menu item missing during approval.');
  const reportFile = new URL('menu-image-report.json', docs);
  const report = JSON.parse(await fs.readFile(reportFile, 'utf8'));
  const selected = {
    slug, name: item.name, filename: relative, source: 'Pixabay', sourceUrl: candidate.pageUrl,
    photographer: candidate.photographer, format: 'webp', selection: `Explicitly approved candidate ${candidate.id}`,
  };
  const index = report.items.findIndex(row => row.slug === slug);
  if (index === -1) report.items.push(selected);
  else report.items[index] = selected;
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
  console.log(`Approved ${relative}`);
} finally {
  await mongoose.disconnect();
}
