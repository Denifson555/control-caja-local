/**
 * Control de Caja Diaria — app.js
 * Lógica financiera corregida y exportación a Excel
 */
'use strict';

/* ═══════════════════════════════════════════════
   CONSTANTS & STORAGE KEY
═══════════════════════════════════════════════ */
const STORAGE_KEY = 'controlCaja_v1';

/* ═══════════════════════════════════════════════
   DOM REFERENCES
═══════════════════════════════════════════════ */
const els = {
  // Ingresos inputs
  ventasEfectivo:   document.getElementById('ventasEfectivo'),
  cajaChica:        document.getElementById('cajaChica'),
  cajaFuerte:       document.getElementById('cajaFuerte'),
  transferencias:   document.getElementById('transferencias'),
  // Egresos inputs
  pagoProveedores:  document.getElementById('pagoProveedores'),
  gastosPersonales: document.getElementById('gastosPersonales'),
  // Notas
  notas:            document.getElementById('notas'),
  // Calculated displays
  totalIngresos:    document.getElementById('totalIngresos'),
  totalEgresos:     document.getElementById('totalEgresos'),
  balanceNeto:      document.getElementById('balanceNeto'),
  balanceCard:      document.getElementById('balanceCard'),
  balanceHint:      document.getElementById('balanceHint'),
  // Security & Save
  verifiedToggle:   document.getElementById('verifiedToggle'),
  saveBtn:          document.getElementById('saveBtn'),
  clearFormBtn:     document.getElementById('clearFormBtn'),
  // Header / badge
  headerDate:       document.getElementById('headerDate'),
  todayDate:        document.getElementById('todayDate'),
  // History panel
  sumIngresos:      document.getElementById('sumIngresos'),
  sumEgresos:       document.getElementById('sumEgresos'),
  sumBalance:       document.getElementById('sumBalance'),
  historyEmpty:     document.getElementById('historyEmpty'),
  tableWrapper:     document.getElementById('tableWrapper'),
  historyBody:      document.getElementById('historyBody'),
  exportCsvBtn:     document.getElementById('exportCsvBtn'),
  exportExcelBtn:   document.getElementById('exportExcelBtn'), // NUEVO BOTÓN
  // Toast
  toast:            document.getElementById('toast'),
  // Modal
  deleteModal:      document.getElementById('deleteModal'),
  cancelDeleteBtn:  document.getElementById('cancelDeleteBtn'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
};

/* ═══════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════ */
let records = [];
let pendingDeleteId = null;
let toastTimer = null;

/* ═══════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════ */
const numVal = (el) => parseFloat(el.value) || 0;
const formatCurrency = (n) =>
  '$ ' + n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (isoStr) => {
  const d = new Date(isoStr);
  return d.toLocaleDateString('es-CO', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
};
const formatDateShort = (isoStr) => {
  const d = new Date(isoStr);
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
};
const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ═══════════════════════════════════════════════
   DATE DISPLAY
═══════════════════════════════════════════════ */
function updateDateDisplay() {
  const now = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const longDate = now.toLocaleDateString('es-CO', opts);
  const shortDate = now.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  els.headerDate.textContent = longDate.charAt(0).toUpperCase() + longDate.slice(1);
  els.todayDate.textContent = shortDate;
}

/* ═══════════════════════════════════════════════
   REAL-TIME CALCULATIONS (Lógica Corregida)
═══════════════════════════════════════════════ */
function recalculate() {
  const vEfectivo = numVal(els.ventasEfectivo);
  const cChica    = numVal(els.cajaChica);
  const cFuerte   = numVal(els.cajaFuerte);
  const transf    = numVal(els.transferencias);
  
  const pProv     = numVal(els.pagoProveedores);
  const gPerson   = numVal(els.gastosPersonales);

  const ingresos  = vEfectivo + cChica + cFuerte + transf;
  const egresos   = pProv + gPerson;
  
  // PARCHE 1: Cada indicador tiene su propia fórmula independiente
  const ventasDia    = vEfectivo + transf; // Solo operativos
  const guardadoNeto = cFuerte - egresos;  // Fondo MENOS pagos
  const balance      = ingresos - egresos;

  const hasData = ingresos > 0 || egresos > 0;

  // Update display
  els.totalIngresos.textContent = formatCurrency(ingresos);
  els.totalEgresos.textContent  = formatCurrency(egresos);
  els.balanceNeto.textContent   = formatCurrency(balance);

  // Balance card state
  els.balanceCard.classList.remove('positive', 'negative');
  if (hasData) {
    els.balanceCard.classList.add(balance >= 0 ? 'positive' : 'negative');
    // Pista visual que refleja las matemáticas reales
    els.balanceHint.textContent = `✅ Ventas del día: ${formatCurrency(ventasDia)} · Guardado neto: ${formatCurrency(guardadoNeto)}`;
  } else {
    els.balanceHint.textContent = 'Ingresa los montos para calcular';
  }
}

/* ═══════════════════════════════════════════════
   DOUBLE SECURITY — SAVE BUTTON
═══════════════════════════════════════════════ */
function handleVerifiedToggle() {
  els.saveBtn.disabled = !els.verifiedToggle.checked;
}

/* ═══════════════════════════════════════════════
   SAVE RECORD (Variables protegidas)
═══════════════════════════════════════════════ */
function saveRecord(e) {
  e.preventDefault();
  
  const vEfectivo = numVal(els.ventasEfectivo);
  const cChica    = numVal(els.cajaChica);
  const cFuerte   = numVal(els.cajaFuerte);
  const transf    = numVal(els.transferencias);
  const pProv     = numVal(els.pagoProveedores);
  const gPerson   = numVal(els.gastosPersonales);

  const ingresos = vEfectivo + cChica + cFuerte + transf;
  const egresos  = pProv + gPerson;
  
  // PARCHE 2: Cálculos anexos sin romper las variables antiguas
  const ventasDia    = vEfectivo + transf;
  const guardadoNeto = cFuerte - egresos;

  const record = {
    id:               generateId(),
    createdAt:        new Date().toISOString(),
    ventasEfectivo:   vEfectivo,
    cajaChica:        cChica,
    cajaFuerte:       cFuerte,
    transferencias:   transf,
    pagoProveedores:  pProv,
    gastosPersonales: gPerson,
    totalIngresos:    ingresos,
    totalEgresos:     egresos,
    balanceNeto:      ingresos - egresos,
    ventasDia:        ventasDia,      // Nuevo dato
    guardadoNeto:     guardadoNeto,   // Nuevo dato
    notas:            els.notas.value.trim(),
  };

  records.unshift(record);
  persistData();
  renderHistory();
  resetForm();
  showToast('✅ Cierre guardado correctamente', 'success');
}

/* ═══════════════════════════════════════════════
   FORM RESET
═══════════════════════════════════════════════ */
function resetForm() {
  els.ventasEfectivo.value   = '';
  els.cajaChica.value        = '';
  els.cajaFuerte.value       = '';
  els.transferencias.value   = '';
  els.pagoProveedores.value  = '';
  els.gastosPersonales.value = '';
  els.notas.value            = '';
  els.verifiedToggle.checked = false;
  els.saveBtn.disabled       = true;
  recalculate();
}

/* ═══════════════════════════════════════════════
   PERSIST TO LOCALSTORAGE
═══════════════════════════════════════════════ */
function persistData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    records = raw ? JSON.parse(raw) : [];
  } catch {
    records = [];
  }
}

/* ═══════════════════════════════════════════════
   RENDER HISTORY
═══════════════════════════════════════════════ */
function renderHistory() {
  // Summary totals
  const totI = records.reduce((s, r) => s + r.totalIngresos, 0);
  const totE = records.reduce((s, r) => s + r.totalEgresos, 0);
  const totB = totI - totE;
  
  els.sumIngresos.textContent = formatCurrency(totI);
  els.sumEgresos.textContent  = formatCurrency(totE);
  els.sumBalance.textContent  = formatCurrency(totB);
  
  // Color balance summary
  els.sumBalance.style.color = totB >= 0 ? 'var(--income-light)' : 'var(--expense-light)';
  
  // Table visibility
  if (records.length === 0) {
    els.historyEmpty.hidden  = false;
    els.tableWrapper.hidden  = true;
    return;
  }
  
  els.historyEmpty.hidden = true;
  els.tableWrapper.hidden = false;
  
  // Build rows
  els.historyBody.innerHTML = '';
  records.forEach((r, idx) => {
    const tr = document.createElement('tr');
    tr.style.animationDelay = `${idx * 30}ms`;
    const balClass = r.balanceNeto >= 0 ? 'positive' : 'negative';
    tr.innerHTML = `
      <td class="td-date">${formatDate(r.createdAt)}</td>
      <td class="td-income">${formatCurrency(r.totalIngresos)}</td>
      <td class="td-expense">${formatCurrency(r.totalEgresos)}</td>
      <td class="td-balance ${balClass}">${formatCurrency(r.balanceNeto)}</td>
      <td class="td-notes" title="${escapeHtml(r.notas)}">${escapeHtml(r.notas) || '<em style="opacity:.4">—</em>'}</td>
      <td class="td-actions">
        <button class="btn-delete" data-id="${r.id}" title="Eliminar registro" aria-label="Eliminar registro del ${formatDateShort(r.createdAt)}">🗑️</button>
      </td>
    `;
    els.historyBody.appendChild(tr);
  });
}

/* ═══════════════════════════════════════════════
   DELETE RECORD
═══════════════════════════════════════════════ */
function requestDelete(id) {
  pendingDeleteId = id;
  els.deleteModal.hidden = false;
}

function cancelDelete() {
  pendingDeleteId = null;
  els.deleteModal.hidden = true;
}

function confirmDelete() {
  if (!pendingDeleteId) return;
  records = records.filter(r => r.id !== pendingDeleteId);
  pendingDeleteId = null;
  els.deleteModal.hidden = true;
  persistData();
  renderHistory();
  showToast('🗑️ Registro eliminado', 'error');
}

/* ═══════════════════════════════════════════════
   CSV EXPORT (Viejo) & EXCEL EXPORT (Nuevo)
═══════════════════════════════════════════════ */
function exportCSV() {
  if (records.length === 0) {
    showToast('⚠️ No hay registros para exportar', 'info');
    return;
  }
  const headers = [
    'Fecha', 'Ventas Efectivo', 'Caja Chica', 'Caja Fuerte',
    'Transferencias', 'Pago Proveedores', 'Gastos Personales',
    'Total Ingresos', 'Total Egresos', 'Balance Neto', 'Notas'
  ];
  const rows = records.map(r => [
    formatDate(r.createdAt),
    r.ventasEfectivo,
    r.cajaChica,
    r.cajaFuerte,
    r.transferencias,
    r.pagoProveedores,
    r.gastosPersonales,
    r.totalIngresos,
    r.totalEgresos,
    r.balanceNeto,
    `"${(r.notas || '').replace(/"/g, '""')}"`
  ]);
  const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.join(';')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toLocaleDateString('es-CO').replace(/\//g, '-');
  link.href     = url;
  link.download = `control-caja-completo-${date}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('📥 CSV exportado correctamente', 'success');
}

// PARCHE 3: Exportación a Excel con columnas exactas
function exportExcel() {
  if (records.length === 0) {
    showToast('⚠️ No hay registros para exportar', 'info');
    return;
  }
  
  const headers = ['Fecha', 'Caja', 'Guardado', 'Transferencias', 'Proveedores', 'Gastos', 'Ventas', 'Notas'];
  
  const rows = records.map(r => {
    // Si es un registro viejo que no tiene ventasDia guardado, lo calcula al vuelo
    const ventasDia = r.ventasDia !== undefined ? r.ventasDia : (r.ventasEfectivo + r.transferencias);
    return [
      formatDate(r.createdAt),
      r.ventasEfectivo,
      r.cajaFuerte,
      r.transferencias,
      r.pagoProveedores,
      r.gastosPersonales,
      ventasDia,
      `"${(r.notas || '').replace(/"/g, '""')}"`
    ];
  });

  const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.join(';')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toLocaleDateString('es-CO').replace(/\//g, '-');
  link.href     = url;
  link.download = `Cierre_Historial_${date}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('📊 Excel exportado correctamente', 'success');
}

/* ═══════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════ */
function showToast(message, type = 'info') {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.className   = `toast ${type} show`;
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('show');
  }, 3200);
}

/* ═══════════════════════════════════════════════
   ESCAPE HTML
═══════════════════════════════════════════════ */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ═══════════════════════════════════════════════
   EVENT LISTENERS
═══════════════════════════════════════════════ */
function bindEvents() {
  const numInputs = document.querySelectorAll('.form-input[type="number"]');
  numInputs.forEach(inp => inp.addEventListener('input', recalculate));
  
  els.verifiedToggle.addEventListener('change', handleVerifiedToggle);
  document.getElementById('cashForm').addEventListener('submit', saveRecord);
  
  els.clearFormBtn.addEventListener('click', () => {
    resetForm();
    showToast('🗑️ Formulario limpiado', 'info');
  });
  
  els.exportCsvBtn?.addEventListener('click', exportCSV);
  
  // Enlace del nuevo botón de Excel
  els.exportExcelBtn?.addEventListener('click', exportExcel);
  
  els.historyBody.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-delete');
    if (btn) requestDelete(btn.dataset.id);
  });
  
  els.cancelDeleteBtn.addEventListener('click',  cancelDelete);
  els.confirmDeleteBtn.addEventListener('click', confirmDelete);
  els.deleteModal.addEventListener('click', (e) => {
    if (e.target === els.deleteModal) cancelDelete();
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.deleteModal.hidden) cancelDelete();
  });
}

/* ═══════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════ */
function init() {
  updateDateDisplay();
  loadData();
  renderHistory();
  recalculate();
  bindEvents();
  setInterval(updateDateDisplay, 60_000);
}

document.addEventListener('DOMContentLoaded', init);
