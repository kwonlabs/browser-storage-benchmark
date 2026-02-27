import './style.css';
import { createChart, COLORS } from './lib/charts';
import { generatePayloadString, yieldToMain, measureOperation } from './lib/benchmark';

// Constants
const SIZES = {
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
const btnRunCustom = document.getElementById('btn-run-custom') as HTMLButtonElement;
const btnToggleAdvanced = document.getElementById('btn-toggle-advanced') as HTMLAnchorElement;
const advancedPanel = document.getElementById('advanced-controller') as HTMLDivElement;

const btnExport = document.getElementById('btn-export-json') as HTMLButtonElement;
const btnImport = document.getElementById('btn-import-json') as HTMLButtonElement;
const inputImport = document.getElementById('input-import-json') as HTMLInputElement;

const consoleLogs = document.getElementById('console-logs') as HTMLDivElement;

const progressArea = document.getElementById('overall-progress') as HTMLDivElement;
const progressBar = document.getElementById('progress-bar-fill') as HTMLDivElement;
const progressPercent = document.getElementById('progress-percent') as HTMLSpanElement;
const progressText = document.getElementById('progress-text') as HTMLSpanElement;

const reportLists = {
  native: document.getElementById('report-list-native') as HTMLDivElement,
  wrapper: document.getElementById('report-list-wrapper') as HTMLDivElement,
  compression: document.getElementById('report-list-compression') as HTMLDivElement
};

const categoryChecks = document.querySelectorAll('.category-check') as NodeListOf<HTMLInputElement>;
const sizeChecks = document.querySelectorAll('.size-check') as NodeListOf<HTMLInputElement>;

const btnCatAll = document.getElementById('cat-all') as HTMLButtonElement;
const btnCatNone = document.getElementById('cat-none') as HTMLButtonElement;
const btnSizeAll = document.getElementById('size-all') as HTMLButtonElement;
const btnSizeNone = document.getElementById('size-none') as HTMLButtonElement;

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


function getOrCreateChartContainer(category: string, sizeName: string) {
  const containerId = `chart-${category}-${sizeName}`;
  let item = document.getElementById(containerId);

  if (!item) {
    const list = reportLists[category as keyof typeof reportLists];
    if (list?.querySelector('.empty-state')) {
      list.innerHTML = '';
    }

    item = document.createElement('div');
    item.id = containerId;
    item.className = 'report-chart-item';
    item.innerHTML = `
      <h4>${category.toUpperCase()} - ${sizeName.toUpperCase()}</h4>
      <div class="chart-wrapper">
        <canvas id="${containerId}-canvas"></canvas>
      </div>
    `;
    list?.appendChild(item);

    const canvas = document.getElementById(`${containerId}-canvas`) as HTMLCanvasElement;
    const chart = createChart(canvas, category as any, sizeName);
    chartRegistry.set(containerId, chart);
  }

  return chartRegistry.get(containerId);
}

function mapVal(v: any) { return typeof v === 'number' ? v : 0; }

function updateChartData(category: string, sizeName: string, data: any) {
  const chart = getOrCreateChartContainer(category, sizeName);
  if (!chart) return;

  if (category === 'native' || category === 'wrapper') {
    const labels = chart.data.labels;
    chart.data.datasets = [
      { label: 'Insert', backgroundColor: COLORS[0], minBarLength: 3, data: labels.map((l: string) => mapVal(data[l]?.insert)) },
      { label: 'Read', backgroundColor: COLORS[1], minBarLength: 3, data: labels.map((l: string) => mapVal(data[l]?.read)) },
      { label: 'Update', backgroundColor: COLORS[2], minBarLength: 3, data: labels.map((l: string) => mapVal(data[l]?.update)) },
      { label: 'Delete', backgroundColor: COLORS[3], minBarLength: 3, data: labels.map((l: string) => mapVal(data[l]?.delete)) }
    ];
  } else if (category === 'compression') {
    const labels = chart.data.labels;
    chart.data.datasets = [
      { label: 'Compress (ms)', type: 'bar', yAxisID: 'yTime', backgroundColor: COLORS[0], data: labels.map((l: string) => data[l]?.compressTime || 0) },
      { label: 'Decompress (ms)', type: 'bar', yAxisID: 'yTime', backgroundColor: COLORS[1], data: labels.map((l: string) => data[l]?.decompressTime || 0) },
      { label: 'Ratio (x)', type: 'line', yAxisID: 'yRatio', borderColor: COLORS[2], backgroundColor: COLORS[2], borderWidth: 2, data: labels.map((l: string) => data[l]?.ratio || 1) }
    ];
  }
  chart.update();
}

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
  updateChartData('native', sizeName, latestData.native[sizeName]);
  runNext();
};

wrapperWorker.onmessage = (e) => {
  const { sizeName, payload } = e.data;
  latestData.wrapper[sizeName] = { ...latestData.wrapper[sizeName], ...payload };
  addLog(`Library - ${sizeName.toUpperCase()} completed.`, 'success');
  updateChartData('wrapper', sizeName, latestData.wrapper[sizeName]);
  runNext();
};

compressionWorker.onmessage = (e) => {
  const { sizeName, payload } = e.data;
  latestData.compression[sizeName] = payload;
  addLog(`Compression - ${sizeName.toUpperCase()} completed.`, 'success');
  updateChartData('compression', sizeName, payload);
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
  btnToggleAdvanced.innerText = isHidden ? 'Hide Advanced Settings' : 'Advanced Settings';
});

btnCatAll.addEventListener('click', () => categoryChecks.forEach(c => c.checked = true));
btnCatNone.addEventListener('click', () => categoryChecks.forEach(c => c.checked = false));
btnSizeAll.addEventListener('click', () => sizeChecks.forEach(c => c.checked = true));
btnSizeNone.addEventListener('click', () => sizeChecks.forEach(c => c.checked = false));

btnRunAll.addEventListener('click', () => {
  const standardSizes = ['128b', '1kb', '10kb', '100kb', '1mb', '10mb'];
  categoryChecks.forEach(c => c.checked = true);
  sizeChecks.forEach(c => c.checked = standardSizes.includes(c.value));
  btnRunCustom.click();
});

btnRunCustom.addEventListener('click', () => {
  const selectedCats = Array.from(categoryChecks).filter(c => c.checked).map(c => c.value);
  const selectedSizes = Array.from(sizeChecks).filter(c => c.checked).map(c => c.value);

  if (selectedCats.length === 0 || selectedSizes.length === 0) {
    alert('Select at least one category and one size.');
    return;
  }

  const hasLarge = selectedSizes.some(s => s === '100mb' || s === '1gb');
  if (hasLarge) {
    if (!confirm('Benchmark with 100MB+ data may freeze the browser. Proceed?')) {
      return;
    }
  }

  const tasks: TaskDef[] = [];
  selectedSizes.forEach(s => selectedCats.forEach(c => tasks.push({ category: c, sizeName: s, sizeValue: SIZES[s as keyof typeof SIZES] })));
  startBenchmark(tasks);
});

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
      Object.keys(data).forEach(cat => {
        Object.keys(data[cat]).forEach(size => {
          updateChartData(cat, size, data[cat][size]);
        });
      });
      addLog('Charts regenerated successfully.', 'success');
    } catch (err) {
      addLog('Failed to import JSON: Invalid format.', 'error');
    }
  };
  reader.readAsText(file);
});
