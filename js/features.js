// ============================================================
// FEATURES — plan/license gates
// ============================================================

import { getSettings, updateSettings } from './store.js';

// -1 = unlimited
export const PLAN_LIMITS = {
  free: { suppliers: 3,  po: 5,  req: 5,  invoices: 5,  inventory: 10, label: 'Free',  color: '#64748B' },
  grow: { suppliers: 10, po: -1, req: -1, invoices: -1, inventory: -1, label: 'Grow',  color: '#1D4ED8' },
  team: { suppliers: -1, po: -1, req: -1, invoices: -1, inventory: -1, label: 'Team',  color: '#7C3AED' }
};

export function currentPlan() {
  const lic = getSettings().license;
  return (lic && lic.plan) || 'free';
}

export function hasFeature(f) {
  const p = currentPlan();
  if (f === 'unlimited_ai')  return p === 'grow' || p === 'team';
  if (f === 'pdf_export')    return p === 'grow' || p === 'team';
  if (f === 'rfq')           return p === 'grow' || p === 'team';
  if (f === 'risk_watch')    return p === 'grow' || p === 'team';
  if (f === 'contracts')     return p === 'grow' || p === 'team';
  if (f === 'team_features') return p === 'team';
  return true;
}

export function supplierLimit() {
  const p = currentPlan();
  const lim = PLAN_LIMITS[p].suppliers;
  return lim === -1 ? Infinity : lim;
}

const _recordLabels = { po: 'Purchase Orders', req: 'Requisitions', invoices: 'Invoices', inventory: 'Inventory items' };

export function checkRecordLimit(type, currentCount) {
  if (currentPlan() !== 'free') return true;
  const limit = PLAN_LIMITS.free[type];
  if (!limit || limit === -1) return true;
  if (currentCount >= limit) {
    _showUpgradeModal(
      _recordLabels[type] || type,
      'You\'ve reached the ' + limit + ' ' + (_recordLabels[type] || type) + ' limit on the Free plan.',
      'Upgrade to Grow for unlimited records, 10 suppliers, and full access to RFQ, Contracts &amp; Risk Watch.'
    );
    return false;
  }
  return true;
}

export function showFeatureUpgrade(featureLabel, benefit) {
  _showUpgradeModal(featureLabel, 'This feature requires the Grow plan.', benefit || 'Upgrade to unlock full access.');
}

function _showUpgradeModal(title, msg, detail) {
  const el    = document.getElementById('modal-upgrade');
  const ttl   = document.getElementById('modal-upgrade-title');
  const msgEl = document.getElementById('modal-upgrade-msg');
  const detEl = document.getElementById('modal-upgrade-detail');
  if (ttl)   ttl.textContent  = '🔒 ' + title;
  if (msgEl) msgEl.textContent = msg;
  if (detEl) detEl.textContent = detail || '';
  if (el)    el.classList.add('open');
}

export function applyLicenseUI() {
  const plan = currentPlan();
  const info = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const settings = getSettings();

  // Settings page: plan label + email
  const labelEl = document.getElementById('plan-label-settings');
  const emailEl = document.getElementById('plan-email-settings');
  if (labelEl) {
    labelEl.textContent = info.label;
    labelEl.style.color = info.color;
  }
  if (emailEl) {
    emailEl.textContent = settings.license && settings.license.email
      ? 'License email: ' + settings.license.email
      : '';
  }

  // Free/Grow/Team pricing page button state
  const freeBtn = document.getElementById('pricing-free-btn');
  const growBtn = document.getElementById('pricing-grow-btn');
  const teamBtn = document.getElementById('pricing-team-btn');
  if (freeBtn) { freeBtn.disabled = plan === 'free'; freeBtn.textContent = plan === 'free' ? '✓ Your Current Plan' : 'Downgrade to Free'; }
  if (growBtn) { growBtn.style.opacity = plan === 'grow' ? '0.6' : '1'; }
  if (teamBtn) { teamBtn.style.opacity = plan === 'team' ? '0.6' : '1'; }

  // Sidebar tier badge
  const tierLabel = document.getElementById('sb-tier-label');
  if (tierLabel) {
    const icons = { free: '🌱', grow: '🚀', team: '🏢' };
    tierLabel.textContent = (icons[plan] || '🌱') + ' ' + info.label + (plan === 'free' ? ' (Free)' : '');
  }

  // Logo upload area gating
  const isPaid = hasFeature('pdf_export');
  const freemsg    = document.getElementById('logo-free-msg');
  const uploadArea = document.getElementById('logo-upload-area');
  if (freemsg)    freemsg.style.display    = isPaid ? 'none' : 'block';
  if (uploadArea) uploadArea.style.display = isPaid ? 'block' : 'none';

  // Sidebar lock badges on gated nav items
  ['nav-rfq','nav-contracts','nav-risk-watch'].forEach(function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const badge = el.querySelector('.nav-lock');
    if (isPaid) {
      if (badge) badge.remove();
    } else {
      if (!badge) {
        const b = document.createElement('span');
        b.className = 'nav-lock';
        b.textContent = '🔒';
        b.style.cssText = 'margin-left:auto;font-size:11px;opacity:0.6';
        el.appendChild(b);
      }
    }
  });
}
