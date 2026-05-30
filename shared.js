/* ============================================================
   CFC ERP v2 — shared.js
   Architecture: Separation of Concerns
   
   Modules:
   1. Config      — Supabase URL, keys, constants
   2. Auth        — Session management, logout  
   3. UI Utils    — Toast, debounce, genNo
   4. LiveSearch  — Reusable dropdown search component
   5. CentralNav  — Topbar page search
   6. Accordion   — Sidebar accordion behavior
   
   Usage: <script src="shared.js"></script>
   Then call: CFC.auth.init(initFn) in each page
   ============================================================ */

'use strict';

// ── 1. CONFIG ────────────────────────────────────────────────────────────────
window.CFC_CONFIG = {
  SUPABASE_URL: 'https://sdopdeqepjoshbzrpbmi.supabase.co',
  SUPABASE_KEY: 'sb_publishable_eWBMrAFa7Yyvtlb-7-8IGA_KxfE7v_8',
  APP_NAME:     'CFC ERP v2',
  COMPANY:      'CERADRIVE BRAKES',
  VERSION:      '2.1.0',
  QUERY_LIMIT:  500,
  DEBOUNCE_MS:  300,
};

// ── 2. SUPABASE CLIENT (singleton) ───────────────────────────────────────────
window.CFC_SB = (function() {
  if (window._cfcSbInstance) return window._cfcSbInstance;
  const { createClient } = supabase;
  window._cfcSbInstance = createClient(CFC_CONFIG.SUPABASE_URL, CFC_CONFIG.SUPABASE_KEY);
  return window._cfcSbInstance;
})();

// Alias for pages that use `sb` or `sc`
window.sb = window.CFC_SB;
window.sc = window.CFC_SB;

// ── 3. AUTH MODULE ───────────────────────────────────────────────────────────
window.CFC_AUTH = {
  session: null,

  async init(pageInitFn) {
    const { data: { session } } = await CFC_SB.auth.getSession();
    if (!session) {
      window.location.href = 'index.html';
      return;
    }
    this.session = session;
    const email = session.user.email || '';
    const el_av = document.getElementById('user-avatar');
    const el_nm = document.getElementById('user-name');
    if (el_av) el_av.textContent = email.substring(0, 2).toUpperCase();
    if (el_nm) el_nm.textContent = email.split('@')[0];
    if (typeof pageInitFn === 'function') await pageInitFn();
  },

  async logout() {
    await CFC_SB.auth.signOut();
    window.location.href = 'index.html';
  }
};

// Legacy alias
window.handleLogout = () => CFC_AUTH.logout();

// ── 4. UI UTILITIES ──────────────────────────────────────────────────────────
window.CFC_UI = {

  showToast(msg, type = '') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast show ' + type;
    setTimeout(() => t.className = 'toast', 3500);
  },

  debounce(fn, delay) {
    let t;
    return function(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), delay || CFC_CONFIG.DEBOUNCE_MS);
    };
  },

  // Collision-resistant document number: prefix-YYYYMM-<ts6><rnd3>
  genNo(prefix) {
    const n = new Date();
    const ts = String(n.getTime()).slice(-6);
    const rnd = String(Math.floor(Math.random() * 900 + 100));
    return prefix + '-' + n.getFullYear() + 
           String(n.getMonth() + 1).padStart(2, '0') + 
           '-' + ts + rnd;
  },

  // Safe button lock — prevents double-submit
  lockBtn(btn) {
    if (!btn) return;
    btn.disabled = true;
    btn.dataset.origText = btn.textContent;
    btn.style.opacity = '0.65';
  },

  unlockBtn(btn) {
    if (!btn) return;
    btn.disabled = false;
    btn.textContent = btn.dataset.origText || btn.textContent;
    btn.style.opacity = '';
  },

  // Confirm dialog shorthand
  confirm(msg) {
    return window.confirm(msg);
  }
};

// Legacy aliases
window.showToast = (msg, type) => CFC_UI.showToast(msg, type);
window.genNo = (prefix) => CFC_UI.genNo(prefix);
window.debounce = (fn, delay) => CFC_UI.debounce(fn, delay);

// ── 5. LIVE SEARCH COMPONENT ─────────────────────────────────────────────────
window.CFC_SEARCH = {

  // Initialize a live search dropdown
  // opts: { inputId, ddId, hiddenId, data, labelFn, valueFn, filterFn, addNewFn }
  init(opts) {
    const inp = document.getElementById(opts.inputId);
    const dd  = document.getElementById(opts.ddId);
    const hid = document.getElementById(opts.hiddenId);
    if (!inp || !dd) return;

    const render = (items) => {
      const r = inp.getBoundingClientRect();
      dd.style.top    = (r.bottom + window.scrollY + 2) + 'px';
      dd.style.left   = r.left + 'px';
      dd.style.width  = Math.max(r.width, 260) + 'px';

      let html = items.slice(0, 8).map(x => {
        const v = opts.valueFn(x);
        const l = opts.labelFn(x);
        return `<div class="ls-row" 
          onclick="CFC_SEARCH.pick('${opts.inputId}','${opts.ddId}','${opts.hiddenId}',${v},${JSON.stringify(l)})">
          ${l}</div>`;
      }).join('');

      if (inp.value.trim() && opts.addNewFn) {
        html += `<div class="ls-add" onclick="${opts.addNewFn}()">
          <span style="color:var(--red);font-weight:700;">+ Add New</span></div>`;
      }

      dd.innerHTML = html;
      dd.classList.add('show');
    };

    inp.addEventListener('input', CFC_UI.debounce(function() {
      const q = inp.value.toLowerCase().trim();
      if (!q) { dd.classList.remove('show'); if(hid) hid.value = ''; return; }
      render((opts.data || []).filter(x => opts.filterFn(x, q)));
    }, 250));

    inp.addEventListener('focus', function() {
      if (inp.value.trim()) inp.dispatchEvent(new Event('input'));
    });
  },

  pick(inputId, ddId, hiddenId, val, label) {
    const inp = document.getElementById(inputId);
    const dd  = document.getElementById(ddId);
    const hid = document.getElementById(hiddenId);
    if (inp) inp.value = label;
    if (hid) hid.value = val;
    if (dd)  dd.classList.remove('show');
  }
};

// Legacy aliases used by existing pages
window.liveSearch = function(iid, did, hid, data, labelFn, valFn, filterFn, addFn) {
  CFC_SEARCH.init({ inputId:iid, ddId:did, hiddenId:hid, data, labelFn, valueFn:valFn, filterFn, addNewFn:addFn });
};
window.lsPick = (iid, did, hid, val, label) => CFC_SEARCH.pick(iid, did, hid, val, label);

// Close all dropdowns on outside click
document.addEventListener('click', function(e) {
  if (!e.target.closest('.ls-wrap') && !e.target.closest('.ls-dd')) {
    document.querySelectorAll('.ls-dd').forEach(d => d.classList.remove('show'));
  }
});

// ── 6. CENTRAL NAV SEARCH ────────────────────────────────────────────────────
window.CFC_NAV = {
  pages: [
    ["dashboard.html","Dashboard","&#128200;"],
    ["item_master.html","Item Master","&#128230;"],
    ["warehouse.html","Warehouse","&#127981;"],
    ["bom.html","BOM Master","&#128196;"],
    ["routing.html","Routing Master","&#9881;"],
    ["dies.html","Dies","&#128295;"],
    ["machines.html","Machine Master","&#9881;"],
    ["work_orders.html","Work Orders","&#128203;"],
    ["production_plan.html","Production Plan","&#128203;"],
    ["mrp.html","MRP","&#128202;"],
    ["labour.html","Labour Planning","&#128101;"],
    ["job_cards.html","Job Cards","&#128196;"],
    ["workers.html","Workers","&#128104;"],
    ["purchase_order.html","Purchase Order","&#128715;"],
    ["supplier.html","Supplier Master","&#128666;"],
    ["grn.html","GRN","&#128230;"],
    ["sales_order.html","Sales Order","&#128188;"],
    ["customer.html","Customer Master","&#128101;"],
    ["dispatch.html","Dispatch","&#128666;"],
    ["stock_ledger.html","Stock Ledger","&#128230;"],
    ["invoice.html","Invoice","&#129534;"],
    ["qc.html","Quality Control","&#9989;"],
    ["reports.html","Reports & MIS","&#128202;"],
  ],

  init() {
    const inp = document.getElementById('central-search');
    const dd  = document.getElementById('central-dd');
    if (!inp || !dd) return;

    const render = (results) => {
      if (!results.length) {
        dd.innerHTML = `<div class="search-empty">No page found</div>`;
      } else {
        dd.innerHTML = results.slice(0, 8).map(([href, name, icon]) =>
          `<a class="search-item" href="${href}">
            <span class="si-icon">${icon}</span>
            <span class="si-name">${name}</span>
            <span class="si-hint">${href}</span>
           </a>`
        ).join('');
      }
      dd.classList.add('open');
    };

    inp.addEventListener('input', CFC_UI.debounce(function() {
      const q = inp.value.toLowerCase().trim();
      if (!q) { dd.classList.remove('open'); return; }
      render(CFC_NAV.pages.filter(([, name]) => name.toLowerCase().includes(q)));
    }, 200));

    inp.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        const first = dd.querySelector('.search-item');
        if (first) window.location.href = first.href;
      }
      if (e.key === 'Escape') { dd.classList.remove('open'); inp.value = ''; }
    });

    document.addEventListener('click', function(e) {
      if (!e.target.closest('.topbar-search')) dd.classList.remove('open');
    });
  }
};

// ── 7. SIDEBAR ACCORDION ─────────────────────────────────────────────────────
window.CFC_SIDEBAR = {
  STORE: 'cfc_sb_open',

  getOpen()  { try { return localStorage.getItem(this.STORE) || ''; } catch(e) { return ''; } },
  saveOpen(g) { try { localStorage.setItem(this.STORE, g); } catch(e) {} },

  openGroup(gid, header, body) {
    header.classList.add('is-open');
    body.classList.add('is-open');
    this.saveOpen(gid);
  },

  closeGroup(header, body) {
    header.classList.remove('is-open');
    body.classList.remove('is-open');
  },

  init() {
    const cur = location.pathname.split('/').pop() || 'dashboard.html';
    const saved = this.getOpen();
    let autoOpenGid = null;

    document.querySelectorAll('.sb-group').forEach(g => {
      g.querySelectorAll('.nav-item').forEach(a => {
        if (a.getAttribute('href') === cur) {
          a.classList.add('active');
          autoOpenGid = g.getAttribute('data-gid');
        }
      });
    });

    document.querySelectorAll('.sb-group').forEach(g => {
      const gid    = g.getAttribute('data-gid');
      const header = g.querySelector('.sb-group-header');
      const body   = g.querySelector('.sb-group-body');

      if (gid === autoOpenGid || (gid === saved && !autoOpenGid)) {
        this.openGroup(gid, header, body);
      }

      header.addEventListener('click', () => {
        const isOpen = body.classList.contains('is-open');
        document.querySelectorAll('.sb-group').forEach(og => {
          this.closeGroup(og.querySelector('.sb-group-header'), og.querySelector('.sb-group-body'));
        });
        if (!isOpen) {
          this.openGroup(gid, header, body);
          const nav = document.querySelector('.sidebar-nav');
          if (nav) setTimeout(() => header.scrollIntoView({ behavior:'smooth', block:'nearest' }), 50);
        } else {
          this.saveOpen('');
        }
      });
    });
  }
};

// ── BOOT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  CFC_SIDEBAR.init();
  CFC_NAV.init();
});
