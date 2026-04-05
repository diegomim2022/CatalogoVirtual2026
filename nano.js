// =========================================
// MÓDULO NANOCARBON — integrado en AppCatalago
// Solo visible para clientes tipo "Mayorista"
// =========================================

const NANO = (() => {

  // ---- Config ----
  const SHEET_ID = '1Mkg9Ds9zVnTJ4VP2wtYswXBJt96Ec8L4cSx6xMOEg9o';
  const WA_PHONE = '573158512091';
  const STORAGE_KEY = 'nanocarbon_order';

  // ---- Estado interno ----
  let db = [];           // [{ tipo, marcas: [{ nombre, modelos: [] }] }]
  let dbLoaded = false;
  let dbLoading = false;

  // Estado del formulario
  let formState = {
    tipo: '',
    marca: '',
    modelo: '',
    material: 'Clear',
    cantidad: 1,
    isCustom: false,
    customMarca: '',
    customModelo: ''
  };

  // Vista actual dentro del módulo: 'home' | 'order' | 'cart'
  let currentView = 'home';

  // ---- CSV parser ----
  function parseCSVRow(str) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  // ---- Fetch base de datos de dispositivos ----
  async function fetchDB() {
    if (dbLoaded) return;
    if (dbLoading) return;
    dbLoading = true;

    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const csvText = await res.text();
      const lineas = csvText.split('\n');
      const dbMap = {};

      lineas.forEach((linea, index) => {
        if (index === 0 && linea.toLowerCase().includes('tipo')) return;
        const row = parseCSVRow(linea);
        const tipo = row[0]?.trim();
        const marca = row[1]?.trim();
        const modelo = row[2]?.trim();
        if (!tipo || !marca || !modelo) return;
        if (!dbMap[tipo]) dbMap[tipo] = {};
        if (!dbMap[tipo][marca]) dbMap[tipo][marca] = [];
        if (!dbMap[tipo][marca].includes(modelo)) {
          dbMap[tipo][marca].push(modelo);
        }
      });

      db = Object.keys(dbMap).map(tipo => ({
        tipo,
        marcas: Object.keys(dbMap[tipo]).map(marca => ({
          nombre: marca,
          modelos: dbMap[tipo][marca]
        }))
      }));

      dbLoaded = true;
    } catch (err) {
      console.error('[Nanocarbon] Error cargando DB:', err);
      db = [];
    } finally {
      dbLoading = false;
    }
  }

  // ---- Carrito (localStorage) ----
  function getCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }

  function addToCart(item) {
    const cart = getCart();
    cart.push(item);
    saveCart(cart);
  }

  function removeFromCart(id) {
    const cart = getCart().filter(i => i.id !== id);
    saveCart(cart);
  }

  function updateCartItem(id, campo, valor) {
    const cart = getCart().map(i => i.id === id ? { ...i, [campo]: valor } : i);
    saveCart(cart);
  }

  function clearCart() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ---- Helpers ----
  function formatModelo(m) {
    return m.replace(/\.[a-zA-Z0-9]+$/, '');
  }

  function escStr(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---- Render principal (despacha según vista) ----
  function render() {
    const container = document.getElementById('nano-view-container');
    if (!container) return;

    if (currentView === 'home') renderHome(container);
    else if (currentView === 'order') renderOrder(container);
    else if (currentView === 'cart') renderCart(container);
  }

  // ---- Vista: Home ----
  function renderHome(container) {
    const cart = getCart();
    const hasActiveOrder = cart.length > 0;

    container.innerHTML = `
      <div class="nano-home">
        <div class="nano-logo-wrap">
          <img src="logo-nanocarbon.png" alt="Nanocarbon Display" class="nano-logo">
        </div>
        <h1 class="nano-title">Nanocarbon Display<span class="nano-reg">®</span></h1>
        <h2 class="nano-subtitle">Protección premium para pantallas digitales</h2>
        <div class="nano-details">
          <span>Celular · Tablet · Automotriz</span>
          <span>Corte láser de precisión</span>
          <span>🇨🇴 Colombia | B2B</span>
        </div>
        <div class="nano-actions">
          <button class="btn btn-primary" id="nano-btn-nuevo" onclick="NANO.goOrder(true)">
            ✨ Nuevo Pedido
          </button>
          ${hasActiveOrder ? `
          <button class="btn btn-secondary fade-in" id="nano-btn-continuar" onclick="NANO.goCart()">
            🛒 Continuar Pedido (${cart.length} ítem${cart.length !== 1 ? 's' : ''})
          </button>` : ''}
        </div>
      </div>
    `;
  }

  // ---- Vista: Order ----
  async function renderOrder(container) {
    container.innerHTML = `
      <div class="nano-order-container">
        <div class="nano-header">
          <button class="nano-back-btn" onclick="NANO.goHome()">← Volver</button>
          <h2>Configurar Pedido</h2>
        </div>
        <div id="nano-order-loading" class="nano-loading">Cargando catálogo de dispositivos…</div>
        <div id="nano-order-form" style="display:none;"></div>
      </div>
    `;

    if (!dbLoaded) {
      await fetchDB();
    }

    const loadingEl = document.getElementById('nano-order-loading');
    const formEl = document.getElementById('nano-order-form');
    if (!loadingEl || !formEl) return;

    loadingEl.style.display = 'none';
    formEl.style.display = 'block';
    renderOrderForm(formEl);
  }

  function renderOrderForm(formEl) {
    const { tipo, marca, modelo, material, cantidad, isCustom, customMarca, customModelo } = formState;

    const currentCat = db.find(c => c.tipo === tipo);
    const currentMarca = currentCat?.marcas.find(m => m.nombre === marca);
    const marcasDisponibles = currentCat ? currentCat.marcas : [];
    const modelosDisponibles = currentMarca ? currentMarca.modelos : [];

    formEl.innerHTML = `
      <div id="nano-form-error" class="nano-error" style="display:none;"></div>

      <div class="nano-form-group">
        <label>Tipo de Dispositivo</label>
        <select class="nano-select" id="nano-sel-tipo" onchange="NANO._onTipoChange(this.value)">
          <option value="">-- Seleccionar --</option>
          ${db.map(c => `<option value="${escStr(c.tipo)}" ${c.tipo === tipo ? 'selected' : ''}>${escStr(c.tipo)}</option>`).join('')}
          ${db.length === 0 ? `
            <option value="Celular" ${tipo === 'Celular' ? 'selected' : ''}>Celular</option>
            <option value="Tablet" ${tipo === 'Tablet' ? 'selected' : ''}>Tablet</option>
            <option value="Otro" ${tipo === 'Otro' ? 'selected' : ''}>Otro</option>
          ` : ''}
        </select>
      </div>

      <div style="text-align:right; margin-bottom:1.2rem;">
        <button type="button" class="nano-link-btn" onclick="NANO._onToggleCustom()">
          ${isCustom ? '← Seleccionar desde la lista' : '¿No encuentras tu modelo? Escríbelo a mano'}
        </button>
      </div>

      ${isCustom ? `
        <div class="nano-form-group">
          <label>Marca (Manual)</label>
          <input type="text" class="nano-input" id="nano-custom-marca" placeholder="Ej. Samsung" value="${escStr(customMarca)}" oninput="NANO._onCustomMarca(this.value)">
        </div>
        <div class="nano-form-group">
          <label>Modelo exacto (Manual)</label>
          <input type="text" class="nano-input" id="nano-custom-modelo" placeholder="Ej. Galaxy A54 5G" value="${escStr(customModelo)}" oninput="NANO._onCustomModelo(this.value)">
        </div>
      ` : `
        <div class="nano-form-group">
          <label>Marca</label>
          <select class="nano-select" id="nano-sel-marca" onchange="NANO._onMarcaChange(this.value)" ${!tipo ? 'disabled' : ''}>
            <option value="">-- Seleccionar --</option>
            ${marcasDisponibles.map(m => `<option value="${escStr(m.nombre)}" ${m.nombre === marca ? 'selected' : ''}>${escStr(m.nombre)}</option>`).join('')}
          </select>
        </div>
        <div class="nano-form-group">
          <label>Modelo exacto</label>
          <select class="nano-select" id="nano-sel-modelo" onchange="NANO._onModeloChange(this.value)" ${!marca ? 'disabled' : ''}>
            <option value="">-- Seleccionar --</option>
            ${modelosDisponibles.map(m => `<option value="${escStr(m)}" ${m === modelo ? 'selected' : ''}>${escStr(formatModelo(m))}</option>`).join('')}
          </select>
        </div>
      `}

      <div class="nano-form-group">
        <label>Tipo de Corte / Material</label>
        <div class="nano-radio-group">
          <label class="nano-radio-label">
            <input type="radio" name="nano-material" value="Clear" ${material === 'Clear' ? 'checked' : ''} onchange="NANO._onMaterial('Clear')">
            Clear (Transparente)
          </label>
          <label class="nano-radio-label">
            <input type="radio" name="nano-material" value="Mate" ${material === 'Mate' ? 'checked' : ''} onchange="NANO._onMaterial('Mate')">
            Mate (Antirreflejo)
          </label>
        </div>
      </div>

      <div class="nano-form-group">
        <label>Cantidad</label>
        <input type="number" class="nano-input" id="nano-input-cantidad" min="1" max="500" value="${cantidad}" onchange="NANO._onCantidad(this.value)">
      </div>

      <div class="nano-form-actions">
        <button class="btn btn-secondary" onclick="NANO.goHome()">Cancelar</button>
        <button class="btn btn-primary" onclick="NANO._onAgregar()">Agregar al Pedido →</button>
      </div>
    `;
  }

  // ---- Vista: Cart ----
  function renderCart(container) {
    const cart = getCart();
    const totalUnidades = cart.reduce((acc, i) => acc + i.cantidad, 0);

    if (cart.length === 0) {
      container.innerHTML = `
        <div class="nano-order-container">
          <div class="nano-header">
            <button class="nano-back-btn" onclick="NANO.goHome()">← Inicio</button>
            <h2>Resumen del Pedido</h2>
          </div>
          <div class="nano-empty-state">
            <div style="font-size:48px;margin-bottom:12px;">🛒</div>
            <h3>Tu pedido está vacío</h3>
            <p>No tienes productos agregados aún.</p>
            <button class="btn btn-primary" style="margin-top:1.5rem;max-width:260px;" onclick="NANO.goOrder(false)">
              Ir a agregar productos
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="nano-order-container">
        <div class="nano-header">
          <button class="nano-back-btn" onclick="NANO.goHome()">← Inicio</button>
          <h2>Resumen del Pedido</h2>
        </div>

        <div class="nano-item-list" id="nano-item-list">
          ${cart.map(item => `
            <div class="nano-item" id="nano-item-${escStr(item.id)}">
              <div class="nano-item-details">
                <span class="nano-item-name">${escStr(item.marca)} ${escStr(item.modelo)}</span>
                <span class="nano-item-badge">${escStr(item.tipo)}</span>
              </div>
              <div class="nano-item-controls">
                <div class="nano-control-group">
                  <label class="nano-control-label">Material</label>
                  <select class="nano-control-select" onchange="NANO._editItem('${escStr(item.id)}', 'material', this.value)">
                    <option value="Clear" ${item.material === 'Clear' ? 'selected' : ''}>Clear</option>
                    <option value="Mate" ${item.material === 'Mate' ? 'selected' : ''}>Mate</option>
                  </select>
                </div>
                <div class="nano-control-group">
                  <label class="nano-control-label">Cantidad</label>
                  <input type="number" class="nano-control-input" min="1" max="500" value="${item.cantidad}"
                    onchange="NANO._editItem('${escStr(item.id)}', 'cantidad', parseInt(this.value)||1)">
                </div>
                <button class="nano-delete-btn" onclick="NANO._removeItem('${escStr(item.id)}')">✕</button>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="nano-summary">
          <span>Total unidades requeridas:</span>
          <span class="nano-total-num">${totalUnidades}</span>
        </div>

        <div class="nano-form-actions">
          <button class="btn btn-secondary" onclick="NANO.goOrder(false)">+ Agregar más</button>
          <button class="btn nano-wpp-btn" onclick="NANO._sendWhatsApp()">
            📱 Enviar pedido por WhatsApp
          </button>
        </div>
      </div>
    `;
  }

  // ---- Handlers de formulario ----
  function _onTipoChange(val) {
    formState.tipo = val;
    formState.marca = '';
    formState.modelo = '';
    const formEl = document.getElementById('nano-order-form');
    if (formEl) renderOrderForm(formEl);
  }

  function _onMarcaChange(val) {
    formState.marca = val;
    formState.modelo = '';
    const formEl = document.getElementById('nano-order-form');
    if (formEl) renderOrderForm(formEl);
  }

  function _onModeloChange(val) {
    formState.modelo = val;
  }

  function _onMaterial(val) {
    formState.material = val;
  }

  function _onCantidad(val) {
    formState.cantidad = parseInt(val) || 1;
  }

  function _onToggleCustom() {
    formState.isCustom = !formState.isCustom;
    formState.marca = '';
    formState.modelo = '';
    formState.customMarca = '';
    formState.customModelo = '';
    const formEl = document.getElementById('nano-order-form');
    if (formEl) renderOrderForm(formEl);
  }

  function _onCustomMarca(val) {
    formState.customMarca = val;
  }

  function _onCustomModelo(val) {
    formState.customModelo = val;
  }

  function _showFormError(msg) {
    const el = document.getElementById('nano-form-error');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  }

  function _onAgregar() {
    const finalMarca = formState.isCustom ? formState.customMarca.trim() : formState.marca;
    const finalModelo = formState.isCustom ? formState.customModelo.trim() : formatModelo(formState.modelo);

    if (!formState.tipo || !finalMarca || !finalModelo) {
      _showFormError('Por favor completa todos los campos requeridos.');
      return;
    }

    const nuevoProducto = {
      id: Date.now().toString(),
      tipo: formState.tipo,
      marca: finalMarca,
      modelo: finalModelo,
      cantidad: formState.cantidad,
      material: formState.material
    };

    addToCart(nuevoProducto);

    // Resetear form para el siguiente ítem
    formState = { tipo: '', marca: '', modelo: '', material: 'Clear', cantidad: 1, isCustom: false, customMarca: '', customModelo: '' };

    goCart();
  }

  function _removeItem(id) {
    removeFromCart(id);
    render();
  }

  function _editItem(id, campo, valor) {
    updateCartItem(id, campo, valor);
    // Re-calcular total sin re-render completo
    const cart = getCart();
    const totalUnidades = cart.reduce((acc, i) => acc + i.cantidad, 0);
    const totalEl = document.querySelector('.nano-total-num');
    if (totalEl) totalEl.textContent = totalUnidades;
  }

  function _sendWhatsApp() {
    const cart = getCart();
    if (cart.length === 0) return;

    const userName = (typeof state !== 'undefined' && state.currentUser)
      ? state.currentUser.name
      : 'Cliente';

    let text = `Hola Nanocarbon, soy *${userName}*. Este es mi pedido:\n\n`;
    cart.forEach(item => {
      text += `• ${item.tipo} | *${item.marca} ${item.modelo}* | ${item.cantidad} uds | ${item.material}\n`;
    });
    const total = cart.reduce((a, i) => a + i.cantidad, 0);
    text += `\n📦 Total unidades: *${total}*`;

    const url = `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  // ---- Navegación entre vistas del módulo ----
  function goHome() {
    currentView = 'home';
    render();
  }

  async function goOrder(clearExisting) {
    if (clearExisting) clearCart();
    formState = { tipo: '', marca: '', modelo: '', material: 'Clear', cantidad: 1, isCustom: false, customMarca: '', customModelo: '' };
    currentView = 'order';
    render();
    // La carga de DB ocurre dentro de renderOrder()
  }

  function goCart() {
    currentView = 'cart';
    render();
  }

  // ---- Punto de entrada (llamado desde navigateTo('nano')) ----
  function init() {
    currentView = 'home';
    render();
  }

  // ---- Verificar si el usuario actual es Mayorista ----
  function isMayorista() {
    return typeof state !== 'undefined'
      && state.currentUser
      && state.currentUser.type === 'Mayorista';
  }

  // ---- API pública ----
  return {
    init,
    goHome,
    goOrder,
    goCart,
    isMayorista,
    // handlers expuestos para el HTML inline generado
    _onTipoChange,
    _onMarcaChange,
    _onModeloChange,
    _onMaterial,
    _onCantidad,
    _onToggleCustom,
    _onCustomMarca,
    _onCustomModelo,
    _onAgregar,
    _removeItem,
    _editItem,
    _sendWhatsApp
  };

})();
