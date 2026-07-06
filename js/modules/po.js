// ============================================================
// PURCHASE ORDERS MODULE
// ============================================================

import { getSettings, getPOData, setPOData, getApprovalHistory, setApprovalHistory } from '../store.js';
import { getCurrencySymbol, toast, nextSeqId } from '../utils.js';
import { hasFeature, checkRecordLimit } from '../features.js';
import { showView } from '../router.js';

// ── Module state (not persisted — transient UI) ────────────
let _currentPOFilter = 'all';
let _currentApproveId = '';
let _currentRejectId  = '';
let _lineCount = 1;

// ── Status badge ──────────────────────────────────────────
export function statusBadge(s) {
  const map = { 'Draft':'badge-gray','Pending Approval':'badge-red','Approved':'badge-green','Sent':'badge-blue','Received':'badge-purple','Closed':'badge-gray' };
  return '<span class="badge ' + (map[s] || 'badge-gray') + '">' + s + '</span>';
}

// ── Table rendering ───────────────────────────────────────
export function renderPOTable(data) {
  const poData = getPOData();
  const settings = getSettings();
  const sym = getCurrencySymbol(settings.currency);

  let rows = data || poData;
  if (_currentPOFilter !== 'all') rows = rows.filter(p => p.status === _currentPOFilter);

  // KPI cards
  const kTotal = document.getElementById('po-kpi-total');
  const kPend  = document.getElementById('po-kpi-pending');
  const kApp   = document.getElementById('po-kpi-approved');
  const kVal   = document.getElementById('po-kpi-value');
  if (kTotal) kTotal.textContent = poData.length;
  if (kPend)  kPend.textContent  = poData.filter(p => p.status === 'Pending Approval').length;
  if (kApp)   kApp.textContent   = poData.filter(p => p.status === 'Approved' || p.status === 'Sent' || p.status === 'Received').length;
  if (kVal) {
    const tv = poData.filter(p => ['Draft','Closed'].indexOf(p.status) === -1).reduce((s, p) => s + p.amount, 0);
    kVal.textContent = sym + tv.toLocaleString();
  }

  const tbody = document.getElementById('po-tbody');
  if (!tbody) return;
  tbody.innerHTML = rows.map(p => `
    <tr onclick="viewPO('${p.id}')">
      <td><strong>${p.id}</strong></td>
      <td>${p.supplier}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.desc}</td>
      <td><strong>${p.currency} $${p.amount.toLocaleString()}</strong></td>
      <td>${p.requestedBy}</td>
      <td>${p.date}</td>
      <td>${statusBadge(p.status)}</td>
      <td onclick="event.stopPropagation()">
        ${p.status === 'Pending Approval'
          ? `<button class="btn btn-green btn-sm" onclick="openApprove('${p.id}')">Approve</button> <button class="btn btn-red btn-sm" onclick="openReject('${p.id}')">Reject</button>`
          : `<button class="btn btn-outline btn-sm" onclick="viewPO('${p.id}')">View</button> <button class="btn btn-outline btn-sm" onclick="generatePOPDF('${p.id}')" title="Export PDF with T&amp;Cs">📄</button>`
        }
      </td>
    </tr>`).join('');
}

export function filterPOs(f) { _currentPOFilter = f; renderPOTable(); }

export function searchPOs(q) {
  const poData = getPOData();
  if (!q) { renderPOTable(); return; }
  const lq = q.toLowerCase();
  renderPOTable(poData.filter(p =>
    p.id.toLowerCase().includes(lq) ||
    p.supplier.toLowerCase().includes(lq) ||
    p.desc.toLowerCase().includes(lq)
  ));
}

// ── PO detail view ────────────────────────────────────────
export function viewPO(id) {
  const poData = getPOData();
  const p = poData.find(x => x.id === id);
  if (!p) return;
  const el = document.getElementById('po-detail-content');
  el.innerHTML = `
    <div class="section-hdr">
      <div><h3>${p.id} — Purchase Order</h3></div>
      <div class="btn-row">
        <button class="btn btn-outline no-print" onclick="showView('purchase-orders')">← Back to POs</button>
        <button class="btn btn-outline no-print" onclick="generatePOPDF('${p.id}')" title="Generate 2-page Purchase Order PDF with Standard Terms &amp; Conditions">📄 Export PO (PDF)</button>
        ${p.status === 'Pending Approval' ? `<button class="btn btn-green no-print" onclick="openApprove('${p.id}')">✅ Approve</button><button class="btn btn-red no-print" onclick="openReject('${p.id}')">✕ Reject</button>` : ''}
        ${p.status === 'Draft' ? `<button class="btn btn-primary no-print" onclick="submitPOById('${p.id}')">Submit for Approval →</button>` : ''}
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="po-header">
        <div>
          <div style="font-size:22px;font-weight:800;color:#0D2B5E">${p.id}</div>
          <div style="font-size:13px;color:#64748B;margin-top:4px">${p.desc}</div>
        </div>
        <div style="text-align:right">
          ${statusBadge(p.status)}
          <div style="font-size:24px;font-weight:800;color:#0D2B5E;margin-top:8px">${p.currency} $${p.amount.toLocaleString()}</div>
        </div>
      </div>
      <div class="po-meta">
        <div class="po-meta-item"><span>Supplier</span><strong>${p.supplier}</strong></div>
        <div class="po-meta-item"><span>Requested By</span><strong>${p.requestedBy}</strong></div>
        <div class="po-meta-item"><span>Department</span><strong>${p.dept}</strong></div>
        <div class="po-meta-item"><span>Order Date</span><strong>${p.date}</strong></div>
        <div class="po-meta-item"><span>Delivery Date</span><strong>${p.delivery}</strong></div>
        <div class="po-meta-item"><span>Approver</span><strong>${p.approver}</strong></div>
      </div>
      ${p.notes ? `<div style="background:#F8FAFC;border-radius:8px;padding:12px;font-size:13px;color:#334155"><strong>Notes:</strong> ${p.notes}</div>` : ''}
    </div>
    <div class="card">
      <div class="card-title">Order Items</div>
      <table class="tbl">
        <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
        <tbody>
          ${(p.lineItems && p.lineItems.length ? p.lineItems : [{desc:p.desc,qty:1,price:p.amount,total:p.amount}])
            .map(item => `<tr><td>${item.desc}</td><td>${item.qty}</td><td>$${Number(item.price).toFixed(2)}</td><td><strong>$${Number(item.total).toFixed(2)}</strong></td></tr>`).join('')}
        </tbody>
      </table>
      <hr class="divider">
      <div style="text-align:right;font-size:13px;line-height:2">
        <div style="display:flex;justify-content:flex-end;gap:40px"><span style="color:#64748B">Subtotal:</span><span>$${p.amount.toFixed(2)}</span></div>
        <div style="display:flex;justify-content:flex-end;gap:40px"><span style="color:#64748B">Tax (10%):</span><span>$${(p.amount * 0.1).toFixed(2)}</span></div>
        <hr class="divider" style="margin:6px 0">
        <div style="display:flex;justify-content:flex-end;gap:40px;font-weight:700;font-size:16px;color:#0D2B5E"><span>Total (inc. tax):</span><span>$${(p.amount * 1.1).toFixed(2)}</span></div>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="card-title">Approval History</div>
      <ul class="action-list">
        <li class="action-item"><div class="action-dot info"></div><div class="action-text">Purchase order created by <strong>${p.requestedBy}</strong></div><div class="action-time">${p.date}</div></li>
        ${p.status !== 'Draft' ? `<li class="action-item"><div class="action-dot ${p.status==='Approved'||p.status==='Received'?'info':'warning'}"></div><div class="action-text">Status updated to <strong>${p.status}</strong></div><div class="action-time">${p.date}</div></li>` : ''}
      </ul>
    </div>`;
  showView('po-detail');
}

// ── Approve / Reject ──────────────────────────────────────
export function openApprove(id) {
  _currentApproveId = id;
  const p = getPOData().find(x => x.id === id);
  document.getElementById('modal-title').textContent = 'Approve ' + id;
  document.getElementById('modal-body').textContent = 'Approving: ' + p.desc + ' (' + p.currency + ' $' + p.amount.toLocaleString() + ') from ' + p.supplier + '. The supplier will be notified immediately.';
  document.getElementById('modal-confirm-btn').onclick = confirmApprove;
  document.getElementById('modal-approve').classList.add('open');
}

export function confirmApprove() {
  const poData = getPOData();
  const p = poData.find(x => x.id === _currentApproveId);
  if (p) {
    p.status = 'Approved';
    const history = getApprovalHistory();
    history.push({
      poId: p.id, supplier: p.supplier, dept: p.dept || '',
      amount: p.amount, approver: p.approver,
      date: new Date().toISOString().split('T')[0]
    });
    setApprovalHistory(history);
    setPOData(poData);
  }
  closeModal();
  toast('✅ ' + _currentApproveId + ' approved successfully!');
  renderPOTable();
  const kpiPend = document.getElementById('kpi-pending');
  if (kpiPend) kpiPend.textContent = getPOData().filter(p => p.status === 'Pending Approval').length;
}

export function openReject(id) {
  _currentRejectId = id;
  document.getElementById('modal-reject').classList.add('open');
}

export function confirmReject() {
  const reason = document.getElementById('reject-reason').value.trim();
  if (!reason) { toast('Please enter a reason for rejection'); return; }
  const poData = getPOData();
  const p = poData.find(x => x.id === _currentRejectId);
  if (p) { p.status = 'Closed'; setPOData(poData); }
  closeModal();
  toast('✕ ' + _currentRejectId + ' rejected.');
  renderPOTable();
  const kpiPend = document.getElementById('kpi-pending');
  if (kpiPend) kpiPend.textContent = getPOData().filter(p => p.status === 'Pending Approval').length;
}

export function closeModal() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  const mc = document.getElementById('modal-comment');
  if (mc) mc.value = '';
  const rr = document.getElementById('reject-reason');
  if (rr) rr.value = '';
}

export function submitPOById(id) {
  const poData = getPOData();
  const p = poData.find(x => x.id === id);
  if (p) { p.status = 'Pending Approval'; setPOData(poData); }
  toast('📤 ' + id + ' submitted for approval!');
  showView('purchase-orders');
}

// ── Create PO form ────────────────────────────────────────
export function addLineItem() {
  const tbody = document.getElementById('li-body');
  const idx = _lineCount++;
  const tr = document.createElement('tr');
  tr.innerHTML = `<td><input placeholder="Item description" oninput="calcTotals()"></td>
    <td><input type="number" value="1" min="1" oninput="calcTotals()" style="width:60px"></td>
    <td><input type="number" value="0" min="0" step="0.01" oninput="calcTotals()"></td>
    <td class="li-total" id="lt-${idx}">$0.00</td>
    <td><button class="del-btn" onclick="removeLine(this)">✕</button></td>`;
  tbody.appendChild(tr);
}

export function removeLine(btn) {
  const tr = btn.closest('tr');
  if (document.getElementById('li-body').children.length > 1) { tr.remove(); calcTotals(); }
  else { toast('At least one line item is required'); }
}

// BUG FIX: was `var remaining=25000-14820` — now computes from live settings
export function calcTotals() {
  const settings = getSettings();
  const poData   = getPOData();
  const rows = document.querySelectorAll('#li-body tr');
  let sub = 0;
  rows.forEach(row => {
    const inputs = row.querySelectorAll('input');
    const qty   = parseFloat(inputs[1] ? inputs[1].value : 0) || 0;
    const price = parseFloat(inputs[2] ? inputs[2].value : 0) || 0;
    const total = qty * price;
    sub += total;
    const cell = row.querySelector('.li-total');
    if (cell) cell.textContent = '$' + total.toFixed(2);
  });
  const tax   = sub * 0.1;
  const total = sub + tax;
  const subtotalEl = document.getElementById('subtotal');
  const taxEl      = document.getElementById('tax-amt');
  const totalEl    = document.getElementById('po-total');
  if (subtotalEl) subtotalEl.textContent = '$' + sub.toFixed(2);
  if (taxEl)      taxEl.textContent      = '$' + tax.toFixed(2);
  if (totalEl)    totalEl.textContent    = '$' + total.toFixed(2);

  // Live budget check — computed from real settings
  const budget    = settings.monthlyBudget || 25000;
  const spent     = poData.reduce((s, p) => s + (['Draft','Closed'].indexOf(p.status) === -1 ? p.amount : 0), 0);
  const remaining = budget - spent;
  const bc = document.getElementById('budget-check');
  if (bc) {
    if (total > remaining) {
      bc.style.background = '#FEE2E2'; bc.style.color = '#991B1B';
      bc.textContent = '⚠ This order exceeds your remaining budget of $' + remaining.toFixed(2) + '. Consider splitting or deferring.';
    } else {
      bc.style.background = '#DCFCE7'; bc.style.color = '#166534';
      bc.textContent = '✅ This order fits within your remaining monthly budget ($' + remaining.toLocaleString() + ' available).';
    }
  }
}

export function onSupplierSelect() {
  const v = document.getElementById('po-supplier').value;
  const alertEl = document.getElementById('supplier-alert');
  if (alertEl) alertEl.style.display = (v === 'TechEquip Solutions') ? 'block' : 'none';
  suggestApproverHint();
}

export function validatePO() {
  let ok = true;
  const supplier  = document.getElementById('po-supplier').value;
  const delivery  = document.getElementById('po-delivery').value;
  const errSupEl  = document.getElementById('err-supplier');
  const errDelEl  = document.getElementById('err-delivery');
  if (errSupEl) errSupEl.style.display = supplier ? 'none' : 'block';
  if (errDelEl) errDelEl.style.display = delivery ? 'none' : 'block';
  if (!supplier || !delivery) ok = false;
  const rows = document.querySelectorAll('#li-body tr');
  let hasItem = false;
  rows.forEach(row => {
    const inputs = row.querySelectorAll('input');
    if (inputs[0] && inputs[0].value.trim() && parseFloat(inputs[2] && inputs[2].value) > 0) hasItem = true;
  });
  if (!hasItem) { toast('Please add at least one line item with a description and price'); ok = false; }
  return ok;
}

export function nextPONumber() {
  const poData = getPOData();
  const nums = poData.map(p => parseInt(p.id.split('-')[2]) || 0);
  const max  = nums.length ? Math.max(...nums) : 6;
  return 'PO-2026-' + (max + 1).toString().padStart(3, '0');
}

function buildLineItems() {
  const items = [];
  document.querySelectorAll('#li-body tr').forEach(row => {
    const inputs = row.querySelectorAll('input');
    const desc  = inputs[0] ? inputs[0].value.trim() : '';
    const qty   = parseFloat(inputs[1] ? inputs[1].value : 1) || 1;
    const price = parseFloat(inputs[2] ? inputs[2].value : 0) || 0;
    if (desc || price) items.push({ desc, qty, price, total: qty * price });
  });
  return items;
}

export function submitPO() {
  if (!validatePO()) return;
  if (!checkRecordLimit('po', getPOData().length)) return;
  const id    = nextPONumber();
  const items = buildLineItems();
  const sub   = items.reduce((a, i) => a + i.total, 0);
  const poDesc = items.map(i => i.qty > 1 ? i.qty + 'x ' + i.desc : i.desc).filter(Boolean).join(', ') || 'Order from ' + document.getElementById('po-supplier').value;
  const poData = getPOData();
  poData.push({
    id, supplier: document.getElementById('po-supplier').value, desc: poDesc,
    amount: sub, lineItems: items,
    currency: document.getElementById('po-currency').value,
    requestedBy: getSettings().userName || 'Alex',
    dept: document.getElementById('po-dept').value,
    date: new Date().toISOString().split('T')[0],
    delivery: document.getElementById('po-delivery').value,
    status: 'Pending Approval',
    approver: document.getElementById('po-approver').value,
    notes: document.getElementById('po-notes').value
  });
  setPOData(poData);
  const kpiPend = document.getElementById('kpi-pending');
  if (kpiPend) kpiPend.textContent = getPOData().filter(p => p.status === 'Pending Approval').length;
  toast('📤 ' + id + ' submitted for approval!');
  showView('purchase-orders');
}

export function saveDraft() {
  if (!document.getElementById('po-supplier').value) { toast('Please select a supplier first'); return; }
  if (!checkRecordLimit('po', getPOData().length)) return;
  const id    = nextPONumber();
  const items = buildLineItems();
  const sub   = items.reduce((a, i) => a + i.total, 0);
  const poDesc = items.map(i => i.qty > 1 ? i.qty + 'x ' + i.desc : i.desc).filter(Boolean).join(', ') || 'Draft order';
  const poData = getPOData();
  poData.push({
    id, supplier: document.getElementById('po-supplier').value, desc: poDesc,
    amount: sub, lineItems: items,
    currency: document.getElementById('po-currency').value,
    requestedBy: getSettings().userName || 'Alex',
    dept: document.getElementById('po-dept').value,
    date: new Date().toISOString().split('T')[0],
    delivery: document.getElementById('po-delivery').value,
    status: 'Draft',
    approver: document.getElementById('po-approver').value,
    notes: document.getElementById('po-notes').value
  });
  setPOData(poData);
  toast('💾 Saved as draft ' + id);
  showView('purchase-orders');
}

// ── Agent 4: Smart Approver Routing ──────────────────────
export function suggestApproverHint() {
  const settings  = getSettings();
  const history   = getApprovalHistory();
  const supplier  = document.getElementById('po-supplier').value;
  const subtotalEl = document.getElementById('po-subtotal');
  const amount    = subtotalEl ? parseFloat(subtotalEl.textContent.replace(/[^0-9.]/g, '')) || 0 : 0;
  const hintEl    = document.getElementById('approver-hint');
  if (!hintEl) return;

  const autoLimit = settings.autoApproveLimit || 500;
  const dirLimit  = settings.directorThreshold || 10000;
  const pastApprovals = history.filter(h => h.supplier === supplier);
  const approverCounts = {};
  pastApprovals.forEach(h => { approverCounts[h.approver] = (approverCounts[h.approver] || 0) + 1; });
  const topApprover = Object.keys(approverCounts).sort((a, b) => approverCounts[b] - approverCounts[a])[0];

  let hint = '';
  const approverEl = document.getElementById('po-approver');
  if (amount > 0 && amount < autoLimit) {
    hint = '⚡ <strong>Auto-approve eligible</strong> — under ' + settings.currency + ' ' + autoLimit.toLocaleString() + ' threshold. No approval needed.';
    if (approverEl) approverEl.value = (settings.userName || 'Alex') + ' (You)';
  } else if (amount >= dirLimit) {
    hint = '🏢 <strong>Director approval required</strong> — above ' + settings.currency + ' ' + dirLimit.toLocaleString() + ' threshold.';
    if (approverEl) approverEl.value = 'Founder / Director';
  } else if (topApprover && approverCounts[topApprover] >= 2) {
    hint = '🤖 <strong>Suggested: ' + topApprover + '</strong> — approved ' + approverCounts[topApprover] + ' previous order' + (approverCounts[topApprover] > 1 ? 's' : '') + ' from ' + supplier + '.';
    if (approverEl) {
      for (let i = 0; i < approverEl.options.length; i++) {
        if (approverEl.options[i].value === topApprover) { approverEl.selectedIndex = i; break; }
      }
    }
  } else if (supplier && pastApprovals.length === 0) {
    hint = '💡 <strong>New supplier</strong> — no approval history yet. Routing to primary approver by default.';
    if (approverEl) approverEl.value = settings.primaryApprover || 'Sarah M – Manager';
  }

  if (hint) { hintEl.style.display = 'block'; hintEl.innerHTML = hint; }
  else { hintEl.style.display = 'none'; }
}

// ── Export ────────────────────────────────────────────────
export function exportPOs() {
  const cols = [
    {label:'PO Number',key:'id'}, {label:'Supplier',key:'supplier'},
    {label:'Description',key:'desc'}, {label:'Currency',key:'currency'},
    {label:'Amount',key:'amount'}, {label:'Department',key:'dept'},
    {label:'Requested By',key:'requestedBy'}, {label:'Date Raised',key:'date'},
    {label:'Delivery Date',key:'delivery'}, {label:'Status',key:'status'},
    {label:'Approver',key:'approver'}, {label:'Notes',key:'notes'}
  ];
  const now = new Date().toISOString().split('T')[0];
  exportCSV(getPOData(), cols, 'ProjectBuys_Purchase_Orders_' + now + '.csv');
}

// ── PDF generation (2-page A4 with T&Cs) ─────────────────
export function generatePOPDF(id) {
  const p = getPOData().find(x => x.id === id);
  if (!p) { toast('PO not found.'); return; }
  const settings = getSettings();
  const company   = settings.companyName || 'Your Company';
  const compAddr  = (settings.companyAddress || '').replace(/\n/g, '<br>');
  const compPhone = settings.companyPhone || '';
  const compEmail = settings.companyEmail || '';
  const compWebsite = settings.companyWebsite || '';
  const compReg   = settings.companyRegNo || '';
  const compLogo  = (hasFeature('pdf_export') && settings.companyLogo) ? settings.companyLogo : '';
  const cur       = p.currency || settings.currency || 'USD';
  const sym       = getCurrencySymbol(cur);
  const taxRate   = cur==='GBP'?20:cur==='EUR'?20:cur==='SGD'?9:cur==='AUD'?10:cur==='CAD'?5:10;
  const taxLabel  = cur==='GBP'?'VAT':cur==='EUR'?'VAT':cur==='SGD'?'GST':cur==='AUD'?'GST':cur==='CAD'?'GST/HST':'Tax';
  const govLaw    = cur==='GBP'?'England and Wales':cur==='EUR'?'the Republic of Ireland':cur==='SGD'?'Singapore':cur==='AUD'?'Victoria, Australia':cur==='CAD'?'the Province of Ontario, Canada':'the State of Delaware, USA';
  const items     = p.lineItems && p.lineItems.length ? p.lineItems : [{desc:p.desc,qty:1,price:p.amount,total:p.amount}];
  const subtotal  = items.reduce((s, i) => s + Number(i.total), 0);
  const tax       = Math.round(subtotal * taxRate) / 100;
  const grandTotal = subtotal + tax;
  const itemRows  = items.map(item =>
    '<tr>'
    + '<td style="padding:9px 12px;border-bottom:1px solid #E2E8F0">' + item.desc + '</td>'
    + '<td style="padding:9px 12px;border-bottom:1px solid #E2E8F0;text-align:center">' + item.qty + '</td>'
    + '<td style="padding:9px 12px;border-bottom:1px solid #E2E8F0;text-align:right">' + sym + Number(item.price).toFixed(2) + '</td>'
    + '<td style="padding:9px 12px;border-bottom:1px solid #E2E8F0;text-align:right;font-weight:700">' + sym + Number(item.total).toFixed(2) + '</td>'
    + '</tr>'
  ).join('');

  const isFreePlan = !hasFeature('pdf_export');
  const watermarkCSS = isFreePlan
    ? '.wm{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:52pt;font-weight:900;color:rgba(0,0,0,0.055);white-space:nowrap;pointer-events:none;z-index:9999;letter-spacing:4px}'
    : '';
  const watermarkHTML = isFreePlan ? '<div class="wm">ProjectBuys Free</div>' : '';

  const html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">'
    + '<title>' + p.id + ' — Purchase Order</title>\n<style>\n'
    + '*{box-sizing:border-box;margin:0;padding:0}'
    + 'body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#1A202C;background:#fff}'
    + watermarkCSS
    + '.page{width:210mm;min-height:297mm;padding:16mm 18mm;margin:0 auto}'
    + '.page2{page-break-before:always}'
    + '.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #0D2B5E}'
    + '.co-name{font-size:20pt;font-weight:900;color:#0D2B5E;line-height:1}'
    + '.po-label{font-size:9pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;margin-top:5px}'
    + '.po-num{font-size:22pt;font-weight:900;color:#0D2B5E;text-align:right}'
    + '.po-meta-txt{font-size:9.5pt;color:#64748B;text-align:right;margin-top:4px}'
    + '.addr-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:22px}'
    + '.addr-box{background:#F8FAFC;border-left:4px solid #0D2B5E;padding:11px 13px;border-radius:0 6px 6px 0}'
    + '.addr-box .lbl{font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748B;margin-bottom:6px}'
    + '.addr-box strong{font-size:11pt;color:#0D2B5E;display:block;margin-bottom:2px}'
    + '.addr-box span{font-size:9.5pt;color:#475569;display:block;line-height:1.5}'
    + 'table{width:100%;border-collapse:collapse}'
    + '.items thead tr{background:#0D2B5E;color:#fff}'
    + '.items thead th{padding:9px 12px;font-size:9.5pt;font-weight:700;text-align:left}'
    + '.items tbody tr:nth-child(even) td{background:#F8FAFC}'
    + '.totals{display:flex;justify-content:flex-end;margin-top:14px}'
    + '.totals-inner{width:250px}'
    + '.t-row{display:flex;justify-content:space-between;padding:5px 0;font-size:10.5pt;border-bottom:1px solid #E2E8F0}'
    + '.t-grand{border-top:2.5px solid #0D2B5E;border-bottom:2.5px solid #0D2B5E;font-weight:900;font-size:13pt;color:#0D2B5E;padding:8px 0;margin-top:3px}'
    + '.notes{background:#FFFBEB;border:1px solid #FDE68A;border-radius:6px;padding:11px 13px;margin:18px 0;font-size:10pt}'
    + '.sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:28px}'
    + '.sig-line{border-top:1.5px solid #1A202C;padding-top:5px;font-size:9pt;color:#64748B}'
    + '.pg-footer{margin-top:22px;padding-top:11px;border-top:1px solid #E2E8F0;font-size:8.5pt;color:#94A3B8;text-align:center}'
    + '.tc-title{font-size:14pt;font-weight:900;color:#0D2B5E;margin-bottom:5px}'
    + '.tc-sub{font-size:9pt;color:#64748B;margin-bottom:20px;line-height:1.5}'
    + '.tc-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 28px}'
    + '.tc-clause{margin-bottom:12px}'
    + '.tc-clause h3{font-size:9.5pt;font-weight:700;color:#0D2B5E;margin-bottom:3px}'
    + '.tc-clause p{font-size:8.8pt;color:#334155;line-height:1.55}'
    + '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{padding:12mm 15mm}@page{size:A4;margin:0}}\n</style>\n</head>\n<body>\n'
    + watermarkHTML
    + '<div class="page">'
    + '<div class="hdr">'
    + (compLogo
      ? '<div style="display:flex;align-items:center;gap:14px"><img src="' + compLogo + '" style="max-height:56px;max-width:160px;object-fit:contain" alt="' + company + ' logo"><div><div class="po-label" style="margin-top:0">Purchase Order</div></div></div>'
      : '<div><div class="co-name">' + company + '</div><div class="po-label">Purchase Order</div></div>'
    )
    + '<div><div class="po-num">' + p.id + '</div>'
    + '<div class="po-meta-txt">Date issued: ' + p.date + '</div>'
    + '<div class="po-meta-txt">Required by: ' + p.delivery + '</div></div>'
    + '</div>'
    + '<div class="addr-grid">'
    + '<div class="addr-box"><div class="lbl">Buyer (Bill To)</div><strong>' + company + '</strong>'
    + (compAddr ? '<span>' + compAddr + '</span>' : '<span>Finance / Procurement Dept</span>')
    + (compPhone ? '<span>📞 ' + compPhone + '</span>' : '')
    + (compEmail ? '<span>✉ ' + compEmail + '</span>' : '')
    + (compReg ? '<span style="font-size:9pt;color:#94A3B8">Reg/VAT: ' + compReg + '</span>' : '')
    + '</div>'
    + '<div class="addr-box"><div class="lbl">Supplier (Ship To)</div><strong>' + p.supplier + '</strong><span>Deliver to ' + company + '</span></div>'
    + '<div class="addr-box"><div class="lbl">Order Details</div>'
    + '<span><strong>Currency:</strong> ' + cur + '</span>'
    + '<span><strong>Department:</strong> ' + p.dept + '</span>'
    + '<span><strong>Raised by:</strong> ' + p.requestedBy + '</span>'
    + '<span><strong>Authorised by:</strong> ' + p.approver + '</span>'
    + '</div>'
    + '</div>'
    + '<table class="items"><thead><tr>'
    + '<th style="width:54%">Description</th>'
    + '<th style="width:9%;text-align:center">Qty</th>'
    + '<th style="width:18.5%;text-align:right">Unit Price</th>'
    + '<th style="width:18.5%;text-align:right">Amount</th>'
    + '</tr></thead><tbody>' + itemRows + '</tbody></table>'
    + '<div class="totals"><div class="totals-inner">'
    + '<div class="t-row"><span>Subtotal</span><span>' + sym + subtotal.toFixed(2) + '</span></div>'
    + '<div class="t-row"><span>' + taxLabel + ' (' + taxRate + '%)</span><span>' + sym + tax.toFixed(2) + '</span></div>'
    + '<div class="t-row t-grand"><span>TOTAL (' + cur + ')</span><span>' + sym + grandTotal.toFixed(2) + '</span></div>'
    + '</div></div>'
    + (p.notes ? '<div class="notes"><strong>Special Instructions:</strong> ' + p.notes + '</div>' : '')
    + '<div class="sig-grid">'
    + '<div><div style="height:38px"></div><div class="sig-line">Authorised by (Buyer) &nbsp;·&nbsp; ' + p.approver + ' &nbsp;·&nbsp; ' + company + '</div></div>'
    + '<div><div style="height:38px"></div><div class="sig-line">Acknowledged by (Supplier) &nbsp;·&nbsp; ' + p.supplier + '</div></div>'
    + '</div>'
    + '<div class="pg-footer"><strong>' + company + '</strong>'
    + (compPhone ? ' &nbsp;·&nbsp; ' + compPhone : '') + (compEmail ? ' &nbsp;·&nbsp; ' + compEmail : '')
    + (compWebsite ? ' &nbsp;·&nbsp; ' + compWebsite : '') + (compReg ? ' &nbsp;·&nbsp; Reg/VAT: ' + compReg : '')
    + '<br>' + p.id + ' &nbsp;·&nbsp; Generated ' + new Date().toLocaleDateString() + ' via ProjectBuys'
    + '<br><em>This purchase order is subject to the Standard Terms and Conditions of Purchase printed overleaf.</em>'
    + '</div></div>'
    + '<div class="page page2">'
    + '<div class="tc-title">STANDARD TERMS AND CONDITIONS OF PURCHASE</div>'
    + '<div class="tc-sub">These terms apply to Purchase Order ' + p.id + ' issued by <strong>' + company + '</strong> ("Buyer") to <strong>' + p.supplier + '</strong> ("Supplier"). They are governed by the laws of <strong>' + govLaw + '</strong> and supersede all other terms.</div>'
    + '<div class="tc-cols"><div>'
    + '<div class="tc-clause"><h3>1. Acceptance</h3><p>Commencement of work, dispatch of goods, or any written acknowledgement of this Order constitutes the Supplier\'s unconditional acceptance of these terms. The Supplier\'s own terms and conditions are expressly excluded and shall have no legal effect whatsoever.</p></div>'
    + '<div class="tc-clause"><h3>2. Price and Payment</h3><p>The price is fixed as stated on the face of this Order and shall not be subject to any increase without the Buyer\'s prior written consent. Payment shall be made within the period specified on the Order face, calculated from receipt of a correct and undisputed invoice. The Buyer reserves the right to set off against sums owed to the Supplier any amounts due from the Supplier to the Buyer.</p></div>'
    + '<div class="tc-clause"><h3>3. Delivery</h3><p>Time of delivery is of the essence. The Supplier shall deliver goods or services to the address and by the date specified on this Order. Risk in the goods passes to the Buyer upon delivery to the specified address. Title to the goods passes to the Buyer upon full payment. The Supplier is responsible for adequate packaging and labelling.</p></div>'
    + '<div class="tc-clause"><h3>4. Inspection and Rejection</h3><p>The Buyer is entitled to inspect and test goods at any time before or after delivery. If goods do not conform to this Order, the Buyer may reject and return them at the Supplier\'s cost, require replacement or correction at no charge, or require a full refund. Payment shall not constitute acceptance of non-conforming goods.</p></div>'
    + '<div class="tc-clause"><h3>5. Warranties</h3><p>The Supplier warrants that all goods and services shall: (a) conform to any agreed specification; (b) be of satisfactory quality and fit for their intended purpose; (c) be free from defects in design, materials and workmanship; (d) comply with all applicable standards, regulations and legal requirements; and (e) be free from any third-party liens or encumbrances.</p></div>'
    + '<div class="tc-clause"><h3>6. Intellectual Property</h3><p>All deliverables, designs, data and materials specifically created for the Buyer under this Order shall vest in and belong to the Buyer from the moment of creation as works made for hire, unless otherwise agreed in writing. The Supplier grants the Buyer a perpetual, royalty-free licence to use any background intellectual property embedded in the deliverables.</p></div>'
    + '<div class="tc-clause"><h3>7. Confidentiality</h3><p>The Supplier shall treat as strictly confidential all information disclosed by the Buyer in connection with this Order and shall not disclose it to any third party without prior written consent. This obligation survives termination of the Order for five (5) years. The Supplier shall restrict access to such information to those employees with a need to know.</p></div>'
    + '<div class="tc-clause"><h3>8. Indemnification</h3><p>The Supplier shall indemnify and hold the Buyer harmless from all losses, damages, costs and expenses (including reasonable legal fees) arising from: (a) any breach of these terms; (b) the Supplier\'s negligence or wilful misconduct; or (c) any claim that the goods or services infringe a third party\'s intellectual property rights.</p></div>'
    + '</div><div>'
    + '<div class="tc-clause"><h3>9. Insurance</h3><p>The Supplier shall maintain, at its own cost and throughout the performance of this Order, adequate insurance cover including public liability, product liability (where goods are supplied) and professional indemnity insurance in amounts sufficient to cover potential claims. Evidence of current cover shall be provided to the Buyer on request and without delay.</p></div>'
    + '<div class="tc-clause"><h3>10. Health, Safety and Environment</h3><p>The Supplier shall comply fully with all applicable health, safety and environmental legislation and shall take all reasonable precautions to protect the health and safety of its employees, the Buyer\'s personnel and the public. Any safety incident involving goods supplied under this Order must be reported to the Buyer promptly in writing.</p></div>'
    + '<div class="tc-clause"><h3>11. Compliance with Laws and Ethical Standards</h3><p>The Supplier shall comply with all applicable laws and regulations including, without limitation, those relating to: employment and labour rights; equal opportunities; anti-bribery and corruption (including the UK Bribery Act 2010 and the US Foreign Corrupt Practices Act where applicable); modern slavery and human trafficking; data protection and privacy; and applicable trade sanctions.</p></div>'
    + '<div class="tc-clause"><h3>12. Subcontracting and Assignment</h3><p>The Supplier shall not subcontract all or any material part of this Order without the Buyer\'s prior written consent. The Supplier shall remain responsible for the acts and omissions of any approved subcontractor as if they were the Supplier\'s own. Neither party may assign its rights or obligations under this Order without the other\'s prior written consent, such consent not to be unreasonably withheld.</p></div>'
    + '<div class="tc-clause"><h3>13. Termination</h3><p>The Buyer may terminate this Order immediately on written notice if the Supplier commits a material breach that is incapable of remedy, or fails to remedy a remediable breach within fourteen (14) days of written notice. The Buyer may also terminate for convenience on thirty (30) days\' written notice, in which case the Buyer shall pay for conforming goods or services properly delivered up to the termination date.</p></div>'
    + '<div class="tc-clause"><h3>14. Force Majeure</h3><p>Neither party shall be liable for any failure or delay in performance caused directly by circumstances beyond its reasonable control, provided that: (a) the affected party notifies the other in writing promptly on becoming aware of the event; and (b) the affected party uses all reasonable endeavours to mitigate the impact. If the force majeure event continues for more than thirty (30) consecutive days, the Buyer may terminate this Order without further liability.</p></div>'
    + '<div class="tc-clause"><h3>15. Governing Law, Disputes and Entire Agreement</h3><p>This Order is governed by and construed in accordance with the laws of ' + govLaw + '. Any dispute shall first be subject to good-faith negotiation for thirty (30) days; thereafter either party may refer the matter to the courts of ' + govLaw + ', to whose non-exclusive jurisdiction both parties irrevocably submit. This Order constitutes the entire agreement between the parties on its subject matter and supersedes all prior representations and negotiations.</p></div>'
    + '</div></div>'
    + '<div class="pg-footer" style="margin-top:14px">' + company + ' &nbsp;·&nbsp; Standard Terms and Conditions of Purchase &nbsp;·&nbsp; &copy; ' + new Date().getFullYear() + ' &nbsp;·&nbsp; Governed by the laws of ' + govLaw + '</div>'
    + '</div>'
    + '<script>window.onload=function(){window.print();}<\/script>'
    + '</body></html>';

  const win = window.open('', '_blank', 'width=920,height=750');
  if (!win) { toast('⚠️ Pop-up blocked — please allow pop-ups for this page and try again.'); return; }
  win.document.write(html);
  win.document.close();
}

// ── Reset form state for create-po view ───────────────────
export function resetCreatePOForm() {
  document.getElementById('po-number').value = nextPONumber();
  document.getElementById('po-supplier').value = '';
  document.getElementById('po-currency').value = 'USD';
  document.getElementById('po-dept').value = 'Operations';
  document.getElementById('po-notes').value = '';
  const alertEl = document.getElementById('supplier-alert');
  const errSup  = document.getElementById('err-supplier');
  const errDel  = document.getElementById('err-delivery');
  if (alertEl) alertEl.style.display = 'none';
  if (errSup)  errSup.style.display  = 'none';
  if (errDel)  errDel.style.display  = 'none';
  const today = new Date(); today.setDate(today.getDate() + 7);
  document.getElementById('po-delivery').value = today.toISOString().split('T')[0];
  _lineCount = 1;
  document.getElementById('li-body').innerHTML = '<tr><td><input placeholder="Item description" oninput="calcTotals()"></td><td><input type="number" value="1" min="1" oninput="calcTotals()" style="width:60px"></td><td><input type="number" value="0" min="0" step="0.01" oninput="calcTotals()"></td><td class="li-total" id="lt-0">$0.00</td><td><button class="del-btn" onclick="removeLine(this)">✕</button></td></tr>';
  calcTotals();
}
