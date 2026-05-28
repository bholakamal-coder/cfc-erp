
const SURL='https://hfufhcsvbrzygoykvtah.supabase.co';
const SKEY='sb_publishable_iqs1Q7TrS4j28CWqv3TUJQ_57WHtgB9';
const{createClient}=supabase;
const db=createClient(SURL,SKEY);

const MTS_OPS=['Mixing','Preforming','Shot Blasting','Adhesive Coating','Moulding','Grinding','Powder Coating','Oven Curing','Stacking'];
const MTO_OPS=[...MTS_OPS,'Printing','Orbital Riveting','Packing','Dispatch'];
const ALL_OPS=['Mixing','Preforming','Shot Blasting','Adhesive Coating','Moulding','Grinding','Powder Coating','Oven Curing','Stacking','Printing','Orbital Riveting','Packing','Dispatch'];

function sc(s){return{Draft:'pending',Planned:'planned','In Progress':'inprog',Completed:'done',Cancelled:'cancel',Stacked:'planned',Packed:'done',Pass:'done',Fail:'cancel',Hold:'amber',Pending:'pending',Done:'done'}[s]||'pending';}

async function loadTracker(){
  const el=document.getElementById('content');
  const[machRes,opsRes,ordRes]=await Promise.all([
    db.from('machines').select('*').eq('is_active',true).order('operation'),
    db.from('production_order_operations').select('*,production_orders(id,order_no,order_type,status,planned_qty,items(code,name)),operations(name,seq),machines(name,code)').not('status','eq','Skipped').order('id'),
    db.from('production_orders').select('*,items(code,name)').in('status',['Planned','In Progress']).order('created_at',{ascending:false})
  ]);
  const machines=machRes.data||[];
  const allOps=opsRes.data||[];
  const orders=ordRes.data||[];

  const running=allOps.filter(o=>o.status==='In Progress').length;
  const pending=allOps.filter(o=>o.status==='Pending').length;
  const done=allOps.filter(o=>o.status==='Done').length;

  const opsByMachine={};
  allOps.forEach(op=>{if(!opsByMachine[op.machine_id])opsByMachine[op.machine_id]=[];opsByMachine[op.machine_id].push(op);});

  el.innerHTML=`
<div class="stats">
  <div class="stat green"><div class="stat-label">Running Now</div><div class="stat-val">${running}</div></div>
  <div class="stat amber"><div class="stat-label">Pending Ops</div><div class="stat-val">${pending}</div></div>
  <div class="stat blue"><div class="stat-label">Completed Ops</div><div class="stat-val">${done}</div></div>
  <div class="stat"><div class="stat-label">Active Orders</div><div class="stat-val">${orders.length}</div></div>
</div>

<div class="section-title">Active Production Orders — Step by Step Flow</div>
${orders.length?orders.map(order=>{
  const orderOps=allOps.filter(o=>o.order_id===order.id);
  const steps=order.order_type==='MTS'?MTS_OPS:MTO_OPS;
  return`<div class="order-card">
  <div class="order-head" onclick="showOrderDetail(${order.id})">
    <span class="order-no">${order.order_no}</span>
    <span class="badge badge-${order.order_type.toLowerCase()}">${order.order_type}</span>
    <span class="order-item">${order.items?.code} — ${order.items?.name}</span>
    <span style="font-size:12px;color:var(--text2)">Qty: ${order.planned_qty}</span>
    <span class="badge badge-${sc(order.status)}">${order.status}</span>
    <span style="font-size:11px;color:var(--accent);margin-left:auto">Tap to manage →</span>
  </div>
  <div class="order-body">
    <div class="flow">
    ${steps.map((opName,idx)=>{
      const opRec=orderOps.find(o=>o.operations?.name===opName);
      const st=opRec?.status||'—';
      const cls=st==='Done'?'done':st==='In Progress'?'active':'pending';
      const prevDone=idx===0||orderOps.find(o=>o.operations?.name===steps[idx-1])?.status==='Done';
      return`${idx>0?`<div class="flow-line ${prevDone&&st!=='pending'?'done':''}"></div>`:''}
      <div class="flow-step">
        <div class="step-circle ${cls}" onclick="event.stopPropagation();showStepDetail(${order.id},'${opName}',${opRec?.id||0},${order.planned_qty})">${st==='Done'?'✓':idx+1}</div>
        <div class="step-label">${opName.replace('Adhesive ','Adh.').replace('Powder ','Pwd.')}</div>
        <div class="step-machine">${opRec?.machines?.code||'—'}</div>
        <div class="step-qty">${opRec?.completed_qty||''}</div>
      </div>`;
    }).join('')}
    </div>
  </div>
  </div>`;
}).join(''):`<div class="alert">No active production orders. Create a new order using the button above.</div>`}

<div class="section-title" style="margin-top:20px">Machine Status Board</div>
<div class="machine-grid">
${machines.map(m=>{
  const jobs=(opsByMachine[m.id]||[]).filter(j=>['Pending','In Progress'].includes(j.status));
  const isRunning=jobs.some(j=>j.status==='In Progress');
  return`<div class="mcard">
  <div class="mcard-head">
    <div><div class="mcard-name">${m.name}</div><div class="mcard-op">${m.operation} · ${m.capacity_value||0} ${m.capacity_uom||''}/cycle</div></div>
    <div class="mdot ${isRunning?'running':jobs.length?'busy':''}"></div>
  </div>
  <div class="mcard-body">
    ${jobs.length?jobs.map(j=>{
      const pct=j.production_orders?.planned_qty>0?Math.min(100,Math.round((j.completed_qty||0)/j.production_orders.planned_qty*100)):0;
      return`<div class="mjob ${j.status==='In Progress'?'running':'pending'}">
        <div class="mjob-top"><span class="mjob-order">${j.production_orders?.order_no||'—'}</span><span class="badge badge-${sc(j.status)}">${j.status}</span></div>
        <div class="mjob-detail">${j.production_orders?.items?.code||''} · ${j.operations?.name||''} · ${j.completed_qty||0}/${j.production_orders?.planned_qty||0} pcs</div>
        <div class="pbar"><div class="pfill" style="width:${pct}%"></div></div>
        <div class="mjob-btns">
          ${j.status==='Pending'?`<button class="btn btn-green btn-xs" onclick="quickUpdate(${j.id},'In Progress',${j.order_id})">▶ Start</button>`:''}
          ${j.status==='In Progress'?`<button class="btn btn-amber btn-xs" onclick="quickQtyUpdate(${j.id},${j.production_orders?.planned_qty||0},${j.order_id})">Update Qty</button><button class="btn btn-primary btn-xs" onclick="quickUpdate(${j.id},'Done',${j.order_id})">✓ Done</button>`:''}
        </div>
      </div>`;
    }).join(''):`<div class="mempty">No active jobs</div>`}
  </div>
  </div>`;
}).join('')}
</div>`;
}

async function showOrderDetail(orderId){
  const{data:order}=await db.from('production_orders').select('*,items(code,name)').eq('id',orderId).single();
  const{data:ops}=await db.from('production_order_operations').select('*,operations(name,seq),machines(name,code)').eq('order_id',orderId).order('id');
  const{data:machines}=await db.from('machines').select('*').eq('is_active',true).order('operation');
  const steps=order?.order_type==='MTS'?MTS_OPS:MTO_OPS;

  showModal(`<div class="mhead"><span class="mtitle">${order?.order_no} — Machine by Machine</span><button class="mclose" id="cm">×</button></div>
  <div class="mbody">
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      <span class="badge badge-${order?.order_type?.toLowerCase()}">${order?.order_type}</span>
      <span style="font-size:12px;color:var(--text2)">${order?.items?.code} — ${order?.items?.name}</span>
      <span style="font-size:12px;color:var(--text2)">Planned: <strong style="color:var(--text)">${order?.planned_qty} pcs</strong></span>
    </div>

    ${steps.map((opName,idx)=>{
      const opRec=ops?.find(o=>o.operations?.name===opName);
      const st=opRec?.status||'—';
      const cls=st==='Done'?'done':st==='In Progress'?'active':'';
      return`<div style="display:flex;align-items:center;gap:10px;background:var(--bg3);border-radius:8px;padding:10px 12px;margin-bottom:6px">
        <div style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;flex-shrink:0;background:${st==='Done'?'var(--green)':st==='In Progress'?'var(--amber)':'var(--bg2)'};border:1px solid ${st==='Done'?'var(--green)':st==='In Progress'?'var(--amber)':'var(--border)'};color:${st==='Done'||st==='In Progress'?'#fff':'var(--text3)'}">${st==='Done'?'✓':idx+1}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500">${opName}</div>
          <div style="font-size:11px;color:var(--text3)">${opRec?.machines?.name||'Not assigned'} ${opRec?.completed_qty?'· '+opRec.completed_qty+' done':''}</div>
        </div>
        <span class="badge badge-${sc(st)}">${st}</span>
        <div style="display:flex;gap:4px">
          ${!opRec?`<button class="btn btn-primary btn-xs" onclick="showAssignOp(${orderId},'${opName}',${order?.planned_qty||0})">Assign</button>`:''}
          ${opRec?.status==='Pending'?`<button class="btn btn-green btn-xs" onclick="quickUpdate(${opRec.id},'In Progress',${orderId});showOrderDetail(${orderId})">▶ Start</button>`:''}
          ${opRec?.status==='In Progress'?`<button class="btn btn-amber btn-xs" onclick="quickQtyUpdate(${opRec.id},${order?.planned_qty||0},${orderId})">Qty</button><button class="btn btn-primary btn-xs" onclick="quickUpdate(${opRec.id},'Done',${orderId});showOrderDetail(${orderId})">✓ Done</button>`:''}
        </div>
      </div>`;
    }).join('')}

    <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
      <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Quick Assign Operation to Machine</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <select class="finput" id="qa-op" style="flex:1;min-width:140px">
          <option value="">-- Operation --</option>${steps.map(o=>`<option value="${o}">${o}</option>`).join('')}
        </select>
        <select class="finput" id="qa-mach" style="flex:1;min-width:140px">
          <option value="">-- Machine --</option>${(machines||[]).map(m=>`<option value="${m.id}">${m.name} (${m.operation})</option>`).join('')}
        </select>
        <button class="btn btn-primary btn-sm" onclick="assignOp(${orderId},${order?.planned_qty||0})">Assign</button>
      </div>
      <div id="qa-err" class="err"></div>
    </div>
  </div>
  <div class="mfoot">
    <button class="btn btn-ghost btn-sm" id="cm2">Close</button>
    <button class="btn btn-amber btn-sm" onclick="showUpdateStatus(${orderId},'${order?.status}')">Update Order Status</button>
  </div>`);
  document.getElementById('cm').onclick=closeModal;
  document.getElementById('cm2').onclick=closeModal;
}

async function showStepDetail(orderId,opName,opId,maxQty){
  const{data:machines}=await db.from('machines').select('*').eq('is_active',true).order('operation');
  let opRec=null;
  if(opId){const{data}=await db.from('production_order_operations').select('*,operations(name),machines(name)').eq('id',opId).single();opRec=data;}
  showModal(`<div class="mhead"><span class="mtitle">${opName}</span><button class="mclose" id="cm">×</button></div>
  <div class="mbody">
    ${opRec?`<div style="margin-bottom:12px;font-size:13px;color:var(--text2)">Machine: <strong style="color:var(--text)">${opRec.machines?.name||'—'}</strong> · Status: <span class="badge badge-${sc(opRec.status)}">${opRec.status}</span></div>`:'<div style="margin-bottom:12px;font-size:13px;color:var(--text3)">Not assigned to any machine yet.</div>'}
    ${!opRec?`<div class="form-group"><label class="flabel">Assign Machine</label>
      <select class="finput" id="step-mach"><option value="">-- Select Machine --</option>${(machines||[]).map(m=>`<option value="${m.id}">${m.name} (${m.operation})</option>`).join('')}</select>
    </div>
    <div class="form-group"><label class="flabel">Planned Qty</label><input class="finput" id="step-qty" type="number" value="${maxQty}"/></div>`:''}
    ${opRec?.status==='In Progress'?`<div class="form-group"><label class="flabel">Completed Qty</label><input class="finput" id="done-qty" type="number" value="${opRec.completed_qty||0}" max="${maxQty}"/></div>
    <div class="form-group"><label class="flabel">Operator Name</label><input class="finput" id="opr-name" value="${opRec.operator_name||''}"/></div>`:''}
    <div id="step-err" class="err"></div>
  </div>
  <div class="mfoot">
    <button class="btn btn-ghost btn-sm" id="cm2">Cancel</button>
    ${!opRec?`<button class="btn btn-primary btn-sm" onclick="assignAndStart(${orderId},'${opName}',${maxQty})">Assign & Set Pending</button>`:''}
    ${opRec?.status==='Pending'?`<button class="btn btn-green btn-sm" onclick="quickUpdate(${opRec.id},'In Progress',${orderId});closeModal()">▶ Start Now</button>`:''}
    ${opRec?.status==='In Progress'?`<button class="btn btn-amber btn-sm" onclick="saveQty(${opRec.id},${orderId})">Save Qty</button><button class="btn btn-primary btn-sm" onclick="quickUpdate(${opRec.id},'Done',${orderId});closeModal()">✓ Mark Done</button>`:''}
  </div>`);
  document.getElementById('cm').onclick=()=>showOrderDetail(orderId);
  document.getElementById('cm2').onclick=()=>showOrderDetail(orderId);
}

async function assignOp(orderId,plannedQty){
  const opName=document.getElementById('qa-op')?.value;
  const machineId=document.getElementById('qa-mach')?.value;
  if(!opName||!machineId){const e=document.getElementById('qa-err');if(e)e.textContent='Select both operation and machine.';return;}
  const{data:opRec}=await db.from('operations').select('id').eq('name',opName).single();
  if(!opRec){const e=document.getElementById('qa-err');if(e)e.textContent='Operation not found in database.';return;}
  await db.from('production_order_operations').insert({order_id:orderId,operation_id:opRec.id,machine_id:machineId,planned_qty:plannedQty,status:'Pending'});
  showOrderDetail(orderId);
}

async function assignAndStart(orderId,opName,plannedQty){
  const machineId=document.getElementById('step-mach')?.value;
  const qty=parseFloat(document.getElementById('step-qty')?.value)||plannedQty;
  if(!machineId){const e=document.getElementById('step-err');if(e)e.textContent='Select a machine.';return;}
  const{data:opRec}=await db.from('operations').select('id').eq('name',opName).single();
  if(!opRec){return;}
  await db.from('production_order_operations').insert({order_id:orderId,operation_id:opRec.id,machine_id:machineId,planned_qty:qty,status:'Pending'});
  showOrderDetail(orderId);
}

async function saveQty(opId,orderId){
  const qty=parseFloat(document.getElementById('done-qty')?.value)||0;
  const opr=document.getElementById('opr-name')?.value||null;
  await db.from('production_order_operations').update({completed_qty:qty,operator_name:opr}).eq('id',opId);
  showOrderDetail(orderId);
}

async function quickUpdate(opId,newStatus,orderId){
  const upd={status:newStatus};
  if(newStatus==='In Progress')upd.actual_start=new Date().toISOString();
  if(newStatus==='Done')upd.actual_end=new Date().toISOString();
  await db.from('production_order_operations').update(upd).eq('id',opId);
  if(orderId)showOrderDetail(orderId);
  else loadTracker();
}

function quickQtyUpdate(opId,maxQty,orderId){
  showModal(`<div class="mhead"><span class="mtitle">Update Completed Qty</span><button class="mclose" id="cm">×</button></div>
  <div class="mbody">
    <div class="form-group"><label class="flabel">Completed Qty (max: ${maxQty})</label><input class="finput" id="uq-qty" type="number" value="0" max="${maxQty}"/></div>
    <div class="form-group"><label class="flabel">Operator Name</label><input class="finput" id="uq-opr" placeholder="Optional"/></div>
  </div>
  <div class="mfoot">
    <button class="btn btn-ghost btn-sm" id="cm2">Cancel</button>
    <button class="btn btn-green btn-sm" id="uq-save">Save</button>
  </div>`);
  document.getElementById('cm').onclick=closeModal;
  document.getElementById('cm2').onclick=closeModal;
  document.getElementById('uq-save').onclick=async()=>{
    const qty=parseFloat(document.getElementById('uq-qty').value)||0;
    const opr=document.getElementById('uq-opr').value;
    await db.from('production_order_operations').update({completed_qty:qty,operator_name:opr||null}).eq('id',opId);
    closeModal();
    loadTracker();
  };
}

async function showUpdateStatus(orderId,currentStatus){
  showModal(`<div class="mhead"><span class="mtitle">Update Order Status</span><button class="mclose" id="cm">×</button></div>
  <div class="mbody">
    <div class="form-group"><label class="flabel">New Status</label>
      <select class="finput" id="new-st">${['Draft','Planned','In Progress','Stacked','Packed','Completed','Cancelled'].map(s=>`<option value="${s}" ${s===currentStatus?'selected':''}>${s}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label class="flabel">Completed Qty</label><input class="finput" id="done-qty2" type="number" placeholder="0"/></div>
  </div>
  <div class="mfoot">
    <button class="btn btn-ghost btn-sm" id="cm2">Cancel</button>
    <button class="btn btn-green btn-sm" id="upd-st">Update</button>
  </div>`);
  document.getElementById('cm').onclick=closeModal;
  document.getElementById('cm2').onclick=closeModal;
  document.getElementById('upd-st').onclick=async()=>{
    const status=document.getElementById('new-st').value;
    const upd={status};
    const dq=parseFloat(document.getElementById('done-qty2').value);
    if(dq)upd.completed_qty=dq;
    if(status==='Completed')upd.completed_date=new Date().toISOString().split('T')[0];
    await db.from('production_orders').update(upd).eq('id',orderId);
    closeModal();loadTracker();
  };
}

async function showNewPO(){
  const{data:items}=await db.from('items').select('id,code,name,type').order('code');
  const now=new Date().toISOString().split('T')[0];
  showModal(`<div class="mhead"><span class="mtitle">New Production Order</span><button class="mclose" id="cm">×</button></div>
  <div class="mbody">
    <div class="frow">
      <div class="form-group"><label class="flabel">Order No</label><input class="finput" id="po-no" value="PO-${Date.now().toString().slice(-6)}"/></div>
      <div class="form-group"><label class="flabel">Type *</label>
        <select class="finput" id="po-type"><option value="MTS">MTS — Make to Stock</option><option value="MTO">MTO — Make to Order</option></select>
      </div>
    </div>
    <div class="form-group"><label class="flabel">Item to Produce *</label>
      <select class="finput" id="po-item"><option value="">-- Select --</option>${(items||[]).map(i=>`<option value="${i.id}">${i.code} — ${i.name} (${i.type})</option>`).join('')}</select>
    </div>
    <div class="frow">
      <div class="form-group"><label class="flabel">Planned Qty *</label><input class="finput" id="po-qty" type="number" value="100"/></div>
      <div class="form-group"><label class="flabel">Date *</label><input class="finput" id="po-date" type="date" value="${now}"/></div>
    </div>
    <div class="form-group"><label class="flabel">Customer Ref (MTO)</label><input class="finput" id="po-cref" placeholder="Customer PO No"/></div>
    <div id="po-err" class="err"></div>
  </div>
  <div class="mfoot">
    <button class="btn btn-ghost btn-sm" id="cm2">Cancel</button>
    <button class="btn btn-primary btn-sm" id="save-po">Create Order →</button>
  </div>`);
  document.getElementById('cm').onclick=closeModal;
  document.getElementById('cm2').onclick=closeModal;
  document.getElementById('save-po').onclick=async()=>{
    const item_id=document.getElementById('po-item').value;
    if(!item_id){document.getElementById('po-err').textContent='Select an item.';return;}
    const{data:newOrder,error}=await db.from('production_orders').insert({order_no:document.getElementById('po-no').value,order_type:document.getElementById('po-type').value,item_id,planned_qty:parseFloat(document.getElementById('po-qty').value)||0,planned_date:document.getElementById('po-date').value,customer_ref:document.getElementById('po-cref').value,status:'Planned'}).select().single();
    if(error){document.getElementById('po-err').textContent=error.message;return;}
    closeModal();await loadTracker();if(newOrder)showOrderDetail(newOrder.id);
  };
}

function showModal(html){
  document.getElementById('modal-area').innerHTML=`<div class="modal-overlay"><div class="modal">${html}</div></div>`;
}
function closeModal(){document.getElementById('modal-area').innerHTML='';loadTracker();}

document.getElementById('new-po-btn').addEventListener('click',showNewPO);
document.getElementById('refresh-btn').addEventListener('click',loadTracker);

// Auto refresh every 60 seconds
setInterval(()=>{if(!document.getElementById('modal-area').innerHTML)loadTracker();},60000);

loadTracker();
