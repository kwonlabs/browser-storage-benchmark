import type { BenchmarkUnit, CompressionStepDefinitions } from '../../types';
import { generatePayloadBuffer } from '../../benchmark';
// @ts-ignore
import init, { compress_raw, decompress_raw } from 'snappy-wasm';

let initialized = false;

async function ensureInitialized() {
    if (!initialized) {
        // Use the copy in public/wasm for reliable loading in both dev and prod
        await init('/wasm/snappy_bg.wasm');
        initialized = true;
    }
}

export const snappyBenchmark: BenchmarkUnit = {
    id: 'snappy',
    name: 'Snappy',
    description: "Google's high-speed compression algorithm via WebAssembly. Optimized for speed over ratio.",
    icon: '⚡',
    category: 'compression',
    url: 'https://google.github.io/snappy/',
    runType: 'worker.async',
    run: (_sizeName: string, sizeValue: number, _payloads: { original: string; modified: string }): CompressionStepDefinitions => {
        const payload = generatePayloadBuffer(sizeValue);

        return {
            compress: async () => {
                await ensureInitialized();
                return compress_raw(payload);
            },
            decompress: async (data: Uint8Array) => {
                await ensureInitialized();
                return decompress_raw(data);
            }
        };
    }
};
