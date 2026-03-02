import type { BenchmarkUnit, CompressionStepDefinitions } from "../../types";

export const brotliBenchmark: BenchmarkUnit = {
  id: "brotli",
  name: "Brotli",
  description:
    "Advanced compression format (WASM based), highly optimized for web content.",
  icon: "🍞",
  category: "compression",
  specialization: "generic",
  url: "https://github.com/httptoolkit/brotli-wasm",
  releaseYear: 2013,
  developer: "Google",
  runType: "worker.async",
  run: (
    _sizeName: string,
    _sizeValue: number,
    _payloads: { original: any; modified: any }
  ): CompressionStepDefinitions => {
    const payload = _payloads.original as Uint8Array;
    let brotli: any;

    return {
      setup: async () => {
        const m = await import("brotli-wasm");
        brotli = await m.default;
      },
      compress: () => brotli.compress(payload),
      decompress: (data: Uint8Array) => brotli.decompress(data),
    };
  },
};
