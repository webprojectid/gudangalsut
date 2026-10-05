/* Shared with the isolated preview. The database remains authoritative. */
(function(){
  'use strict';
  const deny=(code,error)=>({allowed:false,code,error});
  function policy(item,{entries=0,history=0}={}){
    if(!item)return deny('NOT_FOUND','Barang tidak ditemukan.');
    if(item.deleted_at)return deny('ALREADY_DELETED','Barang sudah dihapus dari inventaris aktif.');
    if(entries)return deny('HAS_TRANSACTIONS','Barang memiliki riwayat transaksi atau peminjaman. Delete ditolak.');
    if(history)return deny('HAS_HISTORY','Barang memiliki riwayat operasional. Delete ditolak.');
    if(['masuk_peminjaman','keluar_peminjaman','masuk_baru','rusak','permanen'].some(key=>Number(item[key]||0)!==0)||/^sudah\b/i.test(item.last_opname_date||''))return deny('HAS_MOVEMENT','Barang sudah digunakan, rusak, keluar, atau diperiksa lewat opname.');
    return {allowed:true};
  }
  function validate(item,input,username){
    if(!input.reason||input.reason.trim().length<12||input.reason.trim().length>600)return deny('VALIDATION','Isi alasan delete, minimal 12 dan maksimal 600 karakter.');
    if(input.name.trim()!==item.nama_barang||input.code.trim()!==item.kode_barang)return deny('IDENTITY_MISMATCH','Ketik nama dan kode barang sesuai data yang ditampilkan.');
    if(input.username.trim()!==username||!input.password)return deny('INVALID_CREDENTIALS','Isi username akun yang sedang login dan password.');
    return {allowed:true};
  }
  window.csmMasterDeletePolicy={policy,validate};
})();
