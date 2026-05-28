
const SURL='https://hfufhcsvbrzygoykvtah.supabase.co';
const SKEY='sb_publishable_iqs1Q7TrS4j28CWqv3TUJQ_57WHtgB9';
const{createClient}=supabase;
const db=createClient(SURL,SKEY);

const CYCLE_TIME=8.5;
const SETUP_TOTAL=130;
const CHANGEOVER=100;

let dies=[], items=[], lastPlan=null;

// Set today date
const now=new Date();
document.getElementById('today-date').textContent=now.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const dtLocal=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
document.getElementById('start-datetime').value=dtLocal;

async function init(){
  const[diesRes,itemsRes]=await Promise.all([
    db.from('dies').select('*').eq('is_active',true).order('die_code'),
    db.from('items').select('id,code,name,type').in('type',['SFG','FG']).order('code')
  ]);
  dies=diesRes.data||[];
  items=itemsRes.data||[];

  const dieOpts=`<option value="">-- Select Die --</option>`+dies.map(d=>`<option value="${d.id}" data-cav="${d.cavity_count}" data-code="${d.die_code}">${d.die_code} (${d.cavity_count} cav)</option>`).join('');
  const itemOpts=`<option value="">-- Select Item --</option>`+items.map(i=>`<option value="${i.id}">${i.code} — ${i.name}</option>`).join('');

  ['p1s1-die','p1s2-die','p2s1-die','p2s2-die'].forEach(id=>document.getElementById(id).innerHTML=dieOpts);
  ['p1s1-sku','p1s2-sku','p2s1-sku','p2s2-sku'].forEach(id=>document.getElementById(id).innerHTML=itemOpts);
}

function updateDieInfo(slot){
  const sel=document.getElementById(slot+'-die');
  const opt=sel.selectedOptions[0];
  const cavEl=document.getElementById(slot+'-cav');
  if(opt&&opt.dataset.cav) cavEl.value=opt.dataset.cav;
  calculate();
}

function getSlot(id){
  return{
    die:document.getElementById(id+'-die')?.selectedOptions[0]?.dataset?.code||'—',
    sku:document.getElementById(id+'-sku')?.selectedOptions[0]?.text||'—',
    qty:parseInt(document.getElementById(id+'-qty')?.value)||0,
    cav:parseInt(document.getElementById(id+'-cav')?.value)||0,
    itemId:document.getElementById(id+'-sku')?.value||null
  };
}

function calcPress(s1,s2,hasChange,startMin){
  if(!s1.qty&&!s2.qty) return null;
  const setup=hasChange?SETUP_TOTAL:0;
  const netStart=startMin+setup;

  let cycles1=s1.cav>0?Math.ceil(s1.qty/s1.cav):0;
  let cycles2=s2.cav>0?Math.ceil(s2.qty/s2.cav):0;
  let maxCycles=Math.max(cycles1,cycles2);

  const time1=cycles1*CYCLE_TIME;
  const time2=cycles2*CYCLE_TIME;

  // Changeover bonus pcs
  let bonusPcs=0, bonusFrom='', changeoverAt=0;
  if(cycles1>0&&cycles2>0&&cycles1!==cycles2){
    if(cycles1<cycles2){
      changeoverAt=netStart+time1;
      bonusPcs=Math.floor(CHANGEOVER/CYCLE_TIME)*s2.cav;
      bonusFrom=s2.sku;
    } else {
      changeoverAt=netStart+time2;
      bonusPcs=Math.floor(CHANGEOVER/CYCLE_TIME)*s1.cav;
      bonusFrom=s1.sku;
    }
  }

  const totalMin=setup+maxCycles*CYCLE_TIME;
  return{setup,cycles1,cycles2,maxCycles,time1,time2,totalMin,bonusPcs,bonusFrom,changeoverAt,netStart,s1,s2};
}

function minToTime(startDate,addMin){
  const d=new Date(startDate.getTime()+addMin*60000);
  return d.toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:true});
}

function minToHuman(min){
  const d=Math.floor(min/1440);
  const h=Math.floor((min%1440)/60);
  const m=Math.round(min%60);
  if(d>0) return`${d}d ${h}h ${m}m`;
  if(h>0) return`${h}h ${m}m`;
  return`${m} min`;
}

function calculate(){
  const p1s1=getSlot('p1s1');
  const p1s2=getSlot('p1s2');
  const p2s1=getSlot('p2s1');
  const p2s2=getSlot('p2s2');
  const p1Change=document.getElementById('p1-change').checked;
  const p2Change=document.getElementById('p2-change').checked;
  const startDt=new Date(document.getElementById('start-datetime').value);

  if(!p1s1.qty&&!p1s2.qty&&!p2s1.qty&&!p2s2.qty) return;

  const p1=calcPress(p1s1,p1s2,p1Change,0);
  const p2=calcPress(p2s1,p2s2,p2Change,0);

  const maxTime=Math.max(p1?.totalMin||0, p2?.totalMin||0);
  const totalPcs=(p1s1.qty||0)+(p1s2.qty||0)+(p2s1.qty||0)+(p2s2.qty||0);
  const bonusTotal=(p1?.bonusPcs||0)+(p2?.bonusPcs||0);
  const endDate=minToTime(startDt,maxTime);
  const days=(maxTime/1440).toFixed(2);

  lastPlan={p1,p2,p1s1,p1s2,p2s1,p2s2,startDt,maxTime,totalPcs,bonusTotal,endDate};

  // STATS
  document.getElementById('stat-grid').innerHTML=`
  <div class="stat blue"><div class="stat-label">Total Pcs Planned</div><div class="stat-val">${totalPcs.toLocaleString()}</div><div class="stat-sub">All 4 slots</div></div>
  <div class="stat green"><div class="stat-label">Bonus Pcs (zero loss)</div><div class="stat-val">+${bonusTotal}</div><div class="stat-sub">During changeover</div></div>
  <div class="stat amber"><div class="stat-label">Total Time</div><div class="stat-val">${minToHuman(maxTime)}</div><div class="stat-sub">${days} days</div></div>
  <div class="stat ${maxTime>2880?'red':'green'}"><div class="stat-label">Delivery</div><div class="stat-val" style="font-size:13px">${endDate}</div><div class="stat-sub">${maxTime>2880?'2+ days needed':'Within 2 days ✓'}</div></div>`;

  // PRESS VISUALS
  let pv='';
  if(p1){
    const pct1=p1.cycles1>0?Math.round(p1.cycles1/p1.maxCycles*100):0;
    const pct2=p1.cycles2>0?Math.round(p1.cycles2/p1.maxCycles*100):0;
    pv+=`<div class="press-visual">
    <div class="press-row"><div class="press-icon">⚙</div><div><div class="press-name">Hydraulic Press 1 (MLD-01)</div><div style="font-size:11px;color:var(--text3)">${p1Change?'SKU Change — '+SETUP_TOTAL+' min setup':'Same SKU — No setup time'} · ${minToHuman(p1.totalMin)}</div></div></div>
    <div class="die-slots">
      <div class="die-slot ${p1s1.qty?'running':''}">
        <div class="die-slot-label">Slot 1</div>
        <div class="die-slot-name">${p1s1.die}</div>
        <div class="die-slot-detail">${p1s1.sku} · ${p1s1.qty||0} pcs · ${p1s1.cav||0} cav · ${p1.cycles1} cycles</div>
        <div class="pbar"><div class="pfill" style="width:${pct1}%"></div></div>
        <div style="font-size:10px;color:var(--text3);margin-top:3px">Done at: ${minToTime(startDt,(p1?.setup||0)+p1.time1)}</div>
      </div>
      <div class="die-slot ${p1s2.qty?'running':''}">
        <div class="die-slot-label">Slot 2</div>
        <div class="die-slot-name">${p1s2.die}</div>
        <div class="die-slot-detail">${p1s2.sku} · ${p1s2.qty||0} pcs · ${p1s2.cav||0} cav · ${p1.cycles2} cycles</div>
        <div class="pbar"><div class="pfill" style="width:${pct2}%"></div></div>
        <div style="font-size:10px;color:var(--text3);margin-top:3px">Done at: ${minToTime(startDt,(p1?.setup||0)+p1.time2)}</div>
      </div>
    </div>
    ${p1.bonusPcs>0?`<div style="margin-top:8px;padding:6px 10px;background:rgba(16,185,129,.1);border-radius:6px;font-size:11px;color:#34d399">✓ Changeover pe ${p1.bonusPcs} bonus pcs — ${p1.bonusFrom} se (zero loss)</div>`:''}
    </div>`;
  }
  if(p2){
    const pct1=p2.cycles1>0?Math.round(p2.cycles1/p2.maxCycles*100):0;
    const pct2=p2.cycles2>0?Math.round(p2.cycles2/p2.maxCycles*100):0;
    pv+=`<div class="press-visual">
    <div class="press-row"><div class="press-icon">⚙</div><div><div class="press-name">Hydraulic Press 2 (MLD-02)</div><div style="font-size:11px;color:var(--text3)">${p2Change?'SKU Change — '+SETUP_TOTAL+' min setup':'Same SKU — No setup time'} · ${minToHuman(p2.totalMin)}</div></div></div>
    <div class="die-slots">
      <div class="die-slot ${p2s1.qty?'running':''}">
        <div class="die-slot-label">Slot 1</div>
        <div class="die-slot-name">${p2s1.die}</div>
        <div class="die-slot-detail">${p2s1.sku} · ${p2s1.qty||0} pcs · ${p2s1.cav||0} cav · ${p2.cycles1} cycles</div>
        <div class="pbar"><div class="pfill" style="width:${pct1}%"></div></div>
        <div style="font-size:10px;color:var(--text3);margin-top:3px">Done at: ${minToTime(startDt,(p2?.setup||0)+p2.time1)}</div>
      </div>
      <div class="die-slot ${p2s2.qty?'running':''}">
        <div class="die-slot-label">Slot 2</div>
        <div class="die-slot-name">${p2s2.die}</div>
        <div class="die-slot-detail">${p2s2.sku} · ${p2s2.qty||0} pcs · ${p2s2.cav||0} cav · ${p2.cycles2} cycles</div>
        <div class="pbar"><div class="pfill" style="width:${pct2}%"></div></div>
        <div style="font-size:10px;color:var(--text3);margin-top:3px">Done at: ${minToTime(startDt,(p2?.setup||0)+p2.time2)}</div>
      </div>
    </div>
    ${p2.bonusPcs>0?`<div style="margin-top:8px;padding:6px 10px;background:rgba(16,185,129,.1);border-radius:6px;font-size:11px;color:#34d399">✓ Changeover pe ${p2.bonusPcs} bonus pcs — ${p2.bonusFrom} se (zero loss)</div>`:''}
    </div>`;
  }
  document.getElementById('press-visuals').innerHTML=pv;

  // TIMELINE
  let tl=[];
  const addEvent=(min,color,event,detail)=>tl.push({min,color,event,detail,time:minToTime(startDt,min)});

  addEvent(0,'#3b82f6','Production plan start',`Total: ${totalPcs.toLocaleString()} pcs across 2 presses`);
  if(p1){
    if(p1Change) addEvent(0,'#f59e0b','Press 1 setup / die change',`${SETUP_TOTAL} min — warmup + die heatup`);
    if(p1.cycles1>0) addEvent((p1?.setup||0)+p1.time1,'#10b981',`Press 1 Slot 1 complete`,`${p1s1.sku} — ${p1s1.qty} pcs done`);
    if(p1.cycles2>0) addEvent((p1?.setup||0)+p1.time2,'#10b981',`Press 1 Slot 2 complete`,`${p1s2.sku} — ${p1s2.qty} pcs done`);
    if(p1.bonusPcs>0) addEvent(p1.changeoverAt,'#f59e0b','Press 1 changeover start',`Slot se ${p1.bonusPcs} bonus pcs milenge`);
  }
  if(p2){
    if(p2Change) addEvent(0,'#f59e0b','Press 2 setup / die change',`${SETUP_TOTAL} min — warmup + die heatup`);
    if(p2.cycles1>0) addEvent((p2?.setup||0)+p2.time1,'#10b981',`Press 2 Slot 1 complete`,`${p2s1.sku} — ${p2s1.qty} pcs done`);
    if(p2.cycles2>0) addEvent((p2?.setup||0)+p2.time2,'#10b981',`Press 2 Slot 2 complete`,`${p2s2.sku} — ${p2s2.qty} pcs done`);
    if(p2.bonusPcs>0) addEvent(p2.changeoverAt,'#f59e0b','Press 2 changeover start',`Slot se ${p2.bonusPcs} bonus pcs milenge`);
  }
  addEvent(maxTime,'#10b981','All production complete',`Delivery ready — ${endDate}`);

  tl.sort((a,b)=>a.min-b.min);
  document.getElementById('timeline-content').innerHTML=tl.map(e=>`
  <div class="tl-row">
    <div class="tl-dot" style="background:${e.color}"></div>
    <div class="tl-content">
      <div class="tl-event">${e.event}</div>
      <div class="tl-time">${e.time} (T+${minToHuman(e.min)})</div>
      <div class="tl-detail">${e.detail}</div>
    </div>
  </div>`).join('');

  // RM Calculation
  calcRM(p1s1,p1s2,p2s1,p2s2);

  // ALERTS
  let alerts='';
  if(maxTime>2880) alerts+=`<div class="alert alert-warn">⚠ Plan 2 din se zyada hai (${days} days). Kya aap quantities split karna chahte hain?</div>`;
  if(bonusTotal>0) alerts+=`<div class="alert alert-success">✓ Smart changeover — ${bonusTotal} extra pcs bina kisi loss ke. Press band nahi hogi!</div>`;
  if(!p1&&!p2) alerts+=`<div class="alert alert-warn">Koi data enter nahi kiya.</div>`;
  document.getElementById('alerts-section').innerHTML=alerts;

  document.getElementById('result-section').classList.add('show');
}

async function calcRM(p1s1,p1s2,p2s1,p2s2){
  const rmEl=document.getElementById('rm-content');
  const allItems=[p1s1,p1s2,p2s1,p2s2].filter(s=>s.qty>0&&s.itemId);

  if(!allItems.length){rmEl.innerHTML='<p style="color:var(--text3);font-size:13px">Koi item select nahi kiya.</p>';return;}

  rmEl.innerHTML='<div class="loader"><div class="spinner"></div> RM calculate ho raha hai...</div>';

  let rmNeeded={};
  for(const slot of allItems){
    const{data:bom}=await db.from('bom_headers').select('id,output_qty').eq('item_id',slot.itemId).eq('is_active',true).single();
    if(!bom) continue;
    const{data:lines}=await db.from('bom_lines').select('qty,uom,items(code,name,type)').eq('bom_id',bom.id);
    if(!lines) continue;
    const multiplier=slot.qty/bom.output_qty;
    lines.forEach(l=>{
      const key=l.items?.code||'unknown';
      if(!rmNeeded[key]) rmNeeded[key]={name:l.items?.name,uom:l.uom,needed:0,type:l.items?.type};
      rmNeeded[key].needed+=l.qty*multiplier;
    });
  }

  // Check stock
  const codes=Object.keys(rmNeeded);
  if(!codes.length){rmEl.innerHTML='<p style="color:var(--text3);font-size:13px">BOM nahi mila. Pehle BOM add karo.</p>';return;}

  const{data:inv}=await db.from('inventory').select('current_stock,items(code)').in('items.code',codes);
  const stockMap={};
  (inv||[]).forEach(i=>{if(i.items?.code)stockMap[i.items.code]=i.current_stock||0;});

  let rows='';
  let hasShortage=false;
  Object.entries(rmNeeded).forEach(([code,rm])=>{
    const stock=stockMap[code]||0;
    const needed=Math.ceil(rm.needed*10)/10;
    const short=needed-stock;
    const status=stock>=needed?'ok':stock>0?'warn':'low';
    if(status!=='ok') hasShortage=true;
    rows+=`<tr>
      <td class="mono" style="font-size:12px">${code}</td>
      <td>${rm.name||'—'}</td>
      <td class="mono">${needed.toFixed(2)} ${rm.uom}</td>
      <td class="mono">${stock} ${rm.uom}</td>
      <td class="mono" style="color:${short>0?'var(--red)':'var(--green)'}">${short>0?'+'+short.toFixed(2)+' NEEDED':'✓ OK'}</td>
      <td><span class="badge badge-${status==='ok'?'ok':status==='warn'?'warn':'low'}">${status==='ok'?'OK':status==='warn'?'Low':'Shortage'}</span></td>
    </tr>`;
  });

  rmEl.innerHTML=`
  ${hasShortage?'<div class="alert alert-warn" style="margin-bottom:10px">⚠ Kuch RMs ki shortage hai — purchase order banao pehle</div>':'<div class="alert alert-success" style="margin-bottom:10px">✓ Sab RM available hai — production shuru kar sakte ho</div>'}
  <div style="overflow-x:auto"><table class="rm-table">
    <thead><tr><th>Code</th><th>Material</th><th>Required</th><th>In Stock</th><th>Gap</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

async function savePlan(){
  if(!lastPlan) return;
  const{p1,p2,p1s1,p1s2,p2s1,p2s2,startDt}=lastPlan;
  const orders=[];
  const date=startDt.toISOString().split('T')[0];

  [[p1s1,'MLD-01'],[p1s2,'MLD-01'],[p2s1,'MLD-02'],[p2s2,'MLD-02']].forEach(([s,press])=>{
    if(s.qty>0&&s.itemId) orders.push({
      order_no:'PO-'+Date.now().toString().slice(-6)+'-'+Math.random().toString(36).slice(2,5).toUpperCase(),
      order_type:'MTS',
      item_id:s.itemId,
      planned_qty:s.qty,
      planned_date:date,
      status:'Planned',
      notes:`Press: ${press} | Die: ${s.die} | Cavity: ${s.cav}`
    });
  });

  if(!orders.length){showToast('Koi order save karne ke liye nahi');return;}

  const{error}=await db.from('production_orders').insert(orders);
  if(error){showToast('Error: '+error.message);return;}
  showToast(`✓ ${orders.length} production orders create ho gaye!`);
  setTimeout(()=>window.location.href='/tracker',2000);
}

function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.style.display='block';
  setTimeout(()=>t.style.display='none',3000);
}

init();
