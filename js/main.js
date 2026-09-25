// ============================================
// CATÁLOGO DIGITAL DE PEDIDOS - ENTRY POINT
// ============================================

import { CONFIG } from './config.js';
import { handleImgError, showToast } from './utils.js';
import { state, PRODUCTS, CATEGORIES } from './state.js';
import {
  addToCartFromDetail,
  quickAddToCart,
  clearCart,
  removeFromCart,
  changeCartQty,
  renderCart
} from './cart.js';
import {
  goToConfirmation,
  renderConfirmation,
  cancelOrder,
  sendOrder,
  toggleOrderDetails,
  closeSuccessOverlay,
  renderOrders
} from './orders.js';
import {
  openZoom,
  closeZoom,
  toggleZoom
} from './zoom.js';
import {
  getFilteredProducts,
  renderCatalog,
  renderPromoBanner,
  selectCategory,
  setCategoryChipVisualToAll,
  handleSearch,
  renderProducts
} from './catalog.js';
import {
  openProduct,
  renderDetail,
  setDetailImage,
  changeDetailImage,
  changeDetailQty,
  orderSingleProductWhatsApp
} from './detail.js';
import {
  initLogin,
  logout,
  requestAdminAccess,
  closeAdminPinModal
} from './auth.js';
import {
  renderAnalytics,
  generatePromoMessage,
  copyPromoMessage,
  sendPromoWhatsApp
} from './admin.js';
import { initData } from './data.js';

// ---- NAVIGATION ----
export function navigateTo(screenId) {
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
