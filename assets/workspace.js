/* Workspace presentation. Operational writes remain in index.html. */
'use strict';
const workspace = {
    master: [], entries: [], logs: [], dashboardRequest: 0, dashboardInitialized: false,
    inventory: { master: { page: 1, view: 'list' }, stock: { page: 1, view: 'list' } },
    photos: {}, photoCatalogReady: null, localPhotos: {}, overlayFocus: null, pendingOpnameLocation: null,
    removedMasterCodes: new Set(), detailRequest: 0, detailPending: false, dashboardFingerprint: '', renderedPeriod: '', ticketAgeFilter: 0
};
function activeMasterRows(rows){return (Array.isArray(rows)?rows:[]).filter(row=>!row.deleted_at&&!workspace.removedMasterCodes.has(row.kode_barang||row.kode));}
const categoryRules = [
    ['Kabel', 'cable', /kabel|cable|\butp\b|patch cord/i],
    ['Converter', 'adapter', /converter|konverter|splitter|dongle|hub usb/i],
    ['Jaringan', 'router', /\bswitch\b|router|access point|mikrotik|modem/i],
    ['Adaptor', 'adapter', /adaptor|adapter|charger|power supply/i],
    ['Monitor', 'monitor', /monitor|display|lcd|televisi|\btv\b/i],
    ['Komputer', 'laptop', /laptop|notebook|macbook|komputer|computer|desktop|cpu|thinkpad|ipad|tablet|mini\s*pc|thin\s*client|imac|\bpc\b/i],
    ['Kamera', 'camera', /kamera|camera|webcam|canon|nikon/i],
    ['Audio', 'audio', /mic|speaker|headphone|audio|sound/i],
    ['Periferal', 'keyboard', /keyboard|mouse|printer|scanner/i],
    ['Penyimpanan & RAM', 'box', /\bhdd\b|\bssd\b|hard[\s-]*(?:disk|drive)|flashdisk|flash drive|\bram\b|dimm|v-gen/i],
    ['Komunikasi', 'box', /\bht\b|\bicom\b|walkie.?talkie/i],
    ['Peralatan', 'box', /tripod|stand|bracket|tool|tang|\bbor\b|screwdriver|cutter|gunting|glue gun|vacuum|blower/i],
    ['Perlengkapan', 'box', /sticky note|folder|bantex|pulpen|spidol|steples|stepler|stapler|label|lakban|tape|cleaner|pembersih|kain majun|storage box/i]
];
const categoryPhotos = {
    monitor: { url: 'assets/products/monitor-photo.png', author: 'IT Photography', source: 'https://commons.wikimedia.org/wiki/File:Dell_Computer_Monitor.png' }
};
function locationLabel(value) {
    return String(value||'').replace(/\b(?:binus(?:\s+alam\s+sutera)?|alam\s+sutera|alsut)\b/gi,'').replace(/\s+/g,' ').trim()||'Gudang CSM';
}
function itemCategory(item) {
    const text = `${item.nama_barang || item.nama || ''} ${item.kode_barang || item.kode || ''}`;
    const rule = categoryRules.find(r => r[2].test(text));
    return rule ? { name: rule[0], asset: rule[1] } : { name: 'Lainnya', asset: 'box' };
}
function normalizedPhotoName(name) {
    return String(name || '')
        .replace(/\s*\|?\s*8C[A-Z0-9]+\s*$/i, '')
        .replace(/\s*\([^)]*(?:khusus peminjaman|ori acer)[^)]*\)/gi, '')
        .replace(/\s*-\s*\d{1,3}(?:\s*\(biru\))?\s*$/i, '')
        .replace(/\s+/g, ' ').trim().toLowerCase();
}
function itemPhotoInfo(item) {
    const code = item.kode_barang || item.kode || '', catalog = workspace.photos;
    if (workspace.localPhotos[code]) return { src: workspace.localPhotos[code], kind: 'preview' };
    // Existing code-to-path files remain valid for user-supplied asset photos.
    if (typeof catalog[code] === 'string') return { src: catalog[code], kind: 'asset' };
    const rawName = String(item.nama_barang || item.nama || '').replace(/\s+/g,' ').trim().toLowerCase();
    const name = normalizedPhotoName(rawName), codeEntry = catalog.byCode?.[code];
    const id = catalog.byName?.[rawName] || catalog.byName?.[name] || (!name || codeEntry?.name === name ? codeEntry?.id : null);
    const model = catalog.models?.[id];
    if (model?.src) return { ...model, id };
    const category = itemCategory(item), photo = categoryPhotos[category.asset];
    return { src: photo?.url || `assets/products/${category.asset}.svg`, kind: 'category',
        title: category.name, source: photo?.source, author: photo?.author };
}
function itemPhoto(item) { return itemPhotoInfo(item).src; }
function handleProductImageError(img) {
    if (img.dataset.photoFailed === '1') return;
    img.dataset.photoFailed = '1'; img.dataset.photoKind = 'category'; img.src = img.dataset.fallback;
}
function refreshProductImages() {
    document.querySelectorAll('img[data-product-name]').forEach(img => {
        const photo = itemPhotoInfo({ kode_barang: img.dataset.productCode, nama_barang: img.dataset.productName });
        if (img.getAttribute('src') !== photo.src) {
            delete img.dataset.photoFailed; img.dataset.photoKind = photo.kind; img.src = photo.src;
        }
    });
}
function productImage(item, className = 'product-image') {
    const fallback = `assets/products/${itemCategory(item).asset}.svg`;
    const name = item.nama_barang || item.nama || '', photo = itemPhotoInfo(item);
    return `<img class="${className}" src="${esc(photo.src)}" data-product-code="${esc(item.kode_barang || item.kode || '')}" data-product-name="${esc(name)}" data-photo-kind="${esc(photo.kind)}" data-fallback="${fallback}" alt="${esc(name || 'Barang')}" loading="lazy" decoding="async" onerror="handleProductImageError(this)">`;
}
function productPhotoNote(item) {
    const photo = itemPhotoInfo(item);
    const label = { model: 'Foto referensi model', reference: 'Referensi jenis produk',
        asset: 'Foto aset', preview: 'Foto pratinjau sesi ini', category: `Visual kategori ${itemCategory(item).name}` }[photo.kind];
    const source = photo.source ? `<a href="${esc(photo.source)}" target="_blank" rel="noopener noreferrer">Sumber foto${photo.author ? ` · ${esc(photo.author)}` : ''}</a>` : '';
    const license = photo.author ? ' · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>' : '';
    return `<p class="photo-note">${esc(label)}${source ? ` · ${source}${license}` : ''}${photo.requiresConfirmation?' · Nama barang perlu dikonfirmasi':''}</p>`;
}
function itemButton(item) {
    return `<button class="inventory-product" data-code="${esc(item.kode_barang)}" onclick="openAssetDetail(this.dataset.code)">${productImage(item)}<span><strong>${esc(item.nama_barang || 'Tanpa nama')}</strong><small>${esc(item.kode_barang)} · ${esc(itemCategory(item).name)}</small></span></button>`;
}
function numberValue(n) { return Math.max(0, Number(n) || 0); }
function itemStatus(item) {
    const qty = numberValue(item.tersedia), min = numberValue(item.stok_paten);
    if (!qty) return { label: 'Stok habis', tone: 'warning', key: 'habis' };
    if (min && qty < min) return { label: 'Stok rendah', tone: 'danger', key: 'low' };
    return { label: 'Tersedia', tone: 'success', key: 'ready' };
}
function statusBadge(item) { const status = itemStatus(item); return `<span class="badge badge-${status.tone}">${status.label}</span>`; }
function emptyState(title, subtitle = '') { return `<div class="empty-state"><i class="fas fa-box-open"></i><strong>${esc(title)}</strong><p>${esc(subtitle)}</p></div>`; }
function recordDate(value) {
    if(!value)return null;
    const text=String(value),local=text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:\s|$)/);
    if(local){const [,day,month,year]=local.map(Number),date=new Date(year,month-1,day);return date.getDate()===day&&date.getMonth()===month-1&&date.getFullYear()===year?date:null;}
    const date=new Date(text);return Number.isNaN(date.getTime())?null:date;
}
function isInPeriod(row, period) { const d = recordDate(row.tanggal); return d && d >= period.start && d < period.end; }
function ticketAge(value) { const d = recordDate(value); return d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000)) : null; }
function setText(id, value) {
    const el=document.getElementById(id);if(!el)return;
    const motion=typeof window!=='undefined'&&window.csmMotion;
    if(motion&&/^dash/.test(id)&&(el.matches('.metric-value,strong')||['dashMovementTotal','dashTrendTotal'].includes(id)))motion.metric(el,value);
    else if(motion?.text&&['dashPeriodCaption','dashHeatmapMonth','dashTrendRange','dashPopularCaption'].includes(id))motion.text(el,value);
    else el.textContent=value;
}

async function loadDashboard(options = {}) {
    const request = ++workspace.dashboardRequest;
    const user=appState.currentUser;
    const end = window.csmMotion?.begin(document.getElementById('page-dashboard')) || (()=>{});
    let period=getDashboardPeriod(),motion;
    const key=window.csmPeriodMotion?.keyOf(period);
    if(options.periodChange||!workspace.renderedPeriod||key!==workspace.renderedPeriod)motion=window.csmPeriodMotion?.begin(period,{previous:workspace.renderedPeriod,direction:options.direction});
    try {
    const name = (appState.currentUser?.nama_lengkap || appState.currentUser?.username || '').split(' ')[0];
    const hour = new Date().getHours();
    setText('dashboardGreeting', `${hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam'}, ${name || 'tim'}!`);
    window.csmReadState?.watch('dashboardMaster','master_barang','select=*&order=kode_barang.asc',loadDashboard);
    window.csmReadState?.watch('dashboardEntries','data_entry','select=*&order=id.desc',loadDashboard);
    const result = await Promise.allSettled([
        sbGetSWR('master_barang', 'select=*&order=kode_barang.asc', dashboardRevalidate),
        sbGetSWR('data_entry', 'select=*&order=id.desc', dashboardRevalidate),
        sbGetSWR('log', 'select=*&order=id.desc&limit=8')
    ]);
    if (request !== workspace.dashboardRequest || user!==appState.currentUser) return;
    if (result[0].status !== 'fulfilled' || result[1].status !== 'fulfilled') {
        motion?.error();showToast('Gagal memuat dashboard', 'error'); return;
    }
    workspace.master = activeMasterRows(result[0].value);
    workspace.entries = Array.isArray(result[1].value) ? result[1].value : [];
    workspace.logs = result[2].status === 'fulfilled' && Array.isArray(result[2].value) ? result[2].value : [];
    if (!workspace.dashboardInitialized) {
        workspace.dashboardInitialized = true;
        const latest = workspace.entries.map(row=>recordDate(row.tanggal)).filter(date=>date&&date<=new Date()).sort((a,b)=>b-a)[0];
        if (latest && !workspace.entries.some(row=>isInPeriod(row,period))) {
            document.getElementById('dashboardMonth').value = `${latest.getFullYear()}-${String(latest.getMonth()+1).padStart(2,'0')}`;
            period = getDashboardPeriod();
        }
    }
    const render=()=>renderDashboard(period);
    if(motion)motion.commit(render,period);else render();
    workspace.renderedPeriod=window.csmPeriodMotion?.keyOf(period)||'';
    } catch(error) {
        if(request===workspace.dashboardRequest&&user===appState.currentUser){motion?.error();showToast('Gagal memuat dashboard','error');console.error(error);}
    } finally { end(); }
}
function dashboardRevalidate() { if (appState.currentUser&&document.getElementById('appContainer').classList.contains('active')&&document.getElementById('page-dashboard').classList.contains('active')) loadDashboard(); }
function renderDashboard(period) {
    const master = workspace.master, entries = workspace.entries;
    const fingerprint=JSON.stringify([period.label,master,entries]);
    if(fingerprint===workspace.dashboardFingerprint)return;
    const current = entries.filter(row => isInPeriod(row, period));
    const active = entries.filter(row => Number(row.kode_mutasi) === 2);
    const tickets = new Set(active.map(row => row.nomor_tiket || `row-${row.id}`));
    const available = master.reduce((sum, row) => sum + numberValue(row.tersedia), 0);
    const done = master.filter(row => /^sudah\b/i.test(String(row.last_opname_date || '').trim())).length;
    const percent = master.length ? Math.round(done / master.length * 100) : 0;
    setText('dashTotalSku', formatNum(master.length)); setText('dashAvailable', formatNum(available));
    setText('dashBorrowed', formatNum(tickets.size)); setText('dashActiveCaption', `${formatNum(active.reduce((s,r) => s + numberValue(r.qty), 0))} unit dalam pinjaman`);
    setText('dashTransactions', formatNum(new Set(current.map(r => r.nomor_tiket || `row-${r.id}`)).size));
    setText('dashPeriodCaption', period.label); setText('dashOpnamePercent', `${percent}%`);
    setText('dashOpnameDone', `${formatNum(done)} barang`); setText('dashOpnameRemaining', `${formatNum(master.length - done)} barang`);
    const notice = document.getElementById('dashboardEmptyPeriod'); notice.hidden = current.length > 0;
    const latest = entries.map(r => recordDate(r.tanggal)).filter(d => d && d <= new Date()).sort((a,b) => b-a)[0];
    notice.innerHTML = `<span><i class="far fa-calendar"></i> Belum ada transaksi pada ${esc(period.label)}.</span>${latest ? '<button class="btn btn-ghost btn-sm" onclick="goLatestDashboardPeriod()">Lihat periode terakhir aktif <i class="fas fa-arrow-right"></i></button>' : ''}`;
    setText('chartPeriodNote', `${period.label} · Berdasarkan tanggal dan status transaksi saat ini. Tanggal pengembalian tidak dicatat terpisah.`);
    renderDashboardCharts(current, period, done, master.length, master);
    renderDashboardAnalytics(buildDashboardAnalytics(master, entries, period));
    workspace.dashboardFingerprint=fingerprint;
    window.csmStoryMotion?.refresh(document.getElementById('page-dashboard'));
}
function goLatestDashboardPeriod() { const latest = workspace.entries.map(r => recordDate(r.tanggal)).filter(d => d && d <= new Date()).sort((a,b) => b-a)[0]; if (latest) { document.getElementById('dashboardMonth').value = `${latest.getFullYear()}-${String(latest.getMonth()+1).padStart(2,'0')}`; loadDashboard({periodChange:true}); } }
function chartSeriesColors() {return window.csmTheme?.chartColors() || ['#007f9b','#bb4d20','#008063','#a06b00','#4c6c82'];}
function renderWorkspaceChart(canvas,config) {
    window.csmChartData?.register(canvas,config);
    if (typeof Chart === 'undefined') {canvas.hidden = true; return null;}
    return window.csmChartMotion?.render?csmChartMotion.render(canvas,config):new Chart(canvas,config);
}
function renderDashboardCharts(current, period, done, total, master) {
    if (typeof Chart === 'undefined') { document.querySelectorAll('#page-dashboard canvas').forEach(canvas => { canvas.hidden = true; }); document.getElementById('chartPeriodNote').textContent += ' Chart gagal dimuat. Angka tetap tersedia melalui Lihat data.'; }
    window.dashCharts = window.dashCharts || {};
    if (typeof Chart !== 'undefined') {Chart.defaults.font.family = 'DM Sans, sans-serif'; Chart.defaults.font.size = 12;}
    const palette = chartSeriesColors();
    const now=new Date(),monthDays = new Date(period.start.getFullYear(),period.start.getMonth()+1,0).getDate();
    const isCurrent=period.start.getFullYear()===now.getFullYear()&&period.start.getMonth()===now.getMonth();
    const days=isCurrent?Math.max(now.getDate(),...current.map(row=>recordDate(row.tanggal).getDate())):monthDays;
    const series = [5,2,1,3,4].map(code => { const values = Array(days).fill(0); current.filter(r => Number(r.kode_mutasi) === code).forEach(r => { values[recordDate(r.tanggal).getDate()-1] += numberValue(r.qty); }); return values; });
    const empty=document.getElementById('chartEmpty');if(empty)empty.hidden=current.length>0;
    window.dashCharts.mutasi = renderWorkspaceChart(document.getElementById('chartMutasi'), { type:'bar', data:{ labels:Array.from({length:days},(_,i) => i+1), datasets:['Stok baru','Dipinjam','Kembali','Rusak','Permanen'].map((label,i) => ({ label, data:series[i], backgroundColor:palette[i], borderRadius:5, maxBarThickness:15 })) }, options:{ responsive:true, maintainAspectRatio:false, animation:{duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:400}, plugins:{legend:{display:false},tooltip:{backgroundColor:'#16333b',padding:12,cornerRadius:12}}, scales:{x:{grid:{display:false},border:{display:false},ticks:{maxTicksLimit:12}},y:{beginAtZero:true,border:{display:false},grid:{color:'#e7f0f2'},ticks:{precision:0,maxTicksLimit:5}}}} });
    window.dashCharts.opname = renderWorkspaceChart(document.getElementById('chartOpname'), { type:'doughnut', data:{labels:['Sudah opname','Belum opname'],datasets:[{label:'Jenis barang',data:[done,total-done],backgroundColor:[palette[0],palette[4]],borderWidth:0,borderRadius:5,spacing:2}]}, options:{responsive:true,maintainAspectRatio:false,rotation:-90,circumference:180,cutout:'84%',plugins:{legend:{display:false},tooltip:{enabled:false}},animation:{duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:500}} });
    const categories = new Map(); master.forEach(item => { const name = itemCategory(item).name; categories.set(name, (categories.get(name)||0)+numberValue(item.tersedia)); });
    const data = [...categories].filter(([,qty])=>qty>0).sort((a,b)=>b[1]-a[1]);
    const colors = window.csmTheme?.categoryColors() || palette;
    window.dashCharts.kategori = renderWorkspaceChart(document.getElementById('chartKategori'),{ type:'doughnut',data:{labels:data.map(r=>r[0]),datasets:[{data:data.map(r=>r[1]),backgroundColor:colors,borderWidth:5,borderColor:'#fff',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:'76%',plugins:{legend:{display:false},tooltip:{backgroundColor:'#16333b'}},animation:{duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:400}}});
    document.getElementById('dashCategoryLegend').innerHTML=data.map(([name,qty],i)=>`<div class="category-legend-row"><span><i style="background:${colors[i%colors.length]}"></i>${esc(name)}</span><strong>${formatNum(qty)}</strong></div>`).join('') || emptyState('Belum ada stok tersedia');
}

function renderPaginationControls(containerId,currentPage,totalPages,onChange) {
    const el = document.getElementById(containerId); if (!el) return;
    if (totalPages <= 1) { el.innerHTML='';return; }
    el.innerHTML=`<div class="inventory-pagination"><span>Halaman ${currentPage} dari ${totalPages}</span><div><button class="btn btn-ghost btn-sm" aria-label="Halaman sebelumnya" ${currentPage<=1?'disabled':''}><i class="fas fa-chevron-left"></i></button><button class="btn btn-ghost btn-sm" aria-label="Halaman berikutnya" ${currentPage>=totalPages?'disabled':''}><i class="fas fa-chevron-right"></i></button></div></div>`;
    const buttons=el.querySelectorAll('button');buttons[0].onclick=()=>onChange(currentPage-1);buttons[1].onclick=()=>onChange(currentPage+1);
}
function renderMasterBarang() { renderInventory('master',appState.masterBarang); }
function renderStockGudang() { renderInventory('stock',appState.stockGudang); }
function filterMasterBarang() { inventoryFilterChanged('master'); }
function filterStockGudang() { if (stockFilter) { document.getElementById('stockStatus').value=stockFilter;stockFilter=''; } inventoryFilterChanged('stock'); }
function inventoryFilterChanged(prefix) { workspace.inventory[prefix].page=1; renderInventory(prefix,prefix==='master'?appState.masterBarang:appState.stockGudang); }
function setInventoryView(prefix,view) { workspace.inventory[prefix].view=view;renderInventory(prefix,prefix==='master'?appState.masterBarang:appState.stockGudang); }
function inventorySort(prefix,col) { const sort = prefix==='master'?appState.sortMaster:appState.sortStock;sort.asc=sort.col===col?!sort.asc:true;sort.col=col;renderInventory(prefix,prefix==='master'?appState.masterBarang:appState.stockGudang); }
function fillFilter(id,values,label,display=value=>value) { const el=document.getElementById(id), selected=el.value; el.innerHTML=`<option value="">${label}</option>`;values.forEach(value=>{const option=new Option(display(value),value);el.add(option);});if(values.includes(selected))el.value=selected; }
function renderInventory(prefix,source) {
    if (window.csmReadState && !csmReadState.canRender(prefix)) return;
    source=(Array.isArray(source)?source:[]).filter(item=>!item.deleted_at&&!workspace.removedMasterCodes.has(item.kode_barang));workspace.master = source;
    fillFilter(`${prefix}Location`,[...new Set(source.map(r=>r.lokasi_barang).filter(Boolean))].sort(),'Semua lokasi',locationLabel);
    fillFilter(`${prefix}Category`,[...new Set(source.map(r=>itemCategory(r).name))].sort(),'Semua kategori');
    const query=document.getElementById(prefix==='master'?'searchMaster':'searchStock').value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const location=document.getElementById(`${prefix}Location`).value,category=document.getElementById(`${prefix}Category`).value,status=document.getElementById(`${prefix}Status`).value;
    let rows=source.filter(item=>query.every(word=>`${item.kode_barang} ${item.nama_barang} ${item.serial_number||''} ${item.fa_number||''} ${item.lokasi_barang}`.toLowerCase().includes(word)) && (!location||item.lokasi_barang===location) && (!category||itemCategory(item).name===category) && (!status||(status==='rusak'?numberValue(item.rusak)>0:itemStatus(item).key===status)));
    const sort=prefix==='master'?appState.sortMaster:appState.sortStock;if(sort.col)rows=sortData(rows,sort.col,sort.asc);
    const state=workspace.inventory[prefix],pages=Math.max(1,Math.ceil(rows.length/24));state.page=Math.min(state.page,pages);
    const slice=rows.slice((state.page-1)*24,state.page*24);
    setText(prefix==='master'?'masterCount':'stockCount',`${rows.length} jenis barang`);
    document.getElementById(`${prefix}Summary`).innerHTML=`<div><span>Jenis barang</span><strong>${formatNum(rows.length)}</strong></div><div><span>Unit tersedia</span><strong>${formatNum(rows.reduce((s,r)=>s+numberValue(r.tersedia),0))}</strong></div><div><span>Unit rusak</span><strong>${formatNum(rows.reduce((s,r)=>s+numberValue(r.rusak),0))}</strong></div><div><span>Stok habis</span><strong>${rows.filter(r=>!numberValue(r.tersedia)).length}</strong></div>`;
    document.getElementById(prefix==='master'?'masterBarangTable':'stockGudangTable').innerHTML=slice.length?slice.map(item=>`<tr><td>${itemButton(item)}</td><td><span class="location-cell"><i class="fas fa-location-dot"></i>${esc(locationLabel(item.lokasi_barang||'Belum ada lokasi'))}</span></td><td><strong class="stock-number">${formatNum(numberValue(item.tersedia))}</strong><small class="unit-label">unit</small></td><td>${numberValue(item.stok_paten)}</td><td>${numberValue(item.rusak)?`<span class="badge badge-danger">${numberValue(item.rusak)}</span>`:'0'}</td><td>${statusBadge(item)}</td><td><button class="btn-icon-ghost" data-code="${esc(item.kode_barang)}" onclick="openAssetDetail(this.dataset.code)" aria-label="Detail ${esc(item.kode_barang)}"><i class="fas fa-arrow-up-right-from-square"></i></button>${prefix==='master'&&isAdmin()?`<button class="btn-icon-ghost master-delete-trigger" data-code="${esc(item.kode_barang)}" onclick="openMasterDelete(this.dataset.code)" aria-label="Hapus ${esc(item.kode_barang)}"><i class="fas fa-trash-can"></i></button>`:''}</td></tr>`).join(''):`<tr><td colspan="7">${emptyState('Barang tidak ditemukan','Coba kata kunci lain atau ubah filter.')}</td></tr>`;
    document.getElementById(prefix==='master'?'masterBarangFoot':'stockGudangFoot').innerHTML='';
    document.getElementById(`${prefix}Grid`).innerHTML=slice.length?slice.map(item=>`${prefix==='master'&&isAdmin()?'<article class="inventory-card-with-actions">':''}<button class="inventory-card" data-code="${esc(item.kode_barang)}" onclick="openAssetDetail(this.dataset.code)">${productImage(item)}<small>${esc(item.kode_barang)}</small><strong>${esc(item.nama_barang)}</strong><p>${esc(locationLabel(item.lokasi_barang||'Belum ada lokasi'))}</p><div class="row-between"><span><b>${numberValue(item.tersedia)}</b> unit</span>${statusBadge(item)}</div></button>${prefix==='master'&&isAdmin()?`<button class="master-delete-grid btn btn-ghost btn-sm" data-code="${esc(item.kode_barang)}" onclick="openMasterDelete(this.dataset.code)"><i class="fas fa-trash-can"></i> Hapus master</button></article>`:''}`).join(''):emptyState('Barang tidak ditemukan');
    document.getElementById(`${prefix}List`).hidden=state.view!=='list';document.getElementById(`${prefix}Grid`).hidden=state.view!=='grid';
    document.getElementById(`${prefix}ListButton`).classList.toggle('selected',state.view==='list');document.getElementById(`${prefix}GridButton`).classList.toggle('selected',state.view==='grid');
    renderPaginationControls(`${prefix}Pagination`,state.page,pages,page=>{state.page=page;renderInventory(prefix,source);document.getElementById(`${prefix}Summary`).scrollIntoView({block:'start',behavior:'smooth'});});
    if(window.csmMotion) {
        const selector=state.view==='list'?`#${prefix==='master'?'masterBarangTable':'stockGudangTable'} .inventory-product`:`#${prefix}Grid .inventory-card`;
        csmMotion.stagger(document.querySelectorAll(selector),{distance:6,duration:320,budget:120});
    }
}

function closeWorkspaceOverlay({immediate=false,preserveRequest=false,restore=true} = {}) {
    if(!preserveRequest){workspace.detailRequest++;workspace.detailPending=false;}
    if(immediate)document.querySelectorAll('.detail-overlay.motion-closing,.search-overlay.motion-closing').forEach(old=>{window.csmMotion?.cancel(old);window.csmMotion?.cancel(old.firstElementChild);old.remove();});
    const el=document.getElementById('workspaceOverlay');
    if(el?.dataset.deletePending==='true'&&!immediate)return;
    if(workspace.overlayResolve){const resolve=workspace.overlayResolve;workspace.overlayResolve=null;resolve(null);}
    if(!el){if(immediate)document.body.style.overflow='';return;}
    const focus=workspace.overlayFocus;
    const finish=()=>{
        el.remove();
        if(!document.getElementById('workspaceOverlay')) {
            document.body.style.overflow='';
            if(restore&&focus?.isConnected&&!focus.closest('[inert]')&&focus.getClientRects().length)focus.focus({preventScroll:true});
        }
    };
    if(immediate||!window.csmMotion){window.csmMotion?.cancel(el);window.csmMotion?.cancel(el.firstElementChild);finish();}
    else {el.removeAttribute('id');csmMotion.closeOverlay(el,finish);}
}
function mountWorkspaceOverlay(content,kind,label) {
    const existing=document.getElementById('workspaceOverlay')||document.querySelector('.detail-overlay.motion-closing,.search-overlay.motion-closing');
    const focus=existing?workspace.overlayFocus:document.activeElement;
    closeWorkspaceOverlay({immediate:true,preserveRequest:true,restore:false});workspace.overlayFocus=focus;
    const el=document.createElement('div');el.id='workspaceOverlay';el.className=`${kind}-overlay`;el.innerHTML=content;
    el.addEventListener('click',event=>{if(event.target===el)closeWorkspaceOverlay();});document.body.appendChild(el);document.body.style.overflow='hidden';
    const panel=el.firstElementChild;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',label);
    window.csmMotion?.openOverlay(el,{focus:false});(kind==='search'?panel.querySelector('input'):panel.querySelector('button'))?.focus({preventScroll:true});
    return el;
}
async function openAssetDetail(code) {
    const request=++workspace.detailRequest;workspace.detailPending=true;
    const end=window.csmMotion?.begin(document.activeElement?.closest('button')) || (()=>{});
    try {
    await workspace.photoCatalogReady;
    let item;
    try{const rows=await sbGet('master_barang',`select=*&kode_barang=eq.${encodeURIComponent(code)}`);item=rows[0];}catch{if(request===workspace.detailRequest)showToast('Detail barang gagal dimuat','error');return;}
    if(request!==workspace.detailRequest||!appState.currentUser)return;
    workspace.detailPending=false;
    if(!item){showToast('Barang tidak ditemukan di master','error');return;}
    const category=itemCategory(item);
    mountWorkspaceOverlay(`<section class="detail-panel"><div class="row-between"><span class="eyebrow">DETAIL BARANG</span><button class="btn-icon-ghost" onclick="closeWorkspaceOverlay()" aria-label="Tutup detail"><i class="fas fa-xmark"></i></button></div>${productImage(item,'detail-hero')}${productPhotoNote(item)}<span class="eyebrow">${esc(code)}</span><h2>${esc(item.nama_barang)}</h2><div style="margin-top:12px">${statusBadge(item)}</div><dl class="detail-fields"><div><dt>Lokasi</dt><dd>${esc(locationLabel(item.lokasi_barang||'Belum diisi'))}</dd></div><div><dt>Kategori visual</dt><dd>${esc(category.name)}</dd></div><div><dt>Serial number</dt><dd>${esc(item.serial_number||'Belum diisi')}</dd></div><div><dt>FA number</dt><dd>${esc(item.fa_number||'Belum diisi')}</dd></div><div><dt>Tersedia</dt><dd>${numberValue(item.tersedia)} unit</dd></div><div><dt>Stok minimum</dt><dd>${numberValue(item.stok_paten)} unit</dd></div><div><dt>Rusak</dt><dd>${numberValue(item.rusak)} unit</dd></div><div><dt>Keluar permanen</dt><dd>${numberValue(item.permanen)} unit</dd></div><div><dt>Opname terakhir</dt><dd>${esc(item.last_opname_date||'Belum diperiksa')}</dd></div></dl><button class="btn btn-primary" id="detailQr"><i class="fas fa-qrcode"></i> Lihat QR barang</button>${isAdmin()?`<button type="button" class="photo-upload btn" onclick="document.getElementById('assetPhotoInput').click()"><i class="fas fa-camera" aria-hidden="true"></i> Pilih foto pratinjau</button><input hidden id="assetPhotoInput" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Pilih foto pratinjau barang"><p class="photo-note">Foto pratinjau hanya di sesi browser ini.</p>`:''}<h3 style="margin-top:25px">Transaksi terkait</h3><div class="detail-history" id="assetHistory"><p>Memuat riwayat...</p></div></section>`,'detail',`Detail ${code}`);
    const overlay=document.getElementById('workspaceOverlay');overlay.setAttribute('data-code',code);
    document.getElementById('detailQr').onclick=()=>showQRCode(code,item.nama_barang,`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(item.barcode||item.nama_barang||code)}`);
    document.getElementById('assetPhotoInput')?.addEventListener('change',event=>{const file=event.target.files[0];if(!file)return;if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>5*1024*1024){showToast('Pilih PNG, JPG atau WebP maksimal 5 MB','error');return;}if(workspace.localPhotos[code])URL.revokeObjectURL(workspace.localPhotos[code]);workspace.localPhotos[code]=URL.createObjectURL(file);openAssetDetail(code);});
    try{const rows=await sbGet('data_entry',`select=*&kode_barang=eq.${encodeURIComponent(code)}&order=id.desc&limit=6`);const history=overlay.querySelector('#assetHistory');if(overlay===document.getElementById('workspaceOverlay')&&history){history.innerHTML=rows.length?rows.map(r=>`<div><strong>#${esc(r.nomor_tiket)} · ${esc(mutationLabel(r.kode_mutasi))}</strong><small>${esc(r.tanggal)} · ${esc(r.nama_peminjam)} · ${numberValue(r.qty)} unit</small></div>`).join(''):emptyState('Belum ada transaksi');window.csmMotion?.stagger(history.children,{distance:5,duration:300,budget:100});}}catch{if(overlay===document.getElementById('workspaceOverlay'))overlay.querySelector('#assetHistory').textContent='Riwayat belum berhasil dimuat.';}
    } finally { if(request===workspace.detailRequest)workspace.detailPending=false;end(); }
}
async function openWorkspaceSearch() {
    workspace.detailRequest++;workspace.detailPending=false;
    const overlay=mountWorkspaceOverlay(`<section class="search-box"><div class="row-between"><span class="eyebrow">TEMUKAN ASET</span><button class="btn-icon-ghost" onclick="closeWorkspaceOverlay()" aria-label="Tutup pencarian"><i class="fas fa-xmark"></i></button></div><input id="workspaceSearchInput" type="search" placeholder="Nama, kode, serial number, lokasi..." aria-label="Pencarian semua barang"><div class="search-results" id="workspaceSearchResults">${emptyState('Cari di seluruh inventaris','Mulai dengan nama atau kode barang.')}</div></section>`,'search','Pencarian inventaris');
    const input=overlay.querySelector('#workspaceSearchInput'),results=overlay.querySelector('#workspaceSearchResults');
    if(!workspace.master.length){try{workspace.master=await sbGetSWR('master_barang','select=*&order=kode_barang.asc');}catch{if(overlay.isConnected)results.textContent='Data belum berhasil dimuat.';}}
    if(overlay!==document.getElementById('workspaceOverlay'))return;
    input.addEventListener('input',event=>{
        const words=event.target.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const items=words.length?workspace.master.filter(r=>words.every(word=>`${r.kode_barang} ${r.nama_barang} ${r.serial_number||''} ${r.fa_number||''} ${r.lokasi_barang}`.toLowerCase().includes(word))).slice(0,12):[];
        results.innerHTML=items.length?items.map(item=>`<button class="search-result" data-code="${esc(item.kode_barang)}" onclick="openAssetDetail(this.dataset.code)">${productImage(item)}<span><strong>${esc(item.nama_barang)}</strong><small>${esc(item.kode_barang)} · ${esc(locationLabel(item.lokasi_barang))}</small></span></button>`).join(''):emptyState(words.length?'Tidak ada barang yang cocok':'Cari di seluruh inventaris');
        window.csmMotion?.stagger(results.children,{distance:4,duration:260,budget:90});
    });
}
function mutationLabel(code) { return {1:'Pengembalian',2:'Peminjaman',3:'Barang rusak',4:'Keluar permanen',5:'Stok baru'}[Number(code)]||'Belum dipilih'; }
function chooseMutation(code) { if(!isAdmin())return;const select=document.getElementById('entryKodeMutasi');if(select.disabled)return;select.value=code;updateAllItemWarnings();updateEntrySummary();window.csmMotion?.reveal(document.querySelector('.mutasi-choice.active'),{distance:2,duration:220}); }
function updateEntrySummary() {
    const select=document.getElementById('entryKodeMutasi');const chosen=Object.values(appState.itemData).filter(item=>item.kodeBarang);
    setText('entrySummaryType',mutationLabel(select.value));setText('entrySummaryItems',chosen.length);setText('entrySummaryQty',chosen.reduce((sum,item)=>sum+numberValue(item.qty),0));
    document.getElementById('mutasiChoices').innerHTML=[2,1,5,3,4].map(code=>`<button type="button" class="mutasi-choice ${String(code)===select.value?'active':''}" onclick="chooseMutation(${code})" ${select.disabled||!isAdmin()?'disabled':''}><i class="fas ${ {2:'fa-arrow-up-right-from-square',1:'fa-arrow-rotate-left',5:'fa-plus',3:'fa-heart-crack',4:'fa-arrow-right-from-bracket'}[code] }"></i>${mutationLabel(code)}</button>`).join('');
}
function updateItemCount() { legacyUpdateItemCount();updateEntrySummary(); }
function addItemRow() { legacyAddItemRow();const id=`item_${appState.itemCounter}`;document.getElementById(`qty_${id}`).addEventListener('input',updateEntrySummary);window.csmMotion?.insert(document.getElementById(`row_${id}`)); }
function selectItemForInput(itemId,item,isLoadFromSearch=false) { legacySelectItemForInput(itemId,item,isLoadFromSearch);const preview=document.getElementById(`preview_${itemId}`);preview?.querySelector('img')?.remove();preview?.insertAdjacentHTML('afterbegin',productImage(item));updateEntrySummary();if(!isLoadFromSearch)window.csmMotion?.reveal(preview,{distance:6,duration:340}); }

async function loadStockOpname() {
    window.csmReadState?.watch('opname','master_barang','select=*&order=kode_barang.asc',loadStockOpname);
    await legacyLoadStockOpname();
    try { workspace.master=await sbGetSWR('master_barang','select=*&order=kode_barang.asc');renderOpnameLocations(); } catch { document.getElementById('opnameLocations').innerHTML=''; }
    if(workspace.pendingOpnameLocation){const location=workspace.pendingOpnameLocation;workspace.pendingOpnameLocation=null;await chooseOpnameLocation(location);}
}
function renderOpnameLocations() {
    const rows=workspace.master,selected=document.getElementById('opnameLokasi').value;
    document.getElementById('opnameLocations').innerHTML=[...new Set(rows.map(r=>r.lokasi_barang).filter(Boolean))].map(location=>{
        const list=rows.filter(r=>r.lokasi_barang===location),done=list.filter(r=>/^sudah\b/i.test(String(r.last_opname_date||'').trim())).length;
        return `<button class="location-card ${location===selected?'selected':''}" data-location="${esc(location)}" onclick="chooseOpnameLocation(this.dataset.location)"><i class="fas fa-building"></i><strong>${esc(locationLabel(location))}</strong><small>${list.length} jenis barang · ${done} sudah opname</small><span class="mini-progress"><i style="width:${list.length?done/list.length*100:0}%"></i></span></button>`;
    }).join('');
}
function refreshOpnameLocationCards() {
    const changes=new Map(appState.opnameData.map(item=>[item.kode,item]));
    workspace.master=workspace.master.map(item=>{
        const saved=changes.get(item.kode_barang);
        return saved?{...item,last_opname_date:saved.isOpnameDone?'Sudah - '+saved.lastOpnameDate:''}:item;
    });
    renderOpnameLocations();
}
async function chooseOpnameLocation(location) { document.getElementById('opnameLokasi').value=location;document.querySelectorAll('.location-card').forEach(card=>card.classList.toggle('selected',card.dataset.location===location));await onLokasiChange(); }
function goOpnameLocation(location) { workspace.pendingOpnameLocation=location;showPage('stockOpname'); }
function ticketContents(t,index,returned) {
    const id=`${returned?'ret':'act'}-${index}`;
    return `<tr class="ticket-detail-row" id="detail-${id}" style="display:none"><td colspan="${returned?5:4}"><div class="ticket-items">${t.items.map(item=>`<button class="ticket-product" data-code="${esc(item.kode)}" onclick="openAssetDetail(this.dataset.code)">${productImage(item)}<span><strong>${esc(item.nama)}</strong><small>${esc(item.kode)} · ${numberValue(item.qty)} unit</small></span></button>`).join('')}</div>${t.keterangan?`<p class="ticket-description">${esc(t.keterangan)}</p>`:''}${!returned?`<div class="ticket-note"><input id="activeTicketNote_${index}" value="${esc(t.catatan||'')}" placeholder="Catatan tindak lanjut..." maxlength="500" ${isAdmin()?'':'disabled'}>${isAdmin()?`<button class="btn btn-ghost btn-sm" data-ticket="${esc(t.nomor_tiket)}" onclick="saveActiveTicketNote(this.dataset.ticket,${index})">Simpan catatan</button><button class="btn btn-primary btn-sm" data-ticket="${esc(t.nomor_tiket)}" onclick="returnTicket(this.dataset.ticket)"><i class="fas fa-arrow-rotate-left"></i> Kembalikan</button>`:''}</div>`:''}</td></tr>`;
}
function renderActiveTicket(data) {
    if (window.csmReadState && !csmReadState.canRender('active')) return;
    const groups=groupActiveTickets(data).filter(ticket=>!workspace.ticketAgeFilter || ticketAge(ticket.tanggal)>=workspace.ticketAgeFilter),pages=Math.max(1,Math.ceil(groups.length/appState.PAGE_SIZE));appState.activeTicketPage=Math.min(appState.activeTicketPage,pages);
    let context=document.getElementById('activeAgeContext');
    if(!context) {context=document.createElement('div');context.id='activeAgeContext';context.className='read-state';document.getElementById('searchActiveTicket').closest('.form-group,.card-header-flex,.glass-card').prepend(context);}
    context.hidden=!workspace.ticketAgeFilter;
    context.innerHTML='Menampilkan pinjaman berusia 30+ hari.<button class="btn btn-ghost" onclick="clearTicketAgeFilter()">Semua pinjaman aktif</button>';
    setText('activeTicketCount',`${groups.length} tiket aktif`);
    document.getElementById('activeTicketTable').innerHTML=groups.length?groups.slice((appState.activeTicketPage-1)*appState.PAGE_SIZE,appState.activeTicketPage*appState.PAGE_SIZE).map((t,i)=>`<tr ${isAdmin()?`draggable="true" ondragstart="onDragTicket(event)" data-tiket="${esc(t.nomor_tiket)}"`:''}><td>${esc(t.tanggal)}<small class="ticket-age">${ticketAge(t.tanggal)===null?'Tanggal tidak tersedia':`${ticketAge(t.tanggal)} hari`}</small></td><td><button class="ticket-toggle" onclick="toggleTicketDetail('act-${i}')" aria-label="Detail tiket ${esc(t.nomor_tiket)}">#${esc(t.nomor_tiket)} <i class="fas fa-chevron-down" id="chevron-act-${i}"></i></button></td><td>${esc(t.nama_peminjam)}</td><td><span class="badge badge-${ticketAge(t.tanggal)>=30?'danger':'primary'}">Dipinjam</span></td></tr>${ticketContents(t,i,false)}`).join(''):`<tr><td colspan="4">${emptyState(workspace.ticketAgeFilter?'Tidak ada pinjaman 30+ hari':'Tidak ada tiket yang cocok',workspace.ticketAgeFilter?'Buka Semua pinjaman aktif untuk melihat usia lainnya.':'Hapus pencarian untuk melihat seluruh tiket aktif.')}</td></tr>`;
    renderPaginationControls('activeTicketPagination',appState.activeTicketPage,pages,p=>{appState.activeTicketPage=p;renderActiveTicket(data);});
}
function goAgedTickets() {workspace.ticketAgeFilter=30;document.getElementById('searchActiveTicket').value='';appState.activeTicketPage=1;showPage('activeTicket');}
function clearTicketAgeFilter() {workspace.ticketAgeFilter=0;filterActiveTicket();}
function renderReturnedTicket(data) {
    if (window.csmReadState && !csmReadState.canRender('returned')) return;
    const groups=groupActiveTickets(data),pages=Math.max(1,Math.ceil(groups.length/appState.PAGE_SIZE));returnedTicketPage=Math.min(returnedTicketPage,pages);setText('returnedTicketCount',`${groups.length} tiket kembali`);
    document.getElementById('returnedTicketTable').innerHTML=groups.length?groups.slice((returnedTicketPage-1)*appState.PAGE_SIZE,returnedTicketPage*appState.PAGE_SIZE).map((t,i)=>`<tr><td>${esc(t.tanggal)}<small class="ticket-age">Tanggal transaksi</small></td><td><button class="ticket-toggle" onclick="toggleReturnedDetail('ret-${i}')" aria-label="Detail tiket ${esc(t.nomor_tiket)}">#${esc(t.nomor_tiket)} <i class="fas fa-chevron-down" id="chevron-ret-${i}"></i></button></td><td>${esc(t.nama_peminjam)}</td><td><span class="badge badge-success">Kembali</span></td><td>${isAdmin()?`<button class="btn btn-ghost btn-sm" data-ticket="${esc(t.nomor_tiket)}" onclick="undoReturnTicket(this.dataset.ticket)"><i class="fas fa-undo"></i> Batalkan pengembalian</button>`:''}</td></tr>${ticketContents(t,i,true)}`).join(''):`<tr><td colspan="5">${emptyState('Belum ada pengembalian')}</td></tr>`;
    renderPaginationControls('returnedTicketPagination',returnedTicketPage,pages,p=>{returnedTicketPage=p;renderReturnedTicket(data);});
}

document.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&appState.currentUser){event.preventDefault();openWorkspaceSearch();}
    if(event.key==='Escape'){if(document.getElementById('qrModal').style.display==='flex')closeQRModal();else if(document.getElementById('changePasswordModal').style.display==='flex')closeChangePassword();else if(document.getElementById('scanModal').style.display==='flex')stopBarcodeScan();else if(document.getElementById('customConfirm').classList.contains('show'))document.getElementById('customConfirmCancel').click();else if(document.getElementById('workspaceOverlay')||workspace.detailPending)closeWorkspaceOverlay();else closeSidebar();}
    const permanent=['qrModal','changePasswordModal','scanModal'].map(id=>document.getElementById(id)).find(el=>el.style.display==='flex'&&!el.inert);
    const overlay=permanent||document.querySelector('#customConfirm.show:not([inert])')||document.getElementById('workspaceOverlay')||document.querySelector('.sidebar.open');
    if(event.key==='Tab'&&overlay){const focusable=[...overlay.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
});
function syncSidebarAccessibility() {
    const sidebar=document.getElementById('sidebar'),mobile=window.innerWidth<=768,open=sidebar.classList.contains('open');
    sidebar.toggleAttribute('inert',mobile&&!open);
    if(mobile)document.getElementById('desktopSidebarToggle').setAttribute('aria-expanded',String(open));
}
document.addEventListener('DOMContentLoaded',()=>{
    if(window.Chart && window.matchMedia('(prefers-reduced-motion: reduce)').matches) Chart.defaults.animation=false;
    workspace.photoCatalogReady = fetch('assets/product-photos.json').then(r=>r.ok?r.json():{})
        .then(photos=>{workspace.photos=photos;refreshProductImages();}).catch(()=>{});
    document.getElementById('toast').setAttribute('role','status');document.getElementById('toast').setAttribute('aria-live','polite');
    const userObserver=new MutationObserver(()=>{setText('topbarName',document.getElementById('sidebarUserName').textContent);setText('topbarAvatar',document.getElementById('sidebarAvatar').textContent);});userObserver.observe(document.getElementById('sidebarUserName'),{childList:true,subtree:true});
    const pageObserver=new MutationObserver(()=>{syncSidebarAccessibility();document.querySelectorAll('.sidebar .menu-item').forEach(item=>{if(item.classList.contains('active'))item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');});});pageObserver.observe(document.getElementById('appContainer'),{attributes:true,subtree:true,attributeFilter:['class']});
    syncSidebarAccessibility();window.addEventListener('resize',syncSidebarAccessibility);
});

