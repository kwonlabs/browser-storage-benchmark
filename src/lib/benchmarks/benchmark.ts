export function generatePayloadString(size: number): string {
    const pattern = 'WebBenchmarkPayload_';
    const repeatCount = Math.floor(size / pattern.length);
    return pattern.repeat(repeatCount) + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.substring(0, size % pattern.length);
}

export function generatePayloadBuffer(size: number): Uint8Array {
    const str = generatePayloadString(size);
    return new TextEncoder().encode(str);
}

export async function yieldToMain() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

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
