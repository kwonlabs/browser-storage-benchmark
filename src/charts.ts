import Chart from 'chart.js/auto';

// Colors matching the UI theme
export const COLORS = [
    'rgba(59, 130, 246, 0.7)', // Blue
    'rgba(16, 185, 129, 0.7)', // Emerald
    'rgba(139, 92, 246, 0.7)', // Violet
    'rgba(245, 158, 11, 0.7)', // Amber
    'rgba(239, 68, 68, 0.7)',  // Red
    'rgba(14, 165, 233, 0.7)'  // Sky
];

// Custom plugin to show "N/A" for skipped tests (value = -1)
export const skipPlugin = {
    id: 'skipPlugin',
    afterDatasetsDraw(chart: any) {
        const { ctx, data } = chart;
        data.datasets.forEach((dataset: any, datasetIndex: number) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            meta.data.forEach((bar: any, index: number) => {
                const val = dataset.data[index];
                if (val === -1) {
                    ctx.save();
                    ctx.fillStyle = '#ef4444'; // Red for N/A
                    ctx.font = 'bold 9px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('N/A', bar.x, chart.chartArea.bottom - 5);
                    ctx.restore();
                }
            });
        });
    }
};

export const COMMON_OPTIONS = {
    responsive: true,
    maintainAspectRatio: false,
    color: '#94a3b8',
    scales: {
        y: {
            type: 'logarithmic' as const,
            title: { display: true, text: 'Time (ms) - Log Scale', color: '#94a3b8' },
            grid: { color: '#334155' },
            ticks: { color: '#94a3b8' }
        },
        x: {
            grid: { color: '#334155' },
            ticks: { color: '#94a3b8' }
        }
    },
    plugins: {
        legend: { labels: { color: '#f8fafc' } }
    }
} as const;

export const COMP_OPTIONS = {
    responsive: true, maintainAspectRatio: false, color: '#94a3b8',
    scales: {
        yTime: { type: 'logarithmic' as const, position: 'left' as const, title: { display: true, text: 'Time (ms)', color: '#94a3b8' }, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
        yRatio: { type: 'linear' as const, position: 'right' as const, title: { display: true, text: 'Ratio (x)', color: '#a78bfa' }, grid: { drawOnChartArea: false }, ticks: { color: '#a78bfa' } },
        x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
    },
    plugins: {
        legend: { labels: { color: '#f8fafc' } }
    }
} as const;

export function mapVal(v: any) {
    if (v === -1) return -1;
    if (v === undefined || v === null) return 0;
    return Math.max(v, 0.001);
}

export function createChart(ctx: HTMLCanvasElement, type: 'native' | 'wrapper' | 'compression', sizeName: string) {
    if (type === 'native') {
        return new Chart(ctx, {
            type: 'bar',
            plugins: [skipPlugin],
            data: { labels: ['Cookies', 'SessionStorage', 'LocalStorage', 'CacheAPI', 'IndexedDB', 'OPFS'], datasets: [] },
            options: { ...COMMON_OPTIONS, plugins: { ...COMMON_OPTIONS.plugins, title: { display: true, text: `Native (${sizeName.toUpperCase()})`, color: '#f8fafc' } } }
        });
    } else if (type === 'wrapper') {
        return new Chart(ctx, {
            type: 'bar',
            plugins: [skipPlugin],
            data: { labels: ['store.js', 'SQLite', 'localForage', 'Dexie', 'PouchDB'], datasets: [] },
            options: { ...COMMON_OPTIONS, plugins: { ...COMMON_OPTIONS.plugins, title: { display: true, text: `Library (${sizeName.toUpperCase()})`, color: '#f8fafc' } } }
        });
    } else {
        return new Chart(ctx, {
            type: 'bar',
            data: { labels: ['None', 'ZIP', 'Gzip', 'Deflate', 'Brotli', 'zstd'], datasets: [] },
            options: { ...COMP_OPTIONS, plugins: { ...COMP_OPTIONS.plugins, title: { display: true, text: `Compression (${sizeName.toUpperCase()})`, color: '#f8fafc' } } }
        });
    }
}
