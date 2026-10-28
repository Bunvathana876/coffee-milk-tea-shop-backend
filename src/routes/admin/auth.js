import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { dbQuery } from '../../db/database.js';
import { createToken, authenticateStaff } from '../../middleware/auth.js';

const router = Router();

// POST /api/admin/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(422).json({ detail: 'Email and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const result = await dbQuery('SELECT * FROM staff_users WHERE LOWER(email) = $1', [cleanEmail]);
    const staff = result.rows[0];

    if (!staff || !staff.is_active) {
      return res.status(401).json({ detail: 'Invalid email or password.' });
    }

    const match = bcrypt.compareSync(password, staff.password_hash);
    if (!match) {
      return res.status(401).json({ detail: 'Invalid email or password.' });
    }

    await dbQuery('UPDATE staff_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [staff.id]);

    const accessToken = createToken({
      sub: staff.id,
      role: staff.role,
      email: staff.email,
    });

    res.json({
      access_token: accessToken,
      token_type: 'bearer',
      user: {
        id: staff.id,
        email: staff.email,
        full_name: staff.full_name,
        role: staff.role,
        is_active: Boolean(staff.is_active),
        created_at: staff.created_at,
        last_login_at: staff.last_login_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/auth/me
router.get('/me', authenticateStaff, (req, res, next) => {
  try {
    const staff = req.staff;
    res.json({
      id: staff.id,
      email: staff.email,
      full_name: staff.full_name,
      role: staff.role,
      is_active: Boolean(staff.is_active),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
