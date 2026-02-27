// Compression Worker
import * as fflate from 'fflate';
import brotliPromise from 'brotli-wasm';
// @ts-ignore
import { init, compress, decompress } from '@bokuweb/zstd-wasm';

self.onmessage = async (e) => {
    const { type, sizeName, payloadBuf } = e.data;

    if (type === 'start_compression') {
        const results: any = {};
        const uint8Payload = payloadBuf;

        // Ensure WASM is initialized for zstd
        await init();

        async function measure(name: string, compFn: () => Uint8Array | Promise<Uint8Array>, decompFn: (data: Uint8Array) => Promise<any> | any) {
            try {
                const sComp = performance.now();
                const compressed = await compFn();
                const compTime = performance.now() - sComp;

                const sDecomp = performance.now();
                await decompFn(compressed);
                const decompTime = performance.now() - sDecomp;

                results[name] = {
                    compressTime: compTime,
                    decompressTime: decompTime,
                    ratio: uint8Payload.length / compressed.length,
                    compSize: compressed.length
                };
            } catch (err) {
                results[name] = { compressTime: 0, decompressTime: 0, ratio: 1 };
            }
        }

        // None
        results['None'] = { compressTime: 0, decompressTime: 0, ratio: 1, compSize: uint8Payload.length };

        // ZIP (fflate)
        await measure('ZIP',
            () => fflate.zipSync({ "f": uint8Payload }, { level: 6 }),
            (data) => fflate.unzipSync(data)
        );

        // Gzip (Native)
        await measure('Gzip',
            async () => {
                const cs = new CompressionStream('gzip');
                const writer = cs.writable.getWriter();
                writer.write(uint8Payload);
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
        await measure('Deflate',
            async () => {
                const cs = new CompressionStream('deflate');
                const writer = cs.writable.getWriter();
                writer.write(uint8Payload); writer.close();
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
        const brotli = await brotliPromise;
        await measure('Brotli',
            () => brotli.compress(uint8Payload),
            (data) => brotli.decompress(data)
        );

        // zstd (WASM)
        await measure('zstd',
            () => compress(uint8Payload),
            (data) => decompress(data)
        );

        self.postMessage({ type: 'done_compression', sizeName, payload: results });
    }
};
