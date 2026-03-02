import type { BenchmarkData } from "./types";

import type { LogEntry } from "../../stores/benchmark.svelte";

export interface BenchmarkSession {
  id: number; // Timestamp based unique ID
  sessionId: string; // Displayable ID (e.g. #ABCD)
  userAgent: string;
  os?: string | undefined;
  browser?: string | undefined;
  date: string;
  data: BenchmarkData;
  logs: LogEntry[];
  type: "storage" | "compression";
}

const DB_NAME = "BenchmarkDB";
const DB_VERSION = 2; // Increment version for new stores
const STORE_STORAGE = "storage-sessions";
const STORE_COMPRESSION = "compression-sessions";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // Create storage store
      if (!db.objectStoreNames.contains(STORE_STORAGE)) {
        db.createObjectStore(STORE_STORAGE, { keyPath: "id" });
      }
      // Create compression store
      if (!db.objectStoreNames.contains(STORE_COMPRESSION)) {
        db.createObjectStore(STORE_COMPRESSION, { keyPath: "id" });
      }
      // Migration for version 1 if necessary (omitted for brevity, assume fresh start or clean upgrade)
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getStoreName(type: "storage" | "compression") {
  return type === "storage" ? STORE_STORAGE : STORE_COMPRESSION;
}

export async function saveSession(
  type: "storage" | "compression",
  data: BenchmarkData,
  logs: LogEntry[] = [],
  metadata: { os?: string; browser?: string } = {}
): Promise<number> {
  const db = await openDB();
  const id = Date.now();
  const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const userAgent = navigator.userAgent;
  const date = new Date().toISOString();

  return new Promise((resolve, reject) => {
    const storeName = getStoreName(type);
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);

    const sanitizedData = JSON.parse(JSON.stringify(data));
    const sanitizedLogs = JSON.parse(JSON.stringify(logs));
    const session: BenchmarkSession = {
      id,
      sessionId,
      userAgent,
      os: metadata.os,
      browser: metadata.browser,
      date,
      data: sanitizedData,
      logs: sanitizedLogs,
      type,
    };

    const request = store.add(session);
    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllSessions(
  type: "storage" | "compression"
): Promise<BenchmarkSession[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const storeName = getStoreName(type);
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result as BenchmarkSession[];
      resolve(results.sort((a, b) => b.id - a.id));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getSession(
  type: "storage" | "compression",
  id: number
): Promise<BenchmarkSession | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const storeName = getStoreName(type);
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSession(
  type: "storage" | "compression",
  id: number
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const storeName = getStoreName(type);
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllSessions(
  type: "storage" | "compression"
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const storeName = getStoreName(type);
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
