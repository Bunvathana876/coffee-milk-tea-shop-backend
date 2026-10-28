import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app, { startServer } from '../src/server.js';
import { getDatabase } from '../src/db/database.js';

let server;
let baseUrl;

test.before(async () => {
  // Start on an ephemeral port for testing
  server = await startServer(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
});

test.after(() => {
  if (server) {
    server.close();
  }
});

async function apiRequest(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, data };
}

test('1. Health check returns 200 and healthy status', async () => {
  const res = await apiRequest('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.data.status, 'healthy');
  assert.equal(res.data.app, 'Coffee & Milk Tea Shop API');
});

test('2. Categories endpoint returns seeded categories with product counts', async () => {
  const res = await apiRequest('/api/categories?active_only=true');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.data));
  assert.ok(res.data.length >= 5);

  const coffee = res.data.find(c => c.name === 'Coffee');
  assert.ok(coffee);
  assert.ok(coffee.product_count >= 1);
});

test('3. Products endpoint supports category filtering and search', async () => {
  // All products
  const resAll = await apiRequest('/api/products');
  assert.equal(resAll.status, 200);
  assert.ok(resAll.data.length >= 10);

  // Filter by category name
  const resCoffee = await apiRequest('/api/products?category=Coffee');
  assert.equal(resCoffee.status, 200);
  assert.ok(resCoffee.data.every(p => p.category.name === 'Coffee'));

  // Search by keyword
  const resSearch = await apiRequest('/api/products?search=Matcha');
  assert.equal(resSearch.status, 200);
  assert.ok(resSearch.data.length >= 1);
  assert.ok(resSearch.data.some(p => p.name.includes('Matcha')));
});

test('4. Customer Registration, Login and Profile (/me)', async () => {
  const phone = `099${Math.floor(100000 + Math.random() * 900000)}`;
  const email = `test.${Date.now()}@coffeeshop.com`;
  const password = 'mysecurepassword123';

  // 1. Register
  const regRes = await apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      full_name: 'Sophea NodeTester',
      phone,
      email,
      password,
    }),
  });
  assert.equal(regRes.status, 201);
  assert.ok(regRes.data.access_token);
  assert.equal(regRes.data.user.full_name, 'Sophea NodeTester');
  assert.equal(regRes.data.user.phone, phone);

  // 2. Login with phone
  const loginRes = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: phone,
      password,
    }),
  });
  assert.equal(loginRes.status, 200);
  const token = loginRes.data.access_token;
  assert.ok(token);

  // 3. Get profile
  const meRes = await apiRequest('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(meRes.status, 200);
  assert.equal(meRes.data.email, email);

  // 4. Customer token CANNOT access admin endpoints
  const adminRes = await apiRequest('/api/admin/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(adminRes.status, 403);
});

test('5. Order Creation with Size & Toppings calculations and Loyalty increment', async () => {
  const phone = `088${Math.floor(100000 + Math.random() * 900000)}`;

  // Register customer first to test loyalty punch card
  await apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      full_name: 'Loyal Drinker',
      phone,
      password: 'password123',
    }),
  });

  // Get products to order
  const prodRes = await apiRequest('/api/products');
  const drink = prodRes.data[0]; // e.g. Iced Americano ($2.00)

  // Order with Large (+0.60) and Brown Sugar Pearls (+0.50)
  const orderRes = await apiRequest('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      customer_name: 'Loyal Drinker',
      customer_phone: phone,
      items: [
        {
          product_id: drink.id,
          size: 'Large',
          sugar_level: '50%',
          ice_level: 'Normal Ice',
          toppings: ['Brown Sugar Pearls'],
          quantity: 2,
        },
      ],
    }),
  });

  assert.equal(orderRes.status, 201);
  const order = orderRes.data;
  assert.ok(order.order_number.startsWith('ORD-'));
  // Expected price: (2.00 + 0.60 + 0.50) = 3.10 * 2 = 6.20
  const expectedUnitPrice = parseFloat((drink.base_price_usd + 0.60 + 0.50).toFixed(2));
  const expectedTotal = parseFloat((expectedUnitPrice * 2).toFixed(2));
  assert.equal(order.total_usd, expectedTotal);
  assert.equal(order.total_khr, Math.round(expectedTotal * 4100));
  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].size, 'Large');
  assert.equal(order.items[0].toppings, 'Brown Sugar Pearls');

  // Verify phone lookup
  const lookupRes = await apiRequest(`/api/orders/lookup/phone?phone=${phone}`);
  assert.equal(lookupRes.status, 200);
  assert.ok(lookupRes.data.length >= 1);
  assert.equal(lookupRes.data[0].order_number, order.order_number);

  // Verify reference lookup
  const refRes = await apiRequest(`/api/orders/ref/${encodeURIComponent(order.order_number)}`);
  assert.equal(refRes.status, 200);
  assert.equal(refRes.data.id, order.id);

  // Verify loyalty stamps incremented
  const loginRes = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: phone, password: 'password123' }),
  });
  assert.equal(loginRes.data.user.loyalty_stamps, 1);
});

test('6. Admin Authentication & Dashboard Summary', async () => {
  // Login as seeded admin
  const loginRes = await apiRequest('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@coffeeshop.com',
      password: 'admin123',
    }),
  });
  assert.equal(loginRes.status, 200);
  const adminToken = loginRes.data.access_token;
  assert.ok(adminToken);

  // Dashboard summary
  const summaryRes = await apiRequest('/api/admin/dashboard/summary', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(summaryRes.status, 200);
  assert.ok(summaryRes.data.total_orders >= 1);
  assert.ok(summaryRes.data.total_sales_usd > 0);
});

