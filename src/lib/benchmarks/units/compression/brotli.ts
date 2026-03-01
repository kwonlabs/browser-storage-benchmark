import compressBrotli from 'brotli-wasm';
import type { BenchmarkUnit, CompressionStepDefinitions } from '../../types';
import { generatePayloadBuffer } from '../../benchmark';

export const brotliBenchmark: BenchmarkUnit = {
    id: 'brotli',
    name: 'Brotli',
    description: 'Advanced compression format (WASM based), highly optimized for web content.',
    icon: '🍞',
    category: 'compression',
    url: 'https://github.com/httptoolkit/brotli-wasm',
    runType: 'worker.async',
    run: (_sizeName: string, sizeValue: number, _payloads: { original: string; modified: string }): CompressionStepDefinitions => {
        const payload = generatePayloadBuffer(sizeValue);
        let brotli: any;

        return {
            setup: async () => {
                brotli = await compressBrotli;
            },
            compress: () => brotli.compress(payload),
            decompress: (data: Uint8Array) => brotli.decompress(data)
        };
    }
};
