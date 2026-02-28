import { createTrendChart, COLORS, mapVal } from './lib/charts';
import { SIZES } from './lib/benchmarks/constants';
import type { BenchmarkData } from './lib/benchmarks/types';
import { switchToTab } from './router';
import { saveSession, getAllSessions, deleteSession, clearAllSessions } from './lib/db';
import { setLatestData } from './lib/benchmarks/runner';

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

        item.onclick = (e: MouseEvent) => {
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

        legendContainer.appendChild(item);
    });
}

function renderStorageTable(containerId: string, activeSizeKeys: string[], members: string[], latestData: BenchmarkData, dataCategory: 'low' | 'high', op: 'insert' | 'read' | 'update' | 'delete') {
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
            const entry = latestData[dataCategory]?.[size]?.[m];
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
            const entry = latestData.compression?.[size]?.[m];
            const val = entry?.[op];
            const errorCount = entry?.errors || 0;
            const isValid = entry?.valid !== false;

            if (val !== undefined && val !== -1) {
                let displayVal = op === 'ratio' ? val.toFixed(2) + 'x' : (val < 1 ? val.toFixed(3) : val.toFixed(1)) + ' ms';
                const errorStr = !isValid || errorCount > 0 ? ` <span style="color:var(--accent-error); font-size:0.7em;">(Fail: ${errorCount})</span>` : '';
                html += `<td>${displayVal}${errorStr}</td>`;
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
    const updateChart = chartRegistry.get(`${category}-update`);
    const deleteChart = chartRegistry.get(`${category}-delete`);

    if (!writeChart || !readChart || !updateChart || !deleteChart) return;

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
    updateChart.data.labels = activeSizeKeys;
    deleteChart.data.labels = activeSizeKeys;

    const datasetsW: any[] = [];
    const datasetsR: any[] = [];
    const datasetsU: any[] = [];
    const datasetsD: any[] = [];

    members.forEach((m, i) => {
        const color = COLORS[i % COLORS.length];

        // Session A
        datasetsW.push({
            label: compareData ? `${m} (A)` : m,
            borderColor: color.border,
            backgroundColor: color.main,
            tension: 0.3,
            data: activeSizeKeys.map(size => {
                const entry = latestData[dataCategory]?.[size]?.[m];
                return (entry && entry.errors?.insert === 0) ? mapVal(entry.insert) : null;
            })
        });
        datasetsR.push({
            label: compareData ? `${m} (A)` : m,
            borderColor: color.border,
            backgroundColor: color.main,
            tension: 0.3,
            data: activeSizeKeys.map(size => {
                const entry = latestData[dataCategory]?.[size]?.[m];
                return (entry && entry.errors?.read === 0) ? mapVal(entry.read) : null;
            })
        });
        datasetsU.push({
            label: compareData ? `${m} (A)` : m,
            borderColor: color.border,
            backgroundColor: color.main,
            tension: 0.3,
            data: activeSizeKeys.map(size => {
                const entry = latestData[dataCategory]?.[size]?.[m];
                return (entry && entry.errors?.update === 0) ? mapVal(entry.update) : null;
            })
        });
        datasetsD.push({
            label: compareData ? `${m} (A)` : m,
            borderColor: color.border,
            backgroundColor: color.main,
            tension: 0.3,
            data: activeSizeKeys.map(size => {
                const entry = latestData[dataCategory]?.[size]?.[m];
                return (entry && entry.errors?.delete === 0) ? mapVal(entry.delete) : null;
            })
        });

        // Session B (Skipping details for brevity, but ensuring color consistency)
        if (compareData) {
            datasetsW.push({
                label: `${m} (B)`,
                borderColor: color.border,
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                tension: 0.3,
                data: activeSizeKeys.map(size => {
                    const entry = compareData[dataCategory]?.[size]?.[m];
                    return (entry && entry.errors?.insert === 0) ? mapVal(entry.insert) : null;
                })
            });
            datasetsR.push({
                label: `${m} (B)`,
                borderColor: color.border,
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                tension: 0.3,
                data: activeSizeKeys.map(size => {
                    const entry = compareData[dataCategory]?.[size]?.[m];
                    return (entry && entry.errors?.read === 0) ? mapVal(entry.read) : null;
                })
            });
            datasetsU.push({
                label: `${m} (B)`,
                borderColor: color.border,
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                tension: 0.3,
                data: activeSizeKeys.map(size => {
                    const entry = compareData[dataCategory]?.[size]?.[m];
                    return (entry && entry.errors?.update === 0) ? mapVal(entry.update) : null;
                })
            });
            datasetsD.push({
                label: `${m} (B)`,
                borderColor: color.border,
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                tension: 0.3,
                data: activeSizeKeys.map(size => {
                    const entry = compareData[dataCategory]?.[size]?.[m];
                    return (entry && entry.errors?.delete === 0) ? mapVal(entry.delete) : null;
                })
            });
        }
    });

    writeChart.data.datasets = datasetsW;
    readChart.data.datasets = datasetsR;
    updateChart.data.datasets = datasetsU;
    deleteChart.data.datasets = datasetsD;

    writeChart.update();
    readChart.update();
    updateChart.update();
    deleteChart.update();

    renderCustomLegend(`${category}-write`, writeChart);
    renderCustomLegend(`${category}-read`, readChart);
    renderCustomLegend(`${category}-update`, updateChart);
    renderCustomLegend(`${category}-delete`, deleteChart);

    const hasData = activeSizeKeys.length > 0;
    updateChartVisibility(`${category}-write`, hasData);
    updateChartVisibility(`${category}-read`, hasData);
    updateChartVisibility(`${category}-update`, hasData);
    updateChartVisibility(`${category}-delete`, hasData);

    if (hasData) {
        renderStorageTable(`table-${category}-write`, activeSizeKeys, members, latestData, dataCategory as 'low' | 'high', 'insert');
        renderStorageTable(`table-${category}-read`, activeSizeKeys, members, latestData, dataCategory as 'low' | 'high', 'read');
        renderStorageTable(`table-${category}-update`, activeSizeKeys, members, latestData, dataCategory as 'low' | 'high', 'update');
        renderStorageTable(`table-${category}-delete`, activeSizeKeys, members, latestData, dataCategory as 'low' | 'high', 'delete');
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

    let totalOps = 0;
    let failedOps = 0;

    // Evaluate Storage (low, high)
    const storageCats: ('low' | 'high')[] = ['low', 'high'];
    const skipList = ['Cookie', 'SessionStorage', 'LocalStorage', 'store.js'];

    for (const cat of storageCats) {
        if (!latestData[cat]) continue;
        for (const size of Object.keys(latestData[cat])) {
            const sizeData = latestData[cat][size];
            for (const tech of Object.keys(sizeData)) {
                const entry = sizeData[tech];
                const iterations = entry.iterations || 1;

                // Track Ops & Failures
                const ops: ('insert' | 'read' | 'update' | 'delete')[] = ['insert', 'read', 'update', 'delete'];
                ops.forEach(op => {
                    if (entry[op] !== undefined) {
                        totalOps += iterations;
                        failedOps += (entry.errors?.[op] || 0);
                    }
                });

                if (entry.insert > 0 && entry.errors?.insert === 0) {
                    totalTime += entry.insert;
                    if (!skipList.includes(tech) && entry.insert < bestWrite) {
                        bestWrite = entry.insert;
                        bestWriteTech = tech;
                    }
                }
                if (entry.read > 0 && entry.errors?.read === 0) {
                    totalTime += entry.read;
                    if (!skipList.includes(tech) && entry.read < bestRead) {
                        bestRead = entry.read;
                        bestReadTech = tech;
                    }
                }
                if (entry.update > 0 && entry.errors?.update === 0) totalTime += entry.update;
                if (entry.delete > 0 && entry.errors?.delete === 0) totalTime += entry.delete;
            }
        }
    }

    // Evaluate Compression
    if (latestData.compression) {
        for (const size of Object.keys(latestData.compression)) {
            const sizeData = latestData.compression[size];
            for (const tech of Object.keys(sizeData)) {
                const entry = sizeData[tech];
                if (entry.compressTime > 0) {
                    totalOps++;
                    if (!entry.valid || entry.errors > 0) failedOps++;

                    totalTime += entry.compressTime;
                    if (entry.ratio > bestCompressRatio && entry.valid) {
                        bestCompressRatio = entry.ratio;
                        bestCompressTech = tech;
                    }
                }
            }
        }
    }

    const failureRate = totalOps > 0 ? (failedOps / totalOps) * 100 : 0;

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
        if (totalOps > 0) {
            const timeStr = totalTime >= 1000 ? (totalTime / 1000).toFixed(1) + 's' : totalTime.toFixed(0) + 'ms';
            const rateStr = failureRate > 0 ? ` (Fail: ${failureRate.toFixed(1)}%)` : '';
            summaryTotalTime.innerText = timeStr + rateStr;
            if (failureRate > 0) {
                summaryTotalTime.style.color = failureRate > 5 ? 'var(--accent-error)' : 'var(--accent-warning)';
            } else {
                summaryTotalTime.style.color = '';
            }
        } else {
            summaryTotalTime.innerText = '--';
            summaryTotalTime.style.color = '';
        }
    }
}

export function updateTrendCharts(latestData: BenchmarkData, compareData?: BenchmarkData) {
    updateStorageTrends(latestData, 'low', ['Cookie', 'SessionStorage', 'LocalStorage'], compareData);
    updateStorageTrends(latestData, 'high-native', ['Cache API', 'IndexedDB', 'OPFS (Async)', 'OPFS (Sync)'], compareData);
    updateStorageTrends(latestData, 'high-wrapper', ['SQLite (Async)', 'SQLite (Sync)', 'localForage', 'Dexie', 'PouchDB', 'store.js'], compareData);
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
