import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';
import { generatePayloadString } from '../../benchmark';

export const cookieBenchmark: BenchmarkUnit = {
    id: 'cookie',
    name: 'Cookie',
    description: 'Traditional browser cookies. Very limited size (4KB) and can impact network performance as they are sent with every request.',
    icon: '🍪',
    category: 'low',
    runType: 'main.sync',
    run: (sizeName: string, sizeValue: number): StorageStepDefinitions => {
        const key = `bench_k_${sizeName}`;
        const str = generatePayloadString(sizeValue);
        const modStr = str + 'm';

        return {
            insert: () => {
                if (sizeValue > 4000) throw new Error('Cookie size limit exceeded (>4KB)');
                document.cookie = `${key}=${str};path=/;max-age=60`;
            },
            read: () => { void document.cookie; },
            update: () => {
                if (sizeValue > 4000) throw new Error('Cookie size limit exceeded (>4KB)');
                document.cookie = `${key}=${modStr};path=/;max-age=60`;
            },
            delete: () => { document.cookie = `${key}=;path=/;max-age=0`; }
        };
    }
};
