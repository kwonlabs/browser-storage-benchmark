import { allBenchmarks } from './index';
import type { BenchmarkUnit } from './types';

export type BenchmarkMetadata = Pick<BenchmarkUnit, 'id' | 'name' | 'description' | 'icon' | 'category' | 'url' | 'releaseYear' | 'developer' | 'specialization'>;

export interface BenchmarkCategory {
    icon: string;
    title: string;
    desc: string;
    categories: BenchmarkUnit['category'][];
}

export const categoryMetadata: BenchmarkCategory[] = [
    {
        icon: '⚡',
        title: 'Volatile Storage',
        desc: 'Synchronous storage APIs best suited for lightweight data and configuration, but typically restricted to &lt;10MB.',
        categories: ['low'],
    },
    {
        icon: '🗄️',
        title: 'Persistent Storage',
        desc: 'Built-in browser asynchronous APIs designed for large datasets, binary payloads, and offline capabilities. Storage limits are dynamically managed by the browser and vary by system, typically allowing for several gigabytes or up to 60% of available disk space.',
        categories: ['high-native'],
    },
    {
        icon: '📚',
        title: 'Storage Library',
        desc: 'Third-party wrappers and embedded databases that abstract native endpoints for enriched functionality. These services share the same storage quotas as the native persistent storage they utilize.',
        categories: ['high-wrapper'],
    },
    {
        icon: '🗜️',
        title: 'Compression Engines',
        desc: 'Algorithms used to reduce payload size before storage or transmission. This benchmark supports both native browser-level compression and advanced third-party libraries integrated via WebAssembly.',
        categories: ['compression'],
    },
];

// Derived from allBenchmarks — single source of truth
export const benchmarkMetadata = allBenchmarks.map(({ id, name, description, icon, category, url, releaseYear, developer, specialization }) => ({
    id, name, description, icon, category, url, releaseYear, developer, specialization,
}));
