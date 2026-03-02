import type { BenchmarkUnit, CompressionStepDefinitions } from '../../types';
// @ts-ignore


export const lz4Benchmark: BenchmarkUnit = {
    id: 'lz4',
    name: 'LZ4',
    description: 'Extremely fast compression algorithm via WebAssembly. Focus on real-time performance.',
    icon: '🏎️',
    category: 'compression',
    specialization: 'generic',
    url: 'https://lz4.github.io/lz4/',
    releaseYear: 2011,
    developer: 'Yann Collet',
    runType: 'worker.async',
    run: (_sizeName: string, _sizeValue: number, _payloads: { original: any; modified: any }): CompressionStepDefinitions => {
        const payload = _payloads.original as Uint8Array;
        let lz4: any;

        return {
            setup: async () => {
                lz4 = await import('lz4-wasm');
            },
            compress: async () => {
                return lz4.compress(payload);
            },
            decompress: async (data: Uint8Array) => {
                return lz4.decompress(data);
            }
        };
    }
};
