// ══════════════════════════════════════════
//   BOLO E DINDIN DO REINO — server.js
//   Backend: Node.js + Express + SQLite
//   Admin senha: Elevive
// ══════════════════════════════════════════

const express  = require('express');
const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const app  = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'reino.db');

// ── Middleware ──
app.use(express.json({ limit: '10mb' })); // large limit for base64 images
app.use(express.static(__dirname));       // serve index.html, admin.html, style.css, script.js

// ── Database Setup ──
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    category TEXT NOT NULL,
    price    REAL NOT NULL,
    stock    INTEGER NOT NULL DEFAULT 0,
    desc     TEXT,
    img      TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id            TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT,
    customer_obs  TEXT,
    items         TEXT NOT NULL,
    total         REAL NOT NULL,
    payment       TEXT NOT NULL,
    delivery_date TEXT NOT NULL,
    delivery_time TEXT,
    status        TEXT DEFAULT 'pendente',
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pix_config (
    id    INTEGER PRIMARY KEY CHECK (id = 1),
    key   TEXT,
    type  TEXT,
    name  TEXT
  );

  INSERT OR IGNORE INTO pix_config (id) VALUES (1);
`);

// ── Helpers ──
function genId() {
  return Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).slice(2, 5).toUpperCase();
}

// ════════════════════════════════
//   PRODUCTS
// ════════════════════════════════

// GET all products
app.get('/api/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  res.json(rows);
});

// POST create product
app.post('/api/products', (req, res) => {
  const { name, category, price, stock, desc, img } = req.body;
  if (!name || !category || price == null || stock == null) {
    return res.status(400).json({ error: 'Campos obrigatorios faltando' });
  }
  const id = genId();
  db.prepare(
    'INSERT INTO products (id, name, category, price, stock, desc, img) VALUES (?,?,?,?,?,?,?)'
  ).run(id, name, category, price, stock, desc || null, img || null);
  res.json({ id });
});

// PUT update product
app.put('/api/products/:id', (req, res) => {
  const { name, category, price, stock, desc, img } = req.body;
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Produto nao encontrado' });

  db.prepare(
    'UPDATE products SET name=?, category=?, price=?, stock=?, desc=?, img=? WHERE id=?'
  ).run(
    name ?? existing.name,
    category ?? existing.category,
    price ?? existing.price,
    stock ?? existing.stock,
    desc ?? existing.desc,
    img !== undefined ? img : existing.img,
    req.params.id
  );
  res.json({ ok: true });
});

// DELETE product
app.delete('/api/products/:id', (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ════════════════════════════════
//   ORDERS
// ════════════════════════════════

// GET all orders
app.get('/api/orders', (req, res) => {
  const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  const orders = rows.map(o => ({
    ...o,
    items: JSON.parse(o.items),
    customer: {
      name: o.customer_name,
      phone: o.customer_phone,
      address: o.customer_address,
      obs: o.customer_obs
    }
  }));
  res.json(orders);
});

// POST create order
app.post('/api/orders', (req, res) => {
  const { customer, items, total, payment, deliveryDate, deliveryTime, status } = req.body;
  if (!customer?.name || !customer?.phone || !items?.length || !deliveryDate) {
    return res.status(400).json({ error: 'Dados do pedido incompletos' });
  }

  const id = genId();

  // Decrement stock for each item
  const updateStock = db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?');
  const insertOrder = db.prepare(
    `INSERT INTO orders
       (id, customer_name, customer_phone, customer_address, customer_obs,
        items, total, payment, delivery_date, delivery_time, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  );

  db.transaction(() => {
    for (const item of items) {
      updateStock.run(item.qty, item.id);
    }
    insertOrder.run(
      id,
      customer.name, customer.phone, customer.address || null, customer.obs || null,
      JSON.stringify(items),
      total, payment, deliveryDate, deliveryTime || null,
      status || 'pendente'
    );
  })();

  res.json({ id });
});

// PATCH update order status
app.patch('/api/orders/:id/status', (req, res) => {
  const { status } = req.body;
  const allowed = ['pendente', 'confirmado', 'entregue', 'cancelado'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Status invalido' });
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

// ════════════════════════════════
//   PIX CONFIG
// ════════════════════════════════

app.get('/api/pix', (req, res) => {
  const row = db.prepare('SELECT * FROM pix_config WHERE id = 1').get();
  res.json(row || {});
});

app.put('/api/pix', (req, res) => {
  const { key, type, name } = req.body;
  if (!key) return res.status(400).json({ error: 'Chave PIX obrigatoria' });
  db.prepare('UPDATE pix_config SET key=?, type=?, name=? WHERE id=1').run(key, type, name);
  res.json({ ok: true });
});

// ════════════════════════════════
//   START
// ════════════════════════════════
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Banco de dados: ${DB_PATH}`);
});
