import Chart from 'chart.js/auto';

export const COLORS = [
    { main: 'rgba(59, 130, 246, 0.8)', border: '#3b82f6' }, // Blue
    { main: 'rgba(16, 185, 129, 0.8)', border: '#10b981' }, // Emerald
    { main: 'rgba(139, 92, 246, 0.8)', border: '#8b5cf6' }, // Violet
    { main: 'rgba(245, 158, 11, 0.8)', border: '#f59e0b' }, // Amber
    { main: 'rgba(239, 68, 68, 0.8)', border: '#ef4444' },  // Red
    { main: 'rgba(14, 165, 233, 0.8)', border: '#0ea5e9' }  // Sky
];

export function getGradient(ctx: CanvasRenderingContext2D, color: string) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, color.replace('0.8', '0.1'));
    return gradient;
}

export const TREND_OPTIONS = {
    responsive: true,
    maintainAspectRatio: false,
    color: '#94a3b8',
    scales: {
        x: {
            title: { display: true, text: 'Payload Size', color: '#94a3b8', font: { weight: 'bold' } },
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 } }
        },
        y: {
            type: 'logarithmic' as const,
            title: { display: true, text: 'Time (ms)', color: '#94a3b8', font: { weight: 'bold' } },
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: {
                color: '#94a3b8',
                font: { family: 'Inter', size: 10 },
                callback: function (value: any) {
                    if (value >= 1000) return (value / 1000).toFixed(0) + 's';
                    if (value >= 1) return value.toFixed(0) + 'ms';
                    return value.toFixed(3) + 'ms';
                }
            }
        }
    },
    plugins: {
        legend: {
            position: 'top' as const,
            align: 'end' as const,
            labels: {
                color: '#f8fafc',
                usePointStyle: true,
                pointStyle: 'circle',
                boxWidth: 6,
                padding: 15,
                font: { family: 'Outfit', size: 11, weight: 'bold' }
            }
        },
        tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: 'rgba(255, 255, 255, 0.1)',
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
                        label += val < 1 ? val.toFixed(4) : val.toFixed(2);
                        label += (context.dataset.yAxisID === 'yRatio' ? 'x' : ' ms');
                    }
                    return label;
                }
            }
        }
    }
} as any;

export function mapVal(v: any) {
    if (v === -1 || v === -2 || v === undefined || v === null) return null;
    return Math.max(v, 0.0001);
}

export function createTrendChart(canvas: HTMLCanvasElement, title: string, yLabel: string, isRatio = false) {
    const options = JSON.parse(JSON.stringify(TREND_OPTIONS));
    options.plugins.title = {
        display: true,
        text: title,
        color: '#f8fafc',
        font: { family: 'Outfit', size: 16, weight: '800' },
        padding: { bottom: 20 }
    };
    options.scales.y.title.text = yLabel;

    if (isRatio) {
        options.scales.y.type = 'linear';
        options.scales.y.beginAtZero = false;
        options.scales.y.min = 0;
        options.scales.y.ticks.callback = (v: any) => v.toFixed(1) + 'x';
    }

    return new Chart(canvas, {
        type: 'line',
        data: { labels: ['128B', '1KB', '10KB', '100KB', '1MB', '10MB', '100MB', '1GB'], datasets: [] },
        options: options
    });
}
