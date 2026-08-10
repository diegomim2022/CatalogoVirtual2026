// ============================
// ANALYTICS WEB APP
// Google Apps Script para registro de analitica
// ============================

const SPREADSHEET_ID = '1QMPMUbokrU0fHHL1EG2XTWfk6Cg5ITah_rttYDsMvyw';

// Nombres de hojas
const SHEET_ACCESOS = 'Accesos';
const SHEET_VISTAS = 'Vistas_Productos';

// ---- Configuracion inicial: crear hojas si no existen ----
function setup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Crear hoja Accesos
  let sheetAccesos = ss.getSheetByName(SHEET_ACCESOS);
  if (!sheetAccesos) {
    sheetAccesos = ss.insertSheet(SHEET_ACCESOS);
    sheetAccesos.appendRow(['Timestamp', 'ID Cliente', 'Nombre Cliente']);
    sheetAccesos.getRange(1, 1, 1, 3).setFontWeight('bold');
    sheetAccesos.setFrozenRows(1);
  }
  
  // Crear hoja Vistas_Productos
  let sheetVistas = ss.getSheetByName(SHEET_VISTAS);
  if (!sheetVistas) {
    sheetVistas = ss.insertSheet(SHEET_VISTAS);
    sheetVistas.appendRow(['Timestamp', 'ID Cliente', 'ID Producto', 'Nombre Producto']);
    sheetVistas.getRange(1, 1, 1, 4).setFontWeight('bold');
    sheetVistas.setFrozenRows(1);
  }
  
  Logger.log('Setup completado. Hojas creadas/verificadas.');
}

// ---- Manejar peticiones POST ----
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    if (action === 'trackAccess') {
      return registerAccess(data);
    } else if (action === 'trackProductView') {
      return registerProductView(data);
    } else {
      return jsonResponse({ success: false, error: 'Accion no valida' });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ---- Manejar peticiones GET (para leer datos) ----
function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (action === 'getAccesses') {
      return getAccesses();
    } else if (action === 'getProductViews') {
      return getProductViews();
    } else if (action === 'ping') {
      return jsonResponse({ success: true, message: 'Analytics API activa' });
    } else {
      return jsonResponse({ success: false, error: 'Accion no valida' });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ---- Registrar acceso ----
function registerAccess(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_ACCESOS);
  
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName(SHEET_ACCESOS);
  }
  
  const timestamp = new Date().toISOString();
  sheet.appendRow([timestamp, data.clientId || '', data.clientName || '']);
  
  return jsonResponse({ success: true, action: 'trackAccess', timestamp: timestamp });
}

// ---- Registrar vista de producto ----
function registerProductView(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_VISTAS);
  
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName(SHEET_VISTAS);
  }
  
  const timestamp = new Date().toISOString();
  sheet.appendRow([timestamp, data.clientId || '', data.productId || '', data.productName || '']);
  
  return jsonResponse({ success: true, action: 'trackProductView', timestamp: timestamp });
}

// ---- Leer accesos ----
function getAccesses() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_ACCESOS);
  
  if (!sheet || sheet.getLastRow() <= 1) {
    return jsonResponse({ success: true, data: [] });
  }
  
  const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3);
  const values = dataRange.getValues();
  
  const records = values.map(function(row) {
    return {
      timestamp: row[0] instanceof Date ? row[0].toISOString() : row[0],
      clientId: String(row[1]),
      clientName: String(row[2])
    };
  });
  
  return jsonResponse({ success: true, data: records });
}

// ---- Leer vistas de productos ----
function getProductViews() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_VISTAS);
  
  if (!sheet || sheet.getLastRow() <= 1) {
    return jsonResponse({ success: true, data: [] });
  }
  
  const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4);
  const values = dataRange.getValues();
  
  const records = values.map(function(row) {
    return {
      timestamp: row[0] instanceof Date ? row[0].toISOString() : row[0],
      clientId: String(row[1]),
      productId: String(row[2]),
      productName: String(row[3])
    };
  });
  
  return jsonResponse({ success: true, data: records });
}

// ---- Utilidad: respuesta JSON con CORS ----
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// AUTOMATIZACIÓN DE CORREO DE SEGUIMIENTO
// ==========================================

function sendDailyFollowUpEmail() {
  const EMAIL_TO = 'mauricio.izquierdo@hotmail.com';
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  // 1. Obtener accesos y vistas de las últimas 24h
  const accesses = JSON.parse(getAccesses().getContent()).data;
  const views = JSON.parse(getProductViews().getContent()).data;
  
  const recentAccesses = accesses.filter(a => new Date(a.timestamp) >= cutoff);
  const recentViews = views.filter(v => new Date(v.timestamp) >= cutoff);
  
  // 2. Calcular estadísticas por cliente
  const clientStats = {};
  
  recentAccesses.forEach(a => {
    if (!clientStats[a.clientId]) {
      clientStats[a.clientId] = { id: a.clientId, name: a.clientName, accesses: 0, views: 0, products: {} };
    }
    clientStats[a.clientId].accesses++;
    clientStats[a.clientId].name = a.clientName; // Actualizar nombre
  });
  
  recentViews.forEach(v => {
    if (!clientStats[v.clientId]) {
      clientStats[v.clientId] = { id: v.clientId, name: 'Cliente ' + v.clientId, accesses: 0, views: 0, products: {} };
    }
    clientStats[v.clientId].views++;
    if (!clientStats[v.clientId].products[v.productId]) {
      clientStats[v.clientId].products[v.productId] = 0;
    }
    clientStats[v.clientId].products[v.productId]++;
  });
  
  // 3. Filtrar clientes interesados (>= 3 accesos o >= 5 vistas de productos)
  const interestedClients = Object.values(clientStats).filter(c => c.accesses >= 3 || Object.keys(c.products).length >= 5);
  
  let emailHtml = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">`;
  emailHtml += `<h2 style="color: #e94560;">\uD83D\uDCCB Seguimiento del d\u00EDa</h2>`;
  
  // Obtener datos de hoja de clientes para WhatsApp
  const clientsData = getClientsData();
  
  // Obtener el producto top 1 de todos para usarlo como respaldo/promocion generica
  const allProducts = {};
  recentViews.forEach(v => {
    if (!allProducts[v.productId]) allProducts[v.productId] = 0;
    allProducts[v.productId]++;
  });
  
  let topProductId = null;
  let maxViews = 0;
  for (const [pId, pViews] of Object.entries(allProducts)) {
    if (pViews > maxViews) {
      maxViews = pViews;
      topProductId = pId;
    }
  }
  
  const topProductObj = topProductId ? getProductDetails(topProductId) : null;
  
  // GRUPO 1: Clientes interesados
  if (interestedClients.length > 0) {
    emailHtml += `<h3 style="color: #0f3460; margin-top: 30px; border-bottom: 2px solid #0f3460; padding-bottom: 5px;">1. Clientes Interesados</h3>`;
    emailHtml += `<p>Hoy tienes <strong>${interestedClients.length}</strong> clientes muy interesados según su actividad de ayer:</p>`;
    
    interestedClients.forEach(c => {
      // Encontrar el producto más visto
      let cTopProductId = null;
      let cMaxViews = 0;
      for (const [pId, pViews] of Object.entries(c.products)) {
        if (pViews > cMaxViews) {
          cMaxViews = pViews;
          cTopProductId = pId;
        }
      }
      
      const clientRecord = clientsData[c.id];
      const phone = clientRecord ? clientRecord.phone : '';
      let actionHtml = '';
      let productInfo = 'Varios productos visitados.';
      
      if (cTopProductId) {
        const prod = getProductDetails(cTopProductId);
        if (prod) {
          productInfo = `Producto más visto: <strong>${prod.name}</strong> (Ref: ${prod.reference})`;
          const msg = generateWhatsAppMessage(c.name, prod);
          if (phone) {
            actionHtml = `<a href="https://wa.me/${phone}?text=${msg}" style="display: inline-block; background: #25D366; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">\uD83D\uDCF2 Enviar WhatsApp</a>`;
          } else {
            actionHtml = `<p style="color: #999; font-size: 12px;">(No hay tel\u00E9fono registrado para el ID ${c.id})</p>`;
          }
        }
      }
      
      emailHtml += `
        <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #0f3460;">
          <h3 style="margin-top: 0; margin-bottom: 5px;">\uD83D\uDC64 ${c.name} (ID: ${c.id})</h3>
          <p style="margin: 5px 0; color: #555;">Accesos: ${c.accesses} | Vistas: ${c.views}</p>
          <p style="margin: 5px 0;">${productInfo}</p>
          ${actionHtml}
        </div>
      `;
    });
  } else {
    emailHtml += `<h3 style="color: #0f3460; margin-top: 30px; border-bottom: 2px solid #0f3460; padding-bottom: 5px;">1. Clientes Interesados</h3>`;
    emailHtml += `<p>No hubo clientes con alertas altas en las últimas 24 horas.</p>`;
  }
  
  // GRUPO 2: Clientes sin actividad (Promoción)
  let inactiveCount = 0;
  let inactiveClientsHtml = '';
  
  if (topProductObj) {
    for (const [id, client] of Object.entries(clientsData)) {
      if (!clientStats[id]) { // Si no tuvo actividad (no está en accesses ni views de ayer)
        inactiveCount++;
        const msg = generateGenericWhatsAppMessage(client.name, topProductObj);
        let actionHtml = '';
        if (client.phone) {
          actionHtml = `<a href="https://wa.me/${client.phone}?text=${msg}" style="display: inline-block; background: #00a8cc; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">\uD83D\uDCF2 Enviar Promo a ${client.name}</a>`;
        } else {
          actionHtml = `<p style="color: #999; font-size: 12px;">(No hay tel\u00E9fono registrado para el ID ${id})</p>`;
        }
        
        inactiveClientsHtml += `
          <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #00a8cc;">
            <h3 style="margin-top: 0; margin-bottom: 5px;">\uD83D\uDC64 ${client.name} (ID: ${id})</h3>
            <p style="margin: 5px 0;">No tuvo actividad ayer. Producto recomendado: <strong>${topProductObj.name}</strong></p>
            ${actionHtml}
          </div>
        `;
      }
    }
  }
  
  if (inactiveCount > 0) {
    emailHtml += `<h3 style="color: #00a8cc; margin-top: 40px; border-bottom: 2px solid #00a8cc; padding-bottom: 5px;">2. Clientes Sin Actividad (Promoción Recomendada)</h3>`;
    emailHtml += `<p>Se encontraron <strong>${inactiveCount}</strong> clientes autorizados sin actividad. Sugiéreles el Producto del Día:</p>`;
    emailHtml += inactiveClientsHtml;
  }
  
  emailHtml += `</div>`;
  
  // Enviar correo
  MailApp.sendEmail({
    to: EMAIL_TO,
    subject: `\uD83D\uDCCB Seguimiento del d\u00EDa - ${interestedClients.length} interesados, ${inactiveCount} inactivos`,
    htmlBody: emailHtml
  });
}

function getClientsData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = ss.getSheets();
  const clientSheet = sheets.find(s => s.getSheetId() === 1788392842);
  if (!clientSheet) return {};
  
  const data = clientSheet.getDataRange().getValues();
  if (data.length === 0) return {};
  
  const headers = data[0];
  const idIdx = headers.indexOf('Identificacion');
  const phoneIdx = headers.indexOf('Telefono WhatsApp');
  let nameIdx = headers.indexOf('Nombre');
  if (nameIdx === -1) nameIdx = headers.indexOf('Nombre del Cliente');
  
  const clients = {};
  if (idIdx === -1) return clients;
  
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][idIdx]).trim();
    if (id) {
      let phone = phoneIdx !== -1 ? String(data[i][phoneIdx] || '').trim() : '';
      if (phone && !phone.startsWith('57')) phone = '57' + phone; // Asumir Colombia
      let name = nameIdx !== -1 ? String(data[i][nameIdx] || '').trim() : 'Cliente ' + id;
      clients[id] = {
        phone: phone.replace(/\D/g, ''), // Remover caracteres no numéricos
        name: name
      };
    }
  }
  return clients;
}

function getProductDetails(productId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const productSheet = ss.getSheets().find(s => s.getSheetId() === 0);
  if (!productSheet) return null;
  
  const data = productSheet.getDataRange().getValues();
  if (data.length === 0) return null;
  
  const headers = data[0];
  const refIdx = headers.indexOf('Referencia');
  let nameIdx = headers.indexOf('Articulo');
  if (nameIdx === -1) nameIdx = headers.indexOf('Nombre');
  let priceIdx = headers.indexOf('Precio Detal');
  if (priceIdx === -1) priceIdx = headers.indexOf('Precio de venta');
  
  if (refIdx === -1) return null;
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][refIdx]).trim() === productId) {
      return {
        reference: data[i][refIdx],
        name: nameIdx !== -1 ? data[i][nameIdx] : 'Producto',
        price: priceIdx !== -1 ? data[i][priceIdx] : 0
      };
    }
  }
  return null;
}

function generateWhatsAppMessage(clientName, productObj) {
  // Formatear precio
  const price = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(productObj.price);
  
  let msg = `Hola ${clientName}, notamos que te interes\u00F3 este producto:\n\n`;
  msg += `\uD83D\uDD25 *\u00A1PRODUCTO RECOMENDADO!*\ \uD83D\uDD25\n`;
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;
  msg += `\u2728 *${productObj.name}*\n`;
  msg += `\uD83C\uDFF7\uFE0F Ref: ${productObj.reference}\n`;
  msg += `\uD83D\uDCB0 Precio: ${price}\n\n`;
  msg += `\uD83D\uDCF8 Toca el link para ver la foto y m\u00E1s detalles:\n`;
  msg += `\uD83D\uDC47 *M\u00EDralo y p\u00EDdelo aqu\u00ED mismo:*\n`;
  msg += `https://diegomim2022.github.io/CatalogoVirtual2026/?producto=${productObj.reference}`;
  
  return encodeURIComponent(msg);
}

function generateGenericWhatsAppMessage(clientName, productObj) {
  // Formatear precio
  const price = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(productObj.price);
  
  let msg = `Hola ${clientName}, tenemos una excelente recomendaci\u00F3n para ti:\n\n`;
  msg += `\uD83D\uDD25 *\u00A1PRODUCTO DEL D\u00CDA!*\ \uD83D\uDD25\n`;
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;
  msg += `\u2728 *${productObj.name}*\n`;
  msg += `\uD83C\uDFF7\uFE0F Ref: ${productObj.reference}\n`;
  msg += `\uD83D\uDCB0 Precio: ${price}\n\n`;
  msg += `\uD83D\uDCF8 Toca el link para ver la foto y m\u00E1s detalles:\n`;
  msg += `\uD83D\uDC47 *M\u00EDralo y p\u00EDdelo aqu\u00ED mismo:*\n`;
  msg += `https://diegomim2022.github.io/CatalogoVirtual2026/?producto=${productObj.reference}`;
  
  return encodeURIComponent(msg);
}
