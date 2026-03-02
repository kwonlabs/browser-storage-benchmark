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
    const QUOTA = 65536;

    if (type === 'pdf' || type === 'image') {
        if (type === 'image') {
            const width = Math.floor(Math.sqrt(sizeValue / 3)) || 1;
            const height = Math.floor(sizeValue / (width * 3)) || 1;
            const fileSize = 54 + width * height * 3;

            const header = new Uint8Array(54);
            header[0] = 0x42; header[1] = 0x4D; // BM
            const dv = new DataView(header.buffer);
            dv.setUint32(2, fileSize, true);
            dv.setUint32(10, 54, true); // Offset
            dv.setUint32(14, 40, true); // Header Size
            dv.setUint32(18, width, true);
            dv.setUint32(22, height, true);
            dv.setUint16(26, 1, true); // Planes
            dv.setUint16(28, 24, true); // BPP

            buffer.set(header.slice(0, sizeValue));

            if (sizeValue > 54) {
                for (let i = 54; i < sizeValue; i += 3) {
                    const row = Math.floor((i - 54) / (width * 3));
                    const col = Math.floor(((i - 54) % (width * 3)) / 3);
                    buffer[i] = (row % 256);     // B
                    buffer[i + 1] = (col % 256);   // G
                    buffer[i + 2] = ((row + col) % 256); // R
                }
            }
        } else {
            const header = new TextEncoder().encode('%PDF-1.4\n');
            buffer.set(header.slice(0, sizeValue));
            if (sizeValue > header.length) {
                let offset = header.length;
                while (offset < sizeValue) {
                    const chunkSize = Math.min(sizeValue - offset, QUOTA);
                    crypto.getRandomValues(buffer.subarray(offset, offset + chunkSize));
                    offset += chunkSize;
                }
            }
        }
    } else {
        let offset = 0;
        while (offset < sizeValue) {
            const chunkSize = Math.min(sizeValue - offset, QUOTA);
            crypto.getRandomValues(buffer.subarray(offset, offset + chunkSize));
            offset += chunkSize;
        }
    }
    return buffer;
}

function calculateTrimmedMean(samples: number[]): number {
    if (samples.length === 0) return 0;
    if (samples.length < 3) {
        return samples.reduce((a, b) => a + b, 0) / samples.length;
    }
    // Remove one min and one max
    const sorted = [...samples].sort((a, b) => a - b);
    sorted.shift(); // Remove min
    sorted.pop();   // Remove max
    return sorted.reduce((a, b) => a + b, 0) / sorted.length;
}

export async function runStorageLifecycle(_sizeValue: number, steps: StorageStepDefinitions, payloads: { original: string; modified: string }, name: string, iterations: number = 1, onProgress?: (step: string, iteration: number, duration: number) => void): Promise<BenchmarkResult> {
    const result: BenchmarkResult = {
        insert: 0,
        read: 0,
        update: 0,
        delete: 0,
        errors: {},
        iterations: iterations
    };

    try {
        if (steps.setup) {
            const setupRes = await steps.setup();
            if (setupRes && typeof setupRes.driverInfo === 'string') {
                result.driverInfo = setupRes.driverInfo;
            }
        }

        // 1. Insert
        const insertSamples: number[] = [];
        for (let i = 0; i < iterations; i++) {
            const t1 = performance.now();
            await steps.insert();
            const duration = performance.now() - t1;
            insertSamples.push(duration);

            if (i < iterations - 1 && steps.delete) {
                await steps.delete();
            }
            onProgress?.('insert', i + 1, duration);
        }
        result.insert = calculateTrimmedMean(insertSamples);

        // 2. Read & Verify
        const readSamples: number[] = [];
        let lastReadData: any = null;
        for (let i = 0; i < iterations; i++) {
            if (i > 0) await steps.insert();

            const t2 = performance.now();
            lastReadData = await steps.read();
            const duration = performance.now() - t2;
            readSamples.push(duration);

            if (i < iterations - 1 && steps.delete) {
                await steps.delete();
            }
            onProgress?.('read', i + 1, duration);
        }
        result.read = calculateTrimmedMean(readSamples);

        if (lastReadData !== payloads.original) {
            console.error(`[Benchmark] ${name} Read Verification Failed`);
            result.errors.read = 1;
        }

        // 3. Update
        const updateSamples: number[] = [];
        for (let i = 0; i < iterations; i++) {
            if (i > 0) await steps.insert();
            const t3 = performance.now();
            await steps.update();
            const duration = performance.now() - t3;
            updateSamples.push(duration);
            if (i < iterations - 1 && steps.delete) {
                await steps.delete();
            }
            onProgress?.('update', i + 1, duration);
        }
        result.update = calculateTrimmedMean(updateSamples);

        // 4. Delete
        const deleteSamples: number[] = [];
        for (let i = 0; i < iterations; i++) {
            await steps.insert();
            const t4 = performance.now();
            await steps.delete();
            const duration = performance.now() - t4;
            deleteSamples.push(duration);
            onProgress?.('delete', i + 1, duration);
        }
        result.delete = calculateTrimmedMean(deleteSamples);

    } catch (err: any) {
        console.error(`[Benchmark] ${name} Error:`, err);
        if (!result.errors.insert && result.insert === 0) result.errors.insert = 1;
        else if (!result.errors.read && result.read === 0) result.errors.read = 1;
        else if (!result.errors.update && result.update === 0) result.errors.update = 1;
        else if (!result.errors.delete && result.delete === 0) result.errors.delete = 1;

        return result;
    } finally {
        if (steps.teardown) await steps.teardown();
    }

    return result;
}

export async function runCompressionLifecycle(_sizeValue: number, steps: CompressionStepDefinitions, original: any, name: string, iterations: number = 1, onProgress?: (step: string, iteration: number, duration: number) => void): Promise<CompressionResult> {
    const result: CompressionResult = {
        compressTime: 0,
        decompressTime: 0,
        ratio: 0,
        valid: false,
        errors: 0
    };

    try {
        if (steps.setup) await steps.setup();

        // 1. Compress
        const compressSamples: number[] = [];
        let lastCompressed: any = null;
        for (let i = 0; i < iterations; i++) {
            const t1 = performance.now();
            lastCompressed = await steps.compress();
            const duration = performance.now() - t1;
            compressSamples.push(duration);
            onProgress?.('compress', i + 1, duration);
        }
        result.compressTime = calculateTrimmedMean(compressSamples);

        // 2. Decompress
        const decompressSamples: number[] = [];
        let lastDecompressed: any = null;
        for (let i = 0; i < iterations; i++) {
            const t2 = performance.now();
            lastDecompressed = await steps.decompress(lastCompressed);
            const duration = performance.now() - t2;
            decompressSamples.push(duration);
            onProgress?.('decompress', i + 1, duration);
        }
        result.decompressTime = calculateTrimmedMean(decompressSamples);

        // Verify
        let isValid = false;
        if (typeof original === 'string') {
            isValid = (lastDecompressed === original);
        } else if (original instanceof Uint8Array) {
            isValid = (lastDecompressed.length === original.length);
            if (isValid) {
                for (let i = 0; i < original.length; i++) {
                    if (lastDecompressed[i] !== original[i]) {
                        isValid = false;
                        break;
                    }
                }
            }
        }

        result.valid = isValid;
        if (!isValid) result.errors = 1;

        // Ratio
        const origSize = typeof original === 'string' ? new TextEncoder().encode(original).length : original.length;
        const compSize = lastCompressed.length;
        result.ratio = (compSize / origSize) * 100;
        result.originalSize = origSize;
        result.compSize = compSize;

    } catch (err: any) {
        console.error(`[Compression] ${name} Error:`, err);
        result.errors = 1;
        throw err;
    } finally {
        if (steps.teardown) await steps.teardown();
    }

    return result;
}
