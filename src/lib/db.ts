import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'BenchmarkDB';
const STORE_NAME = 'sessions';
const VERSION = 1;

export interface BenchmarkSession {
    id: number; // timestamp
    timestamp: string;
    data: any;
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

export async function saveSession(data: any): Promise<number> {
    const db = await getDB();
    const id = Date.now();
    const session: BenchmarkSession = {
        id,
        timestamp: new Date().toLocaleString(),
        data
    };
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
