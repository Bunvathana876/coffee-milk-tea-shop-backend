import { Router } from 'express';
import { dbQuery } from '../../db/database.js';
import { authenticateStaff } from '../../middleware/auth.js';

const router = Router();
router.use(authenticateStaff);

// GET /api/admin/categories
router.get('/', async (req, res, next) => {
  try {
    const result = await dbQuery(`
      SELECT 
        c.id, c.name, c.description, c.image, c.is_active, c.created_at,
        COUNT(p.id) as product_count,
        COALESCE(SUM(CASE WHEN p.is_available = TRUE THEN 1 ELSE 0 END), 0) as available_product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.id ASC
    `);

    const categories = result.rows.map(c => ({
      ...c,
      is_active: Boolean(c.is_active),
      product_count: Number(c.product_count || 0),
      available_product_count: Number(c.available_product_count || 0),
    }));

    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/categories
router.post('/', async (req, res, next) => {
  try {
    const { name, description, image, is_active = true } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(422).json({ detail: 'Category name is required.' });
    }

    const cleanName = String(name).trim();
    const existing = await dbQuery('SELECT id FROM categories WHERE LOWER(name) = LOWER($1)', [cleanName]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ detail: 'A category with this name already exists.' });
    }

    const result = await dbQuery(`
      INSERT INTO categories (name, description, image, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [cleanName, description || null, image || null, Boolean(is_active)]);

    const created = result.rows[0];
    res.status(201).json({
      ...created,
      is_active: Boolean(created.is_active),
      product_count: 0,
      available_product_count: 0,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/categories/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const categoryId = parseInt(req.params.id, 10);
    const catRes = await dbQuery('SELECT * FROM categories WHERE id = $1', [categoryId]);
    if (catRes.rows.length === 0) {
      return res.status(404).json({ detail: 'Category not found.' });
    }

    const { name, description, image, is_active } = req.body;
    const updates = [];
    const params = [];

    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName) {
        return res.status(422).json({ detail: 'Category name cannot be empty.' });
      }
      const existing = await dbQuery('SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND id != $2', [cleanName, categoryId]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ detail: 'Another category with this name already exists.' });
      }
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
    if (is_active !== undefined) {
      params.push(Boolean(is_active));
      updates.push(`is_active = $${params.length}`);
    }

    if (updates.length > 0) {
      params.push(categoryId);
      await dbQuery(`UPDATE categories SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    }

    const updatedRes = await dbQuery(`
      SELECT 
        c.id, c.name, c.description, c.image, c.is_active, c.created_at,
        COUNT(p.id) as product_count,
        COALESCE(SUM(CASE WHEN p.is_available = TRUE THEN 1 ELSE 0 END), 0) as available_product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      WHERE c.id = $1
      GROUP BY c.id
    `, [categoryId]);

    const updated = updatedRes.rows[0];

    res.json({
      ...updated,
      is_active: Boolean(updated.is_active),
      product_count: Number(updated.product_count || 0),
      available_product_count: Number(updated.available_product_count || 0),
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/categories/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const categoryId = parseInt(req.params.id, 10);

    const countRes = await dbQuery('SELECT COUNT(*) as count FROM products WHERE category_id = $1', [categoryId]);
    const count = Number(countRes.rows[0]?.count || 0);
    if (count > 0) {
      return res.status(400).json({ detail: `Cannot delete category: it has ${count} associated products. Reassign or delete products first.` });
    }

    const result = await dbQuery('DELETE FROM categories WHERE id = $1', [categoryId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ detail: 'Category not found.' });
    }

    res.json({ message: 'Category deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
