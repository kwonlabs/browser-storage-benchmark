import type {
  BenchmarkData,
  PayloadType,
  TaskDef,
} from "../lib/benchmarks/types";
import { SIZES } from "../lib/benchmarks/constants";
import {
  startBenchmark as runnerStart,
  cancelBenchmark as runnerCancel,
  setLatestData,
  setRunnerCallbacks,
} from "../lib/benchmarks/runner";

// ──────────────────────────────────────────────
// Log Item Types
// ──────────────────────────────────────────────
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  message: string;
  type: "system" | "success" | "error";
  level: LogLevel;
  timestamp: string;
}

// Ensure globally unique log IDs to prevent Svelte each_key_duplicate errors
let _logCounter = 0;
function getLogId() {
  return `log_${Date.now()}_${++_logCounter}`;
}

// ──────────────────────────────────────────────
// Empty Data Builder
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
    payloadTypes.forEach((p) => {
      (data.low[s] as Record<string, Record<string, any>>)[p] = {};
      (data.high[s] as Record<string, Record<string, any>>)[p] = {};
      (data.compression[s] as Record<string, Record<string, any>>)[p] = {};
    });
  });
  return data;
}

// ──────────────────────────────────────────────
// Central Store based on Svelte 5 Runes
// ──────────────────────────────────────────────
class BenchmarkStore {
  // Benchmark result data
  data = $state<BenchmarkData>(buildEmptyData());

  // Execution state
  isRunning = $state(false);

  // Progress percentage and message
  progress = $state({
    percent: 0,
    message: "System initialized. Waiting for instructions...",
  });

  // Console logs
  logs = $state<LogEntry[]>([]);
  consoleVisible = $state(false);
  consoleOpen = $state(true);
  consoleFilter = $state<LogLevel[]>(["info", "warn", "error"]);

  // Whether history panel is visible
  historyOpen = $state(false);

  // Comparison mode state
  compareMode = $state(false);
  compareSelection = $state<number[]>([]);

  // Data for comparison
  compareData = $state<BenchmarkData | null>(null);

  // Whether advanced configuration panel is visible
  advancedOpen = $state(false);

  type = $state<"storage" | "compression">("storage");

  constructor(type: "storage" | "compression" = "storage") {
    this.type = type;

    // Load persisted states
    if (typeof window !== "undefined") {
      const savedVisible = localStorage.getItem(`console_visible_${type}`);
      if (savedVisible !== null) this.consoleVisible = savedVisible === "true";

      const savedOpen = localStorage.getItem(`console_open_${type}`);
      if (savedOpen !== null) this.consoleOpen = savedOpen === "true";
    }

    // Load and log environment info immediately on page load
    import("../lib/utils/ua").then(async ({ getFullEnvironmentInfo }) => {
      const info = await getFullEnvironmentInfo();
      this.addLog(info, "system", "info");
      this.addLog(
        "System initialized. Waiting for instructions...",
        "system",
        "info"
      );
    });

    // Setup persistence effects
    $effect.root(() => {
      $effect(() => {
        localStorage.setItem(
          `console_visible_${this.type}`,
          String(this.consoleVisible)
        );
      });
      $effect(() => {
        localStorage.setItem(
          `console_open_${this.type}`,
          String(this.consoleOpen)
        );
      });
    });
  }

  // ─────────────────────────────────────────
  // Derived state
  // ─────────────────────────────────────────
  get hasData(): boolean {
    return (
      Object.keys(this.data.low).some((s) =>
        Object.keys(this.data.low[s] ?? {}).some(
          (p) => Object.keys(this.data.low[s]?.[p] ?? {}).length > 0
        )
      ) ||
      Object.keys(this.data.high).some((s) =>
        Object.keys(this.data.high[s] ?? {}).some(
          (p) => Object.keys(this.data.high[s]?.[p] ?? {}).length > 0
        )
      ) ||
      Object.keys(this.data.compression).some((s) =>
        Object.keys(this.data.compression[s] ?? {}).some(
          (p) => Object.keys(this.data.compression[s]?.[p] ?? {}).length > 0
        )
      )
    );
  }

  // ─────────────────────────────────────────
  // Methods
  // ─────────────────────────────────────────
  addLog(
    message: string,
    type: "system" | "success" | "error" = "system",
    level: LogLevel = "info"
  ) {
    const timestamp = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
    this.logs = [
      ...this.logs,
      { id: getLogId(), message, type, level, timestamp },
    ];
  }

  clearLogs() {
    this.logs = [];
  }

  updateProgress(percent: number, message: string) {
    this.progress = { percent, message };
  }

  loadData(data: BenchmarkData) {
    setLatestData(data);
    this.data = { ...data };
  }

  startRun(
    tasks: TaskDef[],
    payloadTypes: PayloadType[],
    selectedUnitIds: string[] | null = null
  ) {
    if (this.isRunning) return;

    // Reset logs and data when starting a new run
    this.clearLogs();
    this.addLog("Benchmark started...", "system", "info");
    this.data = buildEmptyData();

    setRunnerCallbacks({
      onProgress: (percent, message) => {
        this.progress = { percent, message };
      },
      onLog: (
        message,
        type: "system" | "success" | "error" = "system",
        level: LogLevel = "info"
      ) => {
        this.addLog(message, type, level);
      },
      onDataUpdate: (data) => {
        // Data is already deep-cloned in the runner, assign directly
        this.data = data;
      },
      onFinished: async (data: BenchmarkData) => {
        console.log(
          `[Store:${this.type}] Benchmark finished. Attempting to save...`,
          data
        );
        this.isRunning = false;

        // 1. Update UI data
        const plainData = JSON.parse(JSON.stringify(data));
        this.data = plainData;

        try {
          // Fetch extended UA info to get OS
          const { getExtendedUAInfo } = await import("../lib/utils/ua");
          const info = await getExtendedUAInfo();

          // 2. Save via dynamic import
          const { saveSession } = await import("../lib/benchmarks/history");
          // 3. One more deep-clone to ensure no DataCloneError
          const plainLogs = JSON.parse(JSON.stringify(this.logs));
          const id = await saveSession(
            this.type,
            JSON.parse(JSON.stringify(plainData)),
            plainLogs,
            { os: info.os, browser: info.browser }
          );
          console.log(`[Store:${this.type}] Save success, ID:`, id);
          this.addLog(
            `Benchmark results saved to ${this.type} history (ID: ${id}).`,
            "success"
          );
        } catch (e) {
          console.error(`[Store:${this.type}] Final save failure:`, e);
          this.addLog(
            "Failed to save session to history (Serialization Error).",
            "error"
          );
        }
      },
      onCancelled: () => {
        this.isRunning = false;
      },
    });

    this.isRunning = true;
    this.historyOpen = false;
    runnerStart(tasks, payloadTypes, selectedUnitIds);
  }

  cancelRun() {
    runnerCancel();
    this.isRunning = false;
  }

  async loadLatestHistory() {
    try {
      const { getAllSessions } = await import("../lib/benchmarks/history");
      const sessions = await getAllSessions(this.type);
      if (sessions && sessions.length > 0) {
        const latest = sessions[0];
        if (latest) {
          this.loadData(latest.data);
          this.logs = latest.logs;
          this.addLog(
            `Automatically loaded most recent ${this.type} benchmark session (#${latest.sessionId}).`,
            "system",
            "info"
          );
          return true;
        }
      }
    } catch (e) {
      console.error(`[Store:${this.type}] Auto-load history failure:`, e);
    }
    return false;
  }
}

// Export singleton instances
export const storageStore = new BenchmarkStore("storage");
export const compressionStore = new BenchmarkStore("compression");

// Maintain name for compatibility (gradual migration)
export const benchmarkStore = storageStore;
