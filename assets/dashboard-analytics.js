/* Derived views of existing inventory and data_entry rows. No database writes. */
'use strict';
const dashboardPalette = ['#009fc5','#e76a32','#009c79','#d69a13','#527884'];
function buildDashboardAnalytics(master, entries, period, now = new Date()) {
    const byCode = new Map(master.map(item=>[item.kode_barang,item]));
    const dated = entries.map(row=>({row,date:recordDate(row.tanggal)})).filter(item=>item.date&&item.date<=now);
    const current = dated.filter(item=>item.date>=period.start&&item.date<period.end);
    const mutations = [5,2,1,3,4].map(code=>({code,label:mutationLabel(code),qty:current.filter(item=>Number(item.row.kode_mutasi)===code).reduce((sum,item)=>sum+numberValue(item.row.qty),0)}));
    const months = Array.from({length:12},(_,index)=>new Date(period.start.getFullYear(),period.start.getMonth()-11+index,1));
    const monthly = [5,2,1,3,4].map(code=>months.map(start=>dated.filter(item=>Number(item.row.kode_mutasi)===code&&item.date>=start&&item.date<new Date(start.getFullYear(),start.getMonth()+1,1)).reduce((sum,item)=>sum+numberValue(item.row.qty),0)));
    const year = period.start.getFullYear(), month = period.start.getMonth();
    const calendarOffset = (period.start.getDay()+6)%7;
    const heatmap = Array.from({length:new Date(year,month+1,0).getDate()},(_,index)=>({
        day:index+1,date:new Date(year,month,index+1),qty:0
    }));
    current.forEach(({row,date})=>{ heatmap[date.getDate()-1].qty+=numberValue(row.qty); });
    const locations = new Map();
    master.forEach(item=>{
        const name = item.lokasi_barang||'Belum ada lokasi';
        if(!locations.has(name))locations.set(name,{name,available:0,borrowed:0,broken:0,checked:0,items:0});
        const location = locations.get(name);
        location.available+=numberValue(item.tersedia);location.broken+=numberValue(item.rusak);location.items++;
        if(/^sudah\b/i.test(String(item.last_opname_date||'').trim()))location.checked++;
    });
    const tickets = new Map();
    entries.filter(row=>Number(row.kode_mutasi)===2).forEach(row=>{
        const key = row.nomor_tiket||`row-${row.id}`, date = recordDate(row.tanggal);
        if(!tickets.has(key))tickets.set(key,{date:null});
        if(date&&(!tickets.get(key).date||date<tickets.get(key).date))tickets.get(key).date=date;
        const name = byCode.get(row.kode_barang)?.lokasi_barang||'Belum ada lokasi';
        if(!locations.has(name))locations.set(name,{name,available:0,borrowed:0,broken:0,checked:0,items:0});
        locations.get(name).borrowed+=numberValue(row.qty);
    });
    const ages = [{label:'0–7 hari',qty:0},{label:'8–14 hari',qty:0},{label:'15–29 hari',qty:0},{label:'30+ hari',qty:0},{label:'Tanpa tanggal',qty:0}];
    tickets.forEach(({date})=>{
        const age = date?Math.max(0,Math.floor((now-date)/86400000)):null;
        ages[age===null?4:age<=7?0:age<=14?1:age<30?2:3].qty++;
    });
    const health = [{label:'Stok aman',key:'ready',qty:0},{label:'Stok rendah',key:'low',qty:0},{label:'Stok habis',key:'habis',qty:0}];
    master.forEach(item=>health.find(status=>status.key===itemStatus(item).key).qty++);
    const rankingRows = current.length?current:dated;
    const counts = new Map();rankingRows.forEach(({row})=>counts.set(row.kode_barang,(counts.get(row.kode_barang)||0)+numberValue(row.qty)));
    const top = [...counts].filter(([code,qty])=>code&&qty>0).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([code,qty])=>({code,qty,item:byCode.get(code)||rankingRows.find(item=>item.row.kode_barang===code).row}));
    const latest = [...dated].sort((a,b)=>b.date-a.date||numberValue(b.row.id)-numberValue(a.row.id)).slice(0,8).map(item=>item.row);
    return {master,period,current,mutations,months,monthly,heatmap,calendarOffset,locations:[...locations.values()].sort((a,b)=>b.available-a.available),ages,health,top,latest,
        topScope:current.length?period.label:'Seluruh riwayat tersimpan',ticketCount:tickets.size,invalidDates:entries.length-dated.length};
}
function createAnalyticsChart(key, id, type, labels, datasets, extra = {}) {
    if(typeof Chart==='undefined')return;
    const options = {responsive:true,maintainAspectRatio:false,
        animation:{duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:350},
        plugins:{legend:{display:false},tooltip:{backgroundColor:'#16333b',padding:11,cornerRadius:10}},
        scales:{x:{grid:{display:false},border:{display:false},ticks:{maxTicksLimit:12}},
                y:{beginAtZero:true,border:{display:false},grid:{color:'#e7f0f2'},ticks:{precision:0,maxTicksLimit:5}}},...extra};
    if(type==='doughnut')delete options.scales;
    const canvas = document.getElementById(id), config = {type,data:{labels,datasets},options};
    if (window.csmChartMotion?.render) window.dashCharts[key] = window.csmChartMotion.render(canvas, config);
    else {
        const existing = Chart.getChart?.(canvas);
        if (existing && existing.config.type === type) { existing.data = config.data; existing.options = options; existing.update(); window.dashCharts[key] = existing; }
        else { existing?.destroy(); window.dashCharts[key] = new Chart(canvas, config); }
    }
}
function compactDashboardLegend(rows, colors) {
    return rows.map((row,index)=>`<div><span><i style="background:${colors[index%colors.length]}"></i>${esc(row.label)}</span><strong>${formatNum(row.qty)}</strong></div>`).join('');
}
function renderDashboardAnalytics(data) {
    const total = data.mutations.reduce((sum,row)=>sum+row.qty,0);
    setText('dashMovementTotal',`${formatNum(total)} unit`);setText('dashMixTotal',formatNum(total));
    document.getElementById('dashMutationLegend').innerHTML=compactDashboardLegend(data.mutations,dashboardPalette);
    const heatMax = Math.max(1,...data.heatmap.map(row=>row.qty)), days=['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
    setText('dashHeatmapMonth',data.period.label);
    document.getElementById('dashActivityHeatmap').innerHTML=`${days.map(day=>`<small class="calendar-weekday">${day}</small>`).join('')}${'<span class="calendar-spacer" aria-hidden="true"></span>'.repeat(data.calendarOffset)}${data.heatmap.map(row=>{
        const label=`${row.date.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · ${formatNum(row.qty)} unit transaksi`;
        return `<span class="heatmap-cell heat-${row.qty?Math.min(4,Math.ceil(row.qty/heatMax*4)):0}" role="img" aria-label="${esc(label)}" title="${esc(label)}"><b>${row.day}</b></span>`;
    }).join('')}`;
    const monthLabel = date=>date.toLocaleDateString('id-ID',{month:'short',year:'2-digit'});
    setText('dashTrendRange',`${monthLabel(data.months[0])} – ${monthLabel(data.months.at(-1))}`);
    setText('dashTrendTotal',`${formatNum(data.monthly.flat().reduce((a,b)=>a+b,0))} unit`);
    const yearly = [0,1,2].map(index=>({label:data.mutations[index].label,data:data.monthly[index],borderColor:dashboardPalette[index],backgroundColor:dashboardPalette[index]+'16',fill:index===0,tension:.32,pointRadius:2,pointHoverRadius:5,borderWidth:2}));
    yearly.push({label:'Rusak / permanen',data:data.monthly[3].map((qty,i)=>qty+data.monthly[4][i]),borderColor:dashboardPalette[3],tension:.3,pointRadius:2,borderWidth:2});
    createAnalyticsChart('yearly','chartYearlyMovement','line',data.months.map(monthLabel),yearly);
    createAnalyticsChart('mix','chartMutationMix','doughnut',data.mutations.map(row=>row.label),[{data:data.mutations.map(row=>row.qty),backgroundColor:dashboardPalette,borderWidth:4,borderColor:'#fff',borderRadius:5}],{cutout:'78%'});
    const locationLabels = data.locations.map(row=>locationLabel(row.name));
    setText('dashLocationCount',`${data.locations.length} lokasi`);
    setText('dashLocationSummary',`${formatNum(data.locations.reduce((sum,row)=>sum+row.available,0))} unit tersedia · ${formatNum(data.locations.reduce((sum,row)=>sum+row.broken,0))} unit rusak`);
    const horizontal = {indexAxis:'y',scales:{
        x:{beginAtZero:true,stacked:true,border:{display:false},grid:{color:'#e7f0f2'},ticks:{precision:0,maxTicksLimit:5}},
        y:{stacked:true,border:{display:false},grid:{display:false},ticks:{font:{size:9},callback:function(value){
            const text=this.getLabelForValue(value);return text.length>23?text.slice(0,21)+'…':text;
        }}}
    }};
    createAnalyticsChart('locationStock','chartLocationStock','bar',locationLabels,[['Tersedia','available','#009c79'],['Dipinjam','borrowed','#009fc5'],['Rusak','broken','#e76a32']].map(([label,key,color])=>({label,data:data.locations.map(row=>row[key]),backgroundColor:color,borderRadius:5,maxBarThickness:22})),horizontal);
    setText('dashHealthyPercent',`${data.master.length?Math.round(data.health[0].qty/data.master.length*100):0}%`);
    document.getElementById('dashStockHealthLegend').innerHTML=compactDashboardLegend(data.health,['#009c79','#d69a13','#e76a32']);
    createAnalyticsChart('health','chartStockHealth','doughnut',data.health.map(row=>row.label),[{data:data.health.map(row=>row.qty),backgroundColor:['#009c79','#d69a13','#e76a32'],borderWidth:4,borderColor:'#fff',borderRadius:5}],{cutout:'78%'});
    const ages = data.ages.filter((row,index)=>index<4||row.qty);
    createAnalyticsChart('loanAges','chartLoanAges','bar',ages.map(row=>row.label),[{label:'Tiket aktif',data:ages.map(row=>row.qty),backgroundColor:['#009fc5','#087c9e','#d69a13','#e76a32','#527884'],borderRadius:7,maxBarThickness:34}]);
    setText('dashLoanAgeSummary',`${data.ticketCount} tiket aktif · ${data.ages[3].qty} tiket berusia 30+ hari${data.ages[4].qty?` · ${data.ages[4].qty} tanpa tanggal`:''}`);
    createAnalyticsChart('locationOpname','chartLocationOpname','bar',locationLabels,[{label:'Sudah opname',data:data.locations.map(row=>row.checked),backgroundColor:'#009fc5',borderRadius:5,maxBarThickness:22},{label:'Belum opname',data:data.locations.map(row=>row.items-row.checked),backgroundColor:'#e3eff1',borderRadius:5,maxBarThickness:22}],horizontal);
    document.getElementById('dashLocationShortcuts').innerHTML=data.locations.filter(row=>row.items).map(row=>`<button data-location="${esc(row.name)}" onclick="goOpnameLocation(this.dataset.location)" title="Buka opname ${esc(locationLabel(row.name))}">${esc(locationLabel(row.name))} <i class="fas fa-arrow-right"></i></button>`).join('');
    setText('dashCategoryTotal',formatNum(data.master.reduce((sum,row)=>sum+numberValue(row.tersedia),0)));
    setText('dashPopularCaption',`${data.topScope} · unit tercatat`);
    const max = Math.max(1,...data.top.map(row=>row.qty));
    document.getElementById('dashPopular').innerHTML=data.top.length?data.top.map((row,index)=>`<button class="ranked-asset" data-code="${esc(row.code)}" onclick="openAssetDetail(this.dataset.code)"><span class="rank-number">${index+1}</span>${productImage(row.item)}<span class="rank-details"><strong>${esc(row.item.nama_barang||row.code)}</strong><small>${esc(row.code)}</small><span class="rank-bar"><i style="width:${row.qty/max*100}%;background:${dashboardPalette[index]}"></i></span></span><b>${formatNum(row.qty)}</b></button>`).join(''):emptyState('Belum ada data entry');
    document.getElementById('dashLatestEntries').innerHTML=data.latest.length?data.latest.map(row=>`<tr><td>${itemButton({...row,nama_barang:row.nama_barang||row.kode_barang})}</td><td><strong>#${esc(row.nomor_tiket||'—')}</strong></td><td>${esc(row.tanggal)}</td><td><span class="badge badge-${({1:'success',2:'primary',3:'danger',4:'warning',5:'info'})[Number(row.kode_mutasi)]||'primary'}">${esc(mutationLabel(row.kode_mutasi))}</span></td><td><strong>${numberValue(row.qty)}</strong></td><td>${esc(row.nama_peminjam||'—')}</td></tr>`).join(''):`<tr><td colspan="6">${emptyState('Belum ada data entry')}</td></tr>`;
}
