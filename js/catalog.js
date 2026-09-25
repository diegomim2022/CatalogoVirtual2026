// ============================================
// CATÁLOGO Y BÚSQUEDA DE PRODUCTOS
// ============================================

import { CONFIG } from './config.js';
import {
  escapeHtml,
  debounce,
  formatCurrency,
  getDriveId,
  getProductPrice,
  handleImgError
} from './utils.js';
import {
  state,
  PRODUCTS,
  CATEGORIES
} from './state.js';

let promoInterval = null;

export function renderSkeletons() {
  const container = document.getElementById('products-grid');
  if (!container) return;
  const skeletons = Array(6).fill(`
    <div class="product-card skeleton-card">
      <div class="skeleton-img"></div>
      <div class="product-card-info">
        <div class="skeleton-text skeleton-title"></div>
        <div class="skeleton-text skeleton-ref"></div>
        <div class="skeleton-text skeleton-price"></div>
      </div>
    </div>
  `).join('');
  container.innerHTML = skeletons;
}

export function startPromoRotation() {
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

export function getFilteredProducts() {
  let products = [...PRODUCTS];

  const normalize = (s) => (s || "").toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  const searchInput = document.getElementById('search-input');
  const query = (state.searchQuery || (searchInput ? searchInput.value : "")).trim();
  const hasSearch = query.length > 0;

  // 1. Si NO hay texto de búsqueda, filtrar por la categoría seleccionada
  if (!hasSearch && state.selectedCategory && state.selectedCategory !== 'all') {
    const selCat = normalize(state.selectedCategory);
    products = products.filter(p => normalize(p.category) === selCat);
  }

  // 2. Si hay texto en el buscador: búsqueda global ignorando la categoría activa
  // Compara sin mayúsculas ni tildes contra nombre, SKU (id y referencia), marca y categoría
  if (hasSearch) {
    const q = normalize(query);
    const words = q.split(/\s+/).filter(Boolean);
    products = products.filter(p => {
      const name = normalize(p.name);
      const sku = normalize(p.id);
      const ref = normalize(p.reference);
      const brand = normalize(p.brand || p.marca);
      const category = normalize(p.category);
      const desc = normalize(p.description);

      const target = `${name} ${sku} ${ref} ${brand} ${category} ${desc}`;
      return words.every(word => target.includes(word));
    });
  }

  return products;
}

export function renderCatalog() {
  state.visibleProductCount = CONFIG.productsPerPage; // reset pagination
  renderPromoBanner();
  renderCategories();
  renderProducts();
}

export function renderPromoBanner() {
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
  const driveId = getDriveId(product.photo);
  setTimeout(() => {
    container.innerHTML = `
      <div class="promo-content" onclick="openProduct('${safeId}')" style="cursor: pointer; flex: 1; padding-right: 15px; min-width: 0;">
        <span class="promo-tag" style="background: #e94560 !important; color: white !important;">🔥 Oferta Especial</span>
        <h3 style="font-size: 18px; margin: 4px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${safeName}</h3>
        <p style="font-size: 13px; margin: 0; color: #6b7280;">${safeRef} — <strong style="color: #e94560;">${formatCurrency(price)}</strong></p>
      </div>
      <div class="promo-image-container" onclick="openProduct('${safeId}')" style="cursor: pointer; width: 90px; height: 90px; flex-shrink: 0; background: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border: 1px solid #eee;">
        <img src="${safePhoto}" alt="${safeName}" data-drive-id="${driveId || ''}" style="max-width: 100%; max-height: 100%; object-fit: contain; display: block;" onerror="handleImgError(this)">
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

export function renderCategories() {
  const container = document.getElementById('categories-list');
  if (!container) return;

  container.innerHTML = CATEGORIES.map(cat => {
    const safeId = escapeHtml(cat.id);
    const safeLabel = escapeHtml(cat.label);
    return `
    <div class="category-chip ${state.selectedCategory === cat.id ? 'active' : ''}" data-cat-id="${safeId}" onclick="selectCategory('${safeId}')">
      <div class="cat-icon"><span>${cat.icon}</span></div>
      <span class="cat-label">${safeLabel}</span>
    </div>
  `;
  }).join('');
}

export function selectCategory(catId) {
  // Si el usuario hace clic en una categoría mientras hay texto en el buscador,
  // limpiar el input de búsqueda y filtrar solo por esa categoría
  const searchInput = document.getElementById('search-input');
  if (searchInput && searchInput.value) {
    searchInput.value = '';
  }
  state.searchQuery = '';
  state.selectedCategory = catId;
  renderCatalog();
}

export function setCategoryChipVisualToAll() {
  state.selectedCategory = 'all';
  const container = document.getElementById('categories-list');
  if (container) {
    const chips = container.querySelectorAll('.category-chip');
    chips.forEach((chip, i) => {
      const catId = chip.getAttribute('data-cat-id');
      if (catId) {
        chip.classList.toggle('active', catId === 'all');
      } else {
        chip.classList.toggle('active', i === 0);
      }
    });
  }
}

export const handleSearchDebounced = debounce(function () {
  state.visibleProductCount = CONFIG.productsPerPage; // reset pagination on new search
  renderProducts();
}, 300);

export function handleSearch(e) {
  state.searchQuery = e.target.value;
  // Si el input de búsqueda tiene texto, cambiar visualmente a "Todos"
  if (state.searchQuery.trim().length > 0) {
    setCategoryChipVisualToAll();
  }
  handleSearchDebounced();
}

export function renderProducts() {
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

    const driveId = getDriveId(product.photo);
    
    let stockIndicator = '';
    if (product.stock >= 5) {
      stockIndicator = '✓ Disponible';
    } else if (product.stock > 0) {
      stockIndicator = `⚠️ Pocas un. (${product.stock})`;
    } else {
      stockIndicator = '✗ Agotado';
    }

    let badgeHtml = '';
    if (product.isPromo) {
      badgeHtml = `<span class="product-badge oferta">Oferta</span>`;
    }

    return `
      <div class="product-card" onclick="openProduct('${safeId}')">
        <div class="product-card-image">
          <img src="${safePhoto}" alt="${safeName}" data-drive-id="${driveId || ''}" loading="lazy" onerror="handleImgError(this)">
          ${badgeHtml}
          <span class="stock-badge ${inStock ? 'in-stock' : 'out-of-stock'}">
            ${stockIndicator}
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
