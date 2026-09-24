// ============================================
// PERSISTENCIA Y ALMACENAMIENTO LOCAL
// ============================================

import { CONFIG } from './config.js';
import { state } from './state.js';

export function saveToStorage(key, data) {
  try {
    const record = {
      timestamp: Date.now(),
      data: data
    };
    localStorage.setItem(key, JSON.stringify(record));
  } catch (e) {
    console.warn(`Error saving to storage (${key}):`, e);
  }
}

export function getFromStorage(key) {
  try {
    const recordStr = localStorage.getItem(key);
    if (!recordStr) return null;
    const record = JSON.parse(recordStr);
    const now = Date.now();
    
    // Check expiration
    if (now - record.timestamp > CONFIG.sessionExpiry) {
      localStorage.removeItem(key);
      return null;
    }
    
    return record.data;
  } catch (e) {
    console.warn(`Error reading from storage (${key}):`, e);
    return null;
  }
}

export function persistSession() {
  saveToStorage('catalogo_session', {
    currentUser: state.currentUser,
    cart: state.cart
  });
}

export function restoreSession() {
  const saved = getFromStorage('catalogo_session');
  if (saved) {
    state.currentUser = saved.currentUser;
    state.cart = saved.cart || [];
    return true;
  }
  return false;
}

export function saveOrders() {
  localStorage.setItem('orders', JSON.stringify(state.orders));
}
