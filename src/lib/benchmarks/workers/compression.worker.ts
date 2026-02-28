import { getBenchmarkById } from '../index';
import { runCompressionLifecycle, generatePayloadString } from '../benchmark';
import type { CompressionStepDefinitions } from '../types';

self.onmessage = async (e: MessageEvent) => {
    const { unitId, sizeName, sizeValue, payloadType = 'repetitive' } = e.data;
    const unit = getBenchmarkById(unitId);

    if (!unit) {
        self.postMessage({ error: `Unit ${unitId} not found` });
        return;
    }

    try {
        const original = generatePayloadString(sizeValue, payloadType);
        const modified = original + 'm';
        const steps = unit.run(sizeName, sizeValue, { original, modified }) as CompressionStepDefinitions;

        const result = await runCompressionLifecycle(sizeValue, steps as CompressionStepDefinitions, original, unit.name);

        self.postMessage({
            type: 'done_compression',
            unitId,
            sizeName,
            payloadType,
            result
        });
    } catch (err: any) {
        console.error('Compression Worker Error:', err);
        self.postMessage({
            type: 'done_compression',
            unitId,
            sizeName,
            payloadType,
            result: { compressTime: -1, decompressTime: -1, ratio: 0, compSize: 0 }
        });
    }
};
