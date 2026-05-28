
const SURL='https://hfufhcsvbrzygoykvtah.supabase.co';
const SKEY='sb_publishable_iqs1Q7TrS4j28CWqv3TUJQ_57WHtgB9';
const{createClient}=supabase;
const db=createClient(SURL,SKEY);
const today=new Date().toISOString().split('T')[0];

// Clock
setInterval(()=>{
  document.getElementById('clock').textContent=new Date().toLocaleString('en-IN',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:true});
},1000);

function showTab(t){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  document.getElementById(t).classList.add('active');
  event.target.classList.add('active');
  if(t==='overview')loadOverview();
  if(t==='machines')loadMachines();
  if(t==='labour')loadLabour();
  if(t==='targets')loadTargets();
  if(t==='stock')loadStock();
  if(t==='aging')loadAging();
  if(t==='pl')loadPL();
}

async function loadAll(){
  loadOverview();
}

// ═══ OVERVIEW ═══
async function loadOverview(){
  const[
    {data:ops},{data:machines},{data:inv},{data:sos},
    {data:orders},{data:workers},{data:targets},{data:halts}
  ]=await Promise.all([
    db.from('production_order_operations').select('status').in('status',['In Progress','Pending']),
    db.from('machines').select('*').eq('is_active',true),
    db.from('inventory').select('current_stock,items(code,name,type,reorder_level)'),
    db.from('sales_orders').select('total_amount,status').in('status',['Confirmed','Dispatched']),
    db.from('production_orders').select('status,planned_qty,completed_qty').in('status',['Planned','In Progress']),
    db.from('workers').select('id').eq('is_active',true),
    db.from('daily_targets').select('target_qty,actual_qty').eq('target_date',today),
    db.from('machine_halts').select('machine_id').is('halt_end',null)
  ]);

  const running=(ops||[]).filter(o=>o.status==='In Progress').length;
  const lowStock=(inv||[]).filter(i=>i.current_stock<=(i.items?.reorder_level||0)&&i.items?.type==='RM').length;
  const criticalStock=(inv||[]).filter(i=>i.current_stock<=0&&i.items?.type==='RM').length;
  const totalTarget=(targets||[]).reduce((s,t)=>s+(t.target_qty||0),0);
  const totalActual=(targets||[]).reduce((s,t)=>s+(t.actual_qty||0),0);
  const haltedMachines=(halts||[]).length;
  const pendingSO=(sos||[]).filter(s=>s.status==='Confirmed').length;

  document.getElementById('overview-stats').innerHTML=`
    <div class="stat ${running>0?'green':'amber'}">
      <div class="stat-label">Operations Running</div>
      <div class="stat-val">${running}</div>
      <div class="stat-sub">Active right now</div>
    </div>
    <div class="stat ${haltedMachines>0?'red':'green'}">
      <div class="stat-label">Machines Halted</div>
      <div class="stat-val">${haltedMachines}</div>
      <div class="stat-sub">${machines?.length||0} total machines</div>
    </div>
    <div class="stat ${criticalStock>0?'red':lowStock>0?'amber':'green'}">
      <div class="stat-label">Stock Alerts</div>
      <div class="stat-val">${lowStock}</div>
      <div class="stat-sub">${criticalStock} critical (zero stock)</div>
    </div>
    <div class="stat blue">
      <div class="stat-label">Today Target</div>
      <div class="stat-val">${totalTarget||500}</div>
      <div class="stat-sub">${totalActual} done so far</div>
    </div>
    <div class="stat ${pendingSO>0?'amber':'green'}">
      <div class="stat-label">Pending Orders</div>
      <div class="stat-val">${pendingSO}</div>
      <div class="stat-sub">Sales orders to dispatch</div>
    </div>
    <div class="stat purple">
      <div class="stat-label">Workers Active</div>
      <div class="stat-val">${workers?.length||0}</div>
      <div class="stat-sub">Of 15 total</div>
    </div>`;

  // Machine quick view
  const{data:machOps}=await db.from('production_order_operations').select('machine_id,status,production_orders(items(code))').eq('status','In Progress');
  const opByMachine={};
  (machOps||[]).forEach(o=>{opByMachine[o.machine_id]=o;});
  const haltedIds=new Set((halts||[]).map(h=>h.machine_id));

  document.getElementById('overview-machines').innerHTML=`
    <div class="card">
      <div class="card-title">Machine Status <span>${(machines||[]).filter(m=>opByMachine[m.id]).length} running</span></div>
      ${(machines||[]).slice(0,8).map(m=>{
        const op=opByMachine[m.id];
        const isHalted=haltedIds.has(m.id);
        const isBottle=m.operation==='Moulding';
        const status=isHalted?'halted':op?'running':isBottle?'bottleneck':'idle';
        return`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
          <div class="mdot ${status}"></div>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:500">${m.name}</div>
            <div style="font-size:11px;color:var(--text3)">${op?op.production_orders?.items?.code||'Running':isHalted?'⚠ HALTED':m.operation}</div>
          </div>
          <span class="badge badge-${status==='running'?'ok':status==='halted'?'red':status==='bottleneck'?'warn':'info'}" style="font-size:10px">${status==='running'?'ON':status==='halted'?'HALT':status==='bottleneck'?'BTLNK':'IDLE'}</span>
        </div>`;
      }).join('')}
    </div>`;

  // Stock alerts
  const lowItems=(inv||[]).filter(i=>{
    const rl=i.items?.reorder_level||0;
    const stock=i.current_stock||0;
    return(i.items?.type==='RM'||i.items?.type==='SFG')&&stock<=(rl*1.2);
  }).slice(0,8);

  document.getElementById('overview-alerts').innerHTML=`
    <div class="card">
      <div class="card-title">Stock Alerts <span>${lowItems.length} items</span></div>
      ${lowItems.length?lowItems.map(i=>{
        const rl=i.items?.reorder_level||0;
        const stock=i.current_stock||0;
        const pct=rl>0?Math.round(stock/rl*100):100;
        const cls=stock<=0?'red':pct<=50?'red':'amber';
        return`<div class="alert-row ${cls}">
          <span class="alert-icon">${stock<=0?'🔴':pct<=50?'🟠':'🟡'}</span>
          <div class="alert-text">
            <div style="font-weight:500;font-size:12px">${i.items?.code} — ${i.items?.name}</div>
            <div style="font-size:11px;color:var(--text3)">Reorder: ${rl} | Stock: ${stock}</div>
          </div>
          <span class="alert-val" style="color:${cls==='red'?'var(--red)':'var(--amber)'}">${pct}%</span>
        </div>`;
      }).join(''):'<div style="color:var(--green);font-size:13px;padding:8px 0">✓ Sab stock OK hai!</div>'}
    </div>`;

  // Daily targets
  const{data:prodOps}=await db.from('production_order_operations').select('completed_qty,planned_qty,production_orders(items(code,name))').eq('status','In Progress');
  document.getElementById('overview-targets').innerHTML=`
    <div class="card">
      <div class="card-title">Today's Production Progress</div>
      ${(prodOps||[]).length?(prodOps||[]).map(op=>{
        const pct=op.planned_qty>0?Math.min(100,Math.round((op.completed_qty||0)/op.planned_qty*100)):0;
        return`<div class="target-row">
          <div class="target-sku">${op.production_orders?.items?.code||'—'}</div>
          <div class="target-bar"><div class="target-fill ${pct>=80?'green':pct>=40?'amber':'red'}" style="width:${pct}%"></div></div>
          <div class="target-nums">${op.completed_qty||0}/${op.planned_qty} pcs</div>
          <span class="badge badge-${pct>=80?'ok':pct>=40?'warn':'red'}">${pct}%</span>
        </div>`;
      }).join(''):'<div style="color:var(--text3);font-size:13px;padding:8px 0">Koi active production nahi. MES Dashboard mein assign karo.</div>'}
    </div>`;
}

// ═══ MACHINES ═══
async function loadMachines(){
  const[{data:machines},{data:ops},{data:halts}]=await Promise.all([
    db.from('machines').select('*').eq('is_active',true).order('operation'),
    db.from('production_order_operations').select('*,production_orders(order_no,planned_qty,items(code,name)),operations(name)').eq('status','In Progress'),
    db.from('machine_halts').select('*,machines(name)').is('halt_end',null)
  ]);

  const opByMachine={};
  (ops||[]).forEach(o=>{opByMachine[o.machine_id]=o;});
  const haltedIds=new Set((halts||[]).map(h=>h.machine_id));

  document.getElementById('machines-board').innerHTML=`<div class="machine-grid">
  ${(machines||[]).map(m=>{
    const op=opByMachine[m.id];
    const isHalted=haltedIds.has(m.id);
    const isBottle=m.operation==='Moulding';
    const pct=op&&op.production_orders?.planned_qty>0?Math.min(100,Math.round((op.completed_qty||0)/op.production_orders.planned_qty*100)):0;
    const status=isHalted?'halted':op?'running':isBottle?'bottleneck':'idle';
    return`<div class="mcard ${status}">
      <div class="mcard-top">
        <div>
          <div class="mcard-name">${m.name}</div>
          <div class="mcard-op">${m.operation}${isBottle?' ⚠ BOTTLENECK':''}</div>
        </div>
        <div class="mdot ${status}"></div>
      </div>
      ${op?`<div class="mcard-sku">${op.production_orders?.items?.code||'—'} — ${op.operations?.name||''}</div>
      <div class="pbar"><div class="pfill ${pct>=80?'green':pct>=40?'amber':'red'}" style="width:${pct}%"></div></div>
      <div class="mcard-pct">${op.completed_qty||0}/${op.production_orders?.planned_qty||0} pcs · ${pct}%</div>`
      :isHalted?`<div style="color:var(--red);font-size:12px;margin-top:4px">⚠ Machine Halted</div>`
      :`<div class="mcard-sku" style="color:var(--text3)">Idle</div>`}
    </div>`;
  }).join('')}</div>`;

  // Halt history
  const{data:haltHist}=await db.from('machine_halts').select('*,machines(name)').order('halt_start',{ascending:false}).limit(10);
  document.getElementById('halt-history').innerHTML=`<table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr>
      <th style="padding:6px 10px;text-align:left;color:var(--text3);font-size:11px;border-bottom:1px solid var(--border)">Machine</th>
      <th style="padding:6px 10px;text-align:left;color:var(--text3);font-size:11px;border-bottom:1px solid var(--border)">Reason</th>
      <th style="padding:6px 10px;text-align:left;color:var(--text3);font-size:11px;border-bottom:1px solid var(--border)">Start</th>
      <th style="padding:6px 10px;text-align:left;color:var(--text3);font-size:11px;border-bottom:1px solid var(--border)">Downtime</th>
      <th style="padding:6px 10px;text-align:left;color:var(--text3);font-size:11px;border-bottom:1px solid var(--border)">Status</th>
    </tr></thead>
    <tbody>${(haltHist||[]).map(h=>`<tr>
      <td style="padding:6px 10px;border-bottom:1px solid var(--border)">${h.machines?.name||'—'}</td>
      <td style="padding:6px 10px;border-bottom:1px solid var(--border)">${h.reason||'—'}</td>
      <td style="padding:6px 10px;border-bottom:1px solid var(--border);font-family:monospace;font-size:12px">${new Date(h.halt_start).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:true})}</td>
      <td style="padding:6px 10px;border-bottom:1px solid var(--border);font-family:monospace">${h.downtime_minutes?Math.round(h.downtime_minutes)+' min':'—'}</td>
      <td style="padding:6px 10px;border-bottom:1px solid var(--border)"><span class="badge badge-${h.halt_end?'ok':'red'}">${h.halt_end?'Resolved':'Active'}</span></td>
    </tr>`).join('')||'<tr><td colspan="5" style="padding:16px;text-align:center;color:var(--text3)">No halt history</td></tr>'}</tbody>
  </table>`;
}

// ═══ LABOUR ═══
async function loadLabour(){
  document.getElementById('today-date').textContent='Aaj: '+new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'});
  document.getElementById('att-date').textContent=today;

  const[{data:workers},{data:att},{data:holidays}]=await Promise.all([
    db.from('workers').select('*,machines(name)').eq('is_active',true).order('name'),
    db.from('attendance').select('*').eq('att_date',today),
    db.from('holiday_calendar').select('*').gte('holiday_date',today).order('holiday_date').limit(5)
  ]);

  const attMap={};
  (att||[]).forEach(a=>{attMap[a.worker_id]=a;});
  const isTodayHoliday=(holidays||[]).some(h=>h.holiday_date===today);
  const present=(att||[]).filter(a=>a.status==='Present').length;
  const absent=(att||[]).filter(a=>a.status==='Absent').length;
  const notMarked=(workers||[]).length-((att||[]).length);

  document.getElementById('labour-stats').innerHTML=`
    <div class="stat green"><div class="stat-label">Present</div><div class="stat-val">${present}</div><div class="stat-sub">Workers today</div></div>
    <div class="stat red"><div class="stat-label">Absent</div><div class="stat-val">${absent}</div></div>
    <div class="stat amber"><div class="stat-label">Not Marked</div><div class="stat-val">${notMarked}</div></div>
    <div class="stat blue"><div class="stat-label">Total Workers</div><div class="stat-val">${workers?.length||0}</div></div>`;

  document.getElementById('labour-board').innerHTML=`<div class="labour-grid">
  ${(workers||[]).map(w=>{
    const a=attMap[w.id];
    const status=isTodayHoliday?'holiday':a?.status==='Present'?'present':a?.status==='Absent'?'absent':'';
    return`<div class="worker-card ${status}">
      <div class="wc-name">${w.name}</div>
      <div class="wc-role">${w.role} · ${w.shift}</div>
      ${w.machines?`<div class="wc-machine">${w.machines.name}</div>`:''}
      <div class="wc-status ${isTodayHoliday?'wcs-holiday':a?.status==='Present'?'wcs-present':a?.status==='Absent'?'wcs-absent':''}">${isTodayHoliday?'Holiday':a?.status||'Not Marked'}</div>
    </div>`;
  }).join('')}</div>`;

  document.getElementById('holiday-list').innerHTML=`
  ${(holidays||[]).map(h=>`<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
    <div style="font-size:12px;font-family:monospace;color:var(--accent);min-width:90px">${new Date(h.holiday_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
    <div style="font-size:13px">${h.holiday_name}</div>
    <span class="badge badge-info" style="margin-left:auto">${h.holiday_type}</span>
  </div>`).join('')||'<div style="color:var(--text3);font-size:13px;padding:8px">No upcoming holidays</div>'}`;
}

// ═══ TARGETS ═══
async function loadTargets(){
  const[{data:targets},{data:ops}]=await Promise.all([
    db.from('daily_targets').select('*,machines(name),items(code,name)').eq('target_date',today).order('id'),
    db.from('production_order_operations').select('completed_qty,planned_qty,machine_id,production_orders(items(code))').eq('status','In Progress')
  ]);

  const totalT=(targets||[]).reduce((s,t)=>s+(t.target_qty||0),0);
  const totalA=(targets||[]).reduce((s,t)=>s+(t.actual_qty||0),0);
  const carryFwd=(targets||[]).filter(t=>t.carry_forward).length;
  const pct=totalT>0?Math.round(totalA/totalT*100):0;

  document.getElementById('target-stats').innerHTML=`
    <div class="stat blue"><div class="stat-label">Today Target</div><div class="stat-val">${totalT||500}</div><div class="stat-sub">Sets planned</div></div>
    <div class="stat ${pct>=80?'green':pct>=40?'amber':'red'}"><div class="stat-label">Achieved</div><div class="stat-val">${totalA}</div><div class="stat-sub">${pct}% complete</div></div>
    <div class="stat amber"><div class="stat-label">Carry Forward</div><div class="stat-val">${carryFwd}</div><div class="stat-sub">From previous day</div></div>
    <div class="stat ${500-totalA>0?'red':'green'}"><div class="stat-label">Remaining</div><div class="stat-val">${Math.max(0,(totalT||500)-totalA)}</div><div class="stat-sub">To be produced</div></div>`;

  document.getElementById('carry-count').textContent=carryFwd>0?`${carryFwd} carried forward`:'';

  if(!(targets||[]).length){
    // Show live ops as targets
    document.getElementById('target-board').innerHTML=`
      <div style="color:var(--text3);font-size:13px;margin-bottom:12px">Koi formal target set nahi. "+ Set Target" dabao ya live production dekho:</div>
      ${(ops||[]).map(op=>{
        const pct=op.planned_qty>0?Math.min(100,Math.round((op.completed_qty||0)/op.planned_qty*100)):0;
        return`<div class="target-row">
          <div class="target-sku">${op.production_orders?.items?.code||'—'}</div>
          <div class="target-bar"><div class="target-fill ${pct>=80?'green':pct>=40?'amber':'red'}" style="width:${pct}%"></div></div>
          <div class="target-nums">${op.completed_qty||0}/${op.planned_qty||0}</div>
        </div>`;
      }).join('')||'<div style="color:var(--text3);font-size:13px">Koi active production nahi</div>'}`;
    return;
  }

  document.getElementById('target-board').innerHTML=targets.map(t=>{
    const pct=t.target_qty>0?Math.min(100,Math.round((t.actual_qty||0)/t.target_qty*100)):0;
    return`<div class="target-row">
      <div>
        <div class="target-sku">${t.items?.code||'Mixed'}</div>
        <div style="font-size:11px;color:var(--text3)">${t.machines?.name||'All'} · ${t.shift||'All'}</div>
      </div>
      <div class="target-bar"><div class="target-fill ${pct>=80?'green':pct>=40?'amber':'red'}" style="width:${pct}%"></div></div>
      <div class="target-nums">${t.actual_qty||0}/${t.target_qty}</div>
      <div style="display:flex;gap:4px">
        <span class="badge badge-${pct>=80?'ok':pct>=40?'warn':'red'}">${pct}%</span>
        ${t.carry_forward?'<span class="badge badge-warn">CF</span>':''}
        <button class="btn btn-sm btn-ghost" onclick="updateTarget(${t.id},${t.actual_qty||0},${t.target_qty})">Update</button>
      </div>
    </div>`;
  }).join('');
}

// ═══ STOCK ALERTS ═══
async function loadStock(){
  const{data:inv}=await db.from('inventory').select('current_stock,uom,items(code,name,type,reorder_level)').order('item_id');
  const el=document.getElementById('stock-alerts');

  const rm=(inv||[]).filter(i=>i.items?.type==='RM');
  const sfg=(inv||[]).filter(i=>i.items?.type==='SFG');
  const fg=(inv||[]).filter(i=>i.items?.type==='FG');

  function stockSection(title,items,icon){
    const low=items.filter(i=>{
      const rl=i.items?.reorder_level||0;
      const s=i.current_stock||0;
      return s<=(rl*1.5);
    });
    if(!low.length) return`<div class="card"><div class="card-title">${icon} ${title}</div><div style="color:var(--green);font-size:13px;padding:4px 0">✓ Sab OK hai</div></div>`;
    return`<div class="card">
      <div class="card-title">${icon} ${title} <span>${low.length} alerts</span></div>
      ${low.map(i=>{
        const rl=i.items?.reorder_level||0;
        const s=i.current_stock||0;
        const pct=rl>0?Math.round(s/rl*100):100;
        const cls=s<=0?'red':pct<=50?'red':'amber';
        return`<div class="alert-row ${cls}">
          <span class="alert-icon">${s<=0?'🔴':pct<=50?'🟠':'🟡'}</span>
          <div class="alert-text">
            <div style="font-weight:500;font-size:13px">${i.items?.code} — ${i.items?.name}</div>
            <div class="pbar" style="margin:4px 0"><div class="pfill ${cls}" style="width:${Math.min(100,pct)}%"></div></div>
            <div style="font-size:11px;color:var(--text3)">Stock: ${s} ${i.uom} · Reorder: ${rl} · ${pct}%</div>
          </div>
          <div style="text-align:right">
            <div class="alert-val" style="color:${cls==='red'?'var(--red)':'var(--amber)'}">${s<=0?'ZERO':pct<=50?'CRITICAL':'LOW'}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">Need: ${Math.max(0,rl-s)} ${i.uom}</div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  el.innerHTML=`
    <div class="grid3">
      ${stockSection('Raw Material',rm,'🧪')}
      ${stockSection('SFG — Stacking Stock',sfg,'📦')}
      ${stockSection('Finished Goods',fg,'✅')}
    </div>`;
}

// ═══ AGING ═══
async function loadAging(){
  const[{data:payments},{data:sos},{data:pos}]=await Promise.all([
    db.from('payments').select('*,customers(name),suppliers(name)').order('invoice_date'),
    db.from('sales_orders').select('so_no,total_amount,order_date,delivery_date,status,customers(name)').eq('status','Dispatched'),
    db.from('purchase_orders').select('po_no,total_amount,order_date,expected_date,status,suppliers(name)').in('status',['Ordered','Received'])
  ]);

  // Calculate aging from sales orders
  const todayDate=new Date();
  const recv=(sos||[]).map(so=>{
    const invoiceDate=new Date(so.order_date);
    const days=Math.floor((todayDate-invoiceDate)/(1000*60*60*24));
    const paid=(payments||[]).filter(p=>p.customer_id&&p.invoice_no===so.so_no).reduce((s,p)=>s+(p.paid_amount||0),0);
    const balance=(so.total_amount||0)-paid;
    return{...so,days_outstanding:days,balance};
  }).filter(s=>s.balance>0);

  const pay=(pos||[]).map(po=>{
    const invoiceDate=new Date(po.order_date);
    const days=Math.floor((todayDate-invoiceDate)/(1000*60*60*24));
    const paid=(payments||[]).filter(p=>p.supplier_id&&p.invoice_no===po.po_no).reduce((s,p)=>s+(p.paid_amount||0),0);
    const balance=(po.total_amount||0)-paid;
    return{...po,days_outstanding:days,balance};
  }).filter(p=>p.balance>0);

  const totalRecv=recv.reduce((s,r)=>s+r.balance,0);
  const totalPay=pay.reduce((s,p)=>s+p.balance,0);
  const overdue30=recv.filter(r=>r.days_outstanding>30).reduce((s,r)=>s+r.balance,0);
  const overdue60=recv.filter(r=>r.days_outstanding>60).reduce((s,r)=>s+r.balance,0);

  document.getElementById('aging-stats').innerHTML=`
    <div class="stat blue"><div class="stat-label">Total Receivable</div><div class="stat-val" style="font-size:18px">₹${(totalRecv/1000).toFixed(0)}K</div><div class="stat-sub">${recv.length} invoices</div></div>
    <div class="stat ${overdue60>0?'red':overdue30>0?'amber':'green'}"><div class="stat-label">Overdue 30+ days</div><div class="stat-val" style="font-size:18px">₹${(overdue30/1000).toFixed(0)}K</div></div>
    <div class="stat ${overdue60>0?'red':'amber'}"><div class="stat-label">Overdue 60+ days</div><div class="stat-val" style="font-size:18px">₹${(overdue60/1000).toFixed(0)}K</div></div>
    <div class="stat amber"><div class="stat-label">Total Payable</div><div class="stat-val" style="font-size:18px">₹${(totalPay/1000).toFixed(0)}K</div><div class="stat-sub">${pay.length} bills</div></div>`;

  const agingTable=(rows,type)=>`
    <table class="aging-table">
      <thead><tr><th>${type}</th><th>Ref No</th><th>Date</th><th>Days</th><th>Amount ₹</th><th>Balance ₹</th><th>Bucket</th></tr></thead>
      <tbody>${rows.length?rows.sort((a,b)=>b.days_outstanding-a.days_outstanding).map(r=>{
        const d=r.days_outstanding;
        const cls=d>60?'age-60':d>30?'age-30':'age-0';
        const bucket=d>60?'60+ days':d>30?'31-60 days':d>0?'0-30 days':'Current';
        return`<tr>
          <td style="font-weight:500">${r.customers?.name||r.suppliers?.name||'—'}</td>
          <td style="font-family:monospace;font-size:12px">${r.so_no||r.po_no}</td>
          <td style="font-size:12px">${new Date(r.order_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</td>
          <td class="${cls}" style="font-family:monospace;font-weight:600">${d}</td>
          <td style="font-family:monospace">₹${(r.total_amount||0).toLocaleString('en-IN')}</td>
          <td style="font-family:monospace;font-weight:600">₹${r.balance.toLocaleString('en-IN')}</td>
          <td><span class="badge badge-${d>60?'red':d>30?'warn':'ok'}">${bucket}</span></td>
        </tr>`;
      }).join(''):'<tr><td colspan="7" style="padding:16px;text-align:center;color:var(--text3)">Koi pending nahi</td></tr>'}</tbody>
    </table>`;

  document.getElementById('recv-aging').innerHTML=agingTable(recv,'Customer');
  document.getElementById('pay-aging').innerHTML=agingTable(pay,'Supplier');
}

// ═══ P&L ═══
async function loadPL(){
  const period=document.getElementById('pl-period').value;
  const now=new Date();
  let fromDate;
  if(period==='month') fromDate=new Date(now.getFullYear(),now.getMonth(),1).toISOString().split('T')[0];
  else if(period==='quarter') fromDate=new Date(now.getFullYear(),Math.floor(now.getMonth()/3)*3,1).toISOString().split('T')[0];
  else fromDate=new Date(now.getFullYear(),0,1).toISOString().split('T')[0];

  const[{data:sales},{data:purchases},{data:inv}]=await Promise.all([
    db.from('sales_orders').select('total_amount,status').gte('order_date',fromDate).eq('status','Dispatched'),
    db.from('purchase_orders').select('total_amount').gte('order_date',fromDate).in('status',['Ordered','Received']),
    db.from('inventory').select('current_stock,items(code,name,type,uom)')
  ]);

  const totalSales=(sales||[]).reduce((s,o)=>s+(o.total_amount||0),0);
  const totalPurchase=(purchases||[]).reduce((s,o)=>s+(o.total_amount||0),0);
  const grossProfit=totalSales-totalPurchase;
  const gpm=totalSales>0?Math.round(grossProfit/totalSales*100):0;

  document.getElementById('pl-statement').innerHTML=`
    <div class="pl-row green"><span class="pl-label">Sales Revenue</span><span class="pl-val">₹${totalSales.toLocaleString('en-IN')}</span></div>
    <div class="pl-row red"><span class="pl-label">(-) Raw Material Cost</span><span class="pl-val">₹${totalPurchase.toLocaleString('en-IN')}</span></div>
    <div class="pl-row"><span class="pl-label">= Gross Profit</span><span class="pl-val" style="color:${grossProfit>=0?'var(--green)':'var(--red)'}">₹${grossProfit.toLocaleString('en-IN')}</span></div>
    <div class="pl-row"><span class="pl-label">Gross Margin</span><span class="pl-val" style="color:${gpm>=20?'var(--green)':gpm>=10?'var(--amber)':'var(--red)'}">${gpm}%</span></div>
    <div style="margin:10px 0;height:1px;background:var(--border)"></div>
    <div class="pl-row"><span class="pl-label" style="color:var(--text3);font-size:12px">Period</span><span class="pl-val" style="font-size:12px;color:var(--text3)">${fromDate} to ${today}</span></div>
    <div class="pl-row"><span class="pl-label" style="color:var(--text3);font-size:12px">Invoices Dispatched</span><span class="pl-val" style="font-size:12px">${sales?.length||0}</span></div>
    <div class="pl-row"><span class="pl-label" style="color:var(--text3);font-size:12px">Purchase Orders</span><span class="pl-val" style="font-size:12px">${purchases?.length||0}</span></div>`;

  // Stock costing
  const rmStock=(inv||[]).filter(i=>i.items?.type==='RM');
  const sfgStock=(inv||[]).filter(i=>i.items?.type==='SFG');
  const fgStock=(inv||[]).filter(i=>i.items?.type==='FG');
  document.getElementById('stock-costing').innerHTML=`
    <div class="pl-row"><span class="pl-label">RM Items in Stock</span><span class="pl-val">${rmStock.length} types</span></div>
    <div class="pl-row"><span class="pl-label">SFG (WIP + Stacked)</span><span class="pl-val">${sfgStock.reduce((s,i)=>s+(i.current_stock||0),0).toLocaleString()} pcs/sets</span></div>
    <div class="pl-row"><span class="pl-label">FG Ready to Dispatch</span><span class="pl-val" style="color:var(--green)">${fgStock.reduce((s,i)=>s+(i.current_stock||0),0).toLocaleString()} sets</span></div>
    <div style="margin:10px 0;height:1px;background:var(--border)"></div>
    ${rmStock.slice(0,6).map(i=>`<div class="pl-row">
      <span class="pl-label" style="font-size:12px">${i.items?.code}</span>
      <span class="pl-val" style="font-size:12px">${i.current_stock||0} ${i.items?.uom}</span>
    </div>`).join('')}`;

  // Bank recon
  const{data:bankTxns}=await db.from('bank_transactions').select('*').order('txn_date',{ascending:false}).limit(5);
  const totalCredit=(bankTxns||[]).reduce((s,t)=>s+(t.credit||0),0);
  const totalDebit=(bankTxns||[]).reduce((s,t)=>s+(t.debit||0),0);
  const unreconciled=(bankTxns||[]).filter(t=>!t.reconciled).length;

  document.getElementById('bank-recon').innerHTML=`
    <div class="pl-row"><span class="pl-label">Recent Credits</span><span class="pl-val" style="color:var(--green)">₹${totalCredit.toLocaleString('en-IN')}</span></div>
    <div class="pl-row"><span class="pl-label">Recent Debits</span><span class="pl-val" style="color:var(--red)">₹${totalDebit.toLocaleString('en-IN')}</span></div>
    <div class="pl-row"><span class="pl-label">Unreconciled</span><span class="pl-val" style="color:${unreconciled>0?'var(--amber)':'var(--green)'}">${unreconciled} txns</span></div>
    <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px" onclick="showBankModal()">+ Add Bank Transaction</button>`;
}

// ═══ MODALS ═══
async function showHaltModal(){
  const{data:machines}=await db.from('machines').select('id,name').eq('is_active',true).order('name');
  showModal(`<div class="mhead"><span class="mtitle">🔴 Report Machine Halt</span><button class="mclose" onclick="closeModal()">×</button></div>
  <div class="mbody">
    <div class="fgroup"><label class="flabel">Machine *</label>
      <select class="finput" id="h-mach"><option value="">-- Select --</option>${(machines||[]).map(m=>`<option value="${m.id}">${m.name}</option>`).join('')}</select>
    </div>
    <div class="fgroup"><label class="flabel">Reason *</label>
      <select class="finput" id="h-reason">
        <option value="Breakdown">Breakdown</option>
        <option value="Die Change">Die Change</option>
        <option value="Setup">Setup</option>
        <option value="No Material">No Material</option>
        <option value="Power Cut">Power Cut</option>
        <option value="Maintenance">Maintenance</option>
        <option value="Other">Other</option>
      </select>
    </div>
    <div class="fgroup"><label class="flabel">Details</label><input class="finput" id="h-detail" placeholder="Brief description"/></div>
    <div class="fgroup"><label class="flabel">Reported By</label><input class="finput" id="h-by" placeholder="Name"/></div>
    <div id="h-err" style="color:var(--red);font-size:12px;margin-top:6px"></div>
  </div>
  <div class="mfoot"><button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button><button class="btn btn-red btn-sm" onclick="saveHalt()">Report Halt</button></div>`);
}

async function saveHalt(){
  const machId=document.getElementById('h-mach').value;
  const reason=document.getElementById('h-reason').value;
  if(!machId){document.getElementById('h-err').textContent='Machine select karo.';return;}
  await db.from('machine_halts').insert({machine_id:machId,reason,reason_detail:document.getElementById('h-detail').value,reported_by:document.getElementById('h-by').value});
  closeModal();showToast('⚠ Halt reported!');loadMachines();
}

async function showResumeModal(){
  const{data:halts}=await db.from('machine_halts').select('*,machines(name)').is('halt_end',null);
  if(!halts?.length){showToast('Koi active halt nahi!');return;}
  showModal(`<div class="mhead"><span class="mtitle">✅ Resume Machine</span><button class="mclose" onclick="closeModal()">×</button></div>
  <div class="mbody">
    ${halts.map(h=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
      <div>
        <div style="font-size:13px;font-weight:500">${h.machines?.name}</div>
        <div style="font-size:11px;color:var(--text3)">${h.reason} · ${new Date(h.halt_start).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true})}</div>
      </div>
      <button class="btn btn-green btn-sm" onclick="resolveHalt(${h.id})">Resume</button>
    </div>`).join('')}
  </div>
  <div class="mfoot"><button class="btn btn-ghost btn-sm" onclick="closeModal()">Close</button></div>`);
}

async function resolveHalt(id){
  await db.from('machine_halts').update({halt_end:new Date().toISOString(),resolved_by:'Manager'}).eq('id',id);
  closeModal();showToast('✓ Machine resumed!');loadMachines();
}

async function showAttendanceModal(){
  const{data:workers}=await db.from('workers').select('*').eq('is_active',true).order('name');
  const{data:existing}=await db.from('attendance').select('worker_id,status').eq('att_date',today);
  const attMap={};
  (existing||[]).forEach(a=>{attMap[a.worker_id]=a.status;});
  showModal(`<div class="mhead"><span class="mtitle">📋 Mark Attendance — ${today}</span><button class="mclose" onclick="closeModal()">×</button></div>
  <div class="mbody">
    <div style="display:flex;gap:6px;margin-bottom:10px">
      <button class="btn btn-green btn-sm" onclick="markAll('Present')">All Present</button>
      <button class="btn btn-ghost btn-sm" onclick="markAll('Absent')">All Absent</button>
    </div>
    ${(workers||[]).map(w=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:13px">${w.name} <span style="font-size:11px;color:var(--text3)">${w.role}</span></div>
      <select class="finput" style="width:120px;padding:4px 8px;font-size:12px" id="att-${w.id}">
        <option value="Present" ${attMap[w.id]==='Present'?'selected':''}>Present</option>
        <option value="Absent" ${attMap[w.id]==='Absent'?'selected':''}>Absent</option>
        <option value="Half Day" ${attMap[w.id]==='Half Day'?'selected':''}>Half Day</option>
        <option value="Leave" ${attMap[w.id]==='Leave'?'selected':''}>Leave</option>
      </select>
    </div>`).join('')}
  </div>
  <div class="mfoot"><button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button><button class="btn btn-primary btn-sm" onclick="saveAttendance(${JSON.stringify((workers||[]).map(w=>w.id))})">Save</button></div>`);
}

function markAll(status){
  document.querySelectorAll('[id^="att-"]').forEach(el=>el.value=status);
}

async function saveAttendance(workerIds){
  const records=workerIds.map(id=>({worker_id:id,att_date:today,status:document.getElementById('att-'+id)?.value||'Present',shift:'Morning'}));
  for(const r of records){
    await db.from('attendance').upsert(r,{onConflict:'worker_id,att_date,shift'});
  }
  closeModal();showToast('✓ Attendance saved!');loadLabour();
}

async function showTargetModal(){
  const{data:machines}=await db.from('machines').select('id,name').eq('is_active',true);
  const{data:items}=await db.from('items').select('id,code,name').in('type',['SFG','FG']).order('code');
  showModal(`<div class="mhead"><span class="mtitle">🎯 Set Daily Target</span><button class="mclose" onclick="closeModal()">×</button></div>
  <div class="mbody">
    <div class="fgroup"><label class="flabel">Date</label><input class="finput" id="t-date" type="date" value="${today}"/></div>
    <div class="frow">
      <div class="fgroup"><label class="flabel">Machine</label>
        <select class="finput" id="t-mach"><option value="">All Machines</option>${(machines||[]).map(m=>`<option value="${m.id}">${m.name}</option>`).join('')}</select>
      </div>
      <div class="fgroup"><label class="flabel">Item</label>
        <select class="finput" id="t-item"><option value="">All Items</option>${(items||[]).map(i=>`<option value="${i.id}">${i.code}</option>`).join('')}</select>
      </div>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flabel">Target Qty (pcs) *</label><input class="finput" id="t-qty" type="number" value="500"/></div>
      <div class="fgroup"><label class="flabel">Shift</label>
        <select class="finput" id="t-shift"><option value="All">All Day</option><option value="Morning">Morning</option><option value="Evening">Evening</option><option value="Night">Night</option></select>
      </div>
    </div>
    <div class="fgroup" style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" id="t-cf"/>
      <label for="t-cf" style="font-size:13px">Carry Forward from previous day</label>
    </div>
  </div>
  <div class="mfoot"><button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button><button class="btn btn-primary btn-sm" onclick="saveTarget()">Set Target</button></div>`);
}

async function saveTarget(){
  const qty=parseInt(document.getElementById('t-qty').value)||0;
  if(!qty){showToast('Qty daalo!');return;}
  await db.from('daily_targets').insert({
    target_date:document.getElementById('t-date').value,
    machine_id:document.getElementById('t-mach').value||null,
    item_id:document.getElementById('t-item').value||null,
    target_qty:qty,
    shift:document.getElementById('t-shift').value,
    carry_forward:document.getElementById('t-cf').checked
  });
  closeModal();showToast('✓ Target set!');loadTargets();
}

async function updateTarget(id,current,max){
  const newQty=prompt(`Actual qty update karo (max: ${max}):`,current);
  if(newQty===null) return;
  await db.from('daily_targets').update({actual_qty:parseInt(newQty)||0}).eq('id',id);
  showToast('✓ Updated!');loadTargets();
  // Check carry forward
  if(parseInt(newQty)<max){
    const cf=confirm(`Target puri nahi hui (${newQty}/${max}). Kal ke liye carry forward karna hai?`);
    if(cf){
      const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
      const tDate=tomorrow.toISOString().split('T')[0];
      await db.from('daily_targets').insert({target_date:tDate,target_qty:max-parseInt(newQty),carry_forward:true,carry_from_date:today,notes:`Carry forward from ${today}`});
      showToast('✓ Carry forward set for tomorrow!');
    }
  }
}

async function showPaymentModal(type){
  const[{data:customers},{data:suppliers}]=await Promise.all([
    db.from('customers').select('id,name').eq('is_active',true),
    db.from('suppliers').select('id,name').eq('is_active',true)
  ]);
  showModal(`<div class="mhead"><span class="mtitle">${type==='Received'?'💰 Record Receipt':'💸 Record Payment'}</span><button class="mclose" onclick="closeModal()">×</button></div>
  <div class="mbody">
    <div class="fgroup"><label class="flabel">${type==='Received'?'Customer':'Supplier'} *</label>
      <select class="finput" id="pay-party">
        <option value="">-- Select --</option>
        ${type==='Received'?(customers||[]).map(c=>`<option value="${c.id}">${c.name}</option>`).join(''):(suppliers||[]).map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}
      </select>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flabel">Invoice No</label><input class="finput" id="pay-inv" placeholder="SO/PO number"/></div>
      <div class="fgroup"><label class="flabel">Invoice Date</label><input class="finput" id="pay-invdate" type="date" value="${today}"/></div>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flabel">Invoice Amount ₹</label><input class="finput" id="pay-invamt" type="number" value="0"/></div>
      <div class="fgroup"><label class="flabel">Paid Amount ₹</label><input class="finput" id="pay-amt" type="number" value="0"/></div>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flabel">Payment Date</label><input class="finput" id="pay-date" type="date" value="${today}"/></div>
      <div class="fgroup"><label class="flabel">Credit Days</label><input class="finput" id="pay-days" type="number" value="30"/></div>
    </div>
    <div class="fgroup"><label class="flabel">Payment Mode</label>
      <select class="finput" id="pay-mode"><option value="NEFT">NEFT</option><option value="RTGS">RTGS</option><option value="UPI">UPI</option><option value="Cheque">Cheque</option><option value="Cash">Cash</option></select>
    </div>
    <div class="fgroup"><label class="flabel">Bank Ref / UTR</label><input class="finput" id="pay-ref" placeholder="Reference number"/></div>
  </div>
  <div class="mfoot"><button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button><button class="btn btn-primary btn-sm" onclick="savePayment('${type}')">Save</button></div>`);
}

async function savePayment(type){
  const partyId=document.getElementById('pay-party').value;
  if(!partyId){showToast('Party select karo!');return;}
  const invAmt=parseFloat(document.getElementById('pay-invamt').value)||0;
  const paidAmt=parseFloat(document.getElementById('pay-amt').value)||0;
  const status=paidAmt>=invAmt?'Paid':paidAmt>0?'Partial':'Pending';
  await db.from('payments').insert({
    payment_type:type,
    party_type:type==='Received'?'Customer':'Supplier',
    customer_id:type==='Received'?partyId:null,
    supplier_id:type==='Paid'?partyId:null,
    invoice_no:document.getElementById('pay-inv').value,
    invoice_date:document.getElementById('pay-invdate').value,
    invoice_amount:invAmt,paid_amount:paidAmt,
    payment_date:document.getElementById('pay-date').value,
    credit_days:parseInt(document.getElementById('pay-days').value)||30,
    payment_mode:document.getElementById('pay-mode').value,
    bank_ref:document.getElementById('pay-ref').value,
    due_date:new Date(new Date(document.getElementById('pay-invdate').value).getTime()+(parseInt(document.getElementById('pay-days').value)||30)*86400000).toISOString().split('T')[0],
    status
  });
  closeModal();showToast('✓ Payment recorded!');loadAging();
}

async function showBankModal(){
  showModal(`<div class="mhead"><span class="mtitle">🏦 Add Bank Transaction</span><button class="mclose" onclick="closeModal()">×</button></div>
  <div class="mbody">
    <div class="frow">
      <div class="fgroup"><label class="flabel">Date</label><input class="finput" id="bt-date" type="date" value="${today}"/></div>
      <div class="fgroup"><label class="flabel">Bank</label><input class="finput" id="bt-bank" value="Main Account"/></div>
    </div>
    <div class="fgroup"><label class="flabel">Description *</label><input class="finput" id="bt-desc" placeholder="Payment from / to..."/></div>
    <div class="frow">
      <div class="fgroup"><label class="flabel">Credit ₹ (In)</label><input class="finput" id="bt-cr" type="number" value="0"/></div>
      <div class="fgroup"><label class="flabel">Debit ₹ (Out)</label><input class="finput" id="bt-dr" type="number" value="0"/></div>
    </div>
    <div class="fgroup"><label class="flabel">Ref No</label><input class="finput" id="bt-ref" placeholder="UTR/Cheque no"/></div>
  </div>
  <div class="mfoot"><button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button><button class="btn btn-primary btn-sm" onclick="saveBankTxn()">Save</button></div>`);
}

async function saveBankTxn(){
  const desc=document.getElementById('bt-desc').value;
  if(!desc){showToast('Description daalo!');return;}
  await db.from('bank_transactions').insert({
    txn_date:document.getElementById('bt-date').value,
    description:desc,
    credit:parseFloat(document.getElementById('bt-cr').value)||0,
    debit:parseFloat(document.getElementById('bt-dr').value)||0,
    bank_name:document.getElementById('bt-bank').value,
    reference_no:document.getElementById('bt-ref').value
  });
  closeModal();showToast('✓ Bank transaction saved!');loadPL();
}

function showModal(html){document.getElementById('modal-area').innerHTML=`<div class="modal-overlay"><div class="modal">${html}</div></div>`;}
function closeModal(){document.getElementById('modal-area').innerHTML='';}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.style.display='block';clearTimeout(t._t);t._t=setTimeout(()=>t.style.display='none',3000);}

// Auto refresh every 2 min
setInterval(loadOverview,120000);

// Init
loadOverview();
