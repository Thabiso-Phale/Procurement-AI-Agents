// ============================================================
// RISK WATCH MODULE
// ============================================================

import { getSettings, getPOData, getInvoiceData, getInventoryData, getContractData } from '../store.js';
import { buildActionItemsHtml } from '../utils.js';
import { calcSupplierConcentration, detectPriceDrift } from './dashboard.js';

// ── Risk helpers ──────────────────────────────────────────
export function rwRiskColor(score) {
  if (score >= 80) return '#DC2626';
  if (score >= 60) return '#D97706';
  if (score >= 40) return '#F59E0B';
  return '#16A34A';
}

export function rwRiskBadge(score) {
  if (score >= 80) return '<span class="badge badge-red">High Risk</span>';
  if (score >= 60) return '<span class="badge badge-yellow">Medium Risk</span>';
  if (score >= 40) return '<span class="badge" style="background:#FEF9C3;color:#78350F">Low-Medium</span>';
  return '<span class="badge badge-green">Low Risk</span>';
}

export function rwScoreSupplier(supplier, poData, invoiceData) {
  let score = 20; // base
  const supplierPOs      = poData.filter(p => p.supplier === supplier);
  const supplierInvoices = invoiceData.filter(i => i.supplier === supplier);
  const totalSpend       = supplierPOs.reduce((s, p) => s + p.amount, 0);
  const allSpend         = poData.reduce((s, p) => s + p.amount, 0);
  const concentration    = allSpend > 0 ? (totalSpend / allSpend) * 100 : 0;

  if (concentration > 40) score += 30;
  else if (concentration > 25) score += 15;
  const overdueInvoices = supplierInvoices.filter(i => i.status === 'Overdue').length;
  if (overdueInvoices > 2) score += 20;
  else if (overdueInvoices > 0) score += 10;
  const disputedInvoices = supplierInvoices.filter(i => i.status === 'Disputed').length;
  if (disputedInvoices > 0) score += 15;
  const rejectedPOs = supplierPOs.filter(p => p.status === 'Rejected').length;
  if (rejectedPOs > 0) score += 10;

  return Math.min(100, score);
}

// ── Distress signals (used by dashboard health score) ─────
export function detectDistressSignals() {
  const poData      = getPOData();
  const invoiceData = getInvoiceData();
  const inventoryData = getInventoryData();
  const contractData  = getContractData();
  const signals = [];
  const overdue  = invoiceData.filter(i => i.status === 'Overdue');
  const disputed = invoiceData.filter(i => i.status === 'Disputed');
  const lowStock = inventoryData.filter(i => i.qty <= i.reorderLevel && i.qty > 0);
  const outStock = inventoryData.filter(i => i.qty <= 0);
  const expiring = contractData.filter(c => {
    if (!c.endDate) return false;
    const warn = new Date(); warn.setDate(warn.getDate() + 30);
    return new Date(c.endDate) <= warn && new Date(c.endDate) > new Date();
  });
  const concentration = calcSupplierConcentration();
  if (overdue.length)           signals.push({ type:'warning', label:'Overdue Invoices',      value: overdue.length + ' overdue', action:'invoices',  desc:'Review and pay overdue invoices to avoid penalty interest' });
  if (disputed.length)          signals.push({ type:'danger',  label:'Disputed Invoices',     value: disputed.length + ' disputed', action:'invoices', desc:'Resolve disputes quickly to maintain supplier relationships' });
  if (outStock.length)          signals.push({ type:'danger',  label:'Out of Stock Items',    value: outStock.length + ' items',   action:'inventory', desc:'Critical stock-outs detected — reorder immediately' });
  if (lowStock.length)          signals.push({ type:'warning', label:'Low Stock Alerts',      value: lowStock.length + ' items',   action:'inventory', desc:'Items approaching reorder level — plan ahead' });
  if (expiring.length)          signals.push({ type:'warning', label:'Expiring Contracts',    value: expiring.length + ' soon',   action:'contracts', desc:'Contracts expiring within 30 days require renewal action' });
  if (concentration > 40)       signals.push({ type:'danger',  label:'Supplier Concentration',value: Math.round(concentration) + '% single supplier', action:'analytics', desc:'High dependency on one supplier creates supply chain risk' });
  const drift = detectPriceDrift();
  if (drift > 10)               signals.push({ type:'warning', label:'Price Drift Detected',  value: drift + '% above average', action:'price-comparison', desc:'Supplier pricing is trending above market — consider RFQ' });
  return signals;
}

// ── Main render ───────────────────────────────────────────
export function renderRiskWatch() {
  const poData        = getPOData();
  const invoiceData   = getInvoiceData();
  const inventoryData = getInventoryData();
  const contractData  = getContractData();

  const signals     = detectDistressSignals();
  const riskLevel   = signals.filter(s => s.type === 'danger').length > 2 ? 'High'
                    : signals.filter(s => s.type === 'danger').length > 0 ? 'Medium'
                    : signals.length > 2 ? 'Low-Medium' : 'Low';
  const riskScore   = Math.min(100, signals.length * 15 + signals.filter(s => s.type === 'danger').length * 10);

  // Supplier risk scores
  const suppliers = [...new Set(poData.map(p => p.supplier).filter(Boolean))];
  const supRisks  = suppliers.map(s => ({
    name: s,
    score: rwScoreSupplier(s, poData, invoiceData),
    poCount: poData.filter(p => p.supplier === s).length,
    spend: poData.filter(p => p.supplier === s).reduce((a, p) => a + p.amount, 0)
  })).sort((a, b) => b.score - a.score);

  const el = document.getElementById('risk-watch-content');
  if (!el) return;

  el.innerHTML = '<div class="section-hdr"><div><h3>Risk Watch Dashboard</h3><div style="font-size:13px;color:#64748B">AI-powered supply chain risk monitoring</div></div>'
    + '<div class="btn-row"><button class="btn btn-primary" onclick="aiRiskAssessment()">🤖 Full AI Risk Assessment</button></div></div>'
    + '<div class="cards-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:16px">'
    + _kpiCard('Overall Risk', riskLevel, rwRiskColor(riskScore))
    + _kpiCard('Risk Score', riskScore + '/100', rwRiskColor(riskScore))
    + _kpiCard('Active Signals', signals.length.toString(), signals.length > 3 ? '#DC2626' : signals.length > 0 ? '#D97706' : '#16A34A')
    + _kpiCard('Suppliers Monitored', suppliers.length.toString(), '#0D2B5E')
    + '</div>'
    + (signals.length
      ? '<div class="card" style="margin-bottom:16px"><div class="card-title">⚠ Active Risk Signals</div>'
        + '<ul style="margin:0;padding:0;list-style:none">' + buildActionItemsHtml(signals.map(s => ({
          p: s.type === 'danger' ? 'urgent' : 'warning',
          t: (s.type === 'danger' ? '<span style="color:#DC2626">🔴 </span>' : '🟡 ') + '<strong>' + s.label + '</strong> — ' + s.value,
          s: s.desc,
          v: s.action,
          b: 'View →'
        }))) + '</ul></div>'
      : '<div class="card" style="margin-bottom:16px;text-align:center;padding:20px;color:#16A34A"><div style="font-size:32px">✅</div><div style="font-weight:600;margin-top:8px">No active risk signals. Keep up the good work!</div></div>')
    + (supRisks.length
      ? '<div class="card"><div class="card-title">Supplier Risk Profiles</div>'
        + '<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Supplier</th><th>Risk Score</th><th>Risk Level</th><th>POs</th><th>Spend</th></tr></thead>'
        + '<tbody>' + supRisks.map(s =>
          '<tr><td><strong>' + s.name + '</strong></td>'
          + '<td><strong style="color:' + rwRiskColor(s.score) + '">' + s.score + '/100</strong></td>'
          + '<td>' + rwRiskBadge(s.score) + '</td>'
          + '<td>' + s.poCount + '</td>'
          + '<td>$' + s.spend.toLocaleString() + '</td></tr>'
        ).join('') + '</tbody></table></div></div>'
      : '<div class="card"><div style="text-align:center;padding:20px;color:#94A3B8">No supplier data yet. Add purchase orders to see risk profiles.</div></div>');
}

function _kpiCard(label, value, color) {
  return '<div class="card" style="text-align:center">'
    + '<div style="font-size:26px;font-weight:800;color:' + color + '">' + value + '</div>'
    + '<div style="font-size:12px;color:#64748B;margin-top:4px">' + label + '</div>'
    + '</div>';
}

// ── AI Risk Assessment ────────────────────────────────────
export async function aiRiskAssessment() {
  const settings    = getSettings();
  const poData      = getPOData();
  const invoiceData = getInvoiceData();
  const signals     = detectDistressSignals();
  const apiKey      = settings.anthropicKey;
  const panelEl     = document.getElementById('risk-ai-panel');

  if (!panelEl) { return; }
  panelEl.style.display = 'block';
  panelEl.innerHTML = '<div style="text-align:center;padding:20px"><div class="loading-dots"><span></span><span></span><span></span></div><div style="font-size:13px;color:#64748B;margin-top:8px">AI is analysing your procurement risk profile...</div></div>';

  if (!apiKey) {
    const fallback = _getFallbackRiskAssessment(signals);
    panelEl.innerHTML = fallback; return;
  }

  const context = `Analyse this procurement risk profile and provide a concise executive risk summary with 3 top recommendations:
Active signals: ${signals.length}
High-risk signals: ${signals.filter(s=>s.type==='danger').length}
Signal details: ${signals.map(s=>s.label+': '+s.value).join(', ')||'none'}
Total active POs: ${poData.filter(p=>p.status!=='Draft').length}
Overdue invoices: ${invoiceData.filter(i=>i.status==='Overdue').length}
Company: ${settings.companyName}
Budget: $${settings.monthlyBudget}`;

  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: apiKey, messages: [{ role: 'user', content: context }] })
    });
    const data = await resp.json();
    panelEl.innerHTML = '<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:16px">'
      + '<div style="font-size:14px;font-weight:700;color:#1D4ED8;margin-bottom:8px">🤖 AI Risk Assessment</div>'
      + '<div style="font-size:13px;color:#1e40af;line-height:1.8">' + (data.content || '').replace(/\n/g,'<br>') + '</div></div>';
  } catch(e) {
    panelEl.innerHTML = _getFallbackRiskAssessment(signals);
  }
}

function _getFallbackRiskAssessment(signals) {
  const high = signals.filter(s => s.type === 'danger');
  return '<div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:16px">'
    + '<div style="font-size:14px;font-weight:700;color:#C2410C;margin-bottom:8px">🤖 Risk Assessment (Offline Mode)</div>'
    + '<div style="font-size:13px;color:#7C2D12;line-height:1.8">'
    + (high.length
      ? '<strong>High priority actions:</strong><br>' + high.map(s => '• ' + s.label + ': ' + s.desc).join('<br>') + '<br><br>'
      : '<strong>No critical risks detected.</strong><br>')
    + 'For a full AI-powered assessment with personalised recommendations, add your Anthropic API key in Settings.</div></div>';
}
