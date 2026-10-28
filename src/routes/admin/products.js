import { Router } from 'express';
import { dbQuery } from '../../db/database.js';
import { authenticateStaff } from '../../middleware/auth.js';

const router = Router();
router.use(authenticateStaff);

// GET /api/admin/products
router.get('/', async (req, res, next) => {
  try {
    const result = await dbQuery(`
      SELECT 
        p.id, p.category_id, p.name, p.description, p.image, 
        p.base_price_usd, p.is_available, p.created_at,
        c.name as category_name
      FROM products p
      JOIN categories c ON p.category_id = c.id
      ORDER BY p.id ASC
    `);

    const products = result.rows.map(p => ({
      ...p,
      is_available: Boolean(p.is_available),
      base_price_usd: Number(p.base_price_usd),
      category: {
        id: p.category_id,
        name: p.category_name,
      },
    }));

    res.json(products);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/products
router.post('/', async (req, res, next) => {
  try {
    const { category_id, name, description, image, base_price_usd, is_available = true } = req.body;

    if (!category_id || !name || base_price_usd === undefined) {
      return res.status(422).json({ detail: 'category_id, name, and base_price_usd are required.' });
    }

    const catRes = await dbQuery('SELECT id, name FROM categories WHERE id = $1', [category_id]);
    if (catRes.rows.length === 0) {
      return res.status(404).json({ detail: 'Category not found.' });
    }
    const category = catRes.rows[0];

    const price = parseFloat(base_price_usd);
    if (isNaN(price) || price < 0) {
      return res.status(422).json({ detail: 'base_price_usd must be a positive number.' });
    }

    const result = await dbQuery(`
      INSERT INTO products (category_id, name, description, image, base_price_usd, is_available)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [category_id, String(name).trim(), description || null, image || null, price, Boolean(is_available)]);

    const created = result.rows[0];
    res.status(201).json({
      ...created,
      is_available: Boolean(created.is_available),
      base_price_usd: Number(created.base_price_usd),
      category_name: category.name,
      category,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/products/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id, 10);
    const prodRes = await dbQuery('SELECT * FROM products WHERE id = $1', [productId]);
    if (prodRes.rows.length === 0) {
      return res.status(404).json({ detail: 'Product not found.' });
    }

    const { category_id, name, description, image, base_price_usd, is_available } = req.body;
    const updates = [];
    const params = [];

    if (category_id !== undefined) {
      const catRes = await dbQuery('SELECT id FROM categories WHERE id = $1', [category_id]);
      if (catRes.rows.length === 0) return res.status(404).json({ detail: 'Category not found.' });
      params.push(category_id);
      updates.push(`category_id = $${params.length}`);
    }
    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName) return res.status(422).json({ detail: 'Product name cannot be empty.' });
      params.push(cleanName);
      updates.push(`name = $${params.length}`);
    }
    if (description !== undefined) {
      params.push(description);
      updates.push(`description = $${params.length}`);
    }
    if (image !== undefined) {
      params.push(image);
      updates.push(`image = $${params.length}`);
    }
    if (base_price_usd !== undefined) {
      const price = parseFloat(base_price_usd);
      if (isNaN(price) || price < 0) return res.status(422).json({ detail: 'Invalid base price.' });
      params.push(price);
      updates.push(`base_price_usd = $${params.length}`);
    }
    if (is_available !== undefined) {
      params.push(Boolean(is_available));
      updates.push(`is_available = $${params.length}`);
    }

    if (updates.length > 0) {
      params.push(productId);
      await dbQuery(`UPDATE products SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    }

    const updatedRes = await dbQuery(`
      SELECT 
        p.*, c.name as category_name, c.description as category_description
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.id = $1
    `, [productId]);

    const updated = updatedRes.rows[0];

    res.json({
      ...updated,
      is_available: Boolean(updated.is_available),
      base_price_usd: Number(updated.base_price_usd),
      category: {
        id: updated.category_id,
        name: updated.category_name,
        description: updated.category_description,
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/products/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id, 10);
    const result = await dbQuery('DELETE FROM products WHERE id = $1', [productId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ detail: 'Product not found.' });
    }
    res.json({ message: 'Product deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
