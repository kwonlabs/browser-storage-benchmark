import type { BenchmarkResult, CompressionResult, StorageStepDefinitions, CompressionStepDefinitions } from './types';

export function generatePayloadString(size: number): string {
    const pattern = 'WebBenchmarkPayload_';
    const repeatCount = Math.floor(size / pattern.length);
    return pattern.repeat(repeatCount) + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.substring(0, size % pattern.length);
}

export function generatePayloadBuffer(size: number): Uint8Array {
    const str = generatePayloadString(size);
    return new TextEncoder().encode(str);
}

export async function runStorageLifecycle(
    sizeValue: number,
    steps: StorageStepDefinitions,
    expectedData: { original: string; modified: string }
): Promise<BenchmarkResult> {
    const iterations = sizeValue <= 1024 ? 10 : (sizeValue <= 10240 ? 5 : 1);

    let total = { insert: 0, read: 0, update: 0, delete: 0 };
    let errors = { insert: 0, read: 0, update: 0, delete: 0 };

    for (let i = 0; i < iterations; i++) {
        try {
            // 1. Setup (if any)
            if (steps.setup) await steps.setup();

            // 2. Insert
            const startInsert = performance.now();
            await Promise.resolve(steps.insert());
            total.insert += performance.now() - startInsert;

            // 3. Read & Verify Original
            const startRead = performance.now();
            const readVal = await Promise.resolve(steps.read());
            total.read += performance.now() - startRead;
            if (readVal !== expectedData.original) errors.read++;

            // 4. Update
            const startUpdate = performance.now();
            await Promise.resolve(steps.update());
            total.update += performance.now() - startUpdate;

            // 5. Read & Verify Modified
            const readModVal = await Promise.resolve(steps.read());
            if (readModVal !== expectedData.modified) errors.update++;

            // 6. Delete
            const startDelete = performance.now();
            await Promise.resolve(steps.delete());
            total.delete += performance.now() - startDelete;

            // 7. Read & Verify Delete (Empty check)
            const readDelVal = await Promise.resolve(steps.read());
            // Success if null, undefined, "", or some storage specific empty sign
            const isEmpty = readDelVal === null || readDelVal === undefined || readDelVal === "" || (typeof readDelVal === 'object' && Object.keys(readDelVal as object).length === 0);
            if (!isEmpty) errors.delete++;

            // 8. Teardown (if any)
            if (steps.teardown) await steps.teardown();
        } catch (err) {
            console.error('Storage Lifecycle Error:', err);
            errors.insert++; // Mark iteration as failed
        }
    }

    return {
        insert: total.insert / iterations,
        read: total.read / iterations,
        update: total.update / iterations,
        delete: total.delete / iterations,
        errors,
        iterations
    };
}

export async function runCompressionLifecycle(
    sizeValue: number,
    steps: CompressionStepDefinitions,
    originalData: string
): Promise<CompressionResult> {
    const iterations = sizeValue <= 1024 ? 10 : (sizeValue <= 10240 ? 5 : 1);
    let totalCompress = 0;
    let totalDecompress = 0;
    let compSize = 0;
    let errors = 0;

    for (let i = 0; i < iterations; i++) {
        try {
            if (steps.setup) await steps.setup();

            const startTimeC = performance.now();
            const compressed = await Promise.resolve(steps.compress());
            totalCompress += performance.now() - startTimeC;
            compSize = compressed.length;

            const startTimeD = performance.now();
            const decompressed = await Promise.resolve(steps.decompress(compressed));
            totalDecompress += performance.now() - startTimeD;

            // Verify integrity
            let decompressedStr = decompressed;
            if (decompressed instanceof Uint8Array) {
                decompressedStr = new TextDecoder().decode(decompressed);
            }

            if (decompressedStr !== originalData) {
                errors++;
            }

            if (steps.teardown) await steps.teardown();
        } catch (err) {
            console.error('Compression Lifecycle Error:', err);
            errors++;
        }
    }

    return {
        compressTime: totalCompress / iterations,
        decompressTime: totalDecompress / iterations,
        ratio: sizeValue / (compSize || 1),
        compSize,
        valid: errors === 0,
        errors
    };
}

/** @deprecated */
export async function runTimed(sizeValue: number, fn: () => any | Promise<any>): Promise<number> {
    const iterations = sizeValue <= 1024 ? 10 : (sizeValue <= 10240 ? 5 : 1);
    let totalTime = 0;

    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const res = fn();
        if (res instanceof Promise) await res;
        totalTime += performance.now() - start;
    }
    return totalTime / iterations;
}

/** @deprecated */
export async function runTimedWithResult<T>(fn: () => T | Promise<T>): Promise<{ time: number, result: T }> {
    const start = performance.now();
    const result = await Promise.resolve(fn());
    const time = performance.now() - start;
    return { time, result };
}

/** @deprecated Use runTimed / runTimedWithResult */
export async function measureOperation(sizeValue: number, operation: () => Promise<number> | number): Promise<number> {
    const iterations = sizeValue <= 1024 ? 10 : (sizeValue <= 10240 ? 5 : 1);
    let totalTime = 0;
    for (let i = 0; i < iterations; i++) {
        try {
            const t = await operation();
            if (t < 0) return -1;
            totalTime += t;
        } catch (err) {
            console.error('Benchmark Op Error:', err);
            return -1;
        }
    }
    return totalTime / iterations;
}
