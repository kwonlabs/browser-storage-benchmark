import type { BenchmarkUnit, CompressionStepDefinitions } from '../../types';



export const snappyBenchmark: BenchmarkUnit = {
    id: 'snappy',
    name: 'Snappy',
    description: "Google's high-speed compression algorithm via WebAssembly. Optimized for speed over ratio.",
    icon: '⚡',
    category: 'compression',
    url: 'https://google.github.io/snappy/',
    releaseYear: 2011,
    developer: 'Google',
    runType: 'worker.async',
    run: (_sizeName: string, _sizeValue: number, _payloads: { original: any; modified: any }): CompressionStepDefinitions => {
        const payload = _payloads.original as Uint8Array;
        let snappy: any;

        return {
            setup: async () => {
                const m = await import('snappy-wasm');
                await m.default();
                snappy = m;
            },
            compress: () => snappy.compress_raw(payload),
            decompress: (data: Uint8Array) => snappy.decompress_raw(data)
        };
    }
};
