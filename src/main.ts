import './style.css';
import { createTrendChart, COLORS, mapVal } from './lib/charts';
import { generatePayloadString, yieldToMain, measureOperation } from './lib/benchmark';
import { saveSession, getAllSessions, getLatestSession, deleteSession, clearAllSessions } from './lib/db';

// Constants
const SIZES: Record<string, number> = {
  '128b': 128,
  '1kb': 1024,
  '10kb': 10240,
  '100kb': 102400,
  '1mb': 1024 * 1024,
  '10mb': 10 * 1024 * 1024,
  '100mb': 100 * 1024 * 1024,
  '1gb': 1024 * 1024 * 1024
};

// Interfaces
interface TaskDef { category: string; sizeName: string; sizeValue: number; }
interface BenchmarkResult { insert: number; read: number; update: number; delete: number; }

// Global State
let isRunning = false;
const testQueue: TaskDef[] = [];
let totalTasks = 0;
let completedTasks = 0;

let latestData: Record<string, Record<string, any>> = {
  native: {},
  wrapper: {},
  compression: {}
};

// Worker Instances
const nativeWorker = new Worker(new URL('./workers/native.worker.ts', import.meta.url), { type: 'module' });
const wrapperWorker = new Worker(new URL('./workers/wrapper.worker.ts', import.meta.url), { type: 'module' });
const compressionWorker = new Worker(new URL('./workers/compression.worker.ts', import.meta.url), { type: 'module' });

// UI Elements
const btnRunAll = document.getElementById('btn-run-all') as HTMLButtonElement;
const btnReportRun = document.getElementById('btn-report-run') as HTMLButtonElement;
// Button logic handled via event delegation or consolidated handlers
const btnToggleAdvanced = document.getElementById('btn-toggle-advanced') as HTMLAnchorElement;
const advancedPanel = document.getElementById('advanced-controller') as HTMLDivElement;

const btnExport = document.getElementById('btn-export-json') as HTMLButtonElement;
const btnImport = document.getElementById('btn-import-json') as HTMLButtonElement;
const inputImport = document.getElementById('input-import-json') as HTMLInputElement;

const logo = document.querySelector('.logo') as HTMLDivElement;
logo.addEventListener('click', () => switchToTab('tab-home'));

const consoleLogs = document.getElementById('console-logs') as HTMLDivElement;

const progressArea = document.getElementById('overall-progress') as HTMLDivElement;
const progressBar = document.getElementById('progress-bar-fill') as HTMLDivElement;
const progressPercent = document.getElementById('progress-percent') as HTMLSpanElement;
const progressText = document.getElementById('progress-text') as HTMLSpanElement;


const categoryChecks = document.querySelectorAll('.category-check') as NodeListOf<HTMLInputElement>;
const sizeChecks = document.querySelectorAll('.size-check') as NodeListOf<HTMLInputElement>;

const btnCatAll = document.getElementById('cat-all') as HTMLButtonElement;
const btnCatNone = document.getElementById('cat-none') as HTMLButtonElement;
const btnSizeAll = document.getElementById('size-all') as HTMLButtonElement;
const btnSizeNone = document.getElementById('size-none') as HTMLButtonElement;

const btnShowHistory = document.getElementById('btn-show-history') as HTMLButtonElement;
const btnCloseHistory = document.getElementById('btn-close-history') as HTMLButtonElement;
const btnClearHistory = document.getElementById('btn-clear-history') as HTMLButtonElement;
const historyPanel = document.getElementById('history-panel') as HTMLDivElement;
const historyList = document.getElementById('history-list') as HTMLDivElement;

// Chart Registry
const chartRegistry: Map<string, any> = new Map();

// Helper functions
function addLog(msg: string, type: 'system' | 'success' | 'error' = 'system') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  const now = new Date();
  const ts = now.toLocaleTimeString([], { hour12: false });
  entry.innerText = `[${ts}] ${msg}`;
  consoleLogs.appendChild(entry);
  consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

function switchToTab(tabId: string) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    const btn = b as HTMLElement;
    if (btn.dataset.target === tabId) {
      btn.click();
    }
  });
}


function initCharts() {
  chartRegistry.set('native-write', createTrendChart(document.getElementById('chart-trend-native-write') as HTMLCanvasElement, 'Native Storage: Write Latency (ms)', 'Latency (ms)'));
  chartRegistry.set('native-read', createTrendChart(document.getElementById('chart-trend-native-read') as HTMLCanvasElement, 'Native Storage: Read Latency (ms)', 'Latency (ms)'));
  chartRegistry.set('wrapper-write', createTrendChart(document.getElementById('chart-trend-wrapper-write') as HTMLCanvasElement, 'Library: Write Latency (ms)', 'Latency (ms)'));
  chartRegistry.set('wrapper-read', createTrendChart(document.getElementById('chart-trend-wrapper-read') as HTMLCanvasElement, 'Library: Read Latency (ms)', 'Latency (ms)'));
  chartRegistry.set('compression-speed', createTrendChart(document.getElementById('chart-trend-compression-speed') as HTMLCanvasElement, 'Compression Speed Trend (ms)', 'Time (ms)'));
  chartRegistry.set('compression-ratio', createTrendChart(document.getElementById('chart-trend-compression-ratio') as HTMLCanvasElement, 'Compression Ratio Trend (x)', 'Ratio (x)', true));
}

function updateTrendCharts() {
  // Update Native Trends
  updateStorageTrends('native', ['Cookie', 'SessionStorage', 'LocalStorage', 'Cache API', 'IndexedDB', 'OPFS']);
  // Update Wrapper Trends
  updateStorageTrends('wrapper', ['store.js', 'SQLite', 'localForage', 'Dexie', 'PouchDB']);
  // Update Compression Trends
  updateCompressionTrends();
}

function updateStorageTrends(category: string, members: string[]) {
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

function updateCompressionTrends() {
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

initCharts();


function updateProgress(percent: number, msg: string) {
  progressBar.style.width = `${percent}%`;
  progressPercent.innerText = `${percent}%`;
  progressText.innerText = msg;
}

async function runMainThreadNative(sizeName: string, sizeValue: number) {
  const results: Record<string, BenchmarkResult> = {};
  await yieldToMain(); // Yield to allow UI updates

  const str = generatePayloadString(sizeValue);
  const modStr = str + 'm';
  const k = `bench_k_${sizeName}`;

  // Cookie
  try {
    results['Cookie'] = {
      insert: await measureOperation(sizeValue, () => { const s = performance.now(); document.cookie = `${k}=${str};path=/;max-age=60`; return performance.now() - s; }),
      read: await measureOperation(sizeValue, () => { const s = performance.now(); void document.cookie; return performance.now() - s; }),
      update: await measureOperation(sizeValue, () => { const s = performance.now(); document.cookie = `${k}=${modStr};path=/;max-age=60`; return performance.now() - s; }),
      delete: await measureOperation(sizeValue, () => { const s = performance.now(); document.cookie = `${k}=;path=/;max-age=0`; return performance.now() - s; })
    };
  } catch (e) { results['Cookie'] = { insert: -1, read: -1, update: -1, delete: -1 }; }

  // SessionStorage
  try {
    results['SessionStorage'] = {
      insert: await measureOperation(sizeValue, () => { const s = performance.now(); sessionStorage.setItem(k, str); return performance.now() - s; }),
      read: await measureOperation(sizeValue, () => { const s = performance.now(); sessionStorage.getItem(k); return performance.now() - s; }),
      update: await measureOperation(sizeValue, () => { const s = performance.now(); sessionStorage.setItem(k, modStr); return performance.now() - s; }),
      delete: await measureOperation(sizeValue, () => { const s = performance.now(); sessionStorage.removeItem(k); return performance.now() - s; })
    };
  } catch (e) { results['SessionStorage'] = { insert: -1, read: -1, update: -1, delete: -1 }; }

  // LocalStorage
  try {
    results['LocalStorage'] = {
      insert: await measureOperation(sizeValue, () => { const s = performance.now(); localStorage.setItem(k, str); return performance.now() - s; }),
      read: await measureOperation(sizeValue, () => { const s = performance.now(); localStorage.getItem(k); return performance.now() - s; }),
      update: await measureOperation(sizeValue, () => { const s = performance.now(); localStorage.setItem(k, modStr); return performance.now() - s; }),
      delete: await measureOperation(sizeValue, () => { const s = performance.now(); localStorage.removeItem(k); return performance.now() - s; })
    };
  } catch (e) { results['LocalStorage'] = { insert: -1, read: -1, update: -1, delete: -1 }; }

  return results;
}

async function runMainThreadWrapper(sizeName: string, sizeValue: number) {
  const results: Record<string, BenchmarkResult> = {};
  await yieldToMain();

  const str = generatePayloadString(sizeValue);
  const modStr = str + 'm';
  const k = `bench_st_${sizeName}`;

  // store.js (usually uses localStorage fallback)
  try {
    if (typeof localStorage !== 'undefined') {
      results['store.js'] = {
        insert: await measureOperation(sizeValue, () => { const s = performance.now(); localStorage.setItem(k, str); return performance.now() - s; }),
        read: await measureOperation(sizeValue, () => { const s = performance.now(); localStorage.getItem(k); return performance.now() - s; }),
        update: await measureOperation(sizeValue, () => { const s = performance.now(); localStorage.setItem(k, modStr); return performance.now() - s; }),
        delete: await measureOperation(sizeValue, () => { const s = performance.now(); localStorage.removeItem(k); return performance.now() - s; })
      };
    } else {
      results['store.js'] = { insert: -1, read: -1, update: -1, delete: -1 };
    }
  } catch (e) { results['store.js'] = { insert: -1, read: -1, update: -1, delete: -1 }; }
  return results;
}

async function runNext() {
  if (testQueue.length === 0) {
    isRunning = false;
    updateProgress(100, 'All benchmarks completed!');
    addLog('All tasks finished successfully.', 'success');
    saveSession(latestData).then(() => {
      addLog('Session saved to persistent storage.');
      refreshHistory();
    });
    return;
  }

  const task = testQueue.shift()!;
  completedTasks++;
  const percent = Math.round(((completedTasks - 1) / totalTasks) * 100);
  updateProgress(percent, `Running ${task.category.toUpperCase()} - ${task.sizeName.toUpperCase()}...`);
  addLog(`Executing: ${task.category.toUpperCase()} at ${task.sizeName.toUpperCase()}`);

  const sizeValue = SIZES[task.sizeName as keyof typeof SIZES];

  if (task.category === 'native') {
    const mainResults = await runMainThreadNative(task.sizeName, sizeValue);
    latestData.native[task.sizeName] = { ...mainResults };
    nativeWorker.postMessage({ type: 'start_native', sizeName: task.sizeName, sizeValue });
  } else if (task.category === 'wrapper') {
    const mainResults = await runMainThreadWrapper(task.sizeName, sizeValue);
    latestData.wrapper[task.sizeName] = { ...mainResults };
    wrapperWorker.postMessage({ type: 'start_wrapper', sizeName: task.sizeName, sizeValue });
  } else if (task.category === 'compression') {
    compressionWorker.postMessage({ type: 'start_compression', sizeName: task.sizeName, sizeValue });
  }
}

async function startBenchmark(tasks: TaskDef[]) {
  if (isRunning) return;
  isRunning = true;
  testQueue.length = 0;
  testQueue.push(...tasks);
  totalTasks = tasks.length;
  completedTasks = 0;

  switchToTab('tab-report');
  progressArea.style.display = 'block';
  addLog(`Benchmark session started. Total tasks: ${totalTasks}`);
  updateProgress(0, 'Starting...');
  runNext();
}

// Worker Handlers
nativeWorker.onmessage = (e) => {
  const { sizeName, payload } = e.data;
  latestData.native[sizeName] = { ...latestData.native[sizeName], ...payload };
  addLog(`Native - ${sizeName.toUpperCase()} completed.`, 'success');
  updateTrendCharts();
  runNext();
};

wrapperWorker.onmessage = (e) => {
  const { sizeName, payload } = e.data;
  latestData.wrapper[sizeName] = { ...latestData.wrapper[sizeName], ...payload };
  addLog(`Library - ${sizeName.toUpperCase()} completed.`, 'success');
  updateTrendCharts();
  runNext();
};

compressionWorker.onmessage = (e) => {
  const { sizeName, payload } = e.data;
  latestData.compression[sizeName] = payload;
  addLog(`Compression - ${sizeName.toUpperCase()} completed.`, 'success');
  updateTrendCharts();
  runNext();
};

// Event Listeners
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const target = (btn as HTMLElement).dataset.target!;
    document.getElementById(target)?.classList.add('active');
  });
});

btnToggleAdvanced.addEventListener('click', (e) => {
  e.preventDefault();
  const isHidden = advancedPanel.style.display === 'none';
  advancedPanel.style.display = isHidden ? 'block' : 'none';
  btnToggleAdvanced.classList.toggle('toggle-active', isHidden);
});

btnCatAll.addEventListener('click', () => categoryChecks.forEach(c => c.checked = true));
btnCatNone.addEventListener('click', () => categoryChecks.forEach(c => c.checked = false));
btnSizeAll.addEventListener('click', () => sizeChecks.forEach(c => c.checked = true));
btnSizeNone.addEventListener('click', () => sizeChecks.forEach(c => c.checked = false));
const btnSizeDefault = document.getElementById('size-default') as HTMLButtonElement;
btnSizeDefault.addEventListener('click', () => {
  const defaults = ['128b', '1kb', '10kb', '100kb', '1mb', '10mb'];
  sizeChecks.forEach(c => c.checked = defaults.includes(c.value));
});

btnReportRun.addEventListener('click', () => {
  const selectedCats = Array.from(categoryChecks).filter(c => c.checked).map(c => c.value);
  const selectedSizes = Array.from(sizeChecks).filter(c => c.checked).map(c => c.value);

  if (selectedCats.length === 0 || selectedSizes.length === 0) {
    alert('Select at least one category and size.');
    return;
  }

  const hasLarge = selectedSizes.some(s => s === '100mb' || s === '1gb');
  if (hasLarge) {
    if (!confirm('Benchmark with 100MB+ data may freeze the browser. Proceed?')) {
      return;
    }
  }

  advancedPanel.style.display = 'none';
  btnToggleAdvanced.classList.remove('toggle-active');

  const tasks: TaskDef[] = [];
  selectedSizes.forEach(s => selectedCats.forEach(c => tasks.push({
    category: c,
    sizeName: s,
    sizeValue: SIZES[s as keyof typeof SIZES]
  })));

  startBenchmark(tasks);
});

btnRunAll.addEventListener('click', () => {
  const defaultCats = ['native', 'wrapper'];
  const defaultSizes = ['128b', '1kb', '10kb', '100kb', '1mb', '10mb'];

  const tasks: TaskDef[] = [];
  defaultSizes.forEach(s => defaultCats.forEach(c => tasks.push({
    category: c,
    sizeName: s,
    sizeValue: SIZES[s as keyof typeof SIZES]
  })));

  switchToTab('tab-report');
  startBenchmark(tasks);
});

// Run All handles the redirection and clicks btnReportRun

btnExport.addEventListener('click', () => {
  const dataStr = JSON.stringify(latestData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `benchmark_results_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  addLog('Results exported as JSON.');
});

btnImport.addEventListener('click', () => inputImport.click());
inputImport.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (re) => {
    try {
      const data = JSON.parse(re.target?.result as string);
      latestData = data;
      addLog('Data imported from JSON. Regenerating charts...');
      updateTrendCharts();
      addLog('Charts regenerated successfully.', 'success');
    } catch (err) {
      addLog('Failed to import JSON: Invalid format.', 'error');
    }
  };
  reader.readAsText(file);
});

// History logic
async function refreshHistory() {
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
      if ((e.target as HTMLElement).classList.contains('btn-delete-session')) return;
      latestData = session.data;
      updateTrendCharts();
      addLog(`Loaded historical session from ${session.timestamp}.`);
      historyPanel.style.display = 'none';
      switchToTab('tab-report');
    });

    item.querySelector('.btn-delete-session')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Delete this session?')) {
        await deleteSession(session.id);
        refreshHistory();
      }
    });

    historyList.appendChild(item);
  });
}

async function loadLatest() {
  const session = await getLatestSession();
  if (session) {
    latestData = session.data;
    updateTrendCharts();
    addLog('Auto-loaded latest session from storage.');
  }
}

// Initial Load
loadLatest();
refreshHistory();

// Event Listeners
btnShowHistory.addEventListener('click', () => {
  const isHidden = historyPanel.style.display === 'none';
  historyPanel.style.display = isHidden ? 'flex' : 'none';
  if (isHidden) refreshHistory();
});

btnCloseHistory.addEventListener('click', () => {
  historyPanel.style.display = 'none';
});

btnClearHistory.addEventListener('click', async () => {
  if (confirm('Clear all history?')) {
    await clearAllSessions();
    refreshHistory();
    addLog('All history cleared.');
  }
});

