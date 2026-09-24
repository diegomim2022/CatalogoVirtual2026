// ============================================
// ESTADO GLOBAL Y DATOS DEL CATÁLOGO
// ============================================

import { CONFIG } from './config.js';

export let PRODUCTS = [];

export let DEMO_CLIENTS = [];

export let CATEGORIES = [
  { id: 'all', label: 'Todos', icon: '🏷️' }
];

export const state = {
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

export function setProducts(newProducts) {
  PRODUCTS = newProducts;
}

export function setCategories(newCategories) {
  CATEGORIES = newCategories;
}

export function setClients(newClients) {
  DEMO_CLIENTS = newClients;
}
