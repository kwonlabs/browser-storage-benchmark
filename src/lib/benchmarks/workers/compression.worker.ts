import { getBenchmarkById } from '../index';
import { runCompressionLifecycle, generatePayloadString } from '../benchmark';
import type { CompressionStepDefinitions } from '../types';

self.onmessage = async (e: MessageEvent) => {
    const { unitId, sizeName, sizeValue } = e.data;
    const unit = getBenchmarkById(unitId);

    if (!unit) {
        self.postMessage({ error: `Unit ${unitId} not found` });
        return;
    }

    try {
        const steps = unit.run(sizeName, sizeValue) as CompressionStepDefinitions;
        const original = generatePayloadString(sizeValue);

        const result = await runCompressionLifecycle(sizeValue, steps, original);

        self.postMessage({
            type: 'done_compression',
            unitId,
            sizeName,
            result
        });
    } catch (err: any) {
        console.error('Compression Worker Error:', err);
        self.postMessage({
            type: 'done_compression',
            unitId,
            sizeName,
            result: { compressTime: -1, decompressTime: -1, ratio: 0, compSize: 0 }
        });
    }
};
