// ============================================================
// UTILS — pure helper functions with no side effects
// ============================================================

import { getSettings, getPOData, getReqData } from './store.js';

// ── Currency ──────────────────────────────────────────────
const CURRENCY_SYMBOLS = {
  // Americas
  USD:'$', CAD:'CA$', MXN:'MX$', BRL:'R$', ARS:'$', CLP:'$', COP:'$', PEN:'S/', UYU:'$U',
  // Europe
  EUR:'€', GBP:'£', CHF:'Fr', NOK:'kr', SEK:'kr', DKK:'kr', PLN:'zł', CZK:'Kč',
  HUF:'Ft', RON:'lei', BGN:'лв', HRK:'kn', RSD:'din', ISK:'kr', UAH:'₴', TRY:'₺',
  // Africa
  ZAR:'R', NGN:'₦', KES:'KSh', GHS:'GH₵', EGP:'E£', MAD:'MAD', TZS:'TSh', UGX:'USh',
  ETB:'Br', XOF:'CFA', XAF:'FCFA', ZMW:'ZK', MWK:'MK', MZN:'MT', AOA:'Kz', BWP:'P',
  // Middle East
  AED:'د.إ', SAR:'﷼', QAR:'﷼', KWD:'KD', BHD:'BD', OMR:'﷼', JOD:'JD', ILS:'₪',
  // Asia Pacific
  JPY:'¥', CNY:'¥', INR:'₹', KRW:'₩', SGD:'S$', HKD:'HK$', TWD:'NT$', IDR:'Rp',
  THB:'฿', MYR:'RM', PHP:'₱', VND:'₫', PKR:'₨', BDT:'৳', LKR:'Rs', NPR:'Rs',
  MMK:'K', AUD:'A$', NZD:'NZ$'
};

export function getCurrencySymbol(cur) {
  return CURRENCY_SYMBOLS[cur] || '$';
}

export function formatMoney(amount, currency) {
  const sym = getCurrencySymbol(currency || getSettings().currency || 'USD');
  return sym + Number(amount).toLocaleString();
}

// ── Stock status ──────────────────────────────────────────
export function stockStatus(stock, threshold) {
  if (stock <= 0)                         return 'Out of Stock';
  if (stock < threshold * 0.5)            return 'Critical';
  if (stock < threshold)                  return 'Low';
  return 'OK';
}

// Checks if a reorder request or PO is already active for an item
export function isReorderInFlight(itemName) {
  const reqs = getReqData();
  const pos  = getPOData();
  const name = itemName.toLowerCase();
  const activeReq = reqs.some(r =>
    r.item.toLowerCase().includes(name) &&
    (r.status === 'Pending Approval' || r.status === 'Approved')
  );
  const activePO = pos.some(p =>
    p.desc.toLowerCase().includes(name) &&
    (p.status === 'Approved' || p.status === 'Sent' || p.status === 'Pending Approval')
  );
  return activeReq || activePO;
}

// ── Toast notification ────────────────────────────────────
let _toastTimer = null;
export function toast(msg, duration = 3000) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// ── DOM shorthand ─────────────────────────────────────────
export function el(id) { return document.getElementById(id); }

// ── Action item HTML builder (shared by Dashboard + Risk Watch) ──
export function buildActionItemsHtml(actions) {
  if (!actions.length) {
    return '<li class="action-item">'
      + '<div class="action-dot info"></div>'
      + '<div style="flex:1"><div class="action-text"><strong>All clear!</strong> Nothing urgent right now.</div>'
      + '<div class="action-time">Great job staying on top of your procurement.</div></div></li>';
  }
  return actions.map(a =>
    '<li class="action-item">'
    + '<div class="action-dot ' + a.p + '"></div>'
    + '<div style="flex:1"><div class="action-text">' + a.t + '</div><div class="action-time">' + a.s + '</div></div>'
    + '<button class="action-btn" onclick="showView(\'' + a.v + '\')">' + a.b + '</button>'
    + '</li>'
  ).join('');
}

// ── Date helpers ──────────────────────────────────────────
export function daysDiff(dateStr) {
  const due   = new Date(dateStr);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((due - today) / (1000 * 60 * 60 * 24));
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export function futureDateISO(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

// ── Number formatting ─────────────────────────────────────
export function nextSeqId(prefix, existing, padLength = 3) {
  const nums = existing.map(x => parseInt(x.id.split('-').pop()) || 0);
  const max  = nums.length ? Math.max(...nums) : 0;
  return prefix + (max + 1).toString().padStart(padLength, '0');
}

// ── Currency select population ────────────────────────────
const CURRENCY_OPTIONS_HTML = `
<optgroup label="Americas">
  <option value="USD">USD – US Dollar</option>
  <option value="CAD">CAD – Canadian Dollar</option>
  <option value="MXN">MXN – Mexican Peso</option>
  <option value="BRL">BRL – Brazilian Real</option>
  <option value="ARS">ARS – Argentine Peso</option>
  <option value="CLP">CLP – Chilean Peso</option>
  <option value="COP">COP – Colombian Peso</option>
  <option value="PEN">PEN – Peruvian Sol</option>
</optgroup>
<optgroup label="Europe">
  <option value="EUR">EUR – Euro</option>
  <option value="GBP">GBP – British Pound</option>
  <option value="CHF">CHF – Swiss Franc</option>
  <option value="NOK">NOK – Norwegian Krone</option>
  <option value="SEK">SEK – Swedish Krona</option>
  <option value="DKK">DKK – Danish Krone</option>
  <option value="PLN">PLN – Polish Zloty</option>
  <option value="CZK">CZK – Czech Koruna</option>
  <option value="HUF">HUF – Hungarian Forint</option>
  <option value="RON">RON – Romanian Leu</option>
  <option value="TRY">TRY – Turkish Lira</option>
  <option value="UAH">UAH – Ukrainian Hryvnia</option>
</optgroup>
<optgroup label="Africa">
  <option value="ZAR">ZAR – South African Rand</option>
  <option value="NGN">NGN – Nigerian Naira</option>
  <option value="KES">KES – Kenyan Shilling</option>
  <option value="GHS">GHS – Ghanaian Cedi</option>
  <option value="EGP">EGP – Egyptian Pound</option>
  <option value="MAD">MAD – Moroccan Dirham</option>
  <option value="TZS">TZS – Tanzanian Shilling</option>
  <option value="UGX">UGX – Ugandan Shilling</option>
  <option value="ETB">ETB – Ethiopian Birr</option>
  <option value="XOF">XOF – West African CFA Franc</option>
  <option value="XAF">XAF – Central African CFA Franc</option>
  <option value="ZMW">ZMW – Zambian Kwacha</option>
  <option value="BWP">BWP – Botswana Pula</option>
  <option value="AOA">AOA – Angolan Kwanza</option>
</optgroup>
<optgroup label="Middle East">
  <option value="AED">AED – UAE Dirham</option>
  <option value="SAR">SAR – Saudi Riyal</option>
  <option value="QAR">QAR – Qatari Riyal</option>
  <option value="KWD">KWD – Kuwaiti Dinar</option>
  <option value="BHD">BHD – Bahraini Dinar</option>
  <option value="OMR">OMR – Omani Rial</option>
  <option value="JOD">JOD – Jordanian Dinar</option>
  <option value="ILS">ILS – Israeli Shekel</option>
</optgroup>
<optgroup label="Asia Pacific">
  <option value="JPY">JPY – Japanese Yen</option>
  <option value="CNY">CNY – Chinese Yuan</option>
  <option value="INR">INR – Indian Rupee</option>
  <option value="KRW">KRW – South Korean Won</option>
  <option value="SGD">SGD – Singapore Dollar</option>
  <option value="HKD">HKD – Hong Kong Dollar</option>
  <option value="TWD">TWD – Taiwan Dollar</option>
  <option value="IDR">IDR – Indonesian Rupiah</option>
  <option value="THB">THB – Thai Baht</option>
  <option value="MYR">MYR – Malaysian Ringgit</option>
  <option value="PHP">PHP – Philippine Peso</option>
  <option value="VND">VND – Vietnamese Dong</option>
  <option value="PKR">PKR – Pakistani Rupee</option>
  <option value="BDT">BDT – Bangladeshi Taka</option>
  <option value="AUD">AUD – Australian Dollar</option>
  <option value="NZD">NZD – New Zealand Dollar</option>
</optgroup>`;

// All select IDs that need currency options
const CURRENCY_SELECT_IDS = ['ob-currency','wz-currency','po-currency','req-currency',
                              'rfq-currency','pc-currency','ci-currency','st-currency','set-currency'];

export function populateCurrencySelects() {
  const selected = getSettings().currency || 'USD';
  CURRENCY_SELECT_IDS.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = CURRENCY_OPTIONS_HTML;
    sel.value = selected;
  });
}
