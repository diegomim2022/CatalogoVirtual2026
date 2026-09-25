// ============================================
// DETALLE DE PRODUCTO Y GESTOS MÓVILES
// ============================================

import { CONFIG } from './config.js';
import {
  escapeHtml,
  formatCurrency,
  getDriveId,
  getDetailMedia,
  getProductPrice,
  handleImgError,
  shuffleArray
} from './utils.js';
import {
  state,
  PRODUCTS
} from './state.js';
import { openZoom } from './zoom.js';
import { renderCatalog } from './catalog.js';

export function openProduct(productId) {
  state.selectedProduct = PRODUCTS.find(p => p.id === productId);
  state.detailQty = 1;
  state.currentDetailImageIndex = 0;

  // Track product view for analytics
  if (typeof Analytics !== 'undefined' && state.currentUser && state.selectedProduct) {
    Analytics.trackProductView(state.currentUser.id, state.selectedProduct.id, state.selectedProduct.name);
  }

  // Filtrar automáticamente por la categoría del producto seleccionado
  if (state.selectedProduct) {
    state.selectedCategory = state.selectedProduct.category;
    
    // Limpiar filtro de búsqueda por texto para mostrar la categoría completa
    state.searchQuery = '';
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.value = '';
    }
    
    // Refrescar la vista del catálogo
    renderCatalog();
  }

  window.navigateTo('detail');
}

export function renderDetail() {
  const product = state.selectedProduct;
  if (!product) return;

  const price = getProductPrice(product);
  const inStock = product.stock > 0;

  // Gallery logic
  const media = getDetailMedia(product);
  const wrapper = document.getElementById('gallery-wrapper');

  const existingVideo = wrapper.querySelector('video');
  if (existingVideo) {
      existingVideo.pause();
      existingVideo.src = '';
      existingVideo.load();
  }
  const existingIframe = wrapper.querySelector('iframe');
  if (existingIframe) {
      existingIframe.src = 'about:blank';
  }

  wrapper.innerHTML = media.map(item => {
    if (item.type === 'video') {
      if (item.native) {
        return `
    <div class="gallery-video-slide">
      <video controls playsinline preload="metadata" src="${escapeHtml(item.src)}" poster="${escapeHtml(item.poster)}"></video>
    </div>
  `;
      }
      return `
    <div class="gallery-video-slide">
      <iframe src="${escapeHtml(item.preview)}" loading="lazy" allow="autoplay; fullscreen" allowfullscreen title="Video del producto"></iframe>
    </div>
  `;
    }
    const driveId = getDriveId(item.src);
    return `
    <img src="${escapeHtml(item.src)}" alt="${escapeHtml(product.name)}" data-drive-id="${driveId || ''}" loading="lazy" draggable="false" onerror="handleImgError(this)">
  `;
  }).join('');

  // Add scroll listener for dots
  wrapper.onscroll = () => {
    const index = Math.round(wrapper.scrollLeft / (wrapper.clientWidth || 1));
    if (state.currentDetailImageIndex !== index) {
      state.currentDetailImageIndex = index;
      updateDetailDots(media.length);
    }
  };

  // Enable mouse drag-to-scroll
  let isDown = false;
  let startX;
  let scrollLeft;
  let isDraggingGallery = false;

  wrapper.onmousedown = (e) => {
    isDown = true;
    wrapper.style.cursor = 'grabbing';
    wrapper.style.scrollSnapType = 'none'; // Disable snapping while dragging
    startX = e.pageX - wrapper.offsetLeft;
    scrollLeft = wrapper.scrollLeft;
    isDraggingGallery = false;
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
    setTimeout(() => { isDraggingGallery = false; }, 50);
  };

  wrapper.onmousemove = (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - wrapper.offsetLeft;
    const walk = (x - startX) * 1.5; // Adjusted multiplier
    if (Math.abs(walk) > 5) isDraggingGallery = true;
    wrapper.scrollLeft = scrollLeft - walk;
  };

  state.currentDetailImageIndex = 0; // Reset index to first image
  updateDetailDots(media.length);
  wrapper.scrollLeft = 0; // Ensure starts at beginning

  // Arrow buttons visibility
  const prevBtn = document.getElementById('gallery-btn-prev');
  const nextBtn = document.getElementById('gallery-btn-next');
  if (prevBtn && nextBtn) {
    if (media.length > 1) {
      prevBtn.style.display = 'flex';
      nextBtn.style.display = 'flex';
    } else {
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
    }
  }

  const catEl = document.getElementById('detail-category');
  catEl.textContent = product.category;
  catEl.onclick = () => {
    state.selectedCategory = product.category;
    state.searchQuery = '';
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    window.navigateTo('home');
  };
  document.getElementById('detail-name').textContent = product.name;
  document.getElementById('detail-ref').textContent = product.reference;
  
  // Format description with bullet points if hyphens are found at start of line
  let formattedDesc = escapeHtml(product.description || '');
  if (formattedDesc.includes('- ') || formattedDesc.includes('-')) {
     formattedDesc = formattedDesc.replace(/(?:\r\n|\r|\n)- /g, '<br>• ').replace(/^- /g, '• ');
  }
  document.getElementById('detail-description').innerHTML = formattedDesc;
  
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

  // Attach zoom to images only (los slides de video son iframes autocontenidos)
  let photoIndex = 0;
  Array.from(wrapper.children).forEach((child) => {
    if (child.tagName === 'IMG') {
      const currentIdx = photoIndex;
      child.style.cursor = 'zoom-in';
      child.style.pointerEvents = 'auto'; // Allow clicking
      child.onclick = (e) => {
        if (isDraggingGallery) {
          e.preventDefault();
          return;
        }
        openZoom(currentIdx);
      };
      photoIndex++;
    }
  });
  
  // Render related products
  renderRelatedProducts();
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
  if (detailScreen) {
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
        window.navigateTo('home');
      }
    }, { passive: true });
  }
})();

export function updateDetailDots(count) {
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

export function setDetailImage(index) {
  state.currentDetailImageIndex = index;
  const wrapper = document.getElementById('gallery-wrapper');
  wrapper.scrollTo({
    left: index * wrapper.clientWidth,
    behavior: 'smooth'
  });
}

export function changeDetailImage(delta) {
  const product = state.selectedProduct;
  if (!product) return;
  const total = getDetailMedia(product).length;
  if (total <= 1) return;

  let newIndex = state.currentDetailImageIndex + delta;
  if (newIndex < 0) newIndex = total - 1;
  if (newIndex >= total) newIndex = 0;

  setDetailImage(newIndex);
}

export function renderRelatedProducts() {
  const product = state.selectedProduct;
  const section = document.getElementById('related-products-section');
  const list = document.getElementById('related-products-list');
  if (!product || !section || !list) return;

  // Filter same category, exclude current, only in stock
  let related = PRODUCTS.filter(p => p.category === product.category && p.id !== product.id && p.stock > 0);
  if (related.length === 0) {
    section.style.display = 'none';
    return;
  }
  
  // Shuffle array and take 4
  related = shuffleArray([...related]).slice(0, 4);
  
  list.innerHTML = related.map(p => {
    const price = getProductPrice(p);
    return `
      <div class="related-product-card" onclick="openProduct('${escapeHtml(p.id)}')">
        <div class="related-product-img">
          <img src="${escapeHtml(p.photo)}" alt="${escapeHtml(p.name)}" onerror="handleImgError(this)">
        </div>
        <div class="related-info">
          <h4>${escapeHtml(p.name)}</h4>
          <p>${formatCurrency(price)}</p>
        </div>
      </div>
    `;
  }).join('');
  
  section.style.display = 'block';
}

export function changeDetailQty(delta) {
  const product = state.selectedProduct;
  if (!product) return;
  const newQty = state.detailQty + delta;
  if (newQty < 1 || newQty > product.stock) return;
  state.detailQty = newQty;
  renderDetail();
}

export function orderSingleProductWhatsApp() {
  const product = state.selectedProduct;
  if (!product || product.stock === 0) return;
  
  const qty = state.detailQty;
  const price = getProductPrice(product);
  const total = price * qty;
  
  let msg = `*NUEVO PEDIDO DIRECTO* 📦\n\n`;
  msg += `*Producto:* ${product.name}\n`;
  msg += `*Referencia:* ${product.reference}\n`;
  msg += `*Cantidad:* ${qty}\n`;
  msg += `*Total:* ${formatCurrency(total)}\n\n`;
  
  if (state.currentUser) {
    msg += `*Cliente:* ${state.currentUser.name} (${state.currentUser.type})\n`;
    msg += `*Doc:* ${state.currentUser.id}\n`;
  }
  
  const waUrl = `https://wa.me/${CONFIG.vendorPhone}?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, '_blank');
}
