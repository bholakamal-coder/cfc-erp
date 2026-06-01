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
  VERSION:      '3.0.7.5',
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




// ════════════════════════════════════════════════════════════════════════════
// CFC ERP v2.1 — Import/Export System
// Features:
//   CFC_EXPORT.csv(data, filename, columns)  — export any data as CSV
//   CFC_EXPORT.template(type)                — download import template
//   CFC_IMPORT.show(type, onSuccess)         — smart import with header mapping
// ════════════════════════════════════════════════════════════════════════════

// ── EXPORT MODULE ─────────────────────────────────────────────────────────────
window.CFC_EXPORT = {

  // columns: [{key, label}] — optional, if not provided uses object keys
  csv(data, filename, columns) {
    if (!data || !data.length) {
      showToast('Export ke liye koi data nahi.', 'error');
      return;
    }
    const cols = columns || Object.keys(data[0]).map(k => ({ key: k, label: k }));
    const header = cols.map(c => '"' + c.label + '"').join(',');
    const rows = data.map(row =>
      cols.map(c => {
        const val = row[c.key] ?? '';
        return '"' + String(val).replace(/"/g, '""') + '"';
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename + '_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    showToast('CSV exported: ' + data.length + ' records', 'success');
  },

  // Download blank template with correct headers + sample row
  template(type) {
    const cfg = CFC_IMPORT.SCHEMAS[type];
    if (!cfg) { showToast('Template nahi mila.', 'error'); return; }
    const header = cfg.fields.map(f => '"' + f.label + '"').join(',');
    const sample = cfg.fields.map(f => '"' + (f.sample || '') + '"').join(',');
    const notes  = cfg.fields.map(f => '"' + (f.required ? 'REQUIRED' : 'optional') + '"').join(',');
    const csv = [
      '# CFC ERP Import Template — ' + cfg.title,
      '# Row 2 = field notes (delete before import)',
      '# Row 3 = sample data (delete before import)',
      header,
      notes,
      sample,
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'import_template_' + type + '.csv';
    a.click();
    showToast('Template downloaded!', 'success');
  },
};

// ── IMPORT MODULE ─────────────────────────────────────────────────────────────
window.CFC_IMPORT = {

  // Schema for each importable type
  // fields: [{key, label, required, sample, type, options}]
  SCHEMAS: {
    item: {
      title: 'Items',
      table: 'items',
      fields: [
        { key: 'code',     label: 'Item Code',  required: true,  sample: 'RM01',    type: 'text'   },
        { key: 'name',     label: 'Item Name',  required: true,  sample: 'Raw Material Type 1', type: 'text' },
        { key: 'type',     label: 'Type',       required: true,  sample: 'RM',      type: 'select', options: ['RM','FG','SFG','Consumable','Packing'] },
        { key: 'uom',      label: 'UOM',        required: true,  sample: 'Kg',      type: 'text'   },
        { key: 'hsn_code', label: 'HSN Code',   required: false, sample: '8708',    type: 'text'   },
        { key: 'tax_rate', label: 'Tax Rate %', required: false, sample: '28',      type: 'number' },
      ],
      uniqueKey: 'code',
      transform: row => ({ ...row, tax_rate: parseFloat(row.tax_rate)||28, is_active: true }),
    },
    customer: {
      title: 'Customers',
      table: 'customers',
      fields: [
        { key: 'code',    label: 'Customer Code', required: true,  sample: 'CUST001', type: 'text' },
        { key: 'name',    label: 'Company Name',  required: true,  sample: 'ABC Pvt Ltd', type: 'text' },
        { key: 'phone',   label: 'Phone',         required: false, sample: '9876543210', type: 'text' },
        { key: 'email',   label: 'Email',         required: false, sample: 'abc@example.com', type: 'text' },
        { key: 'gstin',   label: 'GSTIN',         required: false, sample: '22AAAAA0000A1Z5', type: 'text' },
        { key: 'state',   label: 'State',         required: false, sample: 'Maharashtra', type: 'text' },
        { key: 'address', label: 'Address',       required: false, sample: '123 Main St', type: 'text' },
        { key: 'city',    label: 'City',          required: false, sample: 'Mumbai', type: 'text' },
        { key: 'credit_days', label: 'Credit Days', required: false, sample: '30', type: 'number' },
      ],
      uniqueKey: 'code',
      transform: row => ({ ...row, credit_days: parseInt(row.credit_days)||30, is_active: true }),
    },
    supplier: {
      title: 'Suppliers',
      table: 'suppliers',
      fields: [
        { key: 'code',          label: 'Supplier Code',  required: true,  sample: 'SUP001', type: 'text' },
        { key: 'name',          label: 'Company Name',   required: true,  sample: 'XYZ Suppliers', type: 'text' },
        { key: 'phone',         label: 'Phone',          required: false, sample: '9876543210', type: 'text' },
        { key: 'email',         label: 'Email',          required: false, sample: 'xyz@example.com', type: 'text' },
        { key: 'gstin',         label: 'GSTIN',          required: false, sample: '22BBBBB0000B1Z5', type: 'text' },
        { key: 'state',         label: 'State',          required: false, sample: 'Gujarat', type: 'text' },
        { key: 'address',       label: 'Address',        required: false, sample: '456 Market Rd', type: 'text' },
        { key: 'payment_terms', label: 'Payment Terms',  required: false, sample: '30 days net', type: 'text' },
      ],
      uniqueKey: 'code',
      transform: row => ({ ...row, is_active: true }),
    },
    worker: {
      title: 'Workers',
      table: 'workers',
      fields: [
        { key: 'code',        label: 'Worker Code',  required: true,  sample: 'WRK001', type: 'text' },
        { key: 'name',        label: 'Full Name',    required: true,  sample: 'Ramesh Kumar', type: 'text' },
        { key: 'role',        label: 'Role',         required: false, sample: 'Operator', type: 'select', options: ['Operator','Helper','Supervisor','QC','Store','Manager'] },
        { key: 'department',  label: 'Department',   required: false, sample: 'Moulding', type: 'text' },
        { key: 'shift',       label: 'Shift',        required: false, sample: 'Morning', type: 'text' },
        { key: 'phone',       label: 'Phone',        required: false, sample: '9876543210', type: 'text' },
        { key: 'daily_wage',  label: 'Daily Wage',   required: false, sample: '600', type: 'number' },
        { key: 'joining_date',label: 'Joining Date', required: false, sample: '2024-01-15', type: 'date' },
      ],
      uniqueKey: 'code',
      transform: row => ({ ...row, daily_wage: parseFloat(row.daily_wage)||0, is_active: true }),
    },
    machine: {
      title: 'Machines',
      table: 'machines',
      fields: [
        { key: 'code',               label: 'Machine Code',    required: true,  sample: 'MCH001', type: 'text' },
        { key: 'name',               label: 'Machine Name',    required: true,  sample: 'Hydraulic Press 1', type: 'text' },
        { key: 'process_name',       label: 'Process Name',    required: true,  sample: 'Moulding', type: 'text' },
        { key: 'capacity_per_hour',  label: 'Capacity/Hr',     required: false, sample: '100', type: 'number' },
        { key: 'make',               label: 'Make/Brand',      required: false, sample: 'BHEL', type: 'text' },
        { key: 'model',              label: 'Model No',        required: false, sample: 'HP-200', type: 'text' },
      ],
      uniqueKey: 'code',
      transform: row => ({ ...row, capacity_per_hour: parseFloat(row.capacity_per_hour)||null, is_active: true }),
    },
    die: {
      title: 'Dies',
      table: 'dies',
      fields: [
        { key: 'die_code',      label: 'Die Code',       required: true,  sample: 'DIE001', type: 'text' },
        { key: 'die_name',      label: 'Die Name',       required: false, sample: 'HE10 Die Set', type: 'text' },
        { key: 'cavity_count',  label: 'Cavity Count',   required: true,  sample: '2', type: 'number' },
        { key: 'cycle_time_min',label: 'Cycle Time (min)',required: false, sample: '8.5', type: 'number' },
      ],
      uniqueKey: 'die_code',
      transform: row => ({ ...row, cavity_count: parseInt(row.cavity_count)||1, cycle_time_min: parseFloat(row.cycle_time_min)||8.5, is_active: true }),
    },
  },

  _type: null,
  _onSuccess: null,
  _fileHeaders: [],
  _fileData: [],
  _mapping: {},

  show(type, onSuccess) {
    this._type = type;
    this._onSuccess = onSuccess || null;
    const cfg = this.SCHEMAS[type];
    if (!cfg) return;

    let overlay = document.getElementById('cfc-import-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'cfc-import-overlay';
      overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px 10px;';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div style="background:#fff;border-radius:12px;width:100%;max-width:640px;
                  box-shadow:0 24px 60px rgba(0,0,0,0.2);margin:auto;">
        <div style="padding:18px 22px 14px;border-bottom:1px solid #f0f4f8;
                    display:flex;align-items:center;justify-content:space-between;">
          <h3 style="font-size:17px;font-weight:700;color:#1c2d42;">
            📥 Import ${cfg.title}
          </h3>
          <button onclick="CFC_IMPORT.close()" 
            style="font-size:22px;cursor:pointer;color:#8a95a0;background:none;border:none;">✕</button>
        </div>

        <div style="padding:20px 22px;" id="cfc-import-body">
          <!-- Step 1: Upload -->
          <div id="import-step1">
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;
                        padding:12px 16px;font-size:13px;color:#1e40af;margin-bottom:16px;line-height:1.6;">
              <strong>Step 1:</strong> Template download karo → Fill karo → Upload karo<br>
              <strong>Step 2:</strong> Headers map karo (agar alag hain)<br>
              <strong>Step 3:</strong> Preview dekho → Import karo
            </div>

            <button onclick="CFC_EXPORT.template('${type}')"
              style="width:100%;padding:10px;border:2px dashed #bfdbfe;border-radius:8px;
                     background:#f0f9ff;color:#1e40af;font-size:13.5px;font-weight:600;
                     cursor:pointer;margin-bottom:14px;">
              ⬇️ Download Import Template (${cfg.title})
            </button>

            <div style="border:2px dashed #dde3ea;border-radius:8px;padding:24px;
                        text-align:center;cursor:pointer;background:#fafbfc;"
                 onclick="document.getElementById('import-file-inp').click()"
                 id="drop-zone"
                 ondragover="event.preventDefault();this.style.borderColor='#cc2200'"
                 ondragleave="this.style.borderColor='#dde3ea'"
                 ondrop="event.preventDefault();this.style.borderColor='#dde3ea';CFC_IMPORT.handleFile(event.dataTransfer.files[0])">
              <div style="font-size:32px;margin-bottom:8px;">📂</div>
              <div style="font-size:14px;font-weight:600;color:#1c2d42;">CSV file yahan drop karo</div>
              <div style="font-size:12px;color:#8a95a0;margin-top:4px;">ya click karke select karo</div>
            </div>
            <input type="file" id="import-file-inp" accept=".csv" style="display:none;"
              onchange="CFC_IMPORT.handleFile(this.files[0])"/>
          </div>

          <!-- Step 2: Header Mapping (hidden initially) -->
          <div id="import-step2" style="display:none;">
            <div style="font-size:14px;font-weight:700;color:#1c2d42;margin-bottom:4px;">
              🔗 Header Mapping
            </div>
            <div style="font-size:12.5px;color:#5a6878;margin-bottom:14px;">
              Aapki file ke headers ko system ke fields se match karo
            </div>
            <div id="import-mapping-table"></div>
            <div style="margin-top:14px;display:flex;gap:10px;justify-content:flex-end;">
              <button onclick="CFC_IMPORT.reset()"
                style="padding:8px 16px;border-radius:6px;border:1px solid #dde3ea;background:#fff;font-size:13px;cursor:pointer;">
                ← Back
              </button>
              <button onclick="CFC_IMPORT.previewData()"
                style="padding:8px 18px;border-radius:6px;border:none;background:#1e40af;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">
                Preview →
              </button>
            </div>
          </div>

          <!-- Step 3: Preview (hidden initially) -->
          <div id="import-step3" style="display:none;">
            <div style="font-size:14px;font-weight:700;color:#1c2d42;margin-bottom:4px;">
              👁️ Import Preview
            </div>
            <div id="import-preview-info" style="font-size:12.5px;color:#5a6878;margin-bottom:12px;"></div>
            <div id="import-preview-table" style="max-height:280px;overflow-y:auto;
                 border:1px solid #e2e8f0;border-radius:8px;"></div>
            <div id="import-errors" style="margin-top:10px;"></div>
            <div style="margin-top:14px;display:flex;gap:10px;justify-content:flex-end;">
              <button onclick="CFC_IMPORT.showStep(2)"
                style="padding:8px 16px;border-radius:6px;border:1px solid #dde3ea;background:#fff;font-size:13px;cursor:pointer;">
                ← Back
              </button>
              <button id="import-confirm-btn" onclick="CFC_IMPORT.doImport()"
                style="padding:8px 20px;border-radius:6px;border:none;background:#cc2200;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">
                ✅ Import Now
              </button>
            </div>
          </div>
        </div>
      </div>`;

    overlay.style.display = 'flex';
    overlay.onclick = e => { if (e.target === overlay) this.close(); };
  },

  close() {
    const el = document.getElementById('cfc-import-overlay');
    if (el) el.style.display = 'none';
    this._fileHeaders = [];
    this._fileData = [];
    this._mapping = {};
  },

  reset() {
    this.showStep(1);
    document.getElementById('import-file-inp').value = '';
  },

  showStep(n) {
    [1,2,3].forEach(i => {
      const el = document.getElementById('import-step' + i);
      if (el) el.style.display = i === n ? 'block' : 'none';
    });
  },

  handleFile(file) {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      showToast('Sirf CSV file allowed hai.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      this.parseCSV(text);
    };
    reader.readAsText(file);
  },

  parseCSV(text) {
    // Remove comment lines (start with #)
    const lines = text.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'));

    if (lines.length < 2) {
      showToast('File mein data nahi hai.', 'error');
      return;
    }

    // Parse headers
    this._fileHeaders = this.splitCSVRow(lines[0]);
    
    // Parse data rows (skip if first row looks like notes row — "REQUIRED/optional")
    let dataStart = 1;
    if (lines[1] && (lines[1].includes('REQUIRED') || lines[1].includes('optional'))) {
      dataStart = 2; // skip notes row
    }
    if (lines[dataStart] && lines[dataStart].includes('sample') || 
        (lines[dataStart] && this._fileHeaders.every((h,i) => {
          const cell = this.splitCSVRow(lines[dataStart])[i];
          return cell && (cell === 'sample' || !cell);
        }))) {
      dataStart++; // skip sample row too
    }

    this._fileData = lines.slice(dataStart)
      .filter(l => l.trim())
      .map(l => this.splitCSVRow(l));

    // Auto-map headers
    this.autoMap();
    this.showMappingUI();
    this.showStep(2);
  },

  splitCSVRow(row) {
    const result = [];
    let cur = '', inQ = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    result.push(cur.trim());
    return result;
  },

  autoMap() {
    const cfg = this.SCHEMAS[this._type];
    this._mapping = {};

    cfg.fields.forEach(field => {
      // Try exact match first
      let match = this._fileHeaders.findIndex(h => 
        h.toLowerCase() === field.label.toLowerCase() ||
        h.toLowerCase() === field.key.toLowerCase()
      );
      
      // Try partial match
      if (match === -1) {
        match = this._fileHeaders.findIndex(h => {
          const hl = h.toLowerCase().replace(/[^a-z0-9]/g,'');
          const fl = field.label.toLowerCase().replace(/[^a-z0-9]/g,'');
          const fk = field.key.toLowerCase().replace(/[^a-z0-9]/g,'');
          return hl.includes(fk) || fk.includes(hl) || hl.includes(fl) || fl.includes(hl);
        });
      }

      if (match !== -1) {
        this._mapping[field.key] = match;
      }
    });
  },

  showMappingUI() {
    const cfg = this.SCHEMAS[this._type];
    const table = document.getElementById('import-mapping-table');

    const headerOptions = ['<option value="-1">-- Skip --</option>',
      ...this._fileHeaders.map((h, i) => `<option value="${i}">${h}</option>`)
    ].join('');

    table.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#5a6878;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">
              System Field
            </th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#5a6878;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">
              Your File Column
            </th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#5a6878;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          ${cfg.fields.map(field => {
            const mappedIdx = this._mapping[field.key] !== undefined ? this._mapping[field.key] : -1;
            const isMapped = mappedIdx !== -1;
            const isRequired = field.required;
            const status = isMapped 
              ? `<span style="color:#166534;font-weight:600;">✅ Mapped</span>`
              : isRequired 
                ? `<span style="color:#dc2626;font-weight:600;">❗ Required</span>`
                : `<span style="color:#8a95a0;">— Skip</span>`;
            
            return `<tr style="border-bottom:1px solid #f0f4f8;">
              <td style="padding:9px 12px;">
                <strong>${field.label}</strong>
                ${isRequired ? '<span style="color:#dc2626;font-size:11px;"> *</span>' : ''}
              </td>
              <td style="padding:9px 12px;">
                <select id="map-${field.key}" onchange="CFC_IMPORT._mapping['${field.key}']=parseInt(this.value)"
                  style="border:1px solid #dde3ea;border-radius:6px;padding:5px 8px;font-size:12.5px;background:#f9fafb;width:100%;">
                  ${headerOptions.replace(
                    `value="${mappedIdx}"`,
                    `value="${mappedIdx}" selected`
                  )}
                </select>
              </td>
              <td style="padding:9px 12px;">${status}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <div style="margin-top:10px;background:#f8fafc;border-radius:6px;padding:10px 12px;font-size:12px;color:#5a6878;">
        📋 File mein <strong>${this._fileData.length}</strong> rows, <strong>${this._fileHeaders.length}</strong> columns detected
      </div>`;
  },

  previewData() {
    const cfg = this.SCHEMAS[this._type];
    
    // Validate required mappings
    const missing = cfg.fields.filter(f => f.required && (this._mapping[f.key] === undefined || this._mapping[f.key] === -1));
    if (missing.length) {
      showToast('Required fields map nahi hue: ' + missing.map(f=>f.label).join(', '), 'error');
      return;
    }

    // Build preview rows
    const rows = this._fileData.slice(0, 5).map(row => {
      const obj = {};
      cfg.fields.forEach(f => {
        const idx = this._mapping[f.key];
        obj[f.key] = (idx !== undefined && idx !== -1) ? (row[idx] || '') : '';
      });
      return obj;
    });

    const allRows = this._fileData.map(row => {
      const obj = {};
      cfg.fields.forEach(f => {
        const idx = this._mapping[f.key];
        obj[f.key] = (idx !== undefined && idx !== -1) ? (row[idx] || '') : '';
      });
      return obj;
    });

    // Validate data
    const errors = [];
    allRows.forEach((row, i) => {
      cfg.fields.filter(f => f.required).forEach(f => {
        if (!row[f.key] || !row[f.key].trim()) {
          errors.push(`Row ${i+2}: ${f.label} missing`);
        }
      });
    });

    // Show preview table
    const previewCols = cfg.fields.filter(f => this._mapping[f.key] !== undefined && this._mapping[f.key] !== -1);
    document.getElementById('import-preview-info').innerHTML = 
      `<strong style="color:#166534;">${allRows.length} rows</strong> import honge &nbsp;|&nbsp; Showing first 5 rows:`;
    
    document.getElementById('import-preview-table').innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#f8fafc;">
          ${previewCols.map(f=>`<th style="padding:7px 10px;text-align:left;font-size:10px;font-weight:700;color:#5a6878;text-transform:uppercase;border-bottom:1px solid #e2e8f0;white-space:nowrap;">${f.label}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${rows.map(row=>`<tr style="border-bottom:1px solid #f0f4f8;">
            ${previewCols.map(f=>`<td style="padding:7px 10px;color:#1a2635;">${row[f.key]||'—'}</td>`).join('')}
          </tr>`).join('')}
        </tbody>
      </table>`;

    const errDiv = document.getElementById('import-errors');
    if (errors.length) {
      errDiv.innerHTML = `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;font-size:12px;color:#991b1b;">
        ⚠️ ${errors.length} validation errors:<br>${errors.slice(0,5).map(e=>'• '+e).join('<br>')}
        ${errors.length > 5 ? '<br>... aur ' + (errors.length-5) + ' more' : ''}
      </div>`;
    } else {
      errDiv.innerHTML = `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px 14px;font-size:12px;color:#166534;">✅ Sab rows valid hain — import ready!</div>`;
    }

    // Store all rows for import
    this._processedRows = allRows;
    this.showStep(3);
  },

  async doImport() {
    const cfg = this.SCHEMAS[this._type];
    const btn = document.getElementById('import-confirm-btn');
    if (!this._processedRows || !this._processedRows.length) return;

    // Step 1: Check for duplicates first
    const uniqueVals = this._processedRows.map(r => r[cfg.uniqueKey]).filter(Boolean);
    const { data: existingRecs } = await CFC_SB
      .from(cfg.table)
      .select(cfg.uniqueKey)
      .in(cfg.uniqueKey, uniqueVals);

    const existingSet = new Set((existingRecs||[]).map(r => r[cfg.uniqueKey]));
    const duplicates = this._processedRows.filter(r => existingSet.has(r[cfg.uniqueKey]));
    const newRows    = this._processedRows.filter(r => !existingSet.has(r[cfg.uniqueKey]));

    // If duplicates found — show choice dialog
    if (duplicates.length > 0) {
      this._showDuplicateChoice(duplicates, newRows, cfg);
      return;
    }

    // No duplicates — import all
    await this._runImport(this._processedRows, 'insert', btn);
  },

  _showDuplicateChoice(duplicates, newRows, cfg) {
    const dupKeys = duplicates.slice(0,5).map(r => r[cfg.uniqueKey]).join(', ');
    const moreCount = duplicates.length > 5 ? ` ... aur ${duplicates.length-5} more` : '';

    // Inject choice UI into preview area
    const previewDiv = document.getElementById('import-preview-table');
    const errDiv     = document.getElementById('import-errors');
    const infoDiv    = document.getElementById('import-preview-info');

    infoDiv.innerHTML = `<strong style="color:#dc2626;">⚠️ ${duplicates.length} duplicate records mili!</strong>`;

    previewDiv.innerHTML = `
      <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:14px 16px;font-size:13px;color:#854d0e;line-height:1.7;">
        <strong>Duplicate ${cfg.uniqueKey}s:</strong><br>
        <span style="font-family:monospace;font-size:12px;">${dupKeys}${moreCount}</span>
      </div>

      <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">

        <div onclick="CFC_IMPORT._selectDupChoice('override',this)"
          id="dup-override"
          style="border:2px solid #e2e8f0;border-radius:10px;padding:14px 12px;cursor:pointer;text-align:center;transition:all 0.15s;">
          <div style="font-size:26px;margin-bottom:6px;">🔄</div>
          <div style="font-weight:700;font-size:13.5px;color:#1c2d42;">Override</div>
          <div style="font-size:11.5px;color:#5a6878;margin-top:4px;line-height:1.4;">
            Existing records update karo nayi values se
          </div>
          <div style="margin-top:8px;font-size:11px;background:#dbeafe;color:#1e40af;padding:3px 8px;border-radius:12px;display:inline-block;">
            ${duplicates.length} update + ${newRows.length} new
          </div>
        </div>

        <div onclick="CFC_IMPORT._selectDupChoice('skip',this)"
          id="dup-skip"
          style="border:2px solid #e2e8f0;border-radius:10px;padding:14px 12px;cursor:pointer;text-align:center;transition:all 0.15s;">
          <div style="font-size:26px;margin-bottom:6px;">⏭️</div>
          <div style="font-weight:700;font-size:13.5px;color:#1c2d42;">Skip</div>
          <div style="font-size:11.5px;color:#5a6878;margin-top:4px;line-height:1.4;">
            Duplicates skip karo, sirf naye records add karo
          </div>
          <div style="margin-top:8px;font-size:11px;background:#dcfce7;color:#166534;padding:3px 8px;border-radius:12px;display:inline-block;">
            Sirf ${newRows.length} new add honge
          </div>
        </div>

        <div onclick="CFC_IMPORT._selectDupChoice('cancel',this)"
          id="dup-cancel"
          style="border:2px solid #e2e8f0;border-radius:10px;padding:14px 12px;cursor:pointer;text-align:center;transition:all 0.15s;">
          <div style="font-size:26px;margin-bottom:6px;">❌</div>
          <div style="font-weight:700;font-size:13.5px;color:#1c2d42;">Cancel</div>
          <div style="font-size:11.5px;color:#5a6878;margin-top:4px;line-height:1.4;">
            Import cancel karo, kuch bhi mat karo
          </div>
          <div style="margin-top:8px;font-size:11px;background:#f1f5f9;color:#475569;padding:3px 8px;border-radius:12px;display:inline-block;">
            0 changes
          </div>
        </div>
      </div>`;

    errDiv.innerHTML = '';

    // Replace footer buttons
    const footer = document.querySelector('#cfc-import-overlay [id="import-confirm-btn"]');
    if (footer) footer.closest('div[style*="justify-content:flex-end"]').innerHTML = `
      <span style="font-size:13px;color:#8a95a0;">Upar se ek option choose karo</span>
      <button id="import-confirm-btn" disabled
        style="padding:8px 20px;border-radius:6px;border:none;background:#ccc;
               color:#fff;font-size:13px;font-weight:600;cursor:not-allowed;">
        ✅ Proceed
      </button>`;

    this._duplicates = duplicates;
    this._newRows    = newRows;
  },

  _selectDupChoice(choice, el) {
    // Highlight selected card
    ['dup-override','dup-skip','dup-cancel'].forEach(id => {
      const card = document.getElementById(id);
      if (card) {
        card.style.borderColor = '#e2e8f0';
        card.style.background  = '';
      }
    });
    el.style.borderColor = '#cc2200';
    el.style.background  = '#fff5f5';

    this._dupChoice = choice;

    // Enable proceed button
    const btn = document.getElementById('import-confirm-btn');
    if (btn) {
      btn.disabled = false;
      btn.style.background = '#cc2200';
      btn.style.cursor = 'pointer';
      btn.onclick = () => CFC_IMPORT._proceedWithChoice();
    }
  },

  async _proceedWithChoice() {
    const cfg = this.SCHEMAS[this._type];
    const btn = document.getElementById('import-confirm-btn');
    const choice = this._dupChoice;

    if (choice === 'cancel') { this.close(); return; }

    if (choice === 'skip') {
      // Only import new rows
      if (!this._newRows.length) {
        showToast('Koi naya record nahi — sab duplicate hain.', '');
        this.close();
        return;
      }
      await this._runImport(this._newRows, 'insert', btn);
    }

    if (choice === 'override') {
      // Insert new + upsert duplicates
      await this._runImport(this._processedRows, 'upsert', btn);
    }
  },

  async _runImport(rows, mode, btn) {
    const cfg = this.SCHEMAS[this._type];
    if (btn) { btn.disabled = true; btn.textContent = 'Importing...'; }

    // Transform rows
    const transformed = rows.map(row => {
      const t = cfg.transform ? cfg.transform({...row}) : {...row};
      Object.keys(t).forEach(k => { if (t[k] === '') t[k] = null; });
      return t;
    });

    let imported = 0, errors = 0;
    const batchSize = 50;

    for (let i = 0; i < transformed.length; i += batchSize) {
      const batch = transformed.slice(i, i + batchSize);
      let result;

      if (mode === 'upsert') {
        result = await CFC_SB.from(cfg.table)
          .upsert(batch, { onConflict: cfg.uniqueKey, ignoreDuplicates: false });
      } else {
        result = await CFC_SB.from(cfg.table).insert(batch);
      }

      if (result.error) {
        console.error('Import error:', result.error);
        errors += batch.length;
        showToast('Error: ' + result.error.message, 'error');
      } else {
        imported += batch.length;
      }
    }

    if (btn) { btn.disabled = false; btn.textContent = '✅ Import Now'; }

    if (!errors) {
      const modeLabel = mode === 'upsert' ? 'imported/updated' : 'imported';
      showToast(`✅ ${imported} records ${modeLabel}!`, 'success');
      this.close();
      if (this._onSuccess) this._onSuccess(imported);
    }

    if (window.CFC_LS) CFC_LS.clearCache(this._type);
  },
};


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
    po:       { table:'purchase_orders',select:'id,po_no,status,supplier_id',                         filter:'',               label: x=>`${x.po_no}`,            sub: x=>x.status, icon:'&#128715;', addHref:'purchase_order.html', addLabel:'+ New PO'   },
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
    ["settings.html",       "Company Settings",  "&#9881;",   "page"],
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
      // Position dropdown below search input (works on mobile too)
      var rect = inp.getBoundingClientRect();
      dd.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
      dd.style.left = Math.max(8, rect.left) + 'px';
      dd.style.width = Math.min(380, window.innerWidth - 16) + 'px';
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
  // CFC_SIDEBAR.init() intentionally NOT called here.
  // Each page's inline accordion IIFE handles sidebar init for 23 pages.
  // settings.html calls CFC_SIDEBAR.init() explicitly from its own init.
  // Calling it here caused DOUBLE click handlers = accordion open then immediately close.
  CFC_NAV.init();
});

// ═══════════════════════════════════════════════════════════════════════════════
// CFC_PERM — Role-based permission helper                          added v2.9.1
// ═══════════════════════════════════════════════════════════════════════════════
window.CFC_PERM = {
  _role: 'Admin', // default = Admin when role not configured (internal ERP)
  _matrix: {
    Admin:    { create_supplier:true,  create_item:true,  create_warehouse:true  },
    Manager:  { create_supplier:true,  create_item:true,  create_warehouse:true  },
    User:     { create_supplier:false, create_item:false, create_warehouse:true  },
    Operator: { create_supplier:false, create_item:false, create_warehouse:false }
  },
  // Call once from each page's init() after sb is available
  init: async function(sb) {
    try {
      const { data } = await sb.auth.getUser();
      const email = data?.user?.email || 'unknown';
      const metaRole = data?.user?.user_metadata?.role;
      // If no role metadata set, default to Admin (internal ERP — missing role = unconfigured user)
      // To restrict a user, set user_metadata.role = 'Operator' or 'User' in Supabase Auth dashboard
      const resolved = (metaRole && Object.keys(this._matrix).includes(metaRole)) ? metaRole : 'Admin';
      this._role = resolved;
      console.log('[CFC_PERM] User:', email, '| metadata.role:', metaRole||'(not set)', '| resolved role:', resolved);
    } catch(e) {
      this._role = 'Admin'; // auth error = default to Admin
      console.warn('[CFC_PERM] Auth error, defaulting to Admin:', e.message);
    }
  },
  can: function(action) {
    return !!(this._matrix[this._role] && this._matrix[this._role][action]);
  },
  role: function() { return this._role; }
};

// ═══════════════════════════════════════════════════════════════════════════════
// CFC_QC — Quick Create popup helper                               added v2.9.1
// ═══════════════════════════════════════════════════════════════════════════════
window.CFC_QC = (function() {
  var _cfg = null;   // current open config

  // Inject overlay HTML once on DOMContentLoaded
  function _inject() {
    if (document.getElementById('cfc-qc-overlay')) return;
    var div = document.createElement('div');
    div.id = 'cfc-qc-overlay';
    div.style.cssText = [
      'display:none',
      'position:fixed',
      'inset:0',
      'background:rgba(0,0,0,0.55)',
      'z-index:600',
      'align-items:center',
      'justify-content:center'
    ].join(';');
    div.innerHTML = [
      '<div id="cfc-qc-box" style="background:#fff;border-radius:12px;width:100%;max-width:440px;',
        'box-shadow:0 24px 60px rgba(0,0,0,0.22);overflow:hidden;margin:16px;">',
        '<div id="cfc-qc-hdr" style="background:#1c2d42;color:#fff;padding:16px 20px;',
          'display:flex;align-items:center;justify-content:space-between;">',
          '<span id="cfc-qc-title" style="font-size:15px;font-weight:700;"></span>',
          '<button id="cfc-qc-cancel-x" type="button" ',
            'style="background:none;border:none;color:rgba(255,255,255,0.7);font-size:20px;',
            'cursor:pointer;line-height:1;">&#10005;</button>',
        '</div>',
        '<div id="cfc-qc-body" style="padding:20px 20px 8px;"></div>',
        '<div style="padding:12px 20px 16px;display:flex;justify-content:flex-end;gap:10px;',
          'border-top:1px solid #f0f4f8;">',
          '<button id="cfc-qc-cancel-btn" type="button" ',
            'style="padding:8px 16px;border-radius:6px;border:1px solid #dde3ea;',
            'background:#fff;font-size:13px;font-weight:600;cursor:pointer;">Cancel</button>',
          '<button id="cfc-qc-save-btn" type="button" ',
            'style="padding:8px 16px;border-radius:6px;border:none;background:#cc2200;',
            'color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Save</button>',
        '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(div);

    // Cancel buttons — close without touching GRN form
    document.getElementById('cfc-qc-cancel-x').addEventListener('click', function() { CFC_QC.close(); });
    document.getElementById('cfc-qc-cancel-btn').addEventListener('click', function() { CFC_QC.close(); });
    // Save button
    document.getElementById('cfc-qc-save-btn').addEventListener('click', function() { CFC_QC._save(); });
    // Click outside box to cancel
    div.addEventListener('click', function(e) {
      if (e.target === div) CFC_QC.close();
    });
  }

  return {
    // config = {
    //   title        : string,
    //   action       : 'create_supplier'|'create_item'|'create_warehouse',
    //   fields       : [{id, label, type:'text'|'email'|'select', required, options:[{v,l}]}],
    //   checkDup     : async function(vals) → {found: record|null, active: bool}
    //   insertFn     : async function(vals) → {data, error}
    //   onCreated    : function(record)  — called on success OR on active-dup auto-select
    // }
    open: function(config) {
      // Re-check permission (server-side guard)
      if (!CFC_PERM.can(config.action)) {
        if (window.showToast) showToast('Aapko yeh action karne ki permission nahi hai.', 'error');
        return;
      }
      _cfg = config;
      _inject();

      document.getElementById('cfc-qc-title').textContent = config.title;

      // Build field HTML
      var html = '';
      (config.fields || []).forEach(function(f) {
        html += '<div style="margin-bottom:13px;">';
        html += '<label style="display:block;font-size:12px;font-weight:700;color:#4a5568;margin-bottom:4px;">';
        html += f.label + (f.required ? ' <span style="color:#cc2200;">*</span>' : '');
        html += '</label>';
        if (f.type === 'select') {
          html += '<select id="cfc-qc-f-' + f.id + '" style="width:100%;border:1.5px solid #e2e8f0;';
          html += 'border-radius:6px;padding:8px 10px;font-size:13px;background:#f9fafb;outline:none;">';
          html += '<option value="">-- Select --</option>';
          (f.options || []).forEach(function(o) {
            html += '<option value="' + o.v + '">' + o.l + '</option>';
          });
          html += '</select>';
        } else {
          html += '<input type="' + (f.type || 'text') + '" id="cfc-qc-f-' + f.id + '" ';
          html += 'style="width:100%;border:1.5px solid #e2e8f0;border-radius:6px;';
          html += 'padding:8px 10px;font-size:13px;background:#f9fafb;outline:none;" ';
          html += 'placeholder="' + (f.placeholder || '') + '"/>';
        }
        html += '</div>';
      });
      document.getElementById('cfc-qc-body').innerHTML = html;

      var overlay = document.getElementById('cfc-qc-overlay');
      overlay.style.display = 'flex';
      // Focus first field
      var first = document.querySelector('#cfc-qc-body input, #cfc-qc-body select');
      if (first) setTimeout(function() { first.focus(); }, 80);
    },

    close: function() {
      var overlay = document.getElementById('cfc-qc-overlay');
      if (overlay) {
        overlay.style.display = 'none';
        var body = document.getElementById('cfc-qc-body');
        if (body) body.innerHTML = '';
      }
      _cfg = null;
    },

    _save: async function() {
      if (!_cfg) return;

      // Re-check permission
      if (!CFC_PERM.can(_cfg.action)) {
        showToast('Permission denied.', 'error');
        return;
      }

      // Collect values
      var vals = {};
      var valid = true;
      (_cfg.fields || []).forEach(function(f) {
        var el = document.getElementById('cfc-qc-f-' + f.id);
        var val = el ? el.value.trim() : '';
        vals[f.id] = val;
        if (f.required && !val) {
          showToast(f.label + ' zaroori hai.', 'error');
          if (el) el.focus();
          valid = false;
        }
      });
      if (!valid) return;

      // Duplicate check
      var saveBtn = document.getElementById('cfc-qc-save-btn');
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Checking...'; }

      try {
        var dupResult = await _cfg.checkDup(vals);

        if (dupResult.found && dupResult.active) {
          // Active duplicate — auto-select existing
          showToast(_cfg.dupActiveMsg || 'Already exists. Existing record selected.', 'warning');
          _cfg.onCreated(dupResult.found);
          CFC_QC.close();
          return;
        }

        if (dupResult.found && !dupResult.active) {
          // Inactive duplicate — block creation
          showToast(_cfg.dupInactiveMsg || 'Record exists but is inactive. Please reactivate it.', 'error');
          if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
          return;
        }

        // No duplicate — insert
        if (saveBtn) saveBtn.textContent = 'Saving...';
        var result = await _cfg.insertFn(vals);
        if (result.error) {
          showToast('Error: ' + result.error.message, 'error');
          if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
          return;
        }
        showToast(_cfg.successMsg || 'Saved successfully.', 'success');
        _cfg.onCreated(result.data);
        CFC_QC.close();

      } catch(e) {
        showToast('Unexpected error: ' + e.message, 'error');
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
      }
    }
  };
})();

// Inject QC overlay on DOMContentLoaded (runs on every page automatically)
document.addEventListener('DOMContentLoaded', function() {
  // Delay slightly so body is ready
  setTimeout(function() { CFC_QC._inject && CFC_QC._inject(); }, 0);
});

// ══════════════════════════════════════════════════════════════════
// CFC QUICK CREATE — v3.0.5
// Shared popup utility for adding new master records without leaving
// the current form. Used across all master-linking fields.
//
// Usage:
//   cfcQuickCreate({
//     title: 'Add New Item',
//     fields: [{id,label,type,required,options?,placeholder?}],
//     onSave: async (vals) => { /* return {data,error} */ },
//     onSuccess: (newRecord) => { /* auto-select in parent */ }
//   });
// ══════════════════════════════════════════════════════════════════

(function(){
  var _overlay=null;

  function _inject(){
    if(document.getElementById('cfc-qc-overlay'))return;
    var div=document.createElement('div');
    div.id='cfc-qc-overlay';
    div.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9000;align-items:center;justify-content:center;';
    div.innerHTML=`<div id="cfc-qc-box" style="background:#fff;border-radius:12px;width:100%;max-width:480px;box-shadow:0 24px 60px rgba(0,0,0,0.2);max-height:90vh;overflow-y:auto;margin:16px;">
      <div style="padding:18px 20px 14px;border-bottom:1px solid #f0f4f8;display:flex;align-items:center;justify-content:space-between;">
        <h3 id="cfc-qc-title" style="font-size:16px;font-weight:700;color:#1c2d42;margin:0;"></h3>
        <button type="button" onclick="cfcQCClose()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#8a95a0;padding:0 4px;">&times;</button>
      </div>
      <div id="cfc-qc-body" style="padding:18px 20px;"></div>
      <div style="padding:14px 20px;border-top:1px solid #f0f4f8;display:flex;justify-content:flex-end;gap:10px;">
        <button type="button" onclick="cfcQCClose()" style="padding:8px 16px;border-radius:6px;border:1px solid #dde3ea;background:#fff;font-size:13px;font-weight:600;cursor:pointer;">Cancel</button>
        <button type="button" id="cfc-qc-save" onclick="cfcQCSave()" style="padding:8px 16px;border-radius:6px;border:none;background:#cc2200;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Save</button>
      </div>
    </div>`;
    document.body.appendChild(div);
    div.addEventListener('click',function(e){if(e.target===div)cfcQCClose();});
    _overlay=div;
  }

  var _cfg=null;
  var _lsItems={}; // live search item caches per field id

  window.cfcQuickCreate=function(cfg){
    if(!_overlay)_inject();
    _cfg=cfg;
    document.getElementById('cfc-qc-title').textContent=cfg.title||'Add New';
    var body=document.getElementById('cfc-qc-body');
    body.innerHTML=cfg.fields.map(f=>{
      if(f.type==='livesearch'){
        return`<div style="margin-bottom:12px;">
          <label style="display:block;font-size:12px;font-weight:600;color:#4a5568;margin-bottom:4px;">${f.label}${f.required?' <span style="color:#cc2200">*</span>':''}</label>
          <div style="position:relative;">
            <input type="text" id="cfc-qc-${f.id}-search" autocomplete="off" placeholder="${f.placeholder||'Search...'}"
              oninput="cfcQCSearch('${f.id}')"
              style="width:100%;border:1.5px solid #e2e8f0;border-radius:7px;padding:8px 11px;font-size:13px;box-sizing:border-box;"/>
            <div id="cfc-qc-${f.id}-dd" style="display:none;position:absolute;left:0;right:0;top:100%;z-index:9999;background:#fff;border:1px solid #dde3ea;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,0.12);max-height:160px;overflow-y:auto;"></div>
            <input type="hidden" id="cfc-qc-${f.id}"/>
          </div>
        </div>`;
      }
      if(f.type==='select'){
        return`<div style="margin-bottom:12px;">
          <label style="display:block;font-size:12px;font-weight:600;color:#4a5568;margin-bottom:4px;">${f.label}${f.required?' <span style="color:#cc2200">*</span>':''}</label>
          <select id="cfc-qc-${f.id}" style="width:100%;border:1.5px solid #e2e8f0;border-radius:7px;padding:8px 11px;font-size:13px;background:#f9fafb;">
            <option value="">-- Select --</option>
            ${(f.options||[]).map(o=>`<option value="${o.value}">${o.label}</option>`).join('')}
          </select>
        </div>`;
      }
      if(f.type==='checkbox'){
        return`<div style="margin-bottom:12px;display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="cfc-qc-${f.id}" ${f.default?' checked':''} style="width:16px;height:16px;"/>
          <label for="cfc-qc-${f.id}" style="font-size:13px;color:#1a2635;">${f.label}</label>
        </div>`;
      }
      return`<div style="margin-bottom:12px;">
        <label style="display:block;font-size:12px;font-weight:600;color:#4a5568;margin-bottom:4px;">${f.label}${f.required?' <span style="color:#cc2200">*</span>':''}</label>
        <input type="${f.type||'text'}" id="cfc-qc-${f.id}" placeholder="${f.placeholder||''}"
          style="width:100%;border:1.5px solid #e2e8f0;border-radius:7px;padding:8px 11px;font-size:13px;box-sizing:border-box;background:#f9fafb;"
          ${f.min!==undefined?`min="${f.min}"`:''}/>
      </div>`;
    }).join('');

    // Load live search data for any livesearch fields
    cfg.fields.filter(f=>f.type==='livesearch').forEach(f=>{
      if(f.fetchFn)f.fetchFn().then(items=>{_lsItems[f.id]=items||[];});
    });

    _overlay.style.display='flex';
    // Focus first text input
    setTimeout(()=>{
      var first=body.querySelector('input[type="text"]');
      if(first)first.focus();
    },80);
  };

  window.cfcQCSearch=function(fid){
    var field=(_cfg?.fields||[]).find(f=>f.id===fid);
    if(!field)return;
    var q=(document.getElementById('cfc-qc-'+fid+'-search')?.value||'').toLowerCase();
    var dd=document.getElementById('cfc-qc-'+fid+'-dd');
    var items=_lsItems[fid]||[];
    var res=items.filter(it=>
      (it.code||'').toLowerCase().includes(q)||
      (it.name||'').toLowerCase().includes(q)||
      (it.label||'').toLowerCase().includes(q)
    ).slice(0,8);
    if(!q||!res.length){dd.style.display='none';return;}
    dd.innerHTML=res.map(it=>`<div onclick="cfcQCSelectLS('${fid}',${it.id},'${(it.label||it.code||it.name||'').replace(/'/g,"\\'")}','${(it.sublabel||it.name||'').replace(/'/g,"\\'")}')"\
      style="padding:7px 12px;cursor:pointer;font-size:12.5px;border-bottom:1px solid #f0f4f8;display:flex;gap:8px;">
      ${it.code?`<span style="font-family:monospace;font-size:11px;background:#f0f4f8;padding:1px 5px;border-radius:3px;">${it.code}</span>`:''}
      <span>${it.name||it.label||''}</span>
      ${it.sublabel?`<span style="margin-left:auto;font-size:10px;color:#8a95a0;">${it.sublabel}</span>`:''}
    </div>`).join('');
    dd.style.display='block';
  };

  window.cfcQCSelectLS=function(fid,id,label,sublabel){
    var searchEl=document.getElementById('cfc-qc-'+fid+'-search');
    var hiddenEl=document.getElementById('cfc-qc-'+fid);
    var ddEl=document.getElementById('cfc-qc-'+fid+'-dd');
    if(searchEl)searchEl.value=label+(sublabel&&sublabel!==label?' — '+sublabel:'');
    if(hiddenEl)hiddenEl.value=id;
    if(ddEl)ddEl.style.display='none';
  };

  window.cfcQCSave=async function(){
    if(!_cfg)return;
    var saveBtn=document.getElementById('cfc-qc-save');
    saveBtn.disabled=true;saveBtn.textContent='Saving...';
    var vals={};
    for(var f of (_cfg.fields||[])){
      if(f.type==='livesearch'){
        vals[f.id]=document.getElementById('cfc-qc-'+f.id)?.value||null;
        vals[f.id+'_label']=document.getElementById('cfc-qc-'+f.id+'-search')?.value||null;
      } else if(f.type==='checkbox'){
        vals[f.id]=document.getElementById('cfc-qc-'+f.id)?.checked??false;
      } else {
        vals[f.id]=document.getElementById('cfc-qc-'+f.id)?.value||null;
      }
      if(f.required&&!vals[f.id]){
        showToast(f.label+' is required.','error');
        saveBtn.disabled=false;saveBtn.textContent='Save';
        return;
      }
    }
    try{
      var result=await _cfg.onSave(vals);
      if(result&&result.error){
        showToast('Error: '+result.error.message,'error');
        saveBtn.disabled=false;saveBtn.textContent='Save';
        return;
      }
      showToast('Saved!','success');
      if(_cfg.onSuccess&&result&&result.data)_cfg.onSuccess(result.data);
      cfcQCClose();
    }catch(e){
      showToast('Error: '+e.message,'error');
      saveBtn.disabled=false;saveBtn.textContent='Save';
    }
  };

  window.cfcQCClose=function(){
    if(_overlay)_overlay.style.display='none';
    _cfg=null;_lsItems={};
  };

  document.addEventListener('DOMContentLoaded',function(){setTimeout(_inject,0);});
})();
