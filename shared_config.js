// CFC ERP v2 — Shared Configuration
// Single source of truth for all pages

const CFC_CONFIG = {
  SUPABASE_URL: 'https://sdopdeqepjoshbzrpbmi.supabase.co',
  SUPABASE_KEY: 'sb_publishable_eWBMrAFa7Yyvtlb-7-8IGA_KxfE7v_8',
  APP_NAME: 'CFC ERP v2',
  COMPANY: 'CERADRIVE BRAKES',
  VERSION: '2.0.0',
  DEFAULT_LIMIT: 500,
  DEBOUNCE_MS: 300,
};

// Shared utilities
function genNo(prefix){
  const n=new Date();
  return prefix+'-'+n.getFullYear()+String(n.getMonth()+1).padStart(2,'0')+'-'+String(Math.floor(Math.random()*9000+1000));
}

function debounce(fn,delay){
  let t;
  return function(...args){
    clearTimeout(t);
    t=setTimeout(()=>fn.apply(this,args),delay||CFC_CONFIG.DEBOUNCE_MS);
  };
}

function showToast(msg,type=''){
  const t=document.getElementById('toast');
  if(!t)return;
  t.textContent=msg;
  t.className='toast show '+type;
  setTimeout(()=>t.className='toast',3500);
}

// Note: This file documents the shared patterns.
// In current architecture, these are inlined per page.
// Phase 2: Extract to actual shared module loaded via <script src="shared.js">
