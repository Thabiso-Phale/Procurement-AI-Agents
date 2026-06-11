// ============================================================
// INVOICES MODULE
// ============================================================

import { getSettings, getInvoiceData, setInvoiceData, getPOData } from '../store.js';
import { getCurrencySymbol, toast } from '../utils.js';
import { showView } from '../router.js';

let _currentInvoiceFilter = 'all';

// ── Helpers ───────────────────────────────────────────────
export function getJurisdictionInfo(currency) {
  const map = {
    USD: { tax:'Sales Tax',      rate:8.5,  govLaw:'State of Delaware, USA' },
    GBP: { tax:'VAT',            rate:20,   govLaw:'England and Wales, UK' },
    EUR: { tax:'VAT',            rate:21,   govLaw:'Applicable EU Member State' },
    ZAR: { tax:'VAT',            rate:15,   govLaw:'Republic of South Africa' },
    NGN: { tax:'VAT',            rate:7.5,  govLaw:'Federal Republic of Nigeria' },
    KES: { tax:'VAT',            rate:16,   govLaw:'Republic of Kenya' },
    GHS: { tax:'VAT',            rate:15,   govLaw:'Republic of Ghana' },
    AUD: { tax:'GST',            rate:10,   govLaw:'Commonwealth of Australia' },
    CAD: { tax:'HST/GST',        rate:13,   govLaw:'Province of Ontario, Canada' },
    INR: { tax:'GST',            rate:18,   govLaw:'Republic of India' },
    AED: { tax:'VAT',            rate:5,    govLaw:'United Arab Emirates' },
    SGD: { tax:'GST',            rate:9,    govLaw:'Republic of Singapore' },
    JPY: { tax:'Consumption Tax',rate:10,   govLaw:'Japan' },
    CNY: { tax:'VAT',            rate:13,   govLaw:"People's Republic of China" }
  };
  return map[currency] || { tax:'Tax', rate:0, govLaw:'Local jurisdiction' };
}

function invoiceStatusBadge(s) {
  const map = {'Draft':'badge-gray','Pending':'badge-yellow','Approved':'badge-blue','Paid':'badge-green','Overdue':'badge-red','Disputed':'badge-purple'};
  return '<span class="badge ' + (map[s] || 'badge-gray') + '">' + s + '</span>';
}

function _isOverdue(inv) {
  if (!inv.dueDate || inv.status === 'Paid') return false;
  return new Date(inv.dueDate) < new Date();
}

// ── Table ─────────────────────────────────────────────────
export function renderInvoiceTable(data) {
  const invoiceData = getInvoiceData();
  let rows = data || invoiceData.map(inv => {
    if (_isOverdue(inv) && inv.status !== 'Disputed') inv.status = 'Overdue';
    return inv;
  });
  if (_currentInvoiceFilter !== 'all') rows = rows.filter(r => r.status === _currentInvoiceFilter);
  const tbody = document.getElementById('inv-tbody');
  if (!tbody) return;
  tbody.innerHTML = rows.map(inv =>
    '<tr onclick="viewInvoice(\'' + inv.id + '\')" style="' + (inv.status === 'Overdue' ? 'background:#FFF5F5' : '') + '">'
    + '<td><strong>' + inv.id + '</strong></td>'
    + '<td>' + inv.supplier + '</td>'
    + '<td>' + (inv.poRef || '—') + '</td>'
    + '<td><strong>' + (inv.currency || 'USD') + ' $' + (inv.amount || 0).toLocaleString() + '</strong></td>'
    + '<td>' + (inv.invoiceDate || '') + '</td>'
    + '<td>' + (inv.dueDate || '—') + '</td>'
    + '<td>' + invoiceStatusBadge(inv.status) + '</td>'
    + '<td onclick="event.stopPropagation()">'
      + (inv.status === 'Pending' || inv.status === 'Overdue'
        ? '<button class="btn btn-green btn-sm" onclick="markAsPaid(\'' + inv.id + '\')">Mark Paid</button> <button class="btn btn-red btn-sm" onclick="disputeInvoice(\'' + inv.id + '\')">Dispute</button>'
        : '<button class="btn btn-outline btn-sm" onclick="viewInvoice(\'' + inv.id + '\')">View</button>')
    + '</td></tr>'
  ).join('');
  _updateInvoiceKPIs();
}

function _updateInvoiceKPIs() {
  const invoiceData = getInvoiceData();
  const unpaidTotal = invoiceData.filter(i => i.status !== 'Paid').reduce((s,i) => s + (i.amount||0), 0);
  const overdue     = invoiceData.filter(i => _isOverdue(i) && i.status !== 'Disputed').length;
  const paid        = invoiceData.filter(i => i.status === 'Paid').length;
  const el = (id) => document.getElementById(id);
  if (el('inv-kpi-total'))   el('inv-kpi-total').textContent   = invoiceData.length;
  if (el('inv-kpi-pending')) el('inv-kpi-pending').textContent = '$' + unpaidTotal.toLocaleString();
  if (el('inv-kpi-overdue')) el('inv-kpi-overdue').textContent = overdue;
  if (el('inv-kpi-paid'))    el('inv-kpi-paid').textContent    = paid;
}

export function filterInvoices(f) { _currentInvoiceFilter = f; renderInvoiceTable(); }

export function searchInvoices(q) {
  const invoiceData = getInvoiceData();
  if (!q) { renderInvoiceTable(); return; }
  const lq = q.toLowerCase();
  renderInvoiceTable(invoiceData.filter(i =>
    i.id.toLowerCase().includes(lq) ||
    i.supplier.toLowerCase().includes(lq) ||
    (i.poRef || '').toLowerCase().includes(lq)
  ));
}

// ── Detail view ───────────────────────────────────────────
export function viewInvoice(id) {
  const invoiceData = getInvoiceData();
  const settings = getSettings();
  const inv = invoiceData.find(x => x.id === id);
  if (!inv) return;
  const jur = getJurisdictionInfo(inv.currency || settings.currency);
  const taxRate = jur.rate / 100;
  const subtotal = inv.amount || 0;
  const tax      = subtotal * taxRate;
  const total    = subtotal + tax;
  const el = document.getElementById('inv-detail-content');
  if (!el) return;
  el.innerHTML = '<div class="section-hdr"><div><h3>' + inv.id + ' — Invoice</h3></div>'
    + '<div class="btn-row"><button class="btn btn-outline" onclick="showView(\'invoices\')">← Back</button>'
    + (inv.status !== 'Paid' ? '<button class="btn btn-green" onclick="markAsPaid(\'' + inv.id + '\')">💳 Mark as Paid</button>' : '')
    + '</div></div>'
    + '<div style="background:#0D2B5E;border-radius:10px 10px 0 0;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">'
    + '<div><div style="font-size:15px;font-weight:800;color:#fff">' + (settings.companyName || 'Your Company') + '</div>'
    + '<div style="font-size:11px;color:#93C5FD">' + (settings.companyAddress || '').replace(/\n/g,' · ') + '</div></div>'
    + '<div style="text-align:right"><div style="font-size:12px;font-weight:700;color:#93C5FD;text-transform:uppercase;letter-spacing:1px">Invoice</div>'
    + '<div style="font-size:18px;font-weight:900;color:#fff">' + inv.id + '</div></div>'
    + '</div>'
    + '<div class="card" style="border-radius:0 0 10px 10px;border-top:none;margin-bottom:16px">'
    + '<div class="po-meta">'
    + '<div class="po-meta-item"><span>From (Supplier)</span><strong>' + inv.supplier + '</strong></div>'
    + '<div class="po-meta-item"><span>Invoice Date</span><strong>' + (inv.invoiceDate || '') + '</strong></div>'
    + '<div class="po-meta-item"><span>Due Date</span><strong>' + (inv.dueDate || 'N/A') + '</strong></div>'
    + '<div class="po-meta-item"><span>PO Reference</span><strong>' + (inv.poRef || '—') + '</strong></div>'
    + '<div class="po-meta-item"><span>Status</span>' + invoiceStatusBadge(inv.status) + '</div>'
    + '<div class="po-meta-item"><span>Currency</span><strong>' + (inv.currency || 'USD') + '</strong></div>'
    + '</div>'
    + '<table class="tbl" style="margin-top:16px">'
    + '<thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>'
    + '<tbody>'
    + '<tr><td>' + (inv.desc || 'Goods/Services') + '</td><td style="text-align:right">$' + subtotal.toLocaleString() + '</td></tr>'
    + '<tr><td><em>' + jur.tax + ' (' + jur.rate + '%)</em></td><td style="text-align:right"><em>$' + tax.toFixed(2) + '</em></td></tr>'
    + '<tr style="background:#F0F9FF"><td><strong>Total Due</strong></td><td style="text-align:right;font-weight:800;font-size:16px;color:#0D2B5E"><strong>' + (inv.currency || 'USD') + ' $' + total.toFixed(2) + '</strong></td></tr>'
    + '</tbody></table>'
    + (inv.notes ? '<div style="background:#F8FAFC;border-radius:8px;padding:10px;font-size:12px;color:#64748B;margin-top:12px"><strong>Notes:</strong> ' + inv.notes + '</div>' : '')
    + _buildComplianceSection(inv)
    + '</div>';
  showView('invoice-detail');
}

function _buildComplianceSection(inv) {
  const result = checkInvoiceCompliance(inv);
  if (result.flags.length === 0) return '<div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:12px;margin-top:12px;font-size:13px;color:#166534">✅ <strong>Compliance:</strong> All checks passed.</div>';
  return '<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:12px;margin-top:12px">'
    + '<div style="font-size:13px;font-weight:700;color:#991B1B;margin-bottom:6px">⚠ Compliance Flags</div>'
    + result.flags.map(f => '<div style="font-size:12px;color:#7F1D1D;margin-bottom:3px">• ' + f + '</div>').join('')
    + '</div>';
}

export function checkInvoiceCompliance(inv) {
  const flags = [];
  const jur = getJurisdictionInfo(inv.currency || 'USD');
  if (!inv.supplier) flags.push('Missing supplier name — required for all jurisdictions');
  if (!inv.invoiceDate) flags.push('Invoice date is missing — required for ' + jur.govLaw);
  if (!inv.dueDate) flags.push('Payment due date not specified');
  if (!inv.poRef) flags.push('No PO reference number — required for 3-way matching');
  if ((inv.amount || 0) <= 0) flags.push('Invoice amount is zero or missing');
  if (inv.amount > 10000 && jur.rate > 0 && !inv.taxNo) flags.push(jur.tax + ' registration number required for invoices above $10,000 in ' + jur.govLaw);
  if (_isOverdue(inv) && inv.status !== 'Paid') flags.push('Invoice is past due date — arrange payment immediately to avoid penalties');
  return { flags, passed: flags.length === 0 };
}

export function ciApplyComplianceHint() {
  const curr = (document.getElementById('ci-currency') || {value:'USD'}).value;
  const jur = getJurisdictionInfo(curr);
  const hintEl = document.getElementById('ci-compliance-hint');
  if (!hintEl) return;
  hintEl.style.display = 'block';
  hintEl.innerHTML = '📋 <strong>' + curr + ' (' + jur.govLaw + '):</strong> '
    + (jur.rate > 0 ? jur.tax + ' at ' + jur.rate + '% applies. ' : 'No standard tax rate. ')
    + 'Ensure supplier ' + (jur.tax === 'VAT' ? 'VAT' : jur.tax) + ' number is shown on invoice. '
    + 'Governing law: ' + jur.govLaw + '.';
}

// ── Actions ───────────────────────────────────────────────
export function markAsPaid(id) {
  const invoiceData = getInvoiceData();
  const inv = invoiceData.find(x => x.id === id);
  if (inv) { inv.status = 'Paid'; setInvoiceData(invoiceData); }
  toast('💳 ' + id + ' marked as paid!');
  renderInvoiceTable();
  showView('invoices');
}

export function disputeInvoice(id) {
  const reason = window.prompt('Describe the dispute reason:');
  if (!reason) return;
  const invoiceData = getInvoiceData();
  const inv = invoiceData.find(x => x.id === id);
  if (inv) { inv.status = 'Disputed'; inv.disputeReason = reason; setInvoiceData(invoiceData); }
  toast('⚠ ' + id + ' marked as disputed.');
  renderInvoiceTable();
}

// ── Form ─────────────────────────────────────────────────
export function ciCalcDue() {
  const terms = parseInt((document.getElementById('ci-terms') || {value:'30'}).value) || 30;
  const dateEl = document.getElementById('ci-invoice-date');
  if (!dateEl || !dateEl.value) return;
  const d = new Date(dateEl.value);
  d.setDate(d.getDate() + terms);
  const dueDateEl = document.getElementById('ci-due-date');
  if (dueDateEl) dueDateEl.value = d.toISOString().split('T')[0];
}

export function ciCalcTax() {
  const sub = parseFloat((document.getElementById('ci-amount') || {value:'0'}).value) || 0;
  const curr = (document.getElementById('ci-currency') || {value:'USD'}).value;
  const jur  = getJurisdictionInfo(curr);
  const tax  = sub * jur.rate / 100;
  const taxEl   = document.getElementById('ci-tax');
  const totalEl = document.getElementById('ci-total');
  if (taxEl)   taxEl.textContent   = '$' + tax.toFixed(2) + ' (' + jur.tax + ' ' + jur.rate + '%)';
  if (totalEl) totalEl.textContent = '$' + (sub + tax).toFixed(2);
}

export function ciAutoFill() {
  const poRef = (document.getElementById('ci-po-ref') || {value:''}).value.trim();
  if (!poRef) return;
  const po = getPOData().find(p => p.id === poRef);
  if (!po) { toast('PO ' + poRef + ' not found. Check the reference number.'); return; }
  const supEl  = document.getElementById('ci-supplier');  if (supEl)  supEl.value  = po.supplier;
  const descEl = document.getElementById('ci-desc');      if (descEl) descEl.value = po.desc;
  const amtEl  = document.getElementById('ci-amount');    if (amtEl)  amtEl.value  = po.amount;
  const currEl = document.getElementById('ci-currency');  if (currEl) currEl.value = po.currency;
  ciCalcTax();
  toast('✅ Auto-filled from ' + poRef + '!');
}

export function saveInvoice() {
  const supplier = (document.getElementById('ci-supplier') || {value:''}).value.trim();
  const amount   = parseFloat((document.getElementById('ci-amount') || {value:'0'}).value) || 0;
  const errSup = document.getElementById('err-ci-supplier');
  const errAmt = document.getElementById('err-ci-amount');
  if (errSup) errSup.style.display = supplier ? 'none' : 'block';
  if (errAmt) errAmt.style.display = (amount > 0) ? 'none' : 'block';
  if (!supplier || amount <= 0) return;
  const invoiceData = getInvoiceData();
  const nums = invoiceData.map(i => parseInt((i.id || '').split('-')[2]) || 0);
  const max  = nums.length ? Math.max(...nums) : 4;
  const id   = 'INV-2026-' + (max + 1).toString().padStart(3, '0');
  invoiceData.push({
    id, supplier, amount,
    currency:     (document.getElementById('ci-currency') || {value:'USD'}).value,
    invoiceDate:  (document.getElementById('ci-invoice-date') || {value:''}).value,
    dueDate:      (document.getElementById('ci-due-date') || {value:''}).value,
    poRef:        (document.getElementById('ci-po-ref') || {value:''}).value,
    desc:         (document.getElementById('ci-desc') || {value:''}).value,
    terms:        (document.getElementById('ci-terms') || {value:'30'}).value,
    taxNo:        (document.getElementById('ci-tax-no') || {value:''}).value,
    notes:        (document.getElementById('ci-notes') || {value:''}).value,
    status: 'Pending'
  });
  setInvoiceData(invoiceData);
  toast('✅ Invoice ' + id + ' saved!');
  showView('invoices');
}

// ── Invoice scanning ──────────────────────────────────────
export function triggerInvoiceScan() {
  const input = document.getElementById('invoice-scan-file');
  if (input) input.click();
}

export function onInvoiceScanFileSelected(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const progressEl = document.getElementById('scan-progress');
  const statusEl   = document.getElementById('scan-status');
  if (progressEl) { progressEl.style.display = 'block'; }
  if (statusEl)   { statusEl.textContent = 'Scanning ' + file.name + '...'; }
  setTimeout(() => {
    const mockData = {
      supplier:    'TechEquip Solutions',
      invoiceNo:   'INV-TE-' + Math.floor(Math.random()*10000),
      invoiceDate: new Date().toISOString().split('T')[0],
      amount:      (Math.random() * 5000 + 500).toFixed(2),
      tax:         '20%',
      dueDate:     (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0]; })(),
      currency:    'USD'
    };
    if (progressEl) progressEl.style.display = 'none';
    if (statusEl)   statusEl.textContent = '';
    applyScannedInvoiceData(mockData);
    toast('🔍 Invoice scanned! Review and confirm the extracted data.');
  }, 2000);
}

export function applyScannedInvoiceData(data) {
  const supEl  = document.getElementById('ci-supplier');    if (supEl)  supEl.value  = data.supplier || '';
  const dateEl = document.getElementById('ci-invoice-date');if (dateEl) dateEl.value = data.invoiceDate || '';
  const dueEl  = document.getElementById('ci-due-date');    if (dueEl)  dueEl.value  = data.dueDate || '';
  const amtEl  = document.getElementById('ci-amount');      if (amtEl)  amtEl.value  = data.amount || '';
  const currEl = document.getElementById('ci-currency');    if (currEl) currEl.value = data.currency || 'USD';
  ciCalcTax();
  const previewEl = document.getElementById('scan-preview');
  if (previewEl) {
    previewEl.style.display = 'block';
    previewEl.innerHTML = '<div style="font-size:12px;color:#0D2B5E;font-weight:600;margin-bottom:6px">🔍 Extracted from scanned invoice:</div>'
      + '<div style="font-size:12px;color:#334155;display:grid;grid-template-columns:1fr 1fr;gap:6px">'
      + Object.entries(data).map(([k,v]) => '<div><span style="color:#94A3B8">' + k + ':</span> <strong>' + v + '</strong></div>').join('')
      + '</div>';
  }
}

// ── Exports ───────────────────────────────────────────────
export function exportInvoices() {
  const invoiceData = getInvoiceData();
  const cols = ['ID','Supplier','PO Ref','Amount','Currency','Invoice Date','Due Date','Status'];
  const rows = invoiceData.map(i => [i.id,i.supplier,i.poRef||'',i.amount,i.currency,i.invoiceDate,i.dueDate,i.status]);
  _exportCSV(rows, cols, 'invoices_' + new Date().toISOString().split('T')[0] + '.csv');
}

export function exportSpendReport() {
  const invoiceData = getInvoiceData();
  const paid = invoiceData.filter(i => i.status === 'Paid');
  const cols = ['Supplier','Total Paid','# Invoices','Last Payment'];
  const grouped = {};
  paid.forEach(i => {
    if (!grouped[i.supplier]) grouped[i.supplier] = { total:0, count:0, last:'' };
    grouped[i.supplier].total += i.amount;
    grouped[i.supplier].count += 1;
    if (!grouped[i.supplier].last || i.invoiceDate > grouped[i.supplier].last) grouped[i.supplier].last = i.invoiceDate;
  });
  const rows = Object.entries(grouped).map(([s,d]) => [s,d.total,d.count,d.last]);
  _exportCSV(rows, cols, 'spend_report_' + new Date().toISOString().split('T')[0] + '.csv');
}

function _exportCSV(rows, cols, filename) {
  const header = cols.join(',');
  const lines  = rows.map(r => r.map(v => '"' + String(v||'').replace(/"/g,'""') + '"').join(','));
  const blob   = new Blob([header + '\n' + lines.join('\n')], {type:'text/csv'});
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast('📥 ' + filename + ' downloaded!');
}
