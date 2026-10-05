/* Stored appearance only: no inventory state or network requests. */
(function () {
    'use strict';
    const storageKey = 'csm-online-theme';
    let saved = 'light';
    try { const value = localStorage.getItem(storageKey); if (value === 'dark' || value === 'light') saved = value; } catch (_) {}
    document.documentElement.dataset.theme = saved;

    function colors() {
        const style = getComputedStyle(document.documentElement);
        const value = name => style.getPropertyValue(name).trim();
        return { text:value('--text-secondary'), grid:value('--border-subtle'), surface:value('--surface-1'), track:value('--surface-3'), tooltip:value('--tooltip-bg'), tooltipText:value('--tooltip-text') };
    }
    function styleChart(chart) {
        const palette = colors(), options = chart.options;
        options.color = palette.text;
        for (const scale of Object.values(options.scales || {})) {
            if (scale.ticks) scale.ticks.color = palette.text;
            if (scale.grid) scale.grid.color = palette.grid;
        }
        if (options.plugins?.legend?.labels) options.plugins.legend.labels.color = palette.text;
        if (options.plugins?.tooltip) {
            Object.assign(options.plugins.tooltip, { backgroundColor:palette.tooltip, titleColor:palette.tooltipText, bodyColor:palette.tooltipText });
        }
        for (const dataset of chart.data.datasets) {
            if (chart.config.type === 'doughnut') dataset.borderColor = palette.surface;
            if (chart.canvas.id === 'chartOpname') dataset.backgroundColor[1] = palette.track;
            if (chart.canvas.id === 'chartLocationOpname' && dataset.label === 'Belum opname') dataset.backgroundColor = palette.track;
        }
    }
    function refreshCharts() {
        if (!window.Chart) return;
        const palette = colors();
        Chart.defaults.color = palette.text;
        Chart.defaults.scale.grid.color = palette.grid;
        Object.values(Chart.instances || {}).forEach(chart => chart.update('none'));
    }
    function updateButtons() {
        const dark = document.documentElement.dataset.theme === 'dark';
        document.querySelectorAll('[data-theme-toggle]').forEach(button => {
            button.setAttribute('aria-label', `Aktifkan ${dark ? 'Light' : 'Dark'} mode`);
            button.setAttribute('title', `Aktifkan ${dark ? 'Light' : 'Dark'} mode`);
            button.innerHTML = `<i class="fas fa-${dark ? 'sun' : 'moon'}" aria-hidden="true"></i><span>${dark ? 'Light' : 'Dark'}</span>`;
        });
    }
    function apply(theme, persist = true) {
        if (theme !== 'light' && theme !== 'dark') return;
        document.documentElement.dataset.theme = theme;
        if (persist) { try { localStorage.setItem(storageKey, theme); } catch (_) {} }
        updateButtons(); refreshCharts();
    }
    window.toggleWorkspaceTheme = () => apply(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    window.csmTheme = { apply, refreshCharts };
    document.addEventListener('DOMContentLoaded', () => {
        if (window.Chart) Chart.register({ id:'csmAppearance', beforeUpdate:styleChart });
        updateButtons(); refreshCharts();
    });
    window.addEventListener('storage', event => { if (event.key === storageKey) apply(event.newValue === 'dark' ? 'dark' : 'light', false); });
})();
