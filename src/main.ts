import './style.css';
import Chart from 'chart.js/auto';

// ===== UI Elements =====
const logsEl = document.getElementById('logs') as HTMLDivElement;
const btnExport = document.getElementById('btn-export') as HTMLButtonElement;
const btnImport = document.getElementById('btn-import') as HTMLButtonElement;
const inputImport = document.getElementById('input-import') as HTMLInputElement;
const btnCopyLogs = document.getElementById('btn-copy-logs') as HTMLButtonElement;

const nativeBtns = document.getElementById('native-buttons')?.querySelectorAll('button') || [] as unknown as NodeListOf<HTMLButtonElement>;
const wrapperBtns = document.getElementById('wrapper-buttons')?.querySelectorAll('button') || [] as unknown as NodeListOf<HTMLButtonElement>;
const compressionBtns = document.getElementById('compression-buttons')?.querySelectorAll('button') || [] as unknown as NodeListOf<HTMLButtonElement>;

const btnRunCustom = document.getElementById('btn-run-custom') as HTMLButtonElement;
const categoryChecks = document.querySelectorAll('.category-check') as NodeListOf<HTMLInputElement>;
const sizeChecks = document.querySelectorAll('.size-check') as NodeListOf<HTMLInputElement>;

const chartNativeCtx = document.getElementById('chart-native') as HTMLCanvasElement;
const chartWrapperCtx = document.getElementById('chart-wrapper') as HTMLCanvasElement;
const chartCompressionCtx = document.getElementById('chart-compression') as HTMLCanvasElement;

const chartHomeNativeCtx = document.getElementById('chart-dashboard-native') as HTMLCanvasElement;
const chartHomeWrapperCtx = document.getElementById('chart-dashboard-wrapper') as HTMLCanvasElement;
const chartHomeCompressionCtx = document.getElementById('chart-dashboard-compression') as HTMLCanvasElement;

const chartReportNativeCtx = document.getElementById('chart-dashboard-native-v2') as HTMLCanvasElement;
const chartReportWrapperCtx = document.getElementById('chart-dashboard-wrapper-v2') as HTMLCanvasElement;
const chartReportCompressionCtx = document.getElementById('chart-dashboard-compression-v2') as HTMLCanvasElement;

const btnCatAll = document.getElementById('cat-all') as HTMLButtonElement;
const btnCatNone = document.getElementById('cat-none') as HTMLButtonElement;
const btnSizeAll = document.getElementById('size-all') as HTMLButtonElement;
const btnSizeNone = document.getElementById('size-none') as HTMLButtonElement;

const btnRunAll = document.getElementById('btn-run-all') as HTMLButtonElement;
const progressArea = document.getElementById('overall-progress') as HTMLDivElement;
const progressBar = document.getElementById('progress-bar-fill') as HTMLDivElement;
const progressText = document.getElementById('progress-text') as HTMLSpanElement;
const progressPercent = document.getElementById('progress-percent') as HTMLSpanElement;

// ===== State Management =====
export interface BenchmarkState {
  native: Record<string, Record<string, { insert: number, read: number, update: number, delete: number }>>;
  wrapper: Record<string, Record<string, { insert: number, read: number, update: number, delete: number }>>;
  compression: Record<string, Record<string, { compressTime: number, decompressTime: number, ratio: number, compSize?: number }>>;
}

let latestData: BenchmarkState = {
  native: {},
  wrapper: {},
  compression: {}
};

export const SIZES = ['128b', '1kb', '10kb', '100kb', '1mb', '10mb', '100mb', '1gb'];
const SIZE_BYTES: Record<string, number> = {
  '128b': 128, '1kb': 1024, '10kb': 10240, '100kb': 102400,
  '1mb': 1024 * 1024, '10mb': 10 * 1024 * 1024, '100mb': 100 * 1024 * 1024, '1gb': 1024 * 1024 * 1024
};

// Colors matching the UI theme
const colors = [
  'rgba(59, 130, 246, 0.7)', // Blue
  'rgba(16, 185, 129, 0.7)', // Emerald
  'rgba(139, 92, 246, 0.7)', // Violet
  'rgba(245, 158, 11, 0.7)', // Amber
  'rgba(239, 68, 68, 0.7)',  // Red
  'rgba(14, 165, 233, 0.7)'  // Sky
];

// ===== Web Worker =====
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

// ===== Chart Instances =====
let chartNative: Chart;
let chartWrapper: Chart;
let chartCompression: Chart;

let chartDashNative: Chart;
let chartDashWrapper: Chart;
let chartDashCompression: Chart;

let chartReportNative: Chart;
let chartReportWrapper: Chart;
let chartReportCompression: Chart;

function initCharts() {
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    color: '#94a3b8',
    scales: {
      y: { type: 'logarithmic' as const, title: { display: true, text: 'Time (ms) - Log Scale', color: '#94a3b8' }, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
      x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
    },
    plugins: {
      legend: { labels: { color: '#f8fafc' } }
    }
  } as const;

  // Custom plugin to show "N/A" for skipped tests (value = -1)
  const skipPlugin = {
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
            // Draw N/A at the bottom of the chart area for this X position
            ctx.fillText('N/A', bar.x, chart.chartArea.bottom - 5);
            ctx.restore();
          }
        });
      });
    }
  };

  chartNative = new Chart(chartNativeCtx, {
    type: 'bar',
    plugins: [skipPlugin],
    data: { labels: [], datasets: [] },
    options: { ...commonOptions, plugins: { ...commonOptions.plugins, title: { display: true, text: 'Native Storage (CRUD Time)', color: '#f8fafc' } } }
  });

  chartWrapper = new Chart(chartWrapperCtx, {
    type: 'bar',
    plugins: [skipPlugin],
    data: { labels: [], datasets: [] },
    options: { ...commonOptions, plugins: { ...commonOptions.plugins, title: { display: true, text: 'Wrapper Libraries (CRUD Time)', color: '#f8fafc' } } }
  });

  const compOptions = {
    responsive: true, maintainAspectRatio: false, color: '#94a3b8',
    scales: {
      yTime: { type: 'logarithmic' as const, position: 'left' as const, title: { display: true, text: 'Time (ms) - Log Scale', color: '#94a3b8' }, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
      yRatio: { type: 'linear' as const, position: 'right' as const, title: { display: true, text: 'Compression Ratio (x)', color: '#a78bfa' }, grid: { drawOnChartArea: false }, ticks: { color: '#a78bfa' } },
      x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
    },
    plugins: {
      legend: { labels: { color: '#f8fafc' } },
      title: { display: true, text: 'Compression Performance (Speed vs Ratio)', color: '#f8fafc' }
    }
  } as const;

  chartCompression = new Chart(chartCompressionCtx, {
    type: 'bar',
    data: { labels: ['None', 'ZIP', 'Gzip', 'Deflate', 'Brotli', 'zstd'], datasets: [] },
    options: compOptions
  });

  // Home Summary Charts
  chartDashNative = new Chart(chartHomeNativeCtx, {
    type: 'bar', plugins: [skipPlugin], data: { labels: [], datasets: [] },
    options: { ...commonOptions, plugins: { ...commonOptions.plugins, title: { display: false } } }
  });
  chartDashWrapper = new Chart(chartHomeWrapperCtx, {
    type: 'bar', plugins: [skipPlugin], data: { labels: [], datasets: [] },
    options: { ...commonOptions, plugins: { ...commonOptions.plugins, title: { display: false } } }
  });
  chartDashCompression = new Chart(chartHomeCompressionCtx, {
    type: 'bar',
    data: { labels: ['None', 'ZIP', 'Gzip', 'Deflate', 'Brotli', 'zstd'], datasets: [] },
    options: { ...compOptions, plugins: { ...compOptions.plugins, title: { display: false } } }
  });

  // Report Full Overview Charts
  chartReportNative = new Chart(chartReportNativeCtx, {
    type: 'bar', plugins: [skipPlugin], data: { labels: [], datasets: [] },
    options: { ...commonOptions, plugins: { ...commonOptions.plugins, title: { display: false } } }
  });
  chartReportWrapper = new Chart(chartReportWrapperCtx, {
    type: 'bar', plugins: [skipPlugin], data: { labels: [], datasets: [] },
    options: { ...commonOptions, plugins: { ...commonOptions.plugins, title: { display: false } } }
  });
  chartReportCompression = new Chart(chartReportCompressionCtx, {
    type: 'bar',
    data: { labels: ['None', 'ZIP', 'Gzip', 'Deflate', 'Brotli', 'zstd'], datasets: [] },
    options: { ...compOptions, plugins: { ...compOptions.plugins, title: { display: false } } }
  });
}

const mapVal = (v: any) => {
  if (v === -1) return -1;
  if (v === undefined || v === null) return 0;
  return Math.max(v, 0.001);
};

function updateNativeChart(sizeName: string) {
  const data = latestData.native[sizeName];
  if (!data) return;
  const labels = ['Cookies', 'SessionStorage', 'LocalStorage', 'CacheAPI', 'IndexedDB', 'OPFS'];

  // Datasets for Insert, Read, Update, Delete
  chartNative.data.labels = labels;
  chartNative.data.datasets = [
    { label: 'Insert', backgroundColor: colors[0], minBarLength: 3, data: labels.map(l => mapVal(data[l]?.insert)) },
    { label: 'Read', backgroundColor: colors[1], minBarLength: 3, data: labels.map(l => mapVal(data[l]?.read)) },
    { label: 'Update', backgroundColor: colors[2], minBarLength: 3, data: labels.map(l => mapVal(data[l]?.update)) },
    { label: 'Delete', backgroundColor: colors[3], minBarLength: 3, data: labels.map(l => mapVal(data[l]?.delete)) }
  ];
  chartNative.options.plugins!.title!.text = `Native Storage (${sizeName.toUpperCase()})`;
  chartNative.update();

  chartDashNative.data.labels = labels;
  chartDashNative.data.datasets = chartNative.data.datasets;
  chartDashNative.update();

  chartReportNative.data.labels = labels;
  chartReportNative.data.datasets = chartNative.data.datasets;
  chartReportNative.update();
}

function updateWrapperChart(sizeName: string) {
  const data = latestData.wrapper[sizeName];
  if (!data) return;
  const labels = ['store.js', 'SQLite', 'localForage', 'Dexie', 'PouchDB'];

  chartWrapper.data.labels = labels;
  chartWrapper.data.datasets = [
    { label: 'Insert', backgroundColor: colors[0], minBarLength: 3, data: labels.map(l => mapVal(data[l]?.insert)) },
    { label: 'Read', backgroundColor: colors[1], minBarLength: 3, data: labels.map(l => mapVal(data[l]?.read)) },
    { label: 'Update', backgroundColor: colors[2], minBarLength: 3, data: labels.map(l => mapVal(data[l]?.update)) },
    { label: 'Delete', backgroundColor: colors[3], minBarLength: 3, data: labels.map(l => mapVal(data[l]?.delete)) }
  ];
  chartWrapper.options.plugins!.title!.text = `Wrapper Libraries (${sizeName.toUpperCase()})`;
  chartWrapper.update();

  chartDashWrapper.data.labels = labels;
  chartDashWrapper.data.datasets = chartWrapper.data.datasets;
  chartDashWrapper.update();

  chartReportWrapper.data.labels = labels;
  chartReportWrapper.data.datasets = chartWrapper.data.datasets;
  chartReportWrapper.update();
}

function updateCompressionChart(sizeName: string) {
  const data = latestData.compression[sizeName];
  if (!data) return;
  const labels = ['None', 'ZIP', 'Gzip', 'Deflate', 'Brotli', 'zstd'];

  chartCompression.data.labels = labels;
  chartCompression.data.datasets = [
    {
      label: 'Compress Time (ms)',
      type: 'bar',
      yAxisID: 'yTime',
      backgroundColor: colors[0],
      data: labels.map(l => data[l]?.compressTime || 0)
    },
    {
      label: 'Decompress Time (ms)',
      type: 'bar',
      yAxisID: 'yTime',
      backgroundColor: colors[1],
      data: labels.map(l => data[l]?.decompressTime || 0)
    },
    {
      label: 'Compression Ratio (x)',
      type: 'line',
      yAxisID: 'yRatio',
      borderColor: colors[2],
      backgroundColor: colors[2],
      borderWidth: 2,
      data: labels.map(l => data[l]?.ratio || 1)
    }
  ];
  chartCompression.options.plugins!.title!.text = `Compression Bench (${sizeName.toUpperCase()})`;
  chartCompression.update();

  chartDashCompression.data.labels = labels;
  chartDashCompression.data.datasets = chartCompression.data.datasets;
  chartDashCompression.update();

  chartReportCompression.data.labels = labels;
  chartReportCompression.data.datasets = chartCompression.data.datasets;
  chartReportCompression.update();
}

function renderAllCharts(sizeFallback: string = '1kb') {
  // Finds the most recently heavily populated size, or defaults
  const availNative = Object.keys(latestData.native).pop() || sizeFallback;
  const availWrapper = Object.keys(latestData.wrapper).pop() || sizeFallback;
  const availComp = Object.keys(latestData.compression).pop() || sizeFallback;

  if (latestData.native[availNative]) updateNativeChart(availNative);
  if (latestData.wrapper[availWrapper]) updateWrapperChart(availWrapper);
  if (latestData.compression[availComp]) updateCompressionChart(availComp);
}

// ===== Utility =====
function appendLog(msg: string, type: 'info' | 'error' | 'success' | 'warn' = 'info') {
  const colorClass = type === 'info' ? '' : `log-${type}`;
  logsEl.innerHTML += `<div class="${colorClass}">[${new Date().toLocaleTimeString()}] ${msg}</div>`;
  logsEl.scrollTop = logsEl.scrollHeight;
}

function disableButtons(NodeList: NodeListOf<HTMLButtonElement>, disable: boolean) {
  NodeList.forEach(btn => btn.disabled = disable);
}

// ===== Main Thread Engines (Native Web Storage) =====
// Generates a string of a given byte size (approximate for English chars)
function generateDataString(sizeBytes: number) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ';
  const pattern = "BenchmarkData_Repeated_Pattern_";
  let res = '';
  const chunkSize = 10000;
  for (let i = 0; i < sizeBytes; i += chunkSize) {
    const lim = Math.min(chunkSize, sizeBytes - i);
    let chunk = '';
    for (let j = 0; j < lim; j++) {
      if ((i + j) % 50 < 40) { // 80% repetition of a pattern
        chunk += pattern.charAt((i + j) % pattern.length);
      } else {
        chunk += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    res += chunk;
  }
  return res;
}

async function runAveragedMain(name: string, fn: () => void | Promise<void>) {
  for (let i = 0; i < 1; i++) await fn(); // 1 Warmup
  let total = 0;
  for (let i = 0; i < 3; i++) { // 3 Runs
    const s = performance.now();
    await fn();
    total += (performance.now() - s);
  }
  const avg = total / 3;
  appendLog(`  Main: ${name} -> ${avg.toFixed(2)}ms`, 'info');
  return avg;
}

async function runMainThreadNative(sizeName: string, sizeBytes: number) {
  const results: Record<string, { insert: number, read: number, update: number, delete: number }> = {};

  // Limits: Cookies max ~4KB. LS/SS max ~5MB.
  const canRunCookie = sizeBytes <= 4000;
  const canRunWebStorage = sizeBytes <= 4.5 * 1024 * 1024; // 4.5MB safe limit

  appendLog(`Generating ${sizeName} payload for Main Thread...`, 'warn');
  await new Promise(r => setTimeout(r, 50)); // Paint

  let payloadStr: string;
  try {
    payloadStr = canRunWebStorage ? generateDataString(sizeBytes) : '';
  } catch (e) {
    appendLog('OOM during string generation, skipping main thread.', 'error');
    return results;
  }

  // Session Storage
  if (canRunWebStorage) {
    try {
      const ssRes = { insert: 0, read: 0, update: 0, delete: 0 };
      sessionStorage.clear();
      ssRes.insert = await runAveragedMain('SS Insert', () => { sessionStorage.setItem('b', payloadStr); });
      ssRes.read = await runAveragedMain('SS Read', () => { sessionStorage.getItem('b'); });
      ssRes.update = await runAveragedMain('SS Update', () => { sessionStorage.setItem('b', payloadStr.substring(0, payloadStr.length - 1) + 'a'); });
      ssRes.delete = await runAveragedMain('SS Delete', () => { sessionStorage.removeItem('b'); });
      results['SessionStorage'] = ssRes;
    } catch (e: any) { appendLog(`SS Error: ${e.message}`, 'error'); }
  } else {
    results['SessionStorage'] = { insert: -1, read: -1, update: -1, delete: -1 };
    appendLog(`SS skipped for ${sizeName} (Quota)`, 'warn');
  }

  // Local Storage
  if (canRunWebStorage) {
    try {
      const lsRes = { insert: 0, read: 0, update: 0, delete: 0 };
      localStorage.clear();
      lsRes.insert = await runAveragedMain('LS Insert', () => { localStorage.setItem('b', payloadStr); });
      lsRes.read = await runAveragedMain('LS Read', () => { localStorage.getItem('b'); });
      lsRes.update = await runAveragedMain('LS Update', () => { localStorage.setItem('b', payloadStr.substring(0, payloadStr.length - 1) + 'a'); });
      lsRes.delete = await runAveragedMain('LS Delete', () => { localStorage.removeItem('b'); });
      results['LocalStorage'] = lsRes;
    } catch (e: any) { appendLog(`LS Error: ${e.message}`, 'error'); }
  } else {
    results['LocalStorage'] = { insert: -1, read: -1, update: -1, delete: -1 };
    appendLog(`LS skipped for ${sizeName} (Quota)`, 'warn');
  }

  // Cookies
  if (canRunCookie) {
    try {
      const cRes = { insert: 0, read: 0, update: 0, delete: 0 };
      document.cookie = "b=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      cRes.insert = await runAveragedMain('Cookie Insert', () => { document.cookie = `b=${payloadStr}; path=/`; });
      cRes.read = await runAveragedMain('Cookie Read', () => { document.cookie.length; });
      cRes.update = await runAveragedMain('Cookie Update', () => { document.cookie = `b=${payloadStr.substring(0, payloadStr.length - 1)}a; path=/`; });
      cRes.delete = await runAveragedMain('Cookie Delete', () => { document.cookie = "b=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"; });
      results['Cookies'] = cRes;
    } catch (e: any) { appendLog(`Cookie Error: ${e.message}`, 'error'); }
  } else {
    results['Cookies'] = { insert: -1, read: -1, update: -1, delete: -1 };
    appendLog(`Cookies skipped for ${sizeName} (Quota)`, 'warn');
  }

  return results;
}

// ===== Automated Suite Runner =====
// ===== Automated Suite Runner =====
let testQueue: { type: 'native' | 'wrapper' | 'compression', sizeName: string }[] = [];
let isRunningAll = false;
let queueTotal = 0;

async function runNextInQueue() {
  if (testQueue.length === 0) {
    isRunningAll = false;
    appendLog("--- ALL BENCHMARKS COMPLETED ---", "success");
    progressText.innerText = "All Tests Completed!";
    progressBar.style.width = "100%";
    progressPercent.innerText = "100%";
    btnRunAll.disabled = false;
    btnRunAll.innerText = "🚀 Run All Benchmarks (128B - 1GB)";
    if (btnRunCustom) btnRunCustom.disabled = false;
    return;
  }

  const task = testQueue.shift()!;
  const sizeBytes = SIZE_BYTES[task.sizeName];

  // Update Progress
  const current = queueTotal - testQueue.length;
  const percent = Math.round((current / queueTotal) * 100);
  progressBar.style.width = `${percent}%`;
  progressPercent.innerText = `${percent}%`;
  progressText.innerText = `Running ${task.type.toUpperCase()} - ${task.sizeName.toUpperCase()}... (${current}/${queueTotal})`;

  if (task.type === 'native') {
    const mainResults = await runMainThreadNative(task.sizeName, sizeBytes);
    if (!latestData.native[task.sizeName]) latestData.native[task.sizeName] = {};
    Object.assign(latestData.native[task.sizeName], mainResults);
    updateNativeChart(task.sizeName);
    worker.postMessage({ type: 'start_native', sizeName: task.sizeName, sizeBytes });
  } else if (task.type === 'wrapper') {
    const mainResults = await runWrapperMain(task.sizeName, sizeBytes);
    Object.assign(latestData.wrapper[task.sizeName], mainResults);
    updateWrapperChart(task.sizeName);
    worker.postMessage({ type: 'start_wrapper', sizeName: task.sizeName, sizeBytes });
  } else if (task.type === 'compression') {
    worker.postMessage({ type: 'start_compression', sizeName: task.sizeName, sizeBytes });
  }
}

async function runWrapperMain(sizeName: string, sizeBytes: number) {
  const canRunWebStorage = sizeBytes <= 4.5 * 1024 * 1024;
  const wrapperRes: any = {};
  // @ts-ignore
  const store = (await import('store2')).default;
  if (canRunWebStorage) {
    const payloadStr = generateDataString(sizeBytes);
    try {
      store.clearAll();
      wrapperRes['store.js'] = {
        insert: await runAveragedMain('store.js Insert', () => { store.set('b', payloadStr); }),
        read: await runAveragedMain('store.js Read', () => { store.get('b'); }),
        update: await runAveragedMain('store.js Update', () => { store.set('b', payloadStr.substring(0, payloadStr.length - 1) + 'a'); }),
        delete: await runAveragedMain('store.js Delete', () => { store.remove('b'); })
      };
    } catch (e: any) { appendLog(`store.js Error: ${e.message}`, 'error'); }
  } else {
    wrapperRes['store.js'] = { insert: -1, read: -1, update: -1, delete: -1 };
  }
  if (!latestData.wrapper[sizeName]) latestData.wrapper[sizeName] = {};
  return wrapperRes;
}

btnRunAll.addEventListener('click', () => {
  if (isRunningAll) return;
  isRunningAll = true;
  btnRunAll.disabled = true;
  btnRunAll.innerText = "Running...";
  progressArea.style.display = 'block';

  testQueue = [];
  for (const s of SIZES) {
    testQueue.push({ type: 'native', sizeName: s });
    testQueue.push({ type: 'wrapper', sizeName: s });
    testQueue.push({ type: 'compression', sizeName: s });
  }

  appendLog("--- STARTING ALL BENCHMARKS ---", "warn");
  queueTotal = testQueue.length;
  runNextInQueue();
});

// ===== Event Listeners =====
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const target = (e.target as HTMLElement).getAttribute('data-target')!;
    (e.target as HTMLElement).classList.add('active');
    document.getElementById(target)!.classList.add('active');
  });
});

// ===== Selection Tools =====
btnCatAll.addEventListener('click', () => categoryChecks.forEach(c => c.checked = true));
btnCatNone.addEventListener('click', () => categoryChecks.forEach(c => c.checked = false));
btnSizeAll.addEventListener('click', () => sizeChecks.forEach(c => c.checked = true));
btnSizeNone.addEventListener('click', () => sizeChecks.forEach(c => c.checked = false));

btnRunCustom.addEventListener('click', () => {
  if (isRunningAll) return;
  const selectedCategories = Array.from(categoryChecks).filter(c => c.checked).map(c => c.value);
  const selectedSizes = Array.from(sizeChecks).filter(c => c.checked).map(c => c.value);

  if (selectedCategories.length === 0 || selectedSizes.length === 0) {
    alert("Please select at least one category and one size to run.");
    return;
  }

  isRunningAll = true;
  btnRunCustom.disabled = true;
  progressArea.style.display = 'block';

  testQueue = [];
  // Matrix execution: for each size, run all selected categories
  for (const sizeName of selectedSizes) {
    for (const cat of selectedCategories) {
      testQueue.push({ type: cat as any, sizeName });
    }
  }

  appendLog(`--- STARTING CUSTOM BENCHMARK MATRIX (${selectedSizes.join(', ').toUpperCase()}) ---`, "warn");
  queueTotal = testQueue.length;
  runNextInQueue();
});

// ===== Export / Import =====
btnExport.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(latestData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `storage-benchmark-${new Date().getTime()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  appendLog('Benchmark data exported successfully.', 'success');
});

btnImport.addEventListener('click', () => inputImport.click());

inputImport.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      latestData = JSON.parse(evt.target?.result as string);
      renderAllCharts();
      appendLog('Imported benchmark data from JSON file.', 'success');
    } catch (err) {
      appendLog('Failed to parse JSON file', 'error');
    }
  };
  reader.readAsText(file);
});

btnCopyLogs.addEventListener('click', async () => {
  await navigator.clipboard.writeText(logsEl.innerText);
  alert('Logs copied!');
});

// ===== Worker Message Handling =====
worker.onmessage = (e) => {
  if (e.data.type === 'log') {
    appendLog(e.data.message.msg, e.data.message.type || 'info');
  } else if (e.data.type === 'error') {
    appendLog(e.data.message, 'error');
    disableButtons(nativeBtns, false);
    disableButtons(wrapperBtns, false);
    disableButtons(compressionBtns, false);
    if (isRunningAll) {
      testQueue = [];
      runNextInQueue(); // Finish up
    }
  } else if (e.data.type === 'done_native') {
    Object.assign(latestData.native[e.data.sizeName], e.data.payload);
    updateNativeChart(e.data.sizeName);
    appendLog(`Native (${e.data.sizeName}) Complete!`, 'success');
    disableButtons(nativeBtns, false);
    if (isRunningAll) runNextInQueue();
  } else if (e.data.type === 'done_wrapper') {
    Object.assign(latestData.wrapper[e.data.sizeName], e.data.payload);
    updateWrapperChart(e.data.sizeName);
    appendLog(`Wrapper (${e.data.sizeName}) Complete!`, 'success');
    disableButtons(wrapperBtns, false);
    if (isRunningAll) runNextInQueue();
  } else if (e.data.type === 'done_compression') {
    latestData.compression[e.data.sizeName] = e.data.payload;
    updateCompressionChart(e.data.sizeName);
    appendLog(`Compression (${e.data.sizeName}) Complete!`, 'success');
    disableButtons(compressionBtns, false);
    if (isRunningAll) runNextInQueue();
  }
};

// Start
initCharts();
