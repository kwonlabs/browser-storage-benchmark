import { getBenchmarkById } from '../index';
import { runStorageLifecycle, generatePayloadString } from '../benchmark';
import type { StorageStepDefinitions } from '../types';

self.onmessage = async (e: MessageEvent) => {
    const { unitId, sizeName, sizeValue, payloadType = 'repetitive', iterations = 1 } = e.data;
    const unit = getBenchmarkById(unitId);

    if (!unit) {
        self.postMessage({ error: `Unit ${unitId} not found` });
        return;
    }

    try {
        const original = generatePayloadString(sizeValue, payloadType);
        const modified = original + 'm';
        const steps = unit.run(sizeName, sizeValue, { original, modified }) as StorageStepDefinitions;

        const result = await runStorageLifecycle(sizeValue, steps, { original, modified }, unit.name, iterations, (step, i, dur) => {
            self.postMessage({ type: 'iteration_progress', unitId, step, iteration: i, total: iterations, sizeName, payloadType, duration: dur });
        });

        self.postMessage({
            type: 'done_wrapper',
            unitId,
            sizeName,
            payloadType,
            result
        });
    } catch (err: any) {
        console.error('Wrapper Storage Worker Error:', err);
        self.postMessage({
            type: 'done_wrapper',
            unitId,
            sizeName,
            payloadType,
            error: err.message || err.toString(),
            result: { insert: -1, read: -1, update: -1, delete: -1 }
        });
    }
};
