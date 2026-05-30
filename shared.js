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



// ── QUICK ADD POPUP — Add New record without leaving page ────────────────────
// Usage: CFC_QUICK_ADD.show('customer') → modal opens → save → returns new record
// Supports: item, customer, supplier, worker, machine, die

window.CFC_QUICK_ADD = {

  FORMS: {
    item: {
      title: '+ New Item',
      icon: '&#128230;',
      fields: [
        { id: 'qa-code',  label: 'Item Code',  type: 'text',   required: true,  placeholder: 'e.g. RM05' },
        { id: 'qa-name',  label: 'Item Name',  type: 'text',   required: true,  placeholder: 'Full name' },
        { id: 'qa-type',  label: 'Type',       type: 'select', required: true,
          options: ['RM','FG','SFG','Consumable','Packing'] },
        { id: 'qa-uom',   label: 'UOM',        type: 'select', required: true,
          options: ['Kg','Set','Pcs','Ltr','Mtr','Box','Nos'] },
        { id: 'qa-hsn',   label: 'HSN Code',   type: 'text',   required: false, placeholder: 'e.g. 8708' },
        { id: 'qa-tax',   label: 'Tax Rate %', type: 'number', required: false, placeholder: '28' },
      ],
      table: 'items',
      payload: () => ({
        code:     document.getElementById('qa-code').value.trim().toUpperCase(),
        name:     document.getElementById('qa-name').value.trim(),
        type:     document.getElementById('qa-type').value,
        uom:      document.getElementById('qa-uom').value,
        hsn_code: document.getElementById('qa-hsn').value.trim()||null,
        tax_rate: parseFloat(document.getElementById('qa-tax').value)||28,
        is_active: true,
      }),
    },

    customer: {
      title: '+ New Customer',
      icon: '&#128101;',
      fields: [
        { id: 'qa-code',  label: 'Customer Code', type: 'text', required: true,  placeholder: 'e.g. CUST-001' },
        { id: 'qa-name',  label: 'Company Name',  type: 'text', required: true,  placeholder: 'Full name' },
        { id: 'qa-phone', label: 'Phone',         type: 'text', required: false, placeholder: '9876543210' },
        { id: 'qa-gstin', label: 'GSTIN',         type: 'text', required: false, placeholder: '22AAAAA0000A1Z5' },
        { id: 'qa-state', label: 'State',         type: 'text', required: false, placeholder: 'Maharashtra' },
      ],
      table: 'customers',
      payload: () => ({
        code:    document.getElementById('qa-code').value.trim().toUpperCase(),
        name:    document.getElementById('qa-name').value.trim(),
        phone:   document.getElementById('qa-phone').value.trim()||null,
        gstin:   document.getElementById('qa-gstin').value.trim()||null,
        state:   document.getElementById('qa-state').value.trim()||null,
        is_active: true,
      }),
    },

    supplier: {
      title: '+ New Supplier',
      icon: '&#128666;',
      fields: [
        { id: 'qa-code',  label: 'Supplier Code', type: 'text', required: true,  placeholder: 'e.g. SUP-001' },
        { id: 'qa-name',  label: 'Company Name',  type: 'text', required: true,  placeholder: 'Full name' },
        { id: 'qa-phone', label: 'Phone',         type: 'text', required: false, placeholder: '9876543210' },
        { id: 'qa-gstin', label: 'GSTIN',         type: 'text', required: false, placeholder: '22AAAAA0000A1Z5' },
        { id: 'qa-pay',   label: 'Payment Terms', type: 'text', required: false, placeholder: 'e.g. 30 days' },
      ],
      table: 'suppliers',
      payload: () => ({
        code:          document.getElementById('qa-code').value.trim().toUpperCase(),
        name:          document.getElementById('qa-name').value.trim(),
        phone:         document.getElementById('qa-phone').value.trim()||null,
        gstin:         document.getElementById('qa-gstin').value.trim()||null,
        payment_terms: document.getElementById('qa-pay').value.trim()||null,
        is_active: true,
      }),
    },

    worker: {
      title: '+ New Worker',
      icon: '&#128104;',
      fields: [
        { id: 'qa-code',  label: 'Worker Code', type: 'text',   required: true,  placeholder: 'e.g. WRK-010' },
        { id: 'qa-name',  label: 'Full Name',   type: 'text',   required: true,  placeholder: 'Name' },
        { id: 'qa-role',  label: 'Role',        type: 'select', required: false,
          options: ['Operator','Helper','Supervisor','QC','Store','Manager'] },
        { id: 'qa-dept',  label: 'Department',  type: 'text',   required: false, placeholder: 'Mixing' },
        { id: 'qa-phone', label: 'Phone',       type: 'text',   required: false, placeholder: '9876543210' },
      ],
      table: 'workers',
      payload: () => ({
        code:       document.getElementById('qa-code').value.trim().toUpperCase(),
        name:       document.getElementById('qa-name').value.trim(),
        role:       document.getElementById('qa-role').value||'Operator',
        department: document.getElementById('qa-dept').value.trim()||null,
        phone:      document.getElementById('qa-phone').value.trim()||null,
        is_active: true,
      }),
    },

    machine: {
      title: '+ New Machine',
      icon: '&#9881;',
      fields: [
        { id: 'qa-code',    label: 'Machine Code',   type: 'text',   required: true,  placeholder: 'e.g. MCH-01' },
        { id: 'qa-name',    label: 'Machine Name',   type: 'text',   required: true,  placeholder: 'Full name' },
        { id: 'qa-process', label: 'Process',        type: 'text',   required: true,  placeholder: 'Moulding' },
        { id: 'qa-cap',     label: 'Capacity/Hr',    type: 'number', required: false, placeholder: '100' },
      ],
      table: 'machines',
      payload: () => ({
        code:         document.getElementById('qa-code').value.trim().toUpperCase(),
        name:         document.getElementById('qa-name').value.trim(),
        process_name: document.getElementById('qa-process').value.trim(),
        capacity_per_hour: parseFloat(document.getElementById('qa-cap').value)||null,
        is_active: true,
      }),
    },

    die: {
      title: '+ New Die',
      icon: '&#128295;',
      fields: [
        { id: 'qa-code',    label: 'Die Code',     type: 'text',   required: true,  placeholder: 'e.g. DIE-001' },
        { id: 'qa-name',    label: 'Die Name',     type: 'text',   required: false, placeholder: 'Description' },
        { id: 'qa-cavity',  label: 'Cavity Count', type: 'number', required: true,  placeholder: '2' },
        { id: 'qa-cycle',   label: 'Cycle Time (min)', type: 'number', required: false, placeholder: '8.5' },
      ],
      table: 'dies',
      payload: () => ({
        die_code:      document.getElementById('qa-code').value.trim().toUpperCase(),
        die_name:      document.getElementById('qa-name').value.trim()||null,
        cavity_count:  parseInt(document.getElementById('qa-cavity').value)||1,
        cycle_time_min: parseFloat(document.getElementById('qa-cycle').value)||8.5,
        is_active: true,
      }),
    },
  },

  _onSave: null,

  show(type, onSave) {
    this._onSave = onSave || null;
    const cfg = this.FORMS[type];
    if (!cfg) { console.warn('CFC_QUICK_ADD: unknown type', type); return; }

    // Create or reuse overlay
    let overlay = document.getElementById('cfc-qa-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'cfc-qa-overlay';
      overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center;';
      overlay.setAttribute('role','dialog');
      overlay.setAttribute('aria-modal','true');
      document.body.appendChild(overlay);
    }

    const fieldsHtml = cfg.fields.map(f => {
      const req = f.required ? '<span style="color:#dc2626;">*</span>' : '';
      let input = '';
      if (f.type === 'select') {
        input = `<select id="${f.id}" style="width:100%;border:1.5px solid #e2e8f0;border-radius:7px;padding:9px 12px;font-size:13.5px;background:#f9fafb;outline:none;">
          ${f.options.map(o=>`<option value="${o}">${o}</option>`).join('')}
        </select>`;
      } else {
        input = `<input type="${f.type}" id="${f.id}" placeholder="${f.placeholder||''}"
          style="width:100%;border:1.5px solid #e2e8f0;border-radius:7px;padding:9px 12px;font-size:13.5px;background:#f9fafb;outline:none;"
          ${f.required ? 'required' : ''}/>`;
      }
      return `<div style="margin-bottom:12px;">
        <label style="display:block;font-size:13px;font-weight:600;color:#4a5568;margin-bottom:5px;">${f.label} ${req}</label>
        ${input}
        <div id="${f.id}-err" style="color:#dc2626;font-size:11.5px;margin-top:2px;display:none;"></div>
      </div>`;
    }).join('');

    overlay.innerHTML = `
      <div style="background:#fff;border-radius:12px;width:100%;max-width:460px;
                  box-shadow:0 24px 60px rgba(0,0,0,0.2);max-height:92vh;overflow-y:auto;margin:16px;">
        <!-- Header -->
        <div style="padding:18px 22px 14px;border-bottom:1px solid #f0f4f8;
                    display:flex;align-items:center;justify-content:space-between;">
          <h3 style="font-size:17px;font-weight:700;color:#1c2d42;">
            ${cfg.icon} ${cfg.title}
          </h3>
          <button type="button" onclick="CFC_QUICK_ADD.close()"
            style="font-size:22px;cursor:pointer;color:#8a95a0;background:none;border:none;line-height:1;">✕</button>
        </div>
        <!-- Body -->
        <div style="padding:20px 22px;">
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;
                      padding:10px 14px;font-size:12.5px;color:#1e40af;margin-bottom:16px;">
            ℹ️ Quick add — mandatory fields. Full details baad mein master page pe update karo.
          </div>
          ${fieldsHtml}
        </div>
        <!-- Footer -->
        <div style="padding:14px 22px;border-top:1px solid #f0f4f8;
                    display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <a href="${this.FORMS[type]?.table ? '' : '#'}" 
             onclick="window.open(CFC_QUICK_ADD.FORMS['${type}'] ? '${this.FORMS[type].table}.html' : '#','_blank');return false;"
             style="font-size:13px;color:#5a6878;text-decoration:none;">
            📄 Open Full Form →
          </a>
          <div style="display:flex;gap:8px;">
            <button type="button" onclick="CFC_QUICK_ADD.close()"
              style="padding:9px 18px;border-radius:6px;border:1px solid #dde3ea;
                     background:#fff;font-size:13.5px;font-weight:600;cursor:pointer;">Cancel</button>
            <button type="button" id="cfc-qa-save-btn" onclick="CFC_QUICK_ADD.save('${type}')"
              style="padding:9px 20px;border-radius:6px;border:none;background:#cc2200;
                     color:#fff;font-size:13.5px;font-weight:600;cursor:pointer;">
              Save
            </button>
          </div>
        </div>
      </div>`;

    overlay.style.display = 'flex';
    overlay.onclick = (e) => { if (e.target === overlay) this.close(); };

    // Focus first input
    setTimeout(() => {
      const first = overlay.querySelector('input,select');
      if (first) first.focus();
    }, 100);

    // Enter key saves
    overlay.addEventListener('keydown', this._keyHandler = (e) => {
      if (e.key === 'Escape') this.close();
    });
  },

  close() {
    const overlay = document.getElementById('cfc-qa-overlay');
    if (overlay) overlay.style.display = 'none';
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
  },

  async save(type) {
    const cfg = this.FORMS[type];
    if (!cfg) return;

    // Validate required fields
    let hasError = false;
    cfg.fields.forEach(f => {
      const el = document.getElementById(f.id);
      const err = document.getElementById(f.id + '-err');
      if (!el) return;
      if (f.required && !el.value.trim()) {
        el.style.borderColor = '#dc2626';
        if (err) { err.textContent = f.label + ' zaroori hai'; err.style.display = 'block'; }
        hasError = true;
      } else {
        el.style.borderColor = '';
        if (err) err.style.display = 'none';
      }
    });
    if (hasError) return;

    // Save
    const btn = document.getElementById('cfc-qa-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    const payload = cfg.payload();
    const { data, error } = await CFC_SB.from(cfg.table).insert([payload]).select().single();

    if (btn) { btn.disabled = false; btn.textContent = 'Save'; }

    if (error) {
      if (window.showToast) showToast('Error: ' + error.message, 'error');
      return;
    }

    // Clear cache so live search gets fresh data
    if (window.CFC_LS) CFC_LS.clearCache(type);

    if (window.showToast) showToast(cfg.title.replace('+ New ','') + ' added: ' + (data.name||data.code||data.die_code||data.wo_no), 'success');
    this.close();

    // Fire callback with new record
    if (this._onSave) this._onSave(data);
  },
};

// ── LIVE SEARCH FIELD COMPONENT (Production Grade) ───────────────────────────
// Usage: CFC_LS.attach('input-id', 'hidden-id', 'supplier', { onCreate: fn })
// Types: 'item','customer','supplier','worker','machine','die','wo','po','so'

window.CFC_LS = {

  // Data cache — loaded once per session per type
  _cache: {},

  // Type config — what to fetch, how to display, where to go to add new
  TYPES: {
    item:     { table:'items',          select:'id,code,name,type,uom,hsn_code,tax_rate', filter:'is_active=true', label: x=>`${x.code} — ${x.name}`, sub: x=>x.type, icon:'&#128230;', addHref:'item_master.html',    addLabel:'+ New Item'     },
    customer: { table:'customers',      select:'id,code,name,gstin,state_code',           filter:'is_active=true', label: x=>`${x.code} — ${x.name}`, sub: x=>'Customer', icon:'&#128101;', addHref:'customer.html',   addLabel:'+ New Customer' },
    supplier: { table:'suppliers',      select:'id,code,name,gstin',                      filter:'is_active=true', label: x=>`${x.code} — ${x.name}`, sub: x=>'Supplier', icon:'&#128666;', addHref:'supplier.html',   addLabel:'+ New Supplier' },
    worker:   { table:'workers',        select:'id,code,name,role,department',            filter:'is_active=true', label: x=>`${x.name} (${x.role||''})`, sub: x=>x.code, icon:'&#128104;', addHref:'workers.html',    addLabel:'+ New Worker'   },
    machine:  { table:'machines',       select:'id,code,name,status',                     filter:'',               label: x=>`${x.code} — ${x.name}`, sub: x=>x.status||'', icon:'&#9881;', addHref:'machines.html',  addLabel:'+ New Machine'  },
    die:      { table:'dies',           select:'id,die_code,die_name,cavity_count',       filter:'is_active=true', label: x=>`${x.die_code} — ${x.die_name||''}`, sub: x=>`${x.cavity_count||0} cavity`, icon:'&#128295;', addHref:'dies.html', addLabel:'+ New Die' },
    wo:       { table:'work_orders',    select:'id,wo_no,process_name,status',            filter:'',               label: x=>`${x.wo_no}`,            sub: x=>x.process_name||x.status, icon:'&#127981;', addHref:'work_orders.html', addLabel:'+ New WO' },
    po:       { table:'purchase_orders',select:'id,po_no,status',                         filter:'',               label: x=>`${x.po_no}`,            sub: x=>x.status, icon:'&#128715;', addHref:'purchase_order.html', addLabel:'+ New PO'   },
    so:       { table:'sales_orders',   select:'id,so_no,status',                         filter:'',               label: x=>`${x.so_no}`,            sub: x=>x.status, icon:'&#128188;', addHref:'sales_order.html',    addLabel:'+ New SO'   },
    item_fg:  { table:'items',          select:'id,code,name,type,uom',                   filter:'is_active=true', label: x=>`${x.code} — ${x.name}`, sub: x=>x.type, icon:'&#128230;', addHref:'item_master.html',    addLabel:'+ New Item', extraFilter: x=>x.type==='FG'||x.type==='SFG' },
    item_rm:  { table:'items',          select:'id,code,name,type,uom',                   filter:'is_active=true', label: x=>`${x.code} — ${x.name}`, sub: x=>x.type, icon:'&#128230;', addHref:'item_master.html',    addLabel:'+ New Item', extraFilter: x=>x.type==='RM'||x.type==='Consumable'||x.type==='Packing' },
  },

  async _load(type) {
    if (this._cache[type]) return this._cache[type];
    const cfg = this.TYPES[type];
    if (!cfg || !window.CFC_SB) return [];
    let q = CFC_SB.from(cfg.table).select(cfg.select).limit(500);
    if (cfg.filter) {
      const [col, val] = cfg.filter.split('=');
      q = q.eq(col, val === 'true' ? true : val);
    }
    const { data } = await q;
    let result = data || [];
    if (cfg.extraFilter) result = result.filter(cfg.extraFilter);
    this._cache[type] = result;
    return result;
  },

  // Main attach function
  // inputId: text input id
  // hiddenId: hidden input id (stores selected value id)
  // type: key from TYPES
  // opts: { onSelect(item), onCreate(), placeholder, returnObj }
  attach(inputId, hiddenId, type, opts = {}) {
    const inp = document.getElementById(inputId);
    const hid = document.getElementById(hiddenId);
    if (!inp) return;

    const cfg = this.TYPES[type];
    if (!cfg) { console.warn('CFC_LS: unknown type', type); return; }

    // Create dropdown if not exists
    let dd = document.getElementById(inputId + '-ls-dd');
    if (!dd) {
      dd = document.createElement('div');
      dd.id = inputId + '-ls-dd';
      dd.className = 'ls-dd';
      dd.style.cssText = 'display:none;position:fixed;background:#fff;border:1px solid #dde3ea;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:9999;max-height:260px;overflow-y:auto;min-width:280px;';
      document.body.appendChild(dd);
    }

    const show = (items, q) => {
      const r = inp.getBoundingClientRect();
      dd.style.top  = (r.bottom + window.scrollY + 4) + 'px';
      dd.style.left = r.left + 'px';
      dd.style.width = Math.max(r.width, 280) + 'px';
      dd.style.display = 'block';

      const filtered = items.filter(x => cfg.label(x).toLowerCase().includes(q) || (cfg.sub(x)||'').toLowerCase().includes(q));

      let html = filtered.slice(0, 10).map(x => {
        const label = cfg.label(x);
        const sub = cfg.sub(x);
        const highlighted = label.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'), m=>`<strong>${m}</strong>`);
        return `<div class="ls-row" style="padding:9px 12px;cursor:pointer;border-bottom:1px solid #f0f4f8;display:flex;align-items:center;gap:8px;"
          onmousedown="CFC_LS._pick('${inputId}','${hiddenId}',${x.id},${JSON.stringify(label)},${JSON.stringify(x)})">
          <span style="font-size:15px;">${cfg.icon}</span>
          <div>
            <div style="font-size:13px;font-weight:500;color:#1a2635;">${highlighted}</div>
            ${sub ? `<div style="font-size:11px;color:#8a95a0;">${sub}</div>` : ''}
          </div>
        </div>`;
      }).join('');

      if (!filtered.length) {
        html = `<div style="padding:12px;text-align:center;color:#8a95a0;font-size:13px;">
          "${q}" nahi mila</div>`;
      }

      // Add New option
      const addFn = opts.onCreate
        ? `CFC_LS._onCreate('${inputId}','${type}')`
        : `window.location.href='${cfg.addHref}'`;
      html += `<div class="ls-add" onmousedown="${addFn}"
        style="padding:9px 12px;cursor:pointer;background:#fafbfc;border-top:2px solid #e2e8f0;
               display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--red);">
        <span>➕</span> ${cfg.addLabel}
      </div>`;

      dd.innerHTML = html;
    };

    let _allData = [];
    let _t;

    inp.addEventListener('focus', async () => {
      _allData = await CFC_LS._load(type);
    });

    inp.addEventListener('input', () => {
      clearTimeout(_t);
      _t = setTimeout(() => {
        const q = inp.value.trim().toLowerCase();
        if (!q) { dd.style.display = 'none'; if(hid) hid.value = ''; return; }
        if (!_allData.length) {
          CFC_LS._load(type).then(data => { _allData = data; show(_allData, q); });
        } else {
          show(_allData, q);
        }
      }, 200);
    });

    inp.addEventListener('blur', () => {
      setTimeout(() => { dd.style.display = 'none'; }, 200);
    });

    inp.setAttribute('autocomplete', 'off');
    inp.setAttribute('placeholder', opts.placeholder || `Search ${type}...`);
  },

  _pick(inputId, hiddenId, id, label, obj) {
    const inp = document.getElementById(inputId);
    const hid = document.getElementById(hiddenId);
    const dd = document.getElementById(inputId + '-ls-dd');
    if (inp) inp.value = label;
    if (hid) hid.value = id;
    if (dd) dd.style.display = 'none';

    // Fire onSelect callback if registered
    const key = inputId + '_onSelect';
    if (window[key]) window[key](obj, id, label);
  },

  _onCreate(inputId, type, onSave) {
    const dd = document.getElementById(inputId + '-ls-dd');
    if (dd) dd.style.display = 'none';
    // Use Quick Add popup — no page navigation needed!
    CFC_QUICK_ADD.show(type, function(newRecord) {
      // Auto-fill the search field with new record
      const inp = document.getElementById(inputId);
      const hid = document.getElementById(inputId.replace('-search','') === inputId 
        ? inputId + '-id' : inputId.replace('-search','-id'));
      const cfg2 = CFC_LS.TYPES[type];
      if (inp && cfg2) inp.value = cfg2.label(newRecord);
      // Try hidden field variants
      const hid1 = document.getElementById(inputId.replace('-search','-id'));
      const hid2 = document.getElementById(inputId.replace('-search',''));
      if (hid1) hid1.value = newRecord.id;
      else if (hid2) hid2.value = newRecord.id;
      // Fire onSelect
      const key = inputId + '_onSelect';
      if (window[key]) window[key](newRecord, newRecord.id, cfg2 ? cfg2.label(newRecord) : '');
    });
  },

  // Helper: clear cache for a type (after adding new record)
  clearCache(type) {
    delete this._cache[type];
  },

  // Helper: set onSelect callback
  onSelect(inputId, fn) {
    window[inputId + '_onSelect'] = fn;
  },
};

// ── 6. CENTRAL NAV SEARCH ────────────────────────────────────────────────────
window.CFC_NAV = {
  pages: [
    ["dashboard.html",      "Dashboard",        "&#128200;", "page"],
    ["item_master.html",    "Item Master",       "&#128230;", "page"],
    ["warehouse.html",      "Warehouse",         "&#127981;", "page"],
    ["bom.html",            "BOM Master",        "&#128196;", "page"],
    ["routing.html",        "Routing Master",    "&#9881;",   "page"],
    ["dies.html",           "Dies",              "&#128295;", "page"],
    ["machines.html",       "Machine Master",    "&#9881;",   "page"],
    ["work_orders.html",    "Work Orders",       "&#128203;", "page"],
    ["production_plan.html","Production Plan",   "&#128203;", "page"],
    ["mrp.html",            "MRP",               "&#128202;", "page"],
    ["labour.html",         "Labour Planning",   "&#128101;", "page"],
    ["job_cards.html",      "Job Cards",         "&#128196;", "page"],
    ["workers.html",        "Workers",           "&#128104;", "page"],
    ["purchase_order.html", "Purchase Order",    "&#128715;", "page"],
    ["supplier.html",       "Supplier Master",   "&#128666;", "page"],
    ["grn.html",            "GRN",               "&#128230;", "page"],
    ["sales_order.html",    "Sales Order",       "&#128188;", "page"],
    ["customer.html",       "Customer Master",   "&#128101;", "page"],
    ["dispatch.html",       "Dispatch",          "&#128666;", "page"],
    ["stock_ledger.html",   "Stock Ledger",      "&#128230;", "page"],
    ["invoice.html",        "Invoice",           "&#129534;", "page"],
    ["qc.html",             "Quality Control",   "&#9989;",   "page"],
    ["reports.html",        "Reports & MIS",     "&#128202;", "page"],
  ],

  _liveData: [],
  _loaded: false,

  async loadLiveData() {
    if (this._loaded) return;
    if (!window.CFC_SB) return;
    try {
      const [items, custs, supps, machines, workers, wos] = await Promise.all([
        CFC_SB.from('items').select('id,code,name,type').eq('is_active',true).limit(500),
        CFC_SB.from('customers').select('id,code,name').eq('is_active',true).limit(200),
        CFC_SB.from('suppliers').select('id,code,name').eq('is_active',true).limit(200),
        CFC_SB.from('machines').select('id,code,name').limit(200),
        CFC_SB.from('workers').select('id,code,name,role').eq('is_active',true).limit(200),
        CFC_SB.from('work_orders').select('id,wo_no,process_name,status').in('status',['Pending','Assigned','In Progress']).limit(100),
      ]);

      this._liveData = [
        ...(items.data||[]).map(x=>({
          label: x.code + ' — ' + x.name,
          sub: x.type,
          icon: '&#128230;',
          type: 'item',
          href: 'item_master.html',
          color: '#1e40af'
        })),
        ...(custs.data||[]).map(x=>({
          label: x.code + ' — ' + x.name,
          sub: 'Customer',
          icon: '&#128101;',
          type: 'customer',
          href: 'customer.html',
          color: '#166534'
        })),
        ...(supps.data||[]).map(x=>({
          label: x.code + ' — ' + x.name,
          sub: 'Supplier',
          icon: '&#128666;',
          type: 'supplier',
          href: 'supplier.html',
          color: '#854d0e'
        })),
        ...(machines.data||[]).map(x=>({
          label: x.code + ' — ' + x.name,
          sub: 'Machine',
          icon: '&#9881;',
          type: 'machine',
          href: 'machines.html',
          color: '#6d28d9'
        })),
        ...(workers.data||[]).map(x=>({
          label: x.name + ' (' + (x.role||'') + ')',
          sub: 'Worker — ' + x.code,
          icon: '&#128104;',
          type: 'worker',
          href: 'workers.html',
          color: '#0f766e'
        })),
        ...(wos.data||[]).map(x=>({
          label: x.wo_no + ' — ' + (x.process_name||''),
          sub: 'WO — ' + x.status,
          icon: '&#127981;',
          type: 'wo',
          href: 'work_orders.html',
          color: '#854d0e'
        })),
      ];
      this._loaded = true;
    } catch(e) {
      // Silent fail — live data optional
    }
  },

  init() {
    const inp = document.getElementById('central-search');
    const dd  = document.getElementById('central-dd');
    if (!inp || !dd) return;

    // Load live data on first focus
    inp.addEventListener('focus', () => {
      if (!this._loaded) this.loadLiveData();
    }, { once: true });

    const doSearch = (q) => {
      if (!q) { dd.classList.remove('open'); return; }

      // Search pages
      const pageResults = this.pages
        .filter(([,name]) => name.toLowerCase().includes(q))
        .slice(0,4)
        .map(([href, name, icon]) => `
          <a class="search-item" href="${href}">
            <span class="si-icon">${icon}</span>
            <div class="si-text">
              <span class="si-name">${name}</span>
              <span class="si-hint">Page</span>
            </div>
          </a>`).join('');

      // Search live data
      const liveResults = this._liveData
        .filter(x => x.label.toLowerCase().includes(q) || x.sub.toLowerCase().includes(q))
        .slice(0,6)
        .map(x => `
          <a class="search-item" href="${x.href}">
            <span class="si-icon">${x.icon}</span>
            <div class="si-text">
              <span class="si-name">${x.label}</span>
              <span class="si-hint" style="color:${x.color};">${x.sub}</span>
            </div>
          </a>`).join('');

      // Build dropdown
      let html = '';

      if (pageResults) {
        html += '<div class="search-section-label">Pages</div>' + pageResults;
      }
      if (liveResults) {
        html += '<div class="search-section-label">Records</div>' + liveResults;
      }
      if (!html) {
        html = '<div class="search-empty">No results for "' + q + '"</div>';
      }

      dd.innerHTML = html;
      dd.classList.add('open');
    };

    let _t;
    inp.addEventListener('input', function() {
      clearTimeout(_t);
      _t = setTimeout(() => doSearch(inp.value.toLowerCase().trim()), 250);
    });

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
