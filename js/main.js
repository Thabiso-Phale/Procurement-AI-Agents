// ============================================================
// MAIN ENTRY POINT
// ProcureAI — ES6 module orchestrator
// ============================================================

// ── Store ─────────────────────────────────────────────────
import { load as storeLoad, getSettings } from './store.js';

// ── Utils / Features ──────────────────────────────────────
import { toast, populateCurrencySelects } from './utils.js';
import { applyLicenseUI } from './features.js';

// ── Router ────────────────────────────────────────────────
import { showView, toggleSidebar, closeSidebar, printPage, initRouter } from './router.js';

// ── Domain modules ────────────────────────────────────────
import { renderDashboard }                                              from './modules/dashboard.js';
import { renderRiskWatch, aiRiskAssessment, detectDistressSignals }     from './modules/risk-watch.js';
import {
  renderPOTable, filterPOs, searchPOs, viewPO,
  openApprove, confirmApprove, openReject, confirmReject, closeModal,
  submitPOById, addLineItem, removeLine, calcTotals, onSupplierSelect,
  validatePO, submitPO, saveDraft, suggestApproverHint,
  exportPOs, generatePOPDF, resetCreatePOForm, statusBadge
} from './modules/po.js';
import {
  renderReqTable, filterReqs, searchReqs, viewReq,
  approveReq, rejectReq, convertReqToPO, convertReqToRFQ,
  nextReqNumber, validateReq, checkReqBudget,
  submitRequisition, saveReqDraft, reqAISuggest
} from './modules/requisitions.js';
import {
  renderRFQTable, viewRFQ, sendRFQ, awardRFQ, createPOFromRFQ,
  nextRFQNumber, rfqStatusBadge, supplierScores
} from './modules/rfq.js';
import {
  runPriceComparison, quickCompare,
  createPOFromComparison, createRFQFromComparison
} from './modules/price-comparison.js';
import {
  renderInvoiceTable, filterInvoices, searchInvoices,
  markAsPaid, disputeInvoice, viewInvoice,
  ciCalcDue, ciCalcTax, ciAutoFill, saveInvoice,
  ciApplyComplianceHint, checkInvoiceCompliance, getJurisdictionInfo,
  exportInvoices, exportSpendReport,
  triggerInvoiceScan, onInvoiceScanFileSelected, applyScannedInvoiceData
} from './modules/invoices.js';
import {
  renderInventoryTable, filterInventory,
  reorderItem, saveInventoryItem, buildAlertBanner, editInventoryItem
} from './modules/inventory.js';
import {
  renderContractsTable, contractStatusBadge, acCalcRenewal, saveContract,
  viewContract, renewContract
} from './modules/contracts.js';
import {
  validateStep, goStep, startNewSupplier,
  simulateUpload, approveSupplier, checkSupplierLimit, scoutSuppliers
} from './modules/suppliers.js';
import {
  renderCharts, renderAnalyticsTables, exportCSV, resetCharts
} from './modules/analytics.js';
import { sendChat, fillPrompt, aiKeyPress }                            from './modules/ai.js';
import {
  showSetupWizard, wizardNext, wizardBack, wizardFinish,
  selectWzOpt, updateWzDots
} from './modules/setup-wizard.js';
import {
  saveSettings, applySettings, handleLogoUpload, removeLogo,
  toggleKeyVisibility, clearAPIKey, testAPIConnection,
  validateAndActivateLicense, deactivateLicense,
  updatePricingButtons, exportFullBackup, importBackup,
  clearAllData, showWelcomeBanner, dismissWelcome
} from './modules/settings.js';
import { renderSpendAlerts }                                           from './modules/spend-alerts.js';

// ── Circular-dependency bridge ────────────────────────────
// risk-watch imports dashboard helpers; dashboard accesses detectDistressSignals
// via window._rwModule to break the cycle.
window._rwModule = { detectDistressSignals };

// ── View-change side-effects ──────────────────────────────
function _onViewChange(id) {
  // Step banner (show on multi-step create forms, hide elsewhere)
  const stepBanner = document.getElementById('step-banner');
  if (stepBanner) stepBanner.style.display = ['create-po','create-requisition','create-rfq','onboarding'].includes(id) ? 'block' : 'none';

  // Per-view renders and form resets
  switch (id) {
    case 'dashboard':       renderDashboard();           break;
    case 'purchase-orders': renderPOTable();              break;
    case 'create-po':       resetCreatePOForm();          break;
    case 'requisitions':    renderReqTable();             break;
    case 'rfq':             renderRFQTable();             break;
    case 'price-comparison':renderAnalyticsTables();      break;
    case 'invoices':        renderInvoiceTable();         break;
    case 'inventory':       renderInventoryTable(); buildAlertBanner(); break;
    case 'contracts':       renderContractsTable();       break;
    case 'analytics':       renderCharts(); renderAnalyticsTables(); break;
    case 'risk-watch':      renderRiskWatch();            break;
    case 'spend-alerts':    renderSpendAlerts();          break;
  }
}

// Wrap router's showView to inject side-effects
const _routerShowView = showView;
function _showViewWithHooks(id) {
  _routerShowView(id);
  _onViewChange(id);
}

// ── Expose ALL public APIs on window ─────────────────────
// (required for inline onclick= handlers in index.html)
Object.assign(window, {
  // Router
  showView:              _showViewWithHooks,
  toggleSidebar,
  closeSidebar,
  printPage,

  // Dashboard (no direct calls needed — rendered automatically)

  // PO module
  renderPOTable, filterPOs, searchPOs, viewPO,
  openApprove, confirmApprove, openReject, confirmReject, closeModal,
  submitPOById, addLineItem, removeLine, calcTotals, onSupplierSelect,
  validatePO, submitPO, saveDraft, suggestApproverHint,
  exportPOs, generatePOPDF, resetCreatePOForm,

  // Requisitions
  renderReqTable, filterReqs, searchReqs, viewReq,
  approveReq, rejectReq, convertReqToPO, convertReqToRFQ,
  validateReq, checkReqBudget, submitRequisition, saveReqDraft, reqAISuggest,

  // RFQ
  renderRFQTable, viewRFQ, sendRFQ, awardRFQ, createPOFromRFQ,

  // Price comparison
  runPriceComparison, quickCompare, createPOFromComparison, createRFQFromComparison,

  // Invoices
  renderInvoiceTable, filterInvoices, searchInvoices,
  markAsPaid, disputeInvoice, viewInvoice,
  ciCalcDue, ciCalcTax, ciAutoFill, saveInvoice,
  ciApplyComplianceHint, checkInvoiceCompliance, getJurisdictionInfo,
  exportInvoices, exportSpendReport,
  triggerInvoiceScan, onInvoiceScanFileSelected, applyScannedInvoiceData,

  // Inventory
  renderInventoryTable, filterInventory, reorderItem, saveInventoryItem,
  editInventoryItem,

  // Contracts
  renderContractsTable, acCalcRenewal, saveContract, viewContract, renewContract,

  // Suppliers
  validateStep, goStep, startNewSupplier,
  simulateUpload, approveSupplier, checkSupplierLimit, scoutSuppliers,

  // Analytics
  renderCharts, renderAnalyticsTables, resetCharts,
  exportCSV,

  // AI
  sendChat, fillPrompt, aiKeyPress,
  aiRiskAssessment,

  // Setup wizard
  showSetupWizard, wizardNext, wizardBack, wizardFinish,
  selectWzOpt, updateWzDots,

  // Settings
  saveSettings, applySettings, handleLogoUpload, removeLogo,
  toggleKeyVisibility, clearAPIKey, testAPIConnection,
  validateAndActivateLicense, deactivateLicense,
  updatePricingButtons, exportFullBackup, importBackup,
  clearAllData, showWelcomeBanner, dismissWelcome,

  // Spend alerts
  renderSpendAlerts,

  // Toast (global convenience)
  toast
});


// ── Feedback modal ────────────────────────────────────────
window.openFeedbackModal = function() {
  document.getElementById('modal-feedback').classList.add('open');
};
window.closeFeedbackModal = function() {
  const modal = document.getElementById('modal-feedback');
  modal.classList.remove('open');
  modal.querySelectorAll('.fb-check').forEach(cb => { cb.checked = false; });
  document.getElementById('fb-other-text').value = '';
  document.getElementById('fb-other-group').style.display = 'none';
};
window.toggleFeedbackOther = function() {
  const show = document.getElementById('fb-other-check').checked;
  document.getElementById('fb-other-group').style.display = show ? 'block' : 'none';
};
window.submitFeedback = function() {
  const checked = [...document.querySelectorAll('#feedback-categories .fb-check:checked')].map(cb => cb.value);
  const otherText = document.getElementById('fb-other-text').value.trim();
  if (!checked.length) { alert('Please select at least one feedback area.'); return; }
  const entry = { timestamp: new Date().toISOString(), categories: checked, otherText };
  const all = JSON.parse(localStorage.getItem('procureai_feedback') || '[]');
  all.push(entry);
  localStorage.setItem('procureai_feedback', JSON.stringify(all));
  const cats = checked.join(', ');
  const body = `Feedback areas: ${cats}${otherText ? '\n\nAdditional details:\n' + otherText : ''}\n\n----\nBeta user feedback`;
  const subject = `ProcureAI Feedback: ${cats}`;
  window.location.href = `mailto:support@procure-flow.net?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.closeFeedbackModal();
};

// ── Initialisation sequence ───────────────────────────────
function init() {
  // 1. Load persisted state
  storeLoad();

  // 2. Apply settings to UI (form values, currency selects, logo)
  applySettings();

  // 3. Apply licence / plan gating
  applyLicenseUI();
  updatePricingButtons();

  // 4. Wire router nav items
  initRouter();

  // 5. Populate currency selects (done inside applySettings too, but explicit here)
  populateCurrencySelects();

  // 6. Initial view render (dashboard)
  _showViewWithHooks('dashboard');

  // 7. Welcome banner (only shown to brand-new users)
  showWelcomeBanner();

  // 8. Check if setup wizard should run (first launch, no company name)
  const settings = getSettings();
  if (!settings.companyName && !localStorage.getItem('procureai_welcome_dismissed')) {
    setTimeout(showSetupWizard, 400);
  }

  // 9. File input handler for invoice scanner
  const scanInput = document.getElementById('invoice-scan-file');
  if (scanInput) {
    scanInput.addEventListener('change', onInvoiceScanFileSelected);
  }

  // 10. File input handler for backup restore
  const backupInput = document.getElementById('import-backup-file');
  if (backupInput) {
    backupInput.addEventListener('change', importBackup);
  }

  // 11. File input handler for logo upload
  const logoInput = document.getElementById('logo-upload-input');
  if (logoInput) {
    logoInput.addEventListener('change', handleLogoUpload);
  }
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
