
const SURL='https://hfufhcsvbrzygoykvtah.supabase.co';
const SKEY='sb_publishable_iqs1Q7TrS4j28CWqv3TUJQ_57WHtgB9';
const{createClient}=supabase;
const db=createClient(SURL,SKEY);

let currentMachine=null, currentOperator='', currentOpId=null, currentOrderId=null;
let currentMaxQty=0, refreshTimer=null;

// ── INIT ──
async function init(){
  const saved=localStorage.getItem('cfc-operator');
  if(saved){
    const s=JSON.parse(saved);
    currentMachine=s.machine;
    currentOperator=s.name;
    showOperatorView();
    return;
  }
  loadMachineList();
}

async function loadMachineList(){
  const{data:machines}=await db.from('machines').select('*').eq('is_active',true).order('operation');
  const{data:ops}=await db.from('production_order_operations').select('machine_id,status').in('status',['Pending','In Progress']);
  const statusMap={};
  (ops||[]).forEach(o=>{
    if(!statusMap[o.machine_id]) statusMap[o.machine_id]=[];
    statusMap[o.machine_id].push(o.status);
  });
  document.getElementById('machine-list').innerHTML=(machines||[]).map(m=>{
    const statuses=statusMap[m.id]||[];
    const isRunning=statuses.includes('In Progress');
    const hasPending=statuses.includes('Pending');
    const cls=isRunning?'running':hasPending?'pending':'';
    const statusText=isRunning?'Running':hasPending?'Pending':'Idle';
    const statusCls=isRunning?'running':hasPending?'pending':'idle';
    return`<div class="machine-btn ${cls}" onclick="selectMachine(${JSON.stringify(m).replace(/"/g,'&quot;')})">
      <div class="mb-name">${m.name}</div>
      <div class="mb-op">${m.operation}</div>
      <div class="mb-status ${statusCls}">${statusText}</div>
    </div>`;
  }).join('');
}

function selectMachine(machine){
  const name=document.getElementById('op-name').value.trim();
  if(!name){document.getElementById('op-name').style.borderColor='var(--red)';document.getElementById('op-name').placeholder='Pehle naam daalo!';return;}
  currentMachine=machine;
  currentOperator=name;
  localStorage.setItem('cfc-operator',JSON.stringify({machine,name}));
  showOperatorView();
}

function showOperatorView(){
  document.getElementById('login-view').style.display='none';
  document.getElementById('operator-view').style.display='block';
  document.getElementById('machine-badge').textContent=currentMachine.code;
  document.getElementById('op-machine-name').textContent=currentMachine.name;
  document.getElementById('op-operator-name').textContent='👤 '+currentOperator;
  updateClock();
  setInterval(updateClock,1000);
  loadJobs();
  refreshTimer=setInterval(loadJobs,30000);
}

function updateClock(){
  document.getElementById('op-time').textContent=new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true})+' · '+new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short'});
}

function logout(){
  localStorage.removeItem('cfc-operator');
  currentMachine=null;currentOperator='';
  clearInterval(refreshTimer);
  document.getElementById('login-view').style.display='block';
  document.getElementById('operator-view').style.display='none';
  document.getElementById('machine-badge').textContent='Operator';
  loadMachineList();
}

// ── LOAD JOBS ──
async function loadJobs(){
  const el=document.getElementById('jobs-area');
  const alertEl=document.getElementById('alerts-area');
  if(!currentMachine) return;

  const{data:ops}=await db.from('production_order_operations')
    .select('*,production_orders(id,order_no,order_type,planned_qty,items(code,name)),operations(name,seq),machines(name,code,capacity_type,capacity_value,cycle_time_minutes,setup_time_minutes)')
    .eq('machine_id',currentMachine.id)
    .in('status',['Pending','In Progress','Done'])
    .order('id');

  // Check alerts — koi next operation alert pending hai?
  const{data:alerts}=await db.from('operation_alerts')
    .select('*,production_orders(order_no,items(code))')
    .eq('to_machine_id',currentMachine.id)
    .eq('acknowledged',false)
    .order('alert_time',{ascending:false})
    .limit(3);

  // Show alerts
  alertEl.innerHTML=(alerts||[]).map(a=>`
    <div class="alert-banner">
      📦 <strong>${a.production_orders?.order_no}</strong> — ${a.qty_passed} pcs ${a.from_operation} se aaye hain — ready for ${a.to_operation}
      <button onclick="ackAlert(${a.id})" style="float:right;background:rgba(59,130,246,.3);border:none;color:#60a5fa;padding:3px 10px;border-radius:6px;cursor:pointer;font-size:12px">OK</button>
    </div>`).join('');

  if(!ops?.length){
    el.innerHTML=`<div class="no-jobs"><div class="no-jobs-icon">😴</div><div class="no-jobs-title">Koi kaam nahi</div><div style="font-size:13px;color:var(--text3)">Is machine pe abhi koi work order assign nahi hai</div></div>`;
    return;
  }

  const active=ops.filter(o=>['Pending','In Progress'].includes(o.status));
  const done=ops.filter(o=>o.status==='Done');

  let html='';
  if(active.length){
    html+=`<div class="section-title">Active Jobs (${active.length})</div>`;
    html+=active.map(op=>renderJobCard(op)).join('');
  }
  if(done.length){
    html+=`<div class="section-title" style="margin-top:16px">Completed Today (${done.length})</div>`;
    html+=done.map(op=>renderJobCard(op)).join('');
  }
  el.innerHTML=html;
}

function calcExpectedTime(op){
  const machine=op.machines;
  const qty=op.production_orders?.planned_qty||0;
  if(!machine||!qty) return null;
  let minutes=0;
  const setup=machine.setup_time_minutes||0;
  if(machine.capacity_type==='pcs_per_hour'&&machine.capacity_value>0){
    minutes=setup+(qty/machine.capacity_value*60);
  } else if(machine.capacity_type==='pcs_per_cycle'&&machine.capacity_value>0&&machine.cycle_time_minutes>0){
    const cycles=Math.ceil(qty/machine.capacity_value);
    minutes=setup+(cycles*machine.cycle_time_minutes);
  } else if(machine.capacity_type==='batch'){
    minutes=setup+(machine.cycle_time_minutes||25);
  } else {
    minutes=setup+60;
  }
  return Math.round(minutes);
}

function formatMins(mins){
  if(!mins) return '—';
  const h=Math.floor(mins/60);
  const m=mins%60;
  if(h>0) return`${h}h ${m}m`;
  return`${m} min`;
}

function getETA(startTime,minutes){
  if(!startTime||!minutes) return '—';
  const start=new Date(startTime);
  const end=new Date(start.getTime()+minutes*60000);
  return end.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
}

function getRemaining(startTime,totalMins,donePct){
  if(!startTime||!totalMins) return null;
  const elapsed=(Date.now()-new Date(startTime).getTime())/60000;
  const remaining=Math.max(0,totalMins*(1-donePct/100)-elapsed);
  return Math.round(remaining);
}

function renderJobCard(op){
  const order=op.production_orders;
  const plannedQty=order?.planned_qty||0;
  const doneQty=op.completed_qty||0;
  const rejQty=op.rejection_qty||0;
  const pct=plannedQty>0?Math.min(100,Math.round(doneQty/plannedQty*100)):0;
  const st=op.status;
  const expectedMins=calcExpectedTime(op);
  const eta=getETA(op.actual_start,expectedMins);
  const remaining=op.status==='In Progress'?getRemaining(op.actual_start,expectedMins,pct):null;
  const isLate=remaining!==null&&remaining<=0;

  return`<div class="job-card ${st==='In Progress'?'running':st==='Pending'?'pending':st==='Done'?'done':''}">
    <div class="job-top">
      <div class="job-no">${order?.order_no||'—'}</div>
      <div class="job-badge badge-${st==='In Progress'?'running':st==='Pending'?'pending':st==='Done'?'done':'blocked'}">${st}</div>
    </div>
    <div class="job-item">${order?.items?.code||'—'} — ${order?.items?.name||'—'}</div>
    <div class="job-op">${op.operations?.name||'—'}</div>

    ${st!=='Done'?`<div class="progress-section">
      <div class="progress-nums">
        <span class="progress-done">${doneQty}</span>
        <span class="progress-total">/ ${plannedQty} pcs</span>
        <span style="font-weight:700;color:${pct>=100?'var(--green)':'var(--text)'}">${pct}%</span>
      </div>
      <div class="pbar"><div class="pfill ${pct<30?'amber':''}" style="width:${pct}%"></div></div>
      ${rejQty>0?`<div style="font-size:12px;color:var(--red);margin-top:4px">⚠ ${rejQty} rejected${op.rejection_reason?' — '+op.rejection_reason:''}</div>`:''}
    </div>`:'<div style="font-size:14px;color:var(--green);margin-bottom:12px">✓ ${doneQty}/${plannedQty} pcs complete</div>'}

    ${expectedMins?`<div class="time-grid">
      <div class="time-card">
        <div class="time-label">Expected Time</div>
        <div class="time-val">${formatMins(expectedMins)}</div>
      </div>
      ${st==='In Progress'?`<div class="time-card">
        <div class="time-label">${isLate?'⚠ Overdue':'Time Remaining'}</div>
        <div class="time-val ${isLate?'red':remaining<30?'amber':'green'}">${remaining!==null?formatMins(remaining):'—'}</div>
      </div>`:`<div class="time-card">
        <div class="time-label">ETA (if started now)</div>
        <div class="time-val">${getETA(new Date(),expectedMins)}</div>
      </div>`}
    </div>`:''}

    ${st==='Pending'?`<div class="btn-row">
      <button class="big-btn btn-start" onclick="startOp(${op.id},${order?.id||0})">▶ Start Karo</button>
    </div>`:''}
    ${st==='In Progress'?`<div class="btn-row two">
      <button class="big-btn btn-update" onclick="openQtyScreen(${op.id},${plannedQty},${order?.id||0})">📝 Qty Update</button>
      <button class="big-btn btn-done" onclick="confirmDone(${op.id},${order?.id||0},'${op.operations?.name}',${plannedQty})">✓ Done</button>
    </div>
    <button class="big-btn btn-transfer" style="margin-top:8px" onclick="openTransfer(${op.id},${doneQty},'${op.operations?.name}',${order?.id||0})">📤 Partial Transfer → Next Machine</button>`:''}
  </div>`;
}

// ── OPERATIONS ──
async function startOp(opId,orderId){
  await db.from('production_order_operations').update({status:'In Progress',actual_start:new Date().toISOString()}).eq('id',opId);
  showBanner('▶ Operation shuru ho gayi!','success');
  loadJobs();
}

function openQtyScreen(opId,maxQty,orderId){
  currentOpId=opId;currentOrderId=orderId;currentMaxQty=maxQty;
  document.getElementById('qs-title').textContent='Qty Update karo';
  document.getElementById('qs-sub').textContent=`Max: ${maxQty} pcs`;
  document.getElementById('qs-input').value='';
  document.getElementById('qs-rej').value='';
  document.getElementById('qs-reason').value='';
  document.getElementById('qty-screen').classList.remove('hidden');
}

function closeQtyScreen(){document.getElementById('qty-screen').classList.add('hidden');}

async function saveQty(){
  const qty=parseFloat(document.getElementById('qs-input').value)||0;
  const rej=parseFloat(document.getElementById('qs-rej').value)||0;
  const reason=document.getElementById('qs-reason').value;
  if(!currentOpId) return;
  await db.from('production_order_operations').update({
    completed_qty:qty,rejection_qty:rej,
    rejection_reason:reason||null,
    operator_name:currentOperator,
    last_updated:new Date().toISOString()
  }).eq('id',currentOpId);
  if(currentOrderId) await db.from('production_orders').update({completed_qty:qty}).eq('id',currentOrderId);
  closeQtyScreen();
  showBanner(`✓ ${qty} pcs saved${rej>0?`, ${rej} rejected`:''}!`,'success');
  loadJobs();
}

async function confirmDone(opId,orderId,opName,plannedQty){
  if(!confirm(`${opName} complete mark karna hai?\n${plannedQty} pcs done?`)) return;
  await db.from('production_order_operations').update({
    status:'Done',actual_end:new Date().toISOString(),
    completed_qty:plannedQty,operator_name:currentOperator
  }).eq('id',opId);
  // Create alert for next operation
  await createNextAlert(opId,opName,orderId,plannedQty);
  showBanner('✓ Operation complete! Next machine ko alert bheja!','success');
  loadJobs();
}

async function createNextAlert(opId,opName,orderId,qty){
  const nextOpMap={
    'Mixing':'Preforming','Preforming':'Moulding',
    'Shot Blasting':'Adhesive Coating','Adhesive Coating':'Moulding',
    'Moulding':'Grinding','Grinding':'Powder Coating',
    'Powder Coating':'Oven Curing','Oven Curing':'Stacking',
    'Stacking':'Packing','Packing':'Dispatch'
  };
  const nextOp=nextOpMap[opName];
  if(!nextOp) return;
  const{data:nextOpRec}=await db.from('production_order_operations')
    .select('*,machines(id)')
    .eq('order_id',orderId)
    .eq('status','Pending')
    .limit(1);
  const toMachineId=nextOpRec?.[0]?.machine_id||null;
  await db.from('operation_alerts').insert({
    from_operation:opName,
    to_operation:nextOp,
    production_order_id:orderId,
    from_machine_id:currentMachine.id,
    to_machine_id:toMachineId,
    qty_passed:qty
  });
}

// ── PARTIAL TRANSFER ──
let transferOpId=null,transferOpName='',transferOrderId=null;

function openTransfer(opId,doneQty,opName,orderId){
  transferOpId=opId;transferOpName=opName;transferOrderId=orderId;
  document.getElementById('ts-sub').textContent=`${opName} se next operation pe bhejna hai (max: ${doneQty} pcs)`;
  document.getElementById('ts-qty').value='';
  document.getElementById('transfer-screen').classList.add('show');
}

function closeTransfer(){document.getElementById('transfer-screen').classList.remove('show');}

async function saveTransfer(){
  const qty=parseFloat(document.getElementById('ts-qty').value)||0;
  if(!qty){alert('Qty daalo!');return;}
  await db.from('partial_transfers').insert({
    from_operation_id:transferOpId,
    transferred_qty:qty,
    operator_name:currentOperator,
    notes:`Partial transfer from ${transferOpName}`
  });
  await createNextAlert(transferOpId,transferOpName,transferOrderId,qty);
  closeTransfer();
  showBanner(`✓ ${qty} pcs next machine ko bheje!`,'success');
  loadJobs();
}

async function ackAlert(alertId){
  await db.from('operation_alerts').update({acknowledged:true,acknowledged_at:new Date().toISOString()}).eq('id',alertId);
  loadJobs();
}

function showBanner(msg,type='info'){
  const el=document.getElementById('alerts-area');
  const div=document.createElement('div');
  div.className=`alert-banner ${type==='success'?'alert-success':type==='warn'?'alert-warn':''}`;
  div.textContent=msg;
  el.prepend(div);
  setTimeout(()=>div.remove(),4000);
}

init();
