// ============================================================
// DASHBOARD MODULE
// ============================================================

import { getSettings, getPOData, getReqData, getRFQData, getInvoiceData, getInventoryData, getContractData } from '../store.js';
import { formatMoney, getCurrencySymbol, stockStatus, isReorderInFlight, buildActionItemsHtml } from '../utils.js';

// ── Analytical helpers (also used by Risk Watch) ──────────
export function calcSupplierConcentration() {
  const poData = getPOData();
  const totalSpend = poData.reduce((s, p) => s + (p.status === 'Draft' ? 0 : p.amount), 0);
  if (totalSpend === 0) return [];
  const sMap = {};
  poData.forEach(p => { if (p.status !== 'Draft') sMap[p.supplier] = (sMap[p.supplier] || 0) + p.amount; });
  return Object.keys(sMap)
    .map(n => ({ supplier: n, spend: sMap[n], pct: Math.round(sMap[n] / totalSpend * 100) }))
    .sort((a, b) => b.spend - a.spend);
}

export function detectPriceDrift() {
  const poData = getPOData();
  const sPos = {};
  poData.forEach(p => {
    if (!p.amount || p.status === 'Draft') return;
    if (!sPos[p.supplier]) sPos[p.supplier] = [];
    sPos[p.supplier].push({ amount: p.amount, date: p.date });
  });
  const drifts = [];
  Object.keys(sPos).forEach(sup => {
    const pos = sPos[sup].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (pos.length < 2) return;
    const latest = pos[0].amount;
    const avg = pos.slice(1).reduce((s, p) => s + p.amount, 0) / (pos.length - 1);
    if (!avg) return;
    const drift = Math.round((latest - avg) / avg * 100);
    if (drift >= 5) drifts.push({ supplier: sup, drift, latest, avg: Math.round(avg) });
  });
  return drifts;
}

// ── Main render ───────────────────────────────────────────
export function renderDashboard() {
  const settings    = getSettings();
  const poData      = getPOData();
  const reqData     = getReqData();
  const rfqData     = getRFQData();
  const invoiceData = getInvoiceData();
  const inventoryData = getInventoryData();
  const contractData  = getContractData();

  const now    = new Date();
  const h      = now.getHours();
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dateStr = now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
  const name    = settings.userName || 'there';
  const budget  = settings.monthlyBudget || 25000;
  const cur     = settings.currency || 'USD';
  const sym     = getCurrencySymbol(cur);

  const today       = new Date(); today.setHours(0, 0, 0, 0);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth  = now.getDate();
  const monthElapsed = Math.round(dayOfMonth / daysInMonth * 100);
  const monthName   = months[now.getMonth()] + ' ' + now.getFullYear();

  const spent     = poData.reduce((s, p) => s + (['Draft','Closed'].indexOf(p.status) === -1 ? p.amount : 0), 0);
  const remaining = budget - spent;
  const spentPct  = Math.round(spent / budget * 100);

  const pendingPOs   = poData.filter(p => p.status === 'Pending Approval');
  const overdueInvs  = invoiceData.filter(i => {
    if (i.status === 'Paid' || i.status === 'Disputed') return false;
    return new Date(i.dueDate) < today;
  });
  const pendingInvs  = invoiceData.filter(i => i.status === 'Pending Payment' && new Date(i.dueDate) >= today);
  const outOfStock   = inventoryData.filter(i => stockStatus(i.stock, i.threshold) === 'Out of Stock');
  const oosNoReorder = outOfStock.filter(i => !isReorderInFlight(i.name));
  const oosOnOrder   = outOfStock.filter(i => isReorderInFlight(i.name));
  const criticalStock = inventoryData.filter(i => stockStatus(i.stock, i.threshold) === 'Critical');
  const lowStock      = inventoryData.filter(i => stockStatus(i.stock, i.threshold) === 'Low');

  const imminentContracts = contractData.filter(c => {
    if (c.status === 'Draft') return false;
    const diff = Math.round((new Date(c.end) - today) / 864e5);
    return diff >= 0 && diff <= 30;
  });
  const upcomingContracts = contractData.filter(c => {
    if (c.status === 'Draft') return false;
    const diff = Math.round((new Date(c.end) - today) / 864e5);
    return diff > 30 && diff <= 90;
  });

  const activeSupplierNames = [];
  poData.forEach(p => {
    if (['Approved','Sent','Received'].indexOf(p.status) > -1 && !activeSupplierNames.includes(p.supplier))
      activeSupplierNames.push(p.supplier);
  });

  const urgentCount = pendingPOs.length + overdueInvs.length + oosNoReorder.length + imminentContracts.length;

  // ── Greeting ──────────────────────────────────────────────
  const grEl = document.getElementById('dash-greeting');
  if (grEl) grEl.textContent = greeting + ', ' + name + ' 👋';

  const subEl = document.getElementById('dash-subline');
  if (subEl) {
    const attText = urgentCount === 0 ? '✓ Everything looks good — nothing urgent right now'
      : urgentCount === 1 ? '1 thing needs your attention right now'
      : urgentCount + ' things need your attention right now';
    const attCol = urgentCount === 0 ? '#16A34A' : '#DC2626';
    subEl.innerHTML = 'Today is <strong>' + dateStr + '</strong> &nbsp;·&nbsp; <span style="color:' + attCol + ';font-weight:600">' + attText + '</span>';
  }

  // ── Urgent banner ─────────────────────────────────────────
  const urgentEl = document.getElementById('dash-urgent');
  if (urgentEl) {
    let uBody = '', uBtn = '', uView = 'purchase-orders';
    if (overdueInvs.length > 0) {
      const inv = overdueInvs[0];
      const dOver = Math.round((today - new Date(inv.dueDate)) / 864e5);
      uBody = '<div style="font-size:14px;font-weight:700;color:#991B1B;margin-bottom:4px">Most urgent: Invoice overdue — payment required now</div>'
        + '<div style="font-size:13px;color:#7F1D1D;line-height:1.6"><strong>' + inv.id + '</strong> — ' + inv.supplier + ' (' + sym + inv.total.toLocaleString() + ') is <strong>' + dOver + ' day' + (dOver === 1 ? '' : 's') + ' overdue</strong>.' + (inv.notes ? ' ' + inv.notes : '  Late payment damages your supplier relationship.') + '</div>';
      uBtn = 'Review & Pay →'; uView = 'invoices';
    } else if (pendingPOs.length > 0) {
      const po = pendingPOs[0];
      const dWait = Math.round((today - new Date(po.date)) / 864e5);
      uBody = '<div style="font-size:14px;font-weight:700;color:#991B1B;margin-bottom:4px">Most urgent: Purchase order waiting for your approval</div>'
        + '<div style="font-size:13px;color:#7F1D1D;line-height:1.6"><strong>' + po.id + '</strong> — ' + po.supplier + ' (' + sym + po.amount.toLocaleString() + ') has been waiting <strong>' + dWait + ' day' + (dWait === 1 ? '' : 's') + '</strong>. Your team cannot place this order until you approve it.</div>';
      uBtn = 'Review & Approve →'; uView = 'purchase-orders';
    } else if (oosNoReorder.length > 0) {
      const oos = oosNoReorder[0];
      uBody = '<div style="font-size:14px;font-weight:700;color:#991B1B;margin-bottom:4px">Most urgent: Item out of stock — reorder immediately</div>'
        + '<div style="font-size:13px;color:#7F1D1D;line-height:1.6"><strong>' + oos.name + '</strong> — 0 units remaining.' + (oos.notes ? ' ' + oos.notes : '') + '</div>';
      uBtn = 'Reorder Now →'; uView = 'inventory';
    } else if (imminentContracts.length > 0) {
      const ctr = imminentContracts[0];
      const cDays = Math.round((new Date(ctr.end) - today) / 864e5);
      uBody = '<div style="font-size:14px;font-weight:700;color:#991B1B;margin-bottom:4px">Most urgent: Contract expiring in ' + cDays + ' days</div>'
        + '<div style="font-size:13px;color:#7F1D1D;line-height:1.6"><strong>' + ctr.title + '</strong> with ' + ctr.supplier + '.' + (ctr.autoRenew ? ' It auto-renews — review terms and pricing before the deadline.' : " It does NOT auto-renew — you'll lose supply if you don't act.") + '</div>';
      uBtn = 'View Contract →'; uView = 'contracts';
    }
    if (uBody) {
      urgentEl.style.display = 'flex';
      urgentEl.innerHTML = '<span style="font-size:26px">🚨</span>'
        + '<div style="flex:1;min-width:200px">' + uBody + '</div>'
        + '<button class="btn btn-red" onclick="showView(\'' + uView + '\')">' + uBtn + '</button>';
    } else {
      urgentEl.style.display = 'none';
    }
  }

  // ── KPI cards ─────────────────────────────────────────────
  const remCard = document.getElementById('kpi-remaining-card');
  if (remCard) remCard.className = 'kpi ' + (remaining < 0 ? 'kpi-red' : remaining < budget * 0.2 ? 'kpi-yellow' : 'kpi-green');

  const remEl = document.getElementById('kpi-remaining');
  if (remEl) remEl.textContent = (remaining < 0 ? '-' : '') + sym + Math.abs(Math.round(remaining)).toLocaleString();

  const remSubEl = document.getElementById('kpi-remaining-sub');
  if (remSubEl) {
    const remPct = Math.max(0, 100 - spentPct);
    remSubEl.innerHTML = 'of ' + sym + budget.toLocaleString() + ' · ' + (remaining < 0 ? '<span style="color:#DC2626">' + remPct + '% OVER budget</span>' : remPct + '% remaining');
  }

  const spentEl = document.getElementById('kpi-spent');
  if (spentEl) spentEl.textContent = sym + Math.round(spent).toLocaleString();

  const spentPctEl = document.getElementById('kpi-spent-pct');
  if (spentPctEl) spentPctEl.textContent = spentPct + '% used · ' + dayOfMonth + ' of ' + daysInMonth + ' days';

  const pendEl = document.getElementById('kpi-pending');
  if (pendEl) pendEl.textContent = pendingPOs.length;

  const suppEl = document.getElementById('kpi-suppliers');
  if (suppEl) suppEl.textContent = activeSupplierNames.length;

  const suppSubEl = document.getElementById('kpi-suppliers-sub');
  if (suppSubEl) suppSubEl.textContent = activeSupplierNames.length === 0 ? 'No active orders yet' : 'Across ' + activeSupplierNames.length + ' active supplier' + (activeSupplierNames.length === 1 ? '' : 's');

  // ── Notification dot ──────────────────────────────────────
  const ndot = document.getElementById('notif-dot');
  if (ndot) {
    ndot.textContent = urgentCount;
    ndot.title = urgentCount + ' pending action' + (urgentCount === 1 ? '' : 's');
    ndot.style.display = urgentCount > 0 ? '' : 'none';
  }

  // ── Journey strip ─────────────────────────────────────────
  const journeyEl = document.getElementById('dash-journey');
  if (journeyEl) {
    const hasPO  = poData.some(p => p.status !== 'Draft');
    const hasRFQ = rfqData && rfqData.length > 0;
    const hasInv = invoiceData.length > 0;
    const hasReq = reqData && reqData.length > 0;

    let activeStep = 1;
    if (hasPO && (pendingPOs.length > 0 || poData.some(p => p.status === 'Approved' || p.status === 'Sent'))) activeStep = 4;
    else if (hasRFQ) activeStep = 3;
    else if (hasReq || hasPO) activeStep = 2;
    if (hasInv && (overdueInvs.length > 0 || pendingInvs.length > 0)) activeStep = 5;
    if (activeStep < 6 && spent > budget * 0.5 && overdueInvs.length === 0 && pendingPOs.length === 0) activeStep = 6;

    const steps = [
      {n:1,icon:'🏢',label:'Add a<br>Supplier',sub:'Add your suppliers',view:'onboarding'},
      {n:2,icon:'📝',label:'Raise a<br>Request',sub:'Request approval',view:'requisitions'},
      {n:3,icon:'📩',label:'Get<br>Quotes',sub:'Ask suppliers to bid',view:'rfq'},
      {n:4,icon:'📋',label:'Place the<br>Order',sub:'Create a PO',view:'purchase-orders'},
      {n:5,icon:'💳',label:'Pay the<br>Invoice',sub:'When goods arrive',view:'invoices'},
      {n:6,icon:'📊',label:'Track Your<br>Spend',sub:'See where money goes',view:'analytics'}
    ];

    journeyEl.innerHTML = steps.map(s => {
      const done = s.n < activeStep, curr = s.n === activeStep;
      const sty  = done ? 'background:#F0FDF4;border-bottom:3px solid #16A34A' : curr ? 'background:#EFF6FF;border-bottom:3px solid #3B82F6' : '';
      const nSty = done ? 'background:#16A34A;color:#fff' : curr ? 'background:#3B82F6;color:#fff' : '';
      const lSty = done ? 'color:#16A34A' : curr ? 'color:#1D4ED8' : '';
      const subHtml = done ? '<div class="journey-sub" style="color:#16A34A">Done ✓</div>'
        : curr ? '<div class="journey-sub" style="color:#3B82F6">You are here</div>'
        : '<div class="journey-sub">' + s.sub + '</div>';
      return '<div class="journey-step" style="' + sty + '" onclick="showView(\'' + s.view + '\')" title="Step ' + s.n + '">'
        + '<div class="journey-num" style="' + nSty + '">' + (done ? '✓' : s.n) + '</div>'
        + '<div class="journey-icon">' + s.icon + '</div>'
        + '<div class="journey-label" style="' + lSty + '">' + s.label + '</div>'
        + subHtml + '</div>';
    }).join('');
  }

  // ── Action list ───────────────────────────────────────────
  const actionEl = document.getElementById('dash-actions');
  if (actionEl) {
    const actions = [];

    overdueInvs.forEach(inv => {
      const dO = Math.round((today - new Date(inv.dueDate)) / 864e5);
      actions.push({p:'urgent',t:'<strong>Overdue invoice:</strong> '+inv.supplier+' — '+sym+inv.total.toLocaleString()+' is '+dO+' day'+(dO===1?'':'s')+' late',s:inv.notes||'Pay or dispute this invoice now to protect your supplier relationship',v:'invoices',b:'Review →'});
    });
    pendingPOs.forEach(po => {
      const dW = Math.round((today - new Date(po.date)) / 864e5);
      const isEscalated = dW >= 2;
      actions.push({
        p: isEscalated ? 'urgent' : 'warning',
        t: (isEscalated ? '<span style="color:#DC2626">🔴 ESCALATE</span> — ' : '') + '<strong>Approve ' + po.id + '</strong> — ' + po.supplier + ' ' + sym + po.amount.toLocaleString() + ' · ' + dW + ' day' + (dW === 1 ? '' : 's') + ' waiting',
        s: isEscalated ? 'Over 48 hours — approver should be chased immediately' : 'Your team is blocked until this is approved',
        v: 'purchase-orders', b: isEscalated ? 'Escalate →' : 'Approve →'
      });
    });
    oosNoReorder.forEach(item => {
      actions.push({p:'urgent',t:'<strong>Out of stock:</strong> '+item.name+' — 0 units remaining',s:item.notes||'Create a reorder request in one click',v:'inventory',b:'Reorder →'});
    });
    oosOnOrder.forEach(item => {
      actions.push({p:'info',t:'<strong>Out of stock — reorder in progress:</strong> '+item.name,s:'A reorder request or purchase order is already active for this item. Monitor delivery status.',v:'inventory',b:'View →'});
    });
    criticalStock.forEach(item => {
      actions.push({p:'warning',t:'<strong>Critical stock:</strong> '+item.name+' — '+item.stock+' of '+item.threshold+' minimum',s:'Below 50% of minimum threshold — reorder now',v:'inventory',b:'Reorder →'});
    });
    imminentContracts.forEach(c => {
      const cD = Math.round((new Date(c.end) - today) / 864e5);
      actions.push({p:'warning',t:'<strong>Contract expiring in '+cD+' days:</strong> '+c.supplier+(c.autoRenew?' (auto-renews)':''),s:'Compare prices before renewing — you may save money',v:'contracts',b:'Review →'});
    });
    pendingInvs.forEach(inv => {
      const dUntil = Math.round((new Date(inv.dueDate) - today) / 864e5);
      if (dUntil <= 7) actions.push({p:'warning',t:'<strong>Invoice due in '+dUntil+' day'+(dUntil===1?'':'s')+':</strong> '+inv.supplier+' — '+sym+inv.total.toLocaleString(),s:inv.discPct>0?'Early payment discount of '+inv.discPct+'% available — act before it expires':'Pay on time to maintain your supplier terms',v:'invoices',b:'Pay →'});
    });
    upcomingContracts.forEach(c => {
      const cD = Math.round((new Date(c.end) - today) / 864e5);
      actions.push({p:'info',t:'<strong>Contract renewal in '+cD+' days:</strong> '+c.supplier,s:'Run a price comparison now to be ready for renegotiation',v:'contracts',b:'View →'});
    });
    lowStock.forEach(item => {
      actions.push({p:'info',t:'<strong>Low stock:</strong> '+item.name+' — '+item.stock+' of '+item.threshold+' minimum',s:'Plan a reorder this week',v:'inventory',b:'Reorder →'});
    });

    const conc = calcSupplierConcentration();
    conc.forEach(s => {
      if (s.pct >= 60) actions.push({p:'warning',t:'<strong>Concentration risk:</strong> '+s.supplier+' represents <strong>'+s.pct+'%</strong> of your total spend',s:'Heavy reliance on one supplier is a business risk — consider qualifying an alternative',v:'suppliers',b:'Scout →'});
    });

    const drifts = detectPriceDrift();
    drifts.forEach(d => {
      actions.push({p:'warning',t:'<strong>Price drift +'+d.drift+'%:</strong> '+d.supplier+' — latest order '+sym+d.latest.toLocaleString()+' vs avg '+sym+d.avg.toLocaleString(),s:'Prices are trending up — compare alternatives before next order',v:'price-comparison',b:'Compare →'});
    });

    invoiceData.filter(i => i.status === 'Disputed').forEach(i => {
      actions.push({p:'urgent',t:'<strong>Disputed invoice:</strong> '+i.supplier+' — '+i.id+' ('+sym+i.total.toLocaleString()+')',s:'Unresolved disputes can halt future supply — resolve or escalate now',v:'invoices',b:'Resolve →'});
    });
    contractData.filter(c => c.status !== 'Draft' && new Date(c.end) < today).forEach(c => {
      actions.push({p:'urgent',t:'<strong>Contract expired:</strong> '+c.supplier+' — "'+c.title+'" — you may be buying without a valid agreement',s:'Renew or terminate immediately to restore legal protection',v:'contracts',b:'Renew →'});
    });

    const topFive = actions.slice(0, 5);
    actionEl.innerHTML = buildActionItemsHtml(topFive);
  }

  // ── Budget bar & forecast ──────────────────────────────────
  const barEl = document.getElementById('budget-bar');
  if (barEl) {
    barEl.className = 'budget-bar ' + (spentPct >= 100 ? 'red' : spentPct >= 75 ? 'yellow' : 'green');
    barEl.style.width = Math.min(100, spentPct) + '%';
  }

  const budHdrEl = document.getElementById('dash-budget-header');
  if (budHdrEl) budHdrEl.textContent = monthName + ' · ' + dayOfMonth + ' of ' + daysInMonth + ' days gone (' + monthElapsed + '% of month elapsed)';

  const budLblEl = document.getElementById('dash-budget-label');
  if (budLblEl) {
    const lCol = spentPct >= 100 ? '#DC2626' : spentPct >= 75 ? '#D97706' : '#16A34A';
    budLblEl.innerHTML = '<span>' + sym + '0</span><span style="font-weight:600;color:' + lCol + '">' + sym + Math.round(spent).toLocaleString() + ' spent</span><span>' + sym + budget.toLocaleString() + ' limit</span>';
  }

  const forecastEl = document.getElementById('dash-budget-forecast');
  if (forecastEl) {
    const projected = dayOfMonth > 0 ? Math.round(spent / dayOfMonth * daysInMonth) : spent;
    const overshoot = projected - budget;
    if (overshoot > 0) {
      forecastEl.style.cssText = 'background:#FEF9C3;border-radius:8px;padding:10px;font-size:12px;color:#92400E;margin-top:12px;line-height:1.6';
      forecastEl.innerHTML = '⚠ <strong>On current pace you\'ll overspend by ~' + sym + Math.round(overshoot).toLocaleString() + '.</strong> Review your largest spend categories to find savings before month end.';
    } else {
      forecastEl.style.cssText = 'background:#F0FDF4;border-radius:8px;padding:10px;font-size:12px;color:#166534;margin-top:12px;line-height:1.6';
      forecastEl.innerHTML = '✓ <strong>On track to finish ' + sym + Math.round(Math.abs(overshoot)).toLocaleString() + ' under budget.</strong> Keep spending at the current pace.';
    }
  }

  // ── Health score ──────────────────────────────────────────
  // Import detectDistressSignals lazily to avoid circular dep (risk-watch imports dashboard)
  let rwSignals = [];
  try { const rw = window._rwModule; if (rw) rwSignals = rw.detectDistressSignals(); } catch (e) {}

  let score = 100;
  score -= pendingPOs.length * 5;
  score -= overdueInvs.length * 15;
  score -= outOfStock.length * 10;
  score -= criticalStock.length * 5;
  score -= lowStock.length * 2;
  score -= imminentContracts.length * 8;
  if (spentPct > 100) score -= 20;
  else if (spentPct > 85) score -= 8;
  const concScore = calcSupplierConcentration();
  concScore.forEach(s => { if (s.pct >= 70) score -= 12; else if (s.pct >= 60) score -= 6; });
  const driftScore = detectPriceDrift();
  score -= driftScore.length * 4;
  const disputedCount = invoiceData.filter(i => i.status === 'Disputed').length;
  score -= disputedCount * 10;
  const expiredContracts = contractData.filter(c => c.status !== 'Draft' && new Date(c.end) < today).length;
  score -= expiredContracts * 8;
  score = Math.max(0, Math.min(100, score));

  const ringEl = document.getElementById('health-ring');
  if (ringEl) {
    ringEl.textContent = score;
    ringEl.className = 'health-ring ' + (score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red');
  }

  const hTitleEl = document.getElementById('dash-health-title');
  if (hTitleEl) hTitleEl.textContent = score >= 80 ? 'Good — things are running smoothly'
    : score >= 60 ? 'Attention needed — a few issues to resolve'
    : 'Action required — multiple urgent items outstanding';

  const insightEl = document.getElementById('ai-insight');
  if (insightEl) {
    const pts = [];
    if (pendingPOs.length > 0)    pts.push(pendingPOs.length + ' PO' + (pendingPOs.length > 1 ? 's' : '') + ' pending approval');
    if (overdueInvs.length > 0)   pts.push(overdueInvs.length + ' invoice' + (overdueInvs.length > 1 ? 's' : '') + ' overdue');
    if (oosNoReorder.length > 0)  pts.push(oosNoReorder.length + ' item' + (oosNoReorder.length > 1 ? 's' : '') + ' out of stock');
    if (oosOnOrder.length > 0)    pts.push(oosOnOrder.length + ' item' + (oosOnOrder.length > 1 ? 's' : '') + ' out of stock (reorder in progress)');
    if (criticalStock.length > 0) pts.push(criticalStock.length + ' item' + (criticalStock.length > 1 ? 's' : '') + ' critical stock');
    if (imminentContracts.length > 0) pts.push(imminentContracts.length + ' contract' + (imminentContracts.length > 1 ? 's' : '') + ' expiring within 30 days');
    if (spentPct > 100) pts.push('over budget by ' + sym + Math.abs(Math.round(remaining)).toLocaleString());
    insightEl.textContent = pts.length > 0 ? pts.join(' · ') : 'All systems healthy — no immediate action required.';
  }

  const factorsEl = document.getElementById('dash-health-factors');
  if (factorsEl) {
    const bOk = spentPct <= 90, aOk = pendingPOs.length === 0, iOk = overdueInvs.length === 0;
    const sOk = oosNoReorder.length === 0 && criticalStock.length === 0;
    const rwOk = rwSignals.length === 0;
    factorsEl.innerHTML = (bOk ? '🟢 Budget: OK' : '🔴 Budget: Over')
      + ' &nbsp;' + (aOk ? '🟢 Approvals: OK' : '🟡 Approvals: ' + pendingPOs.length + ' pending')
      + ' &nbsp;' + (iOk ? '🟢 Invoices: OK' : '🔴 Invoices: ' + overdueInvs.length + ' overdue')
      + ' &nbsp;' + (sOk ? '🟢 Stock: OK' : '🔴 Stock: alert')
      + ' &nbsp;' + (rwOk ? '🟢 Risk: Low' : '🔴 Risk: <span style="cursor:pointer;text-decoration:underline" onclick="showView(\'risk-watch\')">' + rwSignals.length + ' signal' + (rwSignals.length === 1 ? '' : 's') + '</span>');
  }

  // ── Supplier snapshot ─────────────────────────────────────
  const sgEl = document.getElementById('dash-supplier-grid');
  if (sgEl) {
    const sMap = {};
    poData.forEach(po => {
      if (!sMap[po.supplier]) sMap[po.supplier] = {name:po.supplier,spend:0,pos:0,statuses:[],cat:'Supplier'};
      sMap[po.supplier].spend += po.amount;
      sMap[po.supplier].pos++;
      sMap[po.supplier].statuses.push(po.status);
    });
    contractData.forEach(c => {
      if (!sMap[c.supplier]) sMap[c.supplier] = {name:c.supplier,spend:0,pos:0,statuses:[],cat:c.cat};
      else if (!sMap[c.supplier].cat || sMap[c.supplier].cat === 'Supplier') sMap[c.supplier].cat = c.cat;
    });

    const sList = Object.keys(sMap).map(name => {
      const sd = sMap[name];
      const hasOverdue  = overdueInvs.some(i => i.supplier === name);
      const hasExpiring = imminentContracts.some(c => c.supplier === name);
      const allDraft    = sd.statuses.length > 0 && sd.statuses.every(st => st === 'Draft');
      let badge, bCls;
      if (hasOverdue)      { badge = '🔴 Overdue Invoice'; bCls = 'badge-red'; }
      else if (hasExpiring){ badge = '⚠ Contract Expiring'; bCls = 'badge-yellow'; }
      else if (allDraft)   { badge = 'Onboarding'; bCls = 'badge-purple'; }
      else                 { badge = 'On Track'; bCls = 'badge-green'; }
      let sc = 80;
      if (hasOverdue)  sc -= 20;
      if (hasExpiring) sc -= 10;
      if (allDraft)    sc = 60;
      if (sd.pos >= 3) sc = Math.min(98, sc + 5);
      sc = Math.max(40, Math.min(98, sc));
      return {name, cat: sd.cat, badge, bCls, score: sc, spend: sd.spend, draft: allDraft};
    });

    sList.sort((a, b) => {
      const rank = {'badge-red':0,'badge-yellow':1,'badge-purple':2,'badge-green':3};
      const ra = rank[a.bCls] || 3, rb = rank[b.bCls] || 3;
      return ra !== rb ? ra - rb : b.spend - a.spend;
    });

    sgEl.innerHTML = sList.map(s => {
      const barCls = s.score >= 80 ? '' : s.score >= 60 ? ' yellow' : ' red';
      return '<div class="supplier-card">'
        + '<div class="supplier-card-name">' + s.name + '</div>'
        + '<div class="supplier-card-cat">' + s.cat + '</div>'
        + '<span class="badge ' + s.bCls + '">' + s.badge + '</span>'
        + '<div class="supplier-score-bar"><div class="supplier-score-fill' + barCls + '" style="width:' + s.score + '%"></div></div>'
        + '<div class="score-row"><span>' + (s.draft ? 'Setup' : 'Score') + '</span><strong>' + (s.draft ? s.score + '% done' : s.score + '/100') + '</strong></div>'
        + '</div>';
    }).join('');
  }
}
