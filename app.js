// ============================
// CATÁLOGO DIGITAL DE PEDIDOS
// ============================

import { CONFIG, IMG_PLACEHOLDER } from './js/config.js';
import {
  escapeHtml,
  formatCurrency,
  formatDate,
  shuffleArray,
  showToast,
  handleImgError,
  transformDriveUrl,
  getProductPrice,
  getAutoIcon
} from './js/utils.js';
import {
  saveToStorage,
  getFromStorage,
  persistSession,
  restoreSession
} from './js/storage.js';
import {
  state,
  PRODUCTS,
  CATEGORIES,
  DEMO_CLIENTS,
  setProducts,
  setCategories,
  setClients
} from './js/state.js';
import {
  getCartCount,
  getCartTotal,
  updateCartBadge,
  addToCartFromDetail,
  quickAddToCart,
  renderCart,
  changeCartQty,
  removeFromCart,
  clearCart
} from './js/cart.js';
import {
  goToConfirmation,
  renderConfirmation,
  cancelOrder,
  sendOrder,
  generateVendorMessage,
  generateClientMessage,
  showSuccessOverlay,
  closeSuccessOverlay,
  renderOrders,
  toggleOrderDetails
} from './js/orders.js';
import {
  openZoom,
  updateZoomUI,
  changeZoomImage,
  closeZoom,
  toggleZoom,
  initZoomSwipe,
  handleZoomSwipe
} from './js/zoom.js';
import {
  getFilteredProducts,
  renderCategories,
  selectCategory,
  setCategoryChipVisualToAll,
  handleSearch,
  handleSearchDebounced,
  renderPromoBanner,
  startPromoRotation,
  renderSkeletons,
  renderCatalog,
  renderProducts
} from './js/catalog.js';
import {
  openProduct,
  renderDetail,
  changeDetailQty,
  setDetailImage,
  changeDetailImage,
  updateDetailDots,
  renderRelatedProducts,
  orderSingleProductWhatsApp
} from './js/detail.js';

// ---- UTILS & SYNC ----

async function fetchSheetData(gid) {
  // Check sessionStorage cache first
  const cacheKey = `sheet_cache_${gid}_v3`;
  const cacheTimeKey = `sheet_cache_time_${gid}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    const cachedTime = sessionStorage.getItem(cacheTimeKey);
    if (cached && cachedTime && (Date.now() - parseInt(cachedTime)) < CONFIG.cacheExpiry) {
      return JSON.parse(cached);
    }
  } catch (e) { /* sessionStorage not available, proceed */ }

  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/export?format=csv&gid=${gid}&t=${Date.now()}`;
  try {
    const response = await fetch(url, { cache: 'no-store' });
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
  const rawHeaders = rows[0].map((h, i) => {
    let header = h.replace(/^\uFEFF/, '').replace(/^"|"$/g, '').trim();
    if (header === '' && i === 0) header = 'ID Producto';
    return header;
  });
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





async function initData() {
  state.isLoading = true;
  document.body.classList.add('loading-skeleton');
  renderSkeletons();

  // Fetch products and clients in parallel for faster loading
  const [sheetProducts, sheetClients] = await Promise.all([
    fetchSheetData(CONFIG.gids.productos),
    fetchSheetData(CONFIG.gids.clientes)
  ]);

  if (sheetProducts && sheetProducts.length > 0) {
    setProducts(sheetProducts
      .filter(p => p.idproducto || p['ID Producto'] || p.id || p[''])
      .map(p => {
        const getV = (k) => {
          const n = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
          return p[n] || p[k] || "";
        };

        return {
          id: getV('ID Producto') || p[''] || '',
          photo: transformDriveUrl(getV('Foto')) || IMG_PLACEHOLDER,
          photos: [getV('Foto'), getV('Foto2'), getV('Foto3'), getV('Foto4')].map(url => transformDriveUrl(url)).filter(f => f && f.trim() !== ''),
          video: getV('Video') || '',
          reference: getV('Referencia') || '',
          name: getV('Nombre') || 'Sin nombre',
          description: getV('Descripcion') || '',
          category: getV('Categoria') || 'Otros',
          brand: getV('Marca') || getV('Brand') || '',
          stock: parseInt(getV('Stock Disponible').toString().replace(/\D/g, '')) || 0,
          wholesalePrice: parseInt(getV('Precio Mayorista').toString().replace(/\D/g, '')) || 0,
          retailPrice: parseInt(getV('Precio Usuario Final').toString().replace(/\D/g, '')) || 0,
          isPromo: ['si', 'true', 'yes', '1'].includes(getV('Oferta').toLowerCase().trim()) || ['si', 'true', 'yes', '1'].includes(getV('Promo').toLowerCase().trim())
        };
      }));

    // Generar categorías dinámicas
    const uniqueCats = [...new Set(PRODUCTS.map(p => p.category))].filter(c => c && c !== 'Otros');
    setCategories([
      { id: 'all', label: 'Todos', icon: '🏷️' },
      ...uniqueCats.map(cat => ({
        id: cat,
        label: cat,
        icon: getAutoIcon(cat)
      })),
      { id: 'Otros', label: 'Otros', icon: '✨' }
    ]);

    // Aleatorizar el orden de los productos
    shuffleArray(PRODUCTS);
  }

  if (sheetClients && sheetClients.length > 0) {
    setClients(sheetClients.map(c => ({
      id: c['Identificacion']?.toString().trim(),
      name: c['Nombre'],
      type: c['Tipo Cliente'],
      phone: c['Telefono WhatsApp']?.toString().trim() || ''
    })));
  }

  state.isLoading = false;
  document.body.classList.remove('loading-skeleton');

  // Initialize Analytics Web App URL
  if (typeof Analytics !== 'undefined' && CONFIG.analyticsWebAppUrl) {
    Analytics.setWebAppUrl(CONFIG.analyticsWebAppUrl);
  }

  // Restore session if available
  if (restoreSession()) {
    const urlParams = new URLSearchParams(window.location.search);
    const prodId = urlParams.get('producto');
    const productExists = PRODUCTS.some(p => p.id === prodId);

    if (prodId && productExists) {
      openProduct(prodId);
    } else {
      navigateTo('home');
    }

    updateCartBadge();
    // Restaurar visibilidad de pestaña Nanocarbon
    const nanoBtn = document.getElementById('nav-btn-nano');
    if (nanoBtn && state.currentUser) {
      nanoBtn.classList.toggle('nav-item-nano-hidden', state.currentUser.type !== 'Mayorista');
    }
  } else {
    navigateTo('login');
  }

  renderHeader();
  startPromoRotation();
}



// initData is called from the consolidated DOMContentLoaded listener at the bottom





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
  if (screenId === 'nano' && typeof NANO !== 'undefined') NANO.init();

  // Scroll to top
  window.scrollTo(0, 0);
}

// ---- AUTH ----
function initLogin() {
  const btnVisitor = document.getElementById('btn-enter-visitor');
  const btnShowWholesale = document.getElementById('btn-show-wholesale');
  const btnCancelWholesale = document.getElementById('btn-cancel-wholesale');
  const loginOptions = document.getElementById('login-options');
  const loginForm = document.getElementById('login-form');
  const loginIdInput = document.getElementById('login-id');
  const instructions = document.getElementById('login-instructions');

  if (btnVisitor) {
    btnVisitor.addEventListener('click', (e) => {
      e.preventDefault();
      loginAsVisitor();
    });
  }

  if (btnShowWholesale) {
    btnShowWholesale.addEventListener('click', () => {
      loginOptions.style.display = 'none';
      instructions.style.display = 'none';
      loginForm.style.display = 'block';
      loginIdInput.required = true;
    });
  }

  if (btnCancelWholesale) {
    btnCancelWholesale.addEventListener('click', () => {
      loginForm.style.display = 'none';
      loginOptions.style.display = 'flex';
      instructions.style.display = 'block';
      loginIdInput.required = false;
      loginIdInput.value = '';
      document.getElementById('login-error').classList.remove('show');
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', handleWholesaleLogin);
  }
}

function loginAsVisitor() {
  state.currentUser = {
    id: 'visitante-' + Date.now().toString().slice(-4),
    name: 'Visitante',
    type: 'Usuario Final',
    phone: ''
  };
  finishLogin();
}

function handleWholesaleLogin(e) {
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
    errorEl.classList.remove('show');
    finishLogin();
  } else {
    // Cliente no registrado — error
    errorEl.textContent = 'Documento no encontrado o no autorizado.';
    errorEl.classList.add('show');
  }
}

function finishLogin() {
  // Track access for analytics
  if (typeof Analytics !== 'undefined') {
    Analytics.trackAccess(state.currentUser.id, state.currentUser.name);
  }

  const urlParams = new URLSearchParams(window.location.search);
  const prodId = urlParams.get('producto');
  const productExists = PRODUCTS.some(p => p.id === prodId);

  if (prodId && productExists) {
    openProduct(prodId);
  } else {
    navigateTo('home');
  }

  renderHeader();
  updateCartBadge();
  persistSession();

  // Mostrar pestaña Nanocarbon solo para Mayoristas
  const nanoBtn = document.getElementById('nav-btn-nano');
  if (nanoBtn) {
    nanoBtn.classList.toggle('nav-item-nano-hidden', state.currentUser.type !== 'Mayorista');
  }
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
  localStorage.removeItem('catalogo_session');

  // Ocultar pestaña Nanocarbon al cerrar sesión
  const nanoBtn = document.getElementById('nav-btn-nano');
  if (nanoBtn) nanoBtn.classList.add('nav-item-nano-hidden');

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





// ---- INITIALIZATION (consolidated single listener) ----
document.addEventListener('DOMContentLoaded', () => {
  // Login flow
  initLogin();

  // Search with debounce and immediate Enter support
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        state.searchQuery = searchInput.value;
        if (state.searchQuery.trim().length > 0) {
          setCategoryChipVisualToAll();
        }
        state.visibleProductCount = CONFIG.productsPerPage;
        renderProducts();
        searchInput.blur();
      }
    });
  }

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
  try {
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
  } catch (err) {
    console.error('Error rendering Client Ranking:', err);
  }

  // Top Products
  try {
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
            <td>
              <button class="btn btn-sm" style="padding: 4px 8px; font-size: 12px; background: var(--accent); color: white; border-radius: 4px; border: none; cursor: pointer;" onclick="generatePromoMessage('${escapeHtml(p.productId)}')">📢 Promocionar</button>
            </td>
          </tr>
        `;
      }).join('');
    } else {
      productsTable.style.display = 'none';
      noProducts.style.display = 'block';
    }
  } catch (err) {
    console.error('Error rendering Top Products:', err);
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

// ---- PROMO GENERATOR ----
function generatePromoMessage(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) {
    showToast('Producto no encontrado', 'error');
    return;
  }

  const price = formatCurrency(product.retailPrice);
  
  let msg = `\uD83D\uDD25 *\u00A1PRODUCTO DEL D\u00CDA!*\ \uD83D\uDD25\n`;
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;
  msg += `\u2728 *${product.name}*\n`;
  msg += `\uD83C\uDFF7\uFE0F Ref: ${product.reference}\n`;
  msg += `\uD83D\uDCB0 Precio Especial: ${price}\n\n`;
  msg += `\u00A1Aprovecha antes de que se agote! \uD83C\uDFC3\u200D\u2642\uFE0F\uD83D\uDCA8\n`;
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;
  msg += `\uD83D\uDCF8 Toca el link para ver la foto y m\u00E1s detalles:\n`;
  msg += `\uD83D\uDC47 *M\u00EDralo y p\u00EDdelo aqu\u00ED mismo:*\n`;
  
  // Create direct link
  const urlObj = new URL(window.location.href);
  urlObj.searchParams.set('producto', product.id);
  msg += urlObj.toString();
  
  document.getElementById('promo-message-text').value = msg;
  const section = document.getElementById('promo-generator-section');
  section.style.display = 'block';
  
  // Scroll to section
  section.scrollIntoView({ behavior: 'smooth' });
}

function copyPromoMessage() {
  const textarea = document.getElementById('promo-message-text');
  textarea.select();
  document.execCommand('copy');
  showToast('Mensaje copiado al portapapeles');
}

function sendPromoWhatsApp() {
  const msg = document.getElementById('promo-message-text').value;
  if (!msg) return;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

// ---- PUENTE GLOBAL PARA ES MODULES ----
// Expone las funciones invocadas desde HTML inline (onclick, onerror, etc.)
// y templates generados dinámicamente con innerHTML.
Object.assign(window, {
  handleImgError,
  openProduct,
  quickAddToCart,
  setDetailImage,
  changeDetailImage,
  changeDetailQty,
  orderSingleProductWhatsApp,
  addToCartFromDetail,
  clearCart,
  removeFromCart,
  changeCartQty,
  goToConfirmation,
  cancelOrder,
  sendOrder,
  toggleOrderDetails,
  closeSuccessOverlay,
  openZoom,
  closeZoom,
  toggleZoom,
  navigateTo,
  logout,
  selectCategory,
  renderPromoBanner,
  renderAnalytics,
  copyPromoMessage,
  sendPromoWhatsApp,
  generatePromoMessage,
  requestAdminAccess,
  closeAdminPinModal,
  showToast,
  getFilteredProducts
});

Object.defineProperties(window, {
  state:      { get: () => state, configurable: true },
  CONFIG:     { get: () => CONFIG, configurable: true },
  PRODUCTS:   { get: () => PRODUCTS, configurable: true },
  CATEGORIES: { get: () => CATEGORIES, configurable: true }
});

