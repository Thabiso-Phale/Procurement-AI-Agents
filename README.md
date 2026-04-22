<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Procurement AI Agent Suite</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    :root {
      --navy:   #1A2B4A;
      --navy2:  #243660;
      --orange: #F58220;
      --orange2:#E0701A;
      --light:  #F5F7FA;
      --border: #DDE3EE;
      --text:   #2C3A52;
      --mid:    #5A6880;
      --white:  #FFFFFF;
      --green:  #1A9E6B;
      --red:    #D94040;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: var(--light);
      color: var(--text);
      min-height: 100vh;
    }

    /* ── HEADER ── */
    header {
      background: var(--navy);
      padding: 0 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 64px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.18);
      position: sticky; top: 0; z-index: 100;
    }
    .logo {
      display: flex; align-items: center; gap: 12px;
    }
    .logo-icon {
      width: 36px; height: 36px; background: var(--orange);
      border-radius: 8px; display: flex; align-items: center;
      justify-content: center; font-size: 18px;
    }
    .logo-text { color: var(--white); font-size: 17px; font-weight: 700; letter-spacing: -0.3px; }
    .logo-sub  { color: #8FA3C4; font-size: 12px; margin-top: 1px; }
    .badge {
      background: var(--orange); color: var(--white);
      font-size: 11px; font-weight: 700; padding: 4px 10px;
      border-radius: 20px; letter-spacing: 0.5px;
    }

    /* ── TABS ── */
    .tab-bar {
      background: var(--navy2);
      display: flex; gap: 2px;
      padding: 0 24px;
      overflow-x: auto;
    }
    .tab {
      display: flex; align-items: center; gap: 8px;
      padding: 14px 22px;
      color: #8FA3C4;
      font-size: 13.5px; font-weight: 600;
      cursor: pointer;
      border-bottom: 3px solid transparent;
      transition: all .18s;
      white-space: nowrap;
      user-select: none;
    }
    .tab:hover { color: var(--white); }
    .tab.active { color: var(--white); border-bottom-color: var(--orange); }
    .tab-icon { font-size: 16px; }

    /* ── MAIN LAYOUT ── */
    .main {
      max-width: 1100px; margin: 0 auto;
      padding: 32px 24px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      align-items: start;
    }

    /* ── CARDS ── */
    .card {
      background: var(--white);
      border-radius: 14px;
      border: 1px solid var(--border);
      box-shadow: 0 2px 12px rgba(26,43,74,0.06);
      overflow: hidden;
    }
    .card-header {
      background: var(--navy);
      padding: 18px 24px;
      display: flex; align-items: center; gap: 12px;
    }
    .card-icon {
      font-size: 22px;
      width: 42px; height: 42px;
      background: rgba(255,255,255,0.12);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
    }
    .card-title { color: var(--white); font-size: 15.5px; font-weight: 700; }
    .card-subtitle { color: #8FA3C4; font-size: 12px; margin-top: 2px; }
    .card-body { padding: 22px 24px; }

    /* ── FORM ELEMENTS ── */
    .field { margin-bottom: 16px; }
    label {
      display: block;
      font-size: 12.5px; font-weight: 600;
      color: var(--mid);
      margin-bottom: 6px;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    input, select, textarea {
      width: 100%;
      padding: 10px 13px;
      border: 1.5px solid var(--border);
      border-radius: 8px;
      font-size: 14px;
      color: var(--text);
      background: var(--white);
      transition: border-color .15s;
      font-family: inherit;
    }
    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--orange);
      box-shadow: 0 0 0 3px rgba(245,130,32,0.12);
    }
    textarea { resize: vertical; min-height: 90px; line-height: 1.5; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

    /* ── BUTTON ── */
    .btn {
      width: 100%; padding: 13px;
      background: var(--orange);
      color: var(--white);
      border: none; border-radius: 9px;
      font-size: 14.5px; font-weight: 700;
      cursor: pointer;
      transition: all .18s;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      margin-top: 4px;
    }
    .btn:hover { background: var(--orange2); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(245,130,32,0.3); }
    .btn:active { transform: translateY(0); }
    .btn:disabled { background: #BCC8DA; cursor: not-allowed; transform: none; box-shadow: none; }
    .btn-spinner {
      width: 18px; height: 18px;
      border: 2.5px solid rgba(255,255,255,0.35);
      border-top-color: white;
      border-radius: 50%;
      animation: spin .7s linear infinite;
      display: none;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── OUTPUT CARD ── */
    .output-card {
      background: var(--white);
      border-radius: 14px;
      border: 1px solid var(--border);
      box-shadow: 0 2px 12px rgba(26,43,74,0.06);
      overflow: hidden;
      display: none;
    }
    .output-card.visible { display: block; }
    .output-header {
      background: var(--light);
      border-bottom: 1px solid var(--border);
      padding: 14px 20px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .output-title {
      font-size: 13px; font-weight: 700;
      color: var(--navy);
      display: flex; align-items: center; gap: 8px;
    }
    .status-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--green);
    }
    .copy-btn {
      background: var(--navy); color: var(--white);
      border: none; border-radius: 6px;
      padding: 6px 14px; font-size: 12px; font-weight: 600;
      cursor: pointer; transition: background .15s;
    }
    .copy-btn:hover { background: var(--navy2); }
    .output-body {
      padding: 24px;
      max-height: 620px;
      overflow-y: auto;
    }
    .output-body h1, .output-body h2, .output-body h3 {
      color: var(--navy); margin: 18px 0 8px;
      font-weight: 700;
    }
    .output-body h1 { font-size: 18px; border-bottom: 2px solid var(--orange); padding-bottom: 6px; }
    .output-body h2 { font-size: 15px; }
    .output-body h3 { font-size: 13.5px; }
    .output-body p { line-height: 1.7; margin: 8px 0; font-size: 13.5px; }
    .output-body ul, .output-body ol { margin: 8px 0 8px 20px; }
    .output-body li { line-height: 1.7; margin: 3px 0; font-size: 13.5px; }
    .output-body table {
      width: 100%; border-collapse: collapse;
      margin: 12px 0; font-size: 13px;
    }
    .output-body th {
      background: var(--navy); color: var(--white);
      padding: 8px 12px; text-align: left; font-size: 12px;
    }
    .output-body td {
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
    }
    .output-body tr:nth-child(even) td { background: var(--light); }
    .output-body strong { color: var(--navy); }
    .output-body code {
      background: var(--light); padding: 2px 6px;
      border-radius: 4px; font-size: 12.5px;
    }

    /* ── ERROR ── */
    .error-msg {
      background: #FFF0F0; border: 1px solid #F5C0C0;
      border-radius: 8px; padding: 12px 16px;
      color: var(--red); font-size: 13px;
      margin-top: 12px; display: none;
    }

    /* ── PANEL VISIBILITY ── */
    .panel { display: none; }
    .panel.active { display: block; }

    /* ── EMPTY STATE ── */
    .empty-state {
      grid-column: 2;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 60px 24px; text-align: center;
      background: var(--white);
      border-radius: 14px;
      border: 1.5px dashed var(--border);
    }
    .empty-icon { font-size: 48px; margin-bottom: 16px; opacity: .5; }
    .empty-title { font-size: 15px; font-weight: 700; color: var(--navy); margin-bottom: 6px; }
    .empty-sub { font-size: 13px; color: var(--mid); }

    /* ── RESPONSIVE ── */
    @media (max-width: 820px) {
      .main { grid-template-columns: 1fr; }
      .empty-state { grid-column: 1; }
    }
  </style>
</head>
<body>

<!-- HEADER -->
<header>
  <div class="logo">
    <div class="logo-icon">🤖</div>
    <div>
      <div class="logo-text">Procurement AI Suite</div>
      <div class="logo-sub">Powered by Claude AI</div>
    </div>
  </div>
  <div class="badge">AI AGENTS</div>
</header>

<!-- TAB BAR -->
<div class="tab-bar">
  <div class="tab active" onclick="switchTab('rfq')" id="tab-rfq">
    <span class="tab-icon">📄</span> RFQ / RFP Drafter
  </div>
  <div class="tab" onclick="switchTab('bid')" id="tab-bid">
    <span class="tab-icon">📊</span> Bid Evaluator
  </div>
  <div class="tab" onclick="switchTab('contract')" id="tab-contract">
    <span class="tab-icon">⚖️</span> Contract Reviewer
  </div>
  <div class="tab" onclick="switchTab('spend')" id="tab-spend">
    <span class="tab-icon">💰</span> Spend Analyser
  </div>
</div>

<!-- MAIN -->
<div class="main" id="main-grid">

  <!-- ═══════════ PANEL 1: RFQ/RFP ═══════════ -->
  <div class="panel active" id="panel-rfq">
    <div class="card">
      <div class="card-header">
        <div class="card-icon">📄</div>
        <div>
          <div class="card-title">RFQ / RFP Drafter</div>
          <div class="card-subtitle">Generate a complete procurement document in seconds</div>
        </div>
      </div>
      <div class="card-body">
        <form id="form-rfq" onsubmit="runAgent(event,'rfq')">
          <div class="field">
            <label>Document Type</label>
            <select name="document_type">
              <option value="RFQ">RFQ — Request for Quotation</option>
              <option value="RFP">RFP — Request for Proposal</option>
            </select>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Organisation Name</label>
              <input name="company_name" placeholder="e.g. Acme Corp" required/>
            </div>
            <div class="field">
              <label>Project Title</label>
              <input name="project_title" placeholder="e.g. Office Supplies Q3" required/>
            </div>
          </div>
          <div class="field">
            <label>What are you sourcing?</label>
            <textarea name="sourcing_description" placeholder="Describe the goods or services you need…" rows="3" required></textarea>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Quantity / Volume</label>
              <input name="quantity" placeholder="e.g. 500 units / monthly"/>
            </div>
            <div class="field">
              <label>Required By</label>
              <input name="delivery_date" placeholder="e.g. 30 June 2026"/>
            </div>
          </div>
          <div class="field">
            <label>Key Specifications &amp; Requirements</label>
            <textarea name="key_requirements" placeholder="Technical specs, certifications, quality standards…" rows="3"></textarea>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Budget (optional)</label>
              <input name="budget" placeholder="e.g. $50,000"/>
            </div>
            <div class="field">
              <label>Submission Deadline</label>
              <input name="submission_deadline" placeholder="e.g. 15 May 2026"/>
            </div>
          </div>
          <div class="field">
            <label>Evaluation Criteria</label>
            <input name="evaluation_criteria" placeholder="e.g. Price 40%, Quality 40%, Delivery 20%"/>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Contact Name</label>
              <input name="contact_name" placeholder="Your name"/>
            </div>
            <div class="field">
              <label>Contact Email</label>
              <input name="contact_email" type="email" placeholder="you@company.com"/>
            </div>
          </div>
          <button class="btn" type="submit" id="btn-rfq">
            <div class="btn-spinner" id="spin-rfq"></div>
            <span id="btn-rfq-text">Generate Document ✦</span>
          </button>
        </form>
        <div class="error-msg" id="err-rfq"></div>
      </div>
    </div>
  </div>

  <!-- ═══════════ PANEL 2: BID EVALUATOR ═══════════ -->
  <div class="panel" id="panel-bid">
    <div class="card">
      <div class="card-header">
        <div class="card-icon">📊</div>
        <div>
          <div class="card-title">Bid Evaluator</div>
          <div class="card-subtitle">Score, rank and recommend suppliers from bid responses</div>
        </div>
      </div>
      <div class="card-body">
        <form id="form-bid" onsubmit="runAgent(event,'bid')">
          <div class="field">
            <label>Evaluation Criteria &amp; Weightings</label>
            <textarea name="evaluation_criteria" placeholder="e.g.&#10;Price: 40%&#10;Quality: 30%&#10;Delivery time: 20%&#10;Experience: 10%" rows="4" required></textarea>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Number of Suppliers</label>
              <input name="supplier_count" type="number" min="1" max="20" placeholder="e.g. 3" required/>
            </div>
            <div class="field">
              <label>Contract Duration</label>
              <input name="contract_duration" placeholder="e.g. 12 months"/>
            </div>
          </div>
          <div class="field">
            <label>Supplier Bids (paste or summarise each)</label>
            <textarea name="supplier_bids" placeholder="Supplier A: Price $45,000, delivery 4 weeks, 5 years experience…&#10;Supplier B: Price $38,000, delivery 6 weeks, 3 years experience…" rows="6" required></textarea>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Budget</label>
              <input name="budget" placeholder="e.g. $50,000"/>
            </div>
            <div class="field">
              <label>Mandatory Requirements</label>
              <input name="mandatory_requirements" placeholder="e.g. ISO 9001 certified"/>
            </div>
          </div>
          <button class="btn" type="submit" id="btn-bid">
            <div class="btn-spinner" id="spin-bid"></div>
            <span id="btn-bid-text">Evaluate Bids ✦</span>
          </button>
        </form>
        <div class="error-msg" id="err-bid"></div>
      </div>
    </div>
  </div>

  <!-- ═══════════ PANEL 3: CONTRACT REVIEWER ═══════════ -->
  <div class="panel" id="panel-contract">
    <div class="card">
      <div class="card-header">
        <div class="card-icon">⚖️</div>
        <div>
          <div class="card-title">Contract Reviewer</div>
          <div class="card-subtitle">Identify risks, gaps and key clauses in any contract</div>
        </div>
      </div>
      <div class="card-body">
        <form id="form-contract" onsubmit="runAgent(event,'contract')">
          <div class="field-row">
            <div class="field">
              <label>Reviewing As</label>
              <select name="reviewing_party">
                <option value="Buyer">Buyer</option>
                <option value="Seller">Seller / Supplier</option>
              </select>
            </div>
            <div class="field">
              <label>Industry / Sector</label>
              <input name="industry" placeholder="e.g. IT Services, Manufacturing"/>
            </div>
          </div>
          <div class="field">
            <label>Focus Areas (optional)</label>
            <input name="focus_areas" placeholder="e.g. Payment terms, IP ownership, termination clauses"/>
          </div>
          <div class="field">
            <label>Contract Text</label>
            <textarea name="contract_text" placeholder="Paste the contract text here…" rows="10" required></textarea>
          </div>
          <button class="btn" type="submit" id="btn-contract">
            <div class="btn-spinner" id="spin-contract"></div>
            <span id="btn-contract-text">Review Contract ✦</span>
          </button>
        </form>
        <div class="error-msg" id="err-contract"></div>
      </div>
    </div>
  </div>

  <!-- ═══════════ PANEL 4: SPEND ANALYSER ═══════════ -->
  <div class="panel" id="panel-spend">
    <div class="card">
      <div class="card-header">
        <div class="card-icon">💰</div>
        <div>
          <div class="card-title">Spend Analyser</div>
          <div class="card-subtitle">Surface savings opportunities and anomalies in your spend data</div>
        </div>
      </div>
      <div class="card-body">
        <form id="form-spend" onsubmit="runAgent(event,'spend')">
          <div class="field-row">
            <div class="field">
              <label>Organisation</label>
              <input name="company_name" placeholder="Your company name"/>
            </div>
            <div class="field">
              <label>Analysis Period</label>
              <input name="analysis_period" placeholder="e.g. Jan–Dec 2025"/>
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Currency</label>
              <select name="currency">
                <option value="USD">USD — US Dollar</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="EUR">EUR — Euro</option>
                <option value="ZAR">ZAR — South African Rand</option>
                <option value="AUD">AUD — Australian Dollar</option>
                <option value="CAD">CAD — Canadian Dollar</option>
              </select>
            </div>
            <div class="field">
              <label>Total Spend (optional)</label>
              <input name="total_spend" placeholder="e.g. $2.4M"/>
            </div>
          </div>
          <div class="field">
            <label>Focus Areas (optional)</label>
            <input name="focus_areas" placeholder="e.g. IT spend, supplier X, logistics category"/>
          </div>
          <div class="field">
            <label>Spend Data (paste CSV or summary)</label>
            <textarea name="spend_data" placeholder="Date, Supplier, Category, Amount, Department&#10;2025-01-05, Office Depot, Office Supplies, 1200, Admin&#10;2025-01-12, DHL, Logistics, 3400, Operations&#10;…" rows="8" required></textarea>
          </div>
          <button class="btn" type="submit" id="btn-spend">
            <div class="btn-spinner" id="spin-spend"></div>
            <span id="btn-spend-text">Analyse Spend ✦</span>
          </button>
        </form>
        <div class="error-msg" id="err-spend"></div>
      </div>
    </div>
  </div>

  <!-- ═══════════ OUTPUT AREA ═══════════ -->
  <div class="empty-state" id="empty-state">
    <div class="empty-icon">✦</div>
    <div class="empty-title">Your output will appear here</div>
    <div class="empty-sub">Fill in the form and click Generate</div>
  </div>

  <div class="output-card" id="output-card">
    <div class="output-header">
      <div class="output-title">
        <div class="status-dot"></div>
        <span id="output-label">Output</span>
      </div>
      <button class="copy-btn" onclick="copyOutput()">Copy</button>
    </div>
    <div class="output-body" id="output-body"></div>
  </div>

</div>

<script>
  const ENDPOINTS = {
    rfq:      '/api/rfq-rfp',
    bid:      '/api/bid-evaluator',
    contract: '/api/contract-reviewer',
    spend:    '/api/spend-analyser'
  };

  const LABELS = {
    rfq:      '📄 RFQ / RFP Document',
    bid:      '📊 Bid Evaluation Report',
    contract: '⚖️ Contract Review',
    spend:    '💰 Spend Analysis Report'
  };

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    document.getElementById('panel-' + name).classList.add('active');
  }

  async function runAgent(e, agent) {
    e.preventDefault();
    const form   = document.getElementById('form-' + agent);
    const btn    = document.getElementById('btn-' + agent);
    const spin   = document.getElementById('spin-' + agent);
    const btnTxt = document.getElementById('btn-' + agent + '-text');
    const errEl  = document.getElementById('err-' + agent);

    // collect form data
    const data = {};
    new FormData(form).forEach((v, k) => data[k] = v);

    // UI: loading
    btn.disabled = true;
    spin.style.display = 'block';
    btnTxt.textContent = 'Generating…';
    errEl.style.display = 'none';
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('output-card').classList.remove('visible');

    try {
      const res  = await fetch(ENDPOINTS[agent], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();

      if (json.success) {
        document.getElementById('output-label').textContent = LABELS[agent];
        document.getElementById('output-body').innerHTML = marked.parse(json.result);
        document.getElementById('output-card').classList.add('visible');
        document.getElementById('output-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        showError(agent, json.error || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      showError(agent, 'Network error. Please check your connection and try again.');
    } finally {
      btn.disabled = false;
      spin.style.display = 'none';
      btnTxt.textContent = btn.dataset.label || getDefaultLabel(agent);
    }
  }

  function getDefaultLabel(agent) {
    const labels = {
      rfq: 'Generate Document ✦',
      bid: 'Evaluate Bids ✦',
      contract: 'Review Contract ✦',
      spend: 'Analyse Spend ✦'
    };
    return labels[agent];
  }

  function showError(agent, msg) {
    const el = document.getElementById('err-' + agent);
    el.textContent = '⚠️ ' + msg;
    el.style.display = 'block';
    document.getElementById('empty-state').style.display = 'flex';
  }

  function copyOutput() {
    const text = document.getElementById('output-body').innerText;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.querySelector('.copy-btn');
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy', 2000);
    });
  }
</script>
</body>
</html>
