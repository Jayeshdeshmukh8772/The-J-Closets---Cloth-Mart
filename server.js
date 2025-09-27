import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import sqlite3 from 'sqlite3';
import QRCode from 'qrcode';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import { promisify } from 'util';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
// Simple request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});
app.use(express.static('dist'));

// Initialize SQLite Database
const db = new sqlite3.Database('./cloth_shop.db');

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    discount REAL DEFAULT 0,
    category TEXT,
    size TEXT,
    color TEXT,
    stock INTEGER DEFAULT 0,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT,
    customer_phone TEXT,
    items TEXT NOT NULL,
    total_amount REAL NOT NULL,
    discount_amount REAL DEFAULT 0,
    payment_status TEXT DEFAULT 'pending',
    payment_method TEXT,
    razorpay_order_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Insert sample products
  db.run(`INSERT OR IGNORE INTO products (id, name, description, price, discount, category, size, color, stock) VALUES
    (1, 'Cotton Casual Shirt', 'Premium cotton casual shirt for everyday wear', 899.00, 10, 'Shirts', 'M', 'Blue', 25),
    (2, 'Formal Trouser', 'Professional formal trouser perfect for office', 1299.00, 15, 'Trousers', 'L', 'Black', 20),
    (3, 'Designer T-Shirt', 'Trendy designer t-shirt with modern print', 599.00, 5, 'T-Shirts', 'S', 'White', 30),
    (4, 'Denim Jeans', 'Classic denim jeans with perfect fit', 1599.00, 20, 'Jeans', 'M', 'Blue', 15),
    (5, 'Summer Dress', 'Elegant summer dress for special occasions', 2199.00, 25, 'Dresses', 'M', 'Pink', 18)
  `);
});

// UPI configuration (free flow, no gateway)
const UPI_VPA = process.env.UPI_VPA || 'merchant@upi';
const UPI_PAYER_NAME = process.env.UPI_PAYER_NAME || 'ClothShop';

// Routes
// CSV export helpers
const writeFileAsync = promisify(fs.writeFile);
function toCsv(rows) {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (val) => {
    if (val == null) return '';
    const s = String(val);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escape(row[h])).join(','));
  }
  return lines.join('\n');
}
async function exportProductsCsv() {
  db.all('SELECT * FROM products ORDER BY id ASC', async (err, rows) => {
    if (err) return;
    const csv = toCsv(rows);
    try { await writeFileAsync('./products.csv', csv, 'utf8'); } catch {}
  });
}
async function exportOrdersCsv() {
  db.all('SELECT * FROM orders ORDER BY id ASC', async (err, rows) => {
    if (err) return;
    const csv = toCsv(rows);
    try { await writeFileAsync('./orders.csv', csv, 'utf8'); } catch {}
  });
}

async function exportWorkbookXlsx() {
  db.all('SELECT * FROM products ORDER BY id ASC', (errP, products) => {
    if (errP) return;
    db.all('SELECT * FROM orders ORDER BY id ASC', (errO, orders) => {
      if (errO) return;
      const wb = XLSX.utils.book_new();
      const wsProducts = XLSX.utils.json_to_sheet(products || []);
      const wsOrders = XLSX.utils.json_to_sheet((orders || []).map(o => ({
        id: o.id,
        customer_name: o.customer_name,
        customer_phone: o.customer_phone,
        total_amount: o.total_amount,
        discount_amount: o.discount_amount,
        payment_status: o.payment_status,
        created_at: o.created_at
      })));
      XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');
      XLSX.utils.book_append_sheet(wb, wsOrders, 'Orders');
      try {
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        await writeFileAsync('./inventory_and_orders.xlsx', wbout);
      } catch {}
    });
  });
}


// Get all products
app.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Basic validators
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const isNonNegativeNumber = (v) => typeof v === 'number' && !Number.isNaN(v) && v >= 0;

// Get single product
app.get('/api/products/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Product not found' });
    res.json(row);
  });
});

// Add product
app.post('/api/products', (req, res) => {
  const { name, description, price, discount, category, size, color, stock } = req.body;
  if (!isNonEmptyString(name) || !isNonEmptyString(category) || !isNonEmptyString(size) || !isNonEmptyString(color)) {
    return res.status(400).json({ error: 'name, category, size, color are required' });
  }
  if (!isNonNegativeNumber(price)) return res.status(400).json({ error: 'price must be a non-negative number' });
  if (discount != null && (typeof discount !== 'number' || discount < 0 || discount > 100)) {
    return res.status(400).json({ error: 'discount must be between 0 and 100' });
  }
  if (stock != null && (!Number.isInteger(stock) || stock < 0)) {
    return res.status(400).json({ error: 'stock must be a non-negative integer' });
  }
  
  db.run(
    'INSERT INTO products (name, description, price, discount, category, size, color, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [name, description, price, discount || 0, category, size, color, stock || 0],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      exportProductsCsv();
      exportWorkbookXlsx();
      res.json({ id: this.lastID, message: 'Product added successfully' });
    }
  );
});

// Update product
app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, price, discount, category, size, color, stock } = req.body;
  if (!isNonEmptyString(name) || !isNonEmptyString(category) || !isNonEmptyString(size) || !isNonEmptyString(color)) {
    return res.status(400).json({ error: 'name, category, size, color are required' });
  }
  if (!isNonNegativeNumber(price)) return res.status(400).json({ error: 'price must be a non-negative number' });
  if (discount != null && (typeof discount !== 'number' || discount < 0 || discount > 100)) {
    return res.status(400).json({ error: 'discount must be between 0 and 100' });
  }
  if (stock != null && (!Number.isInteger(stock) || stock < 0)) {
    return res.status(400).json({ error: 'stock must be a non-negative integer' });
  }
  
  db.run(
    'UPDATE products SET name = ?, description = ?, price = ?, discount = ?, category = ?, size = ?, color = ?, stock = ? WHERE id = ?',
    [name, description, price, discount || 0, category, size, color, stock || 0, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      exportProductsCsv();
      exportWorkbookXlsx();
      res.json({ message: 'Product updated successfully' });
    }
  );
});

// Delete product
app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    exportProductsCsv();
    exportWorkbookXlsx();
    res.json({ message: 'Product deleted successfully' });
  });
});

// Create order
app.post('/api/orders', (req, res) => {
  const { customer_name, customer_phone, items, total_amount, discount_amount } = req.body;
  if (!isNonEmptyString(customer_name)) return res.status(400).json({ error: 'customer_name is required' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array is required' });
  if (!isNonNegativeNumber(total_amount)) return res.status(400).json({ error: 'total_amount must be non-negative number' });
  if (discount_amount != null && !isNonNegativeNumber(discount_amount)) return res.status(400).json({ error: 'discount_amount must be non-negative number' });
  
  db.run(
    'INSERT INTO orders (customer_name, customer_phone, items, total_amount, discount_amount) VALUES (?, ?, ?, ?, ?)',
    [customer_name, customer_phone, JSON.stringify(items), total_amount, discount_amount || 0],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      exportOrdersCsv();
      exportWorkbookXlsx();
      res.json({ id: this.lastID, message: 'Order created successfully' });
    }
  );
});

// Product QR (encode product id)
app.get('/api/products/:id/qr', async (req, res) => {
  try {
    const { id } = req.params;
    db.get('SELECT id, name FROM products WHERE id = ?', [id], async (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Product not found' });
      const payload = JSON.stringify({ type: 'product', id: row.id });
      const dataUrl = await QRCode.toDataURL(payload);
      res.json({ id: row.id, name: row.name, qrCode: dataUrl });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Invoice PDF
app.get('/api/orders/:id/invoice.pdf', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM orders WHERE id = ?', [id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    let items = [];
    try { items = JSON.parse(order.items) || []; } catch (_) {}

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${id}.pdf"`);
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    doc.pipe(res);

    // Header
    doc.rect(36, 36, 523, 60).fill('#2563eb');
    doc.fillColor('#ffffff').fontSize(20).text('ClothCraft', 48, 56, { continued: true });
    doc.fontSize(12).text(`Invoice #${String(id).padStart(4, '0')}`, 420, 56);
    doc.fillColor('#dbeafe').fontSize(10).text('Professional Billing System', 48, 80);

    doc.moveDown(3);
    doc.fillColor('#0f172a').fontSize(12).text(`Date: ${new Date(order.created_at).toLocaleString()}`);
    doc.text(`Customer: ${order.customer_name}${order.customer_phone ? ' (' + order.customer_phone + ')' : ''}`);
    doc.moveDown();

    // Items table
    const startY = doc.y;
    doc.fontSize(12).fillColor('#334155').text('Item', 48, startY);
    doc.text('Details', 200, startY);
    doc.text('Qty', 360, startY, { width: 40, align: 'right' });
    doc.text('Unit', 410, startY, { width: 60, align: 'right' });
    doc.text('Total', 480, startY, { width: 80, align: 'right' });
    doc.moveTo(48, startY + 16).lineTo(560, startY + 16).stroke('#e2e8f0');

    let y = startY + 24;
    items.forEach((item) => {
      const unit = item.price - (item.price * (item.discount || 0) / 100);
      doc.fillColor('#0f172a').text(item.name, 48, y);
      doc.fillColor('#64748b').fontSize(10).text(`${item.category || ''} ${item.size ? ' • ' + item.size : ''} ${item.color ? ' • ' + item.color : ''}`, 200, y);
      doc.fontSize(12).fillColor('#0f172a').text(String(item.quantity), 360, y, { width: 40, align: 'right' });
      doc.text(`₹${unit.toFixed(2)}`, 410, y, { width: 60, align: 'right' });
      doc.text(`₹${(unit * item.quantity).toFixed(2)}`, 480, y, { width: 80, align: 'right' });
      y += 20;
    });

    doc.moveTo(48, y).lineTo(560, y).stroke('#e2e8f0');
    y += 12;

    doc.fontSize(12).fillColor('#334155').text('Subtotal', 410, y, { width: 60, align: 'right' });
    doc.fillColor('#0f172a').text(`₹${(order.total_amount + order.discount_amount).toFixed(2)}`, 480, y, { width: 80, align: 'right' });
    y += 18;
    if (order.discount_amount > 0) {
      doc.fillColor('#334155').text('Discount', 410, y, { width: 60, align: 'right' });
      doc.fillColor('#16a34a').text(`-₹${order.discount_amount.toFixed(2)}`, 480, y, { width: 80, align: 'right' });
      y += 18;
    }
    doc.fontSize(14).fillColor('#0f172a').text('Total', 410, y, { width: 60, align: 'right' });
    doc.fontSize(14).text(`₹${order.total_amount.toFixed(2)}`, 480, y, { width: 80, align: 'right' });

    // Footer
    doc.fillColor('#64748b').fontSize(10).text('Thank you for shopping with us!', 48, y + 36);
    doc.text('For any queries, contact us at the store.', 48, y + 52);

    doc.end();
  });
});

// Generate QR Code for payment (free UPI deep link)
app.post('/api/generate-qr', async (req, res) => {
  try {
    const { amount, orderId } = req.body;
    if (!amount || !orderId) {
      return res.status(400).json({ error: 'amount and orderId are required' });
    }
    const upiUrl = `upi://pay?pa=${encodeURIComponent(UPI_VPA)}&pn=${encodeURIComponent(UPI_PAYER_NAME)}&am=${encodeURIComponent(amount)}&cu=INR&tn=${encodeURIComponent('Payment for Order ' + orderId)}`;
    const qrCode = await QRCode.toDataURL(upiUrl);
    res.json({
      qrCode,
      upiUrl,
      amount,
      currency: 'INR'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark order paid and decrement inventory transactionally
app.post('/api/orders/:id/mark-paid', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM orders WHERE id = ?', [id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.payment_status === 'completed') {
      return res.json({ message: 'Order already marked as paid' });
    }

    let items = [];
    try {
      items = JSON.parse(order.items) || [];
    } catch (_) {
      items = [];
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      // Check and update stock for each item
      const updateStock = () => new Promise((resolve, reject) => {
        let processed = 0;
        for (const item of items) {
          const qty = Number(item.quantity) || 0;
          const productId = item.id;
          if (!productId || qty <= 0) {
            processed++;
            if (processed === items.length) resolve();
            continue;
          }
          db.get('SELECT stock FROM products WHERE id = ?', [productId], (e, row) => {
            if (e) return reject(e);
            if (!row) return reject(new Error('Product not found: ' + productId));
            if (row.stock < qty) return reject(new Error('Insufficient stock for product ' + productId));
            db.run('UPDATE products SET stock = stock - ? WHERE id = ?', [qty, productId], (e2) => {
              if (e2) return reject(e2);
              processed++;
              if (processed === items.length) resolve();
            });
          });
        }
        if (items.length === 0) resolve();
      });

      updateStock()
        .then(() => {
          db.run('UPDATE orders SET payment_status = ? WHERE id = ?', ['completed', id], (e3) => {
            if (e3) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: e3.message });
            }
            db.run('COMMIT');
            exportProductsCsv();
            exportOrdersCsv();
            exportWorkbookXlsx();
            return res.json({ message: 'Order marked as paid and inventory updated' });
          });
        })
        .catch((e) => {
          db.run('ROLLBACK');
          return res.status(400).json({ error: e.message });
        });
    });
  });
});

// Get orders
app.get('/api/orders', (req, res) => {
  db.all('SELECT * FROM orders ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Serve React app
app.get('*', (req, res, next) => {
  if (req.path.endsWith('.pdf') || req.path.endsWith('.csv') || req.path.endsWith('.xlsx')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Cloth Shop Server running on http://localhost:${PORT}`);
  console.log('📊 Database: SQLite');
  console.log('💳 Payment: Razorpay Integration');
});