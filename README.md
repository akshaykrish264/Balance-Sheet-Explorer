# Scope — Balance Sheet Explorer for ERPNext

A Frappe custom app that adds **Balance Sheet Impact analysis** to Journal Entries in ERPNext v15.  
Built with React + Material UI + Frappe React SDK, served as a Doppio SPA at `/scope`.

---

## What it does

- Adds a **"Show Balance Sheet Impact"** button on every submitted Journal Entry
- Opens a dialog showing how the voucher moves **Assets, Liabilities, Equity, Income, and Expense**
- Provides a standalone **Balance Sheet Explorer** page at `/scope`
- All data fetched via `useFrappeGetDocList` and `useFrappeGetDoc` — no custom Python API needed

---

## Prerequisites

| Requirement | Version |
|---|---|
| ERPNext | v15 |
| Frappe Bench | latest |
| Node.js | v20+ |
| Python | 3.10+ |

---

## Installation

### 1. Get the app

```bash
cd ~/frappe-bench
bench get-app scope https://github.com/your-org/scope
```

### 2. Install Doppio

```bash
bench get-app doppio https://github.com/NagariaHussain/doppio
bench --site site1.local install-app doppio
```

### 3. Install Scope on your site

```bash
bench --site site1.local install-app scope
```

### 4. Install frontend dependencies

```bash
cd ~/frappe-bench/apps/scope/scope/frontend
npm install
```

### 5. Build the frontend

```bash
npm run build
```

### 6. Copy assets to sites

```bash
rm -rf ~/frappe-bench/sites/assets/scope/frontend
cp -r ../public/frontend ~/frappe-bench/sites/assets/scope/
```

### 7. Clear cache and restart

```bash
cd ~/frappe-bench
bench clear-cache
bench restart
```

---

## Configuration

### Site config (optional — for development)

```bash
cd ~/frappe-bench/sites
nano common_site_config.json
```

Add:

```json
{
  "allow_cors": "*",
  "ignore_csrf": 1
}
```

> ⚠️ Do not use `allow_cors` and `ignore_csrf` in production. Use proper CORS and CSRF settings.

---

## Usage

### Balance Sheet Explorer (standalone page)

```
http://your-site/scope
```

Open with a specific Journal Entry pre-selected:

```
http://your-site/scope?je=ACC-JV-2024-00001
```

### Journal Entry dialog

1. Open any **submitted** Journal Entry in ERPNext
2. Click the **"Show Balance Sheet Impact"** button in the top-right button group
3. A dialog opens showing the full balance sheet movement

---

## Development workflow

### Start dev server

```bash
cd ~/frappe-bench/apps/scope/scope/frontend
npm run dev
```

Frontend available at `http://localhost:5173`

### After any React file change (production build)

```bash
cd ~/frappe-bench/apps/scope/scope/frontend
npm run build
rm -rf ~/frappe-bench/sites/assets/scope/frontend
cp -r ../public/frontend ~/frappe-bench/sites/assets/scope/
cd ~/frappe-bench && bench clear-cache
```

### One-liner alias (add to `~/.bashrc`)

```bash
alias deploy-scope="cd ~/frappe-bench/apps/scope/scope/frontend && npm run build && rm -rf ~/frappe-bench/sites/assets/scope/frontend && cp -r ../public/frontend ~/frappe-bench/sites/assets/scope/ && cd ~/frappe-bench && bench clear-cache && echo '✅ Scope deployed'"
```

Then just run:

```bash
deploy-scope
```

---

## File structure

```
scope/
├── scope/
│   ├── frontend/                        # React source (Vite + TypeScript)
│   │   ├── src/
│   │   │   ├── main.tsx                 # Entry point — mounts SPA
│   │   │   └── App.tsx                  # Full app — Explorer + ImpactCard
│   │   ├── vite.config.ts
│   │   └── package.json
│   ├── public/
│   │   ├── frontend/                    # Vite build output (git-ignored)
│   │   └── js/
│   │       └── journal_entry_extension.js  # Adds button to JE form
│   ├── www/
│   │   └── scope.html                   # Frappe www route → React SPA
│   └── hooks.py                         # Route rules + doctype JS registration
└── README.md
```

---

## hooks.py reference

```python
app_name = "scope"
app_title = "Scope"
app_publisher = "Your Org"
app_description = "Balance Sheet Explorer"
app_version = "0.0.1"
app_license = "MIT"

doctype_js = {
    "Journal Entry": "public/js/journal_entry_extension.js",
}

website_route_rules = [
    {"from_route": "/scope/<path:app_path>", "to_route": "scope"},
]
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `/scope` shows 404 | Check `www/scope.html` exists and `website_route_rules` is in `hooks.py` |
| Button missing on JE | Run `bench clear-cache` and hard-refresh the browser |
| Assets not loading | Re-run the copy step and `bench clear-cache` |
| Node version error | Run `nvm install 20 && nvm use 20` |
| Permission errors | Run commands as frappe user: `sudo -u frappe -H bash` |
| `GL Entry` returns empty | Ensure the Journal Entry is in **Submitted** state (`docstatus = 1`) |

---

## Notes

- Node.js **v20 or higher** is required. Run `node --version` to check.
- The app uses `useFrappeGetDocList` and `useFrappeGetDoc` from `frappe-react-sdk` — no custom whitelisted Python API is needed.
- Income and Expense accounts are fully supported and displayed alongside Asset, Liability, and Equity.
- The `/scope` route is handled by Frappe's `website_route_rules` — React Router handles all sub-paths client-side.
