// ============================================================
// FEATURES — plan/license gates
// ============================================================

import { getSettings, updateSettings } from './store.js';

export const PLAN_LIMITS = {
  free: { suppliers: 3,   label: 'Free',  color: '#64748B' },
  grow: { suppliers: 25,  label: 'Grow',  color: '#1D4ED8' },
  team: { suppliers: 999, label: 'Team',  color: '#7C3AED' }
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
  return PLAN_LIMITS[currentPlan()].suppliers;
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
}
