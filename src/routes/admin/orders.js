import { Router } from 'express';
import { dbQuery } from '../../db/database.js';
import { authenticateStaff } from '../../middleware/auth.js';

const router = Router();
router.use(authenticateStaff);

async function formatOrderWithItems(order) {
  if (!order) return null;
  const itemsRes = await dbQuery(`
    SELECT 
      id, order_id, product_id, product_name, quantity, 
      unit_price_usd, subtotal_usd, size, sugar_level, ice_level, toppings
    FROM order_items
    WHERE order_id = $1
    ORDER BY id ASC
  `, [order.id]);

  const items = itemsRes.rows.map(item => ({
    ...item,
    quantity: Number(item.quantity),
    unit_price_usd: Number(item.unit_price_usd),
    subtotal_usd: Number(item.subtotal_usd),
    toppings: item.toppings || '',
  }));

  return {
    id: order.id,
    order_number: order.order_number,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    customer_email: order.customer_email || null,
    notes: order.notes || null,
    subtotal_usd: Number(order.subtotal_usd),
    total_usd: Number(order.total_usd),
    total_khr: Number(order.total_khr),
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    order_status: order.order_status,
    created_at: order.created_at,
    items,
  };
}

// GET /api/admin/orders
router.get('/', async (req, res, next) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query;

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (status && String(status).trim()) {
      params.push(String(status).trim());
      query += ` AND order_status = $${params.length}`;
    }

    params.push(parsedLimit);
    query += ` ORDER BY id DESC LIMIT $${params.length}`;

    params.push(parsedOffset);
    query += ` OFFSET $${params.length}`;

    const ordersRes = await dbQuery(query, params);
    const orders = await Promise.all(ordersRes.rows.map(o => formatOrderWithItems(o)));

    let countQuery = 'SELECT COUNT(*) as count FROM orders WHERE 1=1';
    const countParams = [];
    if (status && String(status).trim()) {
      countParams.push(String(status).trim());
      countQuery += ` AND order_status = $${countParams.length}`;
    }
    const totalRes = await dbQuery(countQuery, countParams);
    const total = Number(totalRes.rows[0]?.count || 0);

    // Status counts
    const statusCountsRaw = await dbQuery(`
      SELECT order_status, COUNT(*) as count FROM orders GROUP BY order_status
    `);
    const counts_by_status = {
      pending: 0,
      preparing: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const sc of statusCountsRaw.rows) {
      counts_by_status[sc.order_status] = Number(sc.count);
    }

    res.json({
      items: orders,
      total,
      limit: parsedLimit,
      offset: parsedOffset,
      counts_by_status,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/orders/:id
router.get('/:id', async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const orderRes = await dbQuery('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ detail: 'Order not found.' });
    }
    const formatted = await formatOrderWithItems(orderRes.rows[0]);
    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/orders/:id/status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const orderRes = await dbQuery('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ detail: 'Order not found.' });
    }

    const { order_status, payment_status } = req.body;
    const updates = [];
    const params = [];

    if (order_status) {
      const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
      if (!validStatuses.includes(order_status)) {
        return res.status(422).json({ detail: `Invalid order_status. Must be one of: ${validStatuses.join(', ')}` });
      }
      params.push(order_status);
      updates.push(`order_status = $${params.length}`);
    }

    if (payment_status) {
      const validPayments = ['unpaid', 'pending', 'paid', 'failed'];
      if (!validPayments.includes(payment_status)) {
        return res.status(422).json({ detail: `Invalid payment_status. Must be one of: ${validPayments.join(', ')}` });
      }
      params.push(payment_status);
      updates.push(`payment_status = $${params.length}`);
    }

    if (updates.length > 0) {
      params.push(orderId);
      await dbQuery(`UPDATE orders SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    }

    const updatedRes = await dbQuery('SELECT * FROM orders WHERE id = $1', [orderId]);
    const formatted = await formatOrderWithItems(updatedRes.rows[0]);
    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

export default router;
