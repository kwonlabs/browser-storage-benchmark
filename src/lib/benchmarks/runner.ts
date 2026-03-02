import { SIZES } from "./constants";
import {
  runStorageLifecycle,
  runCompressionLifecycle,
  generatePayloadString,
} from "./benchmark";
import { getBenchmarksByCategory, getBenchmarkById } from "./index";
import type {
  TaskDef,
  BenchmarkData,
  StorageStepDefinitions,
  CompressionStepDefinitions,
  PayloadType,
} from "./types";
import { getFullEnvironmentInfo } from "../utils/ua";

// ──────────────────────────────────────────────
// Event callback types (Decoupled from UI)
// ──────────────────────────────────────────────
export interface RunnerCallbacks {
  onProgress: (percent: number, message: string) => void;
  onLog: (
    message: string,
    type?: "system" | "success" | "error",
    level?: "debug" | "info" | "warn" | "error"
  ) => void;
  onDataUpdate: (data: BenchmarkData) => void;
  onFinished: (data: BenchmarkData) => void;
  onCancelled: () => void;
}

let callbacks: RunnerCallbacks | null = null;

export function setRunnerCallbacks(cb: RunnerCallbacks) {
  callbacks = cb;
}

// ──────────────────────────────────────────────
// Benchmark State
// ──────────────────────────────────────────────
function buildEmptyData(): BenchmarkData {
  const data: BenchmarkData = { low: {}, high: {}, compression: {} };
  const payloadTypes: PayloadType[] = [
    "text",
    "json",
    "random",
    "binary",
    "image",
    "pdf",
  ];
  Object.keys(SIZES).forEach((s) => {
    data.low[s] = {};
    data.high[s] = {};
    data.compression[s] = {};
    const low = data.low[s] as Record<string, Record<string, unknown>>;
    const high = data.high[s] as Record<string, Record<string, unknown>>;
    const comp = data.compression[s] as Record<string, Record<string, unknown>>;
    payloadTypes.forEach((p) => {
      low[p] = {};
      high[p] = {};
      comp[p] = {};
    });
  });
  return data;
}

export let latestData: BenchmarkData = buildEmptyData();
export let isRunning = false;

let testQueue: {
  task: TaskDef;
  payloadTypes: PayloadType[];
  selectedUnitIds: string[] | null;
}[] = [];
let unitQueue: {
  unitId: string;
  sizeName: string;
  sizeValue: number;
  payloadType: PayloadType;
}[] = [];
let totalUnits = 0;
let completedUnits = 0;
let timeoutHandle: any = null;
let isProcessing = false;
let unitStartTime = 0;

// ──────────────────────────────────────────────
// Workers
// ──────────────────────────────────────────────
let nativeWorker: Worker | null = null;
let wrapperWorker: Worker | null = null;
let compressionWorker: Worker | null = null;

function initWorkers() {
  terminateWorkers();
  nativeWorker = new Worker(
    new URL("./workers/native.worker.ts", import.meta.url),
    { type: "module" }
  );
  wrapperWorker = new Worker(
    new URL("./workers/wrapper.worker.ts", import.meta.url),
    { type: "module" }
  );
  compressionWorker = new Worker(
    new URL("./workers/compression.worker.ts", import.meta.url),
    { type: "module" }
  );

  nativeWorker.onmessage = (e) => handleWorkerMessage(e, "high");
  wrapperWorker.onmessage = (e) => handleWorkerMessage(e, "high");
  compressionWorker.onmessage = (e) => handleWorkerMessage(e, "compression");

  // Catch worker errors
  function handleWorkerError(worker: "native" | "wrapper" | "compression") {
    return (e: ErrorEvent) => {
      console.error(`[${worker} worker] Error:`, e.message);
      callbacks?.onLog(
        `⚠ ${worker} worker error: ${e.message}`,
        "error",
        "error"
      );
      completedUnits++;
      isProcessing = false;
      runNext();
    };
  }
  nativeWorker.onerror = handleWorkerError("native");
  wrapperWorker.onerror = handleWorkerError("wrapper");
  compressionWorker.onerror = handleWorkerError("compression");
}

function terminateWorkers() {
  nativeWorker?.terminate();
  wrapperWorker?.terminate();
  compressionWorker?.terminate();
  nativeWorker = null;
  wrapperWorker = null;
  compressionWorker = null;
}

// ──────────────────────────────────────────────
// Process worker messages & record results
// ──────────────────────────────────────────────
function recordResult(
  unitId: string,
  sizeName: string,
  payloadType: string,
  result: any
) {
  const unit = getBenchmarkById(unitId);
  if (!unit) return;

  if (unit.category === "compression") {
    if (!latestData.compression[sizeName])
      latestData.compression[sizeName] = {};
    if (!latestData.compression[sizeName][payloadType])
      latestData.compression[sizeName][payloadType] = {};
    (latestData.compression[sizeName][payloadType] as Record<string, any>)[
      unit.name
    ] = result;
  } else {
    const storageCategory = unit.category === "low" ? "low" : "high";
    if (!latestData[storageCategory][sizeName])
      latestData[storageCategory][sizeName] = {};
    if (!latestData[storageCategory][sizeName][payloadType])
      latestData[storageCategory][sizeName][payloadType] = {};
    (latestData[storageCategory][sizeName][payloadType] as Record<string, any>)[
      unit.name
    ] = result;
  }
}

function handleWorkerMessage(
  e: MessageEvent,
  category: "high" | "compression"
) {
  if (!isRunning) return;
  const {
    type,
    unitId,
    sizeName,
    payloadType,
    result,
    step,
    iteration,
    total,
  } = e.data;

  if (type === "iteration_progress") {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      // Reset timeout for another 30s as progress is being made
      timeoutHandle = setTimeout(() => {
        if (!isRunning) return;
        const unit = getBenchmarkById(unitId);
        console.warn(
          `[Runner] Timeout for ${unit?.name || unitId} (${unitId})`
        );
        callbacks?.onLog(
          `⚠ Timeout: ${unit?.name || unitId} skipped`,
          "error",
          "warn"
        );
        initWorkers();
        completedUnits++;
        isProcessing = false;
        runNext();
      }, 30000);
    }

    const unit = getBenchmarkById(unitId);
    if (unit) {
      const durStr =
        e.data.duration !== undefined
          ? ` (${e.data.duration.toFixed(2)}ms)`
          : "";
      callbacks?.onLog(
        `[${unit.name}] ${step} iteration ${iteration}/${total} finished${durStr}`,
        "system",
        "debug"
      );
      const percent = Math.round((completedUnits / (totalUnits || 1)) * 100);
      callbacks?.onProgress(
        percent,
        `Running: ${unit.name} (${sizeName.toUpperCase()}, ${payloadType}) - ${step} ${iteration}/${total}...`
      );
    }
    return;
  }

  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
    timeoutHandle = null;
  }

  const unit = getBenchmarkById(unitId);
  if (unit) {
    if (e.data.error) {
      callbacks?.onLog(
        `[${unit.name}] Worker Execution Error: ${e.data.error}`,
        "error",
        "error"
      );
    }

    recordResult(unitId, sizeName, payloadType, result);

    const duration = (performance.now() - unitStartTime).toFixed(2);
    const catLabel = category === "compression" ? "compression" : "storage";
    const pType = payloadType.toUpperCase();
    callbacks?.onLog(
      `Done ${catLabel} for ${unit.id} ${sizeName.toUpperCase()}/${pType} (${duration}ms)`,
      "success",
      "info"
    );

    if (result?.driverInfo) {
      callbacks?.onLog(
        `[${unit.name}] Selected Runtime Driver: ${result.driverInfo}`,
        "system",
        "info"
      );
    }

    if (callbacks) {
      try {
        // Always deep copy for Svelte 5 reactivity
        const plainData = JSON.parse(JSON.stringify(latestData));
        callbacks.onDataUpdate(plainData);
      } catch (e) {
        console.error("[Runner] Serialization error during data update:", e);
        callbacks?.onLog(`Serialization error: ${e}`, "error", "warn");
      }
    }
  }
  completedUnits++;
  isProcessing = false;
  runNext();
}

// ──────────────────────────────────────────────
// Data management (import/history loading)
// ──────────────────────────────────────────────
export function setLatestData(data: BenchmarkData) {
  if (!data) return;

  const migrate = (source: any, target: any) => {
    if (!source) return;
    Object.keys(source).forEach((size) => {
      if (!target[size]) target[size] = {};
      Object.keys(source[size]).forEach((pt) => {
        if (!target[size][pt]) target[size][pt] = {};
        Object.assign(target[size][pt], source[size][pt]);
      });
    });
  };

  migrate(data.low, latestData.low);
  migrate(data.high, latestData.high);
  migrate(data.compression, latestData.compression);
}

// ──────────────────────────────────────────────
// Helper: Get Iterations based on category and size
// ──────────────────────────────────────────────
function getIterations(unitId: string, sizeValue: number): number {
  const unit = getBenchmarkById(unitId);
  if (!unit) return 1;

  // Only scale iterations for fast (volatile) storage or compression
  if (unit.category === "low") {
    if (sizeValue <= 102400) return 100; // 128b ~ 100kb: 100x
    return 10; // 1mb+: 10x
  }

  // For middle/high native, use 5 iterations with trimmed mean for precision
  if (unit.category === "high-native" || unit.category === "high-wrapper") {
    return 5;
  }

  // Compression: use 5 iterations with trimmed mean
  if (unit.category === "compression") {
    return 5;
  }

  return 1;
}

// ──────────────────────────────────────────────
// Local execution (Main thread)
// ──────────────────────────────────────────────
async function runMainThreadUnit(
  unitId: string,
  sizeName: string,
  sizeValue: number,
  payloadType: PayloadType
) {
  const unit = getBenchmarkById(unitId);
  if (!unit) return;

  try {
    const original = generatePayloadString(sizeValue, payloadType);
    const modified = original + "m";
    const steps = unit.run(sizeName, sizeValue, { original, modified });

    if (!isRunning) return;

    const iterations = getIterations(unitId, sizeValue);
    if (iterations > 1) {
      callbacks?.onLog(
        `[${unit.name}] Running ${iterations.toLocaleString()} iterations for precision...`,
        "system",
        "debug"
      );
    }

    if (unit.category === "compression") {
      const result = await runCompressionLifecycle(
        sizeValue,
        steps as CompressionStepDefinitions,
        original,
        unit.name,
        iterations
      );
      if (!isRunning) return;
      recordResult(unitId, sizeName, payloadType, result);
    } else {
      const result = await runStorageLifecycle(
        sizeValue,
        steps as StorageStepDefinitions,
        { original, modified },
        unit.name,
        iterations
      );
      if (!isRunning) return;
      recordResult(unitId, sizeName, payloadType, result);

      if (result.driverInfo) {
        callbacks?.onLog(
          `[${unit.name}] Selected Runtime Driver: ${result.driverInfo}`,
          "system",
          "info"
        );
      }
    }

    const duration = (performance.now() - unitStartTime).toFixed(2);
    const catLabel =
      unit.category === "compression" ? "compression" : "storage";
    const pType = payloadType.toUpperCase();
    callbacks?.onLog(
      `Done ${catLabel} for ${unit.id} ${sizeName.toUpperCase()}/${pType} (${duration}ms)`,
      "success",
      "info"
    );
  } catch (err: any) {
    console.error(`Main Thread Unit Error[${unitId}]: `, err);
    callbacks?.onLog(
      `[${unit.name}] Main Thread Error: ${err.message || err}`,
      "error",
      "error"
    );
  }
}

// ──────────────────────────────────────────────
// Queue execution loop
// ──────────────────────────────────────────────
export async function runNext() {
  if (!isRunning || isProcessing) return;
  isProcessing = true;

  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
    timeoutHandle = null;
  }

  if (unitQueue.length === 0) {
    if (testQueue.length === 0) {
      isRunning = false;
      isProcessing = false;
      callbacks?.onProgress(100, "All benchmarks completed!");
      callbacks?.onLog("All tasks finished successfully.", "success", "info");
      terminateWorkers();
      // Always deep copy for Svelte 5 reactivity and final save integrity
      callbacks?.onFinished(JSON.parse(JSON.stringify(latestData)));
      return;
    }

    const nextGroup = testQueue.shift();
    if (!nextGroup) return;

    const { task, payloadTypes, selectedUnitIds } = nextGroup;
    const benchmarks = getBenchmarksByCategory(task.category);
    payloadTypes.forEach((pt) => {
      benchmarks.forEach((b) => {
        if (selectedUnitIds && !selectedUnitIds.includes(b.id)) return;
        if (b.maxSize && task.sizeValue > b.maxSize) return;
        // Specific limits
        if (b.id === "cookie" && task.sizeValue > 4000) return;
        if (
          ["sessionstorage", "localstorage", "store2"].includes(b.id) &&
          task.sizeValue >= 4 * 1024 * 1024
        )
          return;

        unitQueue.push({
          unitId: b.id,
          sizeName: task.sizeName,
          sizeValue: task.sizeValue,
          payloadType: pt,
        });
      });
    });

    await new Promise((r) => setTimeout(r, 0));
    isProcessing = false;
    runNext();
    return;
  }

  const nextUnit = unitQueue.shift();
  if (!nextUnit) {
    isProcessing = false;
    return;
  }

  const { unitId, sizeName, sizeValue, payloadType } = nextUnit;
  const percent = Math.round((completedUnits / (totalUnits || 1)) * 100);
  const unit = getBenchmarkById(unitId);

  if (!unit) {
    completedUnits++;
    isProcessing = false;
    runNext();
    return;
  }

  if (unit.isSupported) {
    try {
      const result = await Promise.resolve(unit.isSupported());
      const supported = typeof result === "boolean" ? result : result.supported;
      const reason =
        typeof result === "object"
          ? result.reason
          : "Not supported in this environment";

      if (!supported) {
        console.warn(`[Runner] Skipping ${unit.name} - ${reason}`);
        callbacks?.onLog(`⚠ Skipping ${unit.name}: ${reason}`, "error", "warn");
        completedUnits++;
        isProcessing = false;
        runNext();
        return;
      }
    } catch (e: any) {
      console.error(`[Runner] Error checking support for ${unit.name}:`, e);
      callbacks?.onLog(
        `⚠ Support check failed for ${unit.name}: ${e.message}`,
        "error",
        "error"
      );
      completedUnits++;
      isProcessing = false;
      runNext();
      return;
    }
  }

  unitStartTime = performance.now();
  const catLabel = unit.category === "compression" ? "compression" : "storage";
  const pType = payloadType.toUpperCase();
  callbacks?.onProgress(
    percent,
    `Running: ${unit.name} (${sizeName.toUpperCase()}, ${payloadType})...`
  );
  callbacks?.onLog(
    `Start ${catLabel} for ${unit.name} ${sizeName.toUpperCase()}/${pType}`,
    "system",
    "info"
  );

  if (unit.runType === "worker.async") {
    timeoutHandle = setTimeout(() => {
      if (!isRunning) return;
      console.warn(`[Runner] Timeout for ${unit.name} (${unitId})`);
      callbacks?.onLog(`⚠ Timeout: ${unit.name} skipped`, "error", "warn");
      initWorkers();
      completedUnits++;
      isProcessing = false;
      runNext();
    }, 30000);

    const worker =
      unit.category === "compression"
        ? compressionWorker
        : unit.category === "high-native"
          ? nativeWorker
          : wrapperWorker;

    const iterations = getIterations(unitId, sizeValue);

    if (worker) {
      worker.postMessage({
        unitId,
        sizeName,
        sizeValue,
        payloadType,
        iterations,
      });
    } else {
      console.error("Worker not initialized");
      callbacks?.onLog("Worker not initialized", "error", "error");
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      completedUnits++;
      isProcessing = false;
      runNext();
    }
  } else {
    const unitPromise = runMainThreadUnit(
      unitId,
      sizeName,
      sizeValue,
      payloadType
    );
    const timeoutPromise = new Promise((_, reject) => {
      const h = setTimeout(() => reject(new Error("TIMEOUT")), 35000);
      return () => clearTimeout(h);
    });

    try {
      await Promise.race([unitPromise, timeoutPromise]);
    } catch (err: any) {
      if (err.message === "TIMEOUT") {
        console.warn(`[Runner] Main Thread Timeout: ${unit.name}`);
        callbacks?.onLog(`⚠ Timeout: ${unit.name} skipped`, "error", "warn");
      } else {
        console.error(`[Runner] Execution Error: ${unit.name}`, err);
        callbacks?.onLog(
          `[${unit.name}] Execution Error: ${err.message || err}`,
          "error",
          "error"
        );
      }
    } finally {
      completedUnits++;
      isProcessing = false;
      // Always deep copy for Svelte 5 reactivity
      callbacks?.onDataUpdate(JSON.parse(JSON.stringify(latestData)));
      if (isRunning) runNext();
    }
  }
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

export async function startBenchmark(
  tasks: TaskDef[],
  payloadTypes: PayloadType[],
  selectedUnitIds: string[] | null = null
) {
  if (isRunning) return;

  testQueue = tasks
    .map((task) => {
      const isCompression = task.category === "compression";
      const filteredPayloads = isCompression
        ? payloadTypes
        : payloadTypes.length > 0
          ? payloadTypes
          : ["text" as PayloadType];
      return { task, payloadTypes: filteredPayloads, selectedUnitIds };
    })
    .filter((t) => t.payloadTypes.length > 0);

  if (testQueue.length === 0) {
    callbacks?.onLog("No valid tasks selected.", "error", "warn");
    return;
  }

  isRunning = true;
  unitQueue = [];
  totalUnits = 0;
  completedUnits = 0;
  latestData = buildEmptyData();

  testQueue.forEach((q) => {
    const benchmarks = getBenchmarksByCategory(q.task.category);
    q.payloadTypes.forEach(() => {
      benchmarks.forEach((b) => {
        if (q.selectedUnitIds && !q.selectedUnitIds.includes(b.id)) return;
        if (b.maxSize && q.task.sizeValue > b.maxSize) return;
        if (b.id === "cookie" && q.task.sizeValue > 4000) return;
        if (
          ["sessionstorage", "localstorage", "store2"].includes(b.id) &&
          q.task.sizeValue >= 4 * 1024 * 1024
        )
          return;
        totalUnits++;
      });
    });
  });

  initWorkers();
  const envInfo = await getFullEnvironmentInfo();
  callbacks?.onLog(`[Environment] ${envInfo}`, "system", "info");
  callbacks?.onLog(
    `Benchmark session started with ${totalUnits} units.`,
    "system",
    "info"
  );
  callbacks?.onProgress(0, "Starting...");
  runNext();
}

export function cancelBenchmark() {
  isRunning = false;
  testQueue = [];
  unitQueue = [];
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
    timeoutHandle = null;
  }
  isProcessing = false;
  terminateWorkers();
  callbacks?.onLog("Benchmark cancelled by user.", "error", "warn");
  callbacks?.onProgress(100, "Cancelled");
  callbacks?.onCancelled();
}
