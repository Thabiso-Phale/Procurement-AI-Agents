// ============================================================
// AI PRICE COMPARISON MODULE
// ============================================================

import { getSettings, getPOData, setPOData, getRFQData } from '../store.js';
import { toast } from '../utils.js';
import { showView } from '../router.js';
import { nextPONumber } from './po.js';

export const pcSuppliers = [
  { name: 'TechEquip Solutions',   price: 1247.50, delivery: 5,  payment: 'Net 30', warranty: '2 years', score: 72 },
  { name: 'Office Depot Pro',      price: 1189.00, delivery: 3,  payment: 'Net 15', warranty: '1 year',  score: 87 },
  { name: 'CloudServ Partners',    price: 1312.00, delivery: 7,  payment: 'Net 45', warranty: '3 years', score: 91 },
  { name: 'GlobalShip Logistics',  price: 1099.00, delivery: 10, payment: 'Net 30', warranty: '1 year',  score: 60 }
];

export function runPriceComparison() {
  const item    = (document.getElementById('pc-item') || {value:''}).value.trim() || 'Laptop Computer';
  const qty     = parseInt((document.getElementById('pc-qty') || {value:'1'}).value) || 1;
  const budget  = parseFloat((document.getElementById('pc-budget') || {value:'0'}).value) || 0;
  const rfqData = getRFQData();
  let suppliers = [...pcSuppliers];
  const randomise = Math.random() * 0.1 - 0.05;
  suppliers = suppliers.map(s => ({
    ...s,
    price: Math.round((s.price * (1 + randomise)) * 100) / 100,
    total: Math.round((s.price * qty * (1 + randomise)) * 100) / 100
  }));
  suppliers.sort((a, b) => {
    const minP = Math.min(...suppliers.map(s => s.price));
    const maxP = Math.max(...suppliers.map(s => s.price));
    const minD = Math.min(...suppliers.map(s => s.delivery));
    const maxD = Math.max(...suppliers.map(s => s.delivery));
    const priceScoreA = maxP === minP ? 50 : Math.round(100 - (a.price - minP) / (maxP - minP) * 50);
    const priceScoreB = maxP === minP ? 50 : Math.round(100 - (b.price - minP) / (maxP - minP) * 50);
    const delivScoreA = maxD === minD ? 50 : Math.round(100 - (a.delivery - minD) / (maxD - minD) * 30);
    const delivScoreB = maxD === minD ? 50 : Math.round(100 - (b.delivery - minD) / (maxD - minD) * 30);
    const scoreA = Math.round(priceScoreA * 0.5 + delivScoreA * 0.3 + a.score * 0.2);
    const scoreB = Math.round(priceScoreB * 0.5 + delivScoreB * 0.3 + b.score * 0.2);
    a.aiScore = scoreA;
    b.aiScore = scoreB;
    return scoreB - scoreA;
  });
  const minP   = Math.min(...suppliers.map(s => s.price));
  const maxP   = Math.max(...suppliers.map(s => s.price));
  const saving = (maxP - minP) * qty;
  const best   = suppliers[0];
  const resultsEl = document.getElementById('pc-results');
  if (!resultsEl) return;
  resultsEl.innerHTML = '<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:14px;margin-bottom:16px">'
    + '<div style="font-size:14px;font-weight:700;color:#1D4ED8;margin-bottom:4px">🤖 AI Analysis — ' + item + ' (×' + qty + ')</div>'
    + '<div style="font-size:13px;color:#1e40af">Best overall: <strong>' + best.name + '</strong> (score: ' + best.aiScore + '/100). '
    + 'Potential saving vs. most expensive: <strong style="color:#16A34A">$' + saving.toFixed(2) + '</strong>. '
    + (budget > 0 && best.total > budget ? '<span style="color:#DC2626">⚠ Cheapest option exceeds your budget of $' + budget.toLocaleString() + '</span>' : '')
    + '</div></div>'
    + '<div style="overflow-x:auto"><table class="tbl" style="min-width:620px">'
    + '<thead><tr><th>Rank</th><th>Supplier</th><th>Unit Price</th><th>Total (×' + qty + ')</th><th>Delivery</th><th>Payment Terms</th><th>Warranty</th><th>AI Score</th><th>Action</th></tr></thead>'
    + '<tbody>' + suppliers.map((s, i) => {
      const sc = s.aiScore >= 80 ? '#16A34A' : s.aiScore >= 65 ? '#D97706' : '#DC2626';
      return '<tr style="' + (i === 0 ? 'background:#F0FDF4' : '') + '">'
        + '<td><strong>' + (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i+1) + '.') + '</strong></td>'
        + '<td><strong>' + s.name + '</strong>' + (i === 0 ? '<br><span class="badge badge-green" style="font-size:10px">Recommended</span>' : '') + '</td>'
        + '<td><strong>$' + s.price.toFixed(2) + '</strong></td>'
        + '<td><strong style="color:#0D2B5E">$' + s.total.toFixed(2) + '</strong></td>'
        + '<td>' + s.delivery + ' days</td>'
        + '<td>' + s.payment + '</td>'
        + '<td>' + s.warranty + '</td>'
        + '<td style="font-weight:800;font-size:16px;color:' + sc + '">' + s.aiScore + '<span style="font-size:11px;font-weight:400">/100</span></td>'
        + '<td>'
          + '<button class="btn btn-blue btn-sm" style="background:#1D4ED8;color:#fff;margin-bottom:4px" onclick="createPOFromComparison(\'' + encodeURIComponent(s.name) + '\',\'' + encodeURIComponent(item) + '\',' + s.total + ')">Create PO</button>'
          + '<button class="btn btn-outline btn-sm" onclick="createRFQFromComparison(\'' + encodeURIComponent(s.name) + '\',\'' + encodeURIComponent(item) + '\')">RFQ</button>'
        + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

export function quickCompare() { runPriceComparison(); }

export function createPOFromComparison(encodedSupplier, encodedItem, total) {
  const supplier = decodeURIComponent(encodedSupplier);
  const item     = decodeURIComponent(encodedItem);
  const qty      = parseInt((document.getElementById('pc-qty') || {value:'1'}).value) || 1;
  const id = nextPONumber();
  const poData = getPOData();
  const settings = getSettings();
  poData.push({
    id, supplier, desc: item, amount: total,
    lineItems: [{desc:item,qty,price:total/qty,total}],
    currency: settings.currency, requestedBy: settings.userName || 'Alex',
    dept: 'Operations', date: new Date().toISOString().split('T')[0],
    delivery: '', status: 'Pending Approval', approver: 'Alex',
    notes: 'Created from Price Comparison'
  });
  setPOData(poData);
  toast('📋 PO ' + id + ' created for ' + supplier + '. Find it in Purchase Orders!');
  showView('purchase-orders');
}

export function createRFQFromComparison(encodedSupplier, encodedItem) {
  const item = decodeURIComponent(encodedItem);
  toast('📩 Pre-filling RFQ with comparison details...');
  setTimeout(() => {
    showView('create-rfq');
    const itemEl = document.getElementById('rfq-item');
    if (itemEl) itemEl.value = item;
  }, 300);
}
