/* Reauthentication is sent only for this operation, never stored in browser state. */
'use strict';
let masterDeleteOpenSequence=0;
async function openMasterDelete(code){
  if(!isAdmin())return showToast('Hanya administrator yang dapat menghapus master.','error');
  const sequence=++masterDeleteOpenSequence,request=++workspace.detailRequest,user=appState.currentUser;workspace.detailPending=true;
  const end=window.csmMotion?.begin(document.activeElement?.closest('button'))||(()=>{});
  try{
    const rows=await sbGet('master_barang',`select=*&kode_barang=eq.${encodeURIComponent(code)}&order=id.asc`);
    if(sequence!==masterDeleteOpenSequence||request!==workspace.detailRequest||user!==appState.currentUser||!document.getElementById('page-masterBarang').classList.contains('active'))return;
    const item=rows.find(row=>row.kode_barang===code);
    if(!item)return showToast('Barang tidak ditemukan. Muat ulang daftar.','error');
    const overlay=mountWorkspaceOverlay(`<section class="delete-panel"><header class="row-between"><span class="eyebrow"><i class="fas fa-shield-halved"></i> DELETE TERLINDUNGI</span><button type="button" class="btn-icon-ghost" onclick="closeWorkspaceOverlay()" aria-label="Tutup delete"><i class="fas fa-xmark"></i></button></header><h2>Hapus master barang</h2><div class="delete-identity"><strong>${esc(item.nama_barang)}</strong><span>${esc(item.kode_barang)} · ${esc(locationLabel(item.lokasi_barang))}</span></div><p class="delete-explainer">${numberValue(item.tersedia)} unit akan dikeluarkan dari inventaris aktif. Data asli disimpan dalam arsip audit. Barang dengan riwayat transaksi atau opname akan ditolak.</p><form id="masterDeleteForm" autocomplete="off"><fieldset><legend><b>01</b> Alasan delete</legend><label for="deleteReason">Jelaskan duplikat atau kesalahan input</label><textarea id="deleteReason" required minlength="12" maxlength="600" rows="2" placeholder="Contoh: Master terinput dua kali untuk barang yang sama."></textarea></fieldset><fieldset><legend><b>02</b> Ketik identitas barang</legend><label for="deleteName">Nama barang, persis seperti di atas</label><input id="deleteName" required autocomplete="off" spellcheck="false"><label for="deleteCode">Kode barang</label><input id="deleteCode" required autocomplete="off" spellcheck="false"></fieldset><fieldset><legend><b>03</b> Konfirmasi akun admin</legend><label for="deleteUsername">Username akun yang sedang login</label><input id="deleteUsername" required autocomplete="off" spellcheck="false"><label for="deletePassword">Password</label><input id="deletePassword" type="password" required autocomplete="new-password" maxlength="1024"></fieldset><p id="deleteFeedback" class="delete-feedback" role="status" aria-live="polite"></p><footer class="row-between"><button type="button" class="btn btn-ghost" onclick="closeWorkspaceOverlay()">Batal</button><button type="submit" class="btn delete-submit"><i class="fas fa-trash-can"></i> Verifikasi & hapus</button></footer></form></section>`,'detail',`Hapus master ${code}`);
    const form=overlay.querySelector('form'),feedback=form.querySelector('#deleteFeedback');
    const requestId=crypto.randomUUID();let pending=false;
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(pending)return;
      if(!isAdmin()||appState.currentUser!==user)return closeWorkspaceOverlay({immediate:true});
      const input={reason:form.deleteReason?.value||form.querySelector('#deleteReason').value,name:form.querySelector('#deleteName').value,code:form.querySelector('#deleteCode').value,username:form.querySelector('#deleteUsername').value,password:form.querySelector('#deletePassword').value};
      const check=csmMasterDeletePolicy.validate(item,input,user.username);
      if(!check.allowed){feedback.textContent=check.error;window.csmMotion?.pulse(form,'error');return;}
      pending=true;overlay.dataset.deletePending='true';
      ['#deleteReason','#deleteName','#deleteCode'].forEach(selector=>form.querySelector(selector).readOnly=true);feedback.textContent='Memverifikasi akun, riwayat, dan data terbaru…';
      const controls=[...overlay.querySelectorAll('input,textarea,button')];controls.forEach(el=>el.disabled=true);
      form.querySelector('#deletePassword').value='';
      let receivedOutcome=false;const finish=window.csmMotion?.begin(form)||(()=>{});const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
      try{
        const response=await edgeFetch(EDGE_URL+'/api-proxy',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json','x-session-token':sessionToken||''},body:JSON.stringify({action:'delete_master_guarded',table:'master_barang',data:{id:item.id,expected:item,requestId,...input,username:input.username.trim(),reason:input.reason.trim()}})});
        input.password='';const outcome=await response.json();receivedOutcome=true;
        if(!response.ok||!outcome.success)throw new Error(outcome.error||'Delete ditolak oleh backend.');
        workspace.removedMasterCodes.add(code);invalidateTableCache('master_barang');invalidateTableCache('log');
        for(const key of ['masterBarang','stockGudang','namaBarangList'])if(Array.isArray(appState[key]))appState[key]=appState[key].filter(row=>(row.kode_barang||row.kode)!==code);
        workspace.master=workspace.master.filter(row=>(row.kode_barang||row.kode)!==code);workspace.dashboardFingerprint='';
        if(typeof masterEditMode!=='undefined'&&masterEditMode?.kode_barang===code)cancelMasterEdit();
        if(user!==appState.currentUser)return;
        renderMasterBarang();if(document.getElementById('workspaceOverlay')===overlay)closeWorkspaceOverlay({immediate:true});
        showToast('Master dihapus dari inventaris aktif. Arsip dan log tersimpan.','success');
        loadMasterBarang();
      }catch(error){
        input.password='';if(user===appState.currentUser&&overlay.isConnected)feedback.textContent=!receivedOutcome?'Koneksi terputus. Status belum diketahui. Isi password lalu ulangi verifikasi; permintaan yang sama tidak menghapus dua kali.':error.message;
        if(overlay.isConnected)window.csmMotion?.pulse(feedback,'error');
      }finally{clearTimeout(timer);finish();pending=false;overlay.dataset.deletePending='false';controls.forEach(el=>el.disabled=false);}
    });
    // Trap keyboard focus inside the dialog, including Shift+Tab.
    overlay.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const nodes=[...overlay.querySelectorAll('button,input,textarea')].filter(el=>!el.disabled);if(!nodes.length){event.preventDefault();return;}const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});
  }catch{if(user===appState.currentUser)showToast('Data belum berhasil dimuat. Delete tidak dilakukan.','error');}finally{if(request===workspace.detailRequest)workspace.detailPending=false;end();}
}

function confirmAdminCredentials(title){
  if(!isAdmin())return Promise.resolve(null);
  const user=appState.currentUser;
  const overlay=mountWorkspaceOverlay(`<section class="delete-panel reauth-panel"><header class="row-between"><span class="eyebrow"><i class="fas fa-shield-halved"></i> VERIFIKASI ADMIN</span><button type="button" class="btn-icon-ghost" onclick="closeWorkspaceOverlay()" aria-label="Tutup verifikasi"><i class="fas fa-xmark"></i></button></header><h2>${esc(title)}</h2><p class="delete-explainer">Ketik akun admin yang sedang login untuk mengonfirmasi tindakan ini.</p><form autocomplete="off"><label for="adminProofUsername">Username admin</label><input id="adminProofUsername" required autocomplete="off"><label for="adminProofPassword">Password admin</label><input id="adminProofPassword" type="password" required autocomplete="new-password" maxlength="1024"><p class="delete-feedback" role="status"></p><footer class="row-between"><button type="button" class="btn btn-ghost" onclick="closeWorkspaceOverlay()">Batal</button><button type="submit" class="btn btn-primary">Konfirmasi akun</button></footer></form></section>`,'detail',title);
  return new Promise(resolve=>{
    workspace.overlayResolve=resolve;
    overlay.querySelector('form').onsubmit=event=>{
      event.preventDefault();if(user!==appState.currentUser||!isAdmin()){closeWorkspaceOverlay();return;}
      const username=overlay.querySelector('#adminProofUsername').value.trim(),input=overlay.querySelector('#adminProofPassword');
      if(username!==user.username||!input.value){overlay.querySelector('.delete-feedback').textContent='Username harus sesuai akun yang sedang login.';window.csmMotion?.pulse(overlay.firstElementChild,'error');return;}
      const credentials={adminUsername:username,adminPassword:input.value};input.value='';workspace.overlayResolve=null;closeWorkspaceOverlay({immediate:true});resolve(credentials);
    };
    overlay.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const nodes=[...overlay.querySelectorAll('button,input')],first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});
  });
}
