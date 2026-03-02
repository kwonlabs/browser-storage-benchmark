import { getBenchmarkById } from "../index";
import { runCompressionLifecycle, generatePayloadBuffer } from "../benchmark";
import type { CompressionStepDefinitions } from "../types";

self.onmessage = async (e: MessageEvent) => {
  const {
    unitId,
    sizeName,
    sizeValue,
    payloadType = "repetitive",
    iterations = 1,
  } = e.data;
  const unit = getBenchmarkById(unitId);

  if (!unit) {
    self.postMessage({ error: `Unit ${unitId} not found` });
    return;
  }

  try {
    const original = generatePayloadBuffer(sizeValue, payloadType);
    // We pass original as any to satisfy type signature which expects string for storage units
    const steps = unit.run(sizeName, sizeValue, {
      original: original as any,
      modified: "",
    }) as CompressionStepDefinitions;

    const result = await runCompressionLifecycle(
      sizeValue,
      steps,
      original,
      unit.name,
      iterations,
      (step, i, dur) => {
        self.postMessage({
          type: "iteration_progress",
          unitId,
          step,
          iteration: i,
          total: iterations,
          sizeName,
          payloadType,
          duration: dur,
        });
      }
    );

    self.postMessage({
      type: "done_compression",
      unitId,
      sizeName,
      payloadType,
      result,
    });
  } catch (err: any) {
    console.error("Compression Worker Error:", err);
    self.postMessage({
      type: "done_compression",
      unitId,
      sizeName,
      payloadType,
      error: err.message || err.toString(),
      result: { compressTime: -1, decompressTime: -1, ratio: 0, compSize: 0 },
    });
  }
};
