/* Read state and drafts belong to one signed-in browser session. */
(function () {
    'use strict';
    const views = new Map(), requests = new Map();
    let epoch = 0;
    const definitions = {
        dashboardMaster: ['page-dashboard'],
        dashboardEntries: ['page-dashboard'],
        master: ['page-masterBarang','masterCount','masterBarangTable',7],
        stock: ['page-stockGudang','stockCount','stockGudangTable',7],
        entry: ['page-dataEntry'],
        history: ['page-transaksi','transaksiCount','transaksiTable',6],
        active: ['page-activeTicket','activeTicketCount','activeTicketTable',4],
        returned: ['page-activeTicket','returnedTicketCount','returnedTicketTable',5],
        opname: ['page-stockOpname'],
        opnameItems: ['page-stockOpname',null,'opnameTableBody',8],
        time: ['page-timeManagement',null,'tmUserTable',5],
        accounts: ['page-accountSettings','accountCount','accountTableBody',4]
    };
    const queryKey = (table,params) => `${table}|${params || ''}`;
    function mount(id) {
        const [page,count,body,columns] = definitions[id];
        const container = document.getElementById(page), box = document.createElement('div');
        box.className = 'read-state'; box.dataset.readState = id;
        box.setAttribute('role','status'); box.setAttribute('aria-live','polite');
        const message = document.createElement('span'), retry = document.createElement('button');
        retry.type = 'button'; retry.className = 'btn btn-ghost'; retry.textContent = 'Coba lagi';
        box.append(message,retry);
        const badge = count && document.getElementById(count);
        const section = badge?.closest('.glass-card,.panel') || container;
        section.insertBefore(box,section.firstChild);
        const view = {id,box,message,retry,count,body,columns,hasData:false,time:null,status:'idle'};
        retry.onclick = () => {
            if (!view.reload || retry.disabled) return;
            queryCache.delete(cacheKey(view.table,view.params));
            Promise.resolve(view.reload()).catch(() => render(view,'error'));
        };
        views.set(id,view); return view;
    }
    function render(view,status) {
        view.status = status; view.box.dataset.state = status;
        view.box.hidden = status === 'idle' || status === 'ready';
        view.retry.hidden = status !== 'error'; view.retry.disabled = status === 'loading';
        view.message.textContent = status === 'error'
            ? view.hasData
                ? `Pembaruan gagal. Data terakhir${view.time ? ' dari ' + new Date(view.time).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}) : ''} masih ditampilkan. Coba lagi untuk memeriksa data terbaru.`
                : 'Data belum berhasil dimuat. Jumlah belum diketahui. Periksa koneksi, lalu coba lagi.'
            : view.hasData ? 'Memeriksa pembaruan data...' : 'Memuat data...';
        if (!view.hasData && view.count) document.getElementById(view.count).textContent = 'Belum dimuat';
        if (!view.hasData && view.body) {
            const cell = document.createElement('td'); cell.colSpan = view.columns; cell.className = 'read-placeholder';
            cell.textContent = status === 'error' ? 'Data belum dimuat. Gunakan Coba lagi di atas.' : 'Menunggu data...';
            const row = document.createElement('tr'); row.append(cell);
            document.getElementById(view.body).replaceChildren(row);
        }
        if (!view.hasData && ['master','stock'].includes(view.id)) {
            document.getElementById(`${view.id}Summary`)?.replaceChildren();
            const grid = document.getElementById(`${view.id}Grid`); if (grid) grid.textContent = 'Data belum dimuat.';
        }
        if (!view.hasData && view.id === 'time') {
            ['tmTodayTotal','tmAvgDaily','tmAvgWeekly','tmAvgMonthly','tmAvgYearly'].forEach(id => {document.getElementById(id).textContent = 'Belum dimuat';});
        }
    }
    function watch(id,table,params,reload) {
        const view = views.get(id) || mount(id), key = queryKey(table,params);
        if (view.key && view.key !== key) {view.hasData = false; view.time = null;}
        Object.assign(view,{table,params,reload,key});
        const cached = getCached(table,params);
        if (cached) {view.hasData = true; view.time = queryCache.get(cacheKey(table,params))?.ts;}
        if (view.status !== 'error') render(view,cached ? 'ready' : 'loading');
        return view;
    }
    function begin(table,params) {
        const key = queryKey(table,params), sequence = (requests.get(key) || 0) + 1;
        requests.set(key,sequence);
        views.forEach(view => {if (view.key === key) render(view,'loading');});
        return {key,sequence,epoch,user:appState.currentUser};
    }
    function settle(ticket,ok) {
        if (!ticket || ticket.epoch !== epoch || ticket.user !== appState.currentUser || requests.get(ticket.key) !== ticket.sequence) return;
        views.forEach(view => {
            if (view.key !== ticket.key) return;
            if (ok) {view.hasData = true; view.time = Date.now();}
            render(view,ok ? 'ready' : 'error');
        });
    }
    function clear() {
        epoch++; requests.clear();
        views.forEach(view => {view.hasData = false; view.time = null; view.key = null; render(view,'idle');});
        appState.entryDraftOwner = null; appState.entryBaseline = null;
        appState.itemData = {}; appState.itemCounter = 0; appState.editingRowIds = [];
        appState.editingSnapshot = []; appState.isEditMode = false;
        ['opnameLocations','opnameSummary','opnameTableBody','tmTodayList','tmUserTable','masterSummary','stockSummary','masterGrid','stockGrid'].forEach(id=>document.getElementById(id)?.replaceChildren());
        document.getElementById('opnameLokasi').value='';
        document.getElementById('entryForm').reset(); document.getElementById('itemsContainer').replaceChildren();
        document.getElementById('searchTicketInput').value = '';
        document.getElementById('dashboardAttention').hidden = true;
        ['dashActivityHeatmap','dashMutationLegend','dashStockHealthLegend','dashCategoryLegend','dashLocationShortcuts','dashPopular','dashLatestEntries','heatmapSelection'].forEach(id=>document.getElementById(id)?.replaceChildren());
        Object.values(window.dashCharts || {}).forEach(chart=>chart?.destroy()); window.dashCharts={};
        Object.values(window.tmCharts || {}).forEach(chart=>chart?.destroy()); window.tmCharts={};
        ['dashTotalSku','dashAvailable','dashBorrowed','dashTransactions','dashMixTotal','dashHealthyPercent','dashOpnamePercent','dashOpnameDone','dashOpnameRemaining','dashCategoryTotal','dashMovementTotal','dashTrendTotal','dashLocationCount'].forEach(id => {
            document.getElementById(id).innerHTML = '<span class="loading-value">Belum dimuat</span>';
        });
        window.csmChartData?.clear();
    }
    window.csmReadState = {watch,begin,settle,clear,canRender:id => !views.has(id) || views.get(id).hasData};
    function entrySignature() {
        return JSON.stringify([['entryTanggal','entryTicket','entryPeminjam','entryKodeMutasi','entryKeterangan'].map(id => document.getElementById(id).value),
            [...document.querySelectorAll('#itemsContainer input')].map(field => [field.id,field.value]),
            Object.values(appState.itemData).map(item => [item.kodeBarang,item.qty,item._rowId || null])]);
    }
    window.captureEntryBaseline = () => {appState.entryBaseline = entrySignature();};
    window.entryHasChanges = () => !!appState.entryBaseline && entrySignature() !== appState.entryBaseline;
    window.confirmEntryDiscard = async action => !entryHasChanges() || await showCustomConfirm('Draft belum disimpan',
        `Draft yang sedang diisi akan dibuang saat ${action.toLowerCase()}. Lanjutkan?`,'Buang draft');
    window.requestEntryReset = async () => {if (await confirmEntryDiscard('reset form')) resetToNewEntry();};
    window.requestNewEntry = async () => {if (await confirmEntryDiscard('buka transaksi baru')) resetToNewEntry();};
    window.addEventListener('beforeunload',event => {if (appState.currentUser && entryHasChanges()) {event.preventDefault(); event.returnValue = '';}});
    document.addEventListener('DOMContentLoaded',() => {
        for (const definition of Object.values(definitions)) if (definition[1]) document.getElementById(definition[1]).textContent = 'Belum dimuat';
        ['tmTodayTotal','tmAvgDaily','tmAvgWeekly','tmAvgMonthly','tmAvgYearly'].forEach(id => {document.getElementById(id).textContent = 'Belum dimuat';});
    });
})();
