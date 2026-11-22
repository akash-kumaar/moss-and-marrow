import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const generated = 'C:/Users/akash/.codex/generated_images/01a1add1-5434-7122-a7ef-f2ccb1c432e5';
const sheets = [
  'exec-659a155d-a9ae-4ecb-9cd6-3a69004edc3b.png',
  'exec-f1f0596d-c224-4519-a04c-43dadaccd81c.png',
  'exec-2c0b5063-5fdf-47a2-9e0e-14edecfc5ad7.png',
  'exec-dab23f74-d96e-403d-8a56-2ed661b5672b.png',
  'exec-a78f9ed0-27fa-4e1b-9683-faecf343f3df.png',
].map(file => path.join(generated, file));
const products = [
  ['Double Espresso','coffee',0,0],['Americano','coffee',0,1],['Cortado','coffee',0,2],['Cappuccino','coffee',0,3],['Flat White','coffee',0,4],['Café Latte','coffee',0,5],['Spanish Latte','coffee',0,6],['Dark Chocolate Mocha','coffee',0,7],['Bengaluru Filter Kaapi','coffee',0,8],['Single-Origin Pour Over','coffee',0,9],
  ['Iced Americano','cold-drinks',0,10],['Iced Latte','cold-drinks',0,11],
  ['Classic Cold Brew','cold-drinks',1,0],['Vietnamese Iced Coffee','cold-drinks',1,1],['Espresso Tonic','cold-drinks',1,2],['Iced Matcha Latte','cold-drinks',1,3],['Dark Hot Chocolate','cold-drinks',1,4],['Peach Iced Tea','cold-drinks',1,5],
  ['Butter Croissant','brunch',4,4],['Almond Croissant','brunch',1,6],['Buttermilk Berry Pancakes','brunch',1,7],['Brioche French Toast','brunch',1,8],['Avocado & Feta Sourdough Toast','brunch',1,9],['Classic Eggs Benedict','brunch',1,10],['Mediterranean Shakshuka','brunch',1,11],['Mushroom & Cheese Omelette','brunch',2,0],
  ['Garlic & Herb Bread','starters',2,1],['Tomato & Mozzarella Bruschetta','starters',2,2],['Truffle Parmesan Fries','starters',2,3],['Crispy Chicken Tenders','starters',2,4],
  ['Classic Tomato Basil Soup','soups',2,5],['Creamy Mushroom & Thyme Soup','soups',2,6],
  ['Classic Caesar Salad','salads',2,7],['Grilled Chicken Caesar Salad','salads',2,8],['Roasted Beetroot & Feta Salad','salads',2,9],
  ['Grilled Vegetable Pesto Panini','sandwiches',2,10],['Chicken Pesto Ciabatta','sandwiches',2,11],
  ['Classic House Cheeseburger','burgers',3,0],['Crispy Chicken Burger','burgers',3,1],
  ['Penne Arrabbiata','mains',3,2],['Creamy Mushroom Alfredo','mains',3,3],['Wild Mushroom Risotto','mains',3,4],['Vegetable Lasagna','mains',3,5],['Grilled Chicken Herb Steak','mains',3,6],['Classic Fish & Chips','mains',3,7],
  ['Roasted Pumpkin & Sage Risotto','mains',3,8],['Lemon Herb Roast Chicken','mains',3,9],['Baked Tomato & Mozzarella','mains',3,10],
  ['Classic Tiramisu','desserts',4,0],['Warm Chocolate Brownie & Vanilla Ice Cream','desserts',4,1],['Basque Cheesecake','desserts',4,2],['Lemon Tart','desserts',4,3],
];
const slugify = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
const imageRoot = path.resolve('../frontend/public/images/menu');
const report = [];

for (const [name, folder, sheetIndex, tileIndex] of products) {
  const slug = slugify(name);
  const { width, height } = await sharp(sheets[sheetIndex]).metadata();
  const col = tileIndex % 4;
  const row = Math.floor(tileIndex / 4);
  const tileWidth = Math.floor(width / 4);
  const tileHeight = Math.floor(height / 3);
  const crop = { left: col * tileWidth + 5, top: row * tileHeight + 5, width: tileWidth - 10, height: tileHeight - 10 };
  const relative = `/images/menu/${folder}/${slug}.webp`;
  const destination = path.join(imageRoot, folder, `${slug}.webp`);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const source = sharp(sheets[sheetIndex]).extract(crop);
  await Promise.all([
    source.clone().resize({ width: 360, height: 300, fit: 'cover' }).webp({ quality: 79 }).toFile(destination.replace('.webp', '-360.webp')),
    source.clone().resize({ width: 720, height: 600, fit: 'cover' }).webp({ quality: 82 }).toFile(destination.replace('.webp', '-720.webp')),
    source.clone().resize({ width: 1200, height: 1000, fit: 'cover' }).webp({ quality: 84 }).toFile(destination),
  ]);
  report.push({ name, slug, filename: relative, source: 'OpenAI image generation', sourceUrl: null, photographer: null, format: 'webp', imageIsIllustrative: true, status: 'generated, cropped, optimized, unique product image' });
}

if (report.length !== 52 || new Set(report.map(item => item.slug)).size !== 52) throw new Error(`Expected 52 unique menu images, got ${report.length}`);
await fs.writeFile(path.resolve('../docs/menu-image-report.json'), JSON.stringify({ createdAt: new Date().toISOString(), count: report.length, items: report, checklist: report.map(({ name, filename, status }) => ({ name, imagePath: filename, status })), missing: [], duplicates: [] }, null, 2) + '\n');
const csv = ['product,image_path,status', ...report.map(({ name, filename, status }) => `"${name.replaceAll('"', '""')}","${filename}","${status}"`)].join('\n') + '\n';
await fs.writeFile(path.resolve('../docs/menu-image-checklist.csv'), csv);
console.log(`Wrote ${report.length} unique menu image sets and the image audit report.`);
