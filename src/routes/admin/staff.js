import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { dbQuery } from '../../db/database.js';
import { authenticateStaff } from '../../middleware/auth.js';

const router = Router();
router.use(authenticateStaff);

// GET /api/admin/staff
router.get('/', async (req, res, next) => {
  try {
    const result = await dbQuery(`
      SELECT id, email, full_name, role, is_active, created_at, last_login_at
      FROM staff_users
      ORDER BY id ASC
    `);
    const staff = result.rows.map(s => ({
      ...s,
      is_active: Boolean(s.is_active),
    }));
    res.json(staff);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/staff
router.post('/', async (req, res, next) => {
  try {
    const { email, full_name, password, role = 'staff' } = req.body;

    if (!email || !full_name || !password) {
      return res.status(422).json({ detail: 'email, full_name, and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existing = await dbQuery('SELECT id FROM staff_users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ detail: 'A staff account with this email already exists.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const result = await dbQuery(`
      INSERT INTO staff_users (email, full_name, role, password_hash, is_active)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING id, email, full_name, role, is_active, created_at, last_login_at
    `, [cleanEmail, String(full_name).trim(), role, passwordHash]);

    const created = result.rows[0];
    res.status(201).json({
      ...created,
      is_active: Boolean(created.is_active),
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/staff/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const staffId = parseInt(req.params.id, 10);
    const staffRes = await dbQuery('SELECT * FROM staff_users WHERE id = $1', [staffId]);
    if (staffRes.rows.length === 0) {
      return res.status(404).json({ detail: 'Staff account not found.' });
    }

    const { full_name, role, is_active, password } = req.body;
    const updates = [];
    const params = [];

    if (full_name !== undefined) {
      params.push(String(full_name).trim());
      updates.push(`full_name = $${params.length}`);
    }
    if (role !== undefined) {
      params.push(role);
      updates.push(`role = $${params.length}`);
    }
    if (is_active !== undefined) {
      params.push(Boolean(is_active));
      updates.push(`is_active = $${params.length}`);
    }
    if (password) {
      const salt = bcrypt.genSaltSync(10);
      params.push(bcrypt.hashSync(password, salt));
      updates.push(`password_hash = $${params.length}`);
    }

    if (updates.length > 0) {
      params.push(staffId);
      await dbQuery(`UPDATE staff_users SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    }

    const updatedRes = await dbQuery('SELECT id, email, full_name, role, is_active, created_at, last_login_at FROM staff_users WHERE id = $1', [staffId]);
    const updated = updatedRes.rows[0];

    res.json({
      ...updated,
      is_active: Boolean(updated.is_active),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
