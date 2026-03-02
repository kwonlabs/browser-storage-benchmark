import type { BenchmarkUnit, CompressionStepDefinitions } from '../../types';
import * as fflate from 'fflate';

export const zipBenchmark: BenchmarkUnit = {
    id: 'zip',
    name: 'ZIP',
    description: 'A widely used format implemented via the fflate library, balancing compression ratio and speed. Ideal for multi-file packaging.',
    icon: '📦',
    category: 'compression',
    url: 'https://github.com/101arrowz/fflate',
    releaseYear: 1989,
    developer: 'Phil Katz / PKWARE',
    runType: 'worker.async',
    run: (_sizeName: string, _sizeValue: number, _payloads: { original: any; modified: any }): CompressionStepDefinitions => {
        const payload = _payloads.original as Uint8Array;
        return {
            compress: () => fflate.zipSync({ "f": payload }, { level: 6 }),
            decompress: (data: Uint8Array) => {
                const unzipped = fflate.unzipSync(data);
                return unzipped['f'];
            }
        };
    }
};
