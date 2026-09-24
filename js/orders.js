// ============================================
// GESTIÓN DE PEDIDOS Y CONFIRMACIÓN
// ============================================

import { CONFIG } from './config.js';
import { escapeHtml, formatCurrency, formatDate, generateOrderId } from './utils.js';
import { saveOrders, persistSession } from './storage.js';
import { state } from './state.js';
import { getCartTotal, updateCartBadge } from './cart.js';

// ---- ORDER CONFIRMATION ----
export function goToConfirmation() {
  if (state.cart.length === 0) return;
  if (typeof window.navigateTo === 'function') {
    window.navigateTo('confirm');
  }
}

export function renderConfirmation() {
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

export function cancelOrder() {
  if (typeof window.navigateTo === 'function') {
    window.navigateTo('cart');
  }
}

export function sendOrder() {
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
  persistSession();
}

export function generateVendorMessage(order) {
  const totalQty = order.items.reduce((sum, item) => sum + item.qty, 0);

  let msg = `📦 *PEDIDO # ${order.id}*\n`;
  msg += `━━━━━━━━━━━━━━\n`;
  msg += `👤 ${order.clientName} (${order.clientId})\n`;
  msg += `📅 ${formatDate(order.date)}\n`;
  msg += `📞 ${order.clientPhone}\n`;
  msg += `💼 ${order.clientType}\n`;
  msg += `━━━━━━━━━━━━━━\n`;
  msg += `*PRODUCTOS (${totalQty} uds):*\n\n`;

  order.items.forEach((item, i) => {
    msg += `${i + 1}. ${item.name} (${item.reference})\n`;
    msg += `    ${item.qty} x ${formatCurrency(item.price)} = ${formatCurrency(item.subtotal)}\n\n`;
  });

  msg += `━━━━━━━━━━━━━━\n`;
  msg += `💰 *TOTAL A PAGAR: ${formatCurrency(order.total)}*\n`;
  msg += `📋 Estado: Pendiente`;

  return msg;
}

export function generateClientMessage(order) {
  let msg = `✅ *¡Su pedido #${order.id} fue recibido!*\n\n`;
  msg += `Total: ${formatCurrency(order.total)}\n`;
  msg += `Le contactaremos pronto.\n\n`;
  msg += `Gracias por su compra. 🛍️`;
  return msg;
}

export function showSuccessOverlay(order, waUrl) {
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

export function closeSuccessOverlay() {
  document.getElementById('success-overlay').classList.remove('show');
  if (typeof window.navigateTo === 'function') {
    window.navigateTo('home');
  }
}

// ---- ORDER HISTORY ----
export function renderOrders() {
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

export function toggleOrderDetails(card) {
  card.classList.toggle('expanded');
}
