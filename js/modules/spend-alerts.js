// ============================================================
// SPEND ALERTS MODULE
// ============================================================

import { getSettings, getPOData, getReqData, getInvoiceData } from '../store.js';

export function renderSpendAlerts() {
  const settings    = getSettings();
  const poData      = getPOData();
  const reqData     = getReqData();
  const invoiceData = getInvoiceData();
  const el = document.getElementById('spend-alerts-content');
  if (!el) return;

  const activePOs = poData.filter(p => p.status !== 'Draft' && p.status !== 'Closed');
  const spent     = activePOs.reduce((s, p) => s + p.amount, 0);
  const budget    = settings.monthlyBudget || 25000;
  const pct       = Math.min(100, Math.round(spent / budget * 100));
  const remaining = budget - spent;

  const alerts = [];

  // Budget threshold alerts
  if (pct >= 100) {
    alerts.push({ type:'danger', icon:'🚨', title:'Budget Exceeded', desc:'You have exceeded your monthly budget of $' + budget.toLocaleString() + '. All new purchases require director approval.', action:'settings', actionLabel:'Adjust Budget' });
  } else if (pct >= 90) {
    alerts.push({ type:'danger', icon:'🔴', title:'Budget 90%+ Used', desc:'$' + spent.toLocaleString() + ' spent of $' + budget.toLocaleString() + ' budget. Only $' + remaining.toLocaleString() + ' remaining — limit non-essential purchases.', action:'analytics', actionLabel:'View Spend' });
  } else if (pct >= 75) {
    alerts.push({ type:'warning', icon:'🟡', title:'Budget 75%+ Used', desc:'$' + spent.toLocaleString() + ' spent. ' + remaining.toLocaleString() + ' remaining. Review pending requisitions before approving more.', action:'analytics', actionLabel:'View Analytics' });
  }

  // Overdue invoices
  const overdueInvs = invoiceData.filter(i => {
    if (!i.dueDate || i.status === 'Paid' || i.status === 'Disputed') return false;
    return new Date(i.dueDate) < new Date();
  });
  if (overdueInvs.length) {
    const overdueTotal = overdueInvs.reduce((s, i) => s + (i.amount || 0), 0);
    alerts.push({ type:'danger', icon:'💳', title:overdueInvs.length + ' Overdue Invoice' + (overdueInvs.length > 1 ? 's' : ''), desc:'Total overdue: $' + overdueTotal.toLocaleString() + '. Late payments may incur penalty interest and damage supplier relationships.', action:'invoices', actionLabel:'Pay Now' });
  }

  // Pending requisitions > 3 days old
  const pendingReqs = reqData.filter(r => {
    if (r.status !== 'Pending Approval') return false;
    const ageMs = Date.now() - new Date(r.date).getTime();
    return ageMs > 3 * 24 * 60 * 60 * 1000;
  });
  if (pendingReqs.length) {
    alerts.push({ type:'warning', icon:'📋', title:pendingReqs.length + ' Stale Requisition' + (pendingReqs.length > 1 ? 's' : ''), desc:'Requisitions pending approval for over 3 days. Delays slow down procurement.', action:'requisitions', actionLabel:'Review' });
  }

  // High-value POs without PO number pattern (might be missing references)
  const largeDraft = poData.filter(p => p.status === 'Draft' && p.amount > 5000);
  if (largeDraft.length) {
    alerts.push({ type:'warning', icon:'📝', title:largeDraft.length + ' Large Draft PO' + (largeDraft.length > 1 ? 's' : ''), desc:'High-value draft POs over $5,000 are sitting unsubmitted. Submit or discard to keep your data clean.', action:'purchase-orders', actionLabel:'Review' });
  }

  // All clear
  if (alerts.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:40px">'
      + '<div style="font-size:48px;margin-bottom:12px">✅</div>'
      + '<div style="font-size:18px;font-weight:700;color:#16A34A;margin-bottom:8px">All Clear!</div>'
      + '<div style="font-size:14px;color:#64748B">No active spend alerts. Your procurement is tracking well.</div>'
      + '</div>';
    return;
  }

  el.innerHTML = '<div style="margin-bottom:16px">'
    + alerts.map(a => '<div style="border:1px solid ' + (a.type==='danger'?'#FECACA':'#FDE68A') + ';background:' + (a.type==='danger'?'#FFF5F5':'#FFFBEB') + ';border-radius:10px;padding:16px;margin-bottom:10px;display:flex;gap:14px;align-items:flex-start">'
      + '<div style="font-size:28px;flex-shrink:0">' + a.icon + '</div>'
      + '<div style="flex:1">'
      + '<div style="font-size:14px;font-weight:700;color:' + (a.type==='danger'?'#991B1B':'#78350F') + '">' + a.title + '</div>'
      + '<div style="font-size:13px;color:' + (a.type==='danger'?'#7F1D1D':'#713F12') + ';margin-top:4px">' + a.desc + '</div>'
      + '</div>'
      + '<button class="btn btn-outline btn-sm" style="flex-shrink:0" onclick="showView(\'' + a.action + '\')">' + a.actionLabel + '</button>'
      + '</div>'
    ).join('')
    + '</div>'
    + '<div class="card"><div class="card-title">Budget Utilisation</div>'
    + '<div style="display:flex;justify-content:space-between;font-size:13px;color:#64748B;margin-bottom:8px"><span>$' + spent.toLocaleString() + ' spent</span><span>$' + budget.toLocaleString() + ' budget</span></div>'
    + '<div style="background:#E2E8F0;border-radius:6px;height:12px;overflow:hidden">'
    + '<div style="background:' + (pct>=100?'#DC2626':pct>=75?'#F59E0B':'#16A34A') + ';height:100%;width:' + pct + '%;border-radius:6px;transition:width 0.4s"></div></div>'
    + '<div style="font-size:12px;color:#64748B;margin-top:6px">' + pct + '% used · $' + remaining.toLocaleString() + ' remaining</div>'
    + '</div>';
}
