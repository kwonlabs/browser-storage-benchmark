import type { BenchmarkUnit, CompressionStepDefinitions } from '../../types';
import { generatePayloadBuffer } from '../../benchmark';

export const gzipBenchmark: BenchmarkUnit = {
    id: 'gzip',
    name: 'Gzip',
    description: 'Utilizes the browser\'s native CompressionStream API (DEFLATE). Provides zero-overhead text compression without external dependencies.',
    icon: '🗜️',
    category: 'compression',
    url: 'https://wicg.github.io/compression/',
    runType: 'worker.async',
    run: (_sizeName: string, sizeValue: number, _payloads: { original: string; modified: string }): CompressionStepDefinitions => {
        const payload = generatePayloadBuffer(sizeValue);

        return {
            compress: async () => {
                const cs = new CompressionStream('gzip');
                const writer = cs.writable.getWriter();
                writer.write(payload as any); writer.close();
                const chunks = []; const reader = cs.readable.getReader();
                while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
                const out = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
                let off = 0; for (const c of chunks) { out.set(c, off); off += c.length; }
                return out;
            },
            decompress: async (data: Uint8Array) => {
                const ds = new DecompressionStream('gzip');
                const writer = ds.writable.getWriter();
                writer.write(data as any); writer.close();
                const chunks = []; const reader = ds.readable.getReader();
                while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
                const out = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
                let off = 0; for (const c of chunks) { out.set(c, off); off += c.length; }
                return out;
            }
        };
    }
};
