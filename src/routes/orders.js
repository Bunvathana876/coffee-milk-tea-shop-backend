import { Router } from 'express';
import { dbQuery } from '../db/database.js';
import { config } from '../config.js';
import { calculateItemPrice, generateOrderNumber } from '../utils/calculations.js';

const router = Router();

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

// POST /api/orders (and /api/orders/)
router.post(['/', ''], async (req, res, next) => {
  try {
    const {
      customer_name,
      customer_phone,
      customer_email,
      notes,
      payment_method = 'cash',
      items,
    } = req.body;

    if (!customer_name || !String(customer_name).trim()) {
      return res.status(422).json({ detail: 'Customer name is required.' });
    }
    if (!customer_phone || !String(customer_phone).trim()) {
      return res.status(422).json({ detail: 'Customer phone number is required.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(422).json({ detail: 'Order must contain at least one item.' });
    }

    const orderNumber = generateOrderNumber();
    let calculatedSubtotal = 0;
    const processedItems = [];

    for (const item of items) {
      const quantity = parseInt(item.quantity || '1', 10);
      if (isNaN(quantity) || quantity <= 0) {
        return res.status(422).json({ detail: 'Item quantity must be at least 1.' });
      }

      let productName = item.product_name || 'Artisan Drink';
      let basePrice = 2.50;

      if (item.product_id) {
        const prodRes = await dbQuery('SELECT id, name, base_price_usd FROM products WHERE id = $1', [item.product_id]);
        if (prodRes.rows.length > 0) {
          const prod = prodRes.rows[0];
          productName = prod.name;
          basePrice = Number(prod.base_price_usd);
        }
      }

      const size = item.size || 'Medium';
      const sugarLevel = item.sugar_level || '50%';
      const iceLevel = item.ice_level || 'Normal Ice';
      const rawToppings = item.toppings || [];

      const { unitPrice, toppingsString } = calculateItemPrice(basePrice, size, rawToppings);
      const subtotal = parseFloat((unitPrice * quantity).toFixed(2));
      calculatedSubtotal += subtotal;

      processedItems.push({
        product_id: item.product_id || null,
        product_name: productName,
        quantity,
        unit_price_usd: unitPrice,
        subtotal_usd: subtotal,
        size,
        sugar_level: sugarLevel,
        ice_level: iceLevel,
        toppings: toppingsString,
      });
    }

    calculatedSubtotal = parseFloat(calculatedSubtotal.toFixed(2));
    const totalUsd = calculatedSubtotal;
    const totalKhr = Math.round(totalUsd * config.usdToKhrRate);

    // Save in transaction
    await dbQuery('BEGIN');
    try {
      const orderResult = await dbQuery(`
        INSERT INTO orders (
          order_number, customer_name, customer_phone, customer_email, notes,
          subtotal_usd, total_usd, total_khr, payment_method, payment_status, order_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'unpaid', 'pending')
        RETURNING *
      `, [
        orderNumber,
        String(customer_name).trim(),
        String(customer_phone).trim(),
        customer_email ? String(customer_email).trim() : null,
        notes ? String(notes).trim() : null,
        calculatedSubtotal,
        totalUsd,
        totalKhr,
        payment_method
      ]);

      const createdOrder = orderResult.rows[0];
      const orderId = createdOrder.id;

      for (const item of processedItems) {
        await dbQuery(`
          INSERT INTO order_items (
            order_id, product_id, product_name, quantity,
            unit_price_usd, subtotal_usd, size, sugar_level, ice_level, toppings
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          orderId,
          item.product_id,
          item.product_name,
          item.quantity,
          item.unit_price_usd,
          item.subtotal_usd,
          item.size,
          item.sugar_level,
          item.ice_level,
          item.toppings
        ]);
      }

      // Check if phone matches registered customer and increment loyalty stamps
      const customerRes = await dbQuery('SELECT id, loyalty_stamps FROM customer_users WHERE phone = $1', [String(customer_phone).trim()]);
      if (customerRes.rows.length > 0) {
        await dbQuery('UPDATE customer_users SET loyalty_stamps = loyalty_stamps + 1 WHERE id = $1', [customerRes.rows[0].id]);
      }

      await dbQuery('COMMIT');

      const formatted = await formatOrderWithItems(createdOrder);
      res.status(201).json(formatted);
    } catch (err) {
      await dbQuery('ROLLBACK');
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/lookup/phone
router.get('/lookup/phone', async (req, res, next) => {
  try {
    const phone = req.query.phone;
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ detail: 'Phone query parameter is required.' });
    }

    const ordersRes = await dbQuery(`
      SELECT * FROM orders 
      WHERE customer_phone = $1
      ORDER BY id DESC
    `, [String(phone).trim()]);

    const orders = await Promise.all(ordersRes.rows.map(order => formatOrderWithItems(order)));

    res.json(orders);
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/ref/:order_number
router.get('/ref/:order_number', async (req, res, next) => {
  try {
    const orderNumber = decodeURIComponent(req.params.order_number).trim();

    const orderRes = await dbQuery('SELECT * FROM orders WHERE order_number = $1', [orderNumber]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ detail: `Order with reference '${orderNumber}' not found.` });
    }

    const formatted = await formatOrderWithItems(orderRes.rows[0]);
    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id
router.get('/:id', async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId)) {
      return res.status(400).json({ detail: 'Invalid order ID.' });
    }

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

export default router;
