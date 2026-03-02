import store from "store2";
import type { BenchmarkUnit, StorageStepDefinitions } from "../../types";

export const storeJsBenchmark: BenchmarkUnit = {
  id: "store2",
  name: "store2",
  description:
    "A feature-rich, cross-browser local storage wrapper. (Note: This is store2 by Nathan Bubna, a better-maintained alternative to the original store.js by Marcus Westin).",
  icon: "🏪",
  category: "high-wrapper",
  url: "https://github.com/nbubna/store",
  releaseYear: 2013,
  developer: "Nathan Bubna",
  runType: "main.sync",
  maxSize: 4 * 1024 * 1024,
  run: (
    sizeName: string,
    _sizeValue: number,
    payloads: { original: string; modified: string }
  ): StorageStepDefinitions => {
    const key = `bench_s2_${sizeName}`;
    return {
      insert: () => {
        store.set(key, payloads.original);
      },
      read: () => {
        return store.get(key);
      },
      update: () => {
        store.set(key, payloads.modified);
      },
      delete: () => {
        store.remove(key);
      },
    };
  },
};
