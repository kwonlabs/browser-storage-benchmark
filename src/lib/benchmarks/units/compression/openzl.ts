// @ts-ignore
import OpenZLLoader from "@kwonlabs/openzl-wasm/openzl-wasm.js";
import { init, compress, decompress } from "@kwonlabs/openzl-wasm";
import type { BenchmarkUnit, CompressionStepDefinitions } from "../../types";

// Shared promise to ensure we only initialize once across benchmark runs
let openzlInitPromise: Promise<any> | null = null;

function getOpenZL() {
  if (!openzlInitPromise) {
    if (typeof self === "undefined") return Promise.resolve(); // Extra safety for SSR
    openzlInitPromise = init(async () => {
      return await OpenZLLoader({
        locateFile: (path: string) => {
          if (path.endsWith(".wasm")) {
            return "/wasm/openzl.wasm";
          }
          return path;
        },
      });
    }).catch((err) => console.error("OpenZL Init Error:", err)); // Add catch for init errors
  }
  return openzlInitPromise;
}

export const openzlBenchmark: BenchmarkUnit = {
  id: "openzl",
  name: "OpenZL",
  description:
    "Meta's OpenZL (Open Zero Latency) compression, providing high-speed compression and decompression with low latency. Integrated via WebAssembly.",
  icon: "📂",
  category: "compression",
  specialization: "generic",
  url: "https://github.com/facebook/openzl",
  releaseYear: 2024,
  developer: "Meta",
  runType: "worker.async",
  run: (
    _sizeName: string,
    _sizeValue: number,
    _payloads: { original: any; modified: any }
  ): CompressionStepDefinitions => {
    const payload = _payloads.original as Uint8Array;

    return {
      setup: async () => {
        await getOpenZL();
      },
      compress: () => compress(payload),
      decompress: (data: Uint8Array) => decompress(data),
    };
  },
};
