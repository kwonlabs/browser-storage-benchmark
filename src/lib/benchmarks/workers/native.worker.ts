import { getBenchmarkById } from '../index';
import { runStorageLifecycle, generatePayloadString } from '../benchmark';
import type { StorageStepDefinitions } from '../types';

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
        const steps = unit.run(sizeName, sizeValue, { original, modified }) as StorageStepDefinitions;

        const result = await runStorageLifecycle(sizeValue, steps, { original, modified }, unit.name);

        if (steps.teardown) await steps.teardown();

        self.postMessage({
            type: 'done_native',
            unitId,
            sizeName,
            payloadType,
            result
        });
    } catch (err: any) {
        console.error('Native Storage Worker Error:', err);
        self.postMessage({
            type: 'done_native',
            unitId,
            sizeName,
            payloadType,
            result: { insert: -1, read: -1, update: -1, delete: -1 }
        });
    }
};
