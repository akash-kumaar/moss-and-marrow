import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import MenuItem from '../models/MenuItem.js';
import { menuImageQueries } from './menuImageQueries.js';

const rows = [
  ['Double Espresso', 150, 'Coffee & Espresso'],
  ['Americano', 180, 'Coffee & Espresso'],
  ['Cappuccino', 220, 'Coffee & Espresso'],
  ['Spanish Latte', 260, 'Coffee & Espresso'],
  ['Butter Croissant', 180, 'Breakfast & Brunch'],
  ['Buttermilk Berry Pancakes', 310, 'Breakfast & Brunch'],
  ['Classic Eggs Benedict', 390, 'Breakfast & Brunch'],
  ['Truffle Parmesan Fries', 280, 'Small Plates & Soups'],
  ['Classic House Cheeseburger', 420, 'Sandwiches & Burgers'],
  ['Penne Arrabbiata', 360, 'Continental Mains'],
  ['Wild Mushroom Risotto', 460, 'Continental Mains'],
  ['Classic Tiramisu', 320, 'Desserts'],
  ['Basque Cheesecake', 350, 'Desserts'],
  ['Avocado & Feta Sourdough Toast', 360, 'Breakfast & Brunch'],
];

const versioned = new Set(['penne-arrabbiata', 'avocado-feta-sourdough-toast']);
const generated = new Set([...versioned, 'double-espresso', 'spanish-latte', 'butter-croissant', 'truffle-parmesan-fries']);

async function photoReport() {
  try {
    const content = await readFile(new URL('../../../docs/menu-image-report.json', import.meta.url), 'utf8');
    return new Map(JSON.parse(content).items.map(entry => [entry.slug, entry]));
  } catch (error) {
    // The production backend image contains only the backend build context.
    if (error.code === 'ENOENT') return new Map();
    throw error;
  }
}

const report = await photoReport();
const operations = [];
for (const [displayOrder, [name, price, category]] of rows.entries()) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const folder = menuImageQueries[slug].folder;
  const base = `/images/menu/${folder}/${slug}`;
  const entry = report.get(slug);
  const image = entry?.filename || `${base}${versioned.has(slug) ? '-v2' : ''}.webp`;
  const illustrative = entry ? entry.source === 'OpenAI image generation' : generated.has(slug);
  const photo = {
    image,
    imageFormat: 'webp',
    imageSource: entry?.source || (illustrative ? 'OpenAI image generation' : 'Pixabay'),
    imageSourceUrl: entry?.sourceUrl ?? null,
    imagePhotographer: entry?.photographer ?? null,
    imageAttribution: illustrative ? 'AI-generated menu illustration' : entry?.photographer ? `Photo by ${entry.photographer} via Pixabay` : 'Pixabay',
    imageIsIllustrative: illustrative,
  };
  const now = new Date();
  operations.push({ updateOne: {
    filter: { slug },
    update: { $setOnInsert: {
      name, price, category, slug, displayOrder, isAvailable: true, isFeatured: displayOrder < 6,
      createdAt: now, updatedAt: now, ...photo,
    } },
    upsert: true,
    timestamps: false,
  } });
  if (versioned.has(slug)) {
    operations.push({ updateOne: {
      filter: { slug, image: { $in: [`${base}.webp`, '/images/editorial/moss-marrow-scenes.png', null] } },
      update: { $set: photo },
    } });
  }
}

try {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/moss_and_marrow');
  const { upsertedCount, modifiedCount } = await MenuItem.bulkWrite(operations);
  console.log(`Added ${upsertedCount} menu items and refreshed ${modifiedCount} bundled images.`);
} finally {
  await mongoose.disconnect();
}
