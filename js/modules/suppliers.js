// ============================================================
// SUPPLIERS / ONBOARDING MODULE
// ============================================================

import { getSettings } from '../store.js';
import { toast } from '../utils.js';
import { hasFeature, supplierLimit } from '../features.js';
import { showView } from '../router.js';

let _currentStep = 1;
let _currentSupplierForm = {};

// ── Step navigation ───────────────────────────────────────
export function validateStep(step) {
  if (step === 1) {
    const name = (document.getElementById('ob-name') || {value:''}).value.trim();
    const cat  = (document.getElementById('ob-category') || {value:''}).value;
    const errN = document.getElementById('err-ob-name');
    const errC = document.getElementById('err-ob-cat');
    if (errN) errN.style.display = name ? 'none' : 'block';
    if (errC) errC.style.display = cat  ? 'none' : 'block';
    return !!(name && cat);
  }
  if (step === 2) {
    const contact = (document.getElementById('ob-contact') || {value:''}).value.trim();
    const email   = (document.getElementById('ob-email') || {value:''}).value.trim();
    const errCon  = document.getElementById('err-ob-contact');
    const errEm   = document.getElementById('err-ob-email');
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (errCon) errCon.style.display = contact ? 'none' : 'block';
    if (errEm)  errEm.style.display  = (email && emailRx.test(email)) ? 'none' : 'block';
    return !!(contact && email && emailRx.test(email));
  }
  return true;
}

export function goStep(n) {
  if (n > _currentStep && !validateStep(_currentStep)) return;
  _currentStep = n;
  for (let i = 1; i <= 4; i++) {
    const stepEl = document.getElementById('ob-step-' + i);
    if (stepEl) stepEl.style.display = i === n ? 'block' : 'none';
  }
  _updateStepIndicators(n);
}

function _updateStepIndicators(n) {
  for (let i = 1; i <= 4; i++) {
    const ind = document.getElementById('ob-ind-' + i);
    if (!ind) continue;
    if (i < n)       { ind.className = 'step-dot step-done'; }
    else if (i === n){ ind.className = 'step-dot step-active'; }
    else             { ind.className = 'step-dot'; }
  }
}

export function startNewSupplier() {
  _currentStep = 1;
  _currentSupplierForm = {};
  const formEls = ['ob-name','ob-category','ob-contact','ob-email','ob-phone','ob-website','ob-address','ob-reg','ob-payment-terms','ob-currency','ob-notes'];
  formEls.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  goStep(1);
  showView('onboarding');
}

export function simulateUpload() {
  const area = document.getElementById('ob-upload-area');
  if (!area) return;
  area.innerHTML = '<div style="color:#16A34A;font-size:13px;font-weight:600">✅ 3 documents uploaded successfully<br>'
    + '<span style="font-weight:400;font-size:12px">Trade Registration, Tax Clearance, Bank Letter</span></div>';
}

export function approveSupplier() {
  const name = (document.getElementById('ob-name') || {value:'Unknown'}).value.trim() || 'Supplier';
  toast('🎉 ' + name + ' has been successfully onboarded and added to your supplier directory!');
  showView('suppliers');
}

export function checkSupplierLimit() {
  const limit     = supplierLimit();
  const suppliers = document.querySelectorAll('.supplier-card, #supplier-list .card');
  const current   = suppliers ? suppliers.length : 0;
  const btnEl     = document.getElementById('ob-add-supplier-btn');
  if (!btnEl) return;
  if (current >= limit) {
    btnEl.disabled = true;
    btnEl.title    = 'Upgrade to add more suppliers. Your plan allows ' + limit + '.';
    btnEl.innerHTML = '🔒 Upgrade to Add More';
  } else {
    btnEl.disabled = false;
    btnEl.innerHTML = '+ Add New Supplier';
  }
}

// ── AI supplier scouting ──────────────────────────────────
export function scoutSuppliers() {
  const category = (document.getElementById('scout-category') || {value:''}).value;
  const location = (document.getElementById('scout-location') || {value:''}).value;
  const budget   = (document.getElementById('scout-budget')   || {value:''}).value;
  const resultsEl = document.getElementById('scout-results');
  if (!resultsEl) return;
  if (!category) { toast('Please select a category first.'); return; }
  resultsEl.innerHTML = '<div style="text-align:center;padding:20px;color:#64748B"><div class="loading-dots"><span></span><span></span><span></span></div><div style="margin-top:8px;font-size:13px">AI is scouting suppliers for ' + category + '...</div></div>';
  const settings = getSettings();
  const apiKey   = settings.anthropicKey;
  if (!apiKey) {
    setTimeout(() => { resultsEl.innerHTML = _getFallbackScoutResults(category, location); }, 1200);
    return;
  }
  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({
      key: apiKey,
      messages: [{
        role: 'user',
        content: 'I need supplier recommendations for ' + category
          + (location ? ' in ' + location : '')
          + (budget ? ' with a budget of ' + budget : '')
          + '. Provide 4 supplier options with company name, description, estimated pricing, lead time, and rating (out of 5). Format as structured cards.'
      }]
    })
  })
  .then(r => r.json())
  .then(data => { resultsEl.innerHTML = _formatAIScoutResults(data.content || '', category); })
  .catch(() => { resultsEl.innerHTML = _getFallbackScoutResults(category, location); });
}

function _getFallbackScoutResults(category, location) {
  const suppliers = {
    'IT Equipment':     [['TechEquip Solutions','Verified supplier · Global IT hardware · Avg price $800–$2,400','★★★★☆','14 days'],['CompuPro Ltd','Fast delivery · Online configurator · VAT invoices','★★★★★','7 days']],
    'Office Supplies':  [['Office Depot Pro','Leading office supplier · Next-day delivery available','★★★★★','3 days'],['Staples Business','Volume discounts · Wide range · Easy account portal','★★★★☆','2 days']],
    'Software/SaaS':    [['CloudServ Partners','Top-rated SaaS reseller · Licence management · 24/7 support','★★★★★','Immediate'],['SoftwareDirect','Competitive pricing · Annual billing savings · Multi-seat','★★★★☆','Immediate']],
    'Logistics/Freight':[['GlobalShip Logistics','International freight · Customs expertise · Door-to-door','★★★☆☆','5–10 days'],['FastFreight Co','Express delivery · Real-time tracking · API integration','★★★★☆','1–3 days']]
  };
  const rows = suppliers[category] || [['Contact local trade directory','No specific suppliers in database for this category','—','—']];
  return '<div style="font-size:13px;color:#475569;margin-bottom:12px">🤖 AI Scouting results for <strong>' + category + '</strong>' + (location ? ' in <strong>' + location + '</strong>' : '') + ':</div>'
    + rows.map(([name,desc,rating,lead]) =>
      '<div style="border:1px solid #E2E8F0;border-radius:8px;padding:14px;margin-bottom:10px;background:#fff">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start">'
      + '<div><div style="font-weight:700;color:#0D2B5E;font-size:14px">' + name + '</div>'
      + '<div style="font-size:12px;color:#64748B;margin-top:4px">' + desc + '</div></div>'
      + '<div style="text-align:right;font-size:12px"><div style="color:#F59E0B">' + rating + '</div><div style="color:#94A3B8;margin-top:2px">Lead: ' + lead + '</div></div>'
      + '</div>'
      + '<button class="btn btn-outline btn-sm" style="margin-top:10px" onclick="startNewSupplier()">+ Onboard This Supplier</button>'
      + '</div>'
    ).join('');
}

function _formatAIScoutResults(text, category) {
  if (!text) return _getFallbackScoutResults(category, '');
  return '<div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:10px;padding:16px;font-size:13px;color:#14532D;line-height:1.8">'
    + '<div style="font-weight:700;margin-bottom:8px">🤖 AI Supplier Scout Results:</div>'
    + text.replace(/\n/g, '<br>') + '</div>';
}
