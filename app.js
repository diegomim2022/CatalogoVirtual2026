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
  },
  cacheExpiry: 5 * 60 * 1000, // 5 minutos de caché
  productsPerPage: 20, // productos por lote de paginación
  adminPin: '1324', // Clave de acceso al panel admin
  analyticsWebAppUrl: 'https://script.google.com/macros/s/AKfycby_UuX0XEZ-bH1DSQtMjEOvN_Md5-XTSoWECyX9ingLZWaSWpUGjMQmCykBYvKeG4DVgQ/exec' // URL del Google Apps Script Web App
};

// ---- SECURITY: HTML ESCAPE ----
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---- UTILITY: DEBOUNCE ----
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ---- IMAGE ERROR FALLBACK ----
const IMG_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect fill="%23f0f0f3" width="400" height="400"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-family="sans-serif" font-size="48">📷</text><text x="50%" y="62%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-family="sans-serif" font-size="14">Imagen no disponible</text></svg>');

function handleImgError(img) {
  img.onerror = null; // prevent infinite loop
  img.src = IMG_PLACEHOLDER;
}

// ---- DEMO DATA ----
let PRODUCTS = [];

let DEMO_CLIENTS = [];

let CATEGORIES = [
  { id: 'all', label: 'Todos', icon: '🏷️' }
];

const CATEGORY_ICONS_MAP = {
  'ropa': '👕', 'vestidor': '👗', 'camisa': '👔', 'pantalon': '👖',
  'zapato': '👟', 'calzado': '👞', 'tenis': '👟',
  'bolso': '👜', 'maleta': '💼', 'morral': '🎒',
  'reloj': '⌚', 'joya': '💍', 'accesorio': '👓',
  'audio': '🎧', 'sonido': '🔊', 'parlante': '📻', 'audifono': '🎧',
  'hogar': '🏠', 'casa': '🏡', 'cocina': '🍳', 'mueble': '🛋️',
  'belleza': '💄', 'maquillaje': '💅', 'perfume': '✨', 'cuidado': '🧴',
  'tecnologia': '💻', 'celular': '📱', 'computador': '💻', 'electronica': '🔌',
  'deporte': '⚽', 'gym': '🏋️', 'entrenamiento': '🚴',
  'juguete': '🧸', 'niño': '👶', 'bebe': '🍼',
  'mascota': '🐶', 'perro': '🐱', 'alimento': '🦴',
  'herramienta': '🛠️', 'construccion': '🏗️', 'ferreteria': '🔨',
  'papeleria': '📝', 'oficina': '📎', 'util': '📏',
  'salud': '💊', 'medicina': '🩺', 'bienestar': '🧘',
  'comida': '🍔', 'bebida': '🥤', 'snack': '🍿',
  'carro': '🚗', 'moto': '🏍️', 'vehiculo': '🚜',
  'cable': '🔌', 'power': '⚡', 'energia': '🔋'
};

function getAutoIcon(categoryName) {
  if (!categoryName) return '📦';
  const name = categoryName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Buscar coincidencia exacta primero
  if (CATEGORY_ICONS_MAP[name]) return CATEGORY_ICONS_MAP[name];

  // Buscar por palabra clave parcial
  for (const [key, icon] of Object.entries(CATEGORY_ICONS_MAP)) {
    if (name.includes(key)) return icon;
  }

  return '📦'; // Default
}

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
  currentZoomImageIndex: 0,
  currentPromoIndex: 0,
  isLoading: false,
  visibleProductCount: CONFIG.productsPerPage, // paginación
  paginationObserver: null
};

// ---- UTILS & SYNC ----

async function fetchSheetData(gid) {
  // Check sessionStorage cache first
  const cacheKey = `sheet_cache_${gid}`;
  const cacheTimeKey = `sheet_cache_time_${gid}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    const cachedTime = sessionStorage.getItem(cacheTimeKey);
    if (cached && cachedTime && (Date.now() - parseInt(cachedTime)) < CONFIG.cacheExpiry) {
      return JSON.parse(cached);
    }
  } catch (e) { /* sessionStorage not available, proceed */ }

  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/export?format=csv&gid=${gid}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    const text = await response.text();
    const data = parseCSV(text);

    // Save to cache
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
      sessionStorage.setItem(cacheTimeKey, Date.now().toString());
    } catch (e) { /* quota exceeded, ignore */ }

    return data;
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    showNetworkError();
    return null;
  }
}

function showNetworkError() {
  const grid = document.getElementById('products-grid');
  if (grid) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px;">
        <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Error de conexión</h3>
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">No se pudieron cargar los productos. Verifica tu conexión a internet.</p>
        <button class="btn btn-primary" style="max-width: 200px; margin: 0 auto;" onclick="location.reload()">Reintentar</button>
      </div>
    `;
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

  // Fetch products and clients in parallel for faster loading
  const [sheetProducts, sheetClients] = await Promise.all([
    fetchSheetData(CONFIG.gids.productos),
    fetchSheetData(CONFIG.gids.clientes)
  ]);

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
          photo: transformDriveUrl(getV('Foto')) || IMG_PLACEHOLDER,
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
        icon: getAutoIcon(cat)
      })),
      { id: 'Otros', label: 'Otros', icon: '✨' }
    ];

    // Aleatorizar el orden de los productos
    shuffleArray(PRODUCTS);
  }

  if (sheetClients && sheetClients.length > 0) {
    DEMO_CLIENTS = sheetClients.map(c => ({
      id: c['Identificacion']?.toString().trim(),
      name: c['Nombre'],
      type: c['Tipo Cliente'],
      phone: c['Telefono WhatsApp']?.toString().trim() || ''
    }));
  }

  state.isLoading = false;
  document.body.classList.remove('loading');

  // Initialize Analytics Web App URL
  if (typeof Analytics !== 'undefined' && CONFIG.analyticsWebAppUrl) {
    Analytics.setWebAppUrl(CONFIG.analyticsWebAppUrl);
  }

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

// initData is called from the consolidated DOMContentLoaded listener at the bottom

// ---- HELPERS ----
function formatCurrency(amount) {
  return '$' + amount.toLocaleString('es-CO');
}

function generateOrderId() {
  // Use timestamp-based ID to avoid collisions
  const now = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return 'PED-' + now.toString(36).toUpperCase().slice(-5) + random.toString(36).toUpperCase().padStart(2, '0');
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
  if (screenId === 'analytics') renderAnalytics();

  // Scroll to top
  window.scrollTo(0, 0);
}

// ---- AUTH ----
function handleLogin(e) {
  e.preventDefault();
  const clientId = document.getElementById('login-id').value.trim().replace(/[<>"'&]/g, '');
  const errorEl = document.getElementById('login-error');

  if (!clientId) return;

  // Buscar cliente registrado por número de documento
  const registeredClient = DEMO_CLIENTS.find(c => c.id === clientId);

  if (registeredClient) {
    // Cliente registrado — entra como Mayorista
    state.currentUser = {
      id: registeredClient.id,
      name: registeredClient.name,
      type: 'Mayorista',
      phone: registeredClient.phone
    };
  } else {
    // Cliente no registrado — entra como Usuario Final
    state.currentUser = {
      id: clientId,
      name: 'Cliente ' + clientId,
      type: 'Usuario Final',
      phone: ''
    };
  }

  errorEl.classList.remove('show');

  // Track access for analytics
  if (typeof Analytics !== 'undefined') {
    Analytics.trackAccess(state.currentUser.id, state.currentUser.name);
  }

  navigateTo('home');
  renderHeader();
  updateCartBadge();
}

function logout() {
  state.currentUser = null;
  state.cart = [];
  state.searchQuery = '';
  state.selectedCategory = 'all';
  state.visibleProductCount = CONFIG.productsPerPage;
  document.getElementById('login-id').value = '';
  if (promoInterval) { clearInterval(promoInterval); promoInterval = null; }
  if (state.paginationObserver) { state.paginationObserver.disconnect(); state.paginationObserver = null; }
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
  state.visibleProductCount = CONFIG.productsPerPage; // reset pagination
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
  const safeId = escapeHtml(product.id);
  const safeName = escapeHtml(product.name);
  const safeRef = escapeHtml(product.reference);
  const safePhoto = escapeHtml(product.photo);
  setTimeout(() => {
    container.innerHTML = `
      <div class="promo-content" onclick="openProduct('${safeId}')" style="cursor: pointer; flex: 1; padding-right: 15px; min-width: 0;">
        <span class="promo-tag" style="background: #e94560 !important; color: white !important;">🔥 Oferta Especial</span>
        <h3 style="font-size: 18px; margin: 4px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${safeName}</h3>
        <p style="font-size: 13px; margin: 0; color: #6b7280;">${safeRef} — <strong style="color: #e94560;">${formatCurrency(price)}</strong></p>
      </div>
      <div class="promo-image-container" onclick="openProduct('${safeId}')" style="cursor: pointer; width: 90px; height: 90px; flex-shrink: 0; background: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border: 1px solid #eee;">
        <img src="${safePhoto}" alt="${safeName}" style="max-width: 100%; max-height: 100%; object-fit: contain; display: block;" onerror="handleImgError(this)">
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

  container.innerHTML = CATEGORIES.map(cat => {
    const safeId = escapeHtml(cat.id);
    const safeLabel = escapeHtml(cat.label);
    return `
    <div class="category-chip ${state.selectedCategory === cat.id ? 'active' : ''}" onclick="selectCategory('${safeId}')">
      <div class="cat-icon"><span>${cat.icon}</span></div>
      <span class="cat-label">${safeLabel}</span>
    </div>
  `;
  }).join('');
}

function selectCategory(catId) {
  state.selectedCategory = catId;
  renderCatalog();
}

const handleSearchDebounced = debounce(function () {
  state.visibleProductCount = CONFIG.productsPerPage; // reset pagination on new search
  renderProducts();
}, 300);

function handleSearch(e) {
  state.searchQuery = e.target.value;
  handleSearchDebounced();
}

function renderProducts() {
  const container = document.getElementById('products-grid');
  if (!container) return;

  const allProducts = getFilteredProducts();

  // Cleanup previous observer
  if (state.paginationObserver) {
    state.paginationObserver.disconnect();
    state.paginationObserver = null;
  }

  if (allProducts.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px 0;">
        <div style="font-size: 48px; margin-bottom: 12px;">🔍</div>
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">No se encontraron productos</h3>
        <p style="font-size: 13px; color: var(--text-secondary);">Intenta con otra búsqueda o categoría</p>
      </div>
    `;
    return;
  }

  // Paginated slice
  const visibleProducts = allProducts.slice(0, state.visibleProductCount);

  // Use DocumentFragment for batch DOM insertion
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');

  tempDiv.innerHTML = visibleProducts.map(product => {
    const price = getProductPrice(product);
    const inStock = product.stock > 0;
    const safeId = escapeHtml(product.id);
    const safeName = escapeHtml(product.name);
    const safeRef = escapeHtml(product.reference);
    const safePhoto = escapeHtml(product.photo);

    return `
      <div class="product-card" onclick="openProduct('${safeId}')">
        <div class="product-card-image">
          <img src="${safePhoto}" alt="${safeName}" loading="lazy" onerror="handleImgError(this)">
          <span class="stock-badge ${inStock ? 'in-stock' : 'out-of-stock'}">
            ${inStock ? `✓ ${product.stock} disp.` : '✗ Agotado'}
          </span>
          <button class="fav-btn" onclick="event.stopPropagation()">♡</button>
        </div>
        <div class="product-card-info">
          <div class="product-name">${safeName}</div>
          <div class="product-ref">${safeRef}</div>
          <div class="product-price">${formatCurrency(price)}</div>
        </div>
        ${inStock ? `<button class="add-cart-btn" onclick="event.stopPropagation(); quickAddToCart('${safeId}')" title="Agregar al carrito">+</button>` : ''}
      </div>
    `;
  }).join('');

  // Add "load more" sentinel if there are more products
  if (visibleProducts.length < allProducts.length) {
    tempDiv.innerHTML += `<div id="pagination-sentinel" style="grid-column: 1/-1; text-align: center; padding: 20px 0;">
      <div class="pagination-loader" style="width: 32px; height: 32px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; margin: 0 auto; animation: spin 0.8s linear infinite;"></div>
      <p style="font-size: 12px; color: var(--text-tertiary); margin-top: 8px;">Cargando más productos...</p>
    </div>`;
  }

  while (tempDiv.firstChild) {
    fragment.appendChild(tempDiv.firstChild);
  }

  container.innerHTML = '';
  container.appendChild(fragment);

  // Setup IntersectionObserver for infinite scroll
  if (visibleProducts.length < allProducts.length) {
    const sentinel = document.getElementById('pagination-sentinel');
    if (sentinel) {
      state.paginationObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          state.visibleProductCount += CONFIG.productsPerPage;
          renderProducts();
        }
      }, { rootMargin: '200px' });
      state.paginationObserver.observe(sentinel);
    }
  }
}

// ---- PRODUCT DETAIL ----
function openProduct(productId) {
  state.selectedProduct = PRODUCTS.find(p => p.id === productId);
  state.detailQty = 1;
  state.currentDetailImageIndex = 0;

  // Track product view for analytics
  if (typeof Analytics !== 'undefined' && state.currentUser && state.selectedProduct) {
    Analytics.trackProductView(state.currentUser.id, state.selectedProduct.id, state.selectedProduct.name);
  }

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
    <img src="${escapeHtml(photo)}" alt="${escapeHtml(product.name)}" loading="lazy" draggable="false" onerror="handleImgError(this)">
  `).join('');

  // Add scroll listener for dots
  wrapper.onscroll = () => {
    const index = Math.round(wrapper.scrollLeft / (wrapper.clientWidth || 1));
    if (state.currentDetailImageIndex !== index) {
      state.currentDetailImageIndex = index;
      updateDetailDots(photos.length);
    }
  };

  // Enable mouse drag-to-scroll
  let isDown = false;
  let startX;
  let scrollLeft;

  wrapper.onmousedown = (e) => {
    isDown = true;
    wrapper.style.cursor = 'grabbing';
    wrapper.style.scrollSnapType = 'none'; // Disable snapping while dragging
    startX = e.pageX - wrapper.offsetLeft;
    scrollLeft = wrapper.scrollLeft;
  };

  wrapper.onmouseleave = () => {
    isDown = false;
    wrapper.style.cursor = 'grab';
    wrapper.style.scrollSnapType = 'x mandatory';
  };

  wrapper.onmouseup = () => {
    isDown = false;
    wrapper.style.cursor = 'grab';
    wrapper.style.scrollSnapType = 'x mandatory';
    // Snap to nearest image on release
    const index = Math.round(wrapper.scrollLeft / (wrapper.clientWidth || 1));
    setDetailImage(index);
  };

  wrapper.onmousemove = (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - wrapper.offsetLeft;
    const walk = (x - startX) * 1.5; // Adjusted multiplier
    wrapper.scrollLeft = scrollLeft - walk;
  };

  state.currentDetailImageIndex = 0; // Reset index to first image
  updateDetailDots(photos.length);
  wrapper.scrollLeft = 0; // Ensure starts at beginning

  const catEl = document.getElementById('detail-category');
  catEl.textContent = product.category;
  catEl.onclick = () => {
    state.selectedCategory = product.category;
    state.searchQuery = '';
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    navigateTo('home');
  };
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

  // Attach zoom event to images
  const images = wrapper.querySelectorAll('img');
  images.forEach((img, index) => {
    img.style.cursor = 'zoom-in';
    img.style.pointerEvents = 'auto'; // Allow clicking
    img.onclick = () => openZoom(index); // Send index
  });
}

// ---- MOBILE ZOOM PREVENTION ----
// Prevents double-tap to zoom on specific buttons for mobile
let lastTouchEnd = 0;
document.addEventListener('touchend', function (event) {
  const now = (new Date()).getTime();
  const target = event.target;
  const isButton = target.closest('.qty-btn') || target.closest('.detail-add-btn') || target.closest('.detail-back');

  if (isButton && (now - lastTouchEnd <= 300)) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, false);

// ---- SWIPE BACK GESTURE (Product Detail) ----
(function () {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;

  const detailScreen = document.getElementById('screen-detail');

  detailScreen.addEventListener('touchstart', function (e) {
    touchStartX = e.changedTouches[0].clientX;
    touchStartY = e.changedTouches[0].clientY;
    touchStartTime = Date.now();
  }, { passive: true });

  detailScreen.addEventListener('touchend', function (e) {
    if (state.currentScreen !== 'detail') return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = Math.abs(touchEndY - touchStartY);
    const elapsed = Date.now() - touchStartTime;

    // Only trigger if: swipe right, enough distance, mostly horizontal, fast enough
    if (deltaX > 80 && deltaY < 100 && elapsed < 500) {
      // If swiping on the gallery, only go back if at the first image
      const gallery = document.getElementById('gallery-wrapper');
      if (gallery && gallery.contains(e.target) && state.currentDetailImageIndex > 0) {
        return; // Let the gallery handle the swipe
      }
      navigateTo('home');
    }
  }, { passive: true });
})();

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
    const safeId = escapeHtml(item.productId);
    const safeName = escapeHtml(item.name);
    const safeRef = escapeHtml(item.reference);
    const safePhoto = escapeHtml(item.photo);
    return `
      <div class="cart-item" style="animation-delay: ${index * 0.05}s">
        <div class="cart-item-image">
          <img src="${safePhoto}" alt="${safeName}" onerror="handleImgError(this)">
        </div>
        <div class="cart-item-details">
          <div class="item-name">${safeName}</div>
          <div class="item-ref">${safeRef}</div>
          <div class="item-price">${formatCurrency(item.price * item.qty)}</div>
          ${overStock ? '<div class="cart-stock-warning">⚠️ Excede stock disponible</div>' : ''}
        </div>
        <div class="cart-item-actions">
          <button class="delete-btn" onclick="removeFromCart('${safeId}')" title="Eliminar">🗑️</button>
          <div class="cart-item-qty">
            <button onclick="changeCartQty('${safeId}', -1)">−</button>
            <span>${item.qty}</span>
            <button onclick="changeCartQty('${safeId}', 1)">+</button>
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
  productsList.innerHTML = state.cart.map(item => {
    const safeName = escapeHtml(item.name);
    return `
    <div class="confirm-product-item">
      <div class="prod-info">
        <div class="prod-name">${safeName}</div>
        <div class="prod-qty">x${item.qty} · ${formatCurrency(item.price)} c/u</div>
      </div>
      <div class="prod-subtotal">${formatCurrency(item.price * item.qty)}</div>
    </div>
  `;
  }).join('');

  document.getElementById('confirm-total').textContent = formatCurrency(getCartTotal());
}

function cancelOrder() {
  navigateTo('cart');
}

// ---- ZOOM LOGIC ----
function openZoom(index) {
  const product = state.selectedProduct;
  if (!product) return;
  const photos = product.photos.length > 0 ? product.photos : [product.photo];

  state.currentZoomImageIndex = index;
  const modal = document.getElementById('zoom-modal');
  const zoomImg = document.getElementById('zoom-img');

  zoomImg.src = photos[index];
  zoomImg.classList.remove('zoomed');
  modal.classList.add('active');
  document.body.style.overflow = 'hidden'; // Prevent background scroll

  updateZoomUI();
  initZoomSwipe();
}

function updateZoomUI() {
  const product = state.selectedProduct;
  const photos = product.photos.length > 0 ? product.photos : [product.photo];
  const total = photos.length;
  const current = state.currentZoomImageIndex;

  // Update counter
  const counterEl = document.getElementById('zoom-counter');
  if (counterEl) {
    counterEl.textContent = `${current + 1} / ${total}`;
    counterEl.style.display = total <= 1 ? 'none' : 'block';
  }
}

function changeZoomImage(delta) {
  const product = state.selectedProduct;
  if (!product) return;
  const photos = product.photos.length > 0 ? product.photos : [product.photo];
  const total = photos.length;

  let newIndex = state.currentZoomImageIndex + delta;
  if (newIndex < 0) newIndex = total - 1;
  if (newIndex >= total) newIndex = 0;

  state.currentZoomImageIndex = newIndex;
  const zoomImg = document.getElementById('zoom-img');

  // Smooth transition
  zoomImg.style.opacity = '0';
  setTimeout(() => {
    zoomImg.src = photos[newIndex];
    zoomImg.classList.remove('zoomed');
    zoomImg.style.opacity = '1';
    updateZoomUI();
  }, 150);
}

function closeZoom() {
  const modal = document.getElementById('zoom-modal');
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

function toggleZoom(e) {
  e.stopPropagation();
  const zoomImg = document.getElementById('zoom-img');
  zoomImg.classList.toggle('zoomed');
}

// Swipe logic for zoom modal
let zoomTouchStartX = 0;
let zoomTouchEndX = 0;

function initZoomSwipe() {
  const modal = document.getElementById('zoom-modal');
  modal.ontouchstart = (e) => {
    zoomTouchStartX = e.changedTouches[0].screenX;
  };
  modal.ontouchend = (e) => {
    zoomTouchEndX = e.changedTouches[0].screenX;
    handleZoomSwipe();
  };
}

function handleZoomSwipe() {
  const diff = zoomTouchStartX - zoomTouchEndX;
  if (Math.abs(diff) > 50) { // Threshold
    if (diff > 0) {
      changeZoomImage(1); // Swipe left -> Next
    } else {
      changeZoomImage(-1); // Swipe right -> Prev
    }
  }
}

// Close zoom modal on Esc key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeZoom();
});

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
    msg += `• ${item.name} (${item.reference}) x${item.qty}: ${formatCurrency(item.price)} - Sub: ${formatCurrency(item.subtotal)}\n`;
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
    const safeOrderId = escapeHtml(order.id);

    return `
      <div class="order-card" onclick="toggleOrderDetails(this)">
        <div class="order-card-header">
          <span class="order-id">${safeOrderId}</span>
          <span class="order-status ${statusClass}">${statusLabel}</span>
        </div>
        <div class="order-card-body">
          <span class="order-date">${formatDate(order.date)}</span>
          <span class="order-total">${formatCurrency(order.total)}</span>
        </div>
        <div class="order-details-list">
          ${order.items.map(item => `
            <div class="order-detail-item">
              <span>${escapeHtml(item.name)} x${item.qty}</span>
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

// ---- INITIALIZATION (consolidated single listener) ----
document.addEventListener('DOMContentLoaded', () => {
  // Login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  // Search with debounce
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.addEventListener('input', handleSearch);

  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const screen = item.dataset.screen;
      if (screen && screen !== 'analytics') navigateTo(screen);
    });
  });

  // Admin PIN form
  const adminPinForm = document.getElementById('admin-pin-form');
  if (adminPinForm) {
    adminPinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const pin = document.getElementById('admin-pin-input').value;
      const errorEl = document.getElementById('admin-pin-error');
      if (pin === CONFIG.adminPin) {
        state.adminAuthenticated = true;
        closeAdminPinModal();
        navigateTo('analytics');
      } else {
        errorEl.textContent = 'Clave incorrecta';
        document.getElementById('admin-pin-input').value = '';
      }
    });
  }

  // Start on login and load data
  navigateTo('login');
  initData();
});

// ---- ADMIN AUTH ----
function requestAdminAccess() {
  if (state.adminAuthenticated) {
    navigateTo('analytics');
  } else {
    const modal = document.getElementById('admin-pin-modal');
    const errorEl = document.getElementById('admin-pin-error');
    const input = document.getElementById('admin-pin-input');
    if (errorEl) errorEl.textContent = '';
    if (input) input.value = '';
    modal.classList.add('show');
    setTimeout(() => input && input.focus(), 100);
  }
}

function closeAdminPinModal() {
  document.getElementById('admin-pin-modal').classList.remove('show');
}

// ---- ANALYTICS PANEL RENDER ----
let analyticsChart = null;

function renderAnalytics() {
  if (typeof Analytics === 'undefined') return;

  // Configurar URL del Web App si está definida
  if (CONFIG.analyticsWebAppUrl && !Analytics.getWebAppUrl()) {
    Analytics.setWebAppUrl(CONFIG.analyticsWebAppUrl);
  }

  // Intentar sincronizar desde Google Sheets antes de mostrar datos
  if (Analytics.getWebAppUrl()) {
    Analytics.loadFromSheets().then(() => {
      renderAnalyticsData();
    }).catch(() => {
      renderAnalyticsData(); // Si falla, usar datos locales
    });
  } else {
    renderAnalyticsData();
  }
}

function renderAnalyticsData() {
  // Summary cards
  const summary = Analytics.getSummary();
  document.getElementById('stat-accesses-today').textContent = summary.accessesToday;
  document.getElementById('stat-unique-clients').textContent = summary.uniqueClientsToday;
  document.getElementById('stat-views-today').textContent = summary.viewsToday;
  document.getElementById('stat-total-accesses').textContent = summary.totalAccesses;

  // Alerts
  const accessAlerts = Analytics.getAlerts();
  const sessionAlerts = Analytics.getSessionAlerts();
  const alertsSection = document.getElementById('analytics-alerts-section');
  const alertsContainer = document.getElementById('analytics-alerts');

  if (accessAlerts.length > 0 || sessionAlerts.length > 0) {
    alertsSection.style.display = 'block';
    let alertsHtml = '';

    accessAlerts.forEach(a => {
      alertsHtml += `
        <div class="analytics-alert">
          <div class="analytics-alert-icon">⚠️</div>
          <div class="analytics-alert-content">
            <div class="analytics-alert-title">${escapeHtml(a.clientName)} (${escapeHtml(a.clientId)})</div>
            <div class="analytics-alert-desc">${a.count} accesos en las últimas ${Analytics.ALERT_HOURS}h — Último: ${formatDate(a.lastAccess)}</div>
          </div>
        </div>
      `;
    });

    sessionAlerts.forEach(s => {
      alertsHtml += `
        <div class="analytics-alert session-alert">
          <div class="analytics-alert-icon">🔥</div>
          <div class="analytics-alert-content">
            <div class="analytics-alert-title">Cliente ${escapeHtml(s.clientId)}</div>
            <div class="analytics-alert-desc">${s.productsViewed} productos diferentes vistos en esta sesión (${s.totalViews} vistas totales)</div>
          </div>
        </div>
      `;
    });

    alertsContainer.innerHTML = alertsHtml;
  } else {
    alertsSection.style.display = 'none';
  }

  // Client Ranking
  const ranking = Analytics.getClientRanking();
  const rankingTable = document.getElementById('analytics-client-ranking');
  const rankingBody = rankingTable.querySelector('tbody');
  const noClients = document.getElementById('analytics-no-clients');

  if (ranking.length > 0) {
    rankingTable.style.display = 'table';
    noClients.style.display = 'none';
    rankingBody.innerHTML = ranking.map((c, i) => {
      const rankClass = i < 3 ? ` top-${i + 1}` : '';
      const lastAccess = c.lastAccess ? formatDate(c.lastAccess) : '—';
      return `
        <tr>
          <td><span class="rank-badge${rankClass}">${i + 1}</span></td>
          <td>
            <span class="client-name">${escapeHtml(c.clientName)}</span>
            <span class="client-id">ID: ${escapeHtml(c.clientId)}</span>
          </td>
          <td><strong>${c.totalAccesses}</strong></td>
          <td>${c.productsViewed}</td>
          <td style="font-size:11px;color:var(--text-secondary);">${lastAccess}</td>
        </tr>
      `;
    }).join('');
  } else {
    rankingTable.style.display = 'none';
    noClients.style.display = 'block';
  }

  // Top Products
  const topProducts = Analytics.getTopProducts(10);
  const productsTable = document.getElementById('analytics-top-products');
  const productsBody = productsTable.querySelector('tbody');
  const noProducts = document.getElementById('analytics-no-products');

  if (topProducts.length > 0) {
    productsTable.style.display = 'table';
    noProducts.style.display = 'none';
    const maxViews = topProducts[0].totalViews;
    productsBody.innerHTML = topProducts.map((p, i) => {
      const rankClass = i < 3 ? ` top-${i + 1}` : '';
      const barWidth = Math.round((p.totalViews / maxViews) * 60);
      return `
        <tr>
          <td><span class="rank-badge${rankClass}">${i + 1}</span></td>
          <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(p.productName)}</td>
          <td>
            <div class="views-bar">
              <span>${p.totalViews}</span>
              <div class="views-bar-fill" style="width:${barWidth}px"></div>
            </div>
          </td>
          <td>${p.uniqueClients}</td>
        </tr>
      `;
    }).join('');
  } else {
    productsTable.style.display = 'none';
    noProducts.style.display = 'block';
  }

  // Daily Chart
  renderDailyChart();
}

function renderDailyChart() {
  const ctx = document.getElementById('analytics-daily-chart');
  if (!ctx) return;

  const dailyData = Analytics.getDailyAccessStats(30);
  const labels = dailyData.map(d => {
    const date = new Date(d.date + 'T00:00:00');
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  });
  const data = dailyData.map(d => d.count);

  // Destroy existing chart
  if (analyticsChart) {
    analyticsChart.destroy();
    analyticsChart = null;
  }

  if (typeof Chart === 'undefined') return;

  analyticsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Accesos',
        data: data,
        backgroundColor: 'rgba(233, 69, 96, 0.7)',
        borderColor: '#e94560',
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a2e',
          titleFont: { family: 'Inter', size: 12 },
          bodyFont: { family: 'Inter', size: 11 },
          cornerRadius: 8,
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: 'Inter', size: 9 },
            color: '#9ca3af',
            maxRotation: 45,
            autoSkip: true,
            maxTicksLimit: 10
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            font: { family: 'Inter', size: 10 },
            color: '#9ca3af',
            precision: 0
          },
          grid: {
            color: 'rgba(0,0,0,0.04)'
          }
        }
      }
    }
  });
}
