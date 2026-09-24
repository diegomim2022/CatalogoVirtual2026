// ============================================
// GESTIÓN DEL CARRITO DE COMPRAS
// ============================================

import { state, PRODUCTS } from './state.js';
import { showToast, getProductPrice, escapeHtml, formatCurrency } from './utils.js';
import { persistSession } from './storage.js';

export function getCartCount() {
  return state.cart.reduce((sum, item) => sum + item.qty, 0);
}

export function getCartTotal() {
  return state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
}

export function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (!badge) return;
  const count = getCartCount();
  badge.textContent = count;
  badge.className = 'cart-badge' + (count > 0 ? ' show' : '');
}

export function addToCartFromDetail() {
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
  persistSession();
  if (typeof window.navigateTo === 'function') {
    window.navigateTo('home');
  }
}

export function quickAddToCart(productId) {
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
  persistSession();
}

export function renderCart() {
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
  const cartTotalEl = document.getElementById('cart-total');
  if (cartTotalEl) {
    cartTotalEl.textContent = formatCurrency(getCartTotal());
  }
}

export function changeCartQty(productId, delta) {
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
  persistSession();
}

export function removeFromCart(productId) {
  state.cart = state.cart.filter(i => i.productId !== productId);
  renderCart();
  updateCartBadge();
  persistSession();
}

export function clearCart() {
  if (state.cart.length === 0) return;
  state.cart = [];
  renderCart();
  updateCartBadge();
  persistSession();
  showToast('Carrito vaciado');
}
