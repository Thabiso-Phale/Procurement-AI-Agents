// ============================================================
// INVENTORY MODULE
// ============================================================

import { getInventoryData, setInventoryData } from '../store.js';
import { checkRecordLimit } from '../features.js';
import { toast } from '../utils.js';
import { showView } from '../router.js';

let _currentInventoryFilter = 'all';

// ── Helpers ───────────────────────────────────────────────
export function stockBadge(item) {
  if (item.qty <= 0)                      return '<span class="badge badge-red">Out of Stock</span>';
  if (item.qty <= item.reorderLevel)      return '<span class="badge badge-yellow">Low Stock</span>';
  if (item.qty <= item.reorderLevel * 2)  return '<span class="badge" style="background:#FEF9C3;color:#713F12">Reorder Soon</span>';
  return '<span class="badge badge-green">In Stock</span>';
}

export function stockBar(item) {
  const max   = item.maxStock || (item.reorderLevel * 4) || 100;
  const pct   = Math.min(100, Math.round((item.qty / max) * 100));
  const color = item.qty <= 0 ? '#EF4444' : item.qty <= item.reorderLevel ? '#F59E0B' : '#16A34A';
  return '<div style="background:#E2E8F0;border-radius:4px;height:6px;width:80px;display:inline-block;vertical-align:middle">'
    + '<div style="background:' + color + ';height:100%;border-radius:4px;width:' + pct + '%"></div></div>'
    + ' <span style="font-size:11px;color:#64748B">' + pct + '%</span>';
}

export function buildAlertBanner() {
  const inventoryData = getInventoryData();
  const low   = inventoryData.filter(i => i.qty <= i.reorderLevel && i.qty > 0);
  const out   = inventoryData.filter(i => i.qty <= 0);
  const el    = document.getElementById('inv-alert-banner');
  if (!el) return;
  if (!low.length && !out.length) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = (out.length ? '<strong style="color:#DC2626">🚨 ' + out.length + ' item(s) out of stock: ' + out.map(i => i.name).join(', ') + '</strong>' : '')
    + (low.length ? (out.length ? '<br>' : '') + '<span style="color:#D97706">⚠ ' + low.length + ' item(s) at reorder level: ' + low.map(i => i.name).join(', ') + '</span>' : '');
}

// ── Table ─────────────────────────────────────────────────
export function renderInventoryTable(data) {
  const inventoryData = getInventoryData();
  let rows = data || inventoryData;
  if (_currentInventoryFilter === 'low')  rows = rows.filter(i => i.qty > 0 && i.qty <= i.reorderLevel);
  if (_currentInventoryFilter === 'out')  rows = rows.filter(i => i.qty <= 0);
  if (_currentInventoryFilter === 'ok')   rows = rows.filter(i => i.qty > i.reorderLevel);
  const tbody = document.getElementById('inventory-tbody');
  if (!tbody) return;
  tbody.innerHTML = rows.map(item =>
    '<tr>'
    + '<td><strong>' + item.name + '</strong>'
    + (item.sku ? '<br><span style="font-size:11px;color:#94A3B8">SKU: ' + item.sku + '</span>' : '')
    + '</td>'
    + '<td>' + item.category + '</td>'
    + '<td>' + item.location + '</td>'
    + '<td><strong>' + item.qty + '</strong> / ' + item.maxStock
    + '<br>' + stockBar(item) + '</td>'
    + '<td>' + item.reorderLevel + '</td>'
    + '<td>' + stockBadge(item) + '</td>'
    + '<td>' + item.supplier + '</td>'
    + '<td>' + (item.lastOrdered ? item.lastOrdered : '—') + '</td>'
    + '<td>'
      + (item.qty <= item.reorderLevel
        ? '<button class="btn btn-primary btn-sm" onclick="reorderItem(\'' + encodeURIComponent(item.name) + '\',\'' + encodeURIComponent(item.supplier) + '\')">📦 Reorder</button> '
        : '')
      + '<button class="btn btn-outline btn-sm" onclick="editInventoryItem(\'' + encodeURIComponent(item.name) + '\')">Edit</button>'
    + '</td></tr>'
  ).join('');
  buildAlertBanner();
  _updateInventoryKPIs();
}

function _updateInventoryKPIs() {
  const inventoryData = getInventoryData();
  const low  = inventoryData.filter(i => i.qty <= i.reorderLevel && i.qty > 0).length;
  const out  = inventoryData.filter(i => i.qty <= 0).length;
  const val  = inventoryData.reduce((s,i) => s + (i.qty * (i.unitCost || 0)), 0);
  const el = (id) => document.getElementById(id);
  if (el('inv-kpi-items'))    el('inv-kpi-items').textContent    = inventoryData.length;
  if (el('inv-kpi-low'))      el('inv-kpi-low').textContent      = low;
  if (el('inv-kpi-out'))      el('inv-kpi-out').textContent      = out;
  if (el('inv-kpi-value'))    el('inv-kpi-value').textContent    = '$' + val.toLocaleString();
}

export function filterInventory(f) { _currentInventoryFilter = f; renderInventoryTable(); }

export function reorderItem(encodedName, encodedSupplier) {
  const name     = decodeURIComponent(encodedName);
  const supplier = decodeURIComponent(encodedSupplier);
  toast('📦 Reorder initiated for ' + name + ' from ' + supplier + '. Check Purchase Orders to confirm.');
}

export function editInventoryItem(encodedName) {
  const name = decodeURIComponent(encodedName);
  const inventoryData = getInventoryData();
  const item = inventoryData.find(i => i.name === name);
  if (!item) return;
  const preEl    = document.getElementById('inv-form-id');
  const nameEl   = document.getElementById('inv-name');
  const skuEl    = document.getElementById('inv-sku');
  const catEl    = document.getElementById('inv-category');
  const locEl    = document.getElementById('inv-location');
  const supEl    = document.getElementById('inv-supplier');
  const qtyEl    = document.getElementById('inv-qty');
  const maxEl    = document.getElementById('inv-max');
  const reEl     = document.getElementById('inv-reorder');
  const costEl   = document.getElementById('inv-unit-cost');
  if (preEl)  preEl.value  = name;
  if (nameEl) nameEl.value = item.name;
  if (skuEl)  skuEl.value  = item.sku || '';
  if (catEl)  catEl.value  = item.category;
  if (locEl)  locEl.value  = item.location;
  if (supEl)  supEl.value  = item.supplier;
  if (qtyEl)  qtyEl.value  = item.qty;
  if (maxEl)  maxEl.value  = item.maxStock;
  if (reEl)   reEl.value   = item.reorderLevel;
  if (costEl) costEl.value = item.unitCost || 0;
  showView('add-inventory');
}

export function saveInventoryItem() {
  const name = (document.getElementById('inv-name') || {value:''}).value.trim();
  if (!name) { toast('Please enter an item name.'); return; }
  const inventoryData = getInventoryData();
  const preId  = (document.getElementById('inv-form-id') || {value:''}).value;
  const idx    = preId ? inventoryData.findIndex(i => i.name === preId) : -1;
  const item   = {
    name,
    sku:          (document.getElementById('inv-sku')      || {value:''}).value,
    category:     (document.getElementById('inv-category') || {value:'General'}).value,
    location:     (document.getElementById('inv-location') || {value:''}).value,
    supplier:     (document.getElementById('inv-supplier') || {value:''}).value,
    qty:          parseInt((document.getElementById('inv-qty')      || {value:'0'}).value) || 0,
    maxStock:     parseInt((document.getElementById('inv-max')      || {value:'100'}).value) || 100,
    reorderLevel: parseInt((document.getElementById('inv-reorder')  || {value:'10'}).value) || 10,
    unitCost:     parseFloat((document.getElementById('inv-unit-cost') || {value:'0'}).value) || 0,
    lastOrdered:  new Date().toISOString().split('T')[0]
  };
  if (idx >= 0) {
    inventoryData[idx] = item;
  } else {
    if (!checkRecordLimit('inventory', inventoryData.length)) return;
    inventoryData.push(item);
  }
  setInventoryData(inventoryData);
  toast('✅ ' + name + ' saved to inventory!');
  showView('inventory');
}
