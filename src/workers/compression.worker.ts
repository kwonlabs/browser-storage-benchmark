// Compression Worker
import * as fflate from 'fflate';
import brotliPromise from 'brotli-wasm';
// @ts-ignore
import { init, compress, decompress } from '@bokuweb/zstd-wasm';
import { generatePayloadBuffer, measureOperation } from '../lib/benchmark';

// Initialize WASM modules once
const zstdPromise = init();
const brotliPromiseReady = brotliPromise;

self.onmessage = async (e) => {
    const { type, sizeName, sizeValue } = e.data;

    if (type === 'start_compression') {
        const results: any = {};
        const uint8Payload = generatePayloadBuffer(sizeValue);

        // Ensure WASM is initialized
        await zstdPromise;
        const brotli = await brotliPromiseReady;

        async function measureComp(name: string, compFn: () => Uint8Array | Promise<Uint8Array>, decompFn: (data: Uint8Array) => Promise<any> | any) {
            try {
                // Prime and test
                const prime_comp = await compFn();
                const compSize = prime_comp.length;

                const compTime = await measureOperation(sizeValue, async () => {
                    const s = performance.now();
                    await compFn();
                    return performance.now() - s;
                });

                const decompTime = await measureOperation(sizeValue, async () => {
                    const s = performance.now();
                    await decompFn(prime_comp);
                    return performance.now() - s;
                });

                results[name] = {
                    compressTime: compTime,
                    decompressTime: decompTime,
                    ratio: uint8Payload.length / compSize,
                    compSize: compSize
                };
            } catch (err) {
                results[name] = { compressTime: 0, decompressTime: 0, ratio: 1 };
            }
        }

        // None
        results['None'] = { compressTime: 0, decompressTime: 0, ratio: 1, compSize: uint8Payload.length };

        // ZIP (fflate)
        await measureComp('ZIP',
            () => fflate.zipSync({ "f": uint8Payload }, { level: 6 }),
            (data) => fflate.unzipSync(data)
        );

        // Gzip (Native)
        await measureComp('Gzip',
            async () => {
                const cs = new CompressionStream('gzip');
                const writer = cs.writable.getWriter();
                writer.write(uint8Payload as any);
                writer.close();
                const chunks = [];
                const reader = cs.readable.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                }
                const out = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
                let off = 0; for (const c of chunks) { out.set(c, off); off += c.length; }
                return out;
            },
            async (data) => {
                const ds = new DecompressionStream('gzip');
                const writer = ds.writable.getWriter();
                writer.write(data as any); writer.close();
                const reader = ds.readable.getReader();
                while (true) { if ((await reader.read()).done) break; }
            }
        );

        // Deflate (Native)
        await measureComp('Deflate',
            async () => {
                const cs = new CompressionStream('deflate');
                const writer = cs.writable.getWriter();
                writer.write(uint8Payload as any); writer.close();
                const chunks = []; const reader = cs.readable.getReader();
                while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
                const out = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
                let off = 0; for (const c of chunks) { out.set(c, off); off += c.length; }
                return out;
            },
            async (data) => {
                const ds = new DecompressionStream('deflate');
                const writer = ds.writable.getWriter();
                writer.write(data as any); writer.close();
                const reader = ds.readable.getReader();
                while (true) { if ((await reader.read()).done) break; }
            }
        );

        // Brotli (WASM)
        await measureComp('Brotli',
            () => brotli.compress(uint8Payload),
            (data) => brotli.decompress(data)
        );

        // zstd (WASM)
        await measureComp('zstd',
            () => compress(uint8Payload),
            (data) => decompress(data)
        );

        self.postMessage({ type: 'done_compression', sizeName, payload: results });
    }
};
