// ============================================
// CARGA Y SINCRONIZACIÓN DE DATOS (SHEETS CSV)
// ============================================

import { CONFIG, IMG_PLACEHOLDER } from './config.js';
import {
  transformDriveUrl,
  getAutoIcon,
  shuffleArray
} from './utils.js';
import {
  state,
  PRODUCTS,
  setProducts,
  setCategories,
  setClients
} from './state.js';
import { restoreSession } from './storage.js';
import { renderSkeletons, startPromoRotation } from './catalog.js';
import { renderHeader, handlePostLogin } from './auth.js';

export function parseCSV(csv) {
  if (!csv) return [];
  const rows = [];
  let curVal = "";
  let curRow = [];
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const nextChar = csv[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') { curVal += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) {
      curRow.push(curVal.trim()); curVal = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (curRow.length > 0 || curVal) { curRow.push(curVal.trim()); rows.push(curRow); }
      curRow = []; curVal = "";
      if (char === '\r' && nextChar === '\n') i++;
    } else { curVal += char; }
  }
  if (curRow.length > 0 || curVal) { curRow.push(curVal.trim()); rows.push(curRow); }

  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
  const rawHeaders = rows[0].map((h, i) => {
    let header = h.replace(/^\uFEFF/, '').replace(/^"|"$/g, '').trim();
    if (header === '' && i === 0) header = 'ID Producto';
    return header;
  });
  const normHeaders = rawHeaders.map(norm);

  return rows.slice(1).map(row => {
    const obj = {};
    rawHeaders.forEach((h, i) => {
      const v = (row[i] || "").replace(/^"|"$/g, '').trim();
      obj[h] = v;
      if (normHeaders[i]) obj[normHeaders[i]] = v;
    });
    return obj;
  });
}

export function showNetworkError() {
  const grid = document.getElementById('products-grid');
  if (grid) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px;">
        <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Error de conexión</h3>
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">No se pudieron cargar los productos. Verifica tu conexión a internet.</p>
        <button class="btn btn-primary" style="max-width: 200px; margin: 0 auto;" onclick="location.reload()">Reintentar</button>
      </div>
    `;
  }
}

export async function fetchSheetData(gid) {
  // Check sessionStorage cache first
  const cacheKey = `sheet_cache_${gid}_v3`;
  const cacheTimeKey = `sheet_cache_time_${gid}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    const cachedTime = sessionStorage.getItem(cacheTimeKey);
    if (cached && cachedTime && (Date.now() - parseInt(cachedTime)) < CONFIG.cacheExpiry) {
      return JSON.parse(cached);
    }
  } catch (e) { /* sessionStorage not available, proceed */ }

  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/export?format=csv&gid=${gid}&t=${Date.now()}`;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('Network response was not ok');
    const text = await response.text();
    const data = parseCSV(text);

    // Save to cache
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
      sessionStorage.setItem(cacheTimeKey, Date.now().toString());
    } catch (e) { /* quota exceeded, ignore */ }

    return data;
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    showNetworkError();
    return null;
  }
}

export async function initData() {
  state.isLoading = true;
  document.body.classList.add('loading-skeleton');
  renderSkeletons();

  // Fetch products and clients in parallel for faster loading
  const [sheetProducts, sheetClients] = await Promise.all([
    fetchSheetData(CONFIG.gids.productos),
    fetchSheetData(CONFIG.gids.clientes)
  ]);

  if (sheetProducts && sheetProducts.length > 0) {
    setProducts(sheetProducts
      .filter(p => p.idproducto || p['ID Producto'] || p.id || p[''])
      .map(p => {
        const getV = (k) => {
          const n = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
          return p[n] || p[k] || "";
        };

        return {
          id: getV('ID Producto') || p[''] || '',
          photo: transformDriveUrl(getV('Foto')) || IMG_PLACEHOLDER,
          photos: [getV('Foto'), getV('Foto2'), getV('Foto3'), getV('Foto4')].map(url => transformDriveUrl(url)).filter(f => f && f.trim() !== ''),
          video: getV('Video') || '',
          reference: getV('Referencia') || '',
          name: getV('Nombre') || 'Sin nombre',
          description: getV('Descripcion') || '',
          category: getV('Categoria') || 'Otros',
          brand: getV('Marca') || getV('Brand') || '',
          stock: parseInt(getV('Stock Disponible').toString().replace(/\D/g, '')) || 0,
          wholesalePrice: parseInt(getV('Precio Mayorista').toString().replace(/\D/g, '')) || 0,
          retailPrice: parseInt(getV('Precio Usuario Final').toString().replace(/\D/g, '')) || 0,
          isPromo: ['si', 'true', 'yes', '1'].includes(getV('Oferta').toLowerCase().trim()) || ['si', 'true', 'yes', '1'].includes(getV('Promo').toLowerCase().trim())
        };
      }));

    // Generar categorías dinámicas
    const uniqueCats = [...new Set(PRODUCTS.map(p => p.category))].filter(c => c && c !== 'Otros');
    setCategories([
      { id: 'all', label: 'Todos', icon: '🏷️' },
      ...uniqueCats.map(cat => ({
        id: cat,
        label: cat,
        icon: getAutoIcon(cat)
      })),
      { id: 'Otros', label: 'Otros', icon: '✨' }
    ]);

    // Aleatorizar el orden de los productos
    shuffleArray(PRODUCTS);
  }

  if (sheetClients && sheetClients.length > 0) {
    setClients(sheetClients.map(c => ({
      id: c['Identificacion']?.toString().trim(),
      name: c['Nombre'],
      type: c['Tipo Cliente'],
      phone: c['Telefono WhatsApp']?.toString().trim() || ''
    })));
  }

  state.isLoading = false;
  document.body.classList.remove('loading-skeleton');

  // Initialize Analytics Web App URL
  if (typeof Analytics !== 'undefined' && CONFIG.analyticsWebAppUrl) {
    Analytics.setWebAppUrl(CONFIG.analyticsWebAppUrl);
  }

  // Restore session if available
  if (restoreSession()) {
    handlePostLogin();
  } else {
    window.navigateTo('login');
  }

  renderHeader();
  startPromoRotation();
}
