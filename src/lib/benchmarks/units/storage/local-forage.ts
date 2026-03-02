import localforage from "localforage";
import type { BenchmarkUnit, StorageStepDefinitions } from "../../types";

export const localForageBenchmark: BenchmarkUnit = {
  id: "localforage",
  name: "localForage",
  description:
    "A fast and simple storage library that uses IndexedDB, WebSQL, or LocalStorage through a simple localStorage-like API.",
  icon: "📦",
  category: "high-wrapper",
  url: "https://localforage.github.io/localForage/",
  releaseYear: 2014,
  developer: "Mozilla",
  runType: "main.async",
  run: (
    sizeName: string,
    _sizeValue: number,
    payloads: { original: string; modified: string }
  ): StorageStepDefinitions => {
    const storeName = `bench_forage_${sizeName}_${Math.random().toString(36).slice(2, 7)}`;
    let lf: LocalForage;
    return {
      setup: async () => {
        lf = localforage.createInstance({
          name: "bench_lf_db",
          storeName: storeName,
        });
        await lf.clear();
        return { driverInfo: lf.driver() };
      },
      insert: async () => {
        await lf.setItem("k", payloads.original);
      },
      read: async () => {
        return await lf.getItem<string>("k");
      },
      update: async () => {
        await lf.setItem("k", payloads.modified);
      },
      delete: async () => {
        await lf.removeItem("k");
      },
      teardown: async () => {
        try {
          await lf.dropInstance({
            name: "bench_lf_db",
            storeName: storeName,
          });
        } catch (e) {}
      },
    };
  },
};
