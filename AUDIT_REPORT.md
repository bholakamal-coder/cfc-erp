# CFC ERP v2 — Senior Engineer Audit Report
**Date:** 2026-05-30 | **Pages:** 23 | **Total Size:** 3.4MB

---

## 1. ARCHITECTURE OVERVIEW

```
Browser
  └── Cloudflare Pages (static HTML)
        └── Each page is self-contained:
              ├── Inline CSS (~60KB per page)
              ├── Inline JS (~200-1000 lines per page)
              ├── Logo base64 (~40KB per page)
              └── Supabase JS SDK (CDN)
                    └── Supabase (PostgreSQL + RLS)
```

**Pattern:** Each page = standalone HTML file with no shared modules.

---

## 2. CRITICAL PROBLEMS

### 🔴 P0 — Logo base64 in every page
- **Impact:** 920KB of duplicated data across 23 pages
- **Every page load** downloads the same 40KB logo
- **Fix:** Move logo to `<link rel="preload">` or CSS background-image from CDN

### 🔴 P0 — API Key exposed in JS
- `sb_publishable_eWBMrAFa7Yyvtlb` hardcoded in all 23 pages
- While Supabase publishable keys are "safe", RLS is the only protection
- **Fix:** Move to `_config.js` or Cloudflare environment variable

### 🔴 P1 — 30% duplicate code (1MB)
- `showToast`, `handleLogout`, `genNo`, `liveSearch`, `lsPick` — repeated 10-23x
- Sidebar CSS (~3KB) repeated 23x = 69KB
- Accordion JS repeated 23x = 23KB
- **Fix:** `shared.js` + `shared.css` extracted as separate files

### 🟡 P2 — No debounce on search inputs (19/23 pages)
- Every keystroke fires Supabase query
- On slow connections: 10 keystrokes = 10 API calls in flight
- **Fix:** 300ms debounce wrapper

### 🟡 P2 — No query limits on data tables (10/23 pages)
- `from('invoices').select('*')` — loads ALL records forever
- 10,000 invoices = browser freeze
- **Fix:** `.limit(500).order('created_at', {ascending:false})`

### 🟡 P2 — Double-submit risk (12/23 pages)
- Save buttons have no disabled state during async save
- User can click "Save" 3x = 3 duplicate records
- **Fix:** `btn.disabled=true` during save, re-enable on complete

### 🟠 P3 — XSS via innerHTML template literals
- `tbody.innerHTML = rows.map(r => \`<tr>...\${r.name}...\`)` 
- If supplier name contains `<script>`, it executes
- **Fix:** `textContent` for user data, or `DOMPurify.sanitize()`

### 🟠 P3 — No offline/error state
- If Supabase is down, page shows "Loading..." forever
- **Fix:** Timeout + retry + clear error message

### 🟠 P3 — Memory leak on page navigation
- Event listeners added but never removed
- In SPA-style usage, this accumulates
- **Fix:** Cleanup on `beforeunload`

---

## 3. PERFORMANCE BOTTLENECKS

| Issue | Impact | Pages |
|---|---|---|
| Logo base64 per page | +40KB per load | All 23 |
| No pagination | OOM on large data | 10 pages |
| No debounce | N×API calls | 19 pages |
| Inline CSS repeated | +60KB per page | All 23 |
| No HTTP caching | Full reload each time | All 23 |
| `select('*')` everywhere | Over-fetching columns | All 23 |

---

## 4. SCALABILITY RISKS

- **1000+ items:** Item Master will timeout (no virtual scroll)
- **10000+ invoices:** Invoice page will crash (no pagination)  
- **Multi-user:** No optimistic locking — two users editing same SO = last-write-wins
- **Mobile:** Sidebar not responsive on small screens

---

## 5. REFACTORING STRATEGY

### Phase 1 (Immediate — done in this audit)
- [x] Double-submit protection on all save buttons
- [x] Query limits on all data loads
- [x] Debounce on search inputs
- [x] Loading state management

### Phase 2 (Next sprint)
- [ ] Extract `shared.js` — auth, toast, genNo, liveSearch, lsPick
- [ ] Extract `shared.css` — sidebar, modal, table, button styles
- [ ] Move logo to CDN URL (1 line vs 40KB)
- [ ] Move Supabase config to `config.js`

### Phase 3 (Future)
- [ ] Virtual scroll for large tables (item_master, stock_ledger)
- [ ] Service Worker for offline support
- [ ] Bundle with Vite/Rollup → proper module system

---

## 6. WHAT'S DONE WELL ✅
- RLS policies on all tables — data security solid
- Consistent UI design system (CSS variables)
- Accordion sidebar with localStorage state
- Live search with Add New fallback
- MRP Part A/B/C coverage
- Error messages on all saves
