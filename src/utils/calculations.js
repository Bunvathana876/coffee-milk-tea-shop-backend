import { config } from '../config.js';

export function parseToppings(toppings) {
  if (Array.isArray(toppings)) {
    return toppings.map(t => String(t).trim()).filter(Boolean);
  }
  if (typeof toppings === 'string' && toppings.trim()) {
    return toppings
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
  }
  return [];
}

export function calculateItemPrice(basePriceUsd, size = 'Medium', toppings = []) {
  const sizeMod = config.sizePriceModifiers[size] ?? 0.0;
  const parsedToppings = parseToppings(toppings);
  const toppingsMod = parsedToppings.reduce((sum, topping) => {
    return sum + (config.toppingPrices[topping] ?? 0.0);
  }, 0.0);

  const unitPrice = parseFloat((basePriceUsd + sizeMod + toppingsMod).toFixed(2));
  return {
    unitPrice,
    toppingsList: parsedToppings,
    toppingsString: parsedToppings.join(', '),
  };
}

export function generateOrderNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ORD-${dateStr}-${rand}`;
}

