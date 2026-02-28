import { createTrendChart, COLORS, mapVal } from './lib/charts';
import { SIZES } from './constants';
import type { BenchmarkData } from './types';
import { switchToTab } from './router';
import { saveSession, getAllSessions, deleteSession, clearAllSessions } from './lib/db';
import { setLatestData } from './runner';

// Comparison State
let isCompareMode = false;
let selectedSessions: string[] = [];

// UI Elements
const consoleLogs = document.getElementById('console-logs') as HTMLDivElement;
const progressBar = document.getElementById('progress-bar-fill') as HTMLDivElement;
const progressPercent = document.getElementById('progress-percent') as HTMLSpanElement;
const progressText = document.getElementById('progress-text') as HTMLSpanElement;
export const btnReportRun = document.getElementById('btn-report-run') as HTMLButtonElement;
const btnReportCancel = document.querySelector('.btn-cancel') as HTMLButtonElement;
const summaryBestWrite = document.getElementById('summary-best-write') as HTMLSpanElement;
const summaryBestWriteTech = document.getElementById('summary-best-write-tech') as HTMLSpanElement;
const summaryBestRead = document.getElementById('summary-best-read') as HTMLSpanElement;
const summaryBestReadTech = document.getElementById('summary-best-read-tech') as HTMLSpanElement;
const summaryBestCompress = document.getElementById('summary-best-compress') as HTMLSpanElement;
const summaryBestCompressTech = document.getElementById('summary-best-compress-tech') as HTMLSpanElement;
const summaryTotalTime = document.getElementById('summary-total-time') as HTMLSpanElement;
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
    const LOW_LABELS = ['128B', '1KB', '10KB', '100KB', '1MB', '10MB'];

    chartRegistry.set('low-write', createTrendChart(document.getElementById('chart-trend-low-write') as HTMLCanvasElement, 'Volatile Storage (<10MB): Write Latency (ms)', 'Latency (ms)', false, LOW_LABELS));
    chartRegistry.set('low-read', createTrendChart(document.getElementById('chart-trend-low-read') as HTMLCanvasElement, 'Volatile Storage (<10MB): Read Latency (ms)', 'Latency (ms)', false, LOW_LABELS));

    chartRegistry.set('high-native-write', createTrendChart(document.getElementById('chart-trend-high-native-write') as HTMLCanvasElement, 'Persistent Storage: Write Latency (ms)', 'Latency (ms)'));
    chartRegistry.set('high-native-read', createTrendChart(document.getElementById('chart-trend-high-native-read') as HTMLCanvasElement, 'Persistent Storage: Read Latency (ms)', 'Latency (ms)'));

    chartRegistry.set('high-wrapper-write', createTrendChart(document.getElementById('chart-trend-high-wrapper-write') as HTMLCanvasElement, 'Persistent Library: Write Latency (ms)', 'Latency (ms)'));
    chartRegistry.set('high-wrapper-read', createTrendChart(document.getElementById('chart-trend-high-wrapper-read') as HTMLCanvasElement, 'Persistent Library: Read Latency (ms)', 'Latency (ms)'));

    chartRegistry.set('compression-speed', createTrendChart(document.getElementById('chart-trend-compression-speed') as HTMLCanvasElement, 'Compression Speed Trend (ms)', 'Time (ms)'));
    chartRegistry.set('compression-ratio', createTrendChart(document.getElementById('chart-trend-compression-ratio') as HTMLCanvasElement, 'Compression Ratio Trend (x)', 'Ratio (x)', true));
}

function updateChartVisibility(chartId: string, hasData: boolean) {
    const emptyEl = document.getElementById(`empty-${chartId}`);
    const wrapEl = document.getElementById(`wrap-${chartId}`);
    const toggleEl = document.getElementById(`toggle-${chartId}`);
    const tableContainer = document.getElementById(`table-${chartId}`);

    if (emptyEl) emptyEl.style.display = hasData ? 'none' : 'block';
    if (wrapEl) wrapEl.style.display = hasData ? 'block' : 'none';
    if (toggleEl) toggleEl.style.display = hasData ? 'block' : 'none';

    // For safety, force hide table if no data
    if (!hasData && tableContainer) {
        tableContainer.style.display = 'none';
        if (toggleEl) {
            const btn = toggleEl.querySelector('button');
            if (btn) {
                btn.classList.remove('active');
                btn.innerText = 'Show Data Table ▼';
            }
        }
    }
}

function renderCustomLegend(chartId: string, chart: any) {
const itemEl = document.getElementById(`item-${chartId}`);
if (!itemEl) return;

let legendContainer = itemEl.querySelector('.chart-legend-container') as HTMLDivElement;
if (!legendContainer) {
    legendContainer = document.createElement('div');
    legendContainer.className = 'chart-legend-container';
    const wrapper = itemEl.querySelector('.chart-wrapper');
    if (wrapper) {
        itemEl.insertBefore(legendContainer, wrapper);
    } else {
        itemEl.appendChild(legendContainer);
    }
}

legendContainer.innerHTML = '';
chart.data.datasets.forEach((dataset: any, index: number) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    if (!chart.isDatasetVisible(index)) {
        item.classList.add('hidden');
    }

    const dot = document.createElement('div');
    dot.className = 'legend-dot';
    dot.style.backgroundColor = dataset.borderColor;

    const text = document.createElement('span');
    text.innerText = dataset.label;

    item.appendChild(dot);
    item.appendChild(text);

    item.onclick = (e) => {
        e.stopPropagation();
        const isVisible = chart.isDatasetVisible(index);
        if (isVisible) {
            chart.hide(index);
        } else {
            chart.show(index);
        }
        chart.update();
        renderCustomLegend(chartId, chart);
    };

    legendContainer!.appendChild(item);
});
}

function renderStorageTable(containerId: string, activeSizeKeys: string[], members: string[], latestData: BenchmarkData, dataCategory: 'low' | 'high', op: 'insert' | 'read') {
const container = document.getElementById(containerId);
if (!container) return;

if (activeSizeKeys.length === 0) {
    container.innerHTML = '';
    return;
}

let html = `<table class="data-table"><thead><tr><th>Size</th>`;
for (const m of members) {
    html += `<th>${m}</th>`;
}
html += `</tr></thead><tbody>`;

for (const size of activeSizeKeys) {
    html += `<tr><td>${size.toUpperCase()}</td>`;
    for (const m of members) {
        const val = latestData[dataCategory]?.[size]?.[m]?.[op];
        html += `<td>${val !== undefined ? (val < 1 ? val.toFixed(3) : val.toFixed(1)) + ' ms' : '-'}</td>`;
    }
    html += `</tr>`;
}
html += `</tbody></table>`;
container.innerHTML = html;
}

function renderCompressionTable(containerId: string, activeSizeKeys: string[], members: string[], latestData: BenchmarkData, op: 'compressTime' | 'ratio') {
const container = document.getElementById(containerId);
if (!container) return;

if (activeSizeKeys.length === 0) {
    container.innerHTML = '';
    return;
}

let html = `<table class="data-table"><thead><tr><th>Size</th>`;
for (const m of members) {
    html += `<th>${m}</th>`;
}
html += `</tr></thead><tbody>`;

for (const size of activeSizeKeys) {
    html += `<tr><td>${size.toUpperCase()}</td>`;
    for (const m of members) {
        const val = latestData.compression?.[size]?.[m]?.[op];
        if (val !== undefined) {
            html += `<td>${op === 'ratio' ? val.toFixed(2) + 'x' : (val < 1 ? val.toFixed(3) : val.toFixed(1)) + ' ms'}</td>`;
        } else {
            html += `<td>-</td>`;
        }
    }
    html += `</tr>`;
}
html += `</tbody></table>`;
container.innerHTML = html;
}

function updateStorageTrends(latestData: BenchmarkData, category: 'low' | 'high-native' | 'high-wrapper', members: string[], compareData?: BenchmarkData) {
const isLow = category === 'low';
const dataCategory = category.startsWith('high') ? 'high' : 'low';

const writeChart = chartRegistry.get(`${category}-write`);
const readChart = chartRegistry.get(`${category}-read`);
if (!writeChart || !readChart) return;

// Identify and filter sizeKeys down to only those that have actual test data
const activeSizeKeys = Object.keys(SIZES).filter(size => {
    if (isLow && Object.keys(SIZES).indexOf(size) > 5) return false;
    const inA = members.some(m => {
        const entry = latestData[dataCategory]?.[size]?.[m];
        return !!entry && (entry.insert !== undefined || entry.read !== undefined);
    });
    const inB = compareData ? members.some(m => {
        const entry = compareData[dataCategory]?.[size]?.[m];
        return !!entry && (entry.insert !== undefined || entry.read !== undefined);
    }) : false;
    return inA || inB;
});

writeChart.data.labels = activeSizeKeys;
readChart.data.labels = activeSizeKeys;

const datasetsW: any[] = [];
const datasetsR: any[] = [];

members.forEach((m, i) => {
    // Session A
    datasetsW.push({
        label: compareData ? `${m} (A)` : m,
        borderColor: COLORS[i % COLORS.length].border,
        backgroundColor: COLORS[i % COLORS.length].main,
        tension: 0.3,
        data: activeSizeKeys.map(size => mapVal(latestData[dataCategory]?.[size]?.[m]?.insert))
    });
    datasetsR.push({
        label: compareData ? `${m} (A)` : m,
        borderColor: COLORS[i % COLORS.length].border,
        backgroundColor: COLORS[i % COLORS.length].main,
        tension: 0.3,
        data: activeSizeKeys.map(size => mapVal(latestData[dataCategory]?.[size]?.[m]?.read))
    });

    // Session B
    if (compareData) {
        datasetsW.push({
            label: `${m} (B)`,
            borderColor: COLORS[i % COLORS.length].border,
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            tension: 0.3,
            data: activeSizeKeys.map(size => mapVal(compareData[dataCategory]?.[size]?.[m]?.insert))
        });
        datasetsR.push({
            label: `${m} (B)`,
            borderColor: COLORS[i % COLORS.length].border,
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            tension: 0.3,
            data: activeSizeKeys.map(size => mapVal(compareData[dataCategory]?.[size]?.[m]?.read))
        });
    }
});

writeChart.data.datasets = datasetsW;
readChart.data.datasets = datasetsR;

writeChart.update();
readChart.update();

renderCustomLegend(`${category}-write`, writeChart);
renderCustomLegend(`${category}-read`, readChart);

const hasData = activeSizeKeys.length > 0;
updateChartVisibility(`${category}-write`, hasData);
updateChartVisibility(`${category}-read`, hasData);

if (hasData) {
    renderStorageTable(`table-${category}-write`, activeSizeKeys, members, latestData, dataCategory as 'low' | 'high', 'insert');
    renderStorageTable(`table-${category}-read`, activeSizeKeys, members, latestData, dataCategory as 'low' | 'high', 'read');
}
}

function updateCompressionTrends(latestData: BenchmarkData, compareData?: BenchmarkData) {
const speedChart = chartRegistry.get('compression-speed');
const ratioChart = chartRegistry.get('compression-ratio');
if (!speedChart || !ratioChart) return;

const members = ['ZIP', 'Gzip', 'Deflate', 'Brotli', 'zstd'];

const activeSizeKeys = Object.keys(SIZES).filter(size => {
    const inA = members.some(m => {
        const entry = latestData.compression?.[size]?.[m];
        return !!entry && (entry.compressTime !== undefined || entry.ratio !== undefined);
    });
    const inB = compareData ? members.some(m => {
        const entry = compareData.compression?.[size]?.[m];
        return !!entry && (entry.compressTime !== undefined || entry.ratio !== undefined);
    }) : false;
    return inA || inB;
});

speedChart.data.labels = activeSizeKeys;
ratioChart.data.labels = activeSizeKeys;

const datasetsS: any[] = [];
const datasetsR: any[] = [];

members.forEach((m, i) => {
    // Session A
    datasetsS.push({
        label: compareData ? `${m} (A)` : m,
        borderColor: COLORS[i % COLORS.length].border,
        backgroundColor: COLORS[i % COLORS.length].main,
        tension: 0.3,
        data: activeSizeKeys.map(size => mapVal(latestData.compression[size]?.[m]?.compressTime))
    });
    datasetsR.push({
        label: compareData ? `${m} (A)` : m,
        borderColor: COLORS[i % COLORS.length].border,
        backgroundColor: COLORS[i % COLORS.length].main,
        tension: 0.3,
        data: activeSizeKeys.map(size => mapVal(latestData.compression[size]?.[m]?.ratio))
    });

    // Session B
    if (compareData) {
        datasetsS.push({
            label: `${m} (B)`,
            borderColor: COLORS[i % COLORS.length].border,
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            tension: 0.3,
            data: activeSizeKeys.map(size => mapVal(compareData.compression[size]?.[m]?.compressTime))
        });
        datasetsR.push({
            label: `${m} (B)`,
            borderColor: COLORS[i % COLORS.length].border,
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            tension: 0.3,
            data: activeSizeKeys.map(size => mapVal(compareData.compression[size]?.[m]?.ratio))
        });
    }
});

speedChart.data.datasets = datasetsS;
ratioChart.data.datasets = datasetsR;

speedChart.update();
ratioChart.update();

renderCustomLegend('compression-speed', speedChart);
renderCustomLegend('compression-ratio', ratioChart);

const hasData = activeSizeKeys.length > 0;
updateChartVisibility('compression-speed', hasData);
updateChartVisibility('compression-ratio', hasData);

if (hasData) {
    renderCompressionTable('table-compression-speed', activeSizeKeys, members, latestData, 'compressTime');
    renderCompressionTable('table-compression-ratio', activeSizeKeys, members, latestData, 'ratio');
}
}

export function updateSummaryDashboard(latestData: BenchmarkData) {
let bestWrite = Infinity;
let bestWriteTech = '--';
let bestRead = Infinity;
let bestReadTech = '--';
let bestCompressRatio = 0;
let bestCompressTech = '--';
let totalTime = 0;

// Evaluate Storage (low, high)
const storageCats: ('low' | 'high')[] = ['low', 'high'];
const skipList = ['Cookie', 'SessionStorage', 'LocalStorage', 'store.js'];

for (const cat of storageCats) {
    if (!latestData[cat]) continue;
    for (const size of Object.keys(latestData[cat])) {
        const sizeData = latestData[cat][size];
        for (const tech of Object.keys(sizeData)) {
            if (sizeData[tech].insert > 0) {
                totalTime += sizeData[tech].insert;
                if (!skipList.includes(tech) && sizeData[tech].insert < bestWrite) {
                    bestWrite = sizeData[tech].insert;
                    bestWriteTech = tech;
                }
            }
            if (sizeData[tech].read > 0) {
                totalTime += sizeData[tech].read;
                if (!skipList.includes(tech) && sizeData[tech].read < bestRead) {
                    bestRead = sizeData[tech].read;
                    bestReadTech = tech;
                }
            }
            if (sizeData[tech].update && sizeData[tech].update > 0) totalTime += sizeData[tech].update;
            if (sizeData[tech].delete && sizeData[tech].delete > 0) totalTime += sizeData[tech].delete;
        }
    }
}

// Evaluate Compression
if (latestData.compression) {
    for (const size of Object.keys(latestData.compression)) {
        const sizeData = latestData.compression[size];
        for (const tech of Object.keys(sizeData)) {
            if (sizeData[tech].compressTime > 0) totalTime += sizeData[tech].compressTime;
            if (sizeData[tech].ratio > bestCompressRatio) {
                bestCompressRatio = sizeData[tech].ratio;
                bestCompressTech = tech;
            }
        }
    }
}

if (summaryBestWrite) {
    if (bestWrite !== Infinity) {
        summaryBestWrite.innerText = bestWrite < 1 ? bestWrite.toFixed(3) + 'ms' : bestWrite.toFixed(1) + 'ms';
        summaryBestWriteTech.innerText = bestWriteTech;
    } else {
        summaryBestWrite.innerText = '--';
        summaryBestWriteTech.innerText = 'Waiting...';
    }
}
if (summaryBestRead) {
    if (bestRead !== Infinity) {
        summaryBestRead.innerText = bestRead < 1 ? bestRead.toFixed(3) + 'ms' : bestRead.toFixed(1) + 'ms';
        summaryBestReadTech.innerText = bestReadTech;
    } else {
        summaryBestRead.innerText = '--';
        summaryBestReadTech.innerText = 'Waiting...';
    }
}
if (summaryBestCompress) {
    if (bestCompressRatio > 0) {
        summaryBestCompress.innerText = bestCompressRatio.toFixed(2) + 'x';
        summaryBestCompressTech.innerText = bestCompressTech;
    } else {
        summaryBestCompress.innerText = '--';
        summaryBestCompressTech.innerText = 'Waiting...';
    }
}
if (summaryTotalTime) {
    if (totalTime > 0) {
        summaryTotalTime.innerText = totalTime >= 1000 ? (totalTime / 1000).toFixed(1) + 's' : totalTime.toFixed(0) + 'ms';
    } else {
        summaryTotalTime.innerText = '--';
    }
}
}

export function updateTrendCharts(latestData: BenchmarkData, compareData?: BenchmarkData) {
updateStorageTrends(latestData, 'low', ['Cookie', 'SessionStorage', 'LocalStorage', 'store.js'], compareData);
updateStorageTrends(latestData, 'high-native', ['Cache API', 'IndexedDB', 'OPFS (Async)', 'OPFS (Sync)'], compareData);
updateStorageTrends(latestData, 'high-wrapper', ['SQLite (Async)', 'SQLite (Sync)', 'localForage', 'Dexie', 'PouchDB'], compareData);
updateCompressionTrends(latestData, compareData);
updateSummaryDashboard(latestData);
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
    const isChecked = selectedSessions.includes(session.id.toString());

    const env = session.env;
    const browser = env?.userAgent.includes('Chrome') ? 'Chrome' : (env?.userAgent.includes('Safari') ? 'Safari' : (env?.userAgent.includes('Firefox') ? 'Firefox' : 'Browser'));
    const envLabel = env ? `${browser} (${env.hardwareConcurrency} Cores)` : 'Unknown Env';

    item.innerHTML = `
  <input type="checkbox" class="history-checkbox" ${isChecked ? 'checked' : ''} data-id="${session.id}">
  <div class="history-info" style="flex: 1; display: flex; flex-direction: column; gap: 0.2rem;">
    <span class="history-time" style="font-weight: 600; font-size: 0.9rem;">${session.timestamp}</span>
    <div style="display: flex; align-items: center; gap: 0.4rem;">
        <span style="font-size: 0.7rem; opacity: 0.7; padding: 1px 5px; background: rgba(255,255,255,0.08); border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">${envLabel}</span>
        <span class="history-id" style="font-size: 0.65rem; opacity: 0.5;">#${session.id.toString().slice(-6)}</span>
    </div>
  </div>
  <button class="btn-delete-session" data-id="${session.id}">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
  </button>
`;

    const checkbox = item.querySelector('.history-checkbox') as HTMLInputElement;

    item.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.btn-delete-session')) return;
        if (isCompareMode) {
            checkbox.checked = !checkbox.checked;
            handleSelection(session.id.toString(), checkbox.checked);
            return;
        }
        setLatestData(session.data);
        updateTrendCharts(session.data);
        addLog(`Loaded historical session from ${session.timestamp}.`);
        historyPanel.style.display = 'none';
        switchToTab('tab-report');
    });

    checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        handleSelection(session.id.toString(), checkbox.checked);
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

async function handleSelection(id: string, checked: boolean) {
if (checked) {
    if (!selectedSessions.includes(id)) selectedSessions.push(id);
    if (selectedSessions.length > 2) {
        selectedSessions.shift();
    }
} else {
    selectedSessions = selectedSessions.filter(s => s !== id);
}
updateCompareBtn();
}

function updateCompareBtn() {
const btnCompare = document.getElementById('btn-run-compare') as HTMLButtonElement;
if (btnCompare) {
    btnCompare.innerText = `Compare Selected (${selectedSessions.length}/2)`;
    btnCompare.disabled = selectedSessions.length !== 2;
}
}

export function initUIListeners(latestDataRef: BenchmarkData) {
const btnShowHistory = document.getElementById('btn-show-history') as HTMLButtonElement;
const btnCloseHistory = document.getElementById('btn-close-history') as HTMLButtonElement;
const btnClearHistory = document.getElementById('btn-clear-history') as HTMLButtonElement;

document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('btn-toggle-table')) {
        const tableId = target.getAttribute('data-target');
        if (tableId) {
            const tableEl = document.getElementById(tableId);
            if (tableEl) {
                const isHidden = tableEl.style.display === 'none';
                tableEl.style.display = isHidden ? 'block' : 'none';
                target.innerText = isHidden ? 'Hide Data Table ▲' : 'Show Data Table ▼';
                target.classList.toggle('active', isHidden);
            }
        }
    }
});

btnShowHistory?.addEventListener('click', () => {
    const isHidden = historyPanel.style.display === 'none';
    historyPanel.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) refreshHistory(latestDataRef);
});

const btnToggleCompare = document.getElementById('btn-toggle-compare') as HTMLButtonElement;
const btnRunCompare = document.getElementById('btn-run-compare') as HTMLButtonElement;
const btnCancelCompare = document.getElementById('btn-cancel-compare') as HTMLButtonElement;

function exitCompareMode() {
    isCompareMode = false;
    selectedSessions = [];
    historyPanel.classList.remove('compare-active');
    btnRunCompare.style.display = 'none';
    btnCancelCompare.style.display = 'none';
    refreshHistory(latestDataRef);
}

btnToggleCompare?.addEventListener('click', () => {
    isCompareMode = !isCompareMode;
    historyPanel.classList.toggle('compare-active', isCompareMode);
    btnRunCompare.style.display = isCompareMode ? 'block' : 'none';
    btnCancelCompare.style.display = isCompareMode ? 'block' : 'none';
    if (!isCompareMode) selectedSessions = [];
    refreshHistory(latestDataRef);
});

btnRunCompare?.addEventListener('click', async () => {
    if (selectedSessions.length !== 2) return;
    const sessions = await getAllSessions();
    const s1 = sessions.find(s => s.id.toString() === selectedSessions[0]);
    const s2 = sessions.find(s => s.id.toString() === selectedSessions[1]);
    if (s1 && s2) {
        setLatestData(s1.data);
        updateTrendCharts(s1.data, s2.data);
        addLog(`Comparing Session #${s1.id.toString().slice(-4)} vs #${s2.id.toString().slice(-4)}`);
        historyPanel.style.display = 'none';
        switchToTab('tab-report');
    }
});

btnCancelCompare?.addEventListener('click', exitCompareMode);

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
