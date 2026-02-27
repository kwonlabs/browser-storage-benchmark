import { SIZES, STORAGE_QUOTA } from './constants';
import { generatePayloadString, yieldToMain, measureOperation } from './lib/benchmark';
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
let totalTasks = 0;
let completedTasks = 0;

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
    await yieldToMain();

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
        if (sizeValue > STORAGE_QUOTA) {
            results['SessionStorage'] = { insert: -2, read: -2, update: -2, delete: -2 };
        } else {
            results['SessionStorage'] = {
                insert: await measureOperation(sizeValue, () => { const s = performance.now(); sessionStorage.setItem(k, str); return performance.now() - s; }),
                read: await measureOperation(sizeValue, () => { const s = performance.now(); sessionStorage.getItem(k); return performance.now() - s; }),
                update: await measureOperation(sizeValue, () => { const s = performance.now(); sessionStorage.setItem(k, modStr); return performance.now() - s; }),
                delete: await measureOperation(sizeValue, () => { const s = performance.now(); sessionStorage.removeItem(k); return performance.now() - s; })
            };
        }
    } catch (e) { results['SessionStorage'] = { insert: -1, read: -1, update: -1, delete: -1 }; }

    // LocalStorage
    try {
        if (sizeValue > STORAGE_QUOTA) {
            results['LocalStorage'] = { insert: -2, read: -2, update: -2, delete: -2 };
        } else {
            results['LocalStorage'] = {
                insert: await measureOperation(sizeValue, () => { const s = performance.now(); localStorage.setItem(k, str); return performance.now() - s; }),
                read: await measureOperation(sizeValue, () => { const s = performance.now(); localStorage.getItem(k); return performance.now() - s; }),
                update: await measureOperation(sizeValue, () => { const s = performance.now(); localStorage.setItem(k, modStr); return performance.now() - s; }),
                delete: await measureOperation(sizeValue, () => { const s = performance.now(); localStorage.removeItem(k); return performance.now() - s; })
            };
        }
    } catch (e) { results['LocalStorage'] = { insert: -1, read: -1, update: -1, delete: -1 }; }

    // store.js
    try {
        if (typeof localStorage !== 'undefined') {
            if (sizeValue > STORAGE_QUOTA) {
                results['store.js'] = { insert: -2, read: -2, update: -2, delete: -2 };
            } else {
                results['store.js'] = {
                    insert: await measureOperation(sizeValue, () => { const s = performance.now(); localStorage.setItem(k, str); return performance.now() - s; }),
                    read: await measureOperation(sizeValue, () => { const s = performance.now(); localStorage.getItem(k); return performance.now() - s; }),
                    update: await measureOperation(sizeValue, () => { const s = performance.now(); localStorage.setItem(k, modStr); return performance.now() - s; }),
                    delete: await measureOperation(sizeValue, () => { const s = performance.now(); localStorage.removeItem(k); return performance.now() - s; })
                };
            }
        } else {
            results['store.js'] = { insert: -1, read: -1, update: -1, delete: -1 };
        }
    } catch (e) { results['store.js'] = { insert: -1, read: -1, update: -1, delete: -1 }; }

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

    const task = testQueue.shift()!;
    completedTasks++;
    const percent = Math.round(((completedTasks - 0.5) / totalTasks) * 100);
    updateProgress(percent, `Running ${task.category.toUpperCase()} - ${task.sizeName.toUpperCase()}...`);
    addLog(`Executing: ${task.category.toUpperCase()} at ${task.sizeName.toUpperCase()}`);

    const sizeValue = SIZES[task.sizeName as keyof typeof SIZES];

    if (task.category === 'low') {
        if (sizeValue > STORAGE_QUOTA) {
            addLog(`Skipped Low-Capacity for ${task.sizeName} (Exceeds Memory Quota)`);
            latestData.low[task.sizeName] = {};
            runNext();
            return;
        }
        const mainResults = await runMainThreadNative(task.sizeName, sizeValue);
        latestData.low[task.sizeName] = { ...mainResults };
        updateTrendCharts(latestData);
        runNext();
    } else if (task.category === 'high') {
        nativeWorker.postMessage({ type: 'start_native', sizeName: task.sizeName, sizeValue });
    } else if (task.category === 'compression') {
        compressionWorker.postMessage({ type: 'start_compression', sizeName: task.sizeName, sizeValue });
    }
}

export async function startBenchmark(tasks: TaskDef[]) {
    if (isRunning) return;
    isRunning = true;
    testQueue.length = 0;
    testQueue.push(...tasks);
    totalTasks = tasks.length;
    completedTasks = 0;

    if (btnReportRun) btnReportRun.style.display = 'none';
    const btnReportCancel = document.querySelector('.btn-cancel') as HTMLButtonElement;
    if (btnReportCancel) btnReportCancel.style.display = 'inline-flex';

    switchToTab('tab-report');
    if (progressArea) progressArea.style.display = 'block';
    addLog(`Benchmark session started. Total tasks: ${totalTasks}`);
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
    wrapperWorker.postMessage({ type: 'start_wrapper', sizeName, sizeValue: SIZES[sizeName] });
};

wrapperWorker.onmessage = (e) => {
    if (!isRunning) return;
    const { sizeName, payload } = e.data;
    latestData.high[sizeName] = { ...latestData.high[sizeName], ...payload };
    addLog(`High-Capacity Storage - ${sizeName.toUpperCase()} completed.`, 'success');
    updateTrendCharts(latestData);
    runNext();
};

compressionWorker.onmessage = (e) => {
    if (!isRunning) return;
    const { sizeName, payload } = e.data;
    latestData.compression[sizeName] = payload;
    addLog(`Compression - ${sizeName.toUpperCase()} completed.`, 'success');
    updateTrendCharts(latestData);
    runNext();
};
