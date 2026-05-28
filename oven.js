
const SURL='https://hfufhcsvbrzygoykvtah.supabase.co';
const SKEY='sb_publishable_iqs1Q7TrS4j28CWqv3TUJQ_57WHtgB9';
const{createClient}=supabase;
const db=createClient(SURL,SKEY);

const MAX_TRAYS=72;
const PREHEAT_MINS=180;
const CURING_MINS=240;
const COLORS=['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6'];

let currentLoad=null;
let timerInterval=null;

// Clock
setInterval(()=>{
  document.getElementById('clock').textContent=new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
},1000);

// ── LOAD CURRENT OVEN ──
async function loadOven(){
  // Get active oven load (not complete)
  const{data:loads}=await db.from('oven_loads')
    .select('*,machines(name)')
    .not('status','eq','Complete')
    .order('created_at',{ascending:false})
    .limit(1);

  currentLoad=loads?.[0]||null;

  if(!currentLoad){
    // No active load
    document.getElementById('oven-area').innerHTML=`
      <div class="oven-box" style="text-align:center;padding:40px 20px">
        <div style="font-size:48px;margin-bottom:12px">🔥</div>
        <div style="font-size:18px;font-weight:500;margin-bottom:6px">Oven Khali Hai</div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:20px">Powder Coating ke baad pads oven mein daalo</div>
        <button class="big-btn btn-add" style="max-width:250px;margin:0 auto" onclick="newOvenLoad()">+ Naya Oven Load Shuru Karo</button>
      </div>`;
    loadHistory();
    return;
  }

  // Get items in this load
  const{data:items}=await db.from('oven_load_items')
    .select('*,items(code,name),production_orders(order_no)')
    .eq('oven_load_id',currentLoad.id);

  renderOven(currentLoad, items||[]);
  loadHistory();
  startTimer();
}

function renderOven(load, items){
  const usedTrays=items.reduce((s,i)=>s+(i.trays_used||0),0);
  const pct=Math.round(usedTrays/MAX_TRAYS*100);
  const isFull=usedTrays>=MAX_TRAYS;
  const status=load.status;

  // Status badge
  const badges={
    'Loading':`<span class="oven-status-badge sb-loading">📥 Loading — ${usedTrays}/${MAX_TRAYS} Trays</span>`,
    'Full':`<span class="oven-status-badge sb-full">✅ Full — Ready to Start</span>`,
    'Preheating':`<span class="oven-status-badge sb-preheating">🔥 Preheating...</span>`,
    'Curing':`<span class="oven-status-badge sb-curing">⚡ Curing in Progress</span>`,
    'Complete':`<span class="oven-status-badge sb-complete">✓ Complete</span>`
  };

  // Timer HTML
  let timerHTML='';
  if(status==='Preheating'&&load.preheat_start){
    const elapsed=Math.floor((Date.now()-new Date(load.preheat_start).getTime())/60000);
    const remaining=Math.max(0,PREHEAT_MINS-elapsed);
    timerHTML=`<div class="timer-section">
      <div class="timer-label">Preheat Remaining</div>
      <div class="timer-val amber" id="timer-display">${formatTime(remaining)}</div>
      <div class="timer-eta">Curing start: ${new Date(new Date(load.preheat_start).getTime()+PREHEAT_MINS*60000).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true})}</div>
    </div>`;
  } else if(status==='Curing'&&load.curing_start){
    const elapsed=Math.floor((Date.now()-new Date(load.curing_start).getTime())/60000);
    const remaining=Math.max(0,CURING_MINS-elapsed);
    timerHTML=`<div class="timer-section">
      <div class="timer-label">Curing Remaining</div>
      <div class="timer-val red" id="timer-display">${formatTime(remaining)}</div>
      <div class="timer-eta">Complete at: ${new Date(new Date(load.curing_start).getTime()+CURING_MINS*60000).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true})}</div>
    </div>`;
  }

  // Action buttons
  let btns='';
  if(status==='Loading'){
    btns=`
      <button class="big-btn btn-add" onclick="toggleAddForm()">+ SKU Add Karo</button>
      <button class="big-btn btn-preheat" ${!isFull&&usedTrays<60?'disabled title="72 trays full karo pehle"':''} onclick="startPreheat()">
        🔥 Preheat Shuru Karo${!isFull?` (${MAX_TRAYS-usedTrays} trays baaki)`:''}
      </button>`;
  } else if(status==='Full'){
    btns=`
      <button class="big-btn btn-add" onclick="toggleAddForm()">+ Aur SKU Add Karo</button>
      <button class="big-btn btn-preheat" onclick="startPreheat()">🔥 Preheat Shuru Karo</button>`;
  } else if(status==='Preheating'){
    btns=`<button class="big-btn btn-curing" onclick="startCuring()">⚡ Curing Shuru Karo</button>`;
  } else if(status==='Curing'){
    btns=`<button class="big-btn btn-done" onclick="completeCuring()">✅ Curing Complete — Nikalo</button>`;
  }

  // SKU list
  const skuHTML=items.map((item,idx)=>`
    <div class="sku-row">
      <div class="sku-color" style="background:${COLORS[idx%COLORS.length]}"></div>
      <div class="sku-name">${item.items?.code||'—'} — ${item.items?.name||'—'}</div>
      <div class="sku-pcs">${item.pcs_added} pcs</div>
      <div class="sku-trays">${item.trays_used} trays</div>
      ${status==='Loading'?`<button class="sku-remove" onclick="removeSKU(${item.id})" title="Hatao">×</button>`:''}
    </div>`).join('');

  document.getElementById('oven-area').innerHTML=`
    <div class="oven-box ${status.toLowerCase()}">
      <div class="oven-header">
        <div class="oven-title">🔥 Curing Oven ${badges[status]||''}</div>
      </div>

      <!-- TRAY PROGRESS -->
      <div class="tray-section">
        <div class="tray-count" style="color:${isFull?'var(--green)':usedTrays>50?'var(--amber)':'var(--text)'}">${usedTrays} <span style="font-size:18px;color:var(--text3)">/ ${MAX_TRAYS}</span></div>
        <div class="tray-label">Trays loaded${isFull?' — FULL ✅':` — ${MAX_TRAYS-usedTrays} aur daal sakte ho`}</div>
        <div class="tray-bar">
          <div class="tray-fill ${status==='Curing'?'curing':isFull?'full':'loading'}" style="width:${pct}%"></div>
        </div>
        <div style="font-size:11px;color:var(--text3)">${pct}% full</div>
      </div>

      <!-- SKUs -->
      ${items.length?`<div class="sku-list">${skuHTML}</div>`:'<div style="color:var(--text3);font-size:13px;margin-bottom:16px">Abhi koi SKU nahi daala. "+ SKU Add Karo" dabao.</div>'}

      <!-- ADD FORM -->
      <div class="add-form" id="add-form">
        <div class="flabel">Kaunsa SKU daalna hai?</div>
        <select class="finput" id="af-item" onchange="calcTrays()">
          <option value="">-- SKU select karo --</option>
        </select>
        <div class="frow">
          <div>
            <div class="flabel">Kitne pcs?</div>
            <input class="finput" id="af-pcs" type="number" placeholder="0" oninput="calcTrays()"/>
          </div>
          <div>
            <div class="flabel">Tray capacity (pcs)</div>
            <input class="finput" id="af-tray" type="number" placeholder="12" oninput="calcTrays()"/>
          </div>
        </div>
        <div class="calc-info" id="af-calc">SKU aur pcs daalo — trays auto calculate honge</div>
        <div class="frow">
          <button class="big-btn btn-new" style="font-size:13px;padding:10px" onclick="toggleAddForm()">Cancel</button>
          <button class="big-btn btn-done" style="font-size:13px;padding:10px" onclick="addSKUToOven()">+ Add to Oven</button>
        </div>
      </div>

      ${timerHTML}

      <!-- ACTION BUTTONS -->
      <div class="btn-row">${btns}</div>
    </div>`;

  // Load SKU dropdown
  loadSKUDropdown();
}

async function loadSKUDropdown(){
  const{data:items}=await db.from('items').select('id,code,name').in('type',['SFG','FG']).order('code');
  const sel=document.getElementById('af-item');
  if(!sel) return;
  sel.innerHTML='<option value="">-- SKU select karo --</option>'+(items||[]).map(i=>`<option value="${i.id}" data-code="${i.code}">${i.code} — ${i.name}</option>`).join('');

  // Auto fill tray capacity from sku_master
  sel.addEventListener('change',async()=>{
    const itemId=sel.value;
    if(!itemId) return;
    const{data:sku}=await db.from('sku_master').select('oven_tray_capacity').eq('fg_item_id',itemId).maybeSingle();
    if(sku?.oven_tray_capacity){
      document.getElementById('af-tray').value=sku.oven_tray_capacity;
      calcTrays();
    }
  });
}

function calcTrays(){
  const pcs=parseInt(document.getElementById('af-pcs')?.value)||0;
  const cap=parseInt(document.getElementById('af-tray')?.value)||1;
  const el=document.getElementById('af-calc');
  if(!el) return;
  if(pcs>0&&cap>0){
    const trays=Math.ceil(pcs/cap);
    const usedTrays=(currentLoad?._usedTrays)||0;
    const remaining=MAX_TRAYS-(currentLoad?._usedTrays||0);
    el.innerHTML=`<strong style="color:var(--text)">${pcs} pcs</strong> ÷ <strong style="color:var(--text)">${cap} pcs/tray</strong> = <strong style="color:${trays>remaining?'var(--red)':'var(--green)'}">${trays} trays</strong> needed${trays>remaining?` <span style="color:var(--red)">⚠ Sirf ${remaining} trays available!</span>`:''}`;
  }
}

function toggleAddForm(){
  const form=document.getElementById('add-form');
  if(form) form.classList.toggle('show');
}

async function addSKUToOven(){
  const itemId=document.getElementById('af-item')?.value;
  const pcs=parseInt(document.getElementById('af-pcs')?.value)||0;
  const cap=parseInt(document.getElementById('af-tray')?.value)||1;
  if(!itemId||pcs<=0){showToast('SKU aur pcs daalo!');return;}
  const trays=Math.ceil(pcs/cap);

  const{data:item}=await db.from('items').select('id').eq('id',itemId).single();
  await db.from('oven_load_items').insert({
    oven_load_id:currentLoad.id,
    item_id:itemId,
    pcs_added:pcs,
    trays_used:trays,
    tray_capacity:cap
  });

  // Update total trays
  const{data:allItems}=await db.from('oven_load_items').select('trays_used').eq('oven_load_id',currentLoad.id);
  const totalTrays=(allItems||[]).reduce((s,i)=>s+(i.trays_used||0),0)+trays;
  const newStatus=totalTrays>=MAX_TRAYS?'Full':'Loading';
  await db.from('oven_loads').update({total_trays:totalTrays,status:newStatus}).eq('id',currentLoad.id);

  showToast(`✓ ${pcs} pcs (${trays} trays) added!`);
  loadOven();
}

async function removeSKU(itemId){
  const{data:item}=await db.from('oven_load_items').select('trays_used').eq('id',itemId).single();
  await db.from('oven_load_items').delete().eq('id',itemId);
  const newTrays=Math.max(0,(currentLoad.total_trays||0)-(item?.trays_used||0));
  await db.from('oven_loads').update({total_trays:newTrays,status:'Loading'}).eq('id',currentLoad.id);
  loadOven();
}

async function startPreheat(){
  await db.from('oven_loads').update({status:'Preheating',preheat_start:new Date().toISOString()}).eq('id',currentLoad.id);
  showToast('🔥 Preheat shuru! 3 ghante baad curing start karo.');
  loadOven();
}

async function startCuring(){
  await db.from('oven_loads').update({status:'Curing',curing_start:new Date().toISOString()}).eq('id',currentLoad.id);
  showToast('⚡ Curing shuru! 4 ghante mein complete hoga.');
  loadOven();
}

async function completeCuring(){
  if(!confirm('Curing complete hai? Pads nikalne ke baad confirm karo.')) return;
  await db.from('oven_loads').update({status:'Complete',curing_end:new Date().toISOString()}).eq('id',currentLoad.id);
  showToast('✅ Oven batch complete! Pads stacking ke liye ready hain.');
  currentLoad=null;
  loadOven();
}

async function newOvenLoad(){
  if(currentLoad&&currentLoad.status!=='Complete'){
    if(!confirm('Ek load pehle se chal raha hai. Phir bhi naya banao?')) return;
  }
  const{data:oven}=await db.from('machines').select('id').eq('operation','Oven Curing').limit(1).single();
  const{data:load}=await db.from('oven_loads').insert({
    oven_machine_id:oven?.id||null,
    max_trays:MAX_TRAYS,
    total_trays:0,
    status:'Loading',
    load_date:new Date().toISOString().split('T')[0]
  }).select().single();
  currentLoad=load;
  showToast('✓ Naya oven load shuru!');
  loadOven();
}

// Timer updater
function startTimer(){
  if(timerInterval) clearInterval(timerInterval);
  timerInterval=setInterval(()=>{
    const el=document.getElementById('timer-display');
    if(!el||!currentLoad) return;
    let remaining=0;
    if(currentLoad.status==='Preheating'&&currentLoad.preheat_start){
      const elapsed=Math.floor((Date.now()-new Date(currentLoad.preheat_start).getTime())/60000);
      remaining=Math.max(0,PREHEAT_MINS-elapsed);
    } else if(currentLoad.status==='Curing'&&currentLoad.curing_start){
      const elapsed=Math.floor((Date.now()-new Date(currentLoad.curing_start).getTime())/60000);
      remaining=Math.max(0,CURING_MINS-elapsed);
      if(remaining===0){
        el.textContent='DONE! ✅';
        showToast('✅ Curing complete! Pads nikaalo.');
        clearInterval(timerInterval);
        return;
      }
    }
    el.textContent=formatTime(remaining);
  },60000);
}

function formatTime(mins){
  const h=Math.floor(mins/60);
  const m=mins%60;
  return h>0?`${h}h ${m}m`:`${m} min`;
}

async function loadHistory(){
  const{data:loads}=await db.from('oven_loads').select('*').eq('status','Complete').order('created_at',{ascending:false}).limit(10);
  const el=document.getElementById('oven-history');
  if(!loads?.length){el.innerHTML='<div style="color:var(--text3);font-size:13px">Koi completed load nahi.</div>';return;}
  el.innerHTML=loads.map(l=>{
    const duration=l.curing_end&&l.preheat_start?Math.round((new Date(l.curing_end)-new Date(l.preheat_start))/3600000)+' hrs':'—';
    return`<div class="hist-row">
      <div class="hist-date">${new Date(l.load_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
      <div class="hist-skus">${l.total_trays||0} trays · ${l.notes||'Completed'}</div>
      <div class="hist-time">${duration}</div>
      <span style="font-size:11px;background:rgba(59,130,246,.15);color:#60a5fa;padding:2px 8px;border-radius:4px">Done</span>
    </div>`;
  }).join('');
}

function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.style.display='block';
  clearTimeout(t._t);t._t=setTimeout(()=>t.style.display='none',3000);
}

loadOven();
