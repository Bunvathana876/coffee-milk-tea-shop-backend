import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { getDatabase } from './db/database.js';
import { seedDatabase } from './db/seed.js';

import healthRouter from './routes/health.js';
import categoriesRouter from './routes/categories.js';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import customerAuthRouter from './routes/customerAuth.js';

import adminAuthRouter from './routes/admin/auth.js';
import adminCategoriesRouter from './routes/admin/categories.js';
import adminProductsRouter from './routes/admin/products.js';
import adminOrdersRouter from './routes/admin/orders.js';
import adminDashboardRouter from './routes/admin/dashboard.js';
import adminStaffRouter from './routes/admin/staff.js';

import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

// CORS configuration to allow Web and Mobile clients
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl) or any configured origin
    if (!origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in dev to avoid blocking Flutter/web
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root info
app.get('/', (req, res) => {
  res.json({
    app: 'Coffee & Milk Tea Shop API',
    version: '1.0.0',
    docs: '/api/health',
    health: '/api/health',
  });
});

// Mount Public & Customer Routes
app.use('/api', healthRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/auth', customerAuthRouter);

// Mount Admin Routes
app.use('/api/admin/auth', adminAuthRouter);
app.use('/api/admin/categories', adminCategoriesRouter);
app.use('/api/admin/products', adminProductsRouter);
app.use('/api/admin/orders', adminOrdersRouter);
app.use('/api/admin/dashboard', adminDashboardRouter);
app.use('/api/admin', adminDashboardRouter); // for /api/admin/reports/sales
app.use('/api/admin/staff', adminStaffRouter);

// Handle 404 & errors
app.use(notFoundHandler);
app.use(errorHandler);

// Auto-seed on startup if needed and listen
export async function startServer(port = config.port) {
  // Initialize database schema and seed default data
  await getDatabase();
  await seedDatabase();

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`☕ Coffee & Milk Tea Shop Node.js Backend is running on http://localhost:${port}`);
      console.log(`👉 Health check: http://localhost:${port}/api/health`);
      resolve(server);
    });
  });
}

// Start immediately if executed directly
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export default app;

