import { useCallback, useEffect, useState } from 'react';
import photoPaths from './menu-photos.json';

const api = import.meta.env.VITE_API_URL || '/api/v1';

// The printed menu remains browsable when the kitchen's live menu is offline.
const sections = [
  ['Coffee & Espresso', 'coffee', [
    ['Double Espresso', 150, 'A precise, syrupy pull with a warm cocoa finish.'],
    ['Americano', 180, 'A double espresso opened with hot water and a long, clear finish.'],
    ['Cortado', 195, 'A short espresso softened with silky steamed milk.'],
    ['Cappuccino', 220, 'Velvety milk and balanced espresso.'],
    ['Flat White', 230, 'A smooth double ristretto beneath fine microfoam.'],
    ['Café Latte', 230, 'Slow espresso and textured milk, served gently.'],
    ['Spanish Latte', 260, 'Sweetened milk and a deeply roasted espresso.'],
    ['Dark Chocolate Mocha', 270, 'Espresso folded through dark chocolate and steamed milk.'],
    ['Bengaluru Filter Kaapi', 160, 'South Indian filter coffee with a rich, slow-brewed body.'],
    ['Single-Origin Pour Over', 290, 'A clear, fragrant cup brewed to bring out the season.'],
  ]],
  ['Cold Coffee & Other Drinks', 'cold-drinks', [
    ['Iced Americano', 190, 'Double espresso over ice, finished with cool water.'],
    ['Iced Latte', 240, 'Espresso and cold milk over ice.'],
    ['Classic Cold Brew', 250, 'Coffee steeped slowly for a mellow, rounded cup.'],
    ['Vietnamese Iced Coffee', 260, 'Strong coffee poured over sweetened condensed milk and ice.'],
    ['Espresso Tonic', 270, 'A bright espresso poured over sparkling tonic and ice.'],
    ['Iced Matcha Latte', 280, 'Stone-ground matcha whisked with cold milk.'],
    ['Dark Hot Chocolate', 250, 'A velvety cup made with deep, dark chocolate.'],
    ['Peach Iced Tea', 190, 'Black tea cooled over ice with ripe peach.'],
  ]],
  ['Breakfast & Brunch', 'brunch', [
    ['Butter Croissant', 180, 'Flaky layers with a soft, buttery centre.'],
    ['Almond Croissant', 230, 'A crisp croissant filled with almond cream and toasted almonds.'],
    ['Buttermilk Berry Pancakes', 310, 'Fluffy pancakes, macerated berries and maple.'],
    ['Brioche French Toast', 340, 'Golden brioche with seasonal fruit and maple.'],
    ['Avocado & Feta Sourdough Toast', 360, 'Charred sourdough, avocado, feta and lemon.'],
    ['Classic Eggs Benedict', 390, 'Poached eggs and hollandaise over toasted brioche.'],
    ['Mediterranean Shakshuka', 360, 'Eggs gently baked in a warmly spiced tomato and pepper sauce.'],
    ['Mushroom & Cheese Omelette', 310, 'Soft folded eggs with sautéed mushrooms and cheese.'],
  ]],
  ['Small Plates', 'starters', [
    ['Garlic & Herb Bread', 220, 'Warm, toasted bread brushed with garlic and garden herbs.'],
    ['Tomato & Mozzarella Bruschetta', 290, 'Grilled bread with ripe tomato, mozzarella and basil.'],
    ['Truffle Parmesan Fries', 280, 'Crisp fries, truffle salt and aged Parmesan.'],
    ['Crispy Chicken Tenders', 340, 'Golden tender chicken with a house dipping sauce.'],
  ]],
  ['Soups', 'soups', [
    ['Classic Tomato Basil Soup', 230, 'Slow-cooked tomato with fresh basil.'],
    ['Creamy Mushroom & Thyme Soup', 250, 'Earthy mushrooms and thyme in a delicate cream soup.'],
  ]],
  ['Salads', 'salads', [
    ['Classic Caesar Salad', 340, 'Crisp leaves, shaved Parmesan and house Caesar dressing.'],
    ['Grilled Chicken Caesar Salad', 410, 'Grilled chicken with crisp leaves and Caesar dressing.'],
    ['Roasted Beetroot & Feta Salad', 360, 'Sweet roasted beetroot, feta and tender leaves.'],
  ]],
  ['Sandwiches & Burgers', 'burgers', [
    ['Grilled Vegetable Pesto Panini', 340, 'Grilled vegetables, basil pesto and melted cheese.'],
    ['Chicken Pesto Ciabatta', 390, 'Roast chicken, basil pesto and crisp ciabatta.'],
    ['Classic House Cheeseburger', 420, 'Grilled patty, sharp cheese and house pickles.'],
    ['Crispy Chicken Burger', 440, 'Crisp chicken, slaw and a lightly spiced sauce.'],
  ]],
  ['Continental Mains', 'mains', [
    ['Penne Arrabbiata', 360, 'Slow-cooked tomato, garlic, chilli and basil.'],
    ['Creamy Mushroom Alfredo', 410, 'Pasta with woodland mushrooms in a silky Parmesan sauce.'],
    ['Wild Mushroom Risotto', 460, 'Arborio rice, woodland mushrooms and Parmesan.'],
    ['Vegetable Lasagna', 430, 'Layered pasta, roasted vegetables and slow tomato.'],
    ['Grilled Chicken Herb Steak', 520, 'Grilled chicken with herbs and seasonal accompaniments.'],
    ['Classic Fish & Chips', 490, 'Golden battered fish with crisp chips and tartar sauce.'],
  ]],
  ['Chef’s Specials', 'mains', [
    ['Roasted Pumpkin & Sage Risotto', 440, 'Creamy arborio with roasted pumpkin and fragrant sage.'],
    ['Lemon Herb Roast Chicken', 520, 'Roast chicken finished with lemon, herbs and pan jus.'],
    ['Baked Tomato & Mozzarella', 390, 'Slow baked tomato, mozzarella and herbs with toasted bread.'],
  ]],
  ['Desserts', 'desserts', [
    ['Classic Tiramisu', 320, 'Mascarpone, espresso and a dusting of cocoa.'],
    ['Warm Chocolate Brownie & Vanilla Ice Cream', 290, 'Warm dark chocolate brownie with vanilla ice cream.'],
    ['Basque Cheesecake', 350, 'A burnished edge and a creamy centre.'],
    ['Lemon Tart', 310, 'Bright lemon curd in a crisp, buttery shell.'],
  ]],
];

const folders = { coffee: 'coffee', 'cold-drinks': 'cold-drinks', brunch: 'brunch', starters: 'starters', soups: 'soups', salads: 'salads', burgers: 'sandwiches', mains: 'mains', desserts: 'desserts' };
const imageBySlug = new Map(photoPaths.map(path => [path.split('/').at(-1).slice(0, -5), path]));

export const printedMenu = sections.flatMap(([category, folder, dishes]) =>
  dishes.map(([name, price, description]) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
    const path = imageBySlug.get(slug) || `/images/menu/${folder}/${slug}.webp`;
    return { name, price, category, description, slug, image: path };
  })
);

const localImages = new Map(printedMenu.map(item => [item.slug, item.image]));
const descriptions = new Map(printedMenu.map(item => [item.slug, item.description]));
descriptions.set('americano', 'Espresso lengthened with hot water.');
descriptions.set('classic-eggs-benedict', 'Poached eggs finished with hollandaise.');
for (const [slug, folder] of [['americano', 'coffee'], ['classic-eggs-benedict', 'brunch']]) {
  localImages.set(slug, `/images/menu/${folder}/${slug}.webp`);
}

export function normalizeDish(item) {
  const slug = item.slug === 'avocado-&-feta-sourdough-toast' ? 'avocado-feta-sourdough-toast' : item.slug;
  const legacy = !item.image || item.image === '/images/editorial/moss-marrow-scenes.png' ||
    item.image === '/images/menu/undefined/avocado-&-feta-sourdough-toast.webp';
  const usePrintedDescription = !item.description || item.description === 'A thoughtfully prepared Moss & Marrow favourite.';
  return {
    ...item,
    slug,
    description: usePrintedDescription ? descriptions.get(slug) || item.description : item.description,
    image: legacy || imageBySlug.has(slug) ? localImages.get(slug) : item.image,
  };
}

export function useCatalog() {
  const [items, setItems] = useState(printedMenu);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 8000);
    setLoading(true);
    setError('');
    async function readMenu() {
      try {
        const response = await fetch(`${api.replace(/\/$/, '')}/menu`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const body = await response.json();
        if (!Array.isArray(body.data)) throw new Error();
        if (active) setItems(body.data.map(normalizeDish));
      } catch {
        if (active) setError('Live availability is unavailable. You can still browse the menu.');
      } finally {
        clearTimeout(timeout);
        if (active) setLoading(false);
      }
    }
    readMenu();
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);
  return { items, loading, error, retry };
}

export function availableAt(item, branch) {
  if (item.isAvailable === false) return false;
  const status = item.branchAvailability?.find(entry => entry.branch?.toLowerCase() === branch);
  return status?.isAvailable !== false;
}

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2,
});
export const priceText = value => currency.format(value);
