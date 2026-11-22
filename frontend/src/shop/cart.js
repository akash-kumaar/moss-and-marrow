import { useCallback, useEffect, useState } from 'react';

const storageKey = 'moss-marrow.bag.v1';

function restoreBag() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!Array.isArray(saved)) return [];
    return saved.filter(({ item, quantity }) =>
      typeof item?.slug === 'string' && typeof item.name === 'string' &&
      Number.isFinite(item.price) && item.price >= 0 &&
      Number.isSafeInteger(quantity) && quantity > 0
    );
  } catch {
    return [];
  }
}

export function useCart() {
  const [entries, setEntries] = useState(restoreBag);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(entries));
    } catch {
      // Memory still holds the selection when browser storage is unavailable.
    }
  }, [entries]);

  const add = useCallback((item, count = 1) => {
    if (item.isAvailable === false) return;
    const quantity = Math.max(1, Math.floor(Number(count) || 1));
    setEntries(current => {
      const existing = current.some(entry => entry.item.slug === item.slug);
      if (!existing) return [...current, { item, quantity }];
      return current.map(entry => entry.item.slug === item.slug ? { item, quantity: entry.quantity + quantity } : entry);
    });
  }, []);

  const change = useCallback((slug, delta) => {
    setEntries(current => current.map(entry => entry.item.slug === slug
      ? { ...entry, quantity: entry.quantity + delta } : entry
    ).filter(entry => entry.quantity > 0));
  }, []);

  const count = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  const total = entries.reduce((sum, { item, quantity }) => sum + Math.round(item.price * 100) * quantity, 0) / 100;
  return { entries, count, total, add, change, clear: () => setEntries([]) };
}
