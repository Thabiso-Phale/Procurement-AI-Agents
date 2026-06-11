// ============================================================
// AI ASSISTANT MODULE
// ============================================================

import { getSettings, getPOData, getReqData, getRFQData, getInvoiceData, getInventoryData, getContractData } from '../store.js';

const aiResponses = {
  greeting: 'Hello! I\'m your AI Procurement Assistant. I can help you with supplier analysis, spend optimisation, compliance guidance, and procurement strategy. What would you like to know?',
  budget: 'Based on your current spend data, you\'re tracking within budget this month. Your top spend categories are IT Equipment and Office Supplies. Consider consolidating orders to unlock volume discounts.',
  supplier: 'Your supplier portfolio shows TechEquip Solutions needs attention — prices are 8% above market rate. CloudServ Partners (score: 91) is your strongest performer. Consider renegotiating IT contracts.',
  rfq: 'For purchases above $2,500, I recommend issuing an RFQ to at least 3 suppliers. This typically reduces costs by 8–15%. Your RFQ threshold is currently set at $2,500 in settings.',
  compliance: 'Key compliance reminders: (1) Keep all POs under your approval thresholds unless explicitly approved, (2) RFQ mandatory above $10,000, (3) All suppliers must complete onboarding with valid trade docs.',
  inventory: 'Your inventory has items approaching reorder levels. I recommend reviewing the Inventory module and setting up automatic reorder alerts.',
  invoice: 'You have pending invoices for review. Ensure 3-way matching (PO → GRN → Invoice) is complete before approving payment.',
  default: 'I can help with spend analysis, supplier evaluation, compliance checks, and procurement strategy. Could you be more specific about what you need?'
};

function getAIResponse(message) {
  const lm = message.toLowerCase();
  if (lm.includes('hello') || lm.includes('hi') || lm.includes('hey')) return aiResponses.greeting;
  if (lm.includes('budget') || lm.includes('spend') || lm.includes('cost')) return aiResponses.budget;
  if (lm.includes('supplier') || lm.includes('vendor')) return aiResponses.supplier;
  if (lm.includes('rfq') || lm.includes('quote') || lm.includes('tender')) return aiResponses.rfq;
  if (lm.includes('compliance') || lm.includes('policy') || lm.includes('rule')) return aiResponses.compliance;
  if (lm.includes('inventor') || lm.includes('stock') || lm.includes('reorder')) return aiResponses.inventory;
  if (lm.includes('invoice') || lm.includes('payment') || lm.includes('paid')) return aiResponses.invoice;
  return aiResponses.default;
}

function buildProcurementContext() {
  const settings      = getSettings();
  const poData        = getPOData();
  const reqData       = getReqData();
  const rfqData       = getRFQData();
  const invoiceData   = getInvoiceData();
  const inventoryData = getInventoryData();
  const contractData  = getContractData();

  const activePOs  = poData.filter(p => p.status !== 'Draft' && p.status !== 'Closed');
  const spent      = activePOs.reduce((s, p) => s + p.amount, 0);
  const overdue    = invoiceData.filter(i => i.status === 'Overdue').length;
  const lowStock   = inventoryData.filter(i => i.qty <= i.reorderLevel && i.qty > 0).length;
  const expiring   = contractData.filter(c => {
    if (!c.endDate) return false;
    const warn = new Date(); warn.setDate(warn.getDate() + 30);
    return new Date(c.endDate) <= warn && new Date(c.endDate) > new Date();
  }).length;

  return `You are a senior procurement AI assistant for ${settings.companyName || 'a company'}.
Company: ${settings.companyName || 'N/A'}
Currency: ${settings.currency || 'USD'}
Monthly Budget: $${(settings.monthlyBudget || 25000).toLocaleString()}
Budget Spent: $${spent.toLocaleString()}
Remaining: $${((settings.monthlyBudget || 25000) - spent).toLocaleString()}

Auto-approve limit: $${settings.autoApproveLimit || 500}
RFQ threshold: $${settings.rfqThreshold || 2500}
Director threshold: $${settings.directorThreshold || 10000}
Primary approver: ${settings.primaryApprover || 'Manager'}

Current data summary:
- Purchase Orders: ${poData.length} total, ${activePOs.length} active
- Requisitions: ${reqData.length} total, ${reqData.filter(r => r.status === 'Pending Approval').length} pending
- RFQs: ${rfqData.length} total
- Invoices: ${invoiceData.length} total, ${overdue} overdue
- Inventory items: ${inventoryData.length} total, ${lowStock} at/below reorder level
- Contracts: ${contractData.length} total, ${expiring} expiring within 30 days

Top suppliers by spend:
${(() => {
  const byS = {};
  activePOs.forEach(p => { if (!byS[p.supplier]) byS[p.supplier]=0; byS[p.supplier]+=p.amount; });
  return Object.entries(byS).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,v])=>'- '+n+': $'+v.toLocaleString()).join('\n') || '- No active POs';
})()}

Provide concise, actionable procurement advice. Focus on cost savings, compliance, and risk reduction.`;
}

export async function sendChat() {
  const inputEl  = document.getElementById('ai-input');
  const chatEl   = document.getElementById('ai-chat-messages');
  if (!inputEl || !chatEl) return;
  const message = inputEl.value.trim();
  if (!message) return;
  inputEl.value = '';

  // Append user bubble
  chatEl.innerHTML += '<div class="chat-msg chat-user"><div class="chat-bubble">' + message + '</div></div>';
  chatEl.scrollTop = chatEl.scrollHeight;

  // Thinking indicator
  const thinkId = 'think-' + Date.now();
  chatEl.innerHTML += '<div id="' + thinkId + '" class="chat-msg chat-ai"><div class="chat-bubble" style="opacity:0.6">AI is thinking<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span></div></div>';
  chatEl.scrollTop = chatEl.scrollHeight;

  const settings = getSettings();
  const apiKey   = settings.anthropicKey;

  if (!apiKey) {
    const fallback = getAIResponse(message);
    document.getElementById(thinkId)?.remove();
    chatEl.innerHTML += '<div class="chat-msg chat-ai"><div class="chat-bubble">' + fallback + '<br><br><em style="font-size:11px;color:#94A3B8">Add your Anthropic API key in Settings for live AI responses.</em></div></div>';
    chatEl.scrollTop = chatEl.scrollHeight;
    return;
  }

  try {
    const context = buildProcurementContext();
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: apiKey,
        system: context,
        messages: [{ role: 'user', content: message }]
      })
    });
    const data = await resp.json();
    document.getElementById(thinkId)?.remove();
    const aiText = data.content || data.error || 'Sorry, I could not process that request.';
    chatEl.innerHTML += '<div class="chat-msg chat-ai"><div class="chat-bubble">' + aiText.replace(/\n/g, '<br>') + '</div></div>';
  } catch (e) {
    document.getElementById(thinkId)?.remove();
    chatEl.innerHTML += '<div class="chat-msg chat-ai"><div class="chat-bubble">⚠ Connection error. Check your API key and network. Falling back to local knowledge.<br><br>' + getAIResponse(message) + '</div></div>';
  }
  chatEl.scrollTop = chatEl.scrollHeight;
}

export function fillPrompt(text) {
  const inputEl = document.getElementById('ai-input');
  if (inputEl) { inputEl.value = text; inputEl.focus(); }
}

export function aiKeyPress(event) {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendChat(); }
}
