/* A month is a data state, with its own reversible visual handoff. */
(function () {
    'use strict';
    let revision=0, current=null, lastKey='';
    const reduced=()=>Boolean(window.csmMotion?.isReduced());
    const keyOf=period=>`${period.start.getFullYear()}-${String(period.start.getMonth()+1).padStart(2,'0')}`;
    function visible(el) { const rect=el.getBoundingClientRect();return el.getClientRects().length&&rect.bottom>0&&rect.top<innerHeight; }
    function status() {
        const page=document.getElementById('page-dashboard');
        let el=page.querySelector('.period-motion-status');
        if(!el) {
            el=document.createElement('div');el.className='period-motion-status';el.setAttribute('role','status');el.setAttribute('aria-live','polite');
            el.innerHTML='<span class="period-status-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" pathLength="1"></circle><path d="M6.5 12.5 10.5 16.5 17.5 8" pathLength="1"></path></svg></span><span class="period-status-label"></span>';
            (page.querySelector('.welcome-strip > div')||page.querySelector('.page-heading > div'))?.appendChild(el);
        }
        return el;
    }
    function setStatus(state, label) {
        const page=document.getElementById('page-dashboard'),el=status(),text=el.querySelector('.period-status-label');
        page.dataset.periodState=state;
        el.setAttribute('aria-busy',String(state==='loading'));
        if(window.csmMotion?.text)csmMotion.text(text,label,{direction:current?.direction||1});else text.textContent=label;
    }
    function dispose(state) {
        if(!state)return;
        for(const ghost of state.ghosts) {window.csmMotion?.cancel(ghost);ghost.remove();}
        state.ghosts.length=0;
    }
    function capture(state) {
        const page=document.getElementById('page-dashboard');
        page.querySelectorAll('.heatmap-cell').forEach(el=>{
            const day=el.querySelector('b')?.textContent;
            state.cells.set(day,{rect:el.getBoundingClientRect(),color:getComputedStyle(el).backgroundColor});
        });
        if(reduced())return;
        [...page.querySelectorAll('canvas:not(.period-motion-stage)')].filter(visible).slice(0,5).forEach(canvas=>{
            try {
                const ghost=document.createElement('canvas'),parent=canvas.parentElement,rect=canvas.getBoundingClientRect(),box=parent.getBoundingClientRect();
                ghost.width=canvas.width;ghost.height=canvas.height;ghost.getContext('2d').drawImage(canvas,0,0);
                ghost.className='period-motion-stage';ghost.setAttribute('aria-hidden','true');
                Object.assign(ghost.style,{position:'absolute',left:`${rect.left-box.left}px`,top:`${rect.top-box.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,pointerEvents:'none'});
                parent.appendChild(ghost);state.ghosts.push(ghost);
            } catch (_) { /* Geometry updates still work if a canvas cannot be copied. */ }
        });
    }
    function begin(period,{previous='',direction=0}={}) {
        dispose(current);
        const key=keyOf(period),old=previous||lastKey;
        const state={ticket:++revision,key,direction:direction||(!old||key>old?1:-1),ghosts:[],cells:new Map(),changed:Boolean(old&&key!==old)};
        current=state;
        if(state.changed)capture(state);
        setStatus('loading',`Memuat ${period.label}…`);
        const controls=document.querySelector('#page-dashboard .period-controls');
        if(state.changed&&!reduced())window.csmMotion?.spring?.(controls,{from:state.direction*9,to:0,property:'translateX',duration:650,stiffness:250,damping:24});
        return {
            commit(render,actualPeriod=period) {
                if(state.ticket!==revision)return false;
                render();lastKey=state.key=keyOf(actualPeriod);
                const page=document.getElementById('page-dashboard');page.dataset.periodKey=state.key;
                setStatus('ready',actualPeriod.label);
                if(state.changed&&!reduced()) {
                    const movement=state.direction*26;
                    for(const ghost of [...state.ghosts]) {
                        const release=()=>{ghost.remove();const index=state.ghosts.indexOf(ghost);if(index>=0)state.ghosts.splice(index,1);};
                        const finish=window.csmMotion?.play(ghost,[{opacity:1,transform:'translateX(0)'},{opacity:0,transform:`translateX(${-movement/2}px)`}],{duration:260});
                        if(finish)finish.then(release);else release();
                    }
                    const panels=[...page.querySelectorAll('.analytics-panel')].filter(visible);
                    panels.slice(0,6).forEach((panel,index)=>{
                        window.csmMotion?.spring?.(panel,{from:movement,to:0,property:'translateX',duration:740+index*25,stiffness:220,damping:23});
                        const canvas=panel.querySelector('canvas:not(.period-motion-stage)');
                        if(canvas)window.csmMotion?.reveal(canvas,{distance:0,duration:420,delay:index*24});
                    });
                    page.querySelectorAll('.heatmap-cell').forEach((cell,index)=>{
                        const old=state.cells.get(cell.querySelector('b')?.textContent),next=cell.getBoundingClientRect();
                        const x=old?old.rect.left-next.left:state.direction*14,y=old?old.rect.top-next.top:8;
                        window.csmMotion?.play(cell,[{opacity:.45,transform:`translate(${x}px,${y}px) scale(.84)`,backgroundColor:old?.color||getComputedStyle(cell).backgroundColor},
                            {opacity:1,transform:'translate(0,0) scale(1)',backgroundColor:getComputedStyle(cell).backgroundColor}],{duration:620,delay:Math.min(160,index*7)});
                    });
                    window.csmMotion?.particles?.(controls,{count:6});
                    page.dataset.periodMotion='changed';
                } else {dispose(state);page.dataset.periodMotion='stable';}
                window.csmStoryMotion?.refresh(page);
                return true;
            },
            error() {if(state.ticket!==revision)return;dispose(state);setStatus('error',`${period.label} · Coba lagi`);},
            cancel() {if(state.ticket!==revision)return;revision++;dispose(state);current=null;}
        };
    }
    function cancel() {revision++;dispose(current);current=null;}
    window.csmPeriodMotion={begin,cancel,keyOf};
    document.addEventListener('visibilitychange',()=>{if(document.hidden)dispose(current);});
})();
