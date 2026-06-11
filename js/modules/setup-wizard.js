// ============================================================
// SETUP WIZARD MODULE
// ============================================================

import { getSettings, updateSettings } from '../store.js';
import { populateCurrencySelects } from '../utils.js';
import { showView } from '../router.js';
import { applySettings } from './settings.js';
import { toast } from '../utils.js';

let _wzStep      = 1;
const _WZ_TOTAL  = 4;

export function showSetupWizard() {
  const overlay = document.getElementById('wizard-overlay');
  if (overlay) overlay.style.display = 'flex';
  _wzStep = 1;
  _renderWzStep(1);
  updateWzDots(1);
}

export function wizardNext() {
  if (!_validateWzStep(_wzStep)) return;
  _saveWzStep(_wzStep);
  if (_wzStep < _WZ_TOTAL) {
    _wzStep++;
    _renderWzStep(_wzStep);
    updateWzDots(_wzStep);
  } else {
    wizardFinish();
  }
}

export function wizardBack() {
  if (_wzStep > 1) {
    _wzStep--;
    _renderWzStep(_wzStep);
    updateWzDots(_wzStep);
  }
}

export function wizardFinish() {
  _saveWzStep(_wzStep);
  const overlay = document.getElementById('wizard-overlay');
  if (overlay) overlay.style.display = 'none';
  applySettings();
  toast('🎉 Setup complete! Welcome to ProcureAI.');
  showView('dashboard');
}

export function selectWzOpt(el, group) {
  document.querySelectorAll('[data-wz-group="' + group + '"]').forEach(o => o.classList.remove('wz-opt-selected'));
  el.classList.add('wz-opt-selected');
  el.dataset.wzSelected = '1';
}

export function updateWzDots(step) {
  for (let i = 1; i <= _WZ_TOTAL; i++) {
    const dot = document.getElementById('wz-dot-' + i);
    if (!dot) continue;
    dot.className = 'wz-dot' + (i < step ? ' done' : i === step ? ' active' : '');
  }
  const prev = document.getElementById('wz-prev-btn');
  const next = document.getElementById('wz-next-btn');
  if (prev) prev.style.display = step === 1 ? 'none' : 'inline-flex';
  if (next) next.textContent   = step === _WZ_TOTAL ? 'Finish Setup 🎉' : 'Next →';
  const stepLabel = document.getElementById('wz-step-label');
  if (stepLabel) stepLabel.textContent = 'Step ' + step + ' of ' + _WZ_TOTAL;
}

function _validateWzStep(step) {
  if (step === 1) {
    const name = (document.getElementById('wz-company') || {value:''}).value.trim();
    if (!name) { toast('Please enter your company name to continue.'); return false; }
  }
  return true;
}

function _saveWzStep(step) {
  if (step === 1) {
    updateSettings({
      companyName:    (document.getElementById('wz-company')  || {value:''}).value.trim(),
      companyAddress: (document.getElementById('wz-address')  || {value:''}).value.trim(),
      companyPhone:   (document.getElementById('wz-phone')    || {value:''}).value.trim(),
      companyEmail:   (document.getElementById('wz-biz-email')|| {value:''}).value.trim()
    });
  }
  if (step === 2) {
    updateSettings({
      currency:     (document.getElementById('wz-currency')    || {value:'USD'}).value,
      monthlyBudget: parseFloat((document.getElementById('wz-monthly-budget') || {value:'25000'}).value) || 25000
    });
  }
  if (step === 3) {
    updateSettings({
      primaryApprover:   (document.getElementById('wz-approver')      || {value:''}).value.trim(),
      autoApproveLimit:  parseFloat((document.getElementById('wz-auto-approve') || {value:'500'}).value)  || 500,
      rfqThreshold:      parseFloat((document.getElementById('wz-rfq-threshold')|| {value:'2500'}).value) || 2500
    });
  }
  if (step === 4) {
    updateSettings({
      anthropicKey: (document.getElementById('wz-api-key') || {value:''}).value.trim()
    });
  }
}

function _renderWzStep(step) {
  const settings = getSettings();
  const body = document.getElementById('wizard-body');
  if (!body) return;
  if (step === 1) {
    body.innerHTML = '<div class="wz-field"><label>Company Name <span style="color:#DC2626">*</span></label>'
      + '<input id="wz-company" class="input" placeholder="e.g. Acme Trading Co" value="' + (settings.companyName || '') + '"></div>'
      + '<div class="wz-field"><label>Business Address</label>'
      + '<textarea id="wz-address" class="input" rows="2" placeholder="123 Main St, City, Country">' + (settings.companyAddress || '') + '</textarea></div>'
      + '<div class="wz-field"><label>Business Phone</label>'
      + '<input id="wz-phone" class="input" type="tel" placeholder="+1 555 000 0000" value="' + (settings.companyPhone || '') + '"></div>'
      + '<div class="wz-field"><label>Business Email</label>'
      + '<input id="wz-biz-email" class="input" type="email" placeholder="procurement@company.com" value="' + (settings.companyEmail || '') + '"></div>';
  } else if (step === 2) {
    body.innerHTML = '<div class="wz-field"><label>Primary Currency</label>'
      + '<select id="wz-currency" class="input"><option value="USD">USD — US Dollar</option><option value="GBP">GBP — British Pound</option><option value="EUR">EUR — Euro</option><option value="ZAR">ZAR — South African Rand</option><option value="NGN">NGN — Nigerian Naira</option><option value="KES">KES — Kenyan Shilling</option><option value="AED">AED — UAE Dirham</option><option value="AUD">AUD — Australian Dollar</option><option value="CAD">CAD — Canadian Dollar</option><option value="INR">INR — Indian Rupee</option></select></div>'
      + '<div class="wz-field"><label>Monthly Procurement Budget</label>'
      + '<input id="wz-monthly-budget" class="input" type="number" placeholder="25000" value="' + (settings.monthlyBudget || 25000) + '"></div>'
      + '<p style="font-size:12px;color:#64748B;margin-top:8px">💡 This sets your budget bar on the dashboard. You can change it anytime in Settings.</p>';
    const sel = document.getElementById('wz-currency');
    if (sel) sel.value = settings.currency || 'USD';
  } else if (step === 3) {
    body.innerHTML = '<div class="wz-field"><label>Primary Approver Name</label>'
      + '<input id="wz-approver" class="input" placeholder="e.g. Sarah M — Manager" value="' + (settings.primaryApprover || '') + '"></div>'
      + '<div class="wz-field"><label>Auto-approve limit (no approval needed below this amount)</label>'
      + '<input id="wz-auto-approve" class="input" type="number" placeholder="500" value="' + (settings.autoApproveLimit || 500) + '"></div>'
      + '<div class="wz-field"><label>RFQ threshold (require quotes above this amount)</label>'
      + '<input id="wz-rfq-threshold" class="input" type="number" placeholder="2500" value="' + (settings.rfqThreshold || 2500) + '"></div>'
      + '<p style="font-size:12px;color:#64748B;margin-top:8px">💡 These thresholds control when approvals and RFQs are triggered automatically.</p>';
  } else if (step === 4) {
    body.innerHTML = '<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;color:#1D4ED8">'
      + '🤖 <strong>Optional:</strong> Add your Anthropic API key to unlock live AI features — smart supplier scouting, risk assessment, and chat assistant. '
      + '<a href="https://console.anthropic.com" target="_blank" style="color:#1D4ED8;text-decoration:underline">Get your key at console.anthropic.com</a></div>'
      + '<div class="wz-field"><label>Anthropic API Key (optional)</label>'
      + '<input id="wz-api-key" class="input" type="password" placeholder="sk-ant-..." value="' + (settings.anthropicKey || '') + '"></div>'
      + '<p style="font-size:12px;color:#64748B">Your key is stored locally in your browser and never sent to our servers except for direct API calls.</p>';
  }
}
