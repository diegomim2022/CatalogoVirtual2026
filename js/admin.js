// ============================================
// PANEL DE ANALYTICS Y GENERADOR DE PROMOCIONES
// ============================================

import { CONFIG } from './config.js';
import {
  escapeHtml,
  formatDate,
  formatCurrency,
  showToast
} from './utils.js';
import { PRODUCTS } from './state.js';

let analyticsChart = null;

export function renderAnalytics() {
  if (typeof Analytics === 'undefined') return;

  // Configurar URL del Web App si está definida
  if (CONFIG.analyticsWebAppUrl && !Analytics.getWebAppUrl()) {
    Analytics.setWebAppUrl(CONFIG.analyticsWebAppUrl);
  }

  // Intentar sincronizar desde Google Sheets antes de mostrar datos
  if (Analytics.getWebAppUrl()) {
    Analytics.loadFromSheets().then(() => {
      renderAnalyticsData();
    }).catch(() => {
      renderAnalyticsData(); // Si falla, usar datos locales
    });
  } else {
    renderAnalyticsData();
  }
}

export function renderAnalyticsData() {
  // Summary cards
  const summary = Analytics.getSummary();
  document.getElementById('stat-accesses-today').textContent = summary.accessesToday;
  document.getElementById('stat-unique-clients').textContent = summary.uniqueClientsToday;
  document.getElementById('stat-views-today').textContent = summary.viewsToday;
  document.getElementById('stat-total-accesses').textContent = summary.totalAccesses;

  // Alerts
  const accessAlerts = Analytics.getAlerts();
  const sessionAlerts = Analytics.getSessionAlerts();
  const alertsSection = document.getElementById('analytics-alerts-section');
  const alertsContainer = document.getElementById('analytics-alerts');

  if (accessAlerts.length > 0 || sessionAlerts.length > 0) {
    alertsSection.style.display = 'block';
    let alertsHtml = '';

    accessAlerts.forEach(a => {
      alertsHtml += `
        <div class="analytics-alert">
          <div class="analytics-alert-icon">⚠️</div>
          <div class="analytics-alert-content">
            <div class="analytics-alert-title">${escapeHtml(a.clientName)} (${escapeHtml(a.clientId)})</div>
            <div class="analytics-alert-desc">${a.count} accesos en las últimas ${Analytics.ALERT_HOURS}h — Último: ${formatDate(a.lastAccess)}</div>
          </div>
        </div>
      `;
    });

    sessionAlerts.forEach(s => {
      alertsHtml += `
        <div class="analytics-alert session-alert">
          <div class="analytics-alert-icon">🔥</div>
          <div class="analytics-alert-content">
            <div class="analytics-alert-title">Cliente ${escapeHtml(s.clientId)}</div>
            <div class="analytics-alert-desc">${s.productsViewed} productos diferentes vistos en esta sesión (${s.totalViews} vistas totales)</div>
          </div>
        </div>
      `;
    });

    alertsContainer.innerHTML = alertsHtml;
  } else {
    alertsSection.style.display = 'none';
  }

  // Client Ranking
  try {
    const ranking = Analytics.getClientRanking();
    const rankingTable = document.getElementById('analytics-client-ranking');
    const rankingBody = rankingTable.querySelector('tbody');
    const noClients = document.getElementById('analytics-no-clients');

    if (ranking.length > 0) {
      rankingTable.style.display = 'table';
      noClients.style.display = 'none';
      rankingBody.innerHTML = ranking.map((c, i) => {
        const rankClass = i < 3 ? ` top-${i + 1}` : '';
        const lastAccess = c.lastAccess ? formatDate(c.lastAccess) : '—';
        return `
          <tr>
            <td><span class="rank-badge${rankClass}">${i + 1}</span></td>
            <td>
              <span class="client-name">${escapeHtml(c.clientName)}</span>
              <span class="client-id">ID: ${escapeHtml(c.clientId)}</span>
            </td>
            <td><strong>${c.totalAccesses}</strong></td>
            <td>${c.productsViewed}</td>
            <td style="font-size:11px;color:var(--text-secondary);">${lastAccess}</td>
          </tr>
        `;
      }).join('');
    } else {
      rankingTable.style.display = 'none';
      noClients.style.display = 'block';
    }
  } catch (err) {
    console.error('Error rendering Client Ranking:', err);
  }

  // Top Products
  try {
    const topProducts = Analytics.getTopProducts(10);
    const productsTable = document.getElementById('analytics-top-products');
    const productsBody = productsTable.querySelector('tbody');
    const noProducts = document.getElementById('analytics-no-products');

    if (topProducts.length > 0) {
      productsTable.style.display = 'table';
      noProducts.style.display = 'none';
      const maxViews = topProducts[0].totalViews;
      productsBody.innerHTML = topProducts.map((p, i) => {
        const rankClass = i < 3 ? ` top-${i + 1}` : '';
        const barWidth = Math.round((p.totalViews / maxViews) * 60);
        return `
          <tr>
            <td><span class="rank-badge${rankClass}">${i + 1}</span></td>
            <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(p.productName)}</td>
            <td>
              <div class="views-bar">
                <span>${p.totalViews}</span>
                <div class="views-bar-fill" style="width:${barWidth}px"></div>
              </div>
            </td>
            <td>${p.uniqueClients}</td>
            <td>
              <button class="btn btn-sm" style="padding: 4px 8px; font-size: 12px; background: var(--accent); color: white; border-radius: 4px; border: none; cursor: pointer;" onclick="generatePromoMessage('${escapeHtml(p.productId)}')">📢 Promocionar</button>
            </td>
          </tr>
        `;
      }).join('');
    } else {
      productsTable.style.display = 'none';
      noProducts.style.display = 'block';
    }
  } catch (err) {
    console.error('Error rendering Top Products:', err);
  }

  // Daily Chart
  renderDailyChart();
}

export function renderDailyChart() {
  const ctx = document.getElementById('analytics-daily-chart');
  if (!ctx) return;

  const dailyData = Analytics.getDailyAccessStats(30);
  const labels = dailyData.map(d => {
    const date = new Date(d.date + 'T00:00:00');
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  });
  const data = dailyData.map(d => d.count);

  // Destroy existing chart
  if (analyticsChart) {
    analyticsChart.destroy();
    analyticsChart = null;
  }

  if (typeof Chart === 'undefined') return;

  analyticsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Accesos',
        data: data,
        backgroundColor: 'rgba(233, 69, 96, 0.7)',
        borderColor: '#e94560',
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a2e',
          titleFont: { family: 'Inter', size: 12 },
          bodyFont: { family: 'Inter', size: 11 },
          cornerRadius: 8,
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: 'Inter', size: 9 },
            color: '#9ca3af',
            maxRotation: 45,
            autoSkip: true,
            maxTicksLimit: 10
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            font: { family: 'Inter', size: 10 },
            color: '#9ca3af',
            precision: 0
          },
          grid: {
            color: 'rgba(0,0,0,0.04)'
          }
        }
      }
    }
  });
}

export function generatePromoMessage(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) {
    showToast('Producto no encontrado', 'error');
    return;
  }

  const price = formatCurrency(product.retailPrice);
  
  let msg = `🔥 *¡PRODUCTO DEL DÍA!* 🔥\n`;
  msg += `━━━━━━━━━━━━━━\n`;
  msg += `✨ *${product.name}*\n`;
  msg += `🏷️ Ref: ${product.reference}\n`;
  msg += `💰 Precio Especial: ${price}\n\n`;
  msg += `¡Aprovecha antes de que se agote! 🏃‍♂️💨\n`;
  msg += `━━━━━━━━━━━━━━\n`;
  msg += `📸 Toca el link para ver la foto y más detalles:\n`;
  msg += `👇 *Míralo y pídelo aquí mismo:*\n`;
  
  // Create direct link
  const urlObj = new URL(window.location.href);
  urlObj.searchParams.set('producto', product.id);
  msg += urlObj.toString();
  
  document.getElementById('promo-message-text').value = msg;
  const section = document.getElementById('promo-generator-section');
  section.style.display = 'block';
  
  // Scroll to section
  section.scrollIntoView({ behavior: 'smooth' });
}

export function copyPromoMessage() {
  const textarea = document.getElementById('promo-message-text');
  textarea.select();
  document.execCommand('copy');
  showToast('Mensaje copiado al portapapeles');
}

export function sendPromoWhatsApp() {
  const msg = document.getElementById('promo-message-text').value;
  if (!msg) return;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}
