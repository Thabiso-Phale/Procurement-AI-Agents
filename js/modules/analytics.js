// ============================================================
// ANALYTICS MODULE
// ============================================================

import { getPOData, getInvoiceData } from '../store.js';
import { toast } from '../utils.js';

let _chartsBuilt = false;

// ── Export helper (generic CSV) ───────────────────────────
export function exportCSV(rows, cols, filename) {
  const header = cols.join(',');
  const lines  = rows.map(r => r.map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(','));
  const blob   = new Blob([header + '\n' + lines.join('\n')], { type: 'text/csv' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast('📥 ' + filename + ' downloaded!');
}

// ── Spend by supplier (for analytics tables) ──────────────
export function renderAnalyticsTables() {
  const poData = getPOData();
  const invoiceData = getInvoiceData();

  // Top suppliers by PO spend
  const bySupplier = {};
  poData.filter(p => p.status !== 'Draft').forEach(p => {
    if (!bySupplier[p.supplier]) bySupplier[p.supplier] = { total:0, count:0 };
    bySupplier[p.supplier].total += p.amount;
    bySupplier[p.supplier].count += 1;
  });
  const supplierRows = Object.entries(bySupplier)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10);
  const maxSpend = supplierRows.length ? supplierRows[0][1].total : 1;

  const suppTbody = document.getElementById('analytics-supplier-tbody');
  if (suppTbody) {
    suppTbody.innerHTML = supplierRows.map(([name, d]) => {
      const pct = Math.round(d.total / maxSpend * 100);
      return '<tr><td><strong>' + name + '</strong></td>'
        + '<td><strong>$' + d.total.toLocaleString() + '</strong></td>'
        + '<td>' + d.count + ' POs</td>'
        + '<td><div style="background:#E2E8F0;border-radius:4px;height:8px;overflow:hidden"><div style="background:#0D2B5E;height:100%;width:' + pct + '%"></div></div></td>'
        + '</tr>';
    }).join('') || '<tr><td colspan="4" style="text-align:center;color:#94A3B8;padding:20px">No purchase order data yet</td></tr>';
  }

  // Monthly spend
  const byMonth = {};
  poData.filter(p => p.status !== 'Draft').forEach(p => {
    const m = (p.date || '').substring(0, 7);
    if (m) { if (!byMonth[m]) byMonth[m] = 0; byMonth[m] += p.amount; }
  });
  const monthRows = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
  const monthTbody = document.getElementById('analytics-monthly-tbody');
  if (monthTbody) {
    monthTbody.innerHTML = monthRows.map(([m, total]) =>
      '<tr><td>' + m + '</td><td><strong>$' + total.toLocaleString() + '</strong></td>'
      + '<td>' + poData.filter(p => (p.date||'').startsWith(m)).length + ' POs</td></tr>'
    ).join('') || '<tr><td colspan="3" style="text-align:center;color:#94A3B8;padding:20px">No monthly data yet</td></tr>';
  }

  // Category breakdown
  const byCat = {};
  poData.filter(p => p.status !== 'Draft').forEach(p => {
    const c = p.category || 'Other';
    if (!byCat[c]) byCat[c] = 0; byCat[c] += p.amount;
  });
  const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const catTbody = document.getElementById('analytics-category-tbody');
  if (catTbody) {
    catTbody.innerHTML = catRows.map(([cat, total]) =>
      '<tr><td>' + cat + '</td><td><strong>$' + total.toLocaleString() + '</strong></td></tr>'
    ).join('') || '<tr><td colspan="2" style="text-align:center;color:#94A3B8;padding:20px">No category data yet</td></tr>';
  }
}

// ── Charts (built once, guard with flag) ─────────────────
export function renderCharts() {
  if (_chartsBuilt) return;
  if (typeof Chart === 'undefined') return;
  const poData      = getPOData();
  const invoiceData = getInvoiceData();

  // Monthly spend line chart
  const byMonth = {};
  poData.filter(p => p.status !== 'Draft').forEach(p => {
    const m = (p.date || '').substring(0, 7);
    if (m) { if (!byMonth[m]) byMonth[m] = 0; byMonth[m] += p.amount; }
  });
  const months = Object.keys(byMonth).sort().slice(-6);
  const spendVals = months.map(m => byMonth[m]);

  const spendCtx = document.getElementById('spend-chart');
  if (spendCtx) {
    new Chart(spendCtx.getContext('2d'), {
      type: 'line',
      data: {
        labels: months,
        datasets: [{
          label: 'Monthly Spend',
          data: spendVals,
          borderColor: '#0D2B5E',
          backgroundColor: 'rgba(13,43,94,0.08)',
          fill: true, tension: 0.4, pointRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { callback: v => '$' + v.toLocaleString() } } }
      }
    });
  }

  // Category pie chart
  const byCat = {};
  poData.filter(p => p.status !== 'Draft').forEach(p => {
    const c = p.category || 'Other';
    if (!byCat[c]) byCat[c] = 0; byCat[c] += p.amount;
  });
  const catLabels = Object.keys(byCat);
  const catData   = Object.values(byCat);
  const catColors = ['#0D2B5E','#1D4ED8','#3B82F6','#60A5FA','#93C5FD','#BFDBFE','#6366F1','#A78BFA'];

  const catCtx = document.getElementById('category-chart');
  if (catCtx && catLabels.length) {
    new Chart(catCtx.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: catLabels,
        datasets: [{ data: catData, backgroundColor: catColors.slice(0, catLabels.length) }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right' } }
      }
    });
  }

  // Supplier bar chart
  const bySupplier = {};
  poData.filter(p => p.status !== 'Draft').forEach(p => {
    if (!bySupplier[p.supplier]) bySupplier[p.supplier] = 0;
    bySupplier[p.supplier] += p.amount;
  });
  const supEntries = Object.entries(bySupplier).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const supCtx = document.getElementById('supplier-chart');
  if (supCtx && supEntries.length) {
    new Chart(supCtx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: supEntries.map(([n]) => n),
        datasets: [{ label: 'Spend', data: supEntries.map(([,v]) => v), backgroundColor: '#1D4ED8', borderRadius: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => '$' + v.toLocaleString() } },
          x: { ticks: { maxRotation: 30 } }
        }
      }
    });
  }

  _chartsBuilt = true;
}

export function resetCharts() { _chartsBuilt = false; }
