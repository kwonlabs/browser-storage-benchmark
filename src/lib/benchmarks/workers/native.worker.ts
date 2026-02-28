import { getBenchmarkById } from '../index';
import { runStorageLifecycle, generatePayloadString } from '../benchmark';
import type { StorageStepDefinitions } from '../types';

self.onmessage = async (e: MessageEvent) => {
    const { unitId, sizeName, sizeValue } = e.data;
    const unit = getBenchmarkById(unitId);

    if (!unit) {
        self.postMessage({ error: `Unit ${unitId} not found` });
        return;
    }

    try {
        const steps = unit.run(sizeName, sizeValue) as StorageStepDefinitions;
        const original = generatePayloadString(sizeValue);
        const modified = original + 'm';

        const result = await runStorageLifecycle(sizeValue, steps, { original, modified });

        if (steps.teardown) await steps.teardown();

        self.postMessage({
            type: 'done_native',
            unitId,
            sizeName,
            result
        });
    } catch (err: any) {
        console.error('Native Storage Worker Error:', err);
        self.postMessage({
            type: 'done_native',
            unitId,
            sizeName,
            result: { insert: -1, read: -1, update: -1, delete: -1 }
        });
    }
};
