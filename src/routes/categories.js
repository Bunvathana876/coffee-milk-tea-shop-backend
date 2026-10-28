import { Router } from 'express';
import { dbQuery } from '../db/database.js';

const router = Router();

// GET /api/categories
router.get('/', async (req, res, next) => {
  try {
    const activeOnly = req.query.active_only === 'true';

    let query = `
      SELECT 
        c.id, c.name, c.description, c.image, c.is_active, c.created_at,
        COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_available = TRUE
    `;

    const params = [];
    if (activeOnly) {
      query += ' WHERE c.is_active = TRUE';
    }

    query += ' GROUP BY c.id ORDER BY c.id ASC';

    const result = await dbQuery(query, params);
    const categories = result.rows.map(cat => ({
      ...cat,
      is_active: Boolean(cat.is_active),
      product_count: Number(cat.product_count || 0),
    }));

    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// GET /api/categories/:id
router.get('/:id', async (req, res, next) => {
  try {
    const categoryId = parseInt(req.params.id, 10);
    if (isNaN(categoryId)) {
      return res.status(400).json({ detail: 'Invalid category ID' });
    }

    const catResult = await dbQuery(`
      SELECT 
        c.id, c.name, c.description, c.image, c.is_active, c.created_at,
        COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      WHERE c.id = $1
      GROUP BY c.id
    `, [categoryId]);

    const category = catResult.rows[0];
    if (!category) {
      return res.status(404).json({ detail: 'Category not found' });
    }

    const prodResult = await dbQuery(`
      SELECT id, category_id, name, description, image, base_price_usd, is_available, created_at
      FROM products
      WHERE category_id = $1
      ORDER BY id ASC
    `, [categoryId]);

    const products = prodResult.rows.map(p => ({
      ...p,
      is_available: Boolean(p.is_available),
      base_price_usd: Number(p.base_price_usd),
    }));

    res.json({
      ...category,
      is_active: Boolean(category.is_active),
      product_count: Number(category.product_count || 0),
      products,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
