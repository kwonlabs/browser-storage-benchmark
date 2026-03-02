import type { BenchmarkUnit, StorageStepDefinitions } from "../../types";

export const sqliteAsyncBenchmark: BenchmarkUnit = {
  id: "sqlite-async",
  name: "SQLite (Async)",
  description:
    "The legendary relational database running via WebAssembly with OPFS (Async) support.",
  icon: "💎",
  category: "high-wrapper",
  url: "https://sqlite.org/wasm",
  releaseYear: 2000,
  developer: "D. Richard Hipp",
  runType: "worker.async",
  isSupported: async () => {
    if (typeof navigator.storage?.getDirectory !== "function") {
      return { supported: false, reason: "OPFS API not available" };
    }
    // SQLite's OPFS VFS requires SharedArrayBuffer (crossOriginIsolated)
    if (!window.crossOriginIsolated) {
      return {
        supported: false,
        reason: "Cross-origin isolation disabled (SAB required)",
      };
    }

    // On the main thread, we cannot fully verify the 'opfs' VFS
    // because it requires a worker context to initialize.
    return { supported: true };
  },
  run: (
    sizeName: string,
    _sizeValue: number,
    payloads: { original: string; modified: string }
  ): StorageStepDefinitions => {
    const dbName = `bench_sqlite_async_${sizeName}_${Math.random().toString(36).slice(2, 7)}`;
    const dbPath = `/${dbName}`;
    let db: any;
    let sqlite3: any;

    return {
      setup: async () => {
        if (!sqlite3) {
          const sqlite3InitModule = (await import("@sqlite.org/sqlite-wasm"))
            .default;
          sqlite3 = await sqlite3InitModule();
        }

        if (!db) {
          if (!("opfs" in sqlite3)) throw new Error("OPFS not supported");
          db = new sqlite3.oo1.OpfsDb(dbPath, "c");
          db.exec(
            "CREATE TABLE IF NOT EXISTS data (id TEXT PRIMARY KEY, val TEXT)"
          );
        }
        db.exec("DELETE FROM data");
      },
      insert: () =>
        db.exec({
          sql: "INSERT OR REPLACE INTO data (id, val) VALUES (?, ?)",
          bind: ["k", payloads.original],
        }),
      read: () => {
        const rows = db.exec({
          sql: "SELECT val FROM data WHERE id = ?",
          bind: ["k"],
          returnValue: "resultRows",
        });
        return rows?.[0]?.[0] || rows?.[0]?.val;
      },
      update: () =>
        db.exec({
          sql: "UPDATE data SET val = ? WHERE id = ?",
          bind: [payloads.modified, "k"],
        }),
      delete: () =>
        db.exec({ sql: "DELETE FROM data WHERE id = ?", bind: ["k"] }),
      teardown: async () => {
        if (db) {
          db.close();
          try {
            const root = await navigator.storage.getDirectory();
            await root.removeEntry(dbPath.replace(/^\//, ""), {
              recursive: true,
            });
          } catch (e) {
            /* ignore cleanup error */
          }
          db = null;
        }
      },
    };
  },
};
