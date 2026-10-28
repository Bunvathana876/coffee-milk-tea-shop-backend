import bcrypt from 'bcryptjs';
import { getDatabase, dbQuery } from './database.js';
import { config } from '../config.js';

export const SEED_CATEGORIES = [
  {
    name: 'Coffee',
    description: 'Artisan espresso drinks and slow-brewed coffees made from premium roasted beans',
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80',
    is_active: 1,
  },
  {
    name: 'Milk Tea',
    description: 'Handcrafted milk teas brewed with loose leaf teas, fresh milk, and signature boba',
    image: 'https://images.unsplash.com/photo-1558857563-b37cf5a1334c?w=600&auto=format&fit=crop&q=80',
    is_active: 1,
  },
  {
    name: 'Fruit Tea',
    description: 'Vibrant, refreshing iced teas infused with real tropical fruits and floral notes',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
    is_active: 1,
  },
  {
    name: 'Smoothies',
    description: 'Thick, creamy fruit blends and frappes crafted with fresh ingredients and ice',
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&auto=format&fit=crop&q=80',
    is_active: 1,
  },
  {
    name: 'Matcha',
    description: 'Authentic stone-ground Uji matcha lattes and specialty fusion drinks',
    image: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80',
    is_active: 1,
  },
];

export const SEED_PRODUCTS = [
  // --- Coffee ---
  {
    category_name: 'Coffee',
    name: 'Iced Americano',
    description: 'Bold double espresso poured over purified chilled water and crisp ice.',
    image: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&auto=format&fit=crop&q=80',
    base_price_usd: 2.0,
    is_available: 1,
  },
  {
    category_name: 'Coffee',
    name: 'Iced Latte',
    description: 'Freshly pulled espresso layered smoothly with velvety chilled whole milk.',
    image: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?w=600&auto=format&fit=crop&q=80',
    base_price_usd: 2.5,
    is_available: 1,
  },
  {
    category_name: 'Coffee',
    name: 'Cappuccino',
    description: 'Equal parts rich espresso, steamed milk, and dense micro-foam dusted with cocoa powder.',
    image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80',
    base_price_usd: 2.5,
    is_available: 1,
  },
  {
    category_name: 'Coffee',
    name: 'Caramel Macchiato',
    description: 'Vanilla-infused milk stained with dark espresso and drizzled with buttery salted caramel.',
    image: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=600&auto=format&fit=crop&q=80',
    base_price_usd: 3.25,
    is_available: 1,
  },
  {
    category_name: 'Coffee',
    name: 'Spanish Latte',
    description: 'Sweetened condensed milk blended with fresh espresso and cold milk for a decadent kick.',
    image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600&auto=format&fit=crop&q=80',
    base_price_usd: 3.0,
    is_available: 1,
  },

  // --- Milk Tea ---
  {
    category_name: 'Milk Tea',
    name: 'Classic Milk Tea',
    description: 'Traditional robust black tea slow-brewed and blended with creamy milk.',
    image: 'https://images.unsplash.com/photo-1558857563-b37cf5a1334c?w=600&auto=format&fit=crop&q=80',
    base_price_usd: 2.5,
    is_available: 1,
  },
  {
    category_name: 'Milk Tea',
    name: 'Brown Sugar Boba Milk Tea',
    description: 'Warm caramelized tapioca pearls swirled with dark brown sugar syrup and cold milk.',
    image: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=600&auto=format&fit=crop&q=80',
    base_price_usd: 3.25,
    is_available: 1,
  },
  {
    category_name: 'Milk Tea',
    name: 'Taro Milk Tea',
    description: 'Sweet, nutty taro root paste infused with jasmine green tea and creamy milk.',
    image: 'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=600&auto=format&fit=crop&q=80',
    base_price_usd: 2.75,
    is_available: 1,
  },
  {
    category_name: 'Milk Tea',
    name: 'Thai Milk Tea',
    description: 'Spiced aromatic Ceylon tea brewed rich orange, sweetened with condensed milk over ice.',
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&auto=format&fit=crop&q=80',
    base_price_usd: 2.5,
    is_available: 1,
  },

  // --- Fruit Tea ---
  {
    category_name: 'Fruit Tea',
    name: 'Passion Fruit Jasmine Tea',
    description: 'Tangy fresh passion fruit pulp and seeds shaken with floral green tea.',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
    base_price_usd: 2.75,
    is_available: 1,
  },
  {
    category_name: 'Fruit Tea',
    name: 'Peach Oolong Tea',
    description: 'Juicy white peach nectar blended with roasted Taiwanese mountain oolong tea.',
    image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=80',
    base_price_usd: 2.75,
    is_available: 1,
  },
  {
    category_name: 'Fruit Tea',
    name: 'Lychee Rose Green Tea',
    description: 'Sweet lychee fruit and aromatic rose petals cold-infused in light green tea.',
    image: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?w=600&auto=format&fit=crop&q=80',
    base_price_usd: 2.75,
    is_available: 1,
  },

  // --- Smoothies ---
  {
    category_name: 'Smoothies',
    name: 'Mango Coconut Smoothie',
    description: 'Ripe golden mango chunks blended with thick coconut cream and crushed ice.',
    image: 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=600&auto=format&fit=crop&q=80',
    base_price_usd: 3.5,
    is_available: 1,
  },
  {
    category_name: 'Smoothies',
    name: 'Strawberry Banana Smoothie',
    description: 'Farm-fresh ripe strawberries and sweet banana blended with Greek yogurt.',
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&auto=format&fit=crop&q=80',
    base_price_usd: 3.25,
    is_available: 1,
  },
  {
    category_name: 'Smoothies',
    name: 'Avocado Coffee Frappe',
    description: 'Creamy Hass avocado pureed with sweetened milk and capped with a fresh espresso shot.',
    image: 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=600&auto=format&fit=crop&q=80',
    base_price_usd: 3.75,
    is_available: 1,
  },

  // --- Matcha ---
  {
    category_name: 'Matcha',
    name: 'Iced Matcha Latte',
    description: 'Ceremonial Uji matcha whisked fresh and poured over cold oat milk.',
    image: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80',
    base_price_usd: 3.25,
    is_available: 1,
  },
  {
    category_name: 'Matcha',
    name: 'Dirty Matcha',
    description: 'A striking two-tone blend of vibrant iced matcha latte crowned with a rich espresso shot.',
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80',
    base_price_usd: 3.5,
    is_available: 1,
  },
  {
    category_name: 'Matcha',
    name: 'Strawberry Matcha Latte',
    description: 'Housemade fresh strawberry compote layered with cold milk and vibrant green matcha.',
    image: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=600&auto=format&fit=crop&q=80',
    base_price_usd: 3.5,
    is_available: 1,
  },
];

export async function seedDatabase() {
  await getDatabase();

  // 1. Seed Categories
  const categoryMap = new Map();

  for (const cat of SEED_CATEGORIES) {
    const existing = await dbQuery('SELECT id FROM categories WHERE name = $1', [cat.name]);
    if (existing.rows.length === 0) {
      const result = await dbQuery(
        'INSERT INTO categories (name, description, image, is_active) VALUES ($1, $2, $3, $4) RETURNING id',
        [cat.name, cat.description, cat.image, Boolean(cat.is_active)]
      );
      categoryMap.set(cat.name, Number(result.rows[0].id));
    } else {
      categoryMap.set(cat.name, Number(existing.rows[0].id));
    }
  }

  // 2. Seed Products
  for (const prod of SEED_PRODUCTS) {
    const catId = categoryMap.get(prod.category_name);
    if (!catId) continue;
    const existing = await dbQuery('SELECT id FROM products WHERE name = $1', [prod.name]);
    if (existing.rows.length === 0) {
      await dbQuery(
        'INSERT INTO products (category_id, name, description, image, base_price_usd, is_available) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [catId, prod.name, prod.description, prod.image, prod.base_price_usd, Boolean(prod.is_available)]
      );
    }
  }

  // 3. Seed Default Admin / Staff User
  const existingStaff = await dbQuery('SELECT id FROM staff_users WHERE LOWER(email) = LOWER($1)', [config.adminInitialEmail]);
  if (existingStaff.rows.length === 0) {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(config.adminInitialPassword, salt);
    await dbQuery(
      'INSERT INTO staff_users (email, full_name, role, password_hash, is_active) VALUES ($1, $2, $3, $4, $5)',
      [config.adminInitialEmail, config.adminInitialName, 'admin', passwordHash, true]
    );
  }

  const catCountRes = await dbQuery('SELECT COUNT(*) as count FROM categories');
  const prodCountRes = await dbQuery('SELECT COUNT(*) as count FROM products');
  return {
    catCount: Number(catCountRes.rows[0].count),
    prodCount: Number(prodCountRes.rows[0].count),
  };
}

// Allow standalone execution: `node src/db/seed.js`
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(res => {
      console.log(`Database seeded successfully! Categories: ${res.catCount}, Products: ${res.prodCount}`);
      process.exit(0);
    })
    .catch(err => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}

