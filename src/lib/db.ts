import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'BenchmarkDB';
const STORE_NAME = 'sessions';
const VERSION = 1;

import type { BenchmarkData, EnvironmentMetadata } from './benchmarks/types';

export interface BenchmarkSession {
    id: number; // timestamp
    timestamp: string;
    data: BenchmarkData;
    env?: EnvironmentMetadata;
}

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

function getDB() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            },
        });
    }
    return dbPromise;
}

export async function saveSession(data: BenchmarkData): Promise<number> {
    const db = await getDB();
    const id = Date.now();

    const env: EnvironmentMetadata = {
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency || -1,
        deviceMemory: (navigator as any).deviceMemory,
        platform: navigator.platform || ''
    };

    const ts = new Date().toLocaleString('en-US', { hour12: false });
    const session: BenchmarkSession = { id, timestamp: ts, data, env };

    await db.put(STORE_NAME, session);
    return id;
}

export async function getAllSessions(): Promise<BenchmarkSession[]> {
    const db = await getDB();
    const sessions = await db.getAll(STORE_NAME);
    return sessions.sort((a, b) => b.id - a.id);
}

export async function getLatestSession(): Promise<BenchmarkSession | undefined> {
    const sessions = await getAllSessions();
    return sessions[0];
}

export async function deleteSession(id: number): Promise<void> {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
}

export async function clearAllSessions(): Promise<void> {
    const db = await getDB();
    await db.clear(STORE_NAME);
}
