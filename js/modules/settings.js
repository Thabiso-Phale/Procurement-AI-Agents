// ============================================================
// SETTINGS MODULE
// ============================================================

import { getSettings, updateSettings, clearAll, load, save, resetToDefaults } from '../store.js';
import { toast, populateCurrencySelects } from '../utils.js';
import { hasFeature, currentPlan, applyLicenseUI, PLAN_LIMITS } from '../features.js';
import { showView } from '../router.js';

// ── Read form values → settings object ───────────────────
function _readSettingsForm() {
  const f = (id) => (document.getElementById(id) || {value:''}).value;
  return {
    userName:           f('set-username'),
    companyName:        f('set-company'),
    companyAddress:     f('set-address'),
    companyPhone:       f('set-phone'),
    companyEmail:       f('set-email'),
    companyWebsite:     f('set-website'),
    companyRegNo:       f('set-reg'),
    monthlyBudget:      parseFloat(f('set-budget'))       || 25000,
    currency:           f('set-currency'),
    primaryApprover:    f('set-approver'),
    autoApproveLimit:   parseFloat(f('set-auto-approve')) || 500,
    rfqThreshold:       parseFloat(f('set-rfq-threshold'))|| 2500,
    directorThreshold:  parseFloat(f('set-dir-threshold'))|| 10000,
    anthropicKey:       f('set-api-key')
  };
}

export function saveSettings() {
  const updates = _readSettingsForm();
  updateSettings(updates);
  applySettings();
  toast('✅ Settings saved successfully!');
}

export function applySettings() {
  const settings = getSettings();
  // Write values back to form (idempotent — safe to call on init)
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('set-username',      settings.userName);
  set('set-company',       settings.companyName);
  set('set-address',       settings.companyAddress);
  set('set-phone',         settings.companyPhone);
  set('set-email',         settings.companyEmail);
  set('set-website',       settings.companyWebsite);
  set('set-reg',           settings.companyRegNo);
  set('set-budget',        settings.monthlyBudget);
  set('set-currency',      settings.currency);
  set('set-approver',      settings.primaryApprover);
  set('set-auto-approve',  settings.autoApproveLimit);
  set('set-rfq-threshold', settings.rfqThreshold);
  set('set-dir-threshold', settings.directorThreshold);
  set('set-api-key',       settings.anthropicKey);
  // Logo preview
  const logoPreview = document.getElementById('logo-preview');
  if (logoPreview) logoPreview.src = settings.companyLogo || '';
  const logoWrap = document.getElementById('logo-preview-wrap');
  if (logoWrap) logoWrap.style.display = settings.companyLogo ? 'block' : 'none';
  // Company name in topbar
  const companyEl = document.getElementById('company-name-display');
  if (companyEl) companyEl.textContent = settings.companyName || 'ProjectBuys';
  // Currency selects
  populateCurrencySelects();
}

// ── Logo handling ─────────────────────────────────────────
export function handleLogoUpload(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  if (!hasFeature('custom_logo')) {
    toast('🔒 Custom branding is available on Grow and Team plans. Upgrade to personalise your documents.');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    updateSettings({ companyLogo: e.target.result });
    const logoPreview = document.getElementById('logo-preview');
    if (logoPreview) logoPreview.src = e.target.result;
    const logoWrap = document.getElementById('logo-preview-wrap');
    if (logoWrap) logoWrap.style.display = 'block';
    toast('✅ Company logo updated! It will appear on all your documents.');
  };
  reader.readAsDataURL(file);
}

export function removeLogo() {
  updateSettings({ companyLogo: '' });
  const logoPreview = document.getElementById('logo-preview');
  if (logoPreview) logoPreview.src = '';
  const logoWrap = document.getElementById('logo-preview-wrap');
  if (logoWrap) logoWrap.style.display = 'none';
  toast('Logo removed.');
}

// ── API Key ───────────────────────────────────────────────
export function toggleKeyVisibility() {
  const input = document.getElementById('set-api-key');
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

export function clearAPIKey() {
  const input = document.getElementById('set-api-key');
  if (input) input.value = '';
  updateSettings({ anthropicKey: '' });
  toast('API key cleared.');
}

export async function testAPIConnection() {
  const settings = getSettings();
  const key = (document.getElementById('set-api-key') || {value:''}).value.trim() || settings.anthropicKey;
  if (!key) { toast('Please enter your Anthropic API key first.'); return; }
  const statusEl = document.getElementById('api-test-status');
  if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Testing connection...'; statusEl.style.color = '#64748B'; }
  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, messages: [{ role:'user', content:'Respond with only "OK".' }] })
    });
    const data = await resp.json();
    if (data.content || data.id) {
      if (statusEl) { statusEl.textContent = '✅ Connection successful!'; statusEl.style.color = '#16A34A'; }
      updateSettings({ anthropicKey: key });
      toast('✅ API key verified and saved!');
    } else {
      if (statusEl) { statusEl.textContent = '✕ Invalid key or API error: ' + (data.error || 'Unknown error'); statusEl.style.color = '#DC2626'; }
    }
  } catch(e) {
    if (statusEl) { statusEl.textContent = '✕ Network error — check your internet connection'; statusEl.style.color = '#DC2626'; }
  }
}

// ── License ───────────────────────────────────────────────
export function validateAndActivateLicense() {
  const email = (document.getElementById('lic-email') || {value:''}).value.trim();
  const key   = (document.getElementById('lic-key')   || {value:''}).value.trim();
  if (!email || !key) { toast('Please enter both email and license key.'); return; }
  const licStatusEl = document.getElementById('lic-status');
  if (licStatusEl) { licStatusEl.textContent = 'Validating...'; licStatusEl.style.color = '#64748B'; }
  setTimeout(() => {
    const plan = key.startsWith('GROW') ? 'grow' : key.startsWith('TEAM') ? 'team' : null;
    if (!plan) {
      if (licStatusEl) { licStatusEl.textContent = '✕ Invalid license key. Check your purchase email.'; licStatusEl.style.color = '#DC2626'; }
      return;
    }
    updateSettings({ license: { plan, email, key } });
    applyLicenseUI();
    updatePricingButtons();
    if (licStatusEl) { licStatusEl.textContent = '✅ ' + plan.charAt(0).toUpperCase() + plan.slice(1) + ' plan activated!'; licStatusEl.style.color = '#16A34A'; }
    toast('🎉 ' + plan.charAt(0).toUpperCase() + plan.slice(1) + ' plan activated! Enjoy your upgraded features.');
  }, 1200);
}

export function deactivateLicense() {
  updateSettings({ license: { plan:'free', email:'', key:'' } });
  applyLicenseUI();
  updatePricingButtons();
  toast('License deactivated. Reverted to Free plan.');
}

// ── Pricing buttons ───────────────────────────────────────
export function updatePricingButtons() {
  const plan = currentPlan();
  ['free','grow','team'].forEach(p => {
    const btn = document.getElementById('pricing-btn-' + p);
    if (!btn) return;
    if (p === plan) {
      btn.textContent = '✅ Current Plan'; btn.disabled = true; btn.className = 'btn btn-outline';
    } else if (p === 'free') {
      btn.textContent = 'Downgrade'; btn.disabled = false; btn.className = 'btn btn-outline';
    } else {
      btn.textContent = 'Upgrade to ' + p.charAt(0).toUpperCase() + p.slice(1);
      btn.disabled = false; btn.className = 'btn btn-primary';
    }
  });
}

// ── Data management ───────────────────────────────────────
export function exportFullBackup() {
  const data = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    data: {
      settings: getSettings(),
      storage: {}
    }
  };
  // Pull all known keys from localStorage
  ['procureai_po','procureai_req','procureai_rfq','procureai_invoices',
   'procureai_inventory','procureai_contracts','procureai_approval_history'].forEach(k => {
    const v = localStorage.getItem(k);
    if (v) data.data.storage[k] = JSON.parse(v);
  });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'projectbuys_backup_' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('💾 Full backup exported!');
}

export function importBackup(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const backup = JSON.parse(e.target.result);
      if (!backup.data) throw new Error('Invalid backup format');
      if (backup.data.settings) {
        localStorage.setItem('procureai_settings', JSON.stringify(backup.data.settings));
      }
      if (backup.data.storage) {
        Object.entries(backup.data.storage).forEach(([k, v]) => {
          localStorage.setItem(k, JSON.stringify(v));
        });
      }
      load();
      applySettings();
      applyLicenseUI();
      toast('✅ Backup restored successfully! Refreshing data...');
      setTimeout(() => window.location.reload(), 800);
    } catch(err) {
      toast('✕ Invalid backup file. Please use a ProjectBuys backup JSON.');
    }
  };
  reader.readAsText(file);
}

export function clearAllData() {
  const confirmed = window.confirm(
    '⚠ This will permanently delete ALL your data including POs, invoices, contracts and settings.\n\nThis action cannot be undone. Are you absolutely sure?'
  );
  if (!confirmed) return;
  const doubleConfirm = window.confirm('Last chance — are you sure you want to delete everything?');
  if (!doubleConfirm) return;
  clearAll();
  resetToDefaults();
  applySettings();
  applyLicenseUI();
  toast('🗑 All data cleared. Starting fresh.');
  showView('dashboard');
  setTimeout(() => window.location.reload(), 500);
}

// ── Welcome banner ────────────────────────────────────────
export function showWelcomeBanner() {
  const settings = getSettings();
  if (settings.userName || localStorage.getItem('procureai_welcome_dismissed')) return;
  const el = document.getElementById('welcome-banner');
  if (el) el.style.display = 'block';
}

export function dismissWelcome() {
  localStorage.setItem('procureai_welcome_dismissed', '1');
  const el = document.getElementById('welcome-banner');
  if (el) el.style.display = 'none';
}
