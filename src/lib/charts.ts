import Chart from 'chart.js/auto';

export const COLORS = [
    { main: 'rgba(59, 130, 246, 0.8)', border: '#3b82f6' },  // Blue
    { main: 'rgba(239, 68, 68, 0.8)', border: '#ef4444' },   // Red
    { main: 'rgba(234, 179, 8, 0.8)', border: '#eab308' },   // Yellow
    { main: 'rgba(34, 197, 94, 0.8)', border: '#22c55e' },   // Green
    { main: 'rgba(168, 85, 247, 0.8)', border: '#a855f7' },  // Purple
    { main: 'rgba(6, 182, 212, 0.8)', border: '#06b6d4' },   // Cyan
    { main: 'rgba(236, 72, 153, 0.8)', border: '#ec4899' },  // Pink
    { main: 'rgba(249, 115, 22, 0.8)', border: '#f97316' },  // Orange
    { main: 'rgba(14, 165, 233, 0.8)', border: '#0ea5e9' },  // Sky
    { main: 'rgba(132, 204, 22, 0.8)', border: '#84cc16' },  // Lime
    { main: 'rgba(99, 102, 241, 0.8)', border: '#6366f1' },  // Indigo
    { main: 'rgba(244, 63, 94, 0.8)', border: '#f43f5e' },   // Rose
    { main: 'rgba(245, 158, 11, 0.8)', border: '#f59e0b' },  // Amber
    { main: 'rgba(20, 184, 166, 0.8)', border: '#14b8a6' },  // Teal
    { main: 'rgba(217, 70, 239, 0.8)', border: '#d946ef' },  // Fuchsia
];

export function getGradient(ctx: CanvasRenderingContext2D, color: string) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, color.replace('0.8', '0.1'));
    return gradient;
}

export function getCssVar(name: string) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function getTrendOptions() {
    const textMain = getCssVar('--text-main') || '#f8fafc';
    const textMuted = getCssVar('--text-muted') || '#94a3b8';
    const borderColor = getCssVar('--border-color') || 'rgba(255, 255, 255, 0.08)';
    const bgCard = getCssVar('--bg-card') || 'rgba(15, 23, 42, 0.95)';

    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        color: textMuted,
        scales: {
            x: {
                title: { display: true, text: 'Payload Size', color: textMuted, font: { weight: 'bold' } },
                grid: { color: borderColor },
                ticks: { color: textMuted, font: { family: 'Inter', size: 10 } }
            },
            y: {
                type: 'logarithmic' as const,
                title: { display: true, text: 'Time (ms)', color: textMuted, font: { weight: 'bold' } },
                grid: { color: borderColor },
                ticks: {
                    color: textMuted,
                    font: { family: 'Inter', size: 10 },
                    callback: function (value: any) {
                        const num = typeof value === 'number' ? value : parseFloat(value);
                        if (isNaN(num)) return value;
                        if (num >= 1000) return (num / 1000).toFixed(0) + 's';
                        if (num >= 1) return num.toFixed(0) + 'ms';
                        return num.toFixed(3) + 'ms';
                    }
                }
            }
        },
        plugins: {
            legend: {
                display: true,
                position: 'top',
                padding: 10,
                labels: {
                    usePointStyle: true,
                    boxWidth: 4,
                    boxHeight: 4,
                    font: { family: 'Inter', size: 12 },
                    padding: 10,
                    color: textMuted
                }
            },
            tooltip: {
                backgroundColor: bgCard,
                titleColor: textMain,
                bodyColor: textMuted,
                borderColor: borderColor,
                borderWidth: 1,
                padding: 12,
                cornerRadius: 12,
                boxPadding: 6,
                bodyFont: { family: 'Inter', size: 12 },
                callbacks: {
                    label: (context: any) => {
                        let label = context.dataset.label || '';
                        if (label) label += ': ';
                        if (context.parsed.y !== null) {
                            const val = context.parsed.y;
                            const isRatioChart = context.chart.options.scales?.y?.ticks?.callback?.(1)?.includes('%');

                            if (isRatioChart) {
                                label += (typeof val === 'number' ? val.toFixed(2) : val) + '%';
                            } else {
                                label += (typeof val === 'number' ? (val < 1 ? val.toFixed(4) : val.toFixed(2)) : val);
                                label += ' ms';
                            }
                        }
                        return label;
                    }
                }
            }
        }
    } as any;
}

export const DASH_PATTERNS = [
    [],              // Solid
    [5, 5],          // Dashed
    [2, 2],          // Dotted
    [10, 5],         // Long dash
    [5, 2, 2, 2],    // Dash-dot
    [15, 3, 3, 3],   // Very long dash-dot
    [1, 5],          // Sparse dots
    [10, 2, 2, 2, 2, 2], // Complex pattern (modified from 8 to 10)
];

export function mapVal(v: any) {
    if (v === -1 || v === -2 || v === undefined || v === null) return null;
    return Math.max(v, 0.0001);
}

export function createTrendChart(canvas: HTMLCanvasElement, title: string, yLabel: string, isRatio = false, labels: string[] = ['128B', '1KB', '10KB', '100KB', '1MB', '10MB', '100MB', '1GB']) {
    const textMain = getCssVar('--text-main') || '#f8fafc';
    const options = getTrendOptions();

    options.plugins.title = {
        display: !!title,
        text: title,
        color: textMain,
        font: { family: 'Outfit', size: 16, weight: '800' },
        padding: { bottom: 20 }
    };
    options.scales.y.title.text = yLabel;

    if (isRatio) {
        options.scales.y.type = 'linear';
        options.scales.y.beginAtZero = true;
        options.scales.y.title.text = 'Compression Ratio (%)';
        options.scales.y.ticks.callback = (v: any) => typeof v === 'number' ? v.toFixed(0) + '%' : v;
    }

    return new Chart(canvas, {
        type: 'line',
        data: { labels, datasets: [] },
        options: options
    });
}

export function applyThemeToChart(chart: any) {
    if (!chart || !chart.options) return;
    const options = getTrendOptions();
    const textMain = getCssVar('--text-main') || '#f8fafc';

    // Copy new theme properties onto the existing chart instance safely
    if (chart.options.color !== undefined) chart.options.color = options.color;
    if (chart.options.scales?.x) {
        const xScale = chart.options.scales.x as any;
        xScale.grid = options.scales.x.grid;
        xScale.ticks = { ...xScale.ticks, ...options.scales.x.ticks };
        if (xScale.title) xScale.title.color = options.scales.x.title.color;
    }
    if (chart.options.scales?.y) {
        const yScale = chart.options.scales.y as any;
        yScale.grid = options.scales.y.grid;
        yScale.ticks = { ...yScale.ticks, ...options.scales.y.ticks };
        if (yScale.title) yScale.title.color = options.scales.y.title.color;
    }
    if (chart.options.plugins?.legend?.labels && options.plugins?.legend?.labels) {
        chart.options.plugins.legend.labels.color = options.plugins.legend.labels.color;
    }
    if (chart.options.plugins?.tooltip) {
        chart.options.plugins.tooltip.backgroundColor = options.plugins.tooltip.backgroundColor;
        chart.options.plugins.tooltip.titleColor = options.plugins.tooltip.titleColor;
        chart.options.plugins.tooltip.bodyColor = options.plugins.tooltip.bodyColor;
        chart.options.plugins.tooltip.borderColor = options.plugins.tooltip.borderColor;
    }
    if (chart.options.plugins?.title) {
        chart.options.plugins.title.color = textMain;
    }

    chart.update();
}
