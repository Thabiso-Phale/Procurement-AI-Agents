// ============================================================
// RFQ GENERATOR MODULE
// ============================================================

import { getSettings, getRFQData, setRFQData, getPOData, setPOData } from '../store.js';
import { toast } from '../utils.js';
import { hasFeature } from '../features.js';
import { showView } from '../router.js';
import { nextPONumber } from './po.js';

export const supplierScores = {
  'TechEquip Solutions': 72, 'Office Depot Pro': 87, 'CloudServ Partners': 91,
  'PrintMaster Co': 78, 'GlobalShip Logistics': 60, 'Broker A': 75, 'Broker B': 85, 'Broker C': 70
};

// ── Badge ─────────────────────────────────────────────────
export function rfqStatusBadge(s) {
  const map = {'Draft':'badge-gray','Sent':'badge-blue','Awaiting Quotes':'badge-yellow','Quotes Received':'badge-green','Awarded':'badge-purple','Closed':'badge-gray'};
  return '<span class="badge ' + (map[s] || 'badge-gray') + '">' + s + '</span>';
}

// ── Table ─────────────────────────────────────────────────
export function renderRFQTable() {
  const rfqData = getRFQData();
  const tbody = document.getElementById('rfq-tbody');
  if (!tbody) return;
  tbody.innerHTML = rfqData.map(r =>
    '<tr onclick="viewRFQ(\'' + r.id + '\')">'
    + '<td><strong>' + r.id + '</strong></td>'
    + '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + r.item + '</td>'
    + '<td>' + r.suppliers.length + ' suppliers</td>'
    + '<td>' + (r.quotes.length ? '<strong style="color:#16A34A">' + r.quotes.length + ' received</strong>' : '<span style="color:#94A3B8">Awaiting...</span>') + '</td>'
    + '<td>' + r.deadline + '</td>'
    + '<td>' + r.currency + ' —</td>'
    + '<td>' + rfqStatusBadge(r.status) + '</td>'
    + '<td onclick="event.stopPropagation()">'
      + (r.status === 'Quotes Received' ? '<button class="btn btn-green btn-sm" onclick="viewRFQ(\'' + r.id + '\')">Compare Quotes →</button>' : '<button class="btn btn-outline btn-sm" onclick="viewRFQ(\'' + r.id + '\')">View</button>')
    + '</td></tr>'
  ).join('');
}

// ── Detail view ───────────────────────────────────────────
export function viewRFQ(id) {
  const rfqData = getRFQData();
  const settings = getSettings();
  const r = rfqData.find(x => x.id === id);
  if (!r) return;

  if (r.quotes.length) {
    const prices = r.quotes.map(q => q.unitPrice);
    const minPrice = Math.min(...prices), maxPrice = Math.max(...prices);
    const days = r.quotes.map(q => q.deliveryDays);
    const minDays = Math.min(...days), maxDays = Math.max(...days);
    r.quotes.forEach(q => {
      const priceScore = maxPrice === minPrice ? 50 : Math.round(100 - (q.unitPrice - minPrice) / (maxPrice - minPrice) * 50);
      const delivScore = maxDays === minDays ? 50 : Math.round(100 - (q.deliveryDays - minDays) / (maxDays - minDays) * 30);
      const supScore = supplierScores[q.supplier] || 70;
      q.score = Math.round(priceScore * 0.5 + delivScore * 0.3 + supScore * 0.2);
    });
    r.quotes.sort((a, b) => b.score - a.score);
  }

  const bestQuote = r.quotes.length ? r.quotes[0] : null;
  const el = document.getElementById('rfq-detail-content');
  const rfqCompany  = settings.companyName || 'Your Company';
  const rfqAddr     = (settings.companyAddress || '').replace(/\n/g, ' · ');
  const rfqPhone    = settings.companyPhone || '';
  const rfqEmail    = settings.companyEmail || '';
  const rfqReg      = settings.companyRegNo || '';
  const rfqLogo     = (hasFeature('pdf_export') && settings.companyLogo) ? settings.companyLogo : '';

  el.innerHTML = '<div class="section-hdr"><div><h3>' + r.id + ' — RFQ Details</h3></div>'
    + '<div class="btn-row"><button class="btn btn-outline" onclick="showView(\'rfq\')">← Back to RFQs</button>'
    + (r.status === 'Quotes Received' ? '<button class="btn btn-primary" onclick="showView(\'price-comparison\')">🤖 Full AI Price Analysis</button>' : '')
    + '</div></div>'
    + '<div style="background:#0D2B5E;border-radius:10px 10px 0 0;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">'
    + '<div style="display:flex;align-items:center;gap:12px">'
    + (rfqLogo ? '<img src="' + rfqLogo + '" style="height:40px;max-width:120px;object-fit:contain;background:#fff;border-radius:4px;padding:3px">' : '')
    + '<div><div style="font-size:15px;font-weight:800;color:#fff">' + rfqCompany + '</div>'
    + '<div style="font-size:11px;color:#93C5FD;margin-top:2px">'
    + (rfqAddr ? rfqAddr : '') + (rfqPhone ? ' · ' + rfqPhone : '') + (rfqEmail ? ' · ' + rfqEmail : '') + (rfqReg ? ' · Reg/VAT: ' + rfqReg : '')
    + '</div></div></div>'
    + '<div style="text-align:right"><div style="font-size:12px;font-weight:700;color:#93C5FD;letter-spacing:1px;text-transform:uppercase">Request for Quotation</div>'
    + '<div style="font-size:18px;font-weight:900;color:#fff">' + r.id + '</div></div>'
    + '</div>'
    + '<div class="card" style="margin-bottom:16px;border-radius:0 0 10px 10px;border-top:none">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">'
    + '<div><div style="font-size:18px;font-weight:800;color:#0D2B5E">' + r.item + '</div>'
    + '<div style="font-size:13px;color:#64748B;margin-top:4px">Qty: ' + r.qty + ' · Deadline: ' + r.deadline + ' · Delivery by: ' + r.delivery + '</div></div>'
    + rfqStatusBadge(r.status) + '</div>'
    + (r.spec ? '<div style="background:#F8FAFC;border-radius:8px;padding:10px;margin-top:12px;font-size:12px;color:#64748B"><strong>Specification:</strong> ' + r.spec + '</div>' : '')
    + '<div style="margin-top:12px;font-size:12px;color:#64748B"><strong>Suppliers invited:</strong> ' + r.suppliers.join(', ') + '</div>'
    + '</div>'
    + (r.quotes.length
      ? '<div class="card" style="margin-bottom:16px">'
        + (bestQuote ? '<div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:10px;padding:14px;margin-bottom:16px">'
          + '<div style="font-size:14px;font-weight:700;color:#166534;margin-bottom:4px">🤖 AI Recommendation: <span style="color:#16A34A">' + bestQuote.supplier + '</span></div>'
          + '<div style="font-size:13px;color:#166534">Best overall score <strong>(' + bestQuote.score + '/100)</strong>.</div>'
          + '</div>' : '')
        + '<div class="card-title">Quote Comparison — Side by Side <span class="ai-badge">🤖 AI Scored</span></div>'
        + '<div style="overflow-x:auto"><table class="tbl" style="min-width:600px">'
        + '<thead><tr><th>Criteria</th>' + r.quotes.map((q, i) => '<th style="text-align:center">' + (i === 0 ? '⭐ ' : '') + '<strong>' + q.supplier + '</strong>' + (q === bestQuote ? '<br><span class="badge badge-green" style="font-size:10px">Recommended</span>' : '') + '</th>').join('') + '</tr></thead>'
        + '<tbody>'
        + '<tr><td><strong>Unit Price</strong></td>' + r.quotes.map(q => '<td style="text-align:center"><strong>' + r.currency + ' $' + q.unitPrice.toFixed(2) + '</strong></td>').join('') + '</tr>'
        + '<tr><td><strong>Total (×' + r.qty + ')</strong></td>' + r.quotes.map(q => '<td style="text-align:center;font-weight:700;color:#0D2B5E">$' + q.total.toLocaleString() + '</td>').join('') + '</tr>'
        + '<tr><td>Delivery Time</td>' + r.quotes.map(q => '<td style="text-align:center">' + q.deliveryDays + ' days</td>').join('') + '</tr>'
        + '<tr><td>Payment Terms</td>' + r.quotes.map(q => '<td style="text-align:center">' + q.paymentTerms + '</td>').join('') + '</tr>'
        + '<tr><td>Warranty</td>' + r.quotes.map(q => '<td style="text-align:center">' + q.warranty + '</td>').join('') + '</tr>'
        + '<tr style="background:#F0FDF4"><td><strong>AI Score</strong></td>' + r.quotes.map(q => { const c = q.score >= 80 ? '#16A34A' : q.score >= 65 ? '#D97706' : '#DC2626'; return '<td style="text-align:center;font-weight:800;font-size:16px;color:' + c + '">' + q.score + '<span style="font-size:11px;font-weight:400">/100</span></td>'; }).join('') + '</tr>'
        + '</tbody></table></div>'
        + '<div class="btn-row" style="margin-top:16px">'
        + (bestQuote && r.status !== 'Awarded' ? '<button class="btn btn-green" onclick="awardRFQ(\'' + r.id + '\',\'' + bestQuote.supplier + '\')">✅ Award to ' + bestQuote.supplier + ' (Recommended)</button>' : '')
        + (r.awarded ? '<div style="font-size:13px;font-weight:600;color:#16A34A">✅ Awarded to ' + r.awarded + '</div>' : '')
        + '<button class="btn btn-primary" onclick="createPOFromRFQ(\'' + r.id + '\')">📋 Create PO from Winner</button>'
        + '</div></div>'
      : '<div class="card"><div style="text-align:center;padding:20px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">📬</div><div>Waiting for quotes from ' + r.suppliers.length + ' suppliers. Deadline: ' + r.deadline + '</div></div></div>')
    + '</div>';
  showView('rfq-detail');
}

// ── Send / Award / Convert ────────────────────────────────
export function sendRFQ() {
  const item     = document.getElementById('rfq-item').value.trim();
  const deadline = document.getElementById('rfq-deadline').value;
  const selected = [];
  ['rfq-s1','rfq-s2','rfq-s3','rfq-s4'].forEach(sid => {
    const el = document.getElementById(sid); if (el && el.checked) selected.push(el.value);
  });
  const errItem = document.getElementById('err-rfq-item');
  const errDl   = document.getElementById('err-rfq-deadline');
  if (errItem) errItem.style.display = item ? 'none' : 'block';
  if (errDl)   errDl.style.display   = deadline ? 'none' : 'block';
  if (!item || !deadline) return;
  if (selected.length < 2) { toast('⚠ Please select at least 2 suppliers for a meaningful comparison.'); return; }
  if (selected.length > 3) { toast('⚠ Maximum 3 suppliers per RFQ. Deselect one to continue.'); return; }
  const id = nextRFQNumber();
  const rfqData = getRFQData();
  rfqData.push({
    id, item, qty: parseInt(document.getElementById('rfq-qty').value) || 1,
    spec: document.getElementById('rfq-spec').value.trim(),
    deadline, delivery: document.getElementById('rfq-delivery').value || deadline,
    currency: document.getElementById('rfq-currency').value,
    status: 'Awaiting Quotes', suppliers: selected, quotes: [], awarded: ''
  });
  setRFQData(rfqData);
  toast('📩 ' + id + ' sent to ' + selected.length + ' suppliers! Quotes expected by ' + deadline + '.');
  showView('rfq');
}

export function awardRFQ(rfqId, supplier) {
  const rfqData = getRFQData();
  const r = rfqData.find(x => x.id === rfqId);
  if (r) { r.status = 'Awarded'; r.awarded = supplier; setRFQData(rfqData); }
  toast('🏆 RFQ awarded to ' + supplier + '! You can now create a PO.');
  viewRFQ(rfqId);
}

export function createPOFromRFQ(rfqId) {
  const rfqData = getRFQData();
  const r = rfqData.find(x => x.id === rfqId);
  if (!r) return;
  const winner      = r.awarded || (r.quotes.length ? r.quotes[0].supplier : '');
  const winnerQuote = r.quotes.find(q => q.supplier === winner);
  if (!winnerQuote && !winner) { toast('Please award the RFQ to a supplier first.'); return; }
  const id = nextPONumber();
  const poData = getPOData();
  poData.push({
    id, supplier: winner, desc: r.item,
    amount: winnerQuote ? winnerQuote.total : 0,
    lineItems: [{desc:r.item,qty:r.qty,price:winnerQuote?winnerQuote.unitPrice:0,total:winnerQuote?winnerQuote.total:0}],
    currency: r.currency, requestedBy: 'Alex', dept: 'Operations',
    date: new Date().toISOString().split('T')[0], delivery: r.delivery,
    status: 'Pending Approval', approver: 'Alex', notes: 'Created from ' + rfqId
  });
  setPOData(poData);
  toast('📋 PO ' + id + ' created from ' + rfqId + '! Find it in Purchase Orders.');
  showView('purchase-orders');
}

export function nextRFQNumber() {
  const rfqData = getRFQData();
  const nums = rfqData.map(r => parseInt(r.id.split('-')[2]) || 0);
  const max  = nums.length ? Math.max(...nums) : 3;
  return 'RFQ-2026-' + (max + 1).toString().padStart(3, '0');
}
