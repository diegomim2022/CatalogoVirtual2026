// ============================
// MÓDULO DE ANALÍTICA
// Con persistencia en localStorage + Google Sheets
// ============================

const Analytics = (() => {
  const KEYS = {
    accesses: 'analytics_accesses',
    productViews: 'analytics_product_views'
  };

  const ALERT_THRESHOLD = 5;       // accesos en periodo
  const ALERT_HOURS = 24;          // periodo en horas
  const SESSION_VIEW_THRESHOLD = 10; // vistas de productos en una sesión

  // URL del Google Apps Script Web App (se configura después del deploy)
  let WEBAPP_URL = '';

  // ---- Helpers ----
  function getData(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch { return []; }
  }

  function setData(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('Analytics: localStorage quota exceeded', e);
    }
  }

  // Enviar datos al Google Apps Script Web App (fire-and-forget)
  function sendToSheets(payload) {
    if (!WEBAPP_URL) return;
    try {
      fetch(WEBAPP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      }).catch(err => console.warn('Analytics Sheets sync error:', err));
    } catch (e) {
      console.warn('Analytics: could not send to Sheets', e);
    }
  }

  // Cargar datos desde Google Sheets (para el panel admin)
  async function loadFromSheets() {
    if (!WEBAPP_URL) return null;
    try {
      const [accessRes, viewsRes] = await Promise.all([
        fetch(WEBAPP_URL + '?action=getAccesses').then(r => r.json()),
        fetch(WEBAPP_URL + '?action=getProductViews').then(r => r.json())
      ]);

      if (accessRes.success && accessRes.data) {
        setData(KEYS.accesses, accessRes.data);
      }
      if (viewsRes.success && viewsRes.data) {
        setData(KEYS.productViews, viewsRes.data);
      }
      return { accesses: accessRes.data || [], views: viewsRes.data || [] };
    } catch (e) {
      console.warn('Analytics: could not load from Sheets', e);
      return null;
    }
  }

  // Configurar la URL del Web App
  function setWebAppUrl(url) {
    WEBAPP_URL = url;
  }

  function getWebAppUrl() {
    return WEBAPP_URL;
  }

  // ---- 1. Registro de accesos ----
  function trackAccess(clientId, clientName) {
    const record = {
      clientId: String(clientId),
      clientName: clientName || 'Cliente ' + clientId,
      timestamp: new Date().toISOString()
    };

    // Guardar en localStorage
    const accesses = getData(KEYS.accesses);
    accesses.push(record);
    setData(KEYS.accesses, accesses);

    // Enviar a Google Sheets
    sendToSheets({
      action: 'trackAccess',
      clientId: record.clientId,
      clientName: record.clientName
    });
  }

  // ---- 2. Registro de vistas de productos ----
  function trackProductView(clientId, productId, productName) {
    const record = {
      clientId: String(clientId),
      productId: String(productId),
      productName: productName || 'Producto',
      timestamp: new Date().toISOString()
    };

    // Guardar en localStorage
    const views = getData(KEYS.productViews);
    views.push(record);
    setData(KEYS.productViews, views);

    // Enviar a Google Sheets
    sendToSheets({
      action: 'trackProductView',
      clientId: record.clientId,
      productId: record.productId,
      productName: record.productName
    });
  }

  // ---- 3. Ranking de clientes más interesados ----
  function getClientRanking() {
    const accesses = getData(KEYS.accesses);
    const views = getData(KEYS.productViews);

    const clientMap = {};

    // Contar accesos
    accesses.forEach(a => {
      if (!clientMap[a.clientId]) {
        clientMap[a.clientId] = {
          clientId: a.clientId,
          clientName: a.clientName,
          totalAccesses: 0,
          productsViewed: 0,
          lastAccess: null,
          uniqueProducts: new Set()
        };
      }
      clientMap[a.clientId].totalAccesses++;
      const ts = new Date(a.timestamp);
      if (!clientMap[a.clientId].lastAccess || ts > clientMap[a.clientId].lastAccess) {
        clientMap[a.clientId].lastAccess = ts;
        clientMap[a.clientId].clientName = a.clientName;
      }
    });

    // Contar productos vistos
    views.forEach(v => {
      if (!clientMap[v.clientId]) {
        clientMap[v.clientId] = {
          clientId: v.clientId,
          clientName: 'Cliente ' + v.clientId,
          totalAccesses: 0,
          productsViewed: 0,
          lastAccess: null,
          uniqueProducts: new Set()
        };
      }
      clientMap[v.clientId].productsViewed++;
      clientMap[v.clientId].uniqueProducts.add(v.productId);
    });

    // Convertir a array y ordenar
    return Object.values(clientMap)
      .map(c => ({
        clientId: c.clientId,
        clientName: c.clientName,
        totalAccesses: c.totalAccesses,
        productsViewed: c.productsViewed,
        uniqueProducts: c.uniqueProducts.size,
        lastAccess: c.lastAccess ? c.lastAccess.toISOString() : null
      }))
      .sort((a, b) => {
        const scoreA = a.totalAccesses * 2 + a.productsViewed;
        const scoreB = b.totalAccesses * 2 + b.productsViewed;
        return scoreB - scoreA;
      });
  }

  // ---- 4. Top productos más vistos ----
  function getTopProducts(limit = 10) {
    const views = getData(KEYS.productViews);
    const productMap = {};

    views.forEach(v => {
      if (!productMap[v.productId]) {
        productMap[v.productId] = {
          productId: v.productId,
          productName: v.productName,
          totalViews: 0,
          uniqueClients: new Set()
        };
      }
      productMap[v.productId].totalViews++;
      productMap[v.productId].uniqueClients.add(v.clientId);
      productMap[v.productId].productName = v.productName;
    });

    return Object.values(productMap)
      .map(p => ({
        productId: p.productId,
        productName: p.productName,
        totalViews: p.totalViews,
        uniqueClients: p.uniqueClients.size
      }))
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, limit);
  }

  // ---- 5. Estadísticas de accesos por día ----
  function getDailyAccessStats(days = 30) {
    const accesses = getData(KEYS.accesses);
    const now = new Date();
    const stats = {};

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      stats[key] = 0;
    }

    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);

    accesses.forEach(a => {
      const ts = new Date(a.timestamp);
      if (ts >= cutoff) {
        const key = ts.toISOString().split('T')[0];
        if (stats[key] !== undefined) {
          stats[key]++;
        }
      }
    });

    return Object.entries(stats).map(([date, count]) => ({ date, count }));
  }

  // ---- 6. Alertas de clientes muy interesados ----
  function getAlerts(threshold = ALERT_THRESHOLD, hours = ALERT_HOURS) {
    const accesses = getData(KEYS.accesses);
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    const recentByClient = {};

    accesses.forEach(a => {
      const ts = new Date(a.timestamp);
      if (ts >= cutoff) {
        if (!recentByClient[a.clientId]) {
          recentByClient[a.clientId] = {
            clientId: a.clientId,
            clientName: a.clientName,
            count: 0,
            lastAccess: null
          };
        }
        recentByClient[a.clientId].count++;
        if (!recentByClient[a.clientId].lastAccess || ts > new Date(recentByClient[a.clientId].lastAccess)) {
          recentByClient[a.clientId].lastAccess = ts.toISOString();
          recentByClient[a.clientId].clientName = a.clientName;
        }
      }
    });

    return Object.values(recentByClient)
      .filter(c => c.count >= threshold)
      .sort((a, b) => b.count - a.count);
  }

  // ---- 7. Alertas de sesión ----
  function getSessionAlerts(threshold = SESSION_VIEW_THRESHOLD) {
    const views = getData(KEYS.productViews);
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const sessionByClient = {};

    views.forEach(v => {
      const ts = new Date(v.timestamp);
      if (ts >= cutoff) {
        if (!sessionByClient[v.clientId]) {
          sessionByClient[v.clientId] = {
            clientId: v.clientId,
            count: 0,
            products: new Set()
          };
        }
        sessionByClient[v.clientId].count++;
        sessionByClient[v.clientId].products.add(v.productId);
      }
    });

    return Object.values(sessionByClient)
      .filter(c => c.products.size >= threshold)
      .map(c => ({
        clientId: c.clientId,
        productsViewed: c.products.size,
        totalViews: c.count
      }))
      .sort((a, b) => b.productsViewed - a.productsViewed);
  }

  // ---- 8. Resumen rápido ----
  function getSummary() {
    const accesses = getData(KEYS.accesses);
    const views = getData(KEYS.productViews);
    const today = new Date().toISOString().split('T')[0];

    const accessesToday = accesses.filter(a => a.timestamp.startsWith(today)).length;
    const uniqueClientsToday = new Set(
      accesses.filter(a => a.timestamp.startsWith(today)).map(a => a.clientId)
    ).size;
    const viewsToday = views.filter(v => v.timestamp.startsWith(today)).length;
    const totalAccesses = accesses.length;
    const totalClients = new Set(accesses.map(a => a.clientId)).size;

    return {
      accessesToday,
      uniqueClientsToday,
      viewsToday,
      totalAccesses,
      totalClients
    };
  }

  // ---- 9. Limpiar datos de analítica ----
  function clearAll() {
    localStorage.removeItem(KEYS.accesses);
    localStorage.removeItem(KEYS.productViews);
  }

  // ---- Public API ----
  return {
    trackAccess,
    trackProductView,
    getClientRanking,
    getTopProducts,
    getDailyAccessStats,
    getAlerts,
    getSessionAlerts,
    getSummary,
    clearAll,
    loadFromSheets,
    setWebAppUrl,
    getWebAppUrl,
    ALERT_THRESHOLD,
    ALERT_HOURS
  };
})();
