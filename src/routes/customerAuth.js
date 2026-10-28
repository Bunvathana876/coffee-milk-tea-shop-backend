import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { dbQuery } from '../db/database.js';
import { createToken, authenticateCustomer } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { full_name, phone, email, password } = req.body;

    if (!full_name || String(full_name).trim().length < 2) {
      return res.status(422).json({ detail: 'Full name must be at least 2 characters.' });
    }
    if (!phone || String(phone).trim().length < 8) {
      return res.status(422).json({ detail: 'Phone number must be at least 8 digits.' });
    }
    if (!password || String(password).length < 6) {
      return res.status(422).json({ detail: 'Password must be at least 6 characters.' });
    }

    const cleanPhone = String(phone).trim();
    const cleanEmail = email && String(email).trim() ? String(email).trim().toLowerCase() : null;

    // Check duplicate phone
    const existingPhone = await dbQuery('SELECT id FROM customer_users WHERE phone = $1', [cleanPhone]);
    if (existingPhone.rows.length > 0) {
      return res.status(400).json({ detail: 'An account with this phone number already exists.' });
    }

    // Check duplicate email
    if (cleanEmail) {
      const existingEmail = await dbQuery('SELECT id FROM customer_users WHERE email = $1', [cleanEmail]);
      if (existingEmail.rows.length > 0) {
        return res.status(400).json({ detail: 'An account with this email address already exists.' });
      }
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const result = await dbQuery(`
      INSERT INTO customer_users (full_name, phone, email, password_hash, loyalty_stamps, is_active, last_login_at)
      VALUES ($1, $2, $3, $4, 0, TRUE, CURRENT_TIMESTAMP)
      RETURNING id, full_name, phone, email, loyalty_stamps, is_active, created_at, last_login_at
    `, [String(full_name).trim(), cleanPhone, cleanEmail, passwordHash]);

    const user = result.rows[0];

    const accessToken = createToken({
      sub: user.id,
      role: 'customer',
      phone: user.phone,
    });

    res.status(201).json({
      access_token: accessToken,
      token_type: 'bearer',
      expires_in_minutes: 10080,
      user: {
        ...user,
        is_active: Boolean(user.is_active),
        loyalty_stamps: Number(user.loyalty_stamps || 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(422).json({ detail: 'Identifier (phone or email) and password are required.' });
    }

    const cleanIdentifier = String(identifier).trim();
    const result = await dbQuery(`
      SELECT id, full_name, phone, email, password_hash, loyalty_stamps, is_active, created_at, last_login_at
      FROM customer_users
      WHERE phone = $1 OR LOWER(email) = LOWER($2)
    `, [cleanIdentifier, cleanIdentifier]);

    const user = result.rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({ detail: 'Invalid phone/email or password.' });
    }

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ detail: 'Invalid phone/email or password.' });
    }

    await dbQuery('UPDATE customer_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    const accessToken = createToken({
      sub: user.id,
      role: 'customer',
      phone: user.phone,
    });

    const updatedUserRes = await dbQuery('SELECT id, full_name, phone, email, loyalty_stamps, is_active, created_at, last_login_at FROM customer_users WHERE id = $1', [user.id]);
    const updatedUser = updatedUserRes.rows[0] || user;

    res.json({
      access_token: accessToken,
      token_type: 'bearer',
      expires_in_minutes: 10080,
      user: {
        ...updatedUser,
        is_active: Boolean(updatedUser.is_active),
        loyalty_stamps: Number(updatedUser.loyalty_stamps || 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authenticateCustomer, (req, res, next) => {
  try {
    const user = req.customer;
    res.json({
      ...user,
      is_active: Boolean(user.is_active),
      loyalty_stamps: Number(user.loyalty_stamps || 0),
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/me
router.patch('/me', authenticateCustomer, async (req, res, next) => {
  try {
    const customerId = req.customer.id;
    const { full_name, email } = req.body;

    const updates = [];
    const params = [];

    if (full_name !== undefined) {
      if (String(full_name).trim().length < 2) {
        return res.status(422).json({ detail: 'Full name must be at least 2 characters.' });
      }
      params.push(String(full_name).trim());
      updates.push(`full_name = $${params.length}`);
    }

    if (email !== undefined) {
      const cleanEmail = email && String(email).trim() ? String(email).trim().toLowerCase() : null;
      if (cleanEmail) {
        const existing = await dbQuery('SELECT id FROM customer_users WHERE email = $1 AND id != $2', [cleanEmail, customerId]);
        if (existing.rows.length > 0) {
          return res.status(400).json({ detail: 'Email address already in use by another customer.' });
        }
      }
      params.push(cleanEmail);
      updates.push(`email = $${params.length}`);
    }

    if (updates.length > 0) {
      params.push(customerId);
      await dbQuery(`UPDATE customer_users SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    }

    const updatedRes = await dbQuery('SELECT id, full_name, phone, email, loyalty_stamps, is_active, created_at, last_login_at FROM customer_users WHERE id = $1', [customerId]);
    const updated = updatedRes.rows[0];

    res.json({
      ...updated,
      is_active: Boolean(updated.is_active),
      loyalty_stamps: Number(updated.loyalty_stamps || 0),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
