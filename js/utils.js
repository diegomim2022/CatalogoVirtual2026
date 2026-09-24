// ============================================
// UTILIDADES Y AYUDANTES DEL CATÁLOGO
// ============================================

import { IMG_PLACEHOLDER } from './config.js';
import { state } from './state.js';

// ---- SECURITY: HTML ESCAPE ----
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---- UTILITY: DEBOUNCE ----
export function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ---- IMAGE ERROR FALLBACK ----
export function handleImgError(img) {
  img.onerror = null; // prevent infinite loop
  
  const driveId = img.getAttribute('data-drive-id');
  const attempts = parseInt(img.getAttribute('data-error-attempts') || '0');
  
  if (driveId && attempts < 2) {
    img.setAttribute('data-error-attempts', (attempts + 1).toString());
    
    // Rotar entre formatos: 1. lh3 (ya falló) -> 2. thumbnail -> 3. uc (direct download)
    if (attempts === 0) {
      img.src = `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000`;
      img.onerror = () => handleImgError(img);
      return;
    } else if (attempts === 1) {
      // Direct download link as last resort (often bypasses some thumbnail restrictions)
      img.src = `https://drive.google.com/uc?id=${driveId}&export=view`;
      img.onerror = () => handleImgError(img);
      return;
    }
  }

  img.src = IMG_PLACEHOLDER;
}

// ---- CATEGORY ICONS ----
export const CATEGORY_ICONS_MAP = {
  'ropa': '👕', 'vestidor': '👗', 'camisa': '👔', 'pantalon': '👖',
  'zapato': '👟', 'calzado': '👞', 'tenis': '👟',
  'bolso': '👜', 'maleta': '💼', 'morral': '🎒',
  'reloj': '⌚', 'watch': '⌚', 'joya': '💍', 'accesorio': '👓',
  'audio': '🎧', 'sonido': '🔊', 'parlante': '📻', 'audifono': '🎧',
  'hogar': '🏠', 'casa': '🏡', 'cocina': '🍳', 'mueble': '🛋️',
  'belleza': '💄', 'maquillaje': '💅', 'perfume': '✨', 'cuidado': '🧴',
  'tecnologia': '💻', 'celular': '📱', 'computador': '💻', 'electronica': '🔌',
  'tablet': '📱', 'ipad': '📱',
  'deporte': '⚽', 'gym': '🏋️', 'entrenamiento': '🚴',
  'juguete': '🧸', 'niño': '👶', 'bebe': '🍼',
  'mascota': '🐶', 'perro': '🐱', 'alimento': '🦴',
  'herramienta': '🛠️', 'construccion': '🏗️', 'ferreteria': '🔨',
  'papeleria': '📝', 'oficina': '📎', 'util': '📏',
  'salud': '💊', 'medicina': '🩺', 'bienestar': '🧘',
  'comida': '🍔', 'bebida': '🥤', 'snack': '🍿',
  'carro': '🚗', 'moto': '🏍️', 'vehiculo': '🚜',
  'cable': '🔌', 'power': '⚡', 'energia': '🔋',
  'adaptador': '🔌', 'cargador': '🔌', 'plug': '🔌',
  'gamer': '🎮', 'juego': '🎮', 'consola': '🎮',
  'nanocarbon': '🛡️', 'protector': '🛡️', 'vidrio': '💎',
  'gadget': '⚙️', 'gatget': '⚙️', 'herramienta': '🛠️'
};

export function getAutoIcon(categoryName) {
  if (!categoryName) return '📦';
  const name = categoryName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Buscar coincidencia exacta primero
  if (CATEGORY_ICONS_MAP[name]) return CATEGORY_ICONS_MAP[name];

  // Buscar por palabra clave parcial
  for (const [key, icon] of Object.entries(CATEGORY_ICONS_MAP)) {
    if (name.includes(key)) return icon;
  }

  return '📦'; // Default
}

// ---- DRIVE URL UTILS ----
export function transformDriveUrl(url) {
  if (!url || !url.includes('drive.google.com') && !url.includes('lh3.googleusercontent.com')) return url;

  // Extraer ID del archivo de diferentes formatos de Drive
  const regex = /\/d\/([^\/]+)(\/|$)|id=([^\&]+)/;
  const match = url.match(regex);
  const id = match ? (match[1] || match[3]) : null;

  if (id) {
    // Usar el dominio lh3 que suele ser más rápido y estable para miniaturas
    // El sufijo =w800 permite redimensionar la imagen en el servidor
    return `https://lh3.googleusercontent.com/d/${id}=w800`;
  }
  return url;
}

export function getDriveId(url) {
  if (!url) return null;
  const regex = /\/d\/([^\/=]+)(\/|=|$)|\/d\/([^\/]+)(\/|$)|id=([^\&]+)/;
  const match = url.match(regex);
  return match ? (match[1] || match[3] || match[5]) : null;
}

export function transformDrivePreviewUrl(url) {
  const id = getDriveId(url);
  if (!id) return url;
  // Reproductor embebido de Google Drive (funciona en cualquier dispositivo, sin login)
  return `https://drive.google.com/file/d/${id}/preview`;
}

export function getProductPhotos(product) {
  if (!product) return [];
  if (Array.isArray(product.photos) && product.photos.length > 0) {
    const valid = product.photos.filter(f => f && typeof f === 'string' && f.trim() !== '');
    if (valid.length > 0) return valid;
  }
  if (product.photo && typeof product.photo === 'string' && product.photo.trim() !== '') {
    return [product.photo];
  }
  return [];
}

export function getDetailMedia(product) {
  const photos = getProductPhotos(product);
  const media = photos.map(src => ({ type: 'image', src }));
  if (product.video) {
    const driveId = getDriveId(product.video);
    if (driveId) {
      // Video de Google Drive → reproductor embebido de Google
      media.push({
        type: 'video',
        native: false,
        preview: transformDrivePreviewUrl(product.video)
      });
    } else {
      // URL directa (repo u otro host) → reproductor nativo, sin barras negras
      media.push({
        type: 'video',
        native: true,
        src: product.video,
        poster: product.photo
      });
    }
  }
  return media;
}

export function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function formatCurrency(amount) {
  return '$' + amount.toLocaleString('es-CO');
}

export function generateOrderId() {
  // Use timestamp-based ID to avoid collisions
  const now = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return 'PED-' + now.toString(36).toUpperCase().slice(-5) + random.toString(36).toUpperCase().padStart(2, '0');
}

export function formatDate(date) {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch(e) {
    return '—';
  }
}

export function getProductPrice(product) {
  if (!state.currentUser) return product.retailPrice;
  return state.currentUser.type === 'Mayorista' ? product.wholesalePrice : product.retailPrice;
}

export function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.className = 'toast ' + type;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️'}</span> ${message}`;
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => toast.classList.remove('show'), 3000);
}
