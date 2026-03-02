import type { BenchmarkUnit, CompressionStepDefinitions } from '../../types';




export const lzmaBenchmark: BenchmarkUnit = {
    id: 'lzma',
    name: 'LZMA',
    description: 'High-compression algorithm (Lempel-Ziv-Markov) via JS implementation. Slow but very efficient.',
    icon: '📦',
    category: 'compression',
    url: 'https://tukaani.org/xz/',
    releaseYear: 1998,
    developer: 'Igor Pavlov',
    runType: 'worker.async',
    run: (_sizeName: string, _sizeValue: number, _payloads: { original: any; modified: any }): CompressionStepDefinitions => {
        const payload = _payloads.original as Uint8Array;
        let lzmaLib: any;

        return {
            setup: async () => {
                // We use ?raw to get the worker script content as text, avoiding any Node.js resolution
                // @ts-ignore
                const { default: lzmaContent } = await import('lzma/src/lzma_worker-min.js?raw');
                const dummyGlobal: any = { LZMA_WORKER: null, LZMA: null };
                const func = new Function('self', 'onmessage', lzmaContent + '\nreturn this.LZMA || this.LZMA_WORKER;');
                lzmaLib = func.call(dummyGlobal, dummyGlobal, null);
            },
            compress: async () => {
                return new Promise((resolve) => {
                    lzmaLib.compress(payload, 1, (result: any) => resolve(new Uint8Array(result)));
                });
            },
            decompress: async (data: any) => {
                return new Promise((resolve) => {
                    lzmaLib.decompress(data, (result: any) => {
                        resolve(typeof result === 'string' ? new TextEncoder().encode(result) : new Uint8Array(result));
                    });
                });
            }
        };
    }
};
