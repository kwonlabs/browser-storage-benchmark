import { getBenchmarkById } from '../index';
import { runTimedWithResult } from '../benchmark';
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

        if (steps.setup) await steps.setup();

        // Prime and get compressed size
        const firstComp = await Promise.resolve(steps.compress());
        const compSize = firstComp.length;

        // Measure compression time
        const { time: compressTime } = await runTimedWithResult(() => steps.compress());

        // Measure decompression time
        const { time: decompressTime } = await runTimedWithResult(() => steps.decompress(firstComp));

        if (steps.teardown) await steps.teardown();

        const ratio = sizeValue / (compSize || 1);

        self.postMessage({
            type: 'done_compression',
            unitId,
            sizeName,
            result: {
                compressTime,
                decompressTime,
                ratio,
                compSize
            }
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
