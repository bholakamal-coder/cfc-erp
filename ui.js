/* ============================================================
   CFC ERP v2 — ui.js
   Production-Grade UI Component System
   
   Components:
   1.  CFC_TABLE     — Sortable, filterable data table
   2.  CFC_MODAL     — Accessible modal manager  
   3.  CFC_FORM      — Form validation engine
   4.  CFC_BTN       — Button states (loading, disabled, confirm)
   5.  CFC_BADGE     — Status badge factory
   6.  CFC_TOAST     — Toast notification queue
   7.  CFC_EMPTY     — Empty/loading/error states
   8.  CFC_CONFIRM   — Confirmation dialog
   9.  CFC_DRAWER    — Side drawer panel
   10. CFC_STATS     — Stats card renderer
   
   Zero dependencies. Works alongside shared.js.
   ============================================================ */

'use strict';

// ── 1. CFC_TABLE — Sortable, filterable, paginated data table ────────────────
window.CFC_TABLE = {

  // config: { el, columns, data, rowFn, emptyMsg, searchable, pageSize }
  // columns: [{ key, label, sortable, width, align, render }]
  render(config) {
    const el = typeof config.el === 'string'
      ? document.getElementById(config.el)
      : config.el;
    if (!el) return;

    el._cfc_table = {
      allData:    config.data || [],
      filtered:   config.data || [],
      sortKey:    null,
      sortDir:    1,
      page:       1,
      pageSize:   config.pageSize || 100,
      config,
    };

    this._buildShell(el, config);
    this._renderBody(el);
    return el;
  },

  _buildShell(el, cfg) {
    const searchHtml = cfg.searchable !== false
      ? `<input class="cfc-table-search" 
           placeholder="Search ${cfg.title || ''}..." 
           aria-label="Search table"
           oninput="CFC_TABLE._onSearch(this)"
           data-table="${el.id}"
           style="border:1.5px solid #e2e8f0;border-radius:7px;padding:8px 12px;
                  font-size:13px;width:260px;outline:none;background:#f9fafb;">`
      : '';

    const headers = (cfg.columns || []).map(col => `
      <th scope="col"
          style="padding:10px 12px;text-align:${col.align||'left'};
                 font-size:11px;font-weight:700;color:#5a6878;
                 text-transform:uppercase;letter-spacing:0.5px;
                 border-bottom:1px solid #e2e8f0;white-space:nowrap;
                 ${col.sortable !== false ? 'cursor:pointer;user-select:none;' : ''}
                 ${col.width ? 'width:'+col.width+';' : ''}"
          ${col.sortable !== false ? `onclick="CFC_TABLE._onSort(this,'${col.key}','${el.id}')"` : ''}
          aria-sort="none"
          data-key="${col.key}">
        ${col.label}
        ${col.sortable !== false ? '<span class="cfc-sort-icon" style="opacity:0.3;margin-left:4px;">↕</span>' : ''}
      </th>`).join('');

    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;
                  margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        ${searchHtml}
        <span class="cfc-table-count" style="font-size:12px;color:#8a95a0;"
              aria-live="polite" aria-atomic="true"></span>
      </div>
      <div class="cfc-table-wrap" role="region" aria-label="${cfg.title||'Data table'}"
           style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;
                  overflow:hidden;">
        <table role="grid" style="width:100%;border-collapse:collapse;"
               aria-label="${cfg.title||''}">
          <thead style="background:#f8fafc;">
            <tr>${headers}</tr>
          </thead>
          <tbody class="cfc-table-body" role="rowgroup">
            ${CFC_EMPTY.loading()}
          </tbody>
        </table>
      </div>
      <div class="cfc-table-pagination" style="display:flex;justify-content:flex-end;
           align-items:center;gap:8px;margin-top:10px;font-size:13px;color:#5a6878;">
      </div>`;
  },

  _renderBody(el) {
    const state = el._cfc_table;
    if (!state) return;
    const { filtered, page, pageSize, config } = state;

    const start = (page - 1) * pageSize;
    const slice = filtered.slice(start, start + pageSize);
    const tbody = el.querySelector('.cfc-table-body');
    const count = el.querySelector('.cfc-table-count');

    if (count) count.textContent = `${filtered.length} ${config.title || 'records'}`;

    if (!slice.length) {
      tbody.innerHTML = CFC_EMPTY.empty(config.emptyMsg || 'Koi data nahi.');
      this._renderPager(el, filtered.length, pageSize, page);
      return;
    }

    tbody.innerHTML = slice.map((row, i) => {
      const cells = (config.columns || []).map(col => {
        const val = row[col.key];
        const rendered = col.render ? col.render(val, row, i + start) : (val ?? '—');
        return `<td style="padding:10px 12px;font-size:13px;
                    border-bottom:1px solid #f0f4f8;vertical-align:middle;
                    text-align:${col.align||'left'};"
                    role="gridcell">${rendered}</td>`;
      }).join('');
      return `<tr role="row" style="transition:background 0.1s;"
                  onmouseenter="this.style.background='#fafbfc'"
                  onmouseleave="this.style.background=''">${cells}</tr>`;
    }).join('');

    this._renderPager(el, filtered.length, pageSize, page);
  },

  _renderPager(el, total, pageSize, page) {
    const pager = el.querySelector('.cfc-table-pagination');
    if (!pager || pageSize >= total) { if(pager) pager.innerHTML=''; return; }
    const pages = Math.ceil(total / pageSize);
    pager.innerHTML = `
      <span>Page ${page} of ${pages}</span>
      <button type="button" class="btn btn-secondary btn-sm"
        ${page===1?'disabled':''} 
        onclick="CFC_TABLE._goPage('${el.id}',${page-1})"
        aria-label="Previous page">← Prev</button>
      <button type="button" class="btn btn-secondary btn-sm"
        ${page===pages?'disabled':''}
        onclick="CFC_TABLE._goPage('${el.id}',${page+1})"
        aria-label="Next page">Next →</button>`;
  },

  _onSearch(inp) {
    const el = document.getElementById(inp.dataset.table);
    if (!el || !el._cfc_table) return;
    const q = inp.value.toLowerCase();
    const state = el._cfc_table;
    state.filtered = q
      ? state.allData.filter(r =>
          Object.values(r).some(v => String(v||'').toLowerCase().includes(q)))
      : [...state.allData];
    state.page = 1;
    this._renderBody(el);
  },

  _onSort(th, key, elId) {
    const el = document.getElementById(elId);
    if (!el || !el._cfc_table) return;
    const state = el._cfc_table;
    state.sortDir = state.sortKey === key ? -state.sortDir : 1;
    state.sortKey = key;
    state.filtered.sort((a, b) => {
      const av = a[key] ?? '', bv = b[key] ?? '';
      return (av < bv ? -1 : av > bv ? 1 : 0) * state.sortDir;
    });
    state.page = 1;
    // Update aria-sort
    el.querySelectorAll('th[data-key]').forEach(t => {
      t.setAttribute('aria-sort', 'none');
      const icon = t.querySelector('.cfc-sort-icon');
      if (icon) { icon.textContent = '↕'; icon.style.opacity = '0.3'; }
    });
    th.setAttribute('aria-sort', state.sortDir === 1 ? 'ascending' : 'descending');
    const icon = th.querySelector('.cfc-sort-icon');
    if (icon) { icon.textContent = state.sortDir === 1 ? '↑' : '↓'; icon.style.opacity = '1'; }
    this._renderBody(el);
  },

  _goPage(elId, page) {
    const el = document.getElementById(elId);
    if (!el || !el._cfc_table) return;
    el._cfc_table.page = page;
    this._renderBody(el);
  },

  // Update data without rebuilding shell
  update(elId, newData) {
    const el = document.getElementById(elId);
    if (!el || !el._cfc_table) return;
    el._cfc_table.allData = newData;
    el._cfc_table.filtered = [...newData];
    el._cfc_table.page = 1;
    this._renderBody(el);
  },

  setLoading(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    const tbody = el.querySelector('.cfc-table-body');
    if (tbody) tbody.innerHTML = CFC_EMPTY.loading();
  },

  setError(elId, msg) {
    const el = document.getElementById(elId);
    if (!el) return;
    const tbody = el.querySelector('.cfc-table-body');
    if (tbody) tbody.innerHTML = CFC_EMPTY.error(msg);
  },
};

// ── 2. CFC_MODAL — Accessible modal manager ──────────────────────────────────
window.CFC_MODAL = {
  _stack: [],

  open(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    this._stack.push(id);
    // Focus first focusable element
    requestAnimationFrame(() => {
      const focusable = el.querySelector(
        'input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])'
      );
      if (focusable) focusable.focus();
    });
    // Trap focus
    el._cfcKeyHandler = (e) => this._trapFocus(e, el);
    el.addEventListener('keydown', el._cfcKeyHandler);
    // Close on backdrop
    el._cfcClickHandler = (e) => { if (e.target === el) this.close(id); };
    el.addEventListener('click', el._cfcClickHandler);
    // Close on Escape
    this._escHandler = (e) => { if (e.key === 'Escape') this.close(id); };
    document.addEventListener('keydown', this._escHandler);
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  },

  close(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    this._stack = this._stack.filter(s => s !== id);
    if (el._cfcKeyHandler) el.removeEventListener('keydown', el._cfcKeyHandler);
    if (el._cfcClickHandler) el.removeEventListener('click', el._cfcClickHandler);
    if (this._escHandler) document.removeEventListener('keydown', this._escHandler);
    if (!this._stack.length) document.body.style.overflow = '';
  },

  _trapFocus(e, el) {
    if (e.key !== 'Tab') return;
    const focusables = [...el.querySelectorAll(
      'input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )];
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  },
};

// ── 3. CFC_FORM — Form validation engine ─────────────────────────────────────
window.CFC_FORM = {

  // rules: { fieldId: { required, minLen, maxLen, pattern, custom, label } }
  validate(rules) {
    const errors = {};
    let first = null;

    for (const [fieldId, rule] of Object.entries(rules)) {
      const el = document.getElementById(fieldId);
      if (!el) continue;
      const val = el.value.trim();
      const label = rule.label || fieldId;
      let err = null;

      if (rule.required && !val)
        err = `${label} zaroori hai`;
      else if (val && rule.minLen && val.length < rule.minLen)
        err = `${label} kam se kam ${rule.minLen} characters ka hona chahiye`;
      else if (val && rule.maxLen && val.length > rule.maxLen)
        err = `${label} max ${rule.maxLen} characters ka hona chahiye`;
      else if (val && rule.pattern && !rule.pattern.test(val))
        err = rule.patternMsg || `${label} format galat hai`;
      else if (rule.custom) {
        const customErr = rule.custom(val, el);
        if (customErr) err = customErr;
      }

      if (err) {
        errors[fieldId] = err;
        this._showFieldError(el, err);
        if (!first) first = el;
      } else {
        this._clearFieldError(el);
      }
    }

    if (first) first.focus();
    return { valid: Object.keys(errors).length === 0, errors };
  },

  _showFieldError(el, msg) {
    el.style.borderColor = '#dc2626';
    el.setAttribute('aria-invalid', 'true');
    let errEl = document.getElementById(el.id + '-error');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.id = el.id + '-error';
      errEl.style.cssText = 'color:#dc2626;font-size:11.5px;margin-top:3px;';
      errEl.setAttribute('role', 'alert');
      el.parentNode.insertBefore(errEl, el.nextSibling);
    }
    errEl.textContent = '⚠ ' + msg;
    el.setAttribute('aria-describedby', errEl.id);
  },

  _clearFieldError(el) {
    el.style.borderColor = '';
    el.removeAttribute('aria-invalid');
    const errEl = document.getElementById(el.id + '-error');
    if (errEl) errEl.remove();
    el.removeAttribute('aria-describedby');
  },

  clearAll(fieldIds) {
    (fieldIds || []).forEach(id => {
      const el = document.getElementById(id);
      if (el) this._clearFieldError(el);
    });
  },

  // Reset a form section
  reset(fieldIds, defaults = {}) {
    (fieldIds || []).forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      this._clearFieldError(el);
      el.value = defaults[id] !== undefined ? defaults[id] : '';
    });
  },
};

// ── 4. CFC_BTN — Button state manager ───────────────────────────────────────
window.CFC_BTN = {

  // Make any async action button-safe
  // Usage: CFC_BTN.action(btn, async () => { ... await save(); })
  async action(btn, asyncFn, loadingText = 'Saving...') {
    if (!btn || btn.disabled) return;
    const orig = btn.innerHTML;
    const origWidth = btn.offsetWidth;
    btn.disabled = true;
    btn.style.minWidth = origWidth + 'px';
    btn.innerHTML = `<span class="cfc-spinner"></span> ${loadingText}`;
    btn.setAttribute('aria-busy', 'true');
    try {
      await asyncFn();
    } catch (e) {
      CFC_UI.showToast('Error: ' + (e.message || e), 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
      btn.style.minWidth = '';
      btn.removeAttribute('aria-busy');
    }
  },

  // Confirmation button — click once to arm, click again to fire
  arm(btn, confirmText, action) {
    if (btn._cfcArmed) {
      btn._cfcArmed = false;
      btn.style.background = '';
      btn.textContent = btn._cfcOrigText;
      clearTimeout(btn._cfcArmTimer);
      action();
      return;
    }
    btn._cfcArmed = true;
    btn._cfcOrigText = btn.textContent;
    btn.textContent = confirmText || 'Click again to confirm';
    btn.style.background = '#dc2626';
    btn.style.color = '#fff';
    btn._cfcArmTimer = setTimeout(() => {
      if (btn._cfcArmed) {
        btn._cfcArmed = false;
        btn.textContent = btn._cfcOrigText;
        btn.style.background = '';
      }
    }, 3000);
  },
};

// ── 5. CFC_BADGE — Status badge factory ─────────────────────────────────────
window.CFC_BADGE = {

  PRESETS: {
    // Order/SO/PO statuses
    'Draft':               ['#f1f5f9','#475569'],
    'Confirmed':           ['#dbeafe','#1e40af'],
    'Approved':            ['#dbeafe','#1e40af'],
    'In Production':       ['#fef9c3','#854d0e'],
    'In Progress':         ['#fef9c3','#854d0e'],
    'Ready':               ['#dcfce7','#166534'],
    'Partially Dispatched':['#fde68a','#92400e'],
    'Partially Received':  ['#fde68a','#92400e'],
    'Dispatched':          ['#f0fdf4','#166534'],
    'Received':            ['#dcfce7','#166534'],
    'Invoiced':            ['#ede9fe','#6d28d9'],
    'Paid':                ['#dcfce7','#166534'],
    'Overdue':             ['#fee2e2','#991b1b'],
    'Cancelled':           ['#fee2e2','#991b1b'],
    'Sent':                ['#dbeafe','#1e40af'],
    // Item types
    'RM':                  ['#f0fdf4','#166534'],
    'FG':                  ['#dbeafe','#1e40af'],
    'SFG':                 ['#ede9fe','#6d28d9'],
    'Consumable':          ['#fef9c3','#854d0e'],
    'Packing':             ['#f0fdf4','#0f766e'],
    // MRP
    'OK':                  ['#dcfce7','#166534'],
    'Shortage':            ['#fee2e2','#991b1b'],
    'Partial':             ['#fef9c3','#854d0e'],
    'Reorder':             ['#fef9c3','#854d0e'],
    'Below Min':           ['#fee2e2','#991b1b'],
    // QC
    'Pass':                ['#dcfce7','#166534'],
    'Fail':                ['#fee2e2','#991b1b'],
    'Hold':                ['#fef9c3','#854d0e'],
    // Workers
    'Active':              ['#dcfce7','#166534'],
    'Inactive':            ['#f1f5f9','#64748b'],
    // Attendance
    'Present':             ['#dcfce7','#166534'],
    'Absent':              ['#fee2e2','#991b1b'],
    'Half Day':            ['#fef9c3','#854d0e'],
    'OT':                  ['#dbeafe','#1e40af'],
    'Leave':               ['#f1f5f9','#475569'],
  },

  render(status, opts = {}) {
    const [bg, color] = this.PRESETS[status] || ['#f1f5f9', '#475569'];
    const dot = opts.dot
      ? `<span style="width:6px;height:6px;border-radius:50%;background:${color};
                      display:inline-block;margin-right:5px;"></span>`
      : '';
    return `<span role="status" 
      style="display:inline-flex;align-items:center;font-size:11px;font-weight:600;
             padding:3px 9px;border-radius:20px;white-space:nowrap;
             background:${bg};color:${color};"
      aria-label="Status: ${status}">
      ${dot}${status}
    </span>`;
  },

  // Render into an existing element
  set(elId, status, opts) {
    const el = document.getElementById(elId);
    if (el) el.innerHTML = this.render(status, opts);
  },
};

// ── 6. CFC_TOAST — Toast notification queue ──────────────────────────────────
window.CFC_TOAST = {
  _queue: [],
  _showing: false,

  show(msg, type = '', duration = 3500) {
    this._queue.push({ msg, type, duration });
    if (!this._showing) this._next();
  },

  _next() {
    if (!this._queue.length) { this._showing = false; return; }
    this._showing = true;
    const { msg, type, duration } = this._queue.shift();
    const t = document.getElementById('toast');
    if (!t) { this._showing = false; return; }
    t.textContent = msg;
    t.className = 'toast show ' + type;
    t.setAttribute('role', 'alert');
    t.setAttribute('aria-live', 'assertive');
    setTimeout(() => {
      t.className = 'toast';
      setTimeout(() => this._next(), 300);
    }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg)   { this.show(msg, 'error'); },
  info(msg)    { this.show(msg, ''); },
};

// Override legacy showToast to use queue
if (window.CFC_UI) {
  window.CFC_UI.showToast = (msg, type) => CFC_TOAST.show(msg, type);
  window.showToast = (msg, type) => CFC_TOAST.show(msg, type);
}

// ── 7. CFC_EMPTY — Empty / Loading / Error states ───────────────────────────
window.CFC_EMPTY = {

  loading(msg = 'Loading...', colspan = 10) {
    return `<tr><td colspan="${colspan}" style="padding:0;">
      <div role="status" aria-live="polite" aria-label="Loading"
           style="display:flex;align-items:center;justify-content:center;
                  gap:10px;padding:48px 20px;color:#8a95a0;font-size:14px;">
        <span class="cfc-spinner" aria-hidden="true"></span>
        ${msg}
      </div></td></tr>`;
  },

  empty(msg = 'Koi data nahi.', icon = '📭', colspan = 10) {
    return `<tr><td colspan="${colspan}" style="padding:0;">
      <div role="status" aria-live="polite"
           style="text-align:center;padding:60px 20px;color:#8a95a0;">
        <div style="font-size:40px;margin-bottom:12px;" aria-hidden="true">${icon}</div>
        <div style="font-size:14px;font-weight:500;">${msg}</div>
      </div></td></tr>`;
  },

  error(msg = 'Kuch galat hua.', onRetry = null, colspan = 10) {
    const retryBtn = onRetry
      ? `<button type="button" class="btn btn-secondary btn-sm" 
                 onclick="(${onRetry})()" style="margin-top:12px;">
           ↻ Retry
         </button>`
      : '';
    return `<tr><td colspan="${colspan}" style="padding:0;">
      <div role="alert"
           style="text-align:center;padding:48px 20px;color:#991b1b;">
        <div style="font-size:36px;margin-bottom:10px;" aria-hidden="true">⚠️</div>
        <div style="font-size:14px;font-weight:500;">${msg}</div>
        ${retryBtn}
      </div></td></tr>`;
  },

  // Card-level states (outside tables)
  card(type, msg, icon, onRetry) {
    const configs = {
      loading: { color: '#8a95a0', bg: '#f8fafc', icon: '' },
      empty:   { color: '#8a95a0', bg: '#f8fafc', icon: '📭' },
      error:   { color: '#991b1b', bg: '#fef2f2', icon: '⚠️' },
    };
    const cfg = configs[type] || configs.empty;
    const retryBtn = (type === 'error' && onRetry)
      ? `<button type="button" class="btn btn-secondary btn-sm"
                 onclick="(${onRetry})()" style="margin-top:10px;">↻ Retry</button>`
      : '';
    const spinner = type === 'loading'
      ? `<span class="cfc-spinner" style="margin-bottom:12px;" aria-hidden="true"></span><br>`
      : '';
    return `<div role="${type === 'error' ? 'alert' : 'status'}" aria-live="polite"
                 style="text-align:center;padding:48px 24px;
                        background:${cfg.bg};border-radius:8px;color:${cfg.color};">
      ${spinner}
      <div style="font-size:32px;margin-bottom:10px;" aria-hidden="true">
        ${icon || cfg.icon}
      </div>
      <div style="font-size:14px;font-weight:500;">${msg}</div>
      ${retryBtn}
    </div>`;
  },
};

// ── 8. CFC_CONFIRM — Non-blocking confirmation dialog ───────────────────────
window.CFC_CONFIRM = {
  _resolve: null,

  show({ title = 'Confirm?', message = '', confirmText = 'Confirm',
         cancelText = 'Cancel', type = 'danger' } = {}) {
    return new Promise(resolve => {
      this._resolve = resolve;
      const colors = { danger:'#dc2626', warning:'#d97706', info:'#2563eb' };
      const icons  = { danger:'🗑️', warning:'⚠️', info:'ℹ️' };
      let el = document.getElementById('cfc-confirm-overlay');
      if (!el) {
        el = document.createElement('div');
        el.id = 'cfc-confirm-overlay';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-labelledby', 'cfc-confirm-title');
        el.style.cssText = `display:none;position:fixed;inset:0;
          background:rgba(0,0,0,0.5);z-index:500;
          align-items:center;justify-content:center;`;
        document.body.appendChild(el);
      }
      el.innerHTML = `
        <div style="background:#fff;border-radius:12px;padding:32px;max-width:400px;
                    width:90%;box-shadow:0 24px 60px rgba(0,0,0,0.2);text-align:center;">
          <div style="font-size:40px;margin-bottom:12px;" aria-hidden="true">
            ${icons[type]}
          </div>
          <h3 id="cfc-confirm-title" 
              style="font-size:17px;font-weight:700;color:#1c2d42;margin-bottom:8px;">
            ${title}
          </h3>
          <p style="font-size:13.5px;color:#5a6878;margin-bottom:24px;line-height:1.5;">
            ${message}
          </p>
          <div style="display:flex;gap:10px;justify-content:center;">
            <button type="button" id="cfc-confirm-cancel"
              style="padding:9px 20px;border-radius:6px;border:1px solid #dde3ea;
                     background:#fff;font-size:13.5px;font-weight:600;cursor:pointer;">
              ${cancelText}
            </button>
            <button type="button" id="cfc-confirm-ok"
              style="padding:9px 20px;border-radius:6px;border:none;color:#fff;
                     background:${colors[type]||colors.danger};
                     font-size:13.5px;font-weight:600;cursor:pointer;">
              ${confirmText}
            </button>
          </div>
        </div>`;
      el.style.display = 'flex';
      document.getElementById('cfc-confirm-ok').onclick = () => this._close(true);
      document.getElementById('cfc-confirm-cancel').onclick = () => this._close(false);
      el.onclick = (e) => { if (e.target === el) this._close(false); };
      document.addEventListener('keydown', this._keyHandler = (e) => {
        if (e.key === 'Escape') this._close(false);
        if (e.key === 'Enter') this._close(true);
      });
      setTimeout(() => {
        const okBtn = document.getElementById('cfc-confirm-ok');
        if (okBtn) okBtn.focus();
      }, 50);
    });
  },

  _close(result) {
    const el = document.getElementById('cfc-confirm-overlay');
    if (el) el.style.display = 'none';
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    if (this._resolve) { this._resolve(result); this._resolve = null; }
  },
};

// ── 9. CFC_STATS — Stats card renderer ──────────────────────────────────────
window.CFC_STATS = {

  // cards: [{ id, label, value, color, icon, trend, trendDir }]
  render(containerId, cards) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px;';
    el.innerHTML = cards.map(c => `
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;
                  padding:16px;position:relative;overflow:hidden;"
           role="region" aria-label="${c.label}">
        ${c.icon ? `<div style="position:absolute;top:14px;right:14px;font-size:22px;opacity:0.12;"
                        aria-hidden="true">${c.icon}</div>` : ''}
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;
                    letter-spacing:1px;color:#8a95a0;margin-bottom:8px;"
             id="${c.id}-label">${c.label}</div>
        <div id="${c.id}" style="font-size:26px;font-weight:800;
             color:${c.color||'#1c2d42'};"
             aria-labelledby="${c.id}-label">
          ${c.value ?? '—'}
        </div>
        ${c.trend ? `<div style="font-size:11px;margin-top:4px;
          color:${c.trendDir==='up'?'#166534':c.trendDir==='down'?'#991b1b':'#8a95a0'};">
          ${c.trendDir==='up'?'↑':c.trendDir==='down'?'↓':'→'} ${c.trend}
        </div>` : ''}
      </div>`).join('');
  },

  // Update single stat value
  set(id, value, color) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
    if (color) el.style.color = color;
  },
};

// ── CSS INJECTION — Spinner + shared component styles ────────────────────────
(function injectUIStyles() {
  if (document.getElementById('cfc-ui-styles')) return;
  const style = document.createElement('style');
  style.id = 'cfc-ui-styles';
  style.textContent = `
    @keyframes cfc-spin { to { transform: rotate(360deg); } }
    .cfc-spinner {
      display: inline-block;
      width: 14px; height: 14px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: cfc-spin 0.7s linear infinite;
      vertical-align: middle;
    }
    .cfc-table-search:focus {
      border-color: var(--red, #cc2200) !important;
      background: #fff !important;
      box-shadow: 0 0 0 3px rgba(204,34,0,0.08);
      outline: none;
    }
    .cfc-table-body tr:focus-within td { background: #f0f7ff; }
    button:focus-visible {
      outline: 2px solid var(--red, #cc2200);
      outline-offset: 2px;
    }
    input:focus-visible, select:focus-visible, textarea:focus-visible {
      outline: none;
      border-color: var(--red, #cc2200) !important;
      box-shadow: 0 0 0 3px rgba(204,34,0,0.08);
    }
    [aria-invalid="true"] {
      border-color: #dc2626 !important;
      box-shadow: 0 0 0 3px rgba(220,38,38,0.1);
    }
    .cfc-field-error {
      color: #dc2626;
      font-size: 11.5px;
      margin-top: 3px;
    }
    @media (max-width: 768px) {
      .sidebar { transform: translateX(-100%); transition: transform 0.25s ease; }
      .sidebar.mobile-open { transform: translateX(0); }
      .main { margin-left: 0 !important; }
      .topbar { left: 0 !important; }
    }
  `;
  document.head.appendChild(style);
})();

console.info('[CFC UI] Component system loaded — v2.1');
