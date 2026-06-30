const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Database Setup ---
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'icecream.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    price REAL NOT NULL,
    image TEXT DEFAULT '',
    description TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    taste TEXT DEFAULT '',
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 10),
    price_value TEXT DEFAULT 'fair' CHECK(price_value IN ('overpriced','fair','good','great')),
    created_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
  CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
`);

// --- Seed Data Migration ---
const seedProducts = [
  { id: 'p001', name: '巧乐兹', brand: '伊利', price: 5.0, description: '经典巧克力脆皮搭配香草冰淇淋，三层夹心，口感丰富' },
  { id: 'p002', name: '冰工厂', brand: '伊利', price: 2.0, description: '清爽水果味冰棍，夏日解暑必备，有多种水果口味可选' },
  { id: 'p003', name: '随变', brand: '蒙牛', price: 4.0, description: '巧克力脆皮+香草冰淇淋，经典随变系列，酥脆外皮' },
  { id: 'p004', name: '绿色心情', brand: '蒙牛', price: 3.0, description: '绿豆沙冰淇淋，低糖健康，口感绵密清甜' },
  { id: 'p005', name: '可爱多', brand: '和路雪', price: 6.0, description: '甜筒冰淇淋，顶部巧克力尖，蛋筒酥脆，奶香浓郁' },
  { id: 'p006', name: '梦龙', brand: '和路雪', price: 10.0, description: '比利时巧克力脆皮，选用进口奶源，口感奢华醇厚' },
  { id: 'p007', name: '八喜香草杯', brand: '八喜', price: 8.0, description: '美式风格冰淇淋，香草口味经典款，奶味纯正浓郁' },
  { id: 'p008', name: '轻牛乳雪糕', brand: '钟薛高', price: 15.0, description: '高端国产雪糕代表，牛乳含量高，口感丝滑，瓦片造型' },
  { id: 'p009', name: '东北大板', brand: '东北大板', price: 3.0, description: '怀旧风格冰淇淋，奶味十足，分量实在，性价比高' },
  { id: 'p010', name: '千层雪', brand: '和路雪', price: 7.0, description: '千层酥皮包裹细腻冰淇淋，层次分明，口感独特' },
];

const seedReviews = [
  { id: 'r001', productId: 'p001', taste: '巧克力脆皮很厚实，里面的香草冰淇淋奶味很足，夏天必买！', rating: 9, priceValue: 'great' },
  { id: 'r002', productId: 'p001', taste: '经典款不用多说，从小吃到大，5块钱很值', rating: 8, priceValue: 'good' },
  { id: 'r003', productId: 'p006', taste: '比利时巧克力真的绝了，咬下去咔嚓一声，不过10块钱确实有点贵', rating: 9, priceValue: 'fair' },
  { id: 'r004', productId: 'p005', taste: '甜筒的蛋卷特别脆，顶部的巧克力尖是灵魂，6块钱性价比不错', rating: 8, priceValue: 'good' },
  { id: 'r005', productId: 'p008', taste: '确实比普通雪糕好吃，但15块钱一根还是有点心疼', rating: 7, priceValue: 'overpriced' },
  { id: 'r006', productId: 'p004', taste: '绿豆味很清爽，不会太甜，夏天吃很解暑', rating: 7, priceValue: 'great' },
];

// Seed only if products table is empty
const count = db.prepare('SELECT COUNT(*) as c FROM products').get();
if (count.c === 0) {
  const insertProduct = db.prepare(
    'INSERT INTO products (id, name, brand, price, image, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insertReview = db.prepare(
    'INSERT INTO reviews (id, product_id, taste, rating, price_value, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const seedAll = db.transaction(() => {
    for (const p of seedProducts) {
      insertProduct.run(p.id, p.name, p.brand, p.price, '', p.description, '2026-06-01T00:00:00.000Z');
    }
    for (const r of seedReviews) {
      insertReview.run(r.id, r.productId, r.taste, r.rating, r.priceValue, '2026-06-20T00:00:00.000Z');
    }
  });
  seedAll();
  console.log('🌱 种子数据已导入');
}

// --- Prepared Statements ---
const stmt = {
  // Products
  allProducts: db.prepare('SELECT * FROM products ORDER BY created_at DESC'),
  productsByBrand: db.prepare('SELECT * FROM products WHERE brand = ? ORDER BY created_at DESC'),
  productById: db.prepare('SELECT * FROM products WHERE id = ?'),
  insertProduct: db.prepare(
    'INSERT INTO products (id, name, brand, price, image, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ),
  findDuplicate: db.prepare(
    'SELECT * FROM products WHERE LOWER(name) = LOWER(?) AND LOWER(brand) = LOWER(?)'
  ),
  allBrands: db.prepare(
    'SELECT brand as name, COUNT(*) as count FROM products GROUP BY brand ORDER BY brand'
  ),

  // Reviews
  reviewsByProduct: db.prepare(
    'SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC'
  ),
  reviewStats: db.prepare(
    'SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM reviews WHERE product_id = ?'
  ),
  reviewDistribution: db.prepare(
    'SELECT rating, COUNT(*) as count FROM reviews WHERE product_id = ? GROUP BY rating ORDER BY rating DESC'
  ),
  insertReview: db.prepare(
    'INSERT INTO reviews (id, product_id, taste, rating, price_value, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ),
};

// ==================== PRODUCT ROUTES ====================

// GET /api/products
app.get('/api/products', (req, res) => {
  const { brand } = req.query;
  const products = brand ? stmt.productsByBrand.all(brand) : stmt.allProducts.all();
  res.json(products.map(formatProduct));
});

// GET /api/products/:id
app.get('/api/products/:id', (req, res) => {
  const product = stmt.productById.get(req.params.id);
  if (!product) return res.status(404).json({ error: '产品未找到' });

  const reviews = stmt.reviewsByProduct.all(product.id);
  const stats = stmt.reviewStats.get(product.id);
  const avgRating = stats.avg_rating ? parseFloat(stats.avg_rating.toFixed(1)) : null;

  res.json({
    ...formatProduct(product),
    reviews: reviews.map(formatReview),
    reviewCount: stats.count,
    avgRating,
  });
});

// POST /api/products
app.post('/api/products', (req, res) => {
  const { name, brand, price, description, image } = req.body;

  if (!name || !brand || price == null) {
    return res.status(400).json({ error: '产品名称、品牌和价格不能为空' });
  }

  // Duplicate check
  const duplicate = stmt.findDuplicate.get(name.trim(), brand.trim());
  if (duplicate) {
    return res.status(409).json({
      error: '该产品已存在',
      existingProduct: formatProduct(duplicate),
    });
  }

  const newProduct = {
    id: uuidv4(),
    name: name.trim(),
    brand: brand.trim(),
    price: parseFloat(price),
    image: image || '',
    description: description || '',
    created_at: new Date().toISOString(),
  };

  stmt.insertProduct.run(
    newProduct.id, newProduct.name, newProduct.brand, newProduct.price,
    newProduct.image, newProduct.description, newProduct.created_at
  );

  res.status(201).json(formatProduct(newProduct));
});

// ==================== BRAND ROUTES ====================

// GET /api/brands
app.get('/api/brands', (req, res) => {
  const brands = stmt.allBrands.all();
  res.json(brands);
});

// ==================== REVIEW ROUTES ====================

// GET /api/products/:id/reviews
app.get('/api/products/:id/reviews', (req, res) => {
  const reviews = stmt.reviewsByProduct.all(req.params.id);
  res.json(reviews.map(formatReview));
});

// GET /api/products/:id/stats
app.get('/api/products/:id/stats', (req, res) => {
  const stats = stmt.reviewStats.get(req.params.id);
  if (!stats || stats.count === 0) {
    return res.json({ avgRating: null, count: 0, distribution: {} });
  }

  const distRows = stmt.reviewDistribution.all(req.params.id);
  const distribution = {};
  distRows.forEach(r => { distribution[r.rating] = r.count; });

  res.json({
    avgRating: parseFloat(stats.avg_rating.toFixed(1)),
    count: stats.count,
    distribution,
  });
});

// POST /api/reviews
app.post('/api/reviews', (req, res) => {
  const { productId, taste, rating, priceValue } = req.body;

  if (!productId || rating == null) {
    return res.status(400).json({ error: '产品和评分不能为空' });
  }

  if (rating < 1 || rating > 10) {
    return res.status(400).json({ error: '评分必须在1-10之间' });
  }

  const validPriceValues = ['overpriced', 'fair', 'good', 'great'];
  if (priceValue && !validPriceValues.includes(priceValue)) {
    return res.status(400).json({ error: '性价比评价无效' });
  }

  // Verify product exists
  const product = stmt.productById.get(productId);
  if (!product) {
    return res.status(404).json({ error: '产品未找到' });
  }

  const newReview = {
    id: uuidv4(),
    product_id: productId,
    taste: (taste || '').trim(),
    rating: parseInt(rating),
    price_value: priceValue || 'fair',
    created_at: new Date().toISOString(),
  };

  stmt.insertReview.run(
    newReview.id, newReview.product_id, newReview.taste,
    newReview.rating, newReview.price_value, newReview.created_at
  );

  res.status(201).json(formatReview(newReview));
});

// ==================== FORMAT HELPERS ====================

function formatProduct(row) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    price: row.price,
    image: row.image,
    description: row.description,
    createdAt: row.created_at,
  };
}

function formatReview(row) {
  return {
    id: row.id,
    productId: row.product_id,
    taste: row.taste,
    rating: row.rating,
    priceValue: row.price_value,
    createdAt: row.created_at,
  };
}

// ==================== STATIC FILES ====================

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== START ====================

app.listen(PORT, () => {
  console.log(`🍦 冰淇淋评鉴所 服务器已启动：http://localhost:${PORT}`);
  console.log(`📦 数据库位置：${DB_PATH}`);
});
