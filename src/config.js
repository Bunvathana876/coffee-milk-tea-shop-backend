import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '8000', 10),
  environment: process.env.ENVIRONMENT || 'development',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-coffee-jwt-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  usdToKhrRate: parseFloat(process.env.USD_TO_KHR_RATE || '4100'),
  corsOrigins: (process.env.CORS_ORIGINS || '*')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),

  // PostgreSQL Connection Settings
  databaseUrl:
    process.env.DATABASE_URL ||
    `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'coffee_shop'}`,

  adminInitialEmail: process.env.ADMIN_INITIAL_EMAIL || 'admin@coffeeshop.com',
  adminInitialPassword: process.env.ADMIN_INITIAL_PASSWORD || 'admin123',
  adminInitialName: process.env.ADMIN_INITIAL_NAME || 'Store Administrator',

  // Customization rules
  sizePriceModifiers: {
    Small: 0.0,
    Medium: 0.3,
    Large: 0.6,
  },
  toppingPrices: {
    'Brown Sugar Pearls': 0.5,
    'Cheese Foam': 0.6,
    'Coconut Jelly': 0.4,
    Pudding: 0.5,
  },
};
