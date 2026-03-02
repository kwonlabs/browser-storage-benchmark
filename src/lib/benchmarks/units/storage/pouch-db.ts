import type { BenchmarkUnit, StorageStepDefinitions } from "../../types";

export const pouchDBBenchmark: BenchmarkUnit = {
  id: "pouchdb",
  name: "PouchDB",
  description:
    "An open-source JavaScript database inspired by Apache CouchDB that is designed to run well within the browser.",
  icon: "📭",
  category: "high-wrapper",
  url: "https://pouchdb.com/",
  releaseYear: 2012,
  developer: "Nolan Lawson",
  runType: "main.async",
  run: (
    sizeName: string,
    _sizeValue: number,
    payloads: { original: string; modified: string }
  ): StorageStepDefinitions => {
    const dbName = `bench_pouch_${sizeName}_${Math.random().toString(36).slice(2, 7)}`;
    let db: any;
    let PouchDB: any;
    return {
      setup: async () => {
        const m = await import("pouchdb-browser");
        PouchDB = m.default;
        db = new PouchDB(dbName);
      },
      insert: async () => {
        try {
          const existing = await db.get("k");
          await db.put({
            _id: "k",
            _rev: existing._rev,
            val: payloads.original,
          });
        } catch (e) {
          await db.put({ _id: "k", val: payloads.original });
        }
      },
      read: async () => {
        try {
          const doc = await db.get("k");
          return doc?.val || null;
        } catch (e) {
          return null;
        }
      },
      update: async () => {
        const doc = await db.get("k");
        await db.put({ ...doc, val: payloads.modified });
      },
      delete: async () => {
        const doc = await db.get("k");
        await db.remove(doc);
      },
      teardown: async () => {
        await db.destroy();
      },
    };
  },
};
