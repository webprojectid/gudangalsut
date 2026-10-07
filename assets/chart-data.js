/* Tables share each chart's input, so keyboard and touch see the same numbers. */
(function () {
    'use strict';
    const snapshots = new Map();
    let calendar = null;
    const number = value => Number.isFinite(Number(value)) ? formatNum(Number(value)) : 'Belum tersedia';
    function register(canvas,config) {
        if (!canvas) return;
        const panel = canvas.closest('section,.chart-panel,.panel,.glass-card');
        if (!panel) return;
        const title = panel.querySelector('h2,h3')?.textContent || canvas.getAttribute('aria-label') || 'Chart';
        let details = panel.querySelector(`[data-chart-table="${canvas.id}"]`);
        if (!details) {
            details = document.createElement('details'); details.className = 'chart-data-view'; details.dataset.chartTable = canvas.id;
            const summary = document.createElement('summary'); summary.textContent = 'Lihat data'; summary.setAttribute('aria-label',`Lihat data ${title}`);
            details.append(summary); panel.append(details);
        }
        const open = details.open;
        const labels = config.data.labels || [], datasets = config.data.datasets || [];
        snapshots.set(canvas.id,{labels:[...labels],datasets:datasets.map(dataset=>({label:dataset.label || 'Unit',data:[...dataset.data]}))});
        details.querySelector('.chart-data-scroll')?.remove();
        const scroll = document.createElement('div'); scroll.className = 'chart-data-scroll';
        scroll.tabIndex = 0; scroll.setAttribute('aria-label',`Tabel ${title}, geser jika diperlukan`);
        const table = document.createElement('table'), caption = document.createElement('caption');
        caption.textContent = `${title}. Angka sesuai chart dan periode yang ditampilkan.`; table.append(caption);
        const head = document.createElement('thead'), header = document.createElement('tr');
        ['Label',...datasets.map(dataset=>dataset.label || 'Unit')].forEach(text=>{
            const th = document.createElement('th'); th.scope = 'col'; th.textContent = text; header.append(th);
        }); head.append(header); table.append(head);
        const body = document.createElement('tbody');
        labels.forEach((label,index)=>{
            const row = document.createElement('tr'), heading = document.createElement('th');
            heading.scope = 'row'; heading.textContent = String(label); row.append(heading);
            datasets.forEach(dataset=>{const cell = document.createElement('td'); cell.textContent = number(dataset.data[index]); row.append(cell);});
            body.append(row);
        });
        if (!labels.length) {
            const row = document.createElement('tr'), cell = document.createElement('td'); cell.colSpan = datasets.length + 1;
            cell.textContent = 'Belum ada data pada chart ini.'; row.append(cell); body.append(row);
        }
        table.append(body); scroll.append(table); details.append(scroll); details.open = open;
        canvas.textContent = `Data ${title} tersedia pada tombol Lihat data setelah chart.`;
    }
    function setCalendar(data) {
        calendar = data;
        let selection = document.getElementById('heatmapSelection');
        if (!selection) {
            selection = document.createElement('div'); selection.id = 'heatmapSelection'; selection.className = 'heatmap-selection';
            selection.setAttribute('aria-live','polite'); selection.setAttribute('role','status');
            document.getElementById('dashActivityHeatmap').after(selection);
        }
        selection.textContent = 'Pilih tanggal untuk melihat jumlah unit dan riwayatnya.';
        const heatmap = document.getElementById('dashActivityHeatmap');
        heatmap.onkeydown = event => {
            const buttons = [...heatmap.querySelectorAll('button')], index = buttons.indexOf(event.target);
            const offsets = {ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
            if (index < 0 || !(event.key in offsets)) return;
            event.preventDefault(); buttons[Math.max(0,Math.min(buttons.length-1,index+offsets[event.key]))].focus();
        };
    }
    window.selectDashboardDate = iso => {
        if (!calendar) return;
        const date = new Date(`${iso}T00:00:00`);
        const row = calendar.heatmap.find(day=>day.date.getTime()===date.getTime()); if (!row) return;
        const selection = document.getElementById('heatmapSelection'); selection.replaceChildren();
        const description = document.createElement('span');
        description.textContent = `${date.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}: ${formatNum(row.qty)} unit transaksi.`;
        const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-ghost'; button.textContent = 'Lihat riwayat tanggal ini';
        button.onclick = () => {transaksiDateFilter = {start:date,end:new Date(date.getFullYear(),date.getMonth(),date.getDate()+1)}; showPage('transaksi');};
        selection.append(description,button);
        document.querySelectorAll('#dashActivityHeatmap button').forEach(cell=>cell.setAttribute('aria-pressed',String(cell.dataset.date===iso)));
    };
    window.syncHistoryDateFilter = () => {
        let context=document.getElementById('historyDateContext');
        if(!context) {context=document.createElement('div');context.id='historyDateContext';context.className='read-state';document.getElementById('transaksiTable').closest('.glass-card').prepend(context);}
        context.hidden=!transaksiDateFilter; if(!transaksiDateFilter)return;
        const {start,end}=transaksiDateFilter,last=new Date(end.getTime()-86400000);
        const format=date=>date.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
        context.replaceChildren();
        const label=document.createElement('span');label.textContent=`Riwayat ${format(start)}${start.getTime()===last.getTime()?'':' sampai '+format(last)}.`;
        const reset=document.createElement('button');reset.type='button';reset.className='btn btn-ghost';reset.textContent='Hapus filter tanggal';
        reset.onclick=()=>{transaksiDateFilter=null;filterTransaksi();};context.append(label,reset);
    };
    window.csmChartData = {register,setCalendar,clear(){calendar=null; snapshots.clear(); document.querySelectorAll('.chart-data-view').forEach(view=>view.remove());}};
})();
