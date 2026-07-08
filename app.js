'use strict';
const ADMIN_PIN='1234';
const PROV_THRESHOLD=50;
const FIREBASE_CONFIG={apiKey:"AIzaSyCauStR5hBnVH_tFJnQHh0uaAKbzj1hdMo",authDomain:"caja-local-sigchos.firebaseapp.com",projectId:"caja-local-sigchos",storageBucket:"caja-local-sigchos.firebasestorage.app",messagingSenderId:"970284747340",appId:"1:970284747340:web:1980753a9d43523650c2e9"};
firebase.initializeApp(FIREBASE_CONFIG);
const db=firebase.firestore();
db.enablePersistence({synchronizeTabs:true}).catch(()=>{});
const COL_CIERRES='cierres_caja';
const COL_AUDIT='cierres_audit';
const els={
  cajaChica:document.getElementById('cajaChica'),cajaFuerte:document.getElementById('cajaFuerte'),
  transferencias:document.getElementById('transferencias'),pagoProveedores:document.getElementById('pagoProveedores'),
  gastosPersonales:document.getElementById('gastosPersonales'),notas:document.getElementById('notas'),
  totalIngresos:document.getElementById('totalIngresos'),totalEgresos:document.getElementById('totalEgresos'),
  balanceNeto:document.getElementById('balanceNeto'),balanceCard:document.getElementById('balanceCard'),
  balanceHint:document.getElementById('balanceHint'),headerDate:document.getElementById('headerDate'),
  todayDate:document.getElementById('todayDate'),connDot:document.getElementById('connDot'),
  confirmChip:document.getElementById('confirmChip'),confirmCheckIcon:document.getElementById('confirmCheckIcon'),
  confirmChipText:document.getElementById('confirmChipText'),confirmChipHint:document.getElementById('confirmChipHint'),
  saveBtn:document.getElementById('saveBtn'),clearFormBtn:document.getElementById('clearFormBtn'),
  sumIngresos:document.getElementById('sumIngresos'),sumEgresos:document.getElementById('sumEgresos'),
  sumBalance:document.getElementById('sumBalance'),historyEmpty:document.getElementById('historyEmpty'),
  tableWrapper:document.getElementById('tableWrapper'),historyBody:document.getElementById('historyBody'),
  exportCsvBtn:document.getElementById('exportCsvBtn'),exportExcelBtn:document.getElementById('exportExcelBtn'),
  auditSection:document.getElementById('auditSection'),auditBody:document.getElementById('auditBody'),
  toast:document.getElementById('toast'),
  confirmSaveModal:document.getElementById('confirmSaveModal'),confirmSaveDetails:document.getElementById('confirmSaveDetails'),
  confirmSaveCancelBtn:document.getElementById('confirmSaveCancelBtn'),confirmSaveOkBtn:document.getElementById('confirmSaveOkBtn'),
  providerSourceModal:document.getElementById('providerSourceModal'),providerSourceBody:document.getElementById('providerSourceBody'),
  choiceCajaBtn:document.getElementById('choiceCajaBtn'),choiceGuardadoBtn:document.getElementById('choiceGuardadoBtn'),
  balanceResultModal:document.getElementById('balanceResultModal'),balanceResultModalInner:document.getElementById('balanceResultModalInner'),
  balanceResultIcon:document.getElementById('balanceResultIcon'),balanceResultTitle:document.getElementById('balanceResultTitle'),
  balanceResultBody:document.getElementById('balanceResultBody'),balanceResultDetails:document.getElementById('balanceResultDetails'),
  balanceEditBtn:document.getElementById('balanceEditBtn'),balanceOkBtn:document.getElementById('balanceOkBtn'),
  pinModal:document.getElementById('pinModal'),pinModalBody:document.getElementById('pinModalBody'),
  pinInput:document.getElementById('pinInput'),pinError:document.getElementById('pinError'),
  pinCancelBtn:document.getElementById('pinCancelBtn'),pinConfirmBtn:document.getElementById('pinConfirmBtn'),
  editModal:document.getElementById('editModal'),editDate:document.getElementById('editDate'),
  editCaja:document.getElementById('editCaja'),editGuardado:document.getElementById('editGuardado'),
  editTransfer:document.getElementById('editTransfer'),editProveed:document.getElementById('editProveed'),
  editGastos:document.getElementById('editGastos'),editFuente:document.getElementById('editFuente'),
  editNotas:document.getElementById('editNotas'),editCancelBtn:document.getElementById('editCancelBtn'),
  editConfirmBtn:document.getElementById('editConfirmBtn'),
  deleteModal:document.getElementById('deleteModal'),cancelDeleteBtn:document.getElementById('cancelDeleteBtn'),
  confirmDeleteBtn:document.getElementById('confirmDeleteBtn')
};
let records=[],cuadroConfirmed=false,pendingSaveData=null,pendingSource=null,toastTimer=null,pinPendingAction=null,pendingEditId=null;
const numVal=(el)=>parseFloat(el.value)||0;
const numParse=(v)=>parseFloat(v)||0;
const fmt=(n)=>'$ '+(n||0).toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=(s)=>(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function fmtDate(iso){try{const d=new Date(iso);return d.toLocaleDateString('es-CO',{year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'}).toUpperCase();}catch{return iso||'—';}}
function fmtDateShort(iso){try{return new Date(iso).toLocaleDateString('es-CO',{year:'numeric',month:'2-digit',day:'2-digit'});}catch{return '—';}}
function toDatetimeLocal(iso){const d=new Date(iso);const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());}
function updateDateDisplay(){const now=new Date();const long=now.toLocaleDateString('es-CO',{weekday:'long',year:'numeric',month:'long',day:'numeric'});const short=now.toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'});els.headerDate.textContent=(long.charAt(0).toUpperCase()+long.slice(1)).toUpperCase();els.todayDate.textContent=short.toUpperCase();}
function setConnStatus(online){els.connDot.className='conn-dot '+(online?'online':'offline');els.connDot.title=online?'Conectado a Firebase':'Sin conexion (modo offline)';}
window.addEventListener('online',()=>setConnStatus(true));
window.addEventListener('offline',()=>setConnStatus(false));
setConnStatus(navigator.onLine);

function recalculate(){
  const caja=numVal(els.cajaChica),guardado=numVal(els.cajaFuerte),transfer=numVal(els.transferencias);
  const proveed=numVal(els.pagoProveedores),gastos=numVal(els.gastosPersonales);
  const ventas=caja+guardado+transfer,egresos=proveed+gastos,balance=ventas-egresos;
  els.totalIngresos.textContent=fmt(ventas);
  els.totalEgresos.textContent=fmt(egresos);
  els.balanceNeto.textContent=fmt(balance);
  els.balanceCard.classList.remove('positive','negative');
  if(ventas>0||egresos>0){
    els.balanceCard.classList.add(balance>=0?'positive':'negative');
    els.balanceHint.textContent=balance>=0?'VENTAS: '+fmt(ventas)+' · GUARDADO: '+fmt(guardado):'VENTAS: '+fmt(ventas)+' · DEFICIT: '+fmt(balance);
  }else{els.balanceHint.textContent='INGRESA LOS MONTOS PARA CALCULAR';}
}

function initConfirmChip(){
  const toggle=()=>{
    cuadroConfirmed=!cuadroConfirmed;
    els.confirmChip.classList.toggle('confirmed',cuadroConfirmed);
    els.confirmChip.setAttribute('aria-pressed',String(cuadroConfirmed));
    els.confirmCheckIcon.textContent=cuadroConfirmed?'✅':'○';
    els.confirmChipText.textContent=cuadroConfirmed?'CUADRE CONFIRMADO ✓':'¿CUADRO CON LO GUARDADO?';
    els.confirmChipHint.textContent=cuadroConfirmed?'Toca de nuevo para desmarcar':'TOCA AQUI PARA CONFIRMAR QUE CONTASTE EL GUARDADO';
    els.saveBtn.disabled=!cuadroConfirmed;
  };
  els.confirmChip.addEventListener('click',toggle);
  els.confirmChip.addEventListener('keydown',(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}});
}
function resetConfirmChip(){
  cuadroConfirmed=false;
  els.confirmChip.classList.remove('confirmed');
  els.confirmChip.setAttribute('aria-pressed','false');
  els.confirmCheckIcon.textContent='○';
  els.confirmChipText.textContent='¿CUADRO CON LO GUARDADO?';
  els.confirmChipHint.textContent='TOCA AQUI PARA CONFIRMAR QUE CONTASTE EL GUARDADO';
  els.saveBtn.disabled=true;
}

function handleFormSubmit(e){
  e.preventDefault();
  const proveed=numVal(els.pagoProveedores);
  pendingSaveData={caja:numVal(els.cajaChica),guardado:numVal(els.cajaFuerte),transfer:numVal(els.transferencias),proveed,gastos:numVal(els.gastosPersonales),notas:els.notas.value.trim()};
  if(proveed>PROV_THRESHOLD){
    els.providerSourceBody.innerHTML='PAGO A PROVEEDORES: <strong style="color:var(--red)">'+fmt(proveed)+'</strong><br>¿DE QUE FONDO SALDRA?';
    els.providerSourceModal.hidden=false;
  }else{pendingSource=proveed>0?'caja':null;showConfirmSaveModal();}
}
els.choiceCajaBtn.addEventListener('click',()=>{pendingSource='caja';els.providerSourceModal.hidden=true;showConfirmSaveModal();});
els.choiceGuardadoBtn.addEventListener('click',()=>{pendingSource='guardado';els.providerSourceModal.hidden=true;showConfirmSaveModal();});

function showConfirmSaveModal(){
  const d=pendingSaveData,ventas=d.caja+d.guardado+d.transfer,egresos=d.proveed+d.gastos,balance=ventas-egresos;
  const guardadoNeto=pendingSource==='guardado'?Math.max(0,d.guardado-d.proveed):d.guardado;
  const srcLbl=pendingSource==='guardado'?' (GUARDADO)':pendingSource==='caja'?' (CAJA)':'';
  els.confirmSaveDetails.innerHTML=
    '<div class="modal-detail-row"><span class="mdr-label">CAJA</span><span class="mdr-value green">'+fmt(d.caja)+'</span></div>'+
    '<div class="modal-detail-row"><span class="mdr-label">GUARDADO BRUTO</span><span class="mdr-value green">'+fmt(d.guardado)+'</span></div>'+
    '<div class="modal-detail-row"><span class="mdr-label">TRANSFERENCIAS</span><span class="mdr-value green">'+fmt(d.transfer)+'</span></div>'+
    '<div class="modal-detail-row"><span class="mdr-label">VENTAS TOTALES</span><span class="mdr-value blue">'+fmt(ventas)+'</span></div>'+
    '<div class="modal-detail-row"><span class="mdr-label">PROVEEDORES'+srcLbl+'</span><span class="mdr-value red">'+fmt(d.proveed)+'</span></div>'+
    '<div class="modal-detail-row"><span class="mdr-label">GASTOS VARIOS</span><span class="mdr-value red">'+fmt(d.gastos)+'</span></div>'+
    '<div class="modal-detail-row"><span class="mdr-label">GUARDADO NETO</span><span class="mdr-value gold">'+fmt(guardadoNeto)+'</span></div>'+
    '<div class="modal-detail-row"><span class="mdr-label">BALANCE NETO</span><span class="mdr-value '+(balance>=0?'green':'red')+'">'+fmt(balance)+'</span></div>';
  els.confirmSaveModal.hidden=false;
}
els.confirmSaveCancelBtn.addEventListener('click',()=>{els.confirmSaveModal.hidden=true;pendingSaveData=null;pendingSource=null;});
els.confirmSaveOkBtn.addEventListener('click',()=>{els.confirmSaveModal.hidden=true;doSaveRecord();});

async function doSaveRecord(){
  const d=pendingSaveData,ventas=d.caja+d.guardado+d.transfer,egresos=d.proveed+d.gastos;
  const guardadoNeto=pendingSource==='guardado'?Math.max(0,d.guardado-d.proveed):d.guardado;
  const record={createdAt:new Date().toISOString(),savedAt:firebase.firestore.FieldValue.serverTimestamp(),ventasEfectivo:0,
    cajaChica:d.caja,cajaFuerte:d.guardado,cajaFuerteNeto:guardadoNeto,transferencias:d.transfer,
    pagoProveedores:d.proveed,gastosPersonales:d.gastos,fuenteProveedores:pendingSource,
    totalIngresos:ventas,totalEgresos:egresos,ventasDia:ventas,guardadoNeto,balanceNeto:ventas-egresos,notas:d.notas};
  try{
    showToast('GUARDANDO EN FIREBASE...','info');
    await db.collection(COL_CIERRES).add(record);
    resetForm();pendingSaveData=null;pendingSource=null;
    showToast('CIERRE GUARDADO EN LA NUBE','success');
    setTimeout(()=>showBalanceResultModal(record),500);
  }catch(err){console.error(err);showToast('ERROR AL GUARDAR — VERIFICA CONEXION','error');}
}

function showBalanceResultModal(record){
  const ok=record.balanceNeto>=0;
  els.balanceResultModalInner.className=ok?'modal balance-result-ok':'modal balance-result-fail';
  els.balanceResultIcon.textContent=ok?'✅':'⚠️';
  els.balanceResultTitle.textContent=ok?'EL DIA CUADRO!':'REVISAR EL CIERRE';
  els.balanceResultBody.textContent=ok?'CIERRE POSITIVO. LOS MONTOS ESTAN CORRECTOS.':'BALANCE NEGATIVO. EDITA EL REGISTRO DESDE EL HISTORIAL.';
  els.balanceResultDetails.innerHTML=
    '<div class="modal-detail-row"><span class="mdr-label">CAJA</span><span class="mdr-value green">'+fmt(record.cajaChica)+'</span></div>'+
    '<div class="modal-detail-row"><span class="mdr-label">GUARDADO BRUTO</span><span class="mdr-value green">'+fmt(record.cajaFuerte)+'</span></div>'+
    '<div class="modal-detail-row"><span class="mdr-label">GUARDADO NETO</span><span class="mdr-value gold">'+fmt(record.guardadoNeto)+'</span></div>'+
    '<div class="modal-detail-row"><span class="mdr-label">TRANSFERENCIAS</span><span class="mdr-value green">'+fmt(record.transferencias)+'</span></div>'+
    '<div class="modal-detail-row"><span class="mdr-label">VENTAS TOTALES</span><span class="mdr-value blue">'+fmt(record.totalIngresos)+'</span></div>'+
    '<div class="modal-detail-row"><span class="mdr-label">TOTAL EGRESOS</span><span class="mdr-value red">'+fmt(record.totalEgresos)+'</span></div>'+
    '<div class="modal-detail-row"><span class="mdr-label">BALANCE NETO</span><span class="mdr-value '+(ok?'green':'red')+'">'+fmt(record.balanceNeto)+'</span></div>';
  els.balanceEditBtn.style.display='none';
  els.balanceOkBtn.textContent=ok?'PERFECTO — CERRAR':'CERRAR';
  els.balanceResultModal.hidden=false;
}
els.balanceOkBtn.addEventListener('click',()=>{els.balanceResultModal.hidden=true;});

function resetForm(){
  ['cajaChica','cajaFuerte','transferencias','pagoProveedores','gastosPersonales'].forEach(id=>{els[id].value='';});
  els.notas.value='';resetConfirmChip();recalculate();
}

function subscribeToFirestore(){
  db.collection(COL_CIERRES).orderBy('savedAt','desc').onSnapshot(
    (snap)=>{setConnStatus(true);records=snap.docs.map(doc=>({id:doc.id,...doc.data()}));renderHistory();},
    (err)=>{console.error(err);setConnStatus(false);showToast('ERROR DE CONEXION CON FIREBASE','error');}
  );
  db.collection(COL_AUDIT).orderBy('timestamp','desc').limit(50).onSnapshot(
    (snap)=>{renderAuditLog(snap.docs.map(d=>({id:d.id,...d.data()})));},
    ()=>{}
  );
}

function showPinModal(action,description){
  pinPendingAction=action;
  els.pinModalBody.textContent=description||'ESTA ACCION REQUIERE CONTRASENA.';
  els.pinInput.value='';els.pinError.textContent='';
  els.pinModal.hidden=false;
  setTimeout(()=>els.pinInput.focus(),200);
}
function closePinModal(){els.pinModal.hidden=true;pinPendingAction=null;els.pinInput.value='';els.pinError.textContent='';}
function verifyPin(){
  const entered=els.pinInput.value.trim();
  if(entered!==ADMIN_PIN){
    els.pinError.textContent='CONTRASENA INCORRECTA. INTENTA DE NUEVO.';
    els.pinInput.value='';els.pinInput.focus();return;
  }
  const action=pinPendingAction;closePinModal();
  if(!action)return;
  if(action.type==='delete')executeDelete(action.id);
  else if(action.type==='edit')openEditModal(action.id);
}
els.pinConfirmBtn.addEventListener('click',verifyPin);
els.pinCancelBtn.addEventListener('click',closePinModal);
els.pinInput.addEventListener('keydown',(e)=>{if(e.key==='Enter')verifyPin();});

function requestDelete(id){showPinModal({type:'delete',id},'INGRESA LA CONTRASENA PARA ELIMINAR ESTE REGISTRO.');}
async function executeDelete(id){
  const rec=records.find(r=>r.id===id);
  try{
    await db.collection(COL_AUDIT).add({action:'ELIMINACION',timestamp:firebase.firestore.FieldValue.serverTimestamp(),
      recordId:id,recordDate:rec?.createdAt||'',
      oldValues:rec?{totalIngresos:rec.totalIngresos,balanceNeto:rec.balanceNeto,cajaFuerte:rec.cajaFuerte,createdAt:rec.createdAt,notas:rec.notas}:{},
      newValues:null});
    await db.collection(COL_CIERRES).doc(id).delete();
    showToast('REGISTRO ELIMINADO Y AUDITADO','error');
  }catch(err){console.error(err);showToast('ERROR AL ELIMINAR — VERIFICA CONEXION','error');}
}

function requestEdit(id){showPinModal({type:'edit',id},'INGRESA LA CONTRASENA PARA EDITAR. PUEDES CAMBIAR LA FECHA SI LO OLVIDASTE AYER.');}
function openEditModal(id){
  const rec=records.find(r=>r.id===id);
  if(!rec){showToast('REGISTRO NO ENCONTRADO','warn');return;}
  pendingEditId=id;
  els.editDate.value=toDatetimeLocal(rec.createdAt);
  els.editCaja.value=rec.cajaChica??'';els.editGuardado.value=rec.cajaFuerte??'';
  els.editTransfer.value=rec.transferencias??'';els.editProveed.value=rec.pagoProveedores??'';
  els.editGastos.value=rec.gastosPersonales??'';els.editFuente.value=rec.fuenteProveedores||'';
  els.editNotas.value=rec.notas||'';
  els.editModal.hidden=false;
}
async function saveEditRecord(){
  if(!pendingEditId)return;
  const rec=records.find(r=>r.id===pendingEditId);if(!rec)return;
  const fechaInput=els.editDate.value;
  if(!fechaInput){showToast('DEBES INGRESAR UNA FECHA VALIDA','warn');return;}
  const caja=numParse(els.editCaja.value),guardado=numParse(els.editGuardado.value),transfer=numParse(els.editTransfer.value);
  const proveed=numParse(els.editProveed.value),gastos=numParse(els.editGastos.value),fuente=els.editFuente.value||null;
  const ventas=caja+guardado+transfer,egresos=proveed+gastos;
  const guardadoNeto=fuente==='guardado'?Math.max(0,guardado-proveed):guardado;
  const updates={
    createdAt:new Date(fechaInput).toISOString(),cajaChica:caja,cajaFuerte:guardado,cajaFuerteNeto:guardadoNeto,
    transferencias:transfer,pagoProveedores:proveed,gastosPersonales:gastos,fuenteProveedores:fuente,
    totalIngresos:ventas,totalEgresos:egresos,ventasDia:ventas,guardadoNeto,balanceNeto:ventas-egresos,
    notas:els.editNotas.value.trim(),editedAt:firebase.firestore.FieldValue.serverTimestamp()
  };
  try{
    await db.collection(COL_AUDIT).add({action:'EDICION',timestamp:firebase.firestore.FieldValue.serverTimestamp(),
      recordId:pendingEditId,recordDate:rec.createdAt,
      oldValues:{totalIngresos:rec.totalIngresos,balanceNeto:rec.balanceNeto,cajaFuerte:rec.cajaFuerte,createdAt:rec.createdAt},
      newValues:{totalIngresos:ventas,balanceNeto:ventas-egresos,cajaFuerte:guardado,createdAt:updates.createdAt}});
    await db.collection(COL_CIERRES).doc(pendingEditId).update(updates);
    els.editModal.hidden=true;pendingEditId=null;
    showToast('REGISTRO ACTUALIZADO EN LA NUBE','success');
  }catch(err){console.error(err);showToast('ERROR AL ACTUALIZAR — VERIFICA CONEXION','error');}
}
els.editConfirmBtn.addEventListener('click',saveEditRecord);
els.editCancelBtn.addEventListener('click',()=>{els.editModal.hidden=true;pendingEditId=null;});

function renderHistory(){
  const totI=records.reduce((s,r)=>s+(r.totalIngresos||0),0);
  const totE=records.reduce((s,r)=>s+(r.totalEgresos||0),0);
  const totG=records.reduce((s,r)=>{
    let g;if(r.cajaFuerteNeto!==undefined){g=r.cajaFuerteNeto;}
    else if(r.fuenteProveedores==='guardado'){g=Math.max(0,(r.cajaFuerte||0)-(r.pagoProveedores||0));}
    else{g=r.cajaFuerte||0;}return s+g;
  },0);
  els.sumIngresos.textContent=fmt(totI);els.sumEgresos.textContent=fmt(totE);
  els.sumBalance.textContent=fmt(totG);els.sumBalance.style.color='var(--cyan)';
  if(records.length===0){
    els.historyEmpty.hidden=false;els.tableWrapper.hidden=true;
    const p=els.historyEmpty.querySelector('p');if(p)p.textContent='AUN NO HAY REGISTROS.';
  }else{
    els.historyEmpty.hidden=true;els.tableWrapper.hidden=false;els.historyBody.innerHTML='';
    records.forEach((r,idx)=>{
      const tr=document.createElement('tr');tr.style.animationDelay=Math.min(idx*25,300)+'ms';
      const balClass=r.balanceNeto>=0?'positive':'negative';
      const srcLabel=r.fuenteProveedores==='caja'?'<span class="source-badge source-caja">CAJA</span>':r.fuenteProveedores==='guardado'?'<span class="source-badge source-guardado">GUARDADO</span>':'<span style="color:var(--text-40);font-size:10px">—</span>';
      const ventas=r.totalIngresos||((r.cajaChica||0)+(r.cajaFuerte||0)+(r.transferencias||0));
      const gNeto=r.cajaFuerteNeto!==undefined?r.cajaFuerteNeto:(r.fuenteProveedores==='guardado'?Math.max(0,(r.cajaFuerte||0)-(r.pagoProveedores||0)):(r.cajaFuerte||0));
      const gDisplay=r.fuenteProveedores==='guardado'
        ?'<span style="text-decoration:line-through;opacity:.5;font-size:10px">'+fmt(r.cajaFuerte||0)+'</span><br><span style="color:var(--gold);font-size:12px;font-weight:900">'+fmt(gNeto)+'</span>'
        :fmt(r.cajaFuerte||0);
      const editMark=r.editedAt?'<span style="font-size:9px;color:var(--gold);display:block">✏️ EDITADO</span>':'';
      tr.innerHTML='<td class="td-date">'+fmtDate(r.createdAt)+editMark+'</td>'+
        '<td class="td-income">'+fmt(r.cajaChica)+'</td>'+
        '<td class="td-income">'+gDisplay+'</td>'+
        '<td class="td-income">'+fmt(r.transferencias)+'</td>'+
        '<td class="td-income" style="font-weight:900">'+fmt(ventas)+'</td>'+
        '<td class="td-expense">'+fmt(r.pagoProveedores)+'</td>'+
        '<td class="td-expense">'+fmt(r.gastosPersonales)+'</td>'+
        '<td class="td-balance '+balClass+'">'+fmt(r.balanceNeto)+'</td>'+
        '<td>'+srcLabel+'</td>'+
        '<td class="td-notes" title="'+esc(r.notas)+'">'+( esc(r.notas)||'<em style="opacity:.35">—</em>' )+'</td>'+
        '<td class="td-actions">'+
          '<button class="btn-row-action btn-row-edit" data-id="'+r.id+'" title="EDITAR (requiere clave)">✏️</button>'+
          '<button class="btn-row-action btn-row-delete" data-id="'+r.id+'" title="ELIMINAR (requiere clave)">🗑️</button>'+
        '</td>';
      els.historyBody.appendChild(tr);
    });
  }
}
els.historyBody.addEventListener('click',(e)=>{
  const eb=e.target.closest('.btn-row-edit'),db2=e.target.closest('.btn-row-delete');
  if(eb)requestEdit(eb.dataset.id);if(db2)requestDelete(db2.dataset.id);
});

function renderAuditLog(logs){
  if(!logs||logs.length===0){els.auditSection.style.display='none';return;}
  els.auditSection.style.display='block';els.auditBody.innerHTML='';
  logs.forEach(a=>{
    const tr=document.createElement('tr');
    const cls=a.action==='ELIMINACION'?'audit-action-delete':'audit-action-edit';
    let det=a.action==='ELIMINACION'
      ?'Ventas: '+fmt(a.oldValues?.totalIngresos)
      :'Balance: '+fmt(a.oldValues?.balanceNeto)+' → '+fmt(a.newValues?.balanceNeto)+(a.newValues?.createdAt?' | Fecha: '+fmtDateShort(a.newValues.createdAt):'');
    const ts=a.timestamp?.toDate?fmtDate(a.timestamp.toDate().toISOString()):'—';
    const rd=a.recordDate?fmtDateShort(a.recordDate):'—';
    tr.innerHTML='<td><span class="'+cls+'">'+a.action+'</span></td>'+
      '<td style="white-space:nowrap;font-size:10px">'+ts+'</td>'+
      '<td style="font-size:10px;color:var(--text-65)">'+rd+'</td>'+
      '<td style="font-size:10px">'+det+'</td>';
    els.auditBody.appendChild(tr);
  });
}

function exportCSV(){
  if(records.length===0){showToast('NO HAY REGISTROS PARA EXPORTAR','info');return;}
  const headers=['FECHA','CAJA','GUARDADO BRUTO','GUARDADO NETO','TRANSFERENCIAS BANCARIAS','VENTAS TOTALES','PAGO A PROVEEDORES','GASTOS VARIOS','FUENTE DE PAGO','BALANCE NETO','NOTAS'];
  const rows=records.map(r=>{
    const ventas=r.totalIngresos||((r.cajaChica||0)+(r.cajaFuerte||0)+(r.transferencias||0));
    const gNeto=r.cajaFuerteNeto!==undefined?r.cajaFuerteNeto:(r.fuenteProveedores==='guardado'?Math.max(0,(r.cajaFuerte||0)-(r.pagoProveedores||0)):(r.cajaFuerte||0));
    const fuente=r.fuenteProveedores==='caja'?'CAJA':r.fuenteProveedores==='guardado'?'GUARDADO':'-';
    return[fmtDate(r.createdAt),r.cajaChica||0,r.cajaFuerte||0,gNeto,r.transferencias||0,ventas,r.pagoProveedores||0,r.gastosPersonales||0,fuente,r.balanceNeto||0,'"'+(r.notas||'').replace(/"/g,'""')+'"'];
  });
  const csv='\uFEFF'+[headers,...rows].map(row=>row.join(';')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);const link=document.createElement('a');
  link.href=url;link.download='SILVA-HERRERA-'+new Date().toLocaleDateString('es-CO').replace(/\//g,'-')+'.csv';
  document.body.appendChild(link);link.click();document.body.removeChild(link);URL.revokeObjectURL(url);
  showToast('EXCEL EXPORTADO CORRECTAMENTE','success');
}

function showToast(msg,type='info'){
  clearTimeout(toastTimer);els.toast.textContent=msg;els.toast.className='toast '+type+' show';
  toastTimer=setTimeout(()=>els.toast.classList.remove('show'),3600);
}

function bindEvents(){
  document.querySelectorAll('.form-input[type="number"]').forEach(inp=>inp.addEventListener('input',recalculate));
  document.getElementById('cashForm').addEventListener('submit',handleFormSubmit);
  els.clearFormBtn.addEventListener('click',()=>{resetForm();showToast('FORMULARIO LIMPIADO','info');});
  els.exportCsvBtn.addEventListener('click',exportCSV);els.exportExcelBtn.addEventListener('click',exportCSV);
  document.addEventListener('keydown',(e)=>{
    if(e.key!=='Escape')return;
    [els.confirmSaveModal,els.balanceResultModal,els.providerSourceModal,els.editModal].forEach(m=>{if(m&&!m.hidden)m.hidden=true;});
    if(!els.pinModal.hidden)closePinModal();
  });
  [els.balanceResultModal,els.editModal].forEach(m=>{if(m)m.addEventListener('click',(e)=>{if(e.target===m)m.hidden=true;});});
}

function init(){updateDateDisplay();initConfirmChip();bindEvents();subscribeToFirestore();setInterval(updateDateDisplay,60000);}
document.addEventListener('DOMContentLoaded',init);
