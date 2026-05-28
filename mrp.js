
const SURL='https://hfufhcsvbrzygoykvtah.supabase.co';
const SKEY='sb_publishable_iqs1Q7TrS4j28CWqv3TUJQ_57WHtgB9';
const{createClient}=supabase;
const db=createClient(SURL,SKEY);

const OPS_MTS=['Mixing','Preforming','Shot Blasting','Adhesive Coating','Moulding','Grinding','Powder Coating','Oven Curing','Stacking'];
const OPS_MTO=[...OPS_MTS,'Printing','Orbital Riveting','Packing','Dispatch'];

document.getElementById('today').textContent=new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

function showTab(t){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.main-tab').forEach(b=>b.classList.remove('active'));
  document.getElementById(t).classList.add('active');
  event.target.classList.add('active');
  if(t==='mes')loadMES();
  if(t==='workorders')loadWO();
}

// ══════════════════════════════════════════
// MRP
// ══════════════════════════════════════════
async function initMRP(){
  const[soRes,itemRes]=await Promise.all([
    db.from('sales_orders').select('id,so_no,customers(name)').in('status',['Confirmed','Draft']).order('so_no'),
    db.from('items').select('id,code,name').in('type',['FG','SFG']).order('code')
  ]);
  const soEl=document.getElementById('mrp-so');
  soEl.innerHTML='<option value="">-- Select SO --</option>'+(soRes.data||[]).map(s=>`<option value="${s.id}">${s.so_no} — ${s.customers?.name||''}</option>`).join('');
  const itemEl=document.getElementById('mrp-item');
  itemEl.innerHTML='<option value="">-- Select Item --</option>'+(itemRes.data||[]).map(i=>`<option value="${i.id}">${i.code} — ${i.name}</option>`).join('');
}

function toggleMRPType(){
  const t=document.getElementById('mrp-type').value;
  document.getElementById('so-select').style.display=t==='Sales Order'?'block':'none';
  document.getElementById('manual-select').style.display=t==='Manual'?'block':'none';
  document.getElementById('manual-qty').style.display=t==='Manual'?'block':'none';
}

async function runMRP(){
  const type=document.getElementById('mrp-type').value;
  const resEl=document.getElementById('mrp-results');
  resEl.innerHTML='<div class="loader"><div class="spinner"></div> MRP calculate ho raha hai...</div>';

  let demandItems=[];

  if(type==='Sales Order'){
    const soId=document.getElementById('mrp-so').value;
    if(!soId){resEl.innerHTML='<div class="alert alert-warn">Sales order select karo.</div>';return;}
    const{data:lines}=await db.from('sales_order_lines').select('qty,uom,items(id,code,name,type)').eq('so_id',soId);
    demandItems=(lines||[]).map(l=>({itemId:l.items?.id,code:l.items?.code,name:l.items?.name,qty:l.qty,uom:l.uom}));
  } else if(type==='Reorder'){
    const{data:low}=await db.from('inventory').select('current_stock,item_id,items(id,code,name,type,reorder_level,reorder_qty)').filter('current_stock','lte',0);
    demandItems=(low||[]).filter(i=>i.items?.type==='FG'||i.items?.type==='SFG').map(i=>({itemId:i.items?.id,code:i.items?.code,name:i.items?.name,qty:i.items?.reorder_qty||100,uom:'PCS'}));
  } else {
    const itemId=document.getElementById('mrp-item').value;
    const qty=parseFloat(document.getElementById('mrp-qty').value)||100;
    if(!itemId){resEl.innerHTML='<div class="alert alert-warn">Item select karo.</div>';return;}
    const{data:item}=await db.from('items').select('id,code,name').eq('id',itemId).single();
    if(item) demandItems=[{itemId:item.id,code:item.code,name:item.name,qty,uom:'PCS'}];
  }

  if(!demandItems.length){resEl.innerHTML='<div class="alert alert-warn">Koi demand nahi mili.</div>';return;}

  // Explode BOM for each demand item
  let allRM={};
  let prodOrders=[];

  for(const demand of demandItems){
    prodOrders.push(demand);
    await explodeBOM(demand.itemId,demand.qty,allRM);
  }

  // Check stock
  const{data:inv}=await db.from('inventory').select('item_id,current_stock,uom,items(code)');
  const stockMap={};
  (inv||[]).forEach(i=>{if(i.items?.code)stockMap[i.items.code]=i.current_stock||0;});

  // Build results
  let shortageCount=0,okCount=0;
  let rows='';

  Object.entries(allRM).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([code,rm])=>{
    const stock=stockMap[code]||0;
    const needed=Math.ceil(rm.qty*100)/100;
    const gap=needed-stock;
    const status=gap<=0?'ok':stock>0?'warn':'short';
    if(status!=='ok') shortageCount++;else okCount++;
    rows+=`<tr>
      <td class="mono" style="font-size:12px">${code}</td>
      <td>${rm.name}</td>
      <td class="mono">${needed.toFixed(3)} ${rm.uom}</td>
      <td class="mono">${stock} ${rm.uom}</td>
      <td class="mono" style="color:${gap>0?'var(--red)':'var(--green)'}">${gap>0?'+'+gap.toFixed(3)+' NEEDED':'✓ OK'}</td>
      <td><span class="badge badge-${status==='ok'?'ok':status==='warn'?'warn':'short'}">${status==='ok'?'OK':status==='warn'?'Low':'Shortage'}</span></td>
      ${gap>0?`<td><button class="btn btn-xs btn-amber" onclick="createPO('${code}',${gap.toFixed(3)},'${rm.uom}')">Create PO</button></td>`:'<td>—</td>'}
    </tr>`;
  });

  // Production orders needed
  let poRows=prodOrders.map(p=>`<tr>
    <td class="mono" style="font-size:12px">${p.code}</td>
    <td>${p.name}</td>
    <td class="mono">${p.qty}</td>
    <td>${p.uom}</td>
    <td><button class="btn btn-xs btn-primary" onclick="createProdOrder('${p.itemId}',${p.qty})">Create Order</button></td>
  </tr>`).join('');

  document.getElementById('mrp-summary').innerHTML=`
    <div class="info-row"><span class="info-label">Items demanded</span><span class="info-val">${demandItems.length}</span></div>
    <div class="info-row"><span class="info-label">RM types needed</span><span class="info-val">${Object.keys(allRM).length}</span></div>
    <div class="info-row"><span class="info-label">RM OK</span><span class="info-val" style="color:var(--green)">${okCount}</span></div>
    <div class="info-row"><span class="info-label">RM Shortage</span><span class="info-val" style="color:var(--red)">${shortageCount}</span></div>`;

  resEl.innerHTML=`
  ${shortageCount>0?`<div class="alert alert-warn">⚠ ${shortageCount} materials ki shortage hai — Purchase Orders banao</div>`:'<div class="alert alert-success">✓ Sab RM available hai — production shuru kar sakte ho!</div>'}
  <div class="table-wrap">
    <div class="table-head"><span class="table-title">RM Requirements</span><span style="font-size:12px;color:var(--text3)">${Object.keys(allRM).length} materials</span></div>
    <div style="overflow-x:auto"><table>
      <thead><tr><th>Code</th><th>Material</th><th>Required</th><th>In Stock</th><th>Gap</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>${rows||'<tr class="empty"><td colspan="7">BOM nahi mila — pehle BOM add karo</td></tr>'}</tbody>
    </table></div>
  </div>
  ${prodOrders.length?`<div class="table-wrap">
    <div class="table-head"><span class="table-title">Production Orders to Create</span></div>
    <table><thead><tr><th>Item Code</th><th>Item Name</th><th>Qty</th><th>UOM</th><th>Action</th></tr></thead>
    <tbody>${poRows}</tbody></table>
  </div>`:''}`;
}

async function explodeBOM(itemId,qty,result){
  if(!itemId) return;
  const{data:bom}=await db.from('bom_headers').select('id,output_qty').eq('item_id',itemId).eq('is_active',true).order('version',{ascending:false}).limit(1).single();
  if(!bom) return;
  const{data:lines}=await db.from('bom_lines').select('qty,uom,items(id,code,name,type)').eq('bom_id',bom.id);
  if(!lines) return;
  const mult=qty/bom.output_qty;
  for(const l of lines){
    const code=l.items?.code;
    if(!code) continue;
    if(l.items?.type==='RM'){
      if(!result[code]) result[code]={name:l.items.name,qty:0,uom:l.uom,itemId:l.items.id};
      result[code].qty+=l.qty*mult;
    } else {
      // SFG — recurse
      await explodeBOM(l.items?.id,l.qty*mult,result);
    }
  }
}

async function createPO(itemCode,qty,uom){
  const{data:item}=await db.from('items').select('id,name').eq('code',itemCode).single();
  const{data:suppliers}=await db.from('suppliers').select('id,name').eq('is_active',true).limit(5);
  showModal(`<div class="mhead"><span class="mtitle">Create Purchase Order — ${itemCode}</span><button class="mclose" onclick="closeModal()">×</button></div>
  <div class="mbody">
    <div class="info-row"><span class="info-label">Item</span><span class="info-val">${item?.name||itemCode}</span></div>
    <div class="info-row"><span class="info-label">Qty Needed</span><span class="info-val mono">${qty} ${uom}</span></div>
    <div class="divider"></div>
    <div class="form-group"><label class="flabel">Supplier *</label>
      <select class="finput" id="po-sup"><option value="">-- Select --</option>${(suppliers||[]).map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}</select>
    </div>
    <div class="frow">
      <div class="form-group"><label class="flabel">Order Qty</label><input class="finput" id="po-qty" type="number" value="${Math.ceil(qty)}"/></div>
      <div class="form-group"><label class="flabel">Unit Price (₹)</label><input class="finput" id="po-price" type="number" value="0"/></div>
    </div>
    <div class="form-group"><label class="flabel">Expected Date</label><input class="finput" id="po-date" type="date" value="${new Date(Date.now()+2*86400000).toISOString().split('T')[0]}"/></div>
    <div id="po-err" style="color:var(--red);font-size:12px;margin-top:8px"></div>
  </div>
  <div class="mfoot"><button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button><button class="btn btn-primary btn-sm" onclick="savePO('${item?.id}','${itemCode}','${uom}')">Create PO</button></div>`);
}

async function savePO(itemId,itemCode,uom){
  const supId=document.getElementById('po-sup').value;
  if(!supId){document.getElementById('po-err').textContent='Supplier select karo.';return;}
  const qty=parseFloat(document.getElementById('po-qty').value)||0;
  const price=parseFloat(document.getElementById('po-price').value)||0;
  const expDate=document.getElementById('po-date').value;
  const poNo='PO-'+Date.now().toString().slice(-6);
  const{data:po,error}=await db.from('purchase_orders').insert({po_no:poNo,supplier_id:supId,order_date:new Date().toISOString().split('T')[0],expected_date:expDate,status:'Ordered',total_amount:qty*price*(1.18)}).select().single();
  if(error){document.getElementById('po-err').textContent=error.message;return;}
  await db.from('purchase_order_lines').insert({po_id:po.id,item_id:itemId,qty,uom,unit_price:price,gst_percent:18});
  closeModal();showToast(`✓ PO ${poNo} created for ${itemCode}`);
}

async function createProdOrder(itemId,qty){
  const{data:item}=await db.from('items').select('id,code,name').eq('id',itemId).single();
  const now=new Date().toISOString().split('T')[0];
  const{data:newOrder,error}=await db.from('production_orders').insert({
    order_no:'MFG-'+Date.now().toString().slice(-6),
    order_type:'MTO',item_id:itemId,
    planned_qty:qty,planned_date:now,status:'Planned',
    notes:'Auto-created from MRP'
  }).select().single();
  if(error){showToast('Error: '+error.message);return;}
  showToast(`✓ Production order created for ${item?.code}`);
  document.getElementById('mrp-results').innerHTML+='<div class="alert alert-success">✓ Production order created! Work Orders tab mein dekho.</div>';
}

// ══════════════════════════════════════════
// MES DASHBOARD
// ══════════════════════════════════════════
async function loadMES(){
  const[machRes,opsRes]=await Promise.all([
    db.from('machines').select('*').eq('is_active',true).order('operation'),
    db.from('production_order_operations').select('*,production_orders(id,order_no,order_type,status,planned_qty,items(code,name)),operations(name,seq),machines(name,code)').in('status',['Pending','In Progress']).order('id')
  ]);
  const machines=machRes.data||[];
  const ops=opsRes.data||[];
  const running=ops.filter(o=>o.status==='In Progress').length;
  const pending=ops.filter(o=>o.status==='Pending').length;

  const opsByMachine={};
  ops.forEach(op=>{if(!opsByMachine[op.machine_id])opsByMachine[op.machine_id]=[];opsByMachine[op.machine_id].push(op);});

  document.getElementById('mes-stats').innerHTML=`
    <div class="stat green"><div class="stat-label">Running Now</div><div class="stat-val">${running}</div><div class="stat-sub">Operations active</div></div>
    <div class="stat amber"><div class="stat-label">Pending</div><div class="stat-val">${pending}</div><div class="stat-sub">Waiting to start</div></div>
    <div class="stat blue"><div class="stat-label">Machines Active</div><div class="stat-val">${machines.filter(m=>opsByMachine[m.id]?.some(o=>o.status==='In Progress')).length}</div><div class="stat-sub">Of ${machines.length} total</div></div>
    <div class="stat"><div class="stat-label">Total Machines</div><div class="stat-val">${machines.length}</div><div class="stat-sub">In master</div></div>`;

  document.getElementById('mes-board').innerHTML=`<div class="machine-grid">${machines.map(m=>{
    const jobs=(opsByMachine[m.id]||[]);
    const isRunning=jobs.some(j=>j.status==='In Progress');
    const hasPending=jobs.some(j=>j.status==='Pending');
    const dotClass=isRunning?'running':hasPending?'waiting':'idle';
    return`<div class="mcard">
    <div class="mcard-head">
      <div class="mcard-left">
        <div class="mcard-name">${m.name}</div>
        <div class="mcard-op">${m.operation} · ${m.capacity_value||0} ${m.capacity_uom||''}</div>
      </div>
      <div class="mdot ${dotClass}"></div>
    </div>
    <div class="mcard-body">
      ${jobs.length?jobs.map(j=>{
        const pct=j.production_orders?.planned_qty>0?Math.min(100,Math.round((j.completed_qty||0)/j.production_orders.planned_qty*100)):0;
        const fillClass=j.status==='In Progress'?'':'amber';
        return`<div class="wjob ${j.status==='In Progress'?'running':'pending'}">
          <div class="wjob-top">
            <span class="wjob-no">${j.production_orders?.order_no||'—'}</span>
            <span class="badge badge-${j.status==='In Progress'?'ok':'warn'}">${j.status}</span>
          </div>
          <div class="wjob-item">${j.production_orders?.items?.code||''} · ${j.operations?.name||''}</div>
          <div class="wjob-progress"><span>${j.completed_qty||0} / ${j.production_orders?.planned_qty||0} pcs</span><span>${pct}%</span></div>
          <div class="pbar"><div class="pfill ${fillClass}" style="width:${pct}%"></div></div>
          <div class="wjob-btns">
            ${j.status==='Pending'?`<button class="btn btn-xs btn-green" onclick="updateOp(${j.id},'In Progress')">▶ Start</button>`:''}
            ${j.status==='In Progress'?`<button class="btn btn-xs btn-amber" onclick="showUpdateQty(${j.id},${j.production_orders?.planned_qty||0},${j.production_orders?.id||0})">Update Qty</button>
            <button class="btn btn-xs btn-primary" onclick="updateOp(${j.id},'Done')">✓ Done</button>`:''}
          </div>
        </div>`;
      }).join(''):`<div class="mcard-empty">No active jobs<br><span style="font-size:10px">Idle</span></div>`}
    </div>
    </div>`;
  }).join('')}</div>`;
  setTimeout(()=>loadMES(),60000);
}

async function updateOp(opId,status){
  const upd={status};
  if(status==='In Progress')upd.actual_start=new Date().toISOString();
  if(status==='Done'){upd.actual_end=new Date().toISOString();}
  await db.from('production_order_operations').update(upd).eq('id',opId);
  showToast(status==='In Progress'?'▶ Operation started!':'✓ Operation marked done!');
  loadMES();
}

function showUpdateQty(opId,maxQty,orderId){
  showModal(`<div class="mhead"><span class="mtitle">Update Completed Qty</span><button class="mclose" onclick="closeModal()">×</button></div>
  <div class="mbody">
    <div class="form-group"><label class="flabel">Completed Qty (max: ${maxQty})</label><input class="finput" id="uq-qty" type="number" value="0" max="${maxQty}"/></div>
    <div class="form-group"><label class="flabel">Rejection Qty</label><input class="finput" id="uq-rej" type="number" value="0"/></div>
    <div class="form-group"><label class="flabel">Rejection Reason</label>
      <select class="finput" id="uq-reason">
        <option value="">-- Select --</option>
        <option value="Dimensional">Dimensional</option>
        <option value="Surface Defect">Surface Defect</option>
        <option value="Crack">Crack</option>
        <option value="Weight Issue">Weight Issue</option>
        <option value="Other">Other</option>
      </select>
    </div>
    <div class="form-group"><label class="flabel">Operator Name</label><input class="finput" id="uq-opr" placeholder="Optional"/></div>
  </div>
  <div class="mfoot"><button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button><button class="btn btn-green btn-sm" onclick="saveQtyUpdate(${opId},${maxQty},${orderId})">Save</button></div>`);
}

async function saveQtyUpdate(opId,maxQty,orderId){
  const qty=parseFloat(document.getElementById('uq-qty').value)||0;
  const rej=parseFloat(document.getElementById('uq-rej').value)||0;
  const reason=document.getElementById('uq-reason').value;
  const opr=document.getElementById('uq-opr').value;
  await db.from('production_order_operations').update({completed_qty:qty,rejection_qty:rej,rejection_reason:reason||null,operator_name:opr||null,last_updated:new Date().toISOString()}).eq('id',opId);
  if(orderId){await db.from('production_orders').update({completed_qty:qty}).eq('id',orderId);}
  closeModal();showToast(`✓ ${qty} pcs updated${rej>0?`, ${rej} rejected`:''}`);loadMES();
}

// ══════════════════════════════════════════
// WORK ORDERS
// ══════════════════════════════════════════
async function loadWO(){
  const{data:orders}=await db.from('production_orders').select('*,items(code,name)').in('status',['Planned','In Progress','Stacked']).order('created_at',{ascending:false});
  const el=document.getElementById('wo-list');
  if(!orders?.length){el.innerHTML='<div class="alert alert-info">Koi active work order nahi. + New Production Order banao.</div>';return;}

  const{data:allOps}=await db.from('production_order_operations').select('*,operations(name,seq),machines(name,code)').in('order_id',orders.map(o=>o.id)).order('id');
  const opsByOrder={};
  (allOps||[]).forEach(op=>{if(!opsByOrder[op.order_id])opsByOrder[op.order_id]=[];opsByOrder[op.order_id].push(op);});

  el.innerHTML=orders.map(order=>{
    const ops=opsByOrder[order.id]||[];
    const steps=order.order_type==='MTS'?OPS_MTS:OPS_MTO;
    const doneCount=ops.filter(o=>o.status==='Done').length;
    const totalOps=steps.length;
    const pct=Math.round(doneCount/totalOps*100);
    return`<div class="table-wrap" style="margin-bottom:14px">
    <div class="table-head" style="cursor:pointer" onclick="toggleWODetail(${order.id})">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span class="mono" style="font-weight:600;font-size:13px">${order.order_no}</span>
        <span class="badge badge-${order.order_type==='MTS'?'mts':'mto'}">${order.order_type}</span>
        <span style="font-size:12px;color:var(--text3)">${order.items?.code} — ${order.items?.name}</span>
        <span style="font-size:12px;color:var(--text2)">Qty: ${order.planned_qty}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:80px;height:5px;background:var(--border);border-radius:3px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:var(--green);border-radius:3px"></div>
          </div>
          <span style="font-size:11px;color:var(--text3)">${pct}%</span>
        </div>
        <span style="font-size:11px;color:var(--accent)">Tap to expand ↓</span>
      </div>
    </div>
    <div id="wo-detail-${order.id}" style="display:none;padding:14px 16px">
      <div style="overflow-x:auto;margin-bottom:14px">
        <div class="wo-flow">
        ${steps.map((opName,idx)=>{
          const opRec=ops.find(o=>o.operations?.name===opName);
          const st=opRec?.status||'—';
          const cls=st==='Done'?'done':st==='In Progress'?'active':'pending';
          const prevDone=idx===0||ops.find(o=>o.operations?.name===steps[idx-1])?.status==='Done';
          return`${idx>0?`<div class="wo-line ${prevDone&&st!=='—'?'done':''}"></div>`:''}
          <div class="wo-step">
            <div class="wo-circle ${cls}" onclick="showStepAction(${order.id},'${opName}',${opRec?.id||0},${order.planned_qty})">${st==='Done'?'✓':idx+1}</div>
            <div class="wo-label">${opName.replace('Adhesive','Adh').replace('Powder','Pwd')}</div>
            <div class="wo-qty">${opRec?.completed_qty||''}</div>
          </div>`;
        }).join('')}
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr>
          <th style="padding:6px 10px;text-align:left;color:var(--text3);border-bottom:1px solid var(--border)">Operation</th>
          <th style="padding:6px 10px;text-align:left;color:var(--text3);border-bottom:1px solid var(--border)">Machine</th>
          <th style="padding:6px 10px;text-align:left;color:var(--text3);border-bottom:1px solid var(--border)">Done Qty</th>
          <th style="padding:6px 10px;text-align:left;color:var(--text3);border-bottom:1px solid var(--border)">Rejected</th>
          <th style="padding:6px 10px;text-align:left;color:var(--text3);border-bottom:1px solid var(--border)">Status</th>
          <th style="padding:6px 10px;text-align:left;color:var(--text3);border-bottom:1px solid var(--border)">Action</th>
        </tr></thead>
        <tbody>
        ${steps.map(opName=>{
          const opRec=ops.find(o=>o.operations?.name===opName);
          const st=opRec?.status||'Not assigned';
          return`<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:7px 10px;color:var(--text)">${opName}</td>
            <td style="padding:7px 10px;color:var(--text3)">${opRec?.machines?.name||'—'}</td>
            <td style="padding:7px 10px;font-family:DM Mono,monospace">${opRec?.completed_qty||0}</td>
            <td style="padding:7px 10px;font-family:DM Mono,monospace;color:var(--red)">${opRec?.rejection_qty||0}</td>
            <td style="padding:7px 10px"><span class="badge badge-${st==='Done'?'ok':st==='In Progress'?'warn':st==='Pending'?'info':'short'}">${st}</span></td>
            <td style="padding:7px 10px">
              ${!opRec?`<button class="btn btn-xs btn-primary" onclick="showAssignOp(${order.id},'${opName}',${order.planned_qty})">Assign</button>`:''}
              ${opRec?.status==='Pending'?`<button class="btn btn-xs btn-green" onclick="updateOp(${opRec.id},'In Progress');setTimeout(loadWO,1000)">▶ Start</button>`:''}
              ${opRec?.status==='In Progress'?`<button class="btn btn-xs btn-amber" onclick="showUpdateQty(${opRec.id},${order.planned_qty},${order.id})">Update</button>
              <button class="btn btn-xs btn-primary" onclick="updateOp(${opRec.id},'Done');setTimeout(loadWO,1000)">✓ Done</button>`:''}
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>
    </div>`;
  }).join('');
}

function toggleWODetail(id){
  const el=document.getElementById(`wo-detail-${id}`);
  el.style.display=el.style.display==='none'?'block':'none';
}

async function showAssignOp(orderId,opName,qty){
  const{data:machines}=await db.from('machines').select('*').eq('is_active',true).order('operation');
  showModal(`<div class="mhead"><span class="mtitle">Assign — ${opName}</span><button class="mclose" onclick="closeModal()">×</button></div>
  <div class="mbody">
    <div class="form-group"><label class="flabel">Machine *</label>
      <select class="finput" id="as-mach"><option value="">-- Select --</option>${(machines||[]).map(m=>`<option value="${m.id}">${m.name} (${m.operation})</option>`).join('')}</select>
    </div>
    <div class="form-group"><label class="flabel">Planned Qty</label><input class="finput" id="as-qty" type="number" value="${qty}"/></div>
    <div id="as-err" style="color:var(--red);font-size:12px;margin-top:8px"></div>
  </div>
  <div class="mfoot"><button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button><button class="btn btn-primary btn-sm" onclick="assignOp(${orderId},'${opName}')">Assign & Set Pending</button></div>`);
}

async function assignOp(orderId,opName){
  const machineId=document.getElementById('as-mach').value;
  const qty=parseFloat(document.getElementById('as-qty').value)||0;
  if(!machineId){document.getElementById('as-err').textContent='Machine select karo.';return;}
  const{data:opRec}=await db.from('operations').select('id').eq('name',opName).single();
  if(!opRec){document.getElementById('as-err').textContent='Operation not found.';return;}
  await db.from('production_order_operations').insert({order_id:orderId,operation_id:opRec.id,machine_id:machineId,planned_qty:qty,status:'Pending'});
  closeModal();showToast('✓ Operation assigned!');loadWO();
}

async function showNewPOModal(){
  const{data:items}=await db.from('items').select('id,code,name,type').in('type',['SFG','FG']).order('code');
  const now=new Date().toISOString().split('T')[0];
  showModal(`<div class="mhead"><span class="mtitle">New Production Order</span><button class="mclose" onclick="closeModal()">×</button></div>
  <div class="mbody">
    <div class="frow">
      <div class="form-group"><label class="flabel">Order No</label><input class="finput" id="po2-no" value="MFG-${Date.now().toString().slice(-6)}"/></div>
      <div class="form-group"><label class="flabel">Type</label>
        <select class="finput" id="po2-type"><option value="MTS">MTS</option><option value="MTO">MTO</option></select>
      </div>
    </div>
    <div class="form-group"><label class="flabel">Item *</label>
      <select class="finput" id="po2-item"><option value="">-- Select --</option>${(items||[]).map(i=>`<option value="${i.id}">${i.code} — ${i.name}</option>`).join('')}</select>
    </div>
    <div class="frow">
      <div class="form-group"><label class="flabel">Planned Qty</label><input class="finput" id="po2-qty" type="number" value="100"/></div>
      <div class="form-group"><label class="flabel">Date</label><input class="finput" id="po2-date" type="date" value="${now}"/></div>
    </div>
    <div class="form-group"><label class="flabel">Customer Ref (MTO)</label><input class="finput" id="po2-cref" placeholder="SO Number"/></div>
    <div id="po2-err" style="color:var(--red);font-size:12px;margin-top:8px"></div>
  </div>
  <div class="mfoot"><button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button><button class="btn btn-primary btn-sm" onclick="saveNewPO()">Create Order</button></div>`);
}

async function saveNewPO(){
  const itemId=document.getElementById('po2-item').value;
  if(!itemId){document.getElementById('po2-err').textContent='Item select karo.';return;}
  const{error}=await db.from('production_orders').insert({
    order_no:document.getElementById('po2-no').value,
    order_type:document.getElementById('po2-type').value,
    item_id:itemId,planned_qty:parseFloat(document.getElementById('po2-qty').value)||0,
    planned_date:document.getElementById('po2-date').value,
    customer_ref:document.getElementById('po2-cref').value,
    status:'Planned',notes:'Created from MES'
  });
  if(error){document.getElementById('po2-err').textContent=error.message;return;}
  closeModal();showToast('✓ Production order created!');loadWO();
}

async function showNewWOModal(){
  const{data:orders}=await db.from('production_orders').select('id,order_no,items(code)').in('status',['Planned','In Progress']).order('order_no');
  const{data:machines}=await db.from('machines').select('*').eq('is_active',true).order('operation');
  showModal(`<div class="mhead"><span class="mtitle">Assign Work Order to Machine</span><button class="mclose" onclick="closeModal()">×</button></div>
  <div class="mbody">
    <div class="form-group"><label class="flabel">Production Order *</label>
      <select class="finput" id="nw-order"><option value="">-- Select --</option>${(orders||[]).map(o=>`<option value="${o.id}">${o.order_no} — ${o.items?.code||''}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label class="flabel">Operation *</label>
      <select class="finput" id="nw-op"><option value="">-- Select --</option>${[...OPS_MTO].map(o=>`<option value="${o}">${o}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label class="flabel">Machine *</label>
      <select class="finput" id="nw-mach"><option value="">-- Select --</option>${(machines||[]).map(m=>`<option value="${m.id}">${m.name} (${m.operation})</option>`).join('')}</select>
    </div>
    <div class="form-group"><label class="flabel">Planned Qty</label><input class="finput" id="nw-qty" type="number" value="100"/></div>
    <div id="nw-err" style="color:var(--red);font-size:12px;margin-top:8px"></div>
  </div>
  <div class="mfoot"><button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button><button class="btn btn-primary btn-sm" onclick="saveNewWO()">Assign</button></div>`);
}

async function saveNewWO(){
  const orderId=document.getElementById('nw-order').value;
  const opName=document.getElementById('nw-op').value;
  const machineId=document.getElementById('nw-mach').value;
  const qty=parseFloat(document.getElementById('nw-qty').value)||0;
  if(!orderId||!opName||!machineId){document.getElementById('nw-err').textContent='Sab fields fill karo.';return;}
  const{data:opRec}=await db.from('operations').select('id').eq('name',opName).single();
  if(!opRec){document.getElementById('nw-err').textContent='Operation not found.';return;}
  const{error}=await db.from('production_order_operations').insert({order_id:orderId,operation_id:opRec.id,machine_id:machineId,planned_qty:qty,status:'Pending'});
  if(error){document.getElementById('nw-err').textContent=error.message;return;}
  closeModal();showToast('✓ Work order assigned!');loadMES();
}

function showModal(html){document.getElementById('modal-area').innerHTML=`<div class="modal-overlay"><div class="modal">${html}</div></div>`;}
function closeModal(){document.getElementById('modal-area').innerHTML='';}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.style.display='block';setTimeout(()=>t.style.display='none',3000);}

// Init
initMRP();
