/* Reveal actual sections as they enter the viewport. No scroll polling or hidden
   no-JavaScript state; inactive pages release observers, listeners and physics. */
(function () {
    'use strict';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    const seen = new WeakSet(), revealing = new Set();
    const opacityAnimations = new Set();
    let currentPage, sectionObserver, contentObserver, stateObserver;
    let candidates = [], chapters = [], progress, scrollFrame = 0, scanFrame = 0;
    let hasScrolled = false, destroyed = false, tiltCard, tiltFrame = 0, pointer;

    function activePage() {
        const app = document.querySelector('.app-container.active');
        const page = app?.querySelector('.page.active');
        return page?.getClientRects().length ? page : null;
    }
    function cleanTilt() {
        cancelAnimationFrame(tiltFrame); tiltFrame = 0; pointer = null;
        if (tiltCard) {
            tiltCard.classList.remove('motion-tilt-active');
            ['--motion-tilt-x', '--motion-tilt-y', '--motion-tilt-angle'].forEach(name => tiltCard.style.removeProperty(name));
        }
        tiltCard = null;
    }
    function clearPage() {
        sectionObserver?.disconnect(); contentObserver?.disconnect();
        sectionObserver = contentObserver = null;
        cancelAnimationFrame(scrollFrame); cancelAnimationFrame(scanFrame);
        scrollFrame = scanFrame = 0;
        for (const el of revealing) window.csmMotion?.cancel(el);
        revealing.clear();
        for (const animation of opacityAnimations) animation.cancel();
        opacityAnimations.clear();
        for (const el of candidates) delete el.dataset.storyState;
        candidates = chapters = [];
        progress?.remove(); progress = null;
        currentPage?.querySelector('.story-progress-host')?.classList.remove('story-progress-host');
        document.documentElement.removeAttribute('data-story-active');
        document.documentElement.style.removeProperty('--story-scroll-progress');
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onResize);
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerout', onPointerOut);
        cleanTilt(); currentPage = null; hasScrolled = false;
    }
    function revealSection(el, delay) {
        seen.add(el); el.dataset.storyState = 'revealing'; sectionObserver?.unobserve(el);
        if (reduced.matches || !hasScrolled || [...revealing].some(parent => parent.contains(el))) {
            el.dataset.storyState = 'revealed'; return;
        }
        revealing.add(el);
        if (el.animate) {
            const animation = el.animate([{opacity: .5}, {opacity: 1}], {duration: 260, delay, easing: 'ease-out', fill: 'backwards'});
            opacityAnimations.add(animation);
            animation.finished.catch(() => {}).finally(() => opacityAnimations.delete(animation));
        }
        const motion = window.csmMotion;
        const finished = motion?.spring ? motion.spring(el, {from: 16, to: 0, property: 'translateY', duration: 650, delay, stiffness: 240, damping: 27, mass: 1}) :
            motion?.reveal(el, {distance: 14, duration: 480, delay});
        Promise.resolve(finished).finally(() => {
            revealing.delete(el);
            if (el.isConnected && el.dataset.storyState) el.dataset.storyState = 'revealed';
        });
    }
    function buildProgress() {
        progress?.remove(); progress = null;
        const heading = currentPage?.querySelector('.page-heading');
        heading?.classList.remove('story-progress-host');
        if (!heading || chapters.length < 2) {
            document.documentElement.removeAttribute('data-story-active'); return;
        }
        progress = document.createElement('div');
        progress.className = 'story-progress'; progress.setAttribute('role', 'progressbar');
        progress.setAttribute('aria-label', 'Posisi halaman'); progress.setAttribute('aria-valuemin', '0'); progress.setAttribute('aria-valuemax', '100');
        for (let i = 0; i < Math.min(chapters.length, 12); i++) {
            const segment = document.createElement('span'); segment.setAttribute('aria-hidden', 'true'); progress.appendChild(segment);
        }
        heading.classList.add('story-progress-host'); heading.appendChild(progress);
        document.documentElement.dataset.storyActive = 'true'; updateProgress();
    }
    function scan() {
        if (!currentPage || currentPage !== activePage()) return;
        sectionObserver?.disconnect();
        const next = [...currentPage.querySelectorAll('.panel,.glass-card,.inventory-card,.location-card,.entry-aside')].filter(el => {
            if (el.matches('.inventory-card,.location-card')) return true;
            return !el.parentElement.closest('.panel,.glass-card,.entry-aside');
        });
        candidates = next;
        chapters = next.filter(el => !el.matches('.inventory-card,.location-card'));
        for (const [index, el] of next.entries()) {
            if (!el.dataset.storySection) {
                el.dataset.storySection = el.querySelector('h2,h3,.card-title')?.textContent.trim() || `Bagian ${index + 1}`;
            }
            if (seen.has(el)) { el.dataset.storyState = 'revealed'; continue; }
            if (el.getBoundingClientRect().top < innerHeight - 24 || reduced.matches || !sectionObserver) {
                seen.add(el); el.dataset.storyState = 'revealed';
            } else { el.dataset.storyState = 'pending'; sectionObserver.observe(el); }
        }
        buildProgress();
    }
    function updateProgress() {
        scrollFrame = 0;
        if (!currentPage || currentPage !== activePage() || !progress) return;
        const rect = currentPage.getBoundingClientRect();
        const travel = Math.max(1, rect.height - innerHeight + 80);
        const amount = Math.max(0, Math.min(1, (80 - rect.top) / travel));
        document.documentElement.style.setProperty('--story-scroll-progress', String(amount));
        progress.setAttribute('aria-valuenow', String(Math.round(amount * 100)));
        const segments = [...progress.children];
        segments.forEach((segment, index) => {
            segment.style.setProperty('--story-chapter-progress', String(Math.max(0, Math.min(1, amount * segments.length - index))));
        });
    }
    function onScroll() {
        hasScrolled = true;
        if (!scrollFrame) scrollFrame = requestAnimationFrame(updateProgress);
    }
    function onResize() { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateProgress); }
    function applyTilt() {
        tiltFrame = 0;
        if (!pointer || !tiltCard?.isConnected || !finePointer.matches || reduced.matches) return;
        const rect = tiltCard.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, (pointer.x - rect.left) / rect.width * 2 - 1));
        const y = Math.max(-1, Math.min(1, (pointer.y - rect.top) / rect.height * 2 - 1));
        const magnitude = Math.min(1, Math.hypot(x, y));
        const length = Math.hypot(x, y) || 1;
        tiltCard.style.setProperty('--motion-tilt-x', String(-y / length));
        tiltCard.style.setProperty('--motion-tilt-y', String(x / length));
        tiltCard.style.setProperty('--motion-tilt-angle', `${(magnitude * 2.4).toFixed(2)}deg`);
    }
    function onPointerMove(event) {
        if (!finePointer.matches || reduced.matches || event.pointerType === 'touch') return;
        const card = event.target.closest?.('.inventory-card');
        if (!card || !currentPage?.contains(card)) { cleanTilt(); return; }
        if (card !== tiltCard) { cleanTilt(); tiltCard = card; card.classList.add('motion-tilt-active'); }
        pointer = {x: event.clientX, y: event.clientY};
        if (!tiltFrame) tiltFrame = requestAnimationFrame(applyTilt);
    }
    function onPointerOut(event) {
        if (tiltCard && !tiltCard.contains(event.relatedTarget)) cleanTilt();
    }
    function bind(page) {
        clearPage();
        if (!page || destroyed || document.hidden) return;
        currentPage = page;
        if ('IntersectionObserver' in window) {
            sectionObserver = new IntersectionObserver(entries => {
                let index = 0;
                for (const entry of entries) {
                    if (entry.isIntersecting && entry.target.dataset.storyState === 'pending') revealSection(entry.target, Math.min(index++ * 28, 100));
                }
            }, {threshold: .08, rootMargin: '0px 0px -20px 0px'});
        }
        contentObserver = new MutationObserver(records => {
            const changed = records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 &&
                (node.matches('.panel,.glass-card,.inventory-card,.location-card') || node.querySelector('.panel,.glass-card,.inventory-card,.location-card'))));
            if (changed && !scanFrame) scanFrame = requestAnimationFrame(() => { scanFrame = 0; scan(); });
        });
        contentObserver.observe(page, {childList: true, subtree: true});
        window.addEventListener('scroll', onScroll, {passive: true});
        window.addEventListener('resize', onResize, {passive: true});
        if (finePointer.matches && !reduced.matches) {
            document.addEventListener('pointermove', onPointerMove, {passive: true});
            document.addEventListener('pointerout', onPointerOut, {passive: true});
        }
        scan();
    }
    function refresh(page) {
        if (destroyed) return;
        const active = page && page === activePage() ? page : activePage();
        if (active !== currentPage) bind(active);
        else if (active) scan();
    }
    function onVisibility() { if (document.hidden) clearPage(); else refresh(); }
    function onPreference() { bind(activePage()); }
    function destroy() {
        destroyed = true; clearPage(); stateObserver?.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        reduced.removeEventListener?.('change', onPreference); finePointer.removeEventListener?.('change', onPreference);
    }
    function ready() {
        stateObserver = new MutationObserver(() => { const active = activePage(); if (active !== currentPage) bind(active); });
        const app = document.querySelector('.app-container');
        if (app) stateObserver.observe(app, {attributes: true, attributeFilter: ['class']});
        document.querySelectorAll('.page').forEach(page => stateObserver.observe(page, {attributes: true, attributeFilter: ['class']}));
        document.addEventListener('visibilitychange', onVisibility);
        reduced.addEventListener?.('change', onPreference); finePointer.addEventListener?.('change', onPreference);
        refresh();
    }
    window.csmStoryMotion = {refresh, destroy};
    window.addEventListener('pagehide', destroy);
    window.addEventListener('pageshow', event => { if (event.persisted) { destroyed = false; ready(); } });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, {once: true}); else ready();
})();
