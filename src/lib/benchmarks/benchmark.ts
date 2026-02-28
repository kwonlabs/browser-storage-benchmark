import type { BenchmarkResult, CompressionResult, StorageStepDefinitions, CompressionStepDefinitions, PayloadType } from './types';

export function generatePayloadString(sizeValue: number, type: PayloadType = 'text'): string {
    if (type === 'json') {
        const base = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            data: 'A'.repeat(100),
            tags: ['bench', 'storage', 'browser'],
            metadata: { version: '1.0', author: 'Benchmark' }
        };
        const baseStr = JSON.stringify(base);
        const count = Math.max(1, Math.floor(sizeValue / baseStr.length));
        return JSON.stringify(Array(count).fill(base)).slice(0, sizeValue);
    }

    if (type === 'text') {
        const sentences = [
            "The quick brown fox jumps over the lazy dog.",
            "Web storage performance varies significantly across browsers.",
            "Compression algorithms like Brotli and Zstandard offer different trade-offs.",
            "Modern web applications require efficient data persistence strategies.",
            "IndexedDB is a powerful low-level API for client-side storage."
        ];
        let result = "";
        while (result.length < sizeValue) {
            result += sentences[Math.floor(Math.random() * sentences.length)] + " ";
        }
        return result.slice(0, sizeValue);
    }

    if (type === 'random') {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ';
        let result = '';
        for (let i = 0; i < sizeValue; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    if (type === 'binary' || type === 'image' || type === 'pdf') {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        let result = type === 'pdf' ? '%PDF-1.4\n' : '';
        const remaining = sizeValue - result.length;
        for (let i = 0; i < remaining; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    return 'A'.repeat(sizeValue);
}

export function generatePayloadBuffer(sizeValue: number, type: PayloadType = 'text'): Uint8Array {
    if (type === 'text' || type === 'json' || type === 'random') {
        return new TextEncoder().encode(generatePayloadString(sizeValue, type));
    }

    const buffer = new Uint8Array(sizeValue);
    if (type === 'pdf') {
        const header = new TextEncoder().encode('%PDF-1.4\n');
        buffer.set(header.slice(0, sizeValue));
        if (sizeValue > header.length) {
            crypto.getRandomValues(buffer.subarray(header.length));
        }
    } else {
        crypto.getRandomValues(buffer);
    }
    return buffer;
}


export async function runStorageLifecycle(_sizeValue: number, steps: StorageStepDefinitions, payloads: { original: string; modified: string }, name: string): Promise<BenchmarkResult> {
    const result: BenchmarkResult = {
        insert: 0,
        read: 0,
        update: 0,
        delete: 0,
        errors: {},
        iterations: 1
    };

    try {
        if (steps.setup) await steps.setup();

        // Insert
        const t1 = performance.now();
        await steps.insert();
        result.insert = performance.now() - t1;

        // Read & Verify
        const t2 = performance.now();
        const readData = await steps.read();
        result.read = performance.now() - t2;

        if (readData !== payloads.original) {
            console.error(`[Benchmark] ${name} Read Verification Failed`);
            result.errors.read = 1;
        }

        // Update
        const t3 = performance.now();
        await steps.update();
        result.update = performance.now() - t3;

        // Delete
        const t4 = performance.now();
        await steps.delete();
        result.delete = performance.now() - t4;

    } catch (err: any) {
        console.error(`[Benchmark] ${name} Error:`, err);
        result.errors.insert = 1;
    } finally {
        if (steps.teardown) await steps.teardown();
    }

    return result;
}

export async function runCompressionLifecycle(_sizeValue: number, steps: CompressionStepDefinitions, original: any, name: string): Promise<CompressionResult> {
    const result: CompressionResult = {
        compressTime: 0,
        decompressTime: 0,
        ratio: 0,
        valid: false,
        errors: 0
    };

    try {
        if (steps.setup) await steps.setup();

        // Compress
        const t1 = performance.now();
        const compressed = await steps.compress();
        result.compressTime = performance.now() - t1;

        // Decompress
        const t2 = performance.now();
        const decompressed = await steps.decompress(compressed);
        result.decompressTime = performance.now() - t2;

        // Verify (if string or buffer)
        let isValid = false;
        if (typeof original === 'string') {
            isValid = (decompressed === original);
        } else if (original instanceof Uint8Array) {
            isValid = (decompressed.length === original.length);
            if (isValid) {
                for (let i = 0; i < original.length; i++) {
                    if (decompressed[i] !== original[i]) {
                        isValid = false;
                        break;
                    }
                }
            }
        }

        result.valid = isValid;
        if (!isValid) result.errors = 1;

        // Ratio (%)
        const origSize = typeof original === 'string' ? new TextEncoder().encode(original).length : original.length;
        const compSize = compressed.length;
        result.ratio = (compSize / origSize) * 100;
        result.originalSize = origSize;
        result.compSize = compSize;

    } catch (err) {
        console.error(`[Compression] ${name} Error:`, err);
        result.errors = 1;
    } finally {
        if (steps.teardown) await steps.teardown();
    }

    return result;
}
