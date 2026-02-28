import { SIZES } from './constants';
import { runStorageLifecycle, runCompressionLifecycle, generatePayloadString } from './benchmark';
import { getBenchmarksByCategory, getBenchmarkById } from './index';
import type { TaskDef, BenchmarkData, StorageStepDefinitions, CompressionStepDefinitions } from './types';
import { updateProgress, addLog, updateTrendCharts, markBenchmarkFinished, btnReportRun, progressArea } from '../../ui';
import { switchToTab } from '../../router';

export let isRunning = false;

function buildEmptyData(): BenchmarkData {
    const data: BenchmarkData = { low: {}, high: {}, compression: {} };
    Object.keys(SIZES).forEach(s => {
        data.low[s] = {};
        data.high[s] = {};
        data.compression[s] = {} as any;
    });
    return data;
}

export let latestData: BenchmarkData = buildEmptyData();

let testQueue: TaskDef[] = [];
let unitQueue: { unitId: string; sizeName: string; sizeValue: number }[] = [];
let totalUnits = 0;
let completedUnits = 0;

// Workers
const nativeWorker = new Worker(new URL('./workers/native.worker.ts', import.meta.url), { type: 'module' });
const wrapperWorker = new Worker(new URL('./workers/wrapper.worker.ts', import.meta.url), { type: 'module' });
const compressionWorker = new Worker(new URL('./workers/compression.worker.ts', import.meta.url), { type: 'module' });

export function setLatestData(data: BenchmarkData) {
    const empty = buildEmptyData();
    latestData = {
        low: { ...empty.low, ...data?.low },
        high: { ...empty.high, ...data?.high },
        compression: { ...empty.compression, ...data?.compression }
    };
}

async function runMainThreadUnit(unitId: string, sizeName: string, sizeValue: number) {
    const unit = getBenchmarkById(unitId);
    if (!unit) return;

    try {
        const steps = unit.run(sizeName, sizeValue);
        const original = generatePayloadString(sizeValue);

        if (unit.category === 'compression') {
            const result = await runCompressionLifecycle(sizeValue, steps as CompressionStepDefinitions, original);
            latestData.compression[sizeName][unit.name] = result;
        } else {
            const modified = original + 'm';
            const result = await runStorageLifecycle(sizeValue, steps as StorageStepDefinitions, { original, modified });

            if (unit.category === 'low') {
                latestData.low[sizeName][unit.name] = result;
            } else {
                latestData.high[sizeName][unit.name] = result;
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
            markBenchmarkFinished(latestData);
            return;
        }

        // Fill unit queue from next task
        const task = testQueue.shift()!;
        const benchmarks = getBenchmarksByCategory(task.category);
        benchmarks.forEach(b => {
            unitQueue.push({ unitId: b.id, sizeName: task.sizeName, sizeValue: task.sizeValue });
        });
        totalUnits += benchmarks.length;
        runNext();
        return;
    }

    const { unitId, sizeName, sizeValue } = unitQueue.shift()!;
    const percent = Math.round((completedUnits / (totalUnits || 1)) * 100);
    const unit = getBenchmarkById(unitId);

    if (!unit) {
        completedUnits++;
        runNext();
        return;
    }

    updateProgress(percent, `Running: ${unit.name} (${sizeName.toUpperCase()})...`);
    addLog(`Testing ${unit.name} [${sizeName.toUpperCase()}]...`);

    if (unit.runType === 'worker.async') {
        const worker = unit.category === 'compression' ? compressionWorker
            : (unit.category === 'high-native' ? nativeWorker : wrapperWorker);
        worker.postMessage({ unitId, sizeName, sizeValue });
    } else {
        await runMainThreadUnit(unitId, sizeName, sizeValue);
        completedUnits++;
        updateTrendCharts(latestData);
        runNext();
    }
}

export async function startBenchmark(tasks: TaskDef[]) {
    if (isRunning) return;
    isRunning = true;
    testQueue = [...tasks];
    unitQueue = [];
    totalUnits = 0;
    completedUnits = 0;

    if (btnReportRun) btnReportRun.style.display = 'none';
    const btnReportCancel = document.getElementById('btn-report-cancel');
    if (btnReportCancel) btnReportCancel.style.display = 'inline-flex';

    switchToTab('tab-report');
    if (progressArea) progressArea.style.display = 'block';

    addLog(`Benchmark session started with ${tasks.length} tasks.`);
    updateProgress(0, 'Starting...');
    runNext();
}

export function cancelBenchmark() {
    isRunning = false;
    testQueue = [];
    unitQueue = [];
    addLog('Benchmark cancelled by user.', 'error');
    updateProgress(100, 'Cancelled');
    if (btnReportRun) btnReportRun.style.display = 'inline-flex';
    const btnReportCancel = document.getElementById('btn-report-cancel');
    if (btnReportCancel) btnReportCancel.style.display = 'none';
}

// Worker message routing
nativeWorker.onmessage = (e) => {
    if (!isRunning) return;
    const { unitId, sizeName, result } = e.data;
    const unit = getBenchmarkById(unitId);
    if (unit) {
        latestData.high[sizeName][unit.name] = result;
        updateTrendCharts(latestData);
    }
    completedUnits++;
    runNext();
};

wrapperWorker.onmessage = (e) => {
    if (!isRunning) return;
    const { unitId, sizeName, result } = e.data;
    const unit = getBenchmarkById(unitId);
    if (unit) {
        latestData.high[sizeName][unit.name] = result;
        updateTrendCharts(latestData);
    }
    completedUnits++;
    runNext();
};

compressionWorker.onmessage = (e) => {
    if (!isRunning) return;
    const { unitId, sizeName, result } = e.data;
    const unit = getBenchmarkById(unitId);
    if (unit) {
        latestData.compression[sizeName][unit.name] = result;
        updateTrendCharts(latestData);
    }
    completedUnits++;
    runNext();
};
