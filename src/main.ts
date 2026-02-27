import './style.css';
import Chart from 'chart.js/auto';

const btnRunMetadata = document.getElementById('btn-run-metadata') as HTMLButtonElement;
const btnRunBlob = document.getElementById('btn-run-blob') as HTMLButtonElement;
const btnRunCompression = document.getElementById('btn-run-compression') as HTMLButtonElement;
const btnRun1kb = document.getElementById('btn-run-payload-1kb') as HTMLButtonElement;
const btnRun1mb = document.getElementById('btn-run-payload-1mb') as HTMLButtonElement;
const btnRun100mb = document.getElementById('btn-run-payload-100mb') as HTMLButtonElement;
const logsEl = document.getElementById('logs') as HTMLDivElement;
const metadataChartCtx = document.getElementById('metadata-chart') as HTMLCanvasElement;
const blobChartCtx = document.getElementById('blob-chart') as HTMLCanvasElement;
const compressionIdbChartCtx = document.getElementById('compression-idb-chart') as HTMLCanvasElement;
const compressionOpfsChartCtx = document.getElementById('compression-opfs-chart') as HTMLCanvasElement;
const exportJsonBtn = document.getElementById('export-json-btn') as HTMLButtonElement;
const importJsonBtn = document.getElementById('import-json-btn') as HTMLButtonElement;
const importJsonInput = document.getElementById('import-json-input') as HTMLInputElement;

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

let myChartMetadata: Chart;
let myChartBlob: Chart;
let myChartCompressionIdb: Chart;
let myChartCompressionOpfs: Chart;

let myChartNativeSize: Chart;
let myChartWrapperSize: Chart;

let latestData: any = {
  metadata: { localStorage: {}, idb: {}, sqlite: {} },
  blob: { sqlite: {}, opfs: {}, idb: {} },
  compressionIdb: { none: {}, zip: {}, gzip: {}, deflate: {}, brotli: {}, zstd: {} },
  compressionOpfs: { none: {}, zip: {}, gzip: {}, deflate: {}, brotli: {}, zstd: {} },
  payload: {
    native: { '1kb': {}, '1mb': {}, '100mb': {} },
    wrapper: { '1kb': {}, '1mb': {}, '100mb': {} }
  }
};

function appendLog(msg: string) {
  logsEl.innerHTML += `<div>[${new Date().toLocaleTimeString()}] ${msg}</div>`;
  logsEl.scrollTop = logsEl.scrollHeight;
}

const copyLogsBtn = document.getElementById('copy-logs-btn') as HTMLButtonElement;

copyLogsBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(logsEl.innerText);
  alert('Logs copied to clipboard!');
});

exportJsonBtn.addEventListener('click', () => {
  if (!latestData) {
    alert('No benchmark data available to export. Run the benchmark first!');
    return;
  }
  const blob = new Blob([JSON.stringify(latestData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `benchmark-${new Date().getTime()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

importJsonBtn.addEventListener('click', () => {
  importJsonInput.click();
});

importJsonInput.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = JSON.parse(evt.target?.result as string);
      latestData = data;
      renderCharts(data);
      appendLog('Imported benchmark data from JSON file.');
    } catch (err: any) {
      alert('Failed to parse JSON file');
    }
  };
  reader.readAsText(file);
});

const commonOptions: any = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    tooltip: {
      callbacks: {
        label: (ctx: any) => `${ctx.dataset.label}: ${Number(ctx.raw).toFixed(2)} ms`
      }
    }
  },
  scales: {
    y: {
      type: 'logarithmic',
      title: { display: true, text: 'Time (ms) - Log Scale' },
      min: 1
    }
  }
};

// Colors
const colors = [
  'rgba(54, 162, 235, 0.7)', // blue
  'rgba(255, 99, 132, 0.7)', // red
  'rgba(75, 192, 192, 0.7)', // teal
  'rgba(153, 102, 255, 0.7)', // purple
  'rgba(255, 159, 64, 0.7)', // orange
  'rgba(255, 205, 86, 0.7)', // yellow
];

myChartMetadata = new Chart(metadataChartCtx, {
  type: 'bar',
  data: {
    labels: ['MD Insert', 'MD Read', 'MD Update', 'Search (LIKE/Scan)', 'Search (FTS5)'],
    datasets: [
      { label: 'LocalStorage (Main Thread)', data: [0, 0, 0, 0, 0], backgroundColor: colors[0] },
      { label: 'IndexedDB', data: [0, 0, 0, 0, 0], backgroundColor: colors[1] },
      { label: 'SQLite WASM (OPFS)', data: [0, 0, 0, 0, 0], backgroundColor: colors[2] }
    ]
  },
  options: { ...commonOptions, plugins: { ...commonOptions.plugins, title: { display: true, text: 'Metadata Operations (1000 rows)' } } }
});

myChartBlob = new Chart(blobChartCtx, {
  type: 'bar',
  data: {
    labels: ['Blob Insert', 'Blob Read'],
    datasets: [
      { label: 'SQLite WASM (OPFS)', data: [0, 0], backgroundColor: colors[2] },
      { label: 'OPFS Native (SyncAccessHandle)', data: [0, 0], backgroundColor: colors[3] },
      { label: 'IndexedDB', data: [0, 0], backgroundColor: colors[1] }
    ]
  },
  options: { ...commonOptions, plugins: { ...commonOptions.plugins, title: { display: true, text: 'Blob Operations (100x 512KB)' } } }
});

const compressionOptions = {
  ...commonOptions,
  plugins: {
    ...commonOptions.plugins,
    tooltip: {
      callbacks: {
        label: function (context: any) {
          let label = context.dataset.label || '';
          if (label) label += ': ';
          if (context.parsed.y !== null) {
            label += context.parsed.y.toFixed(2) + ' ms';
          }
          // The dataset index maps roughly to algorithm array order
          // ratio is assigned by renderCharts dynamically
          if (context.dataset.ratio) {
            label += ` (Ratio: ${context.dataset.ratio.toFixed(2)}x)`;
          }
          return label;
        }
      }
    }
  }
};

myChartCompressionIdb = new Chart(compressionIdbChartCtx, {
  type: 'bar',
  data: {
    labels: ['Compress + Insert', 'Read + Decompress'],
    datasets: [
      { label: 'None', data: [0, 0], backgroundColor: colors[0] },
      { label: 'ZIP (fflate)', data: [0, 0], backgroundColor: colors[1] },
      { label: 'Gzip (Native)', data: [0, 0], backgroundColor: colors[2] },
      { label: 'Deflate (Native)', data: [0, 0], backgroundColor: colors[3] },
      { label: 'Brotli (brotli-wasm)', data: [0, 0], backgroundColor: colors[4] },
      { label: 'zstd (fzstd)', data: [0, 0], backgroundColor: colors[5] }
    ]
  },
  options: { ...compressionOptions, plugins: { ...compressionOptions.plugins, title: { display: true, text: 'IDB Compression Efficiency (100x 512KB Blobs)' } } }
});

myChartCompressionOpfs = new Chart(compressionOpfsChartCtx, {
  type: 'bar',
  data: {
    labels: ['Compress + Write', 'Read + Decompress'],
    datasets: [
      { label: 'None', data: [0, 0], backgroundColor: colors[0] },
      { label: 'ZIP (fflate)', data: [0, 0], backgroundColor: colors[1] },
      { label: 'Gzip (Native)', data: [0, 0], backgroundColor: colors[2] },
      { label: 'Deflate (Native)', data: [0, 0], backgroundColor: colors[3] },
      { label: 'Brotli (brotli-wasm)', data: [0, 0], backgroundColor: colors[4] },
      { label: 'zstd (fzstd)', data: [0, 0], backgroundColor: colors[5] }
    ]
  },
  options: { ...compressionOptions, plugins: { ...compressionOptions.plugins, title: { display: true, text: 'OPFS Compression Efficiency (100x 512KB Blobs)' } } }
});

function renderCharts(data: any) {
  // Metadata
  if (data.metadata?.localStorage) {
    myChartMetadata.data.datasets[0].data = [data.metadata.localStorage.insert, data.metadata.localStorage.read, data.metadata.localStorage.update, data.metadata.localStorage.search, NaN];
  }
  if (data.metadata?.idb) {
    myChartMetadata.data.datasets[1].data = [data.metadata.idb.insert, data.metadata.idb.read, data.metadata.idb.update, data.metadata.idb.search, NaN];
  }
  if (data.metadata?.sqlite) {
    myChartMetadata.data.datasets[2].data = [data.metadata.sqlite.insert, data.metadata.sqlite.read, data.metadata.sqlite.update, data.metadata.sqlite.search, data.metadata.sqlite.searchFts];
  }
  myChartMetadata.update();

  // Blob Layer
  if (data.blob?.sqlite) {
    myChartBlob.data.datasets[0].data = [data.blob.sqlite.insert, data.blob.sqlite.read];
  }
  if (data.blob?.opfs) {
    myChartBlob.data.datasets[1].data = [data.blob.opfs.insert, data.blob.opfs.read];
  }
  if (data.blob?.idb) {
    myChartBlob.data.datasets[2].data = [data.blob.idb.insert, data.blob.idb.read];
  }
  myChartBlob.update();

  // Compression (IDB)
  if (data.compressionIdb?.none) {
    myChartCompressionIdb.data.datasets[0].data = [data.compressionIdb.none.insert, data.compressionIdb.none.read];
    (myChartCompressionIdb.data.datasets[0] as any).ratio = 1;
  }
  if (data.compressionIdb?.zip) {
    myChartCompressionIdb.data.datasets[1].data = [data.compressionIdb.zip.insert, data.compressionIdb.zip.read];
    (myChartCompressionIdb.data.datasets[1] as any).ratio = data.compressionIdb.zip.ratio;
  }
  if (data.compressionIdb?.gzip) {
    myChartCompressionIdb.data.datasets[2].data = [data.compressionIdb.gzip.insert, data.compressionIdb.gzip.read];
    (myChartCompressionIdb.data.datasets[2] as any).ratio = data.compressionIdb.gzip.ratio;
  }
  if (data.compressionIdb?.deflate) {
    myChartCompressionIdb.data.datasets[3].data = [data.compressionIdb.deflate.insert, data.compressionIdb.deflate.read];
    (myChartCompressionIdb.data.datasets[3] as any).ratio = data.compressionIdb.deflate.ratio;
  }
  if (data.compressionIdb?.brotli) {
    myChartCompressionIdb.data.datasets[4].data = [data.compressionIdb.brotli.insert, data.compressionIdb.brotli.read];
    (myChartCompressionIdb.data.datasets[4] as any).ratio = data.compressionIdb.brotli.ratio;
  }
  if (data.compressionIdb?.zstd) {
    myChartCompressionIdb.data.datasets[5].data = [data.compressionIdb.zstd.insert, data.compressionIdb.zstd.read];
    (myChartCompressionIdb.data.datasets[5] as any).ratio = data.compressionIdb.zstd.ratio;
  }
  myChartCompressionIdb.update();

  // Compression (OPFS)
  if (data.compressionOpfs?.none) {
    myChartCompressionOpfs.data.datasets[0].data = [data.compressionOpfs.none.insert, data.compressionOpfs.none.read];
    (myChartCompressionOpfs.data.datasets[0] as any).ratio = 1;
  }
  if (data.compressionOpfs?.zip) {
    myChartCompressionOpfs.data.datasets[1].data = [data.compressionOpfs.zip.insert, data.compressionOpfs.zip.read];
    (myChartCompressionOpfs.data.datasets[1] as any).ratio = data.compressionOpfs.zip.ratio;
  }
  if (data.compressionOpfs?.gzip) {
    myChartCompressionOpfs.data.datasets[2].data = [data.compressionOpfs.gzip.insert, data.compressionOpfs.gzip.read];
    (myChartCompressionOpfs.data.datasets[2] as any).ratio = data.compressionOpfs.gzip.ratio;
  }
  if (data.compressionOpfs?.deflate) {
    myChartCompressionOpfs.data.datasets[3].data = [data.compressionOpfs.deflate.insert, data.compressionOpfs.deflate.read];
    (myChartCompressionOpfs.data.datasets[3] as any).ratio = data.compressionOpfs.deflate.ratio;
  }
  if (data.compressionOpfs?.brotli) {
    myChartCompressionOpfs.data.datasets[4].data = [data.compressionOpfs.brotli.insert, data.compressionOpfs.brotli.read];
    (myChartCompressionOpfs.data.datasets[4] as any).ratio = data.compressionOpfs.brotli.ratio;
  }
  if (data.compressionOpfs?.zstd) {
    myChartCompressionOpfs.data.datasets[5].data = [data.compressionOpfs.zstd.insert, data.compressionOpfs.zstd.read];
    (myChartCompressionOpfs.data.datasets[5] as any).ratio = data.compressionOpfs.zstd.ratio;
  }
  myChartCompressionOpfs.update();

  // Draw Payload Native Chart
  if (data.payload?.native) {
    ['1kb', '1mb', '100mb'].forEach((size, sizeIndex) => {
      const nat = data.payload.native[size];
      if (nat) {
        if (nat.sessionStorage) myChartNativeSize.data.datasets[0].data[sizeIndex] = nat.sessionStorage.insert;
        if (nat.localStorage) myChartNativeSize.data.datasets[1].data[sizeIndex] = nat.localStorage.insert;
        if (nat.idb) myChartNativeSize.data.datasets[2].data[sizeIndex] = nat.idb.insert;
        if (nat.opfs) myChartNativeSize.data.datasets[3].data[sizeIndex] = nat.opfs.insert;
        if (nat.cache) myChartNativeSize.data.datasets[4].data[sizeIndex] = nat.cache.insert;
      }
    });
    myChartNativeSize.update();
  }

  // Draw Payload Wrapper Chart
  if (data.payload?.wrapper) {
    ['1kb', '1mb', '100mb'].forEach((size, sizeIndex) => {
      const wrap = data.payload.wrapper[size];
      if (wrap) {
        if (wrap.dexie) myChartWrapperSize.data.datasets[0].data[sizeIndex] = wrap.dexie.insert;
        if (wrap.localForage) myChartWrapperSize.data.datasets[1].data[sizeIndex] = wrap.localForage.insert;
      }
    });
    myChartWrapperSize.update();
  }
}

myChartNativeSize = new Chart(document.getElementById('native-size-chart') as HTMLCanvasElement, {
  type: 'bar',
  data: {
    labels: ['SessionStorage', 'LocalStorage', 'IndexedDB', 'OPFS Native', 'Cache API'],
    datasets: [{ label: '1KB (Low)', data: [0, 0, 0, 0, 0], backgroundColor: colors[0] }]
  },
  options: { ...commonOptions, plugins: { ...commonOptions.plugins, title: { display: true, text: 'Native Storage Performance' } } }
});

myChartWrapperSize = new Chart(document.getElementById('wrapper-size-chart') as HTMLCanvasElement, {
  type: 'bar',
  data: {
    labels: ['Dexie.js', 'localForage'],
    datasets: [{ label: '1KB (Low)', data: [0, 0], backgroundColor: colors[4] }]
  },
  options: { ...commonOptions, plugins: { ...commonOptions.plugins, title: { display: true, text: 'Wrapper Libraries Performance' } } }
});

async function runAveragedScenarioMain(name: string, fn: () => void | Promise<void>) {
  for (let i = 0; i < 3; i++) {
    appendLog(`  [TEST] ${name} (Warmup ${i + 1}/3)...`);
    await fn();
  }
  let totalTime = 0;
  for (let i = 0; i < 10; i++) {
    appendLog(`  [TEST] ${name} (Run ${i + 1}/10)...`);
    const s = performance.now();
    await fn();
    totalTime += (performance.now() - s);
  }
  return totalTime / 10;
}

function generateString(length: number, prefix: string = '') {
  let result = prefix;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ';
  for (let i = prefix.length; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// LocalStorage test limits
const NUM_MD_ROWS = 1000;
const MD_SIZE = 2000;

function disableAllBtns(disabled: boolean) {
  btnRunMetadata.disabled = disabled;
  btnRunBlob.disabled = disabled;
  btnRunCompression.disabled = disabled;
  btnRun1kb.disabled = disabled;
  btnRun1mb.disabled = disabled;
  btnRun100mb.disabled = disabled;
}

async function runLocalStorageMetadata() {
  appendLog('Starting UI Thread Benchmark for LocalStorage (may freeze momentarily)...');
  await new Promise(r => setTimeout(r, 100)); // Paint
  const testMdData = Array.from({ length: NUM_MD_ROWS }, (_, i) => ({
    id: `md_${i}`,
    title: `Test Document ${i}`,
    content: generateString(MD_SIZE, i % 10 === 0 ? 'specific_keyword_search_string ' : ''),
    updatedAt: Date.now()
  }));

  const lsResult = { insert: 0, read: 0, update: 0, search: 0 };
  try {
    lsResult.insert = await runAveragedScenarioMain('LS Insert', () => {
      localStorage.clear();
      for (const row of testMdData) { localStorage.setItem(row.id, JSON.stringify(row)); }
    });
    lsResult.read = await runAveragedScenarioMain('LS Read', () => {
      for (let i = 0; i < NUM_MD_ROWS; i++) JSON.parse(localStorage.getItem(`md_${i}`) || '{}');
    });
    lsResult.update = await runAveragedScenarioMain('LS Update', () => {
      for (let i = 0; i < NUM_MD_ROWS; i++) {
        const item = JSON.parse(localStorage.getItem(`md_${i}`) || '{}');
        item.content = `updated_content_${i}`;
        localStorage.setItem(`md_${i}`, JSON.stringify(item));
      }
    });
    lsResult.search = await runAveragedScenarioMain('LS Search', () => {
      for (let i = 0; i < NUM_MD_ROWS; i++) {
        const item = JSON.parse(localStorage.getItem(`md_${i}`) || '{}');
        if (item.content.includes('specific_keyword_search_string')) { }
      }
    });
    localStorage.clear();
  } catch (e: any) { appendLog(`❌ LocalStorage Error: ${e.message}`); }
  return { lsResult, testMdData };
}

btnRunMetadata.addEventListener('click', async () => {
  disableAllBtns(true);
  logsEl.innerHTML = '';
  const { lsResult, testMdData } = await runLocalStorageMetadata();
  worker.postMessage({ type: 'start_metadata', lsResult, testMdData });
});

btnRunBlob.addEventListener('click', () => {
  disableAllBtns(true); logsEl.innerHTML = '';
  worker.postMessage({ type: 'start_blob' });
});

btnRunCompression.addEventListener('click', () => {
  disableAllBtns(true); logsEl.innerHTML = '';
  worker.postMessage({ type: 'start_compression' });
});

async function runWebStoragePayload(sizeLabel: '1kb' | '1mb' | '100mb', sizeBytes: number) {
  appendLog(`Starting UI Thread Benchmark for Web Storage Payload (${sizeLabel})...`);
  await new Promise(r => setTimeout(r, 100)); // Paint

  // High payload (100MB) will crash Web Storage quota (usually 5MB limit).
  if (sizeBytes > 5 * 1024 * 1024) {
    appendLog(`⚠️ Web Storage skipped for ${sizeLabel} payload (exceeds typical 5MB quota)`);
    return { sessionStorage: { insert: NaN, read: NaN }, localStorage: { insert: NaN, read: NaN } };
  }

  const payloadString = generateString(sizeBytes);
  const resultSession = { insert: 0, read: 0 };
  const resultLocal = { insert: 0, read: 0 };

  try {
    resultSession.insert = await runAveragedScenarioMain('SessionStorage Insert', () => {
      sessionStorage.clear(); sessionStorage.setItem('payload', payloadString);
    });
    resultSession.read = await runAveragedScenarioMain('SessionStorage Read', () => {
      sessionStorage.getItem('payload');
    });
    sessionStorage.clear();
  } catch (e: any) { appendLog(`❌ SessionStorage Error: ${e.message}`); }

  try {
    resultLocal.insert = await runAveragedScenarioMain('LocalStorage Insert', () => {
      localStorage.clear(); localStorage.setItem('payload', payloadString);
    });
    resultLocal.read = await runAveragedScenarioMain('LocalStorage Read', () => {
      localStorage.getItem('payload');
    });
    localStorage.clear();
  } catch (e: any) { appendLog(`❌ LocalStorage Error: ${e.message}`); }

  return { sessionStorage: resultSession, localStorage: resultLocal };
}

btnRun1kb.addEventListener('click', async () => {
  disableAllBtns(true); logsEl.innerHTML = '';
  const webStorageRes = await runWebStoragePayload('1kb', 1024);
  worker.postMessage({ type: 'start_payload', sizeLabel: '1kb', sizeBytes: 1024, webStorageRes });
});

btnRun1mb.addEventListener('click', async () => {
  disableAllBtns(true); logsEl.innerHTML = '';
  const webStorageRes = await runWebStoragePayload('1mb', 1024 * 1024);
  worker.postMessage({ type: 'start_payload', sizeLabel: '1mb', sizeBytes: 1024 * 1024, webStorageRes });
});

btnRun100mb.addEventListener('click', async () => {
  disableAllBtns(true); logsEl.innerHTML = '';
  const webStorageRes = await runWebStoragePayload('100mb', 100 * 1024 * 1024);
  worker.postMessage({ type: 'start_payload', sizeLabel: '100mb', sizeBytes: 100 * 1024 * 1024, webStorageRes });
});

worker.onmessage = (e) => {
  if (e.data.type === 'log') {
    appendLog(e.data.message);
  } else if (e.data.type === 'error') {
    appendLog(`❌ ERROR: ${e.data.message}`);
    disableAllBtns(false);
  } else if (e.data.type === 'done') {
    disableAllBtns(false);

    // Deep merge partial results into latestData
    const payload = e.data.payload;
    if (payload.metadata) latestData.metadata = payload.metadata;
    if (payload.blob) latestData.blob = payload.blob;
    if (payload.compressionIdb) latestData.compressionIdb = payload.compressionIdb;
    if (payload.compressionOpfs) latestData.compressionOpfs = payload.compressionOpfs;
    if (payload.payload) latestData.payload = payload.payload;

    renderCharts(latestData);
    appendLog('--- Benchmark Complete ---');
  }
};
