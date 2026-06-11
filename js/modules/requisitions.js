// ============================================================
// REQUISITIONS MODULE
// ============================================================

import { getSettings, getReqData, setReqData, getPOData, setPOData } from '../store.js';
import { toast } from '../utils.js';
import { showView } from '../router.js';
import { nextPONumber } from './po.js';

let _currentReqFilter = 'all';

// ── Badges ────────────────────────────────────────────────
function reqStatusBadge(s) {
  const map = {'Draft':'badge-gray','Pending Approval':'badge-red','Approved':'badge-green','Rejected':'badge-yellow','Converted to PO':'badge-blue'};
  return '<span class="badge ' + (map[s] || 'badge-gray') + '">' + s + '</span>';
}
function priorityBadge(p) {
  const map = {'Low':'badge-green','Medium':'badge-yellow','High':'badge-red'};
  return '<span class="badge ' + (map[p] || 'badge-gray') + '">' + p + '</span>';
}

// ── Table ─────────────────────────────────────────────────
export function renderReqTable(data) {
  const reqData = getReqData();
  let rows = data || reqData;
  if (_currentReqFilter !== 'all') rows = rows.filter(r => r.status === _currentReqFilter);
  const tbody = document.getElementById('req-tbody');
  if (!tbody) return;
  tbody.innerHTML = rows.map(r =>
    '<tr onclick="viewReq(\'' + r.id + '\')">'
    + '<td><strong>' + r.id + '</strong></td>'
    + '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + r.item + '</td>'
    + '<td>' + r.category + '</td>'
    + '<td><strong>' + r.currency + ' $' + r.budget.toLocaleString() + '</strong></td>'
    + '<td>' + r.requestedBy + '</td>'
    + '<td>' + r.date + '</td>'
    + '<td>' + priorityBadge(r.priority) + '</td>'
    + '<td>' + reqStatusBadge(r.status) + '</td>'
    + '<td onclick="event.stopPropagation()">'
      + (r.status === 'Pending Approval'
        ? '<button class="btn btn-green btn-sm" onclick="approveReq(\'' + r.id + '\')">Approve</button> <button class="btn btn-red btn-sm" onclick="rejectReq(\'' + r.id + '\')">Reject</button>'
        : r.status === 'Approved'
        ? (r.budget > 10000
          ? '<button class="btn btn-primary btn-sm" onclick="convertReqToRFQ(\'' + r.id + '\')">📩 RFQ Required →</button>'
          : r.budget > 2500
          ? '<button class="btn btn-primary btn-sm" onclick="convertReqToRFQ(\'' + r.id + '\')">📩 Create RFQ</button> <button class="btn btn-outline btn-sm" onclick="convertReqToPO(\'' + r.id + '\')">→ PO</button>'
          : '<button class="btn btn-blue btn-sm" style="background:#1D4ED8;color:#fff" onclick="convertReqToPO(\'' + r.id + '\')">→ Create PO</button>')
        : '<button class="btn btn-outline btn-sm" onclick="viewReq(\'' + r.id + '\')">View</button>')
    + '</td></tr>'
  ).join('');
  _updateReqKPIs();
}

function _updateReqKPIs() {
  const reqData = getReqData();
  const t = document.getElementById('req-kpi-total');    if (t) t.textContent = reqData.length;
  const p = document.getElementById('req-kpi-pending');  if (p) p.textContent = reqData.filter(r => r.status === 'Pending Approval').length;
  const a = document.getElementById('req-kpi-approved'); if (a) a.textContent = reqData.filter(r => r.status === 'Approved').length;
  const c = document.getElementById('req-kpi-po');       if (c) c.textContent = reqData.filter(r => r.status === 'Converted to PO').length;
}

export function filterReqs(f) { _currentReqFilter = f; renderReqTable(); }

export function searchReqs(q) {
  const reqData = getReqData();
  if (!q) { renderReqTable(); return; }
  const lq = q.toLowerCase();
  renderReqTable(reqData.filter(r =>
    r.id.toLowerCase().includes(lq) ||
    r.item.toLowerCase().includes(lq) ||
    r.requestedBy.toLowerCase().includes(lq)
  ));
}

// ── Detail view ───────────────────────────────────────────
export function viewReq(id) {
  const reqData = getReqData();
  const r = reqData.find(x => x.id === id);
  if (!r) return;
  const el = document.getElementById('req-detail-content');
  el.innerHTML = '<div class="section-hdr"><div><h3>' + r.id + ' — Requisition</h3></div>'
    + '<div class="btn-row">'
    + '<button class="btn btn-outline" onclick="showView(\'requisitions\')">← Back</button>'
    + (r.status === 'Pending Approval' ? '<button class="btn btn-green" onclick="approveReq(\'' + r.id + '\')">✅ Approve</button><button class="btn btn-red" onclick="rejectReq(\'' + r.id + '\')">✕ Reject</button>' : '')
    + (r.status === 'Approved'
      ? r.budget > 10000
        ? '<button class="btn btn-primary" onclick="convertReqToRFQ(\'' + r.id + '\')">📩 RFQ Required — Get 3 Quotes →</button><span style="font-size:12px;color:#DC2626;margin-left:8px">Founder/director approval + RFQ mandatory above $10,000</span>'
        : r.budget > 2500
        ? '<button class="btn btn-primary" onclick="convertReqToRFQ(\'' + r.id + '\')">📩 Create RFQ (Recommended)</button> <button class="btn btn-outline" onclick="convertReqToPO(\'' + r.id + '\')">📋 Convert to PO</button><span style="font-size:12px;color:#C2410C;margin-left:8px">RFQ recommended above $2,500</span>'
        : '<button class="btn btn-primary" onclick="convertReqToPO(\'' + r.id + '\')">📋 Convert to PO →</button>'
      : '')
    + '</div></div>'
    + '<div class="card" style="margin-bottom:16px">'
    + '<div class="po-header"><div><div style="font-size:20px;font-weight:800;color:#0D2B5E">' + r.id + '</div><div style="font-size:13px;color:#64748B;margin-top:4px">' + r.item + '</div></div>'
    + '<div style="text-align:right">' + reqStatusBadge(r.status) + '<div style="font-size:22px;font-weight:800;color:#0D2B5E;margin-top:8px">' + r.currency + ' $' + r.budget.toLocaleString() + '</div></div></div>'
    + '<div class="po-meta">'
    + '<div class="po-meta-item"><span>Requested By</span><strong>' + r.requestedBy + '</strong></div>'
    + '<div class="po-meta-item"><span>Department</span><strong>' + r.dept + '</strong></div>'
    + '<div class="po-meta-item"><span>Category</span><strong>' + r.category + '</strong></div>'
    + '<div class="po-meta-item"><span>Date Submitted</span><strong>' + r.date + '</strong></div>'
    + '<div class="po-meta-item"><span>Needed By</span><strong>' + r.neededBy + '</strong></div>'
    + '<div class="po-meta-item"><span>Priority</span><strong>' + priorityBadge(r.priority) + '</strong></div>'
    + '</div>'
    + '<div style="background:#F8FAFC;border-radius:8px;padding:12px;font-size:13px;color:#334155;margin-top:8px"><strong>Business Justification:</strong> ' + r.justification + '</div>'
    + (r.supplierPref ? '<div style="font-size:12px;color:#64748B;margin-top:8px">Preferred supplier: <strong>' + r.supplierPref + '</strong></div>' : '')
    + (r.linkedPO ? '<div style="font-size:12px;color:#1D4ED8;margin-top:4px">Linked PO: <strong>' + r.linkedPO + '</strong></div>' : '')
    + '</div>';
  showView('req-detail');
}

// ── Actions ───────────────────────────────────────────────
export function approveReq(id) {
  const reqData = getReqData();
  const r = reqData.find(x => x.id === id);
  if (!r) return;
  r.status = 'Approved';
  setReqData(reqData);
  const msg = r.budget > 10000
    ? '✅ ' + id + ' approved. RFQ mandatory — please raise 3 quotes before creating a PO.'
    : r.budget > 2500
    ? '✅ ' + id + ' approved. RFQ recommended for this value — use "Create RFQ" to get competitive quotes.'
    : '✅ ' + id + ' approved! You can now convert it to a Purchase Order.';
  toast(msg);
  renderReqTable();
  const el = document.getElementById('req-detail-content');
  if (el && el.innerHTML) viewReq(id);
}

export function rejectReq(id) {
  const reason = window.prompt('Reason for rejection (required):');
  if (!reason) return;
  const reqData = getReqData();
  const r = reqData.find(x => x.id === id);
  if (r) { r.status = 'Rejected'; setReqData(reqData); }
  toast('✕ ' + id + ' rejected. Requester has been notified.');
  renderReqTable();
  showView('requisitions');
}

export function convertReqToRFQ(id) {
  const reqData = getReqData();
  const r = reqData.find(x => x.id === id);
  if (!r) return;
  toast('📩 Pre-filling RFQ with requisition details...');
  setTimeout(() => {
    showView('create-rfq');
    const itemEl = document.getElementById('rfq-item');   if (itemEl) itemEl.value = r.item;
    const specEl = document.getElementById('rfq-spec');   if (specEl) specEl.value = r.justification || '';
    const termsEl = document.getElementById('rfq-terms'); if (termsEl) termsEl.value = 'Standard Net 30 payment terms apply. Please confirm compliance with all stated specifications. Requisition ref: ' + id + '.';
  }, 300);
}

export function convertReqToPO(id) {
  const reqData = getReqData();
  const r = reqData.find(x => x.id === id);
  if (!r) return;
  const newId = nextPONumber();
  const poData = getPOData();
  poData.push({
    id: newId, supplier: r.supplierPref || 'TBD — select supplier',
    desc: r.item, amount: r.budget,
    lineItems: [{desc:r.item,qty:1,price:r.budget,total:r.budget}],
    currency: r.currency, requestedBy: r.requestedBy, dept: r.dept,
    date: new Date().toISOString().split('T')[0],
    delivery: r.neededBy, status: 'Pending Approval', approver: 'Alex',
    notes: 'Auto-created from requisition ' + id
  });
  setPOData(poData);
  r.status = 'Converted to PO';
  r.linkedPO = newId;
  setReqData(reqData);
  toast('📋 ' + id + ' converted to ' + newId + ' — now in Purchase Orders!');
  renderReqTable();
  showView('purchase-orders');
}

// ── Form actions ──────────────────────────────────────────
export function nextReqNumber() {
  const reqData = getReqData();
  const nums = reqData.map(r => parseInt(r.id.split('-')[2]) || 0);
  const max  = nums.length ? Math.max(...nums) : 4;
  return 'REQ-2026-' + (max + 1).toString().padStart(3, '0');
}

export function validateReq() {
  let ok = true;
  const item   = document.getElementById('req-item').value.trim();
  const cat    = document.getElementById('req-category').value;
  const budget = document.getElementById('req-budget').value;
  const just   = document.getElementById('req-justification').value.trim();
  const errItem = document.getElementById('err-req-item');
  const errCat  = document.getElementById('err-req-cat');
  const errBudg = document.getElementById('err-req-budget');
  const errJust = document.getElementById('err-req-just');
  if (errItem) errItem.style.display = item ? 'none' : 'block'; if (!item) ok = false;
  if (errCat)  errCat.style.display  = cat  ? 'none' : 'block'; if (!cat)  ok = false;
  if (errBudg) errBudg.style.display = (budget && parseFloat(budget) > 0) ? 'none' : 'block'; if (!budget || parseFloat(budget) <= 0) ok = false;
  if (errJust) errJust.style.display = just ? 'none' : 'block'; if (!just) ok = false;
  return ok;
}

export function checkReqBudget() {
  const settings = getSettings();
  const budget   = parseFloat(document.getElementById('req-budget').value) || 0;
  const alertEl  = document.getElementById('req-budget-alert');
  const poData   = getPOData();
  const spent    = poData.reduce((s, p) => s + (['Draft','Closed'].indexOf(p.status) === -1 ? p.amount : 0), 0);
  const remaining = settings.monthlyBudget - spent;
  const aal = settings.autoApproveLimit;
  const rft = settings.rfqThreshold;
  const drt = settings.directorThreshold;
  if (budget <= 0) { if (alertEl) alertEl.style.display = 'none'; return; }
  if (!alertEl) return;
  alertEl.style.display = 'block';
  alertEl.style.borderColor = '';
  if (budget > remaining) {
    alertEl.style.background = '#FEE2E2'; alertEl.style.color = '#991B1B'; alertEl.style.borderColor = '#EF4444';
    alertEl.textContent = '⚠ Exceeds remaining monthly budget of $' + remaining.toLocaleString() + '. Additional budget approval required before this can proceed.';
  } else if (budget <= aal) {
    alertEl.style.background = '#DCFCE7'; alertEl.style.color = '#166534'; alertEl.style.borderColor = '#16A34A';
    alertEl.textContent = '✅ Under $' + aal.toLocaleString() + ' — this will be auto-approved on submission and can be converted directly to a PO.';
  } else if (budget <= rft) {
    alertEl.style.background = '#FEF9C3'; alertEl.style.color = '#A16207'; alertEl.style.borderColor = '#F59E0B';
    alertEl.textContent = 'ℹ $' + aal.toLocaleString() + '–$' + rft.toLocaleString() + ' range — ' + settings.primaryApprover + ' approval required. Once approved you can convert directly to a Purchase Order.';
  } else if (budget <= drt) {
    alertEl.style.background = '#FFF7ED'; alertEl.style.color = '#C2410C'; alertEl.style.borderColor = '#FB923C';
    alertEl.innerHTML = '⚠ Over $' + rft.toLocaleString() + ' — approval required. <strong>RFQ recommended:</strong> policy encourages 3 competitive quotes for purchases above $' + rft.toLocaleString() + '.';
  } else {
    alertEl.style.background = '#FEE2E2'; alertEl.style.color = '#991B1B'; alertEl.style.borderColor = '#EF4444';
    alertEl.innerHTML = '🚨 Over $' + drt.toLocaleString() + ' — founder/director approval required. <strong>RFQ mandatory:</strong> 3 supplier quotes must be obtained and reviewed before a PO can be raised.';
  }
}

export function submitRequisition() {
  if (!validateReq()) return;
  const settings = getSettings();
  const reqData  = getReqData();
  const id     = nextReqNumber();
  const budget = parseFloat(document.getElementById('req-budget').value);
  const status = budget <= settings.autoApproveLimit ? 'Approved' : 'Pending Approval';
  reqData.push({
    id, item: document.getElementById('req-item').value.trim(),
    category: document.getElementById('req-category').value,
    dept: document.getElementById('req-dept').value,
    budget, currency: document.getElementById('req-currency').value,
    requestedBy: settings.userName || 'Alex',
    date: new Date().toISOString().split('T')[0],
    neededBy: document.getElementById('req-needed-by').value || '',
    priority: document.getElementById('req-priority').value,
    status, justification: document.getElementById('req-justification').value.trim(),
    supplierPref: document.getElementById('req-supplier-pref').value,
    linkedPO: ''
  });
  setReqData(reqData);
  if (status === 'Approved') toast('✅ ' + id + ' auto-approved (under $' + settings.autoApproveLimit.toLocaleString() + ')! You can now convert it to a PO.');
  else toast('📤 ' + id + ' submitted for approval by ' + settings.primaryApprover + '.');
  showView('requisitions');
}

export function saveReqDraft() {
  if (!document.getElementById('req-item').value.trim()) { toast('Please describe the item first'); return; }
  const reqData = getReqData();
  const id = nextReqNumber();
  reqData.push({
    id, item: document.getElementById('req-item').value.trim(),
    category: document.getElementById('req-category').value || 'Other',
    dept: document.getElementById('req-dept').value,
    budget: parseFloat(document.getElementById('req-budget').value) || 0,
    currency: document.getElementById('req-currency').value,
    requestedBy: 'Alex', date: new Date().toISOString().split('T')[0],
    neededBy: document.getElementById('req-needed-by').value || '',
    priority: document.getElementById('req-priority').value,
    status: 'Draft',
    justification: document.getElementById('req-justification').value.trim(),
    supplierPref: document.getElementById('req-supplier-pref').value,
    linkedPO: ''
  });
  setReqData(reqData);
  toast('💾 Saved as draft ' + id);
  showView('requisitions');
}

export function reqAISuggest() {
  const item  = document.getElementById('req-item').value.trim().toLowerCase();
  const panel = document.getElementById('req-ai-panel');
  if (!item || item.length < 4) {
    panel.innerHTML = '<span style="color:#94A3B8;font-style:italic">Start typing your item description to get AI-powered supplier suggestions and price benchmarks.</span>';
    return;
  }
  let suggestions = '';
  if (item.includes('chair') || item.includes('furniture') || item.includes('desk')) {
    suggestions = '<strong>🤖 AI Suggestions for Furniture / Facilities:</strong><br><br>'
      + '• <strong>Suggested supplier:</strong> No active furniture supplier — consider <em>adding a specialist</em> via Onboarding<br>'
      + '• <strong>Market price benchmark:</strong> Ergonomic office chairs: $300–$800 each · Standing desks: $500–$1,200<br>'
      + '• <strong>Tip:</strong> Buying 5+ usually qualifies for a 10–15% volume discount<br>'
      + '• <strong>Lead time:</strong> Allow 2–3 weeks for delivery of custom or upholstered items';
  } else if (item.includes('laptop') || item.includes('computer') || item.includes('macbook') || item.includes('pc')) {
    suggestions = '<strong>🤖 AI Suggestions for IT Equipment:</strong><br><br>'
      + '• <strong>Suggested supplier:</strong> TechEquip Solutions (score 72) — ⚠ prices currently 8% above contract rates<br>'
      + '• <strong>Market price benchmark:</strong> Business laptops (i7, 16GB): $900–$1,600 · MacBook Pro 14" M3: $1,999–$2,399<br>'
      + '• <strong>RFQ recommended:</strong> Send quotes to TechEquip + at least 1 alternative before committing<br>'
      + '• <strong>Saving opportunity:</strong> Buying 2+ may qualify for a volume or education/business discount';
  } else if (item.includes('software') || item.includes('saas') || item.includes('licence') || item.includes('license') || item.includes('subscription')) {
    suggestions = '<strong>🤖 AI Suggestions for SaaS / Software:</strong><br><br>'
      + '• <strong>Suggested supplier:</strong> CloudServ Partners (score 91) — your top-rated SaaS supplier<br>'
      + '• <strong>Market price benchmark:</strong> Check vendor website for current pricing tiers<br>'
      + '• <strong>Tip:</strong> Annual billing typically saves 15–20% vs. monthly billing<br>'
      + '• <strong>Bundle alert:</strong> CloudServ may be able to bundle multiple licences for a further discount';
  } else {
    suggestions = '<strong>🤖 AI Suggestions:</strong><br><br>'
      + '• No exact supplier match found in your active directory<br>'
      + '• <strong>Tip:</strong> After submitting, use the RFQ Generator to get 3 competitive quotes<br>'
      + '• <strong>Next step:</strong> Consider onboarding a specialist supplier for this category';
  }
  panel.innerHTML = '<div style="font-size:13px;color:#334155;line-height:1.8">' + suggestions + '</div>';
}
