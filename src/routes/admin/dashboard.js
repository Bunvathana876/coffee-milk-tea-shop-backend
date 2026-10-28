import { Router } from 'express';
import { dbQuery } from '../../db/database.js';
import { authenticateStaff } from '../../middleware/auth.js';

const router = Router();
router.use(authenticateStaff);

// GET /api/admin/dashboard/summary
router.get('/summary', async (req, res, next) => {
  try {
    const statsRes = await dbQuery(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_usd), 0) as total_sales_usd,
        COALESCE(SUM(total_khr), 0) as total_sales_khr,
        COALESCE(SUM(CASE WHEN order_status = 'pending' THEN 1 ELSE 0 END), 0) as pending_orders,
        COALESCE(SUM(CASE WHEN order_status = 'completed' THEN 1 ELSE 0 END), 0) as completed_orders
      FROM orders
    `);
    const orderStats = statsRes.rows[0] || {};

    const customersRes = await dbQuery('SELECT COUNT(*) as count FROM customer_users');
    const totalCustomers = Number(customersRes.rows[0]?.count || 0);

    const recentOrdersRes = await dbQuery(`
      SELECT * FROM orders ORDER BY id DESC LIMIT 5
    `);
    const recentOrders = recentOrdersRes.rows.map(order => ({
      ...order,
      subtotal_usd: Number(order.subtotal_usd),
      total_usd: Number(order.total_usd),
      total_khr: Number(order.total_khr),
    }));

    res.json({
      total_orders: Number(orderStats.total_orders || 0),
      total_sales_usd: Number(orderStats.total_sales_usd || 0),
      total_sales_khr: Number(orderStats.total_sales_khr || 0),
      pending_orders: Number(orderStats.pending_orders || 0),
      completed_orders: Number(orderStats.completed_orders || 0),
      total_customers: totalCustomers,
      recent_orders: recentOrders,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/reports/sales
router.get('/reports/sales', async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;

    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (date_from) {
      params.push(date_from);
      query += ` AND created_at >= $${params.length}`;
    }
    if (date_to) {
      params.push(date_to);
      query += ` AND created_at <= $${params.length}`;
    }

    const ordersRes = await dbQuery(query, params);
    const orders = ordersRes.rows;

    let totalRevenueUsd = 0;
    let totalRevenueKhr = 0;
    const statusMap = new Map();

    for (const o of orders) {
      totalRevenueUsd += Number(o.total_usd);
      totalRevenueKhr += Number(o.total_khr);

      const existing = statusMap.get(o.order_status) || {
        status: o.order_status,
        order_count: 0,
        total_usd: 0,
        total_khr: 0,
      };
      existing.order_count += 1;
      existing.total_usd += Number(o.total_usd);
      existing.total_khr += Number(o.total_khr);
      statusMap.set(o.order_status, existing);
    }

    res.json({
      date_from: date_from || 'all_time',
      date_to: date_to || new Date().toISOString(),
      total_revenue_usd: parseFloat(totalRevenueUsd.toFixed(2)),
      total_revenue_khr: totalRevenueKhr,
      total_orders: orders.length,
      status_breakdown: Array.from(statusMap.values()),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
