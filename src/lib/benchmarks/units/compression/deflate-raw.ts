import type { BenchmarkUnit, CompressionStepDefinitions } from '../../types';
import { generatePayloadBuffer } from '../../benchmark';

export const deflateRawBenchmark: BenchmarkUnit = {
    id: 'deflate-raw',
    name: 'DEFLATE (Raw)',
    description: 'Raw DEFLATE streaming compression built into modern browsers (CompressionStream). Lacks zlib headers/footers.',
    icon: '💨',
    category: 'compression',
    url: 'https://wicg.github.io/compression/',
    runType: 'worker.async',
    run: (_sizeName: string, sizeValue: number, _payloads: { original: string; modified: string }): CompressionStepDefinitions => {
        const payload = generatePayloadBuffer(sizeValue);

        return {
            compress: async () => {
                const cs = new CompressionStream('deflate-raw');
                const writer = cs.writable.getWriter();
                writer.write(payload as any); writer.close();
                const chunks = []; const reader = cs.readable.getReader();
                while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
                const out = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
                let off = 0; for (const c of chunks) { out.set(c, off); off += c.length; }
                return out;
            },
            decompress: async (data: Uint8Array) => {
                const ds = new DecompressionStream('deflate-raw');
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
