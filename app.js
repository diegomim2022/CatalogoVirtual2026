// ============================
// CATÁLOGO DIGITAL DE PEDIDOS
// ============================

// ---- CONFIGURATION ----
const CONFIG = {
  vendorPhone: '573158512091', // Número WhatsApp del vendedor (admin)
  currency: 'COP',
  appName: 'Catalogo de Productos',
  sheetId: '1QMPMUbokrU0fHHL1EG2XTWfk6Cg5ITah_rttYDsMvyw',
  gids: {
    productos: '0',
    clientes: '1788392842'
  }
};

// ---- DEMO DATA ----
let PRODUCTS = [];

let DEMO_CLIENTS = [];

let CATEGORIES = [
  { id: 'all', label: 'Todos', icon: '🏷️' }
];

const CATEGORY_ICONS = {
  'Ropa': '👕',
  'Zapatos': '👟',
  'Bolsos': '👜',
  'Accesorios': '⌚',
  'Audio': '🎧',
  'Hogar': '🏠',
  'Belleza': '💄'
};

// ---- APP STATE ----
const state = {
  currentUser: null,
  currentScreen: 'login',
  cart: [],
  orders: JSON.parse(localStorage.getItem('orders') || '[]'),
  selectedCategory: 'all',
  searchQuery: '',
  selectedProduct: null,
  detailQty: 1,
  currentDetailImageIndex: 0,
  currentPromoIndex: 0,
  isLoading: false
};

// ---- UTILS & SYNC ----

async function fetchSheetData(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/export?format=csv&gid=${gid}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    const text = await response.text();
    return parseCSV(text);
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    return null;
  }
}

function transformDriveUrl(url) {
  if (!url || !url.includes('drive.google.com')) return url;

  // Extraer ID del archivo de diferentes formatos de Drive
  const regex = /\/d\/([^\/]+)(\/|$)|id=([^\&]+)/;
  const match = url.match(regex);
  const id = match ? (match[1] || match[3]) : null;

  if (id) {
    // Retornar link de visualización directa optimizado (lh3 es más rápido y estable)
    return `https://lh3.googleusercontent.com/d/${id}`;
  }
  return url;
}

function parseCSV(csv) {
  if (!csv) return [];
  const rows = [];
  let curVal = "";
  let curRow = [];
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const nextChar = csv[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') { curVal += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) {
      curRow.push(curVal.trim()); curVal = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (curRow.length > 0 || curVal) { curRow.push(curVal.trim()); rows.push(curRow); }
      curRow = []; curVal = "";
      if (char === '\r' && nextChar === '\n') i++;
    } else { curVal += char; }
  }
  if (curRow.length > 0 || curVal) { curRow.push(curVal.trim()); rows.push(curRow); }

  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
  const rawHeaders = rows[0].map(h => h.replace(/^\uFEFF/, '').replace(/^"|"$/g, '').trim());
  const normHeaders = rawHeaders.map(norm);

  return rows.slice(1).map(row => {
    const obj = {};
    rawHeaders.forEach((h, i) => {
      const v = (row[i] || "").replace(/^"|"$/g, '').trim();
      obj[h] = v;
      if (normHeaders[i]) obj[normHeaders[i]] = v;
    });
    return obj;
  });
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function initData() {
  state.isLoading = true;
  document.body.classList.add('loading');

  const sheetProducts = await fetchSheetData(CONFIG.gids.productos);
  if (sheetProducts && sheetProducts.length > 0) {
    PRODUCTS = sheetProducts
      .filter(p => p.idproducto || p['ID Producto'] || p.id)
      .map(p => {
        const getV = (k) => {
          const n = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
          return p[n] || p[k] || "";
        };

        return {
          id: getV('ID Producto'),
          photo: transformDriveUrl(getV('Foto')) || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80',
          photos: [getV('Foto'), getV('Foto2'), getV('Foto3'), getV('Foto4')].map(url => transformDriveUrl(url)).filter(f => f && f.trim() !== ''),
          reference: getV('Referencia') || '',
          name: getV('Nombre') || 'Sin nombre',
          description: getV('Descripcion') || '',
          category: getV('Categoria') || 'Otros',
          stock: parseInt(getV('Stock Disponible').toString().replace(/\D/g, '')) || 0,
          wholesalePrice: parseInt(getV('Precio Mayorista').toString().replace(/\D/g, '')) || 0,
          retailPrice: parseInt(getV('Precio Usuario Final').toString().replace(/\D/g, '')) || 0,
          isPromo: ['si', 'true', 'yes', '1'].includes(getV('Oferta').toLowerCase().trim()) || ['si', 'true', 'yes', '1'].includes(getV('Promo').toLowerCase().trim())
        };
      });

    // Generar categorías dinámicas
    const uniqueCats = [...new Set(PRODUCTS.map(p => p.category))].filter(c => c && c !== 'Otros');
    CATEGORIES = [
      { id: 'all', label: 'Todos', icon: '🏷️' },
      ...uniqueCats.map(cat => ({
        id: cat,
        label: cat,
        icon: CATEGORY_ICONS[cat] || '📦'
      })),
      { id: 'Otros', label: 'Otros', icon: '✨' }
    ];

    // Aleatorizar el orden de los productos
    shuffleArray(PRODUCTS);
  }

  const sheetClients = await fetchSheetData(CONFIG.gids.clientes);
  if (sheetClients && sheetClients.length > 0) {
    DEMO_CLIENTS = sheetClients.map(c => ({
      id: c['Identificacion']?.toString().trim(),
      pin: c['PIN']?.toString().trim() || '',
      name: c['Nombre'],
      type: c['Tipo Cliente'],
      phone: c['Telefono WhatsApp']?.toString().trim() || ''
    }));
  }

  state.isLoading = false;
  document.body.classList.remove('loading');

  navigateTo('login');
  renderHeader();
  startPromoRotation();
}

let promoInterval = null;
function startPromoRotation() {
  if (promoInterval) clearInterval(promoInterval);
  renderPromoBanner();
  promoInterval = setInterval(() => {
    const promoProducts = PRODUCTS.filter(p => p.isPromo);
    if (promoProducts.length > 1) {
      state.currentPromoIndex = (state.currentPromoIndex + 1) % promoProducts.length;
      renderPromoBanner();
    }
  }, 5000);
}

// Ensure initData runs
window.addEventListener('DOMContentLoaded', initData);

// ---- HELPERS ----
function formatCurrency(amount) {
  return '$' + amount.toLocaleString('es-CO');
}

function generateOrderId() {
  const count = state.orders.length + 1;
  return 'PED-' + String(count).padStart(4, '0');
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getProductPrice(product) {
  if (!state.currentUser) return product.retailPrice;
  return state.currentUser.type === 'Mayorista' ? product.wholesalePrice : product.retailPrice;
}

function saveOrders() {
  localStorage.setItem('orders', JSON.stringify(state.orders));
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.className = 'toast ' + type;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️'}</span> ${message}`;
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function getCartCount() {
  return state.cart.reduce((sum, item) => sum + item.qty, 0);
}

function getCartTotal() {
  return state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
}

// ---- NAVIGATION ----
function navigateTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('screen-' + screenId);
  if (target) {
    target.classList.add('active');
  }

  state.currentScreen = screenId;

  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-screen="${screenId}"]`);
  if (navItem) navItem.classList.add('active');

  // Show/hide nav bar
  const nav = document.getElementById('bottom-nav');
  if (screenId === 'login' || screenId === 'detail' || screenId === 'confirm') {
    nav.style.display = 'none';
  } else {
    nav.style.display = 'flex';
  }

  // Hide cart footer on non-cart screens
  const cartFooter = document.getElementById('cart-footer');
  if (cartFooter) {
    cartFooter.style.display = screenId === 'cart' && state.cart.length > 0 ? 'block' : 'none';
  }

  // Render content for the screen
  if (screenId === 'home') renderCatalog();
  if (screenId === 'cart') renderCart();
  if (screenId === 'orders') renderOrders();
  if (screenId === 'detail') renderDetail();
  if (screenId === 'confirm') renderConfirmation();

  // Scroll to top
  window.scrollTo(0, 0);
}

// ---- AUTH ----
function handleLogin(e) {
  e.preventDefault();
  const clientId = document.getElementById('login-id').value.trim();
  const pin = document.getElementById('login-pin').value.trim();
  const errorEl = document.getElementById('login-error');

  if (!clientId) return;

  // 1. Intentar encontrar coincidencia exacta (ID + PIN)
  const validClient = DEMO_CLIENTS.find(c => c.id === clientId && c.pin === pin);

  if (validClient) {
    // Si coincide ID y PIN, entra con su perfil original (ej. Mayorista)
    state.currentUser = validClient;
  } else {
    // 2. Si no coincide o no tiene PIN, entra como 'Usuario Final'
    const existingClient = DEMO_CLIENTS.find(c => c.id === clientId);

    state.currentUser = {
      id: clientId,
      name: existingClient ? existingClient.name : ('Cliente ' + clientId),
      type: 'Usuario Final',
      phone: existingClient ? existingClient.phone : ''
    };
  }

  // Éxito de login para todos
  errorEl.classList.remove('show');
  navigateTo('home');
  renderHeader();
  updateCartBadge();
}

function logout() {
  state.currentUser = null;
  state.cart = [];
  state.searchQuery = '';
  state.selectedCategory = 'all';
  document.getElementById('login-id').value = '';
  document.getElementById('login-pin').value = '';
  navigateTo('login');
}

// ---- HEADER ----
function renderHeader() {
  if (!state.currentUser) return;
  const el = document.getElementById('header-user-name');
  const avatar = document.getElementById('header-avatar');
  const type = document.getElementById('header-user-type');

  const userName = state.currentUser.name || 'Cliente';
  if (el) el.textContent = userName;
  if (avatar) avatar.textContent = userName.charAt(0).toUpperCase();
  if (type) type.textContent = state.currentUser.type === 'Mayorista' ? '💎 Mayorista' : '👤 Usuario Final';
}

// ---- CATALOG ----
function getFilteredProducts() {
  let products = [...PRODUCTS];

  const normalize = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  if (state.selectedCategory && state.selectedCategory !== 'all') {
    const selCat = normalize(state.selectedCategory);
    products = products.filter(p => normalize(p.category) === selCat);
  }

  if (state.searchQuery) {
    const q = normalize(state.searchQuery);
    products = products.filter(p =>
      normalize(p.name).includes(q) ||
      normalize(p.reference).includes(q) ||
      normalize(p.description).includes(q)
    );
  }

  return products;
}

function renderCatalog() {
  renderPromoBanner();
  renderCategories();
  renderProducts();
}

function renderPromoBanner() {
  const container = document.getElementById('promo-banner-content');
  const dotsContainer = document.getElementById('promo-dots');
  if (!container) return;

  const promoProducts = PRODUCTS.filter(p => p.isPromo);

  if (promoProducts.length === 0) {
    container.innerHTML = `
      <div class="promo-content">
        <span class="promo-tag">Oferta</span>
        <h3>Nuevo Catálogo</h3>
        <p>Descubre los mejores productos con precios exclusivos</p>
      </div>
      <div style="font-size: 64px;">🛒</div>
    `;
    if (dotsContainer) dotsContainer.style.display = 'none';
    return;
  }

  const product = promoProducts[state.currentPromoIndex];
  const price = getProductPrice(product);

  container.style.opacity = '0';
  setTimeout(() => {
    container.innerHTML = `
      <div class="promo-content" onclick="openProduct('${product.id}')" style="cursor: pointer; flex: 1; padding-right: 15px; min-width: 0;">
        <span class="promo-tag" style="background: #e94560 !important; color: white !important;">🔥 Oferta Especial</span>
        <h3 style="font-size: 18px; margin: 4px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${product.name}</h3>
        <p style="font-size: 13px; margin: 0; color: #6b7280;">${product.reference} — <strong style="color: #e94560;">${formatCurrency(price)}</strong></p>
      </div>
      <div class="promo-image-container" onclick="openProduct('${product.id}')" style="cursor: pointer; width: 90px; height: 90px; flex-shrink: 0; background: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border: 1px solid #eee;">
        <img src="${product.photo}" alt="${product.name}" style="max-width: 100%; max-height: 100%; object-fit: contain; display: block;">
      </div>
    `;
    container.style.opacity = '1';
    container.style.height = '140px';
    container.style.maxHeight = '140px';
    container.style.overflow = 'hidden';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
  }, 300);

  if (dotsContainer) {
    dotsContainer.style.display = promoProducts.length > 1 ? 'flex' : 'none';
    dotsContainer.innerHTML = promoProducts.map((_, i) => `
      <div class="promo-dot ${i === state.currentPromoIndex ? 'active' : ''}" onclick="state.currentPromoIndex = ${i}; renderPromoBanner();"></div>
    `).join('');
  }
}

function renderCategories() {
  const container = document.getElementById('categories-list');
  if (!container) return;

  container.innerHTML = CATEGORIES.map(cat => `
    <div class="category-chip ${state.selectedCategory === cat.id ? 'active' : ''}" onclick="selectCategory('${cat.id}')">
      <div class="cat-icon"><span>${cat.icon}</span></div>
      <span class="cat-label">${cat.label}</span>
    </div>
  `).join('');
}

function selectCategory(catId) {
  state.selectedCategory = catId;
  renderCatalog();
}

function handleSearch(e) {
  state.searchQuery = e.target.value;
  renderProducts();
}

function renderProducts() {
  const container = document.getElementById('products-grid');
  if (!container) return;

  const products = getFilteredProducts();

  if (products.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px 0;">
        <div style="font-size: 48px; margin-bottom: 12px;">🔍</div>
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">No se encontraron productos</h3>
        <p style="font-size: 13px; color: var(--text-secondary);">Intenta con otra búsqueda o categoría</p>
      </div>
    `;
    return;
  }

  container.innerHTML = products.map(product => {
    const price = getProductPrice(product);
    const inStock = product.stock > 0;

    return `
      <div class="product-card" onclick="openProduct('${product.id}')">
        <div class="product-card-image">
          <img src="${product.photo}" alt="${product.name}" loading="lazy">
          <span class="stock-badge ${inStock ? 'in-stock' : 'out-of-stock'}">
            ${inStock ? `✓ ${product.stock} disp.` : '✗ Agotado'}
          </span>
          <button class="fav-btn" onclick="event.stopPropagation()">♡</button>
        </div>
        <div class="product-card-info">
          <div class="product-name">${product.name}</div>
          <div class="product-ref">${product.reference}</div>
          <div class="product-price">${formatCurrency(price)}</div>
        </div>
        ${inStock ? `<button class="add-cart-btn" onclick="event.stopPropagation(); quickAddToCart('${product.id}')" title="Agregar al carrito">+</button>` : ''}
      </div>
    `;
  }).join('');
}

// ---- PRODUCT DETAIL ----
function openProduct(productId) {
  state.selectedProduct = PRODUCTS.find(p => p.id === productId);
  state.detailQty = 1;
  state.currentDetailImageIndex = 0;
  navigateTo('detail');
}

function renderDetail() {
  const product = state.selectedProduct;
  if (!product) return;

  const price = getProductPrice(product);
  const inStock = product.stock > 0;

  // Gallery logic
  const photos = product.photos.length > 0 ? product.photos : [product.photo];
  const wrapper = document.getElementById('gallery-wrapper');

  wrapper.innerHTML = photos.map(photo => `
    <img src="${photo}" alt="${product.name}" loading="lazy">
  `).join('');

  // Add scroll listener for dots
  wrapper.onscroll = () => {
    const index = Math.round(wrapper.scrollLeft / wrapper.clientWidth);
    if (state.currentDetailImageIndex !== index) {
      state.currentDetailImageIndex = index;
      updateDetailDots(photos.length);
    }
  };

  updateDetailDots(photos.length);

  document.getElementById('detail-category').textContent = product.category;
  document.getElementById('detail-name').textContent = product.name;
  document.getElementById('detail-ref').textContent = product.reference;
  document.getElementById('detail-description').textContent = product.description;
  document.getElementById('detail-price').textContent = formatCurrency(price);

  const stockEl = document.getElementById('detail-stock');
  stockEl.className = `detail-stock ${inStock ? 'in-stock' : 'out-of-stock'}`;
  stockEl.innerHTML = inStock
    ? `✓ ${product.stock} disponibles`
    : '✗ Agotado';

  document.getElementById('detail-qty-value').textContent = state.detailQty;

  const addBtn = document.getElementById('detail-add-btn');
  addBtn.disabled = !inStock;
  addBtn.textContent = inStock ? `🛒 Agregar al carrito — ${formatCurrency(price * state.detailQty)}` : 'Producto agotado';
}

function updateDetailDots(count) {
  const dotsContainer = document.getElementById('detail-dots');
  if (count > 1) {
    dotsContainer.innerHTML = Array.from({ length: count }).map((_, i) => `
      <div class="gallery-dot ${i === state.currentDetailImageIndex ? 'active' : ''}" onclick="setDetailImage(${i})"></div>
    `).join('');
    dotsContainer.style.display = 'flex';
  } else {
    dotsContainer.style.display = 'none';
  }
}

function setDetailImage(index) {
  state.currentDetailImageIndex = index;
  const wrapper = document.getElementById('gallery-wrapper');
  wrapper.scrollTo({
    left: index * wrapper.clientWidth,
    behavior: 'smooth'
  });
}

function changeDetailQty(delta) {
  const product = state.selectedProduct;
  if (!product) return;
  const newQty = state.detailQty + delta;
  if (newQty < 1 || newQty > product.stock) return;
  state.detailQty = newQty;
  renderDetail();
}

function addToCartFromDetail() {
  const product = state.selectedProduct;
  if (!product || product.stock === 0) return;

  const existing = state.cart.find(i => i.productId === product.id);
  const currentQty = existing ? existing.qty : 0;

  if (currentQty + state.detailQty > product.stock) {
    showToast(`Stock máximo: ${product.stock} unidades`, 'warning');
    return;
  }

  if (existing) {
    existing.qty += state.detailQty;
  } else {
    state.cart.push({
      productId: product.id,
      name: product.name,
      reference: product.reference,
      photo: product.photo,
      price: getProductPrice(product),
      qty: state.detailQty,
      maxStock: product.stock
    });
  }

  updateCartBadge();
  showToast(`${product.name} agregado al carrito`);
  navigateTo('home');
}

function quickAddToCart(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product || product.stock === 0) return;

  const existing = state.cart.find(i => i.productId === product.id);

  if (existing) {
    if (existing.qty >= product.stock) {
      showToast('Stock máximo alcanzado', 'warning');
      return;
    }
    existing.qty++;
  } else {
    state.cart.push({
      productId: product.id,
      name: product.name,
      reference: product.reference,
      photo: product.photo,
      price: getProductPrice(product),
      qty: 1,
      maxStock: product.stock
    });
  }

  updateCartBadge();
  showToast(`${product.name} agregado al carrito`);
}

// ---- CART ----
function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (!badge) return;
  const count = getCartCount();
  badge.textContent = count;
  badge.className = 'cart-badge' + (count > 0 ? ' show' : '');
}

function renderCart() {
  const container = document.getElementById('cart-items');
  const footer = document.getElementById('cart-footer');
  const emptyState = document.getElementById('cart-empty');

  if (state.cart.length === 0) {
    if (container) container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    if (footer) footer.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (footer) footer.style.display = 'block';

  container.innerHTML = state.cart.map((item, index) => {
    const overStock = item.qty > item.maxStock;
    return `
      <div class="cart-item" style="animation-delay: ${index * 0.05}s">
        <div class="cart-item-image">
          <img src="${item.photo}" alt="${item.name}">
        </div>
        <div class="cart-item-details">
          <div class="item-name">${item.name}</div>
          <div class="item-ref">${item.reference}</div>
          <div class="item-price">${formatCurrency(item.price * item.qty)}</div>
          ${overStock ? '<div class="cart-stock-warning">⚠️ Excede stock disponible</div>' : ''}
        </div>
        <div class="cart-item-actions">
          <button class="delete-btn" onclick="removeFromCart('${item.productId}')" title="Eliminar">🗑️</button>
          <div class="cart-item-qty">
            <button onclick="changeCartQty('${item.productId}', -1)">−</button>
            <span>${item.qty}</span>
            <button onclick="changeCartQty('${item.productId}', 1)">+</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Update total
  document.getElementById('cart-total').textContent = formatCurrency(getCartTotal());
}

function changeCartQty(productId, delta) {
  const item = state.cart.find(i => i.productId === productId);
  if (!item) return;

  const newQty = item.qty + delta;
  if (newQty < 1) {
    removeFromCart(productId);
    return;
  }
  if (newQty > item.maxStock) {
    showToast(`Stock máximo: ${item.maxStock} unidades`, 'warning');
    return;
  }

  item.qty = newQty;
  renderCart();
  updateCartBadge();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter(i => i.productId !== productId);
  renderCart();
  updateCartBadge();
}

function clearCart() {
  if (state.cart.length === 0) return;
  state.cart = [];
  renderCart();
  updateCartBadge();
  showToast('Carrito vaciado');
}

// ---- ORDER CONFIRMATION ----
function goToConfirmation() {
  if (state.cart.length === 0) return;
  navigateTo('confirm');
}

function renderConfirmation() {
  const user = state.currentUser;
  if (!user) return;

  document.getElementById('confirm-client-name').textContent = user.name;
  document.getElementById('confirm-client-id').textContent = user.id;
  document.getElementById('confirm-client-type').textContent = user.type;
  document.getElementById('confirm-date').textContent = formatDate(new Date());

  const productsList = document.getElementById('confirm-products');
  productsList.innerHTML = state.cart.map(item => `
    <div class="confirm-product-item">
      <div class="prod-info">
        <div class="prod-name">${item.name}</div>
        <div class="prod-qty">x${item.qty} · ${formatCurrency(item.price)} c/u</div>
      </div>
      <div class="prod-subtotal">${formatCurrency(item.price * item.qty)}</div>
    </div>
  `).join('');

  document.getElementById('confirm-total').textContent = formatCurrency(getCartTotal());
}

function cancelOrder() {
  navigateTo('cart');
}

function sendOrder() {
  const user = state.currentUser;
  if (!user || state.cart.length === 0) return;

  const orderId = generateOrderId();
  const date = new Date().toISOString();
  const total = getCartTotal();

  // Save order
  const order = {
    id: orderId,
    clientId: user.id,
    clientName: user.name,
    clientType: user.type,
    clientPhone: user.phone,
    date: date,
    status: 'Pendiente',
    total: total,
    items: state.cart.map(item => ({
      productId: item.productId,
      name: item.name,
      reference: item.reference,
      qty: item.qty,
      price: item.price,
      subtotal: item.price * item.qty
    }))
  };

  state.orders.push(order);
  saveOrders();

  // Generate WhatsApp message for the vendor
  const vendorMessage = generateVendorMessage(order);
  const waUrl = `https://wa.me/${CONFIG.vendorPhone}?text=${encodeURIComponent(vendorMessage)}`;

  // Show success overlay
  showSuccessOverlay(order, waUrl);

  // Clear cart
  state.cart = [];
  updateCartBadge();
}

function generateVendorMessage(order) {
  let msg = `📦 *PEDIDO # ${order.id}*\n`;
  msg += `━━━━━━━━━━━━━━\n`;
  msg += `👤 Cliente: ${order.clientName} (${order.clientId})\n`;
  msg += `📅 Fecha: ${formatDate(order.date)}\n`;
  msg += `📞 Tel: ${order.clientPhone}\n`;
  msg += `💼 Tipo: ${order.clientType}\n\n`;
  msg += `🛒 *DETALLES DEL PEDIDO:*\n`;

  let totalQty = 0;
  order.items.forEach(item => {
    msg += `------------------------------\n`;
    msg += `📌 Ref: ${item.reference}\n`;
    msg += `📦 Prod: ${item.name}\n`;
    msg += `🔢 Cant: ${item.qty}\n`;
    msg += `💰 Precio: ${formatCurrency(item.price)}\n`;
    msg += `💵 Subtotal: ${formatCurrency(item.subtotal)}\n`;
    totalQty += item.qty;
  });

  msg += `━━━━━━━━━━━━━━\n`;
  msg += `📦 *Total de productos:* ${totalQty}\n`;
  msg += `💰 *TOTAL A PAGAR: ${formatCurrency(order.total)}*\n`;
  msg += `📋 Estado: Pendiente\n`;
  msg += `━━━━━━━━━━━━━━`;

  return msg;
}

function generateClientMessage(order) {
  let msg = `✅ *¡Su pedido #${order.id} fue recibido!*\n\n`;
  msg += `Total: ${formatCurrency(order.total)}\n`;
  msg += `Le contactaremos pronto.\n\n`;
  msg += `Gracias por su compra. 🛍️`;
  return msg;
}

function showSuccessOverlay(order, waUrl) {
  const overlay = document.getElementById('success-overlay');
  document.getElementById('success-order-id').textContent = order.id;
  document.getElementById('success-total').textContent = formatCurrency(order.total);
  document.getElementById('wa-vendor-link').href = waUrl;

  // Client confirmation WhatsApp link
  const clientMsg = generateClientMessage(order);
  const clientWaUrl = `https://wa.me/${order.clientPhone.replace('+', '')}?text=${encodeURIComponent(clientMsg)}`;
  document.getElementById('wa-client-link').href = clientWaUrl;

  overlay.classList.add('show');
}

function closeSuccessOverlay() {
  document.getElementById('success-overlay').classList.remove('show');
  navigateTo('home');
}

// ---- ORDER HISTORY ----
function renderOrders() {
  const container = document.getElementById('orders-list');
  const emptyState = document.getElementById('orders-empty');

  const userOrders = state.orders.filter(o => o.clientId === state.currentUser?.id).reverse();

  if (userOrders.length === 0) {
    if (container) container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  container.innerHTML = userOrders.map(order => {
    const statusClass = order.status === 'Pendiente' ? 'pending' : order.status === 'Enviado' ? 'sent' : 'cancelled';
    const statusLabel = order.status === 'Pendiente' ? '⏳ Pendiente' : order.status === 'Enviado' ? '✅ Enviado' : '❌ Cancelado';

    return `
      <div class="order-card" onclick="toggleOrderDetails(this)">
        <div class="order-card-header">
          <span class="order-id">${order.id}</span>
          <span class="order-status ${statusClass}">${statusLabel}</span>
        </div>
        <div class="order-card-body">
          <span class="order-date">${formatDate(order.date)}</span>
          <span class="order-total">${formatCurrency(order.total)}</span>
        </div>
        <div class="order-details-list">
          ${order.items.map(item => `
            <div class="order-detail-item">
              <span>${item.name} x${item.qty}</span>
              <span>${formatCurrency(item.subtotal)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function toggleOrderDetails(card) {
  card.classList.toggle('expanded');
}

// ---- INITIALIZATION ----
document.addEventListener('DOMContentLoaded', () => {
  // Login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  // Search
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.addEventListener('input', handleSearch);

  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const screen = item.dataset.screen;
      if (screen) navigateTo(screen);
    });
  });

  // Start on login
  navigateTo('login');
});
