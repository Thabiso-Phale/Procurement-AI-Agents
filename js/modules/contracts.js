// ============================================================
// CONTRACTS MODULE
// ============================================================

import { getSettings, getContractData, setContractData } from '../store.js';
import { toast } from '../utils.js';
import { showView } from '../router.js';

// ── Badge ─────────────────────────────────────────────────
export function contractStatusBadge(s) {
  const map = { 'Active':'badge-green', 'Expiring Soon':'badge-yellow', 'Expired':'badge-red', 'Draft':'badge-gray', 'Renewed':'badge-blue' };
  return '<span class="badge ' + (map[s] || 'badge-gray') + '">' + s + '</span>';
}

function _deriveContractStatus(c) {
  if (c.status === 'Draft' || c.status === 'Renewed') return c.status;
  if (!c.endDate) return c.status;
  const today  = new Date();
  const end    = new Date(c.endDate);
  const warn   = new Date(); warn.setDate(warn.getDate() + 30);
  if (end < today) return 'Expired';
  if (end <= warn)  return 'Expiring Soon';
  return 'Active';
}

// ── Helpers ───────────────────────────────────────────────
export function acCalcRenewal() {
  const end    = (document.getElementById('ac-end-date') || {value:''}).value;
  const notice = parseInt((document.getElementById('ac-notice-days') || {value:'30'}).value) || 30;
  if (!end) return;
  const d = new Date(end);
  d.setDate(d.getDate() - notice);
  const renewalEl = document.getElementById('ac-renewal-date');
  if (renewalEl) renewalEl.value = d.toISOString().split('T')[0];
}

export function nextContractNumber() {
  const contractData = getContractData();
  const nums = contractData.map(c => parseInt((c.id || '').split('-')[2]) || 0);
  const max  = nums.length ? Math.max(...nums) : 5;
  return 'CON-2026-' + (max + 1).toString().padStart(3, '0');
}

// ── Table ─────────────────────────────────────────────────
export function renderContractsTable() {
  const contractData = getContractData();
  const tbody = document.getElementById('contracts-tbody');
  if (!tbody) return;
  const enriched = contractData.map(c => ({ ...c, status: _deriveContractStatus(c) }));
  tbody.innerHTML = enriched.map(c =>
    '<tr>'
    + '<td><strong>' + c.id + '</strong></td>'
    + '<td>' + c.supplier + '</td>'
    + '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (c.title || '') + '</td>'
    + '<td>' + (c.startDate || '') + '</td>'
    + '<td>' + (c.endDate || '—') + '</td>'
    + '<td>' + (c.renewalDate || '—') + '</td>'
    + '<td><strong>' + (c.value ? '$' + Number(c.value).toLocaleString() : '—') + '</strong></td>'
    + '<td>' + contractStatusBadge(c.status) + '</td>'
    + '<td><button class="btn btn-outline btn-sm" onclick="viewContract(\'' + c.id + '\')">View</button></td>'
    + '</tr>'
  ).join('');
  _updateContractKPIs(enriched);
}

function _updateContractKPIs(enriched) {
  const el = (id) => document.getElementById(id);
  if (el('con-kpi-total'))    el('con-kpi-total').textContent    = enriched.length;
  if (el('con-kpi-active'))   el('con-kpi-active').textContent   = enriched.filter(c => c.status === 'Active').length;
  if (el('con-kpi-expiring')) el('con-kpi-expiring').textContent = enriched.filter(c => c.status === 'Expiring Soon').length;
  if (el('con-kpi-expired'))  el('con-kpi-expired').textContent  = enriched.filter(c => c.status === 'Expired').length;
}

export function viewContract(id) {
  const contractData = getContractData();
  const c = contractData.find(x => x.id === id);
  if (!c) return;
  const status = _deriveContractStatus(c);
  const el = document.getElementById('con-detail-content');
  if (!el) return;
  el.innerHTML = '<div class="section-hdr"><div><h3>' + c.id + ' — Contract</h3></div>'
    + '<div class="btn-row"><button class="btn btn-outline" onclick="showView(\'contracts\')">← Back</button>'
    + (status === 'Expiring Soon' || status === 'Expired'
      ? '<button class="btn btn-green" onclick="renewContract(\'' + c.id + '\')">🔄 Renew Contract</button>' : '')
    + '</div></div>'
    + '<div class="card">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">'
    + '<div><div style="font-size:20px;font-weight:800;color:#0D2B5E">' + c.id + '</div>'
    + '<div style="font-size:13px;color:#64748B;margin-top:4px">' + (c.title || '') + '</div></div>'
    + contractStatusBadge(status)
    + '</div>'
    + '<div class="po-meta" style="margin-top:16px">'
    + '<div class="po-meta-item"><span>Supplier</span><strong>' + c.supplier + '</strong></div>'
    + '<div class="po-meta-item"><span>Category</span><strong>' + (c.category || '—') + '</strong></div>'
    + '<div class="po-meta-item"><span>Contract Value</span><strong>' + (c.value ? '$' + Number(c.value).toLocaleString() : 'N/A') + '</strong></div>'
    + '<div class="po-meta-item"><span>Start Date</span><strong>' + (c.startDate || 'N/A') + '</strong></div>'
    + '<div class="po-meta-item"><span>End Date</span><strong>' + (c.endDate || 'N/A') + '</strong></div>'
    + '<div class="po-meta-item"><span>Renewal Date</span><strong>' + (c.renewalDate || 'N/A') + '</strong></div>'
    + '<div class="po-meta-item"><span>Notice Period</span><strong>' + (c.noticeDays || '30') + ' days</strong></div>'
    + '<div class="po-meta-item"><span>Payment Terms</span><strong>' + (c.paymentTerms || '—') + '</strong></div>'
    + '</div>'
    + (c.notes ? '<div style="background:#F8FAFC;border-radius:8px;padding:12px;font-size:13px;color:#334155;margin-top:12px"><strong>Notes:</strong> ' + c.notes + '</div>' : '')
    + '</div>';
  showView('contracts');
}

export function renewContract(id) {
  const contractData = getContractData();
  const c = contractData.find(x => x.id === id);
  if (!c) return;
  const endDate = (document.getElementById('ac-end-date') || {});
  const start = new Date(); c.startDate = start.toISOString().split('T')[0];
  const end = new Date(); end.setFullYear(end.getFullYear() + 1); c.endDate = end.toISOString().split('T')[0];
  const renewalD = new Date(end); renewalD.setDate(renewalD.getDate() - (c.noticeDays || 30));
  c.renewalDate = renewalD.toISOString().split('T')[0]; c.status = 'Renewed';
  setContractData(contractData);
  toast('🔄 ' + id + ' renewed for 1 year until ' + c.endDate + '!');
  renderContractsTable();
}

// ── Save ──────────────────────────────────────────────────
export function saveContract() {
  const supplier = (document.getElementById('ac-supplier') || {value:''}).value.trim();
  const title    = (document.getElementById('ac-title')    || {value:''}).value.trim();
  if (!supplier) { toast('Supplier name is required.'); return; }
  const contractData = getContractData();
  const id = nextContractNumber();
  contractData.push({
    id, supplier, title,
    category:     (document.getElementById('ac-category')     || {value:''}).value,
    startDate:    (document.getElementById('ac-start-date')   || {value:''}).value,
    endDate:      (document.getElementById('ac-end-date')     || {value:''}).value,
    renewalDate:  (document.getElementById('ac-renewal-date') || {value:''}).value,
    noticeDays:   parseInt((document.getElementById('ac-notice-days')  || {value:'30'}).value) || 30,
    paymentTerms: (document.getElementById('ac-payment-terms')|| {value:''}).value,
    value:        parseFloat((document.getElementById('ac-value')  || {value:'0'}).value) || 0,
    notes:        (document.getElementById('ac-notes')        || {value:''}).value,
    status: 'Draft'
  });
  setContractData(contractData);
  toast('✅ Contract ' + id + ' saved!');
  showView('contracts');
}
