/* Motion follows UI state. Cancellation must never undo a newer user action. */
(function () {
    'use strict';
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const animations = new WeakMap(), versions = new WeakMap(), returnFocus = new WeakMap(), springStates = new WeakMap(), effects = new WeakMap();
    const active = new Set(), pending = new Map();
    const visualCleanups = new Set();
    const ease = 'cubic-bezier(.16,1,.3,1)';
    let surfaceVersion = 0, transition, loadingTimer, loadingVersion = 0, progress, lastBurst, lastMorph;
    document.documentElement.classList.add('motion-enabled');
    function version(el) { const value = (versions.get(el) || 0) + 1; versions.set(el,value); return value; }
    function cancel(el) {
        if (!el) return;
        version(el);
        const animation = animations.get(el);
        if (animation) { animation.cancel(); active.delete(animation); animations.delete(el); }
        springStates.delete(el);
        [...(effects.get(el)?.values() || [])].forEach(cleanup => cleanup());
    }
    function play(el, frames, options = {}) {
        if (!el) return Promise.resolve(false);
        // Reverse an interrupted interaction from its current pixels, avoiding a snap.
        const {retainFirst=false, ...timing}=options;
        if (!retainFirst && animations.has(el) && Array.isArray(frames) && frames.length > 1) {
            const current=getComputedStyle(el), first={...frames[0]};
            Object.keys(first).forEach(property => {
                if(!['overflow','offset','easing','composite'].includes(property) && current[property] && current[property]!=='auto')first[property]=current[property];
            });
            frames=[first,...frames.slice(1)];
        }
        cancel(el);
        const token = versions.get(el);
        if (preference.matches || !el.animate) return Promise.resolve().then(() => versions.get(el) === token);
        const animation = el.animate(frames,{ duration:360, easing:ease, ...timing, fill:'backwards' });
        animations.set(el,animation); active.add(animation);
        return animation.finished.then(() => versions.get(el) === token, () => false).finally(() => {
            active.delete(animation);
            if (animations.get(el) === animation) animations.delete(el);
        });
    }
    // Exact solution of m*x'' + damping*x' + stiffness*(x-target) = 0.
    // Sampling the position/velocity also lets an interrupted spring carry momentum.
    function oscillator(state, seconds) {
        const {from,to,velocity,stiffness,damping,mass}=state;
        const displacement=from-to, alpha=damping/(2*mass), omega2=stiffness/mass, difference=omega2-alpha*alpha;
        let value, speed;
        if (Math.abs(difference)<1e-7) {
            const b=velocity+alpha*displacement, decay=Math.exp(-alpha*seconds);
            value=(displacement+b*seconds)*decay; speed=(b-alpha*(displacement+b*seconds))*decay;
        } else if (difference>0) {
            const omega=Math.sqrt(difference), b=(velocity+alpha*displacement)/omega, decay=Math.exp(-alpha*seconds);
            const cosine=Math.cos(omega*seconds), sine=Math.sin(omega*seconds);
            value=decay*(displacement*cosine+b*sine);
            speed=decay*(-alpha*(displacement*cosine+b*sine)-displacement*omega*sine+b*omega*cosine);
        } else {
            const root=Math.sqrt(-difference), r1=-alpha+root, r2=-alpha-root;
            const a=(velocity-r2*displacement)/(r1-r2), b=displacement-a;
            value=a*Math.exp(r1*seconds)+b*Math.exp(r2*seconds);
            speed=a*r1*Math.exp(r1*seconds)+b*r2*Math.exp(r2*seconds);
        }
        return {value:to+value,velocity:speed};
    }
    function spring(el,{from=18,to=0,property='translateY',duration=650,delay=0,stiffness=280,damping=24,mass=1,velocity=0}={}) {
        if (!el) return Promise.resolve(false);
        if (!['translateX','translateY','scale','opacity'].includes(property)) property='translateY';
        const old=springStates.get(el), startTime=performance.now();
        if (old && old.property===property && animations.has(el)) {
            const current=oscillator(old,Math.min(old.duration,Math.max(0,startTime-old.startTime))/1000);
            from=current.value; velocity=current.velocity;
        } else if (animations.has(el)) {
            const computed=getComputedStyle(el);
            if(property==='opacity') {const current=Number.parseFloat(computed.opacity);if(Number.isFinite(current))from=current;}
            else {
                const matrix=computed.transform?.match(/^matrix(3d)?\(([^)]+)\)$/), values=matrix?.[2].split(',').map(Number);
                if(values?.every(Number.isFinite))from=property==='scale'?Math.hypot(values[0],values[1]):values[matrix[1]?(property==='translateX'?12:13):(property==='translateX'?4:5)];
                else if(computed.transform==='none')from=property==='scale'?1:0;
            }
        }
        const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
        delay=Math.min(180,Math.max(0,finite(delay,0)));
        const bounded=value=>Math.max(-10000,Math.min(10000,value));
        const state={from:bounded(finite(from,18)),to:bounded(finite(to,0)),velocity:bounded(finite(velocity,0)),stiffness:Math.min(900,Math.max(1,finite(stiffness,280))),damping:Math.min(120,Math.max(1,finite(damping,24))),mass:Math.min(10,Math.max(.1,finite(mass,1))),duration:Math.min(1200,Math.max(220,finite(duration,650))),property,startTime:startTime+delay};
        const samples=Math.ceil(state.duration/12), frames=[];
        for(let i=0;i<=samples;i++) {
            const value=i===samples?state.to:oscillator(state,state.duration*i/samples/1000).value;
            frames.push(property==='opacity'?{opacity:Math.max(0,Math.min(1,value)),offset:i/samples}:{transform:`${property}(${value}${property==='scale'?'':'px'})`,offset:i/samples});
        }
        const result=play(el,frames,{duration:state.duration,delay,easing:'linear',retainFirst:true});
        springStates.set(el,state);
        return result.finally(()=>{if(springStates.get(el)===state)springStates.delete(el);});
    }
    function setEffect(el,kind,cleanup) {
        effects.get(el)?.get(kind)?.();
        let collection=effects.get(el); if(!collection){collection=new Map();effects.set(el,collection);}
        collection.set(kind,cleanup); visualCleanups.add(cleanup);
    }
    function forgetEffect(el,kind,cleanup) {
        const collection=effects.get(el);
        if(collection?.get(kind)===cleanup){collection.delete(kind);if(!collection.size)effects.delete(el);}
        visualCleanups.delete(cleanup);
    }
    function clearVisuals() { [...visualCleanups].forEach(cleanup=>cleanup()); }
    function visualLayer(className) {
        const layer=document.createElement('div'); layer.className=className;
        layer.setAttribute('aria-hidden','true'); layer.inert=true;
        Object.assign(layer.style,{position:'fixed',pointerEvents:'none',zIndex:'11020'});
        document.body.appendChild(layer); return layer;
    }
    function text(el,value,{direction}={}) {
        if(!el)return Promise.resolve(false);
        const next=String(value), previous=el.textContent;
        if(previous===next)return Promise.resolve(true);
        cancel(el);
        const style=getComputedStyle(el), rect=el.getBoundingClientRect(), shown=el.getClientRects().length;
        el.textContent=next; // Assistive technology gets the real final value immediately.
        if(preference.matches||!el.animate||!shown||!previous||!rect.width||!rect.height)return Promise.resolve(true);
        const layer=visualLayer('motion-text-overlay');
        Object.assign(layer.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,overflow:'hidden',whiteSpace:'pre',color:style.color,textAlign:style.textAlign,zIndex:'90'});
        ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','fontVariantNumeric'].forEach(name=>{layer.style[name]=style[name];});
        const color=el.style.color, fill=el.style.webkitTextFillColor;
        el.style.color='transparent'; el.style.webkitTextFillColor='transparent';
        const travel=direction===-1?-1:direction===1?1:Number(next.replace(/[^\d-]/g,''))<Number(previous.replace(/[^\d-]/g,''))?-1:1;
        const tasks=[], nodes=[]; let disposed=false, timer;
        const cleanup=()=>{
            if(disposed)return;disposed=true;clearTimeout(timer);
            nodes.forEach(node=>cancel(node));layer.remove();el.style.color=color;el.style.webkitTextFillColor=fill;
            forgetEffect(el,'text',cleanup);
        };
        setEffect(el,'text',cleanup);
        const glyphs=previous.length<=28&&next.length<=28;
        [previous,next].forEach((label,rowIndex)=>{
            const row=document.createElement('span');Object.assign(row.style,{position:'absolute',left:'0',right:'0',top:'0',display:'block'});layer.appendChild(row);
            const letters=glyphs?Array.from(label):[label];
            letters.forEach((letter,index)=>{
                const glyph=document.createElement('span');glyph.textContent=letter;glyph.style.display='inline-block';row.appendChild(glyph);nodes.push(glyph);
                const unchanged=glyphs&&previous.length===next.length&&previous[index]===next[index];
                if(unchanged){if(rowIndex===0)glyph.style.opacity='0';return;}
                if(rowIndex===0)glyph.style.opacity='0';
                tasks.push(play(glyph,rowIndex===0?[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:`translateY(${-travel*100}%)`}]:[{opacity:0,transform:`translateY(${travel*100}%)`},{opacity:1,transform:'translateY(0)'}],{duration:420,delay:Math.min(index*16,120)}));
            });
        });
        timer=setTimeout(cleanup,650);
        return Promise.all(tasks).then(results=>{const done=!disposed&&results.every(Boolean);cleanup();return done;});
    }
    function particles(el,{count=10}={}) {
        if(!el||preference.matches||!el.animate||!el.getClientRects().length)return Promise.resolve(false);
        lastBurst?.();
        const rect=el.getBoundingClientRect(), width=typeof innerWidth==='number'?innerWidth:document.documentElement.clientWidth;
        const x=Math.max(16,Math.min(width-16,rect.right-18)), y=Math.max(16,Math.min(innerHeight-16,rect.top+Math.min(28,rect.height/2)));
        const layer=visualLayer('motion-particle-layer');Object.assign(layer.style,{inset:'0',overflow:'hidden'});
        const pieces=[], tasks=[], palette=['#27d6df','#ff8f79','#c9f26b'];let disposed=false,timer;
        const cleanup=()=>{if(disposed)return;disposed=true;clearTimeout(timer);pieces.forEach(piece=>cancel(piece));layer.remove();forgetEffect(el,'particles',cleanup);if(lastBurst===cleanup)lastBurst=null;};
        setEffect(el,'particles',cleanup);lastBurst=cleanup;
        const total=Math.min(14,Math.max(1,Number.isFinite(Number(count))?Math.floor(Number(count)):10));
        for(let i=0;i<total;i++) {
            const piece=document.createElement('span'), size=3+Math.random()*2;
            Object.assign(piece.style,{position:'absolute',left:`${x}px`,top:`${y}px`,width:`${size}px`,height:`${size}px`,background:palette[i%palette.length],borderRadius:i%3?'1px':'50%',opacity:'0'});layer.appendChild(piece);pieces.push(piece);
            const duration=610+Math.random()*150, vx=(Math.random()-.5)*190, vy=-65-Math.random()*125, spin=(Math.random()-.5)*300, frames=[];
            for(let frame=0;frame<=30;frame++){
                const offset=frame/30,t=duration*offset/1000;
                frames.push({transform:`translate(${vx*t}px,${vy*t+260*t*t}px) rotate(${spin*t}deg) scale(${1-offset*.75})`,opacity:offset<.5?1:2*(1-offset),offset});
            }
            tasks.push(play(piece,frames,{duration,easing:'linear'}));
        }
        timer=setTimeout(cleanup,820);
        return Promise.all(tasks).then(results=>{const done=!disposed&&results.every(Boolean);cleanup();return done;});
    }
    function morph(el,state='success') {
        if(!el||preference.matches||!el.animate||!el.getClientRects().length)return Promise.resolve(false);
        lastMorph?.();
        const rect=el.getBoundingClientRect(), layer=visualLayer('motion-morph-layer');
        Object.assign(layer.style,{left:`${rect.right-34}px`,top:`${rect.top+Math.min(14,rect.height/2)}px`,width:'28px',height:'28px',borderRadius:'9px',background:'var(--surface-1)',color:state==='error'?'var(--danger)':'var(--success)',boxShadow:'0 3px 14px rgba(0,0,0,.12)'});
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS('http://www.w3.org/2000/svg','path');
        svg.setAttribute('viewBox','0 0 32 32');Object.assign(svg.style,{display:'block',width:'100%',height:'100%'});
        ['fill','stroke','stroke-width','stroke-linecap','stroke-linejoin'].forEach((name,index)=>path.setAttribute(name,['none','currentColor','2.4','round','round'][index]));svg.appendChild(path);layer.appendChild(svg);
        const points=13, target=state==='error'?[[8,8],[24,24],[16,16],[24,8],[8,24]]:[[6,17],[13,23],[26,8]], lengths=[0];
        for(let i=1;i<target.length;i++)lengths.push(lengths[i-1]+Math.hypot(target[i][0]-target[i-1][0],target[i][1]-target[i-1][1]));
        const start=Array.from({length:points},(_,i)=>{const angle=-Math.PI/2+i/(points-1)*Math.PI*2;return[16+10*Math.cos(angle),16+10*Math.sin(angle)];});
        const end=Array.from({length:points},(_,i)=>{const distance=lengths.at(-1)*i/(points-1);let segment=1;while(segment<lengths.length-1&&lengths[segment]<distance)segment++;const ratio=(distance-lengths[segment-1])/(lengths[segment]-lengths[segment-1]);return[target[segment-1][0]+(target[segment][0]-target[segment-1][0])*ratio,target[segment-1][1]+(target[segment][1]-target[segment-1][1])*ratio];});
        const draw=amount=>path.setAttribute('d',start.map((point,i)=>`${i?'L':'M'}${(point[0]+(end[i][0]-point[0])*amount).toFixed(2)},${(point[1]+(end[i][1]-point[1])*amount).toFixed(2)}`).join(' '));
        let disposed=false, frame, timer, resolve;
        const result=new Promise(done=>{resolve=done;});
        const cleanup=(complete=false)=>{if(disposed)return;disposed=true;cancelAnimationFrame(frame);clearTimeout(timer);cancel(layer);layer.remove();forgetEffect(el,'morph',cleanup);if(lastMorph===cleanup)lastMorph=null;resolve(complete);};
        setEffect(el,'morph',cleanup);lastMorph=cleanup;draw(0);
        spring(layer,{from:.7,to:1,property:'scale',duration:500});
        const started=performance.now();
        const tick=now=>{if(disposed)return;const amount=Math.min(1,Math.max(0,(now-started)/420));draw(1-Math.pow(1-amount,3));if(amount<1)frame=requestAnimationFrame(tick);else{clearTimeout(timer);timer=setTimeout(()=>cleanup(true),180);}};
        frame=requestAnimationFrame(tick);timer=setTimeout(cleanup,760);return result;
    }
    function reveal(el, { distance=12, duration=380, delay=0 } = {}) {
        return play(el,[{opacity:0,transform:`translateY(${distance}px)`},{opacity:1,transform:'translateY(0)'}],{duration,delay});
    }
    function stagger(elements, { distance=9, duration=400, budget=160 } = {}) {
        const visible = [...elements].filter(el => el.getClientRects().length && el.getBoundingClientRect().top < innerHeight + 40).slice(0,16);
        visible.forEach((el,i) => reveal(el,{distance,duration,delay:Math.min(budget,i*28)}));
    }
    function page(el) {
        if (!el) return;
        clearVisuals();
        spring(el,{from:10,to:0,duration:560});
        stagger(el.querySelectorAll('.page-heading,.metric,.panel,.glass-card,.entry-aside,.inventory-summary,.location-card'),{distance:12,duration:460});
    }
    function panelOf(el) { return el.querySelector('.custom-modal-box,.detail-panel,.search-box') || el.firstElementChild || el; }
    function openOverlay(el,{focus=true} = {}) {
        if (!el) return;
        const panel = panelOf(el);
        el.inert = false; el.classList.remove('motion-closing');
        panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true');
        if(!panel.hasAttribute('aria-label'))panel.setAttribute('aria-label',panel.querySelector('h1,h2,h3')?.textContent.trim() || 'Gudang CSM');
        if (!el.contains(document.activeElement)) returnFocus.set(el,document.activeElement);
        play(el,[{opacity:0},{opacity:1}],{duration:200});
        const drawer = panel.classList.contains('detail-panel');
        spring(panel,{from:drawer?42:18,to:0,property:drawer?'translateX':'translateY',duration:620});
        if (focus) (panel.querySelector('input:not([type="file"]):not(:disabled)') || panel.querySelector('button:not(:disabled),[tabindex="0"]'))?.focus({preventScroll:true});
    }
    function closeOverlay(el, finish = () => {}) {
        if (!el) return Promise.resolve(false);
        el.inert = true; el.classList.add('motion-closing');
        const panel = panelOf(el);
        play(panel,[{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:panel.classList.contains('detail-panel') ? 'translateX(24px)' : 'translateY(8px) scale(.985)'}],{duration:180,easing:'cubic-bezier(.4,0,1,1)'});
        return play(el,[{opacity:1},{opacity:0}],{duration:180}).then(done => {
            if (!done) return false;
            finish(); el.classList.remove('motion-closing');
            const target = returnFocus.get(el);
            const top = ['qrModal','changePasswordModal','scanModal','customConfirm','workspaceOverlay'].map(id=>document.getElementById(id)).find(node=>node&&!node.inert&&(node.id==='customConfirm'?node.classList.contains('show'):node.id==='workspaceOverlay'?node.getClientRects().length:node.style.display==='flex'));
            if ((!top || top.contains(target)) && target?.isConnected && !target.closest('[inert]') && target.getClientRects().length) target.focus({preventScroll:true});
            return true;
        });
    }
    function disclosure(el, show, display='block') {
        if (!el) return Promise.resolve(false);
        const reversing=animations.has(el), currentHeight=el.getBoundingClientRect().height;
        const currentOpacity=Number.parseFloat(getComputedStyle(el).opacity);
        cancel(el); el.inert = !show;
        if (show) {
            el.style.display = display;
            const height = el.getBoundingClientRect().height;
            return play(el,[{height:reversing?`${currentHeight}px`:'0px',opacity:reversing&&Number.isFinite(currentOpacity)?currentOpacity:0,overflow:'hidden'},{height:`${height}px`,opacity:1,overflow:'hidden'}],{duration:360});
        }
        return play(el,[{height:`${currentHeight}px`,opacity:Number.isFinite(currentOpacity)?currentOpacity:1,overflow:'hidden'},{height:'0px',opacity:0,overflow:'hidden'}],{duration:220}).then(done => { if (done) el.style.display='none'; return done; });
    }
    function remove(el, finish) {
        if (!el || el.inert) return;
        el.inert = true;
        const style = getComputedStyle(el), height = el.getBoundingClientRect().height;
        play(el,[{height:`${height}px`,opacity:1,transform:'translateX(0)',marginBottom:style.marginBottom,paddingTop:style.paddingTop,paddingBottom:style.paddingBottom,overflow:'hidden'},
            {height:'0px',opacity:0,transform:'translateX(16px)',marginBottom:'0px',paddingTop:'0px',paddingBottom:'0px',overflow:'hidden'}],{duration:240}).then(done => { if (done) { el.remove(); finish?.(); } });
    }
    function insert(el) {
        if (!el) return;
        const height = el.getBoundingClientRect().height;
        return play(el,[{height:'0px',opacity:0,transform:'translateY(10px)',overflow:'hidden'},
            {height:`${height}px`,opacity:1,transform:'translateY(0)',overflow:'hidden'}],{duration:380});
    }
    function pulse(el, tone='success') {
        if (!el) return;
        const name = tone === 'error' ? 'motion-invalid' : 'motion-feedback';
        clearTimeout(el._motionFeedbackTimer); el.classList.remove('motion-invalid','motion-feedback'); el.classList.add(name);
        if (tone === 'error') play(el,[{transform:'translateX(0)'},{transform:'translateX(-3px)'},{transform:'translateX(2px)'},{transform:'translateX(0)'}],{duration:230,easing:'ease-out'});
        else {play(el,[{opacity:.65},{opacity:1}],{duration:300});particles(el,{count:8});morph(el);}
        el._motionFeedbackTimer = setTimeout(() => el.classList.remove(name),950);
    }
    function metric(el,value) {
        return text(el,value);
    }
    function syncProgress() {
        if (!progress) return;
        progress.hidden = pending.size === 0;
        document.querySelector('.top-bar')?.setAttribute('aria-busy',String(pending.size > 0));
    }
    function begin(el) {
        const token = Symbol('operation'); pending.set(token,el);
        if (el) { el.classList.add(el.matches('button') ? 'motion-pending' : 'motion-busy'); el.setAttribute('aria-busy','true'); }
        syncProgress();
        let ended=false;
        return () => {
            if (ended) return; ended=true; pending.delete(token);
            if (el && ![...pending.values()].includes(el)) { el.classList.remove('motion-pending','motion-busy'); el.removeAttribute('aria-busy'); }
            syncProgress();
        };
    }
    function loading(show) {
        const el = document.getElementById('loading');
        const ticket = ++loadingVersion; clearTimeout(loadingTimer); cancel(el);
        if (show) {
            loadingTimer=setTimeout(() => { if(ticket!==loadingVersion)return; el.classList.add('active'); reveal(el,{distance:0,duration:180}); },140);
        } else if (el.classList.contains('active')) {
            play(el,[{opacity:1},{opacity:0}],{duration:150}).then(done => {if(done&&ticket===loadingVersion)el.classList.remove('active');});
        }
    }
    function switchSurface(commit, incoming) {
        clearVisuals();
        const ticket=++surfaceVersion; transition?.skipTransition();
        if (document.startViewTransition && !preference.matches) {
            document.documentElement.classList.add('motion-surface-switch');
            transition=document.startViewTransition(() => { if(ticket===surfaceVersion)return commit(); });
            // A skipped/resized transition rejects ready independently of finished.
            // Its visual abort must never turn a successful login into an unhandled rejection.
            transition.ready?.catch(() => {});
            // Keep DOM-update failures observable, and preserve the original rejection
            // for callers that await the returned update promise.
            transition.updateCallbackDone?.catch(error => console.error('Surface update failed:',error));
            transition.finished.catch(() => {}).finally(() => { if(ticket===surfaceVersion)document.documentElement.classList.remove('motion-surface-switch'); });
            return transition.updateCallbackDone;
        } else { document.documentElement.classList.remove('motion-surface-switch'); commit(); reveal(incoming,{distance:8,duration:400}); }
    }
    function toast(el,hide=false) {
        return play(el,hide ? [{opacity:1,transform:'translateX(-50%) translateY(0)'},{opacity:0,transform:'translateX(-50%) translateY(10px)'}] :
            [{opacity:0,transform:'translateX(-50%) translateY(14px) scale(.98)'},{opacity:1,transform:'translateX(-50%) translateY(0) scale(1)'}],{duration:hide?170:340});
    }
    function trackActions() {
        // Wrapping these operations preserves their async return value and blocks duplicate writes.
        const selectors = {handleLogin:'#loginSubmitBtn',submitEntry:'#btnSubmit',saveOpnameStatus:'#btnSaveOpname',saveAccountRoles:'#btnSaveRoles'};
        ['handleLogin','submitEntry','searchTicket','submitForceChangePassword','submitChangePassword','submitAddMaster','saveMasterEdit','saveOpnameStatus','saveActiveTicketNote','returnTicket','undoReturnTicket','saveAccountRoles'].forEach(name => {
            const original = window[name]; if(typeof original!=='function')return;
            const running=new Map();
            window[name]=function(...args) {
                args[0]?.preventDefault?.();
                const key=typeof args[0]==='string'?args[0]:'operation';
                if(running.has(key))return running.get(key);
                const focused=document.activeElement;
                const button=document.querySelector(selectors[name] || `[onclick^="${name}("]`) || (focused?.matches('button')?focused:null);
                const end=begin(button);
                let result;
                try { result=original.apply(this,args); } catch(error) { end();throw error; }
                const promise=Promise.resolve(result).finally(() => {
                    running.delete(key);end();
                });
                running.set(key,promise);return promise;
            };
        });
    }
    function ready() {
        const top=document.querySelector('.top-bar');
        if(top) { progress=document.createElement('div');progress.className='motion-loading-bar';progress.hidden=true;progress.setAttribute('aria-hidden','true');top.appendChild(progress); }
        trackActions();
        document.addEventListener('invalid',event=>pulse(event.target,'error'),true);
        document.addEventListener('input',event=>event.target.classList.remove('motion-invalid'));
        // Fixed glyph snapshots must not hang in place while their source scrolls.
        document.addEventListener('scroll',clearVisuals,{passive:true,capture:true});
        document.addEventListener('visibilitychange',()=>{if(document.hidden)clearVisuals();});
        window.addEventListener?.('resize',clearVisuals,{passive:true});
        ['loginError','forcePasswordError','passwordError'].forEach(id => {
            const el=document.getElementById(id); if(el)new MutationObserver(() => {if(el.textContent.trim())pulse(el,'error');}).observe(el,{childList:true,subtree:true,characterData:true});
        });
        if(document.getElementById('loginPage')?.getClientRects().length)stagger(document.querySelectorAll('.login-brand-top,.login-headline,.login-box'),{distance:14,duration:600,budget:130});
    }
    preference.addEventListener?.('change',() => {if(preference.matches) {for(const animation of active)animation.finish();clearVisuals();}});
    window.csmMotion={isReduced:()=>preference.matches,cancel,clearVisuals,play,spring,text,particles,morph,reveal,stagger,page,openOverlay,closeOverlay,disclosure,remove,insert,pulse,metric,begin,loading,switchSurface,toast};
    document.addEventListener('DOMContentLoaded',ready,{once:true});
})();
