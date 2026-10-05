/* Chart entrances use existing values; theme updates remain instant via update('none'). */
(function () {
    'use strict';
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const states = new WeakMap();
    const renderedByCanvas = new WeakMap();
    const requests = new WeakMap();
    const instances = new Set();
    const quietModes = new Set(['none', 'resize', 'reset', 'active']);
    let registered = false;

    function fingerprint(chart) {
        try {
            // A date filter can change while two empty months still have identical 1–31 labels.
            const period = chart.canvas?.closest?.('#page-dashboard') ? document.getElementById('dashboardMonth')?.value : '';
            return JSON.stringify([chart.config.type, period || '', chart.data.labels || [], chart.data.datasets.map(dataset => dataset.data)]);
        } catch (_) { return null; }
    }

    function mergeOptions(base, next) {
        const result = { ...(base || {}) };
        for (const [key, value] of Object.entries(next || {})) {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
            if (value && Object.prototype.toString.call(value) === '[object Object]') result[key] = mergeOptions(result[key], value);
            else result[key] = Array.isArray(value) ? value.slice() : value;
        }
        return result;
    }

    function reduced() {
        return preference.matches || Boolean(window.csmMotion?.isReduced?.());
    }
    function pointIndex(context) {
        return Math.max(0, Number(context.dataIndex ?? context.index) || 0);
    }
    function pointCount(context) {
        return Math.max(1, context.chart.data.datasets[context.datasetIndex]?.data?.length || 1);
    }
    function entering(context) {
        return context.type === 'data' && !quietModes.has(context.mode) &&
            !reduced() && states.get(context.chart)?.entering;
    }
    function stagger(context, budget, datasetStep = 18) {
        if (!entering(context)) return 0;
        const count = pointCount(context);
        const progress = count > 1 ? Math.min(1, pointIndex(context) / (count - 1)) : 0;
        return Math.round(progress * budget + Math.min(3, context.datasetIndex || 0) * datasetStep);
    }
    function previousY(context) {
        if (!entering(context)) return undefined;
        const chart = context.chart, index = pointIndex(context);
        const prior = index > 0 ? chart.getDatasetMeta(context.datasetIndex).data[index - 1] : null;
        const value = prior?.getProps(['y'], true)?.y;
        if (Number.isFinite(value)) return value;
        const scale = chart.scales.y;
        return scale ? scale.getPixelForValue(scale.min) : undefined;
    }
    function configure(chart, state) {
        const options = chart.config.options;
        if (reduced() || state.repeated || state.instant) {
            options.animation = false;
            return;
        }
        options.animation = state.animation;
        options.animations = state.animations;
        options.transitions = state.transitions;
    }
    function profile(chart, options, state) {
        const type = chart.config.type;
        const existing = options.animation && typeof options.animation === 'object' ? options.animation : {};
        const animations = mergeOptions({}, options.animations);
        const transitions = mergeOptions({}, options.transitions);
        state.userOptions = mergeOptions({}, options);
        state.animation = { ...existing, duration:state.drawn ? 680 : type === 'doughnut' ? 700 : 540, easing:'easeOutQuart', loop:false };
        state.animations = animations;
        state.transitions = transitions;
        if (type === 'bar') {
            state.animation.delay = context => stagger(context, 150);
        } else if (type === 'doughnut' || type === 'pie') {
            Object.assign(state.animation, { animateRotate:true, animateScale:false, delay:0 });
        } else if (type === 'line') {
            // Initial points appear in order; later updates flow from their current positions.
            animations.x = { ...(animations.x || {}), type:'number', easing:'easeOutQuart', duration:state.drawn ? 560 : 160,
                from:context => entering(context) ? NaN : undefined,
                delay:context => stagger(context, 360, 20) };
            animations.y = { ...(animations.y || {}), type:'number', easing:'easeOutQuart', duration:state.drawn ? 680 : 400,
                from:previousY, delay:context => stagger(context, 360, 20) };
        }
        // Hover stays precise and resize never sends bars back to the baseline.
        transitions.active = { ...(transitions.active || {}), animation:{ ...(transitions.active?.animation || {}), duration:120, delay:0 } };
        transitions.resize = { ...(transitions.resize || {}), animation:{ ...(transitions.resize?.animation || {}), duration:0, delay:0 } };
    }
    function beforeInit(chart) {
        const options = chart.config.options;
        const value = fingerprint(chart);
        const canvas = chart.canvas;
        const repeated = canvas && value !== null && renderedByCanvas.get(canvas) === value;
        const state = {
            entering:!repeated, drawn:Boolean(repeated), repeated:Boolean(repeated),
            instant:requests.get(canvas)?.animate === false,
            fingerprint:value
        };
        profile(chart, options, state);
        states.set(chart, state); instances.add(chart);
        if (canvas && value !== null) renderedByCanvas.set(canvas, value);
        configure(chart, state);
    }
    function render(canvas, config, { animate = true } = {}) {
        if (!window.Chart || !canvas) return null;
        register();
        const element = typeof canvas === 'string' ? document.getElementById(canvas) : canvas.canvas || canvas;
        if (!element) return null;
        let chart = Chart.getChart?.(element) || [...instances].find(value => value.canvas === element);
        if (chart && chart.config.type !== config.type) { chart.destroy(); chart = null; }
        if (!chart) {
            requests.set(element, { animate });
            const options = mergeOptions({}, config.options);
            if (!animate || reduced()) options.animation = false;
            try { return new Chart(element, { ...config, options }); }
            finally { requests.delete(element); }
        }

        const state = states.get(chart);
        const nextFingerprint = fingerprint({ canvas:element, config, data:config.data });
        const changed = nextFingerprint === null || nextFingerprint !== (state?.fingerprint ?? renderedByCanvas.get(element));
        const shouldAnimate = animate && changed && !reduced();
        if (state && !state.drawn) {
            // Complete an unfinished point reveal before reusing those point positions for a morph.
            state.drawn = true; state.entering = false;
            chart.stop(); configure(chart, state); chart.update('none');
        }
        const previous = chart.data.datasets;
        chart.data = { ...config.data, labels:Array.isArray(config.data.labels) ? config.data.labels.slice() : config.data.labels,
            datasets:config.data.datasets.map((incoming, index) => {
                const dataset = previous[index];
                if (!dataset) return { ...incoming };
                for (const key of Object.keys(dataset)) if (!Object.prototype.hasOwnProperty.call(incoming, key)) delete dataset[key];
                return Object.assign(dataset, incoming);
            }) };
        const options = mergeOptions(state?.userOptions || {}, config.options);
        chart.options = options;
        if (state) {
            state.drawn = true; state.entering = false; state.repeated = false; state.instant = false; state.fingerprint = nextFingerprint;
            profile(chart, options, state); configure(chart, state);
        }
        if (nextFingerprint !== null) renderedByCanvas.set(element, nextFingerprint);
        chart.update(shouldAnimate ? undefined : 'none');
        return chart;
    }
    function refresh() {
        for (const chart of instances) {
            const state = states.get(chart);
            if (!state) continue;
            configure(chart, state);
            chart.stop();
            chart.update('none');
        }
    }
    function register() {
        if (registered || !window.Chart) return;
        Chart.register({
            id:'csm-chart-motion',
            beforeInit,
            beforeUpdate(chart, args) {
                // Finish an in-flight entrance before applying an instant theme or size redraw.
                if (args.mode === 'none' || args.mode === 'resize' || reduced()) chart.stop();
                const state = states.get(chart);
                if (state) state.entering = !state.drawn && !quietModes.has(args.mode) && !reduced();
            },
            afterRender(chart) {
                const state = states.get(chart);
                if (state) {
                    state.drawn = true; state.entering = false;
                    if (state.repeated || state.instant) { state.repeated = false; state.instant = false; configure(chart, state); }
                }
            },
            afterDestroy(chart) { instances.delete(chart); states.delete(chart); }
        });
        registered = true;
    }
    if (preference.addEventListener) preference.addEventListener('change', refresh);
    else if (preference.addListener) preference.addListener(refresh);
    window.csmChartMotion = { refresh, render };
    register();
    document.addEventListener('DOMContentLoaded', register, { once:true });
})();
