// ============================================
// CONFIGURACIÓN Y CONSTANTES DEL CATÁLOGO
// ============================================

export const CONFIG = {
  vendorPhone: '573158512091', // Número WhatsApp del vendedor (admin)
  currency: 'COP',
  appName: 'Catalogo de Productos',
  sheetId: '1QMPMUbokrU0fHHL1EG2XTWfk6Cg5ITah_rttYDsMvyw',
  gids: {
    productos: '0',
    clientes: '1788392842'
  },
  cacheExpiry: 5 * 60 * 1000, // 5 minutos de caché
  productsPerPage: 20, // productos por lote de paginación
  adminPin: '1324', // Clave de acceso al panel admin
  analyticsWebAppUrl: 'https://script.google.com/macros/s/AKfycby_UuX0XEZ-bH1DSQtMjEOvN_Md5-XTSoWECyX9ingLZWaSWpUGjMQmCykBYvKeG4DVgQ/exec', // URL del Google Apps Script Web App
  sessionExpiry: 48 * 60 * 60 * 1000 // 48 horas para persistencia de sesión y carrito
};

export const IMG_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect fill="#f0f0f3" width="400" height="400"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="sans-serif" font-size="48">📷</text><text x="50%" y="62%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="sans-serif" font-size="14">Imagen no disponible</text></svg>');
