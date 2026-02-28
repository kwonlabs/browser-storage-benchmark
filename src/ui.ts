import { createTrendChart, COLORS, mapVal } from './lib/charts';
import { SIZES } from './lib/benchmarks/constants';
import type { BenchmarkData, PayloadType } from './lib/benchmarks/types';
import { switchToTab } from './router';
import { saveSession, getAllSessions, deleteSession, clearAllSessions } from './lib/db';
import { setLatestData } from './lib/benchmarks/runner';

// Comparison State
let isCompareMode = false;
let selectedSessions: number[] = [];

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
    chartRegistry.set('low-update', createTrendChart(document.getElementById('chart-trend-low-update') as HTMLCanvasElement, 'Volatile Storage (<10MB): Update Latency (ms)', 'Latency (ms)', false, LOW_LABELS));
    chartRegistry.set('low-delete', createTrendChart(document.getElementById('chart-trend-low-delete') as HTMLCanvasElement, 'Volatile Storage (<10MB): Delete Latency (ms)', 'Latency (ms)', false, LOW_LABELS));

    chartRegistry.set('high-native-write', createTrendChart(document.getElementById('chart-trend-high-native-write') as HTMLCanvasElement, 'Persistent Storage: Write Latency (ms)', 'Latency (ms)'));
    chartRegistry.set('high-native-read', createTrendChart(document.getElementById('chart-trend-high-native-read') as HTMLCanvasElement, 'Persistent Storage: Read Latency (ms)', 'Latency (ms)'));
    chartRegistry.set('high-native-update', createTrendChart(document.getElementById('chart-trend-high-native-update') as HTMLCanvasElement, 'Persistent Storage: Update Latency (ms)', 'Latency (ms)'));
    chartRegistry.set('high-native-delete', createTrendChart(document.getElementById('chart-trend-high-native-delete') as HTMLCanvasElement, 'Persistent Storage: Delete Latency (ms)', 'Latency (ms)'));

    chartRegistry.set('high-wrapper-write', createTrendChart(document.getElementById('chart-trend-high-wrapper-write') as HTMLCanvasElement, 'Storage Library: Write Latency (ms)', 'Latency (ms)'));
    chartRegistry.set('high-wrapper-read', createTrendChart(document.getElementById('chart-trend-high-wrapper-read') as HTMLCanvasElement, 'Storage Library: Read Latency (ms)', 'Latency (ms)'));
    chartRegistry.set('high-wrapper-update', createTrendChart(document.getElementById('chart-trend-high-wrapper-update') as HTMLCanvasElement, 'Storage Library: Update Latency (ms)', 'Latency (ms)'));
    chartRegistry.set('high-wrapper-delete', createTrendChart(document.getElementById('chart-trend-high-wrapper-delete') as HTMLCanvasElement, 'Storage Library: Delete Latency (ms)', 'Latency (ms)'));
}

function updateChartVisibility(chartId: string, hasData: boolean) {
    const emptyEl = document.getElementById(`empty-${chartId}`);
    const wrapEl = document.getElementById(`wrap-${chartId}`);
    const toggleEl = document.getElementById(`toggle-${chartId}`);
    const tableContainer = document.getElementById(`table-${chartId}`);

    if (emptyEl) emptyEl.style.display = hasData ? 'none' : 'block';
    if (wrapEl) wrapEl.style.display = hasData ? 'block' : 'none';
    if (toggleEl) toggleEl.style.display = hasData ? 'block' : 'none';

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



function renderStorageTable(containerId: string, activeSizeKeys: string[], members: string[], latestData: BenchmarkData, dataCategory: 'low' | 'high', op: 'insert' | 'read' | 'update' | 'delete') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const payloadTypes: PayloadType[] = ['text', 'json', 'random', 'binary', 'image', 'pdf'];
    const activePayloadTypes = payloadTypes.filter(pt => {
        return activeSizeKeys.some(size => members.some(m => {
            const entry = latestData[dataCategory]?.[size]?.[pt]?.[m];
            return !!entry && entry[op] !== undefined && entry[op] !== -1;
        }));
    });

    let html = `<table class="data-table"><thead><tr><th>Size / Type</th>`;
    for (const m of members) html += `<th>${m}</th>`;
    html += `</tr></thead><tbody>`;

    for (const size of activeSizeKeys) {
        for (const pt of activePayloadTypes) {
            html += `<tr><td><span style="font-weight:600">${size.toUpperCase()}</span><br><span style="font-size:0.75em; opacity:0.6">${getPayloadLabel(pt)}</span></td>`;
            for (const m of members) {
                const entry = latestData[dataCategory]?.[size]?.[pt]?.[m];
                const val = entry?.[op];
                const errorCount = entry?.errors?.[op === 'insert' ? 'insert' : (op === 'read' ? 'read' : (op === 'update' ? 'update' : 'delete'))] || 0;

                if (val !== undefined && val !== -1) {
                    const timeStr = (val < 1 ? val.toFixed(3) : val.toFixed(1)) + ' ms';
                    const errorStr = errorCount > 0 ? ` <span style="color:var(--accent-error); font-size:0.7em;">(${errorCount} Fail)</span>` : '';
                    html += `<td>${timeStr}${errorStr}</td>`;
                } else {
                    html += `<td>-</td>`;
                }
            }
            html += `</tr>`;
        }
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
}

function updateStorageTrends(latestData: BenchmarkData, category: 'low' | 'high-native' | 'high-wrapper', members: string[], compareData?: BenchmarkData) {
    const isLow = category === 'low';
    const dataCategory = category.startsWith('high') ? 'high' : 'low';

    const writeChart = chartRegistry.get(`${category}-write`);
    const readChart = chartRegistry.get(`${category}-read`);
    const updateChart = chartRegistry.get(`${category}-update`);
    const deleteChart = chartRegistry.get(`${category}-delete`);

    if (!writeChart || !readChart || !updateChart || !deleteChart) return;

    const payloadTypes: PayloadType[] = ['text', 'json', 'random', 'binary', 'image', 'pdf'];

    const activeSizeKeys = Object.keys(SIZES).filter(size => {
        if (isLow && Object.keys(SIZES).indexOf(size) > 5) return false;
        const inA = members.some(m => {
            return payloadTypes.some(pt => {
                const entry = (latestData[dataCategory as keyof BenchmarkData] as any)?.[size]?.[pt]?.[m];
                return !!entry && entry.insert !== undefined && entry.insert !== -1;
            });
        });
        const inB = compareData ? members.some(m => {
            return payloadTypes.some(pt => {
                const entry = (compareData[dataCategory as keyof BenchmarkData] as any)?.[size]?.[pt]?.[m];
                return !!entry && entry.insert !== undefined && entry.insert !== -1;
            });
        }) : false;
        return inA || inB;
    });

    writeChart.data.labels = activeSizeKeys;
    readChart.data.labels = activeSizeKeys;
    updateChart.data.labels = activeSizeKeys;
    deleteChart.data.labels = activeSizeKeys;

    const datasetsW: any[] = [];
    const datasetsR: any[] = [];
    const datasetsU: any[] = [];
    const datasetsD: any[] = [];

    members.forEach((m, i) => {
        const color = COLORS[i % COLORS.length];
        payloadTypes.forEach((pt) => {
            const hasDataA = activeSizeKeys.some(size => (latestData[dataCategory as keyof BenchmarkData] as any)?.[size]?.[pt]?.[m]?.insert !== undefined);
            if (!hasDataA) return;

            const label = compareData ? `${m} (A)` : `${m}`;
            const dash: number[] = pt === 'text' ? [] : [5, 2]; // Storage is strictly text now, but keep dash for others if history exists

            datasetsW.push({
                label, borderColor: color.border, backgroundColor: color.main, borderDash: dash, tension: 0.3,
                data: activeSizeKeys.map(size => {
                    const entry = latestData[dataCategory]?.[size]?.[pt]?.[m];
                    return (entry && entry.insert !== undefined && entry.insert !== -1) ? mapVal(entry.insert) : null;
                })
            });
            datasetsR.push({
                label, borderColor: color.border, backgroundColor: color.main, borderDash: dash, tension: 0.3,
                data: activeSizeKeys.map(size => {
                    const entry = latestData[dataCategory]?.[size]?.[pt]?.[m];
                    return (entry && entry.read !== undefined && entry.read !== -1) ? mapVal(entry.read) : null;
                })
            });
            datasetsU.push({
                label, borderColor: color.border, backgroundColor: color.main, borderDash: dash, tension: 0.3,
                data: activeSizeKeys.map(size => {
                    const entry = latestData[dataCategory]?.[size]?.[pt]?.[m];
                    return (entry && entry.update !== undefined && entry.update !== -1) ? mapVal(entry.update) : null;
                })
            });
            datasetsD.push({
                label, borderColor: color.border, backgroundColor: color.main, borderDash: dash, tension: 0.3,
                data: activeSizeKeys.map(size => {
                    const entry = latestData[dataCategory]?.[size]?.[pt]?.[m];
                    return (entry && entry.delete !== undefined && entry.delete !== -1) ? mapVal(entry.delete) : null;
                })
            });

            if (compareData) {
                const labelB = `${m} (B)`;
                datasetsW.push({
                    label: labelB, borderColor: color.border, backgroundColor: 'transparent', borderDash: [5, 5], tension: 0.3,
                    data: activeSizeKeys.map(size => {
                        const entry = compareData[dataCategory]?.[size]?.[pt]?.[m];
                        return (entry && entry.errors?.insert === 0) ? mapVal(entry.insert) : null;
                    })
                });
            }
        });
    });

    writeChart.data.datasets = datasetsW;
    readChart.data.datasets = datasetsR;
    updateChart.data.datasets = datasetsU;
    deleteChart.data.datasets = datasetsD;

    writeChart.update(); readChart.update(); updateChart.update(); deleteChart.update();



    const hasData = activeSizeKeys.length > 0;
    updateChartVisibility(`${category}-write`, hasData);
    updateChartVisibility(`${category}-read`, hasData);
    updateChartVisibility(`${category}-update`, hasData);
    updateChartVisibility(`${category}-delete`, hasData);

    if (hasData) {
        renderStorageTable(`table-${category}-write`, activeSizeKeys, members, latestData, dataCategory as 'low' | 'high', 'insert');
        renderStorageTable(`table-${category}-read`, activeSizeKeys, members, latestData, dataCategory as 'low' | 'high', 'read');
    }
}

function updateCompressionTrends(latestData: BenchmarkData) {
    const container = document.getElementById('compression-charts-container');
    if (!container) return;

    const members = ['ZIP', 'Gzip', 'Deflate', 'Brotli', 'zstd'];
    const payloadTypes: PayloadType[] = ['text', 'json', 'random', 'binary', 'image', 'pdf'];

    const activeSizeKeys = Object.keys(SIZES).filter(size => {
        return members.some(m => payloadTypes.some(pt => {
            const entry = latestData.compression?.[size]?.[pt]?.[m];
            return !!entry && entry.compressTime > 0;
        }));
    });

    if (activeSizeKeys.length === 0) {
        container.innerHTML = '<div class="empty-state">No compression data available.</div>';
        return;
    }

    const activePayloadTypesInSession = payloadTypes.filter(pt => {
        return activeSizeKeys.some(size => members.some(m => !!latestData.compression?.[size]?.[pt]?.[m]));
    });

    // Destroy existing dynamic compression charts to prevent memory leak and theme duplication
    const existingKeys = Array.from(chartRegistry.keys());
    existingKeys.forEach(k => {
        if (k.startsWith('comp-')) {
            const oldChart = chartRegistry.get(k);
            if (oldChart && typeof oldChart.destroy === 'function') {
                oldChart.destroy();
            }
            chartRegistry.delete(k);
        }
    });

    container.innerHTML = '';

    activePayloadTypesInSession.forEach(pt => {
        const ptLabel = getPayloadLabel(pt);
        const ptSection = document.createElement('div');
        ptSection.className = 'payload-chart-group';
        ptSection.innerHTML = `
            <h4 class="payload-group-title">${ptLabel} Analysis</h4>
            <div class="trend-layout">
                <div class="report-chart-item" id="item-comp-${pt}-speed">
                    <div class="chart-wrapper"><canvas id="chart-comp-${pt}-speed"></canvas></div>
                </div>
                <div class="report-chart-item" id="item-comp-${pt}-decompress">
                    <div class="chart-wrapper"><canvas id="chart-comp-${pt}-decompress"></canvas></div>
                </div>
                <div class="report-chart-item" id="item-comp-${pt}-ratio">
                    <div class="chart-wrapper"><canvas id="chart-comp-${pt}-ratio"></canvas></div>
                </div>
            </div>
            <div class="payload-table-container" id="table-comp-${pt}"></div>
        `;
        container.appendChild(ptSection);

        const sChart = createTrendChart(document.getElementById(`chart-comp-${pt}-speed`) as HTMLCanvasElement, `Compression Speed (ms)`, 'Time (ms)', false, activeSizeKeys);
        const dChart = createTrendChart(document.getElementById(`chart-comp-${pt}-decompress`) as HTMLCanvasElement, `Decompression Speed (ms)`, 'Time (ms)', false, activeSizeKeys);
        const rChart = createTrendChart(document.getElementById(`chart-comp-${pt}-ratio`) as HTMLCanvasElement, `Compression Ratio (%)`, 'Ratio (%)', true, activeSizeKeys);

        const dsS: any[] = []; const dsD: any[] = []; const dsR: any[] = [];

        members.forEach((m, i) => {
            const color = COLORS[i % COLORS.length];
            dsS.push({
                label: m, borderColor: color.border, backgroundColor: color.main, tension: 0.3,
                data: activeSizeKeys.map(size => mapVal(latestData.compression?.[size]?.[pt]?.[m]?.compressTime))
            });
            dsD.push({
                label: m, borderColor: color.border, backgroundColor: color.main, tension: 0.3,
                data: activeSizeKeys.map(size => mapVal(latestData.compression?.[size]?.[pt]?.[m]?.decompressTime))
            });
            dsR.push({
                label: m, borderColor: color.border, backgroundColor: color.main, tension: 0.3,
                data: activeSizeKeys.map(size => mapVal(latestData.compression?.[size]?.[pt]?.[m]?.ratio))
            });
        });

        sChart.data.datasets = dsS; dChart.data.datasets = dsD; rChart.data.datasets = dsR;
        sChart.update(); dChart.update(); rChart.update();

        // Register dynamic charts to allow theme toggle propagation
        chartRegistry.set(`comp-${pt}-speed`, sChart);
        chartRegistry.set(`comp-${pt}-decompress`, dChart);
        chartRegistry.set(`comp-${pt}-ratio`, rChart);



        renderSinglePayloadCompressionTable(`table-comp-${pt}`, activeSizeKeys, members, latestData, pt);
    });
}

function getPayloadLabel(pt: PayloadType): string {
    const labels: Record<string, string> = {
        text: 'Document (Text)',
        json: 'Structured (JSON)',
        random: 'Text Random',
        binary: 'Binary (Raw)',
        image: 'Image (Binary)',
        pdf: 'PDF (Mixed)'
    };
    return labels[pt] || pt;
}

function renderSinglePayloadCompressionTable(containerId: string, activeSizeKeys: string[], members: string[], latestData: BenchmarkData, pt: PayloadType) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const formatBytes = (bytes: number) => {
        const k = 1024;
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
    };

    let html = `<table class="data-table"><thead><tr><th>Size</th>`;
    members.forEach(m => html += `<th>${m}</th>`);
    html += `</tr></thead><tbody>`;

    for (const size of activeSizeKeys) {
        html += `<tr><td><span style="font-weight:600">${size.toUpperCase()}</span></td>`;
        for (const m of members) {
            const entry = latestData.compression?.[size]?.[pt]?.[m];
            if (entry && entry.compressTime > 0) {
                html += `<td>
                    Ratio: <strong>${entry.ratio.toFixed(1)}%</strong><br>
                    <span style="font-size:0.75em; opacity:0.7">${formatBytes(entry.originalSize || 0)} ➔ ${formatBytes(entry.compSize || 0)}</span><br>
                    <span style="font-size:0.75em; opacity:0.7">Comp: ${entry.compressTime.toFixed(1)}ms / Decomp: ${entry.decompressTime.toFixed(1)}ms</span>
                </td>`;
            } else {
                html += `<td>-</td>`;
            }
        }
        html += `</tr>`;
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
}

export function updateSummaryDashboard(latestData: BenchmarkData) {
    let bestWrite = Infinity; let bestWriteTech = '--';
    let bestRead = Infinity; let bestReadTech = '--';
    let bestCompressRatio = 0; let bestCompressTech = '--';
    let totalTime = 0; let totalOps = 0; let failedOps = 0;

    const payloadTypes: PayloadType[] = ['text', 'json', 'random', 'binary', 'image', 'pdf'];
    const skipList = ['Cookie', 'SessionStorage', 'LocalStorage', 'store.js'];

    // Storage
    const storageKeys: ('low' | 'high')[] = ['low', 'high'];
    storageKeys.forEach(cat => {
        if (!latestData[cat]) return;
        Object.keys(latestData[cat]).forEach(size => {
            payloadTypes.forEach(pt => {
                const sizeData = latestData[cat][size][pt];
                if (!sizeData) return;
                Object.keys(sizeData).forEach(tech => {
                    const entry = sizeData[tech];
                    const iterations = entry.iterations || 1;
                    const ops = ['insert', 'read', 'update', 'delete'] as const;
                    ops.forEach(op => {
                        if (entry[op] !== undefined) {
                            totalOps += iterations;
                            failedOps += (entry.errors?.[op] || 0);
                        }
                    });
                    if (entry.insert > 0 && !entry.errors?.insert) {
                        totalTime += entry.insert;
                        if (!skipList.includes(tech) && entry.insert < bestWrite) {
                            bestWrite = entry.insert;
                            bestWriteTech = `${tech} (${getPayloadLabel(pt)})`;
                        }
                    }
                    if (entry.read > 0 && !entry.errors?.read) {
                        totalTime += entry.read;
                        if (!skipList.includes(tech) && entry.read < bestRead) {
                            bestRead = entry.read;
                            bestReadTech = `${tech} (${getPayloadLabel(pt)})`;
                        }
                    }
                });
            });
        });
    });

    // Compression
    if (latestData.compression) {
        Object.keys(latestData.compression).forEach(size => {
            payloadTypes.forEach(pt => {
                const sizeData = latestData.compression?.[size]?.[pt];
                if (!sizeData) return;
                Object.keys(sizeData).forEach(tech => {
                    const entry = sizeData[tech];
                    if (entry.compressTime > 0) {
                        totalOps++;
                        if (!entry.valid) failedOps++;
                        totalTime += entry.compressTime;
                        if (entry.ratio > bestCompressRatio && entry.valid) {
                            bestCompressRatio = entry.ratio;
                            bestCompressTech = `${tech} (${getPayloadLabel(pt)})`;
                        }
                    }
                });
            });
        });
    }

    summaryBestWrite.innerText = bestWriteTech !== '--' ? `${bestWrite.toFixed(2)}ms` : '--';
    summaryBestWriteTech.innerText = bestWriteTech;
    summaryBestRead.innerText = bestReadTech !== '--' ? `${bestRead.toFixed(2)}ms` : '--';
    summaryBestReadTech.innerText = bestReadTech;
    summaryBestCompress.innerText = bestCompressTech !== '--' ? `${bestCompressRatio.toFixed(1)}%` : '--';
    summaryBestCompressTech.innerText = bestCompressTech;
    summaryTotalTime.innerText = `${(totalTime / 1000).toFixed(2)}s`;

    const failRate = totalOps > 0 ? (failedOps / totalOps) * 100 : 0;
    const failEl = document.getElementById('summary-fail-rate');
    if (failEl) failEl.innerText = `${failRate.toFixed(1)}%`;
}

export function updateTrendCharts(latestData: BenchmarkData, compareData?: BenchmarkData) {
    updateStorageTrends(latestData, 'low', ['Cookie', 'SessionStorage', 'LocalStorage'], compareData);
    updateStorageTrends(latestData, 'high-native', ['Cache API', 'OPFS (Async)', 'OPFS (Sync)', 'IndexedDB'], compareData);
    updateStorageTrends(latestData, 'high-wrapper', ['store.js', 'SQLite (Async)', 'SQLite (Sync)', 'localForage', 'Dexie.js', 'PouchDB'], compareData);
    updateCompressionTrends(latestData);
}

// History Handling
export async function updateHistoryList() {
    const sessions = await getAllSessions();
    historyList.innerHTML = '';

    if (sessions.length === 0) {
        historyList.innerHTML = '<div class="empty-state">No history found.</div>';
        return;
    }

    sessions.sort((a, b) => b.id - a.id).forEach(session => {
        const item = document.createElement('div');
        item.className = `history-item ${selectedSessions.includes(session.id) ? 'selected' : ''}`;
        item.dataset.id = session.id.toString();

        const dateStr = new Date(session.id).toLocaleString();
        item.innerHTML = `
            <div class="history-item-main">
                <div class="history-name">Session ${dateStr}</div>
                <div class="history-meta">${dateStr}</div>
            </div>
            <div class="history-actions">
                <button class="btn-icon btn-delete" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        `;

        item.onclick = async (e) => {
            const btnDelete = (e.target as HTMLElement).closest('.btn-delete');
            if (btnDelete) {
                if (confirm('Delete this session?')) {
                    await deleteSession(session.id);
                    selectedSessions = selectedSessions.filter(id => id !== session.id);
                    updateHistoryList();
                }
                return;
            }

            if (isCompareMode) {
                if (selectedSessions.includes(session.id)) {
                    selectedSessions = selectedSessions.filter(id => id !== session.id);
                } else if (selectedSessions.length < 2) {
                    selectedSessions.push(session.id);
                }
                updateCompareBtn();
                updateHistoryList();
            } else {
                selectedSessions = [session.id];
                setLatestData(session.data);
                updateTrendCharts(session.data);
                updateSummaryDashboard(session.data);
                switchToTab('report');
            }
            updateHistoryList();
        };

        historyList.appendChild(item);
    });
}

export function markBenchmarkFinished(latestData: BenchmarkData) {
    if (btnReportRun) btnReportRun.style.display = 'inline-flex';
    if (btnReportCancel) btnReportCancel.style.display = 'none';
    saveSession(latestData).then(() => {
        addLog('Session saved to persistent storage.', 'success');
        updateHistoryList();
    });
}

export function updateCompareBtn() {
    const btnCompare = document.getElementById('btn-run-compare') as HTMLButtonElement;
    if (btnCompare) {
        btnCompare.innerText = `Compare Selected (${selectedSessions.length}/2)`;
        btnCompare.disabled = selectedSessions.length !== 2;
    }
}

export function initUIListeners(_latestDataRef: BenchmarkData) {
    const btnShowHistory = document.getElementById('btn-show-history') as HTMLButtonElement;
    const btnCloseHistory = document.getElementById('btn-close-history') as HTMLButtonElement;
    const btnClearHistory = document.getElementById('btn-clear-history') as HTMLButtonElement;
    const historyPanel = document.getElementById('history-panel') as HTMLDivElement;

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
        if (isHidden) updateHistoryList();
    });

    const btnToggleCompare = document.getElementById('btn-toggle-compare') as HTMLButtonElement;
    const btnRunCompare = document.getElementById('btn-run-compare') as HTMLButtonElement;
    const btnCancelCompare = document.getElementById('btn-cancel-compare') as HTMLButtonElement;

    function exitCompareMode() {
        isCompareMode = false;
        selectedSessions = [];
        historyPanel.classList.remove('compare-active');
        if (btnRunCompare) btnRunCompare.style.display = 'none';
        if (btnCancelCompare) btnCancelCompare.style.display = 'none';
        updateHistoryList();
    }

    btnToggleCompare?.addEventListener('click', () => {
        isCompareMode = !isCompareMode;
        historyPanel.classList.toggle('compare-active', isCompareMode);
        if (btnRunCompare) btnRunCompare.style.display = isCompareMode ? 'block' : 'none';
        if (btnCancelCompare) btnCancelCompare.style.display = isCompareMode ? 'block' : 'none';
        if (!isCompareMode) selectedSessions = [];
        updateHistoryList();
        updateCompareBtn();
    });

    btnRunCompare?.addEventListener('click', async () => {
        if (selectedSessions.length !== 2) return;
        const sessions = await getAllSessions();
        const s1 = sessions.find(s => s.id === selectedSessions[0]);
        const s2 = sessions.find(s => s.id === selectedSessions[1]);
        if (s1 && s2) {
            setLatestData(s1.data);
            updateTrendCharts(s1.data, s2.data);
            addLog(`Comparing Session #${s1.id.toString().slice(-4)} vs #${s2.id.toString().slice(-4)}`);
            historyPanel.style.display = 'none';
            switchToTab('report');
        }
    });

    btnCancelCompare?.addEventListener('click', exitCompareMode);

    btnCloseHistory?.addEventListener('click', () => {
        historyPanel.style.display = 'none';
    });

    btnClearHistory?.addEventListener('click', async () => {
        if (confirm('Clear all history?')) {
            await clearAllSessions();
            updateHistoryList();
            addLog('All history cleared.', 'success');
        }
    });
}
