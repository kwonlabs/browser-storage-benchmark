import type { BenchmarkUnit, CompressionStepDefinitions } from '../../types';
import { generatePayloadBuffer } from '../../benchmark';
import * as fflate from 'fflate';

export const zipBenchmark: BenchmarkUnit = {
    id: 'zip',
    name: 'ZIP',
    description: 'A widely used format implemented via the fflate library, balancing compression ratio and speed. Ideal for multi-file packaging.',
    icon: '📦',
    category: 'compression',
    runType: 'worker.async',
    run: (_sizeName: string, sizeValue: number, _payloads: { original: string; modified: string }): CompressionStepDefinitions => {
        const payload = generatePayloadBuffer(sizeValue);
        return {
            compress: () => fflate.zipSync({ "f": payload }, { level: 6 }),
            decompress: (data: Uint8Array) => {
                const unzipped = fflate.unzipSync(data);
                return unzipped['f'];
            }
        };
    }
};
