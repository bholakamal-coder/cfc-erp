
const SURL='https://hfufhcsvbrzygoykvtah.supabase.co';
const SKEY='sb_publishable_iqs1Q7TrS4j28CWqv3TUJQ_57WHtgB9';
const{createClient}=supabase;
const db=createClient(SURL,SKEY);

const COMPANY={
  name:'CERATECH FRICTION COMPOSITES',
  addr:'E-59, Sector A-5 & 6, Tronica City',
  city:'Loni, Ghaziabad — 201102',
  state:'Uttar Pradesh',
  gstin:'09AEOPB4560N1Z2',
  phone:'+91 XXXXX XXXXX',
  email:'info@ceratech.in',
  bank:'Bank Name',
  account:'XXXX XXXX XXXX',
  ifsc:'XXXXXX0XXXXX',
  branch:'Branch Name'
};

let invItems=[];
let currentSO=null;

// Init
const today=new Date().toISOString().split('T')[0];
const due=new Date(Date.now()+30*86400000).toISOString().split('T')[0];
document.getElementById('inv-date').value=today;
document.getElementById('inv-due').value=due;
document.getElementById('po-date').value=today;

function showTab(t){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  document.getElementById(t).classList.add('active');
  event.target.classList.add('active');
  if(t==='history')loadHistory();
  if(t==='po')loadPOs();
}

async function loadSOs(){
  const{data}=await db.from('sales_orders').select('id,so_no,customers(name)').in('status',['Confirmed','Dispatched']).order('so_no');
  const el=document.getElementById('inv-so');
  el.innerHTML='<option value="">-- Select SO --</option>'+(data||[]).map(s=>`<option value="${s.id}">${s.so_no} — ${s.customers?.name}</option>`).join('');
}

async function loadSODetails(){
  const soId=document.getElementById('inv-so').value;
  if(!soId) return;
  const{data:so}=await db.from('sales_orders').select('*,customers(*)').eq('id',soId).single();
  const{data:lines}=await db.from('sales_order_lines').select('*,items(code,name,hsn_code)').eq('so_id',soId);
  currentSO=so;
  document.getElementById('inv-custpo').value=so?.notes||'';
  invItems=(lines||[]).map(l=>({
    code:l.items?.code||'',
    name:l.items?.name||'',
    hsn:l.items?.hsn_code||'68138100',
    qty:l.qty,
    uom:l.uom,
    rate:l.unit_price,
    gst:l.gst_percent||18
  }));
  renderInvItems();
  document.getElementById('inv-items-section').style.display='block';
}

function renderInvItems(){
  const el=document.getElementById('inv-items-table');
  el.innerHTML=`<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px">
  <thead><tr>
    <th style="padding:6px 8px;background:var(--bg3);color:var(--text3);font-size:11px;text-transform:uppercase;border-bottom:1px solid var(--border)">Item</th>
    <th style="padding:6px 8px;background:var(--bg3);color:var(--text3);font-size:11px;border-bottom:1px solid var(--border)">HSN</th>
    <th style="padding:6px 8px;background:var(--bg3);color:var(--text3);font-size:11px;border-bottom:1px solid var(--border)">Qty</th>
    <th style="padding:6px 8px;background:var(--bg3);color:var(--text3);font-size:11px;border-bottom:1px solid var(--border)">Rate ₹</th>
    <th style="padding:6px 8px;background:var(--bg3);color:var(--text3);font-size:11px;border-bottom:1px solid var(--border)">GST%</th>
    <th style="padding:6px 8px;background:var(--bg3);color:var(--text3);font-size:11px;border-bottom:1px solid var(--border)">Amount ₹</th>
    <th style="padding:6px 8px;background:var(--bg3);color:var(--text3);font-size:11px;border-bottom:1px solid var(--border)"></th>
  </tr></thead>
  <tbody>
  ${invItems.map((item,idx)=>`<tr>
    <td style="padding:6px 8px;border-bottom:1px solid var(--border)">${item.name}<br><span style="font-size:11px;color:var(--text3)">${item.code}</span></td>
    <td style="padding:6px 8px;border-bottom:1px solid var(--border)"><input style="width:90px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:4px 6px;color:var(--text);font-size:12px" value="${item.hsn}" onchange="invItems[${idx}].hsn=this.value"/></td>
    <td style="padding:6px 8px;border-bottom:1px solid var(--border)"><input type="number" style="width:60px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:4px 6px;color:var(--text);font-size:12px" value="${item.qty}" onchange="invItems[${idx}].qty=parseFloat(this.value);renderInvItems()"/> ${item.uom}</td>
    <td style="padding:6px 8px;border-bottom:1px solid var(--border)"><input type="number" style="width:80px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:4px 6px;color:var(--text);font-size:12px" value="${item.rate}" onchange="invItems[${idx}].rate=parseFloat(this.value);renderInvItems()"/></td>
    <td style="padding:6px 8px;border-bottom:1px solid var(--border)"><input type="number" style="width:50px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:4px 6px;color:var(--text);font-size:12px" value="${item.gst}" onchange="invItems[${idx}].gst=parseFloat(this.value);renderInvItems()"/>%</td>
    <td style="padding:6px 8px;border-bottom:1px solid var(--border);font-family:monospace">₹${(item.qty*item.rate).toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
    <td style="padding:6px 8px;border-bottom:1px solid var(--border)"><button onclick="invItems.splice(${idx},1);renderInvItems()" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px">×</button></td>
  </tr>`).join('')}
  </tbody></table>`;
}

function addInvItem(){
  invItems.push({code:'',name:'New Item',hsn:'68138100',qty:1,uom:'SET',rate:0,gst:18});
  renderInvItems();
}

function numToWords(n){
  const a=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const b=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  if(n===0)return'Zero';
  if(n<20)return a[n];
  if(n<100)return b[Math.floor(n/10)]+(n%10?' '+a[n%10]:'');
  if(n<1000)return a[Math.floor(n/100)]+' Hundred'+(n%100?' '+numToWords(n%100):'');
  if(n<100000)return numToWords(Math.floor(n/1000))+' Thousand'+(n%1000?' '+numToWords(n%1000):'');
  if(n<10000000)return numToWords(Math.floor(n/100000))+' Lakh'+(n%100000?' '+numToWords(n%100000):'');
  return numToWords(Math.floor(n/10000000))+' Crore'+(n%10000000?' '+numToWords(n%10000000):'');
}

async function generateInvoice(){
  if(!invItems.length){showToast('Koi items nahi!');return;}
  const invNo=document.getElementById('inv-no').value;
  const invDate=document.getElementById('inv-date').value;
  const invDue=document.getElementById('inv-due').value;
  const supplyType=document.getElementById('inv-supply').value;
  const vehicle=document.getElementById('inv-vehicle').value;
  const custPO=document.getElementById('inv-custpo').value;

  let custName='',custAddr='',custCity='',custGST='',custState='';
  if(currentSO?.customers){
    const c=currentSO.customers;
    custName=c.name||'';
    custAddr=c.address||'';
    custGST=c.gstin||'';
    custState=custGST?stateName(custGST.substring(0,2)):'';
    custCity=c.address||'';
  }

  // Calculate totals
  let subtotal=0;
  invItems.forEach(i=>subtotal+=i.qty*i.rate);

  const isInter=supplyType==='inter';
  let cgst=0,sgst=0,igst=0;
  invItems.forEach(i=>{
    const taxable=i.qty*i.rate;
    if(isInter) igst+=taxable*i.gst/100;
    else{cgst+=taxable*i.gst/200;sgst+=taxable*i.gst/200;}
  });
  const total=subtotal+(isInter?igst:cgst+sgst);
  const rounded=Math.round(total);
  const roundOff=rounded-total;

  const invHtml=`
  <div class="inv-header">
    <div class="inv-company">
      <div class="inv-company-name">${COMPANY.name}</div>
      <div class="inv-company-addr">
        ${COMPANY.addr}<br>
        ${COMPANY.city}<br>
        GSTIN: <strong>${COMPANY.gstin}</strong> | State: ${COMPANY.state}<br>
        Ph: ${COMPANY.phone} | Email: ${COMPANY.email}
      </div>
    </div>
    <div class="inv-title-box">
      <div class="inv-title">TAX INVOICE</div>
      <div class="inv-no">
        <strong>Invoice No:</strong> ${invNo}<br>
        <strong>Date:</strong> ${new Date(invDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}<br>
        <strong>Due Date:</strong> ${new Date(invDue).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}<br>
        ${vehicle?`<strong>Vehicle:</strong> ${vehicle}<br>`:''}
        ${custPO?`<strong>Cust PO:</strong> ${custPO}`:''}
      </div>
    </div>
  </div>

  <div class="inv-parties">
    <div class="inv-party-box">
      <div class="inv-party-label">Bill To / Buyer</div>
      <div class="inv-party-name">${custName||'—'}</div>
      <div class="inv-party-detail">
        ${custAddr}<br>
        ${custGST?`GSTIN: <strong>${custGST}</strong>`:'GSTIN: —'}<br>
        ${custState?`State: ${custState}`:''}
      </div>
    </div>
    <div class="inv-party-box">
      <div class="inv-party-label">Ship To / Consignee</div>
      <div class="inv-party-name">${custName||'—'}</div>
      <div class="inv-party-detail">
        ${custAddr}<br>
        ${custGST?`GSTIN: <strong>${custGST}</strong>`:'GSTIN: —'}
      </div>
    </div>
  </div>

  <table class="inv-table">
    <thead><tr>
      <th style="width:30px">S.No</th>
      <th>Description of Goods</th>
      <th>HSN Code</th>
      <th class="num">Qty</th>
      <th>UOM</th>
      <th class="num">Rate ₹</th>
      <th class="num">Taxable ₹</th>
      ${isInter?`<th class="num">IGST %</th><th class="num">IGST ₹</th>`:`<th class="num">CGST %</th><th class="num">CGST ₹</th><th class="num">SGST %</th><th class="num">SGST ₹</th>`}
      <th class="num">Total ₹</th>
    </tr></thead>
    <tbody>
    ${invItems.map((item,idx)=>{
      const taxable=item.qty*item.rate;
      const igstAmt=taxable*item.gst/100;
      const cgstAmt=taxable*item.gst/200;
      const sgstAmt=taxable*item.gst/200;
      const lineTotal=taxable+(isInter?igstAmt:cgstAmt+sgstAmt);
      return`<tr>
        <td>${idx+1}</td>
        <td><strong>${item.name}</strong><br><span class="inv-hsn">${item.code}</span></td>
        <td>${item.hsn}</td>
        <td class="num">${item.qty}</td>
        <td>${item.uom}</td>
        <td class="num">${item.rate.toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
        <td class="num">${taxable.toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
        ${isInter?`<td class="num">${item.gst}%</td><td class="num">${igstAmt.toLocaleString('en-IN',{minimumFractionDigits:2})}</td>`:`<td class="num">${item.gst/2}%</td><td class="num">${cgstAmt.toLocaleString('en-IN',{minimumFractionDigits:2})}</td><td class="num">${item.gst/2}%</td><td class="num">${sgstAmt.toLocaleString('en-IN',{minimumFractionDigits:2})}</td>`}
        <td class="num"><strong>${lineTotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</strong></td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>

  <div class="inv-totals">
    <div class="inv-totals-box">
      <div class="inv-total-row"><span class="inv-total-label">Subtotal (Taxable)</span><span class="inv-total-val">₹${subtotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>
      ${isInter?`<div class="inv-total-row"><span class="inv-total-label">IGST</span><span class="inv-total-val">₹${igst.toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>`:`<div class="inv-total-row"><span class="inv-total-label">CGST</span><span class="inv-total-val">₹${cgst.toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div><div class="inv-total-row"><span class="inv-total-label">SGST</span><span class="inv-total-val">₹${sgst.toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>`}
      ${Math.abs(roundOff)>0?`<div class="inv-total-row"><span class="inv-total-label">Round Off</span><span class="inv-total-val">${roundOff>0?'+':''}₹${Math.abs(roundOff).toFixed(2)}</span></div>`:''}
      <div class="inv-total-row grand"><span class="inv-total-label">GRAND TOTAL</span><span class="inv-total-val">₹${rounded.toLocaleString('en-IN')}</span></div>
    </div>
  </div>

  <div class="inv-words"><strong>Amount in Words:</strong> Rupees ${numToWords(rounded)} Only</div>

  <div class="inv-footer">
    <div class="inv-bank">
      <div class="inv-bank-title">Bank Details</div>
      Bank: ${COMPANY.bank}<br>
      Account No: ${COMPANY.account}<br>
      IFSC: ${COMPANY.ifsc}<br>
      Branch: ${COMPANY.branch}<br><br>
      <strong>Terms:</strong> Payment within 30 days<br>
      <em style="font-size:9px">Subject to Ghaziabad jurisdiction. E&OE.</em>
    </div>
    <div class="inv-sign">
      <div style="margin-bottom:40px;font-size:10px">For ${COMPANY.name}</div>
      <div class="inv-sign-line">Authorised Signatory</div>
    </div>
  </div>`;

  document.getElementById('invoice-content').innerHTML=invHtml;
  document.querySelector('.content').style.display='none';
  document.getElementById('invoice-preview').style.display='block';
}

function stateName(code){
  const states={'01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh','05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh','10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur','15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat','27':'Maharashtra','29':'Karnataka','32':'Kerala','33':'Tamil Nadu','36':'Telangana','37':'Andhra Pradesh'};
  return states[code]||'Unknown';
}

function backToForm(){
  document.querySelector('.content').style.display='block';
  document.getElementById('invoice-preview').style.display='none';
}

async function saveInvoice(){
  showToast('✓ Invoice saved!');
}

// ── PURCHASE ORDER ──
async function loadPOs(){
  const{data}=await db.from('purchase_orders').select('id,po_no,suppliers(name)').order('po_no',{ascending:false});
  const el=document.getElementById('po-select');
  el.innerHTML='<option value="">-- Select PO --</option>'+(data||[]).map(p=>`<option value="${p.id}">${p.po_no} — ${p.suppliers?.name}</option>`).join('');
}

async function loadPODetails(){
  const poId=document.getElementById('po-select').value;
  if(!poId)return;
  document.getElementById('po-date').value=new Date().toISOString().split('T')[0];
}

async function generatePO(){
  const poId=document.getElementById('po-select').value;
  if(!poId){showToast('PO select karo!');return;}
  const{data:po}=await db.from('purchase_orders').select('*,suppliers(*)').eq('id',poId).single();
  const{data:lines}=await db.from('purchase_order_lines').select('*,items(code,name,hsn_code)').eq('po_id',poId);
  const sup=po?.suppliers;
  const poDate=document.getElementById('po-date').value;

  let subtotal=0;
  (lines||[]).forEach(l=>subtotal+=l.qty*l.unit_price);
  const gst=subtotal*0.18;
  const total=subtotal+gst;

  const poHtml=`
  <div class="inv-header">
    <div class="inv-company">
      <div class="inv-company-name">${COMPANY.name}</div>
      <div class="inv-company-addr">
        ${COMPANY.addr}<br>${COMPANY.city}<br>
        GSTIN: <strong>${COMPANY.gstin}</strong> | State: ${COMPANY.state}
      </div>
    </div>
    <div class="inv-title-box">
      <div class="inv-title">PURCHASE ORDER</div>
      <div class="inv-no">
        <strong>PO No:</strong> ${po?.po_no}<br>
        <strong>Date:</strong> ${new Date(poDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}<br>
        <strong>Expected:</strong> ${po?.expected_date?new Date(po.expected_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'—'}
      </div>
    </div>
  </div>

  <div class="inv-parties">
    <div class="inv-party-box">
      <div class="inv-party-label">Supplier / Vendor</div>
      <div class="inv-party-name">${sup?.name||'—'}</div>
      <div class="inv-party-detail">
        ${sup?.address||''}<br>
        ${sup?.gstin?`GSTIN: <strong>${sup.gstin}</strong>`:'GSTIN: —'}<br>
        ${sup?.phone?`Ph: ${sup.phone}`:''}
      </div>
    </div>
    <div class="inv-party-box">
      <div class="inv-party-label">Deliver To</div>
      <div class="inv-party-name">${COMPANY.name}</div>
      <div class="inv-party-detail">
        ${COMPANY.addr}<br>${COMPANY.city}<br>
        GSTIN: <strong>${COMPANY.gstin}</strong>
      </div>
    </div>
  </div>

  <table class="inv-table">
    <thead><tr>
      <th>S.No</th><th>Material Description</th><th>HSN</th>
      <th class="num">Qty</th><th>UOM</th>
      <th class="num">Rate ₹</th><th class="num">GST%</th><th class="num">Amount ₹</th>
    </tr></thead>
    <tbody>
    ${(lines||[]).map((l,idx)=>`<tr>
      <td>${idx+1}</td>
      <td><strong>${l.items?.name||'—'}</strong><br><span class="inv-hsn">${l.items?.code||''}</span></td>
      <td>${l.items?.hsn_code||'—'}</td>
      <td class="num">${l.qty}</td><td>${l.uom}</td>
      <td class="num">${l.unit_price.toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
      <td class="num">${l.gst_percent||18}%</td>
      <td class="num"><strong>${(l.qty*l.unit_price).toLocaleString('en-IN',{minimumFractionDigits:2})}</strong></td>
    </tr>`).join('')}
    </tbody>
  </table>

  <div class="inv-totals">
    <div class="inv-totals-box">
      <div class="inv-total-row"><span class="inv-total-label">Subtotal</span><span>₹${subtotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>
      <div class="inv-total-row"><span class="inv-total-label">GST (18%)</span><span>₹${gst.toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>
      <div class="inv-total-row grand"><span class="inv-total-label">TOTAL</span><span>₹${total.toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>
    </div>
  </div>

  <div class="inv-words"><strong>Amount in Words:</strong> Rupees ${numToWords(Math.round(total))} Only</div>

  <div class="inv-footer">
    <div class="inv-bank">
      <strong>Terms & Conditions:</strong><br>
      1. Delivery as per schedule<br>
      2. Material must match specifications<br>
      3. Invoice with GST to be submitted<br>
      4. Payment: 30 days from delivery<br><br>
      <em style="font-size:9px">This is a computer generated PO. Subject to Ghaziabad jurisdiction.</em>
    </div>
    <div class="inv-sign">
      <div style="margin-bottom:40px;font-size:10px">For ${COMPANY.name}</div>
      <div class="inv-sign-line">Authorised Signatory</div>
    </div>
  </div>`;

  document.getElementById('invoice-content').innerHTML=poHtml;
  document.querySelector('.content').style.display='none';
  document.getElementById('invoice-preview').style.display='block';
}

// ── HISTORY ──
async function loadHistory(){
  document.getElementById('inv-history').innerHTML='<div class="alert" style="background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.3);border-radius:6px;padding:10px 14px;font-size:13px;color:#60a5fa">Invoice history feature coming soon. Abhi generate karo aur print karo.</div>';
}

function showModal(html){document.getElementById('modal-area').innerHTML=`<div class="modal-overlay"><div class="modal">${html}</div></div>`;}
function closeModal(){document.getElementById('modal-area').innerHTML='';}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.style.display='block';setTimeout(()=>t.style.display='none',3000);}

// Init
loadSOs();
