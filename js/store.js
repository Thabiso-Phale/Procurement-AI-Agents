// ============================================================
// STORE — single source of truth for all application state
// ============================================================

const SK = {
  settings: 'procureai_settings',
  po:       'procureai_po',
  req:      'procureai_req',
  rfq:      'procureai_rfq',
  invoices: 'procureai_invoices',
  inventory:'procureai_inventory',
  contracts:'procureai_contracts',
  approvalHistory: 'procureai_approval_history'
};

const DEFAULT_SETTINGS = {
  userName: '',
  companyName: 'Acme Trading Co',
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
  companyWebsite: '',
  companyRegNo: '',
  companyLogo: '',
  monthlyBudget: 25000,
  currency: 'USD',
  primaryApprover: 'Sarah M – Manager',
  autoApproveLimit: 500,
  rfqThreshold: 2500,
  directorThreshold: 10000,
  anthropicKey: '',
  license: { plan: 'free', email: '', key: '' }
};

// Mutable state — only accessible through exported helpers
let _state = {
  settings: { ...DEFAULT_SETTINGS },
  poData: [],
  reqData: [],
  rfqData: [],
  invoiceData: [],
  inventoryData: [],
  contractData: [],
  approvalHistory: []
};

let _saveTimer = null;

// ── Subscribers ───────────────────────────────────────────
const _listeners = [];

export function subscribe(fn) {
  _listeners.push(fn);
}

function _notify() {
  _listeners.forEach(fn => fn(_state));
}

// ── Read ──────────────────────────────────────────────────
export function getState() { return _state; }

// Convenience getters — avoids coupling modules to state shape
export function getSettings()       { return _state.settings; }
export function getPOData()         { return _state.poData; }
export function getReqData()        { return _state.reqData; }
export function getRFQData()        { return _state.rfqData; }
export function getInvoiceData()    { return _state.invoiceData; }
export function getInventoryData()  { return _state.inventoryData; }
export function getContractData()   { return _state.contractData; }
export function getApprovalHistory(){ return _state.approvalHistory; }

// ── Write ─────────────────────────────────────────────────
export function setPOData(data)       { _state.poData = data;         _scheduleSave(); _notify(); }
export function setReqData(data)      { _state.reqData = data;        _scheduleSave(); _notify(); }
export function setRFQData(data)      { _state.rfqData = data;        _scheduleSave(); _notify(); }
export function setInvoiceData(data)  { _state.invoiceData = data;    _scheduleSave(); _notify(); }
export function setInventoryData(data){ _state.inventoryData = data;  _scheduleSave(); _notify(); }
export function setContractData(data) { _state.contractData = data;   _scheduleSave(); _notify(); }
export function setApprovalHistory(data){ _state.approvalHistory = data; _scheduleSave(); _notify(); }

export function updateSettings(partial) {
  Object.assign(_state.settings, partial);
  _scheduleSave();
  _notify();
}

// ── Persistence ───────────────────────────────────────────

function _scheduleSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(save, 300);
}

export function save() {
  try {
    localStorage.setItem(SK.settings,        JSON.stringify(_state.settings));
    localStorage.setItem(SK.po,              JSON.stringify(_state.poData));
    localStorage.setItem(SK.req,             JSON.stringify(_state.reqData));
    localStorage.setItem(SK.rfq,             JSON.stringify(_state.rfqData));
    localStorage.setItem(SK.invoices,        JSON.stringify(_state.invoiceData));
    localStorage.setItem(SK.inventory,       JSON.stringify(_state.inventoryData));
    localStorage.setItem(SK.contracts,       JSON.stringify(_state.contractData));
    localStorage.setItem(SK.approvalHistory, JSON.stringify(_state.approvalHistory));
  } catch (e) {
    console.warn('ProcureAI: storage write failed', e);
  }
}

export function load() {
  try {
    const s = localStorage.getItem(SK.settings);
    if (s) Object.assign(_state.settings, JSON.parse(s));

    const po  = localStorage.getItem(SK.po);         if (po)   _state.poData         = JSON.parse(po);
    const req = localStorage.getItem(SK.req);         if (req)  _state.reqData         = JSON.parse(req);
    const rfq = localStorage.getItem(SK.rfq);         if (rfq)  _state.rfqData         = JSON.parse(rfq);
    const inv = localStorage.getItem(SK.invoices);    if (inv)  _state.invoiceData      = JSON.parse(inv);
    const ivt = localStorage.getItem(SK.inventory);   if (ivt)  _state.inventoryData    = JSON.parse(ivt);
    const ctr = localStorage.getItem(SK.contracts);   if (ctr)  _state.contractData     = JSON.parse(ctr);
    const ah  = localStorage.getItem(SK.approvalHistory); if (ah) _state.approvalHistory = JSON.parse(ah);
  } catch (e) {
    console.warn('ProcureAI: storage load failed', e);
  }
}

export function clearAll() {
  Object.values(SK).forEach(key => { try { localStorage.removeItem(key); } catch (e) {} });
  try { localStorage.removeItem('procureai_welcomed'); } catch (e) {}
}

export function resetToDefaults() {
  _state = {
    settings: { ...DEFAULT_SETTINGS },
    poData: [],
    reqData: [],
    rfqData: [],
    invoiceData: [],
    inventoryData: [],
    contractData: [],
    approvalHistory: []
  };
}
