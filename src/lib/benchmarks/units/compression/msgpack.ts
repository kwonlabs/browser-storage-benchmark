import msgpack from "msgpack-lite";
import type { BenchmarkUnit, CompressionStepDefinitions } from "../../types";

export const msgpackBenchmark: BenchmarkUnit = {
  id: "msgpack",
  name: "MessagePack",
  description:
    "An efficient binary serialization format. It lets you exchange data among multiple languages like JSON, but it is faster and smaller.",
  icon: "📦",
  category: "compression",
  specialization: "structured",
  url: "https://msgpack.org/",
  releaseYear: 2008,
  developer: "Sadayuki Furuhashi",
  runType: "worker.async",
  run: (
    _sizeName: string,
    _sizeValue: number,
    _payloads: { original: any; modified: any }
  ): CompressionStepDefinitions => {
    // For 'structured' engines, we should ideally use the object form,
    // but current runner passes string/Uint8Array.
    // For demonstration, we'll parse the original if it looks like JSON or just use as is.
    let dataToEncode = _payloads.original;

    try {
      if (
        typeof _payloads.original === "string" &&
        (_payloads.original.startsWith("{") ||
          _payloads.original.startsWith("["))
      ) {
        dataToEncode = JSON.parse(_payloads.original);
      }
    } catch (e) {
      // Fallback to original
    }

    return {
      compress: () => {
        return msgpack.encode(dataToEncode);
      },
      decompress: (data: Uint8Array) => {
        return msgpack.decode(data);
      },
    };
  },
};
