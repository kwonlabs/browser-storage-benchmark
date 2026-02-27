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

export async function measureOperation(sizeValue: number, operation: () => Promise<number> | number): Promise<number> {
    // Determine iterations for micro-benchmarking based on size
    let iterations = 1;
    if (sizeValue <= 1024) iterations = 50; // <= 1KB
    else if (sizeValue <= 10240) iterations = 10; // <= 10KB
    else if (sizeValue <= 102400) iterations = 5; // <= 100KB

    let totalTime = 0;
    for (let i = 0; i < iterations; i++) {
        try {
            const t = await operation();
            if (t < 0) return -1; // Error occurred
            totalTime += t;
        } catch (err) {
            console.error('Benchmark Op Error:', err);
            return -1;
        }
    }
    return totalTime / iterations;
}
