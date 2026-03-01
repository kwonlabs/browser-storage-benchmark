import type { BenchmarkUnit, CompressionStepDefinitions } from '../../types';
import { generatePayloadBuffer } from '../../benchmark';
// @ts-ignore
import lzmaContent from 'lzma/src/lzma_worker-min.js?raw';

const lzma = (() => {
    const dummyGlobal: any = { LZMA_WORKER: null, LZMA: null };
    // We run the worker script in an isolated context to extract the compression functions
    const func = new Function('self', 'onmessage', lzmaContent + '\nreturn this.LZMA || this.LZMA_WORKER;');
    return func.call(dummyGlobal, dummyGlobal, null);
})();

export const lzmaBenchmark: BenchmarkUnit = {
    id: 'lzma',
    name: 'LZMA',
    description: 'High-compression algorithm (Lempel-Ziv-Markov) via JS implementation. Slow but very efficient.',
    icon: '📦',
    category: 'compression',
    url: 'https://tukaani.org/xz/',
    runType: 'worker.async',
    run: (_sizeName: string, sizeValue: number, _payloads: { original: string; modified: string }): CompressionStepDefinitions => {
        const payload = generatePayloadBuffer(sizeValue);

        return {
            compress: async () => {
                return new Promise((resolve, reject) => {
                    // Level 1 for speed in benchmark, usually 1-9
                    lzma.compress(payload, 1, (result: any, error: any) => {
                        if (error) reject(error);
                        else resolve(new Uint8Array(result));
                    });
                });
            },
            decompress: async (data: Uint8Array) => {
                return new Promise((resolve, reject) => {
                    lzma.decompress(data, (result: any, error: any) => {
                        if (error) reject(error);
                        else resolve(new Uint8Array(result));
                    });
                });
            }
        };
    }
};
