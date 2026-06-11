// ============================================================
// ROUTER — view navigation and sidebar
// ============================================================

const VIEW_TITLES = {
  'dashboard':        'Dashboard',
  'purchase-orders':  'Purchase Orders',
  'create-po':        'New Purchase Order',
  'po-detail':        'Purchase Order Detail',
  'requisitions':     'Purchase Requisitions',
  'create-requisition': 'New Requisition',
  'rfq':              'RFQ Generator',
  'create-rfq':       'New RFQ',
  'rfq-detail':       'RFQ Detail',
  'price-comparison': 'AI Price Comparison',
  'invoices':         'Invoices & Payments',
  'invoice-detail':   'Invoice Detail',
  'add-invoice':      'Add Invoice',
  'inventory':        'Inventory & Alerts',
  'add-inventory':    'Add Inventory Item',
  'contracts':        'Contracts',
  'suppliers':        'My Suppliers',
  'onboarding':       'Add a Supplier',
  'analytics':        'Spend Analytics',
  'spend-alerts':     'Spend Alerts',
  'risk-watch':       'Risk Watch',
  'ai-assistant':     'AI Assistant',
  'pricing':          'Pricing & Plans',
  'settings':         'Settings'
};

let _currentView = 'dashboard';

export function getCurrentView() { return _currentView; }

export function showView(id) {
  // Hide all views, show the requested one
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + id);
  if (target) target.classList.add('active');

  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.getAttribute('data-view') === id);
  });

  // Update topbar title
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = VIEW_TITLES[id] || id;

  _currentView = id;

  // Close mobile sidebar on navigation
  closeSidebar();
}

// ── Mobile sidebar ────────────────────────────────────────
export function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sb-backdrop');
  if (sb.classList.contains('open')) {
    sb.classList.remove('open');
    bd.style.display = 'none';
  } else {
    sb.classList.add('open');
    bd.style.display = 'block';
  }
}

export function closeSidebar() {
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sb-backdrop');
  if (sb) sb.classList.remove('open');
  if (bd) bd.style.display = 'none';
}

// ── Print ─────────────────────────────────────────────────
export function printPage() { window.print(); }

// ── Wire nav items to data-view attributes ────────────────
export function initRouter() {
  // Allow nav items to declare their target view via data-view attribute
  // (existing onclick handlers are preserved as fallback)
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => showView(item.getAttribute('data-view')));
  });
}
