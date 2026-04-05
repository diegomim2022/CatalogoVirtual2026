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
