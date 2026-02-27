import { createTrendChart, COLORS, mapVal } from './lib/charts';
import { SIZES } from './constants';
import type { BenchmarkData } from './types';
import { switchToTab } from './router';
import { saveSession, getAllSessions, deleteSession, clearAllSessions } from './lib/db';
import { setLatestData } from './runner';

// UI Elements
const consoleLogs = document.getElementById('console-logs') as HTMLDivElement;
const progressBar = document.getElementById('progress-bar-fill') as HTMLDivElement;
const progressPercent = document.getElementById('progress-percent') as HTMLSpanElement;
const progressText = document.getElementById('progress-text') as HTMLSpanElement;
export const btnReportRun = document.getElementById('btn-report-run') as HTMLButtonElement;
const btnReportCancel = document.querySelector('.btn-cancel') as HTMLButtonElement;
const historyPanel = document.getElementById('history-panel') as HTMLDivElement;
const historyList = document.getElementById('history-list') as HTMLDivElement;
export const progressArea = document.getElementById('overall-progress') as HTMLDivElement;

// Chart Registry
export const chartRegistry: Map<string, any> = new Map();

export function addLog(msg: string, type: 'system' | 'success' | 'error' = 'system') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const now = new Date();
    const ts = now.toLocaleTimeString('en-GB', { hour12: false });
    entry.innerText = `[${ts}] ${msg}`;
    consoleLogs.appendChild(entry);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

export function updateProgress(percent: number, msg: string) {
    progressBar.style.width = `${percent}%`;
    progressPercent.innerText = `${percent}%`;
    progressText.innerText = msg;
}

export function initCharts() {
    chartRegistry.set('low-write', createTrendChart(document.getElementById('chart-trend-low-write') as HTMLCanvasElement, 'Low-Capacity (<10MB): Write Latency (ms)', 'Latency (ms)'));
    chartRegistry.set('low-read', createTrendChart(document.getElementById('chart-trend-low-read') as HTMLCanvasElement, 'Low-Capacity (<10MB): Read Latency (ms)', 'Latency (ms)'));
    chartRegistry.set('high-write', createTrendChart(document.getElementById('chart-trend-high-write') as HTMLCanvasElement, 'High-Capacity (>10MB): Write Latency (ms)', 'Latency (ms)'));
    chartRegistry.set('high-read', createTrendChart(document.getElementById('chart-trend-high-read') as HTMLCanvasElement, 'High-Capacity (>10MB): Read Latency (ms)', 'Latency (ms)'));
    chartRegistry.set('compression-speed', createTrendChart(document.getElementById('chart-trend-compression-speed') as HTMLCanvasElement, 'Compression Speed Trend (ms)', 'Time (ms)'));
    chartRegistry.set('compression-ratio', createTrendChart(document.getElementById('chart-trend-compression-ratio') as HTMLCanvasElement, 'Compression Ratio Trend (x)', 'Ratio (x)', true));
}

function updateStorageTrends(latestData: BenchmarkData, category: 'low' | 'high', members: string[]) {
    const writeChart = chartRegistry.get(`${category}-write`);
    const readChart = chartRegistry.get(`${category}-read`);
    if (!writeChart || !readChart) return;

    const sizeKeys = Object.keys(SIZES);

    writeChart.data.datasets = members.map((m, i) => ({
        label: m,
        borderColor: COLORS[i % COLORS.length].border,
        backgroundColor: COLORS[i % COLORS.length].main,
        tension: 0.3,
        data: sizeKeys.map(size => mapVal(latestData[category][size]?.[m]?.insert))
    }));

    readChart.data.datasets = members.map((m, i) => ({
        label: m,
        borderColor: COLORS[i % COLORS.length].border,
        backgroundColor: COLORS[i % COLORS.length].main,
        tension: 0.3,
        data: sizeKeys.map(size => mapVal(latestData[category][size]?.[m]?.read))
    }));

    writeChart.update();
    readChart.update();
}

function updateCompressionTrends(latestData: BenchmarkData) {
    const speedChart = chartRegistry.get('compression-speed');
    const ratioChart = chartRegistry.get('compression-ratio');
    if (!speedChart || !ratioChart) return;

    const members = ['ZIP', 'Gzip', 'Deflate', 'Brotli', 'zstd'];
    const sizeKeys = Object.keys(SIZES);

    speedChart.data.datasets = members.map((m, i) => ({
        label: m,
        borderColor: COLORS[i % COLORS.length].border,
        backgroundColor: COLORS[i % COLORS.length].main,
        tension: 0.3,
        data: sizeKeys.map(size => mapVal(latestData.compression[size]?.[m]?.compressTime))
    }));

    ratioChart.data.datasets = members.map((m, i) => ({
        label: m,
        borderColor: COLORS[i % COLORS.length].border,
        backgroundColor: COLORS[i % COLORS.length].main,
        tension: 0.3,
        data: sizeKeys.map(size => mapVal(latestData.compression[size]?.[m]?.ratio))
    }));

    speedChart.update();
    ratioChart.update();
}

export function updateTrendCharts(latestData: BenchmarkData) {
    updateStorageTrends(latestData, 'low', ['Cookie', 'SessionStorage', 'LocalStorage', 'store.js']);
    updateStorageTrends(latestData, 'high', ['Cache API', 'IndexedDB', 'OPFS (Async)', 'OPFS (Sync)', 'SQLite', 'localForage', 'Dexie', 'PouchDB']);
    updateCompressionTrends(latestData);
}

export function markBenchmarkFinished(latestData: BenchmarkData) {
    if (btnReportRun) btnReportRun.style.display = 'inline-flex';
    if (btnReportCancel) btnReportCancel.style.display = 'none';
    saveSession(latestData).then(() => {
        addLog('Session saved to persistent storage.');
        refreshHistory(latestData);
    });
}

// History logic
export async function refreshHistory(currentDataRef: BenchmarkData) {
    const sessions = await getAllSessions();
    historyList.innerHTML = '';

    if (sessions.length === 0) {
        historyList.innerHTML = '<div class="empty-state" style="padding: 1rem; font-size: 0.8rem;">No historical data.</div>';
        return;
    }

    sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
      <div class="history-info">
        <span class="history-time">${session.timestamp}</span>
        <span class="history-id">#${session.id.toString().slice(-6)}</span>
      </div>
      <button class="btn-delete-session" data-id="${session.id}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
      </button>
    `;
        item.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('.btn-delete-session')) return;
            setLatestData(session.data);
            updateTrendCharts(session.data);
            addLog(`Loaded historical session from ${session.timestamp}.`);
            historyPanel.style.display = 'none';
            switchToTab('tab-report');
        });

        item.querySelector('.btn-delete-session')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('Delete this session?')) {
                await deleteSession(session.id);
                refreshHistory(currentDataRef);
            }
        });

        historyList.appendChild(item);
    });
}

export function initUIListeners(latestDataRef: BenchmarkData) {
    const btnShowHistory = document.getElementById('btn-show-history') as HTMLButtonElement;
    const btnCloseHistory = document.getElementById('btn-close-history') as HTMLButtonElement;
    const btnClearHistory = document.getElementById('btn-clear-history') as HTMLButtonElement;

    btnShowHistory?.addEventListener('click', () => {
        const isHidden = historyPanel.style.display === 'none';
        historyPanel.style.display = isHidden ? 'flex' : 'none';
        if (isHidden) refreshHistory(latestDataRef);
    });

    btnCloseHistory?.addEventListener('click', () => {
        historyPanel.style.display = 'none';
    });

    btnClearHistory?.addEventListener('click', async () => {
        if (confirm('Clear all history?')) {
            await clearAllSessions();
            refreshHistory(latestDataRef);
            addLog('All history cleared.');
        }
    });
}
