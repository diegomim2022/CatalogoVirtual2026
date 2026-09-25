// ============================================
// AUTENTICACIÓN, SESIÓN Y HEADER
// ============================================

import { CONFIG } from './config.js';
import {
  state,
  PRODUCTS,
  DEMO_CLIENTS
} from './state.js';
import { persistSession } from './storage.js';
import { updateCartBadge } from './cart.js';
import { openProduct } from './detail.js';
import { stopPromoRotation } from './catalog.js';

export function initLogin() {
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

export function loginAsVisitor() {
  state.currentUser = {
    id: 'visitante-' + Date.now().toString().slice(-4),
    name: 'Visitante',
    type: 'Usuario Final',
    phone: ''
  };
  finishLogin();
}

export function handleWholesaleLogin(e) {
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

export function handlePostLogin() {
  const urlParams = new URLSearchParams(window.location.search);
  const prodId = urlParams.get('producto');
  const productExists = PRODUCTS.some(p => p.id === prodId);

  if (prodId && productExists) {
    openProduct(prodId);
  } else {
    window.navigateTo('home');
  }

  updateCartBadge();

  // Restaurar visibilidad de pestaña Nanocarbon
  const nanoBtn = document.getElementById('nav-btn-nano');
  if (nanoBtn && state.currentUser) {
    nanoBtn.classList.toggle('nav-item-nano-hidden', state.currentUser.type !== 'Mayorista');
  }
}

export function finishLogin() {
  // Track access for analytics
  if (typeof Analytics !== 'undefined') {
    Analytics.trackAccess(state.currentUser.id, state.currentUser.name);
  }

  handlePostLogin();
  renderHeader();
  persistSession();
}

export function logout() {
  state.currentUser = null;
  state.cart = [];
  state.searchQuery = '';
  state.selectedCategory = 'all';
  state.visibleProductCount = CONFIG.productsPerPage;
  const loginIdInput = document.getElementById('login-id');
  if (loginIdInput) loginIdInput.value = '';
  stopPromoRotation();
  if (state.paginationObserver) { state.paginationObserver.disconnect(); state.paginationObserver = null; }
  localStorage.removeItem('catalogo_session');

  // Ocultar pestaña Nanocarbon al cerrar sesión
  const nanoBtn = document.getElementById('nav-btn-nano');
  if (nanoBtn) nanoBtn.classList.add('nav-item-nano-hidden');

  window.navigateTo('login');
}

export function renderHeader() {
  if (!state.currentUser) return;
  const el = document.getElementById('header-user-name');
  const avatar = document.getElementById('header-avatar');
  const type = document.getElementById('header-user-type');

  const userName = state.currentUser.name || 'Cliente';
  if (el) el.textContent = userName;
  if (avatar) avatar.textContent = userName.charAt(0).toUpperCase();
  if (type) type.textContent = state.currentUser.type === 'Mayorista' ? '💎 Mayorista' : '👤 Usuario Final';
}

export function requestAdminAccess() {
  if (state.adminAuthenticated) {
    window.navigateTo('analytics');
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

export function closeAdminPinModal() {
  document.getElementById('admin-pin-modal').classList.remove('show');
}
