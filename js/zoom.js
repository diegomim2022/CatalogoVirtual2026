// ============================================
// MODAL DE ZOOM Y LIGHTBOX DE IMÁGENES
// ============================================

import { state } from './state.js';
import { getProductPhotos } from './utils.js';

// Swipe logic for zoom modal
let zoomTouchStartX = 0;
let zoomTouchEndX = 0;

export function openZoom(index) {
  const product = state.selectedProduct;
  if (!product) return;
  const photos = getProductPhotos(product);
  if (photos.length === 0) return;

  const validIndex = (typeof index === 'number' && index >= 0 && index < photos.length) ? index : 0;
  state.currentZoomImageIndex = validIndex;
  const modal = document.getElementById('zoom-modal');
  const zoomImg = document.getElementById('zoom-img');
  zoomImg.src = photos[validIndex];
  zoomImg.classList.remove('zoomed');

  modal.style.display = 'flex';
  void modal.offsetWidth; // fuerza reflow
  modal.classList.add('active');

  document.body.style.overflow = 'hidden';
  updateZoomUI();
  initZoomSwipe();
}

export function updateZoomUI() {
  const product = state.selectedProduct;
  if (!product) return;
  const photos = getProductPhotos(product);
  const total = photos.length;
  const current = state.currentZoomImageIndex;

  // Update counter
  const counterEl = document.getElementById('zoom-counter');
  if (counterEl) {
    counterEl.textContent = `${current + 1} / ${total}`;
    counterEl.style.display = total <= 1 ? 'none' : 'block';
  }
}

export function changeZoomImage(delta) {
  const product = state.selectedProduct;
  if (!product) return;
  const photos = getProductPhotos(product);
  const total = photos.length;
  if (total <= 1) return;

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

export function closeZoom() {
  const modal = document.getElementById('zoom-modal');
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
  setTimeout(() => {
    modal.style.display = 'none';
  }, 300);
}

export function toggleZoom(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const zoomImg = document.getElementById('zoom-img');
  if (zoomImg) zoomImg.classList.toggle('zoomed');
}

export function initZoomSwipe() {
  const modal = document.getElementById('zoom-modal');
  if (!modal) return;
  modal.ontouchstart = (e) => {
    zoomTouchStartX = e.changedTouches[0].screenX;
  };
  modal.ontouchend = (e) => {
    zoomTouchEndX = e.changedTouches[0].screenX;
    handleZoomSwipe();
  };
}

export function handleZoomSwipe() {
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
