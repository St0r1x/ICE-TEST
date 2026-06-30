/* ============================================================
   ICE CREAM REVIEW — 冰淇淋评鉴所
   Frontend Application
   ============================================================ */

// --- GLOBAL STATE ---
const state = {
  products: [],
  brands: [],
  activeBrand: '',
  activeTab: 'browse',
};

// --- DOM REFS ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  brandChips: $('#brandChips'),
  productGrid: $('#productGrid'),
  productCount: $('#productCount'),
  emptyState: $('#emptyState'),
  tabButtons: $$('.tab-btn'),
  tabPanels: $$('.tab-panel'),
  detailModal: $('#detailModal'),
  modalContent: $('#modalContent'),
  modalClose: $('#modalClose'),
  addProductForm: $('#addProductForm'),
  prodBrandSelect: $('#prodBrandSelect'),
  toast: $('#toast'),
};

// --- ICON MAPPING ---
const iconStyles = ['chocolate', 'vanilla', 'strawberry', 'matcha', 'blueberry', 'mango', 'default'];
const iconEmojis = ['🍫', '🍦', '🍓', '🍵', '🫐', '🥭', '🍨'];

function getIconForProduct(product) {
  const hash = (product.name + product.brand).split('').reduce((h, c) => h + c.charCodeAt(0), 0);
  return {
    style: iconStyles[hash % iconStyles.length],
    emoji: iconEmojis[hash % iconEmojis.length],
  };
}

// --- TOAST ---
let toastTimer;
function showToast(message, type = '') {
  clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.className = 'toast ' + type;
  dom.toast.style.display = 'block';
  toastTimer = setTimeout(() => {
    dom.toast.style.display = 'none';
  }, 2500);
}

// --- API HELPERS ---
async function api(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || '请求失败');
    }
    return data;
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

// --- INIT ---
async function init() {
  await Promise.all([loadBrands(), loadProducts()]);
  setupEventListeners();
}

// --- LOAD BRANDS ---
async function loadBrands() {
  try {
    state.brands = await api('/api/brands');
    renderBrandChips();
  } catch (e) {
    // handled by api helper
  }
}

// --- LOAD PRODUCTS ---
async function loadProducts(brand = '') {
  try {
    const url = brand ? `/api/products?brand=${encodeURIComponent(brand)}` : '/api/products';
    state.products = await api(url);
    state.activeBrand = brand;
    renderProductGrid();
    updateBrandChipActive();
  } catch (e) {
    state.products = [];
    renderProductGrid();
  }
}

// --- RENDER BRAND CHIPS ---
function renderBrandChips() {
  dom.brandChips.innerHTML = state.brands.map(b =>
    `<button class="brand-chip" data-brand="${escapeHtml(b.name)}">
      ${escapeHtml(b.name)} <span class="count">${b.count}</span>
    </button>`
  ).join('');
}

function updateBrandChipActive() {
  $$('#brandChips .brand-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.brand === state.activeBrand);
  });
  const allChip = $('.brand-chip[data-brand=""]');
  if (allChip) allChip.classList.toggle('active', state.activeBrand === '');
}

// --- RENDER PRODUCT GRID ---
function renderProductGrid() {
  dom.productCount.textContent = `共 ${state.products.length} 款产品`;

  if (state.products.length === 0) {
    dom.productGrid.innerHTML = '';
    dom.emptyState.style.display = 'block';
    return;
  }

  dom.emptyState.style.display = 'none';
  dom.productGrid.innerHTML = state.products.map(p => {
    const icon = getIconForProduct(p);
    return `
      <div class="product-card" data-id="${p.id}" onclick="openProductDetail('${p.id}')">
        <div class="card-icon ${icon.style}">${icon.emoji}</div>
        <div class="card-info">
          <div class="card-header">
            <span class="card-name">${escapeHtml(p.name)}</span>
            <span class="card-brand">${escapeHtml(p.brand)}</span>
          </div>
          <div class="card-meta">
            <span class="card-price">¥${p.price.toFixed(1)}</span>
            <span class="card-rating" id="cardRating-${p.id}">加载中...</span>
          </div>
        </div>
        <span class="card-arrow">›</span>
      </div>
    `;
  }).join('');

  // Load rating stats for each product
  state.products.forEach(p => loadCardRating(p.id));
}

async function loadCardRating(productId) {
  try {
    const stats = await api(`/api/products/${productId}/stats`);
    const el = document.getElementById(`cardRating-${productId}`);
    if (!el) return;
    if (stats.avgRating === null) {
      el.innerHTML = '<span class="no-rating">暂无评分</span>';
    } else {
      el.innerHTML = `${renderStars(stats.avgRating)} <span class="rating-text">${stats.avgRating}</span>`;
    }
  } catch (e) {
    // silently fail for card ratings
  }
}

// --- STAR RENDERING ---
function renderStars(rating, maxStars = 10) {
  // Convert 10-point to 5 stars for display
  const starCount = Math.round(rating / 2);
  let html = '<span class="stars">';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="star${i <= starCount ? '' : ' empty'}">★</span>`;
  }
  html += '</span>';
  return html;
}

function renderStarsFull(count, max = 10) {
  let html = '<span class="stars">';
  for (let i = 1; i <= max; i++) {
    html += `<span class="star${i <= count ? '' : ' empty'}" style="font-size:0.75rem;">★</span>`;
  }
  html += '</span>';
  return html;
}

// --- PRODUCT DETAIL MODAL ---
async function openProductDetail(productId) {
  try {
    const product = await api(`/api/products/${productId}`);
    dom.modalContent.innerHTML = renderModalContent(product);
    dom.detailModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setupModalListeners(product);
  } catch (e) {
    // handled by api helper
  }
}

function closeModal() {
  dom.detailModal.style.display = 'none';
  document.body.style.overflow = '';
}

function renderModalContent(product) {
  const icon = getIconForProduct(product);

  // Rating distribution bars
  let ratingBarsHtml = '';
  if (product.reviewCount > 0) {
    const dist = {};
    product.reviews.forEach(r => { dist[r.rating] = (dist[r.rating] || 0) + 1; });
    for (let i = 10; i >= 1; i--) {
      const count = dist[i] || 0;
      const pct = product.reviewCount > 0 ? Math.round((count / product.reviewCount) * 100) : 0;
      ratingBarsHtml += `
        <div class="rating-bar-row">
          <span class="bar-label">${i}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
          <span class="bar-count">${count}</span>
        </div>
      `;
    }
  }

  // Reviews
  let reviewsHtml = '';
  if (product.reviews.length === 0) {
    reviewsHtml = '<div class="no-reviews">还没有人评价过这款产品，来做第一个吧！🍦</div>';
  } else {
    reviewsHtml = product.reviews.map(r => {
      const pvLabels = { great: '超值 👍', good: '值得 😊', fair: '还行 🤔', overpriced: '偏贵 💸' };
      return `
        <div class="review-card">
          <div class="review-header">
            <div class="review-rating">
              ${renderStarsFull(r.rating)}
              <span class="review-rating-num">${r.rating}/10</span>
            </div>
          </div>
          ${r.taste ? `<div class="review-taste">${escapeHtml(r.taste)}</div>` : ''}
          <div class="review-footer">
            <span class="price-value-badge ${r.priceValue}">${pvLabels[r.priceValue] || r.priceValue}</span>
            <span>${formatDate(r.createdAt)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  return `
    <div class="modal-product-header">
      <div class="modal-product-icon card-icon ${icon.style}">${icon.emoji}</div>
      <div class="modal-product-info">
        <h2>${escapeHtml(product.name)}</h2>
        <div class="modal-product-meta">
          <span class="card-brand">${escapeHtml(product.brand)}</span>
          <span>¥${product.price.toFixed(1)}</span>
          ${product.avgRating !== null ? `<span>⭐ ${product.avgRating}（${product.reviewCount}条评价）</span>` : ''}
        </div>
      </div>
    </div>

    ${product.description ? `<div class="modal-product-desc">📋 ${escapeHtml(product.description)}</div>` : ''}

    ${product.reviewCount > 0 ? `
    <div class="rating-summary">
      <div class="rating-big">
        <div class="rating-number">${product.avgRating}</div>
        <div class="rating-label">综合评分</div>
      </div>
      <div class="rating-bars">${ratingBarsHtml}</div>
    </div>
    ` : ''}

    <div class="reviews-section">
      <h3>💬 用户评价（${product.reviewCount}）</h3>
      ${reviewsHtml}
    </div>

    <div class="review-form-section">
      <h3>✍️ 写评价</h3>
      <form id="reviewForm" class="product-form">
        <div class="form-group">
          <label>评分 <span class="required">*</span> <span id="ratingDisplay" class="star-rating-value">未选择</span></label>
          <div class="star-rating-input" id="starRatingInput">
            ${Array.from({length: 10}, (_, i) =>
              `<button type="button" class="star-btn" data-rating="${i + 1}" title="${i + 1}分">★</button>`
            ).join('')}
          </div>
          <input type="hidden" id="reviewRating" value="">
        </div>
        <div class="form-group">
          <label for="reviewTaste">口味描述</label>
          <textarea id="reviewTaste" rows="2" placeholder="这款冰淇淋吃起来怎么样？口感、味道..."></textarea>
        </div>
        <div class="form-group">
          <label>性价比评价</label>
          <div class="price-value-group">
            <input type="radio" name="priceValue" value="great" id="pvGreat" class="price-value-option" checked>
            <label for="pvGreat" class="price-value-label">超值 👍</label>
            <input type="radio" name="priceValue" value="good" id="pvGood" class="price-value-option">
            <label for="pvGood" class="price-value-label">值得 😊</label>
            <input type="radio" name="priceValue" value="fair" id="pvFair" class="price-value-option">
            <label for="pvFair" class="price-value-label">还行 🤔</label>
            <input type="radio" name="priceValue" value="overpriced" id="pvOver" class="price-value-option">
            <label for="pvOver" class="price-value-label">偏贵 💸</label>
          </div>
        </div>
        <div id="reviewFormError" class="form-error" style="display:none;"></div>
        <button type="submit" class="btn btn-primary btn-full">提交评价</button>
      </form>
    </div>
  `;
}

function setupModalListeners(product) {
  // Star rating input
  const starBtns = $$('#starRatingInput .star-btn');
  const ratingDisplay = $('#ratingDisplay');
  const ratingInput = $('#reviewRating');

  function updateStars(val) {
    starBtns.forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.rating) <= val);
    });
    ratingDisplay.textContent = val ? `${val}/10 分` : '未选择';
    ratingInput.value = val;
  }

  starBtns.forEach(btn => {
    btn.addEventListener('click', () => updateStars(parseInt(btn.dataset.rating)));
    btn.addEventListener('mouseenter', () => {
      const val = parseInt(btn.dataset.rating);
      starBtns.forEach(b => b.classList.toggle('active', parseInt(b.dataset.rating) <= val));
    });
  });

  const starContainer = $('#starRatingInput');
  starContainer.addEventListener('mouseleave', () => {
    updateStars(parseInt(ratingInput.value) || 0);
  });

  // Review form submission
  const reviewForm = $('#reviewForm');
  reviewForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rating = parseInt(ratingInput.value);
    if (!rating) {
      $('#reviewFormError').style.display = 'block';
      $('#reviewFormError').textContent = '请选择评分';
      return;
    }

    const taste = $('#reviewTaste').value.trim();
    const priceValue = document.querySelector('input[name="priceValue"]:checked').value;

    try {
      await api('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id, taste, rating, priceValue }),
      });
      showToast('评价提交成功！🎉', 'success');
      // Refresh modal content
      const updated = await api(`/api/products/${product.id}`);
      dom.modalContent.innerHTML = renderModalContent(updated);
      setupModalListeners(updated);
      // Refresh card ratings
      loadCardRating(product.id);
    } catch (e) {
      $('#reviewFormError').style.display = 'block';
      $('#reviewFormError').textContent = e.message || '提交失败，请重试';
    }
  });
}

// --- TAB SWITCHING ---
function switchTab(tabName) {
  state.activeTab = tabName;
  dom.tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
  dom.tabPanels.forEach(panel => panel.classList.toggle('active', panel.id === `tab-${tabName}`));
  if (tabName === 'add') {
    populateBrandSelect();
  }
}

async function populateBrandSelect() {
  const select = dom.prodBrandSelect;
  const currentBrands = select.dataset.loaded;
  if (currentBrands === 'true') return;
  try {
    const brands = await api('/api/brands');
    select.innerHTML = '<option value="">选择已有品牌</option>' +
      brands.map(b => `<option value="${escapeHtml(b.name)}">${escapeHtml(b.name)}</option>`).join('');
    select.dataset.loaded = 'true';
  } catch (e) {
    // handled
  }
}

// --- ADD PRODUCT FORM ---
async function handleAddProduct(e) {
  e.preventDefault();

  const name = $('#prodName').value.trim();
  const brandSelect = $('#prodBrandSelect').value;
  const brandNew = $('#prodBrandNew').value.trim();
  const price = $('#prodPrice').value;
  const description = $('#prodDesc').value.trim();

  const brand = brandNew || brandSelect;

  // Validation
  if (!name || !brand || !price) {
    $('#addProductError').style.display = 'block';
    $('#addProductError').textContent = '请填写产品名称、品牌和价格';
    $('#addProductSuccess').style.display = 'none';
    return;
  }

  if (parseFloat(price) <= 0) {
    $('#addProductError').style.display = 'block';
    $('#addProductError').textContent = '价格必须大于0';
    $('#addProductSuccess').style.display = 'none';
    return;
  }

  try {
    const result = await api('/api/products', {
      method: 'POST',
      body: JSON.stringify({ name, brand, price: parseFloat(price), description }),
    });

    $('#addProductError').style.display = 'none';
    $('#addProductSuccess').style.display = 'block';
    $('#addProductSuccess').textContent = `"${result.name}" 添加成功！你可以在浏览页面找到它并开始评价。`;

    // Reset form
    $('#prodName').value = '';
    $('#prodBrandSelect').value = '';
    $('#prodBrandNew').value = '';
    $('#prodPrice').value = '';
    $('#prodDesc').value = '';

    // Refresh brands and products
    await loadBrands();
    await loadProducts(state.activeBrand);
  } catch (e) {
    $('#addProductError').style.display = 'block';
    $('#addProductSuccess').style.display = 'none';
    if (e.message === '该产品已存在') {
      $('#addProductError').textContent = '⚠️ 该产品已经存在，无需重复添加。你可以在浏览页面找到它并评价。';
    } else {
      $('#addProductError').textContent = e.message || '添加失败，请重试';
    }
  }
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
  // Tab buttons
  dom.tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Brand filter chips (delegation)
  dom.brandChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.brand-chip');
    if (!chip) return;
    loadProducts(chip.dataset.brand);
  });

  // Modal close
  dom.modalClose.addEventListener('click', closeModal);
  dom.detailModal.addEventListener('click', (e) => {
    if (e.target === dom.detailModal) closeModal();
  });

  // ESC to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dom.detailModal.style.display === 'flex') {
      closeModal();
    }
  });

  // Add product form
  dom.addProductForm.addEventListener('submit', handleAddProduct);

  // Clear error on input
  $('#prodName').addEventListener('input', () => {
    $('#addProductError').style.display = 'none';
  });
  $('#prodBrandNew').addEventListener('input', () => {
    $('#addProductError').style.display = 'none';
  });
  $('#prodPrice').addEventListener('input', () => {
    $('#addProductError').style.display = 'none';
  });
}

// --- UTILITIES ---
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

// --- BOOT ---
init();
