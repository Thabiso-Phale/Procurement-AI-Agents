# ProjectBuys

Smart procurement management for SMEs — suppliers, requisitions, RFQs, purchase orders, invoices, inventory, contracts, and spend analytics in one browser-based app, with an AI assistant (Claude) built in.

**Live app:** [app.projectbuys.com](https://app.projectbuys.com)

## Features

- **Dashboard** — live spend, budget, approvals, and health score in one view
- **Suppliers** — onboarding workflow with compliance/tax docs and an AI supplier scout
- **Requisitions & RFQs** — configurable approval tiers, AI-scored quote comparison
- **Purchase Orders** — budget checks, approver hints, PDF export with T&Cs
- **Invoices & Payments** — AI invoice scanning, compliance checks, cash-flow forecasting
- **Inventory** — stock levels with reorder alerts
- **Contracts** — renewal tracking and expiry risk flags
- **Spend Analytics & Risk Watch** — supplier concentration, price drift, and portfolio risk scoring
- **AI Assistant** — plain-English Q&A over your live procurement data (Claude)

All data is stored locally in the browser (`localStorage`) — no backend database, no accounts required.

## Running locally

**Option A — browser only (no AI features)**
Open `index.html` directly in a browser.

**Option B — full app with AI proxy**
```bash
npm start
```
This runs `server.js`, which serves the app and proxies Claude API calls (so the browser never hits CORS restrictions), then opens `http://localhost:3000`. Add your Anthropic API key under Settings → AI Integration to enable AI features.

See [HOW_TO_USE.md](HOW_TO_USE.md) for a full walkthrough.

## Tech stack

Vanilla JS (ES6 modules), no build step. `server.js` is a plain Node `http` server — no framework — that also handles license key generation/validation and the Lemon Squeezy webhook for paid plans. Deployed on Railway.

## Project structure

```
index.html          the app
js/                  ES6 modules (router, store, feature modules)
styles/              CSS
server.js            local dev server + Claude proxy + license/admin backend
landing/             marketing site source (not currently deployed to a live domain)
guide.html, terms.html, privacy.html   standalone pages, also served by server.js
```
