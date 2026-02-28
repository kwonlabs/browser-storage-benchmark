import { SIZES, STORAGE_QUOTA } from './constants';
import { generatePayloadString } from './lib/benchmark';
import type { TaskDef, BenchmarkResult, BenchmarkData } from './types';
import { updateProgress, addLog, updateTrendCharts, markBenchmarkFinished, btnReportRun, progressArea } from './ui';
import { switchToTab } from './router';

export let isRunning = false;

function buildEmptyData(): BenchmarkData {
    const data: BenchmarkData = { low: {}, high: {}, compression: {} };
    const sizeKeys = Object.keys(SIZES);
    sizeKeys.forEach(s => {
        data.low[s] = {};
        data.high[s] = {};
        data.compression[s] = {} as any;
    });
    return data;
}

export let latestData: BenchmarkData = buildEmptyData();

let testQueue: TaskDef[] = [];
let totalBytes = 0;
let completedBytes = 0;

// Worker Instances
const nativeWorker = new Worker(new URL('./workers/native.worker.ts', import.meta.url), { type: 'module' });
const wrapperWorker = new Worker(new URL('./workers/wrapper.worker.ts', import.meta.url), { type: 'module' });
const compressionWorker = new Worker(new URL('./workers/compression.worker.ts', import.meta.url), { type: 'module' });

export function setLatestData(data: BenchmarkData) {
    // Merge loaded data with the empty structure to guarantee no missing root keys
    const empty = buildEmptyData();
    latestData = {
        low: { ...empty.low, ...data?.low },
        high: { ...empty.high, ...data?.high },
        compression: { ...empty.compression, ...data?.compression }
    };
}

export async function runMainThreadNative(sizeName: string, sizeValue: number) {
    const results: Record<string, BenchmarkResult> = {};
    const k = `bench_k_${sizeName}`;
    const str = generatePayloadString(sizeValue);
    const modStr = str + 'm';

    const runOne = async (op: () => void | any) => {
        try {
            const start = performance.now();
            await op();
            return performance.now() - start;
        } catch (e) { return -1; }
    };

    // Cookie
    addLog(`Testing Cookie API [CRUD] (${sizeName.toUpperCase()})...`);
    results['Cookie'] = {
        insert: await runOne(() => { document.cookie = `${k}=${str};path=/;max-age=60`; }),
        read: await runOne(() => { void document.cookie; }),
        update: await runOne(() => { document.cookie = `${k}=${modStr};path=/;max-age=60`; }),
        delete: await runOne(() => { document.cookie = `${k}=;path=/;max-age=0`; })
    };
    addLog(`Cookie API (${sizeName.toUpperCase()}) - Completed.`, 'success');

    // SessionStorage
    if (sizeValue <= STORAGE_QUOTA) {
        addLog(`Testing SessionStorage [CRUD] (${sizeName.toUpperCase()})...`);
        results['SessionStorage'] = {
            insert: await runOne(() => sessionStorage.setItem(k, str)),
            read: await runOne(() => sessionStorage.getItem(k)),
            update: await runOne(() => sessionStorage.setItem(k, modStr)),
            delete: await runOne(() => sessionStorage.removeItem(k))
        };
        addLog(`SessionStorage (${sizeName.toUpperCase()}) - Completed.`, 'success');
    } else {
        results['SessionStorage'] = { insert: -2, read: -2, update: -2, delete: -2 };
    }

    // LocalStorage
    if (sizeValue <= STORAGE_QUOTA) {
        addLog(`Testing LocalStorage [CRUD] (${sizeName.toUpperCase()})...`);
        results['LocalStorage'] = {
            insert: await runOne(() => localStorage.setItem(k, str)),
            read: await runOne(() => localStorage.getItem(k)),
            update: await runOne(() => localStorage.setItem(k, modStr)),
            delete: await runOne(() => localStorage.removeItem(k))
        };
        addLog(`LocalStorage (${sizeName.toUpperCase()}) - Completed.`, 'success');
    } else {
        results['LocalStorage'] = { insert: -2, read: -2, update: -2, delete: -2 };
    }

    // store.js
    if (sizeValue <= STORAGE_QUOTA) {
        addLog(`Testing store.js Wrapper [CRUD] (${sizeName.toUpperCase()})...`);
        results['store.js'] = {
            insert: await runOne(() => localStorage.setItem(k, str)),
            read: await runOne(() => localStorage.getItem(k)),
            update: await runOne(() => localStorage.setItem(k, modStr)),
            delete: await runOne(() => localStorage.removeItem(k))
        };
        addLog(`store.js Wrapper (${sizeName.toUpperCase()}) - Completed.`, 'success');
    } else {
        results['store.js'] = { insert: -2, read: -2, update: -2, delete: -2 };
    }

    return results;
}

export async function runNext() {
    if (!isRunning) return;

    if (testQueue.length === 0) {
        isRunning = false;
        updateProgress(100, 'All benchmarks completed!');
        addLog('All tasks finished successfully.', 'success');
        markBenchmarkFinished(latestData);
        return;
    }

    const task = testQueue[0];
    const percent = Math.round((completedBytes / totalBytes) * 100);
    updateProgress(percent, `Processing: ${task.category.toUpperCase()} - ${task.sizeName.toUpperCase()}...`);

    testQueue.shift();
    const sizeValue = task.sizeValue;

    if (task.category === 'low') {
        if (sizeValue > STORAGE_QUOTA) {
            addLog(`Skipped Low-Capacity for ${task.sizeName} (Exceeds 5MB Quota)`);
            latestData.low[task.sizeName] = {};
            completedBytes += sizeValue;
            runNext();
            return;
        }
        const mainResults = await runMainThreadNative(task.sizeName, sizeValue);
        latestData.low[task.sizeName] = { ...mainResults };
        updateTrendCharts(latestData);
        completedBytes += sizeValue;
        runNext();
    } else if (task.category === 'high-native') {
        addLog(`Starting Persistent Native tests for ${task.sizeName.toUpperCase()} (IndexedDB, OPFS)...`);
        nativeWorker.postMessage({ type: 'start_native', sizeName: task.sizeName, sizeValue });
    } else if (task.category === 'high-wrapper') {
        addLog(`Starting Persistent Library tests for ${task.sizeName.toUpperCase()} (Dexie, localForage)...`);
        wrapperWorker.postMessage({ type: 'start_wrapper', sizeName: task.sizeName, sizeValue });
    } else if (task.category === 'compression') {
        addLog(`Starting Compression tests for ${task.sizeName.toUpperCase()} (zstd, lz4, gzip)...`);
        compressionWorker.postMessage({ type: 'start_compression', sizeName: task.sizeName, sizeValue });
    } else {
        // Fallback for any old tasks or unknown categories
        completedBytes += sizeValue;
        runNext();
    }
}

export async function startBenchmark(tasks: TaskDef[]) {
    if (isRunning) return;
    isRunning = true;
    testQueue.length = 0;
    testQueue.push(...tasks);

    totalBytes = tasks.reduce((acc, t) => acc + (t.sizeValue || 0), 0);
    completedBytes = 0;

    if (btnReportRun) btnReportRun.style.display = 'none';
    const btnReportCancel = document.querySelector('.btn-cancel') as HTMLButtonElement;
    if (btnReportCancel) btnReportCancel.style.display = 'inline-flex';

    switchToTab('tab-report');
    if (progressArea) progressArea.style.display = 'block';

    const totalSizeStr = totalBytes > 1024 * 1024 * 1024
        ? (totalBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
        : (totalBytes / (1024 * 1024)).toFixed(2) + ' MB';

    addLog(`Benchmark session started. Total data quota: ${totalSizeStr}`);
    updateProgress(0, 'Starting...');
    runNext();
}

export function cancelBenchmark() {
    if (isRunning) {
        isRunning = false;
        testQueue.length = 0;
        addLog('Benchmark cancelled by user.', 'error');
        updateProgress(100, 'Cancelled');
    }
}

// Worker Handlers
const handleWorkerError = (workerName: string) => (err: ErrorEvent) => {
    addLog(`[${workerName}] Fatal Error: ${err.message}`, 'error');
    if (isRunning) runNext();
};

nativeWorker.onerror = handleWorkerError('NativeWorker');
wrapperWorker.onerror = handleWorkerError('WrapperWorker');
compressionWorker.onerror = handleWorkerError('CompressionWorker');

nativeWorker.onmessage = (e) => {
    if (!isRunning) return;
    const { sizeName, payload } = e.data;
    latestData.high[sizeName] = { ...latestData.high[sizeName], ...payload };
    addLog(`Persistent Native (IndexedDB, OPFS) - ${sizeName.toUpperCase()} Completed.`, 'success');
    updateTrendCharts(latestData);
    completedBytes += SIZES[sizeName];
    runNext();
};

wrapperWorker.onmessage = (e) => {
    if (!isRunning) return;
    const { sizeName, payload } = e.data;
    latestData.high[sizeName] = { ...latestData.high[sizeName], ...payload };
    addLog(`Persistent Library (Dexie, LocalForage) - ${sizeName.toUpperCase()} Completed.`, 'success');
    updateTrendCharts(latestData);
    completedBytes += SIZES[sizeName];
    runNext();
};

compressionWorker.onmessage = (e) => {
    if (!isRunning) return;
    const { sizeName, payload } = e.data;
    latestData.compression[sizeName] = payload;
    addLog(`Compression Algorithms (zstd, lz4, gzip) - ${sizeName.toUpperCase()} Completed.`, 'success');
    updateTrendCharts(latestData);
    completedBytes += SIZES[sizeName];
    runNext();
};
