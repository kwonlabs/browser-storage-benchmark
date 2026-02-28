import { getBenchmarkById } from '../index';
import { runTimed } from '../benchmark';
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

        if (steps.setup) await steps.setup();

        const result = {
            insert: await runTimed(sizeValue, steps.insert),
            read: await runTimed(sizeValue, steps.read),
            update: await runTimed(sizeValue, steps.update),
            delete: await runTimed(sizeValue, steps.delete),
        };

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
