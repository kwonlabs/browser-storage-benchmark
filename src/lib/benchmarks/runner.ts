import { SIZES } from './constants';
import { runStorageLifecycle, runCompressionLifecycle, generatePayloadString } from './benchmark';
import { getBenchmarksByCategory, getBenchmarkById } from './index';
import type { TaskDef, BenchmarkData, StorageStepDefinitions, CompressionStepDefinitions, PayloadType } from './types';
import { updateProgress, addLog, updateTrendCharts, markBenchmarkFinished, btnReportRun, progressArea } from '../../ui';
import { switchToTab } from '../../router';

export let isRunning = false;

function buildEmptyData(): BenchmarkData {
    const data: BenchmarkData = { low: {}, high: {}, compression: {} };
    const payloadTypes: PayloadType[] = ['text', 'json', 'random', 'binary', 'image', 'pdf'];
    Object.keys(SIZES).forEach(s => {
        data.low[s] = {};
        data.high[s] = {};
        data.compression[s] = {};
        payloadTypes.forEach(p => {
            data.low[s][p] = {};
            data.high[s][p] = {};
            data.compression[s][p] = {};
        });
    });
    return data;
}

export let latestData: BenchmarkData = buildEmptyData();

let testQueue: { task: TaskDef; payloadTypes: PayloadType[] }[] = [];
let unitQueue: { unitId: string; sizeName: string; sizeValue: number; payloadType: PayloadType }[] = [];
let totalUnits = 0;
let completedUnits = 0;

// Workers
let nativeWorker: Worker | null = null;
let wrapperWorker: Worker | null = null;
let compressionWorker: Worker | null = null;

function initWorkers() {
    terminateWorkers();

    nativeWorker = new Worker(new URL('./workers/native.worker.ts', import.meta.url), { type: 'module' });
    wrapperWorker = new Worker(new URL('./workers/wrapper.worker.ts', import.meta.url), { type: 'module' });
    compressionWorker = new Worker(new URL('./workers/compression.worker.ts', import.meta.url), { type: 'module' });

    nativeWorker.onmessage = (e) => handleWorkerMessage(e, 'high');
    wrapperWorker.onmessage = (e) => handleWorkerMessage(e, 'high');
    compressionWorker.onmessage = (e) => handleWorkerMessage(e, 'compression');
}

function terminateWorkers() {
    if (nativeWorker) nativeWorker.terminate();
    if (wrapperWorker) wrapperWorker.terminate();
    if (compressionWorker) compressionWorker.terminate();
    nativeWorker = null;
    wrapperWorker = null;
    compressionWorker = null;
}

function handleWorkerMessage(e: MessageEvent, category: 'high' | 'compression') {
    if (!isRunning) return;
    const { unitId, sizeName, payloadType, result } = e.data;
    const unit = getBenchmarkById(unitId);
    if (unit) {
        if (category === 'compression') {
            if (!latestData.compression[sizeName]) latestData.compression[sizeName] = {};
            if (!latestData.compression[sizeName][payloadType]) latestData.compression[sizeName][payloadType] = {};
            (latestData.compression[sizeName][payloadType] as Record<string, any>)[unit.name] = result;
        } else {
            if (!latestData.high[sizeName]) latestData.high[sizeName] = {};
            if (!latestData.high[sizeName][payloadType]) latestData.high[sizeName][payloadType] = {};
            (latestData.high[sizeName][payloadType] as Record<string, any>)[unit.name] = result;
        }
        updateTrendCharts(latestData);
    }
    completedUnits++;
    runNext();
}

export function setLatestData(data: BenchmarkData) {
    if (!data) return;

    const migrate = (source: any, target: any) => {
        if (!source) return;
        Object.keys(source).forEach(size => {
            if (!target[size]) target[size] = {};

            // Check if source[size] is in old format (direct tech keys) or new format (payloadType keys)
            const firstKey = Object.keys(source[size])[0];
            const payloadTypes = ['repetitive', 'json', 'random', 'binary'];

            if (firstKey && !payloadTypes.includes(firstKey as any)) {
                // OLD format: { size: { tech: result } } -> Move to 'repetitive'
                if (!target[size]['repetitive']) target[size]['repetitive'] = {};
                Object.assign(target[size]['repetitive'], source[size]);
            } else {
                // NEW format: { size: { payloadType: { tech: result } } }
                Object.keys(source[size]).forEach(pt => {
                    if (!target[size][pt]) target[size][pt] = {};
                    Object.assign(target[size][pt], source[size][pt]);
                });
            }
        });
    };

    migrate(data.low, latestData.low);
    migrate(data.high, latestData.high);
    migrate(data.compression, latestData.compression);
}

async function runMainThreadUnit(unitId: string, sizeName: string, sizeValue: number, payloadType: PayloadType) {
    const unit = getBenchmarkById(unitId);
    if (!unit) return;

    try {
        const original = generatePayloadString(sizeValue, payloadType);
        const modified = original + 'm';
        const steps = unit.run(sizeName, sizeValue, { original, modified });

        if (unit.category === 'compression') {
            const result = await runCompressionLifecycle(sizeValue, steps as CompressionStepDefinitions, original, unit.name);
            if (!latestData.compression[sizeName]) latestData.compression[sizeName] = {};
            if (!latestData.compression[sizeName][payloadType]) latestData.compression[sizeName][payloadType] = {};
            (latestData.compression[sizeName][payloadType] as Record<string, any>)[unit.name] = result;
        } else {
            const result = await runStorageLifecycle(sizeValue, steps as StorageStepDefinitions, { original, modified }, unit.name);

            if (unit.category === 'low') {
                if (!latestData.low[sizeName]) latestData.low[sizeName] = {};
                if (!latestData.low[sizeName][payloadType]) latestData.low[sizeName][payloadType] = {};
                (latestData.low[sizeName][payloadType] as Record<string, any>)[unit.name] = result;
            } else {
                if (!latestData.high[sizeName]) latestData.high[sizeName] = {};
                if (!latestData.high[sizeName][payloadType]) latestData.high[sizeName][payloadType] = {};
                (latestData.high[sizeName][payloadType] as Record<string, any>)[unit.name] = result;
            }
        }
    } catch (err) {
        console.error(`Main Thread Unit Error[${unitId}]: `, err);
    }
}

export async function runNext() {
    if (!isRunning) return;

    if (unitQueue.length === 0) {
        if (testQueue.length === 0) {
            isRunning = false;
            updateProgress(100, 'All benchmarks completed!');
            addLog('All tasks finished successfully.', 'success');
            if (btnReportRun) btnReportRun.style.display = 'inline-flex';
            const btnReportCancel = document.getElementById('btn-report-cancel');
            if (btnReportCancel) btnReportCancel.style.display = 'none';
            terminateWorkers();
            markBenchmarkFinished(latestData);
            return;
        }

        // Fill unit queue from next task
        const { task, payloadTypes } = testQueue.shift()!;
        const benchmarks = getBenchmarksByCategory(task.category);
        payloadTypes.forEach(pt => {
            benchmarks.forEach(b => {
                if (b.id === 'cookie' && task.sizeValue > 4000) return; // 4KB constraint
                if (['sessionstorage', 'localstorage', 'store.js'].includes(b.id) && task.sizeValue >= 4 * 1024 * 1024) return; // Roughly 5MB limit

                unitQueue.push({ unitId: b.id, sizeName: task.sizeName, sizeValue: task.sizeValue, payloadType: pt });
            });
        });
        totalUnits += (benchmarks.length * payloadTypes.length);
        runNext();
        return;
    }

    const { unitId, sizeName, sizeValue, payloadType } = unitQueue.shift()!;
    const percent = Math.round((completedUnits / (totalUnits || 1)) * 100);
    const unit = getBenchmarkById(unitId);

    if (!unit) {
        completedUnits++;
        runNext();
        return;
    }

    updateProgress(percent, `Running: ${unit.name} (${sizeName.toUpperCase()}, ${payloadType})...`);
    addLog(`Testing ${unit.name} [${sizeName.toUpperCase()}] with ${payloadType} data...`);

    if (unit.runType === 'worker.async') {
        const worker = unit.category === 'compression' ? compressionWorker
            : (unit.category === 'high-native' ? nativeWorker : wrapperWorker);

        if (worker) {
            worker.postMessage({ unitId, sizeName, sizeValue, payloadType });
        } else {
            console.error('Worker not initialized');
            completedUnits++;
            runNext();
        }
    } else {
        await runMainThreadUnit(unitId, sizeName, sizeValue, payloadType);
        completedUnits++;
        updateTrendCharts(latestData);
        runNext();
    }
}

export async function startBenchmark(tasks: TaskDef[], payloadTypes: PayloadType[]) {
    if (isRunning) return;
    isRunning = true;

    // Filter tasks based on the specialized rule:
    // 1. Storage (low, high) -> ONLY use 'text' (Document (Text))
    // 2. Compression -> Use all 6 selected payloadTypes
    testQueue = tasks.map(task => {
        const isCompression = task.category === 'compression';
        const filteredPayloads = isCompression
            ? payloadTypes
            : ['text' as PayloadType];

        return { task, payloadTypes: filteredPayloads };
    }).filter(t => t.payloadTypes.length > 0);
    unitQueue = [];
    totalUnits = 0;
    completedUnits = 0;

    if (btnReportRun) btnReportRun.style.display = 'none';
    const btnReportCancel = document.getElementById('btn-report-cancel');
    if (btnReportCancel) btnReportCancel.style.display = 'inline-flex';

    switchToTab('tab-report');
    if (progressArea) progressArea.style.display = 'block';

    initWorkers();

    addLog(`Benchmark session started with ${tasks.length} tasks.`);
    updateProgress(0, 'Starting...');
    runNext();
}

export function cancelBenchmark() {
    isRunning = false;
    testQueue = [];
    unitQueue = [];
    terminateWorkers();
    addLog('Benchmark cancelled by user.', 'error');
    updateProgress(100, 'Cancelled');
    if (btnReportRun) btnReportRun.style.display = 'inline-flex';
    const btnReportCancel = document.getElementById('btn-report-cancel');
    if (btnReportCancel) btnReportCancel.style.display = 'none';
}


