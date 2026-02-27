import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { openDB, type IDBPDatabase } from 'idb';
import { zipSync, unzipSync } from 'fflate';
import brotliPromise from 'brotli-wasm';
import { init as initZstd, compress as zstdCompress, decompress as zstdDecompress } from '@bokuweb/zstd-wasm';

let isInit = false;
let brotli: any;
let sqlite3: any;
let sqliteDb: any;
let idbDb: IDBPDatabase;

const NUM_MD_ROWS = 1000;
const NUM_BLOB_ROWS = 100;

interface TestResult {
    insert: number;
    read: number;
    ratio?: number;
    update?: number;
    search?: number;
    searchFts?: number;
}

function generateBuffer(sizeBytes: number) {
    const arr = new Uint8Array(sizeBytes);
    for (let i = 0; i < sizeBytes; i++) {
        arr[i] = Math.floor(Math.random() * 256);
    }
    return arr.buffer;
}

// Re-usable initialization for Databases
async function initWorker() {
    if (isInit) return;
    self.postMessage({ type: 'log', message: 'Initializing Web Worker engines...' });

    await initZstd();
    brotli = await brotliPromise;
    if (!sqlite3) sqlite3 = await sqlite3InitModule();

    self.postMessage({ type: 'log', message: 'Setting up main databases...' });
    sqliteDb = new sqlite3.oo1.OpfsDb('/comprehensive_avg.sqlite3', 'c');
    sqliteDb.exec('CREATE TABLE IF NOT EXISTS docs (id TEXT PRIMARY KEY, title TEXT, content TEXT, updated_at INTEGER)');
    sqliteDb.exec('CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(id UNINDEXED, title, content)');
    sqliteDb.exec('CREATE TABLE IF NOT EXISTS blobs (id TEXT PRIMARY KEY, data BLOB)');

    idbDb = await openDB('comprehensive_avg_idb', 1, {
        upgrade(db) {
            db.createObjectStore('docs', { keyPath: 'id' });
            db.createObjectStore('blobs', { keyPath: 'id' });
        },
    });

    const root = await navigator.storage.getDirectory();
    try { await root.removeEntry('native_blobs', { recursive: true }); } catch (e) { }
    await root.getDirectoryHandle('native_blobs', { create: true });

    isInit = true;
    self.postMessage({ type: 'log', message: 'Engines online.' });
}

async function runAveragedScenario(
    name: string,
    setupFn: (() => Promise<void> | void) | null,
    testFn: () => Promise<void> | void,
    runs: number = 10
) {
    // Warmups
    const warmups = Math.min(3, Math.ceil(runs / 3)); // 1 warmup if runs=10, maybe less if runs is tiny, but let's stick to 3 if runs >= 10.
    for (let i = 0; i < warmups; i++) {
        self.postMessage({ type: 'log', message: `  [TEST] ${name} (Warmup ${i + 1}/${warmups})...` });
        if (setupFn) await setupFn();
        await testFn();
    }
    // Runs
    let totalTime = 0;
    for (let i = 0; i < runs; i++) {
        if (setupFn) await setupFn();
        const start = performance.now();
        await testFn();
        const duration = performance.now() - start;
        totalTime += duration;
        self.postMessage({ type: 'log', message: `  [TEST] ${name} (Run ${i + 1}/${runs})... ${duration.toFixed(2)}ms` });
    }
    const avg = totalTime / runs;
    self.postMessage({ type: 'log', message: `  => Average: ${avg.toFixed(2)}ms` });
    return avg;
}

self.onmessage = async (e) => {
    try {
        await initWorker();

        if (e.data.type === 'start_metadata') {
            const lsResult = e.data.lsResult;
            const testMdData = e.data.testMdData;

            const results: { metadata: { localStorage: TestResult, idb: Partial<TestResult>, sqlite: Partial<TestResult> } } = {
                metadata: { localStorage: lsResult, idb: {}, sqlite: {} }
            };

            self.postMessage({ type: 'log', message: `\n--- Starting Metadata Suite ---` });

            // 1A. IndexedDB
            results.metadata.idb.insert = await runAveragedScenario('IDB MD Insert', async () => {
                await idbDb.clear('docs');
            }, async () => {
                const tx = idbDb.transaction('docs', 'readwrite');
                for (const row of testMdData) { await tx.store.add(row); }
                await tx.done;
            });

            results.metadata.idb.read = await runAveragedScenario('IDB MD Read', null, async () => {
                const tx = idbDb.transaction('docs', 'readonly');
                for (let i = 0; i < NUM_MD_ROWS; i++) { await tx.store.get(`md_${i}`); }
            });

            results.metadata.idb.update = await runAveragedScenario('IDB MD Update', null, async () => {
                const tx = idbDb.transaction('docs', 'readwrite');
                for (let i = 0; i < NUM_MD_ROWS; i++) {
                    const doc = await tx.store.get(`md_${i}`);
                    if (doc) {
                        doc.content = `updated_${Math.random()}`;
                        await tx.store.put(doc);
                    }
                }
                await tx.done;
            });

            results.metadata.idb.search = await runAveragedScenario('IDB MD Search', null, async () => {
                const tx = idbDb.transaction('docs', 'readonly');
                let cursor = await tx.store.openCursor();
                let matchCount = 0;
                while (cursor) {
                    if (cursor.value.content.includes('specific_keyword_search_string')) { matchCount++; }
                    cursor = await cursor.continue();
                }
            });

            // 1B. SQLite
            results.metadata.sqlite.insert = await runAveragedScenario('SQLite MD Insert', () => {
                sqliteDb.exec('DELETE FROM docs; DELETE FROM docs_fts;');
            }, () => {
                sqliteDb.exec('BEGIN TRANSACTION;');
                const stmt = sqliteDb.prepare('INSERT INTO docs (id, title, content, updated_at) VALUES (?, ?, ?, ?)');
                const ftsStmt = sqliteDb.prepare('INSERT INTO docs_fts (id, title, content) VALUES (?, ?, ?)');
                for (const row of testMdData) {
                    stmt.bind([row.id, row.title, row.content, row.updatedAt]);
                    stmt.step(); stmt.reset();
                    ftsStmt.bind([row.id, row.title, row.content]);
                    ftsStmt.step(); ftsStmt.reset();
                }
                stmt.finalize(); ftsStmt.finalize();
                sqliteDb.exec('COMMIT;');
            });

            results.metadata.sqlite.read = await runAveragedScenario('SQLite MD Read', null, () => {
                sqliteDb.exec('BEGIN TRANSACTION;');
                const stmt = sqliteDb.prepare('SELECT * FROM docs WHERE id = ?');
                for (let i = 0; i < NUM_MD_ROWS; i++) {
                    stmt.bind([`md_${i}`]);
                    stmt.step(); stmt.get([]); stmt.reset();
                }
                stmt.finalize();
                sqliteDb.exec('COMMIT;');
            });

            results.metadata.sqlite.update = await runAveragedScenario('SQLite MD Update', null, () => {
                sqliteDb.exec('BEGIN TRANSACTION;');
                const stmt = sqliteDb.prepare('UPDATE docs SET content = ? WHERE id = ?');
                for (let i = 0; i < NUM_MD_ROWS; i++) {
                    stmt.bind([`updated_${Math.random()}`, `md_${i}`]);
                    stmt.step(); stmt.reset();
                }
                stmt.finalize();
                sqliteDb.exec('COMMIT;');
            });

            results.metadata.sqlite.search = await runAveragedScenario('SQLite Search (LIKE)', null, () => {
                sqliteDb.exec("SELECT id FROM docs WHERE content LIKE '%specific_keyword_search_string%'");
            });

            results.metadata.sqlite.searchFts = await runAveragedScenario('SQLite Search (FTS5)', null, () => {
                sqliteDb.exec("SELECT id FROM docs_fts WHERE docs_fts MATCH 'specific_keyword_search_string'");
            });

            self.postMessage({ type: 'done', payload: results });
        } else if (e.data.type === 'start_blob') {
            const results: { blob: { sqlite: Partial<TestResult>, opfs: Partial<TestResult>, idb: Partial<TestResult> } } = {
                blob: { sqlite: {}, opfs: {}, idb: {} }
            };

            const testBlobData = Array.from({ length: NUM_BLOB_ROWS }, (_, i) => ({
                id: `blob_${i}`,
                data: generateBuffer(512 * 1024)
            }));
            const dir = await navigator.storage.getDirectory().then(r => r.getDirectoryHandle('native_blobs'));

            // ==========================================
            // 2. BLOB SUITE
            // ==========================================
            self.postMessage({ type: 'log', message: `\n--- Starting Blob Suite ---` });

            // 2A. SQLite
            results.blob.sqlite.insert = await runAveragedScenario('SQLite Blob Insert', () => {
                sqliteDb.exec('DELETE FROM blobs;');
            }, () => {
                sqliteDb.exec('BEGIN TRANSACTION;');
                const stmt = sqliteDb.prepare('INSERT INTO blobs (id, data) VALUES (?, ?)');
                for (const row of testBlobData) {
                    stmt.bind([row.id, new Uint8Array(row.data)]);
                    stmt.step(); stmt.reset();
                }
                stmt.finalize();
                sqliteDb.exec('COMMIT;');
            });

            results.blob.sqlite.read = await runAveragedScenario('SQLite Blob Read', null, () => {
                sqliteDb.exec('BEGIN TRANSACTION;');
                const stmt = sqliteDb.prepare('SELECT data FROM blobs WHERE id = ?');
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    stmt.bind([`blob_${i}`]);
                    stmt.step(); stmt.get([]); stmt.reset();
                }
                stmt.finalize();
                sqliteDb.exec('COMMIT;');
            });

            // 2B. OPFS Native
            results.blob.opfs.insert = await runAveragedScenario('OPFS Native Blob Insert', null, async () => {
                for (const row of testBlobData) {
                    const fh = await dir.getFileHandle(row.id, { create: true });
                    const ah = await (fh as any).createSyncAccessHandle();
                    ah.write(new Uint8Array(row.data));
                    ah.flush();
                    ah.close();
                }
            });

            results.blob.opfs.read = await runAveragedScenario('OPFS Native Blob Read', null, async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    const fh = await dir.getFileHandle(`blob_${i}`);
                    const ah = await (fh as any).createSyncAccessHandle();
                    const buf = new Uint8Array(ah.getSize());
                    ah.read(buf, { at: 0 });
                    ah.close();
                }
            });

            // 2C. IndexedDB
            results.blob.idb.insert = await runAveragedScenario('IDB Blob Insert', async () => {
                await idbDb.clear('blobs');
            }, async () => {
                const tx = idbDb.transaction('blobs', 'readwrite');
                for (const row of testBlobData) { await tx.store.add({ id: row.id, data: row.data }); }
                await tx.done;
            });

            results.blob.idb.read = await runAveragedScenario('IDB Blob Read', null, async () => {
                const tx = idbDb.transaction('blobs', 'readonly');
                for (let i = 0; i < NUM_BLOB_ROWS; i++) { await tx.store.get(`blob_${i}`); }
            });

            self.postMessage({ type: 'done', payload: results });
        } else if (e.data.type === 'start_compression') {
            const results: {
                compressionIdb: Record<string, Partial<TestResult>>,
                compressionOpfs: Record<string, Partial<TestResult>>
            } = {
                compressionIdb: { none: {}, zip: {}, gzip: {}, deflate: {}, brotli: {}, zstd: {} },
                compressionOpfs: { none: {}, zip: {}, gzip: {}, deflate: {}, brotli: {}, zstd: {} }
            };

            const testBlobData = Array.from({ length: NUM_BLOB_ROWS }, (_, i) => ({
                id: `blob_${i}`,
                data: generateBuffer(512 * 1024)
            }));
            const dir = await navigator.storage.getDirectory().then(r => r.getDirectoryHandle('native_blobs'));

            // ==========================================
            // 3. COMPRESSION SUITE (IDB)
            // ==========================================
            self.postMessage({ type: 'log', message: `\n--- Starting Compression Suite (IDB) ---` });

            // 3A. None
            results.compressionIdb.none.insert = await runAveragedScenario('IDB None Compress + Insert', async () => {
                await idbDb.clear('blobs');
            }, async () => {
                const tx = idbDb.transaction('blobs', 'readwrite');
                for (const row of testBlobData) { await tx.store.add({ id: row.id, data: row.data }); }
                await tx.done;
            }, 10);
            results.compressionIdb.none.read = await runAveragedScenario('IDB None Read + Decompress', null, async () => {
                const tx = idbDb.transaction('blobs', 'readonly');
                for (let i = 0; i < NUM_BLOB_ROWS; i++) { await tx.store.get(`blob_${i}`); }
            }, 10);

            // 3B. ZIP (fflate)
            let zipSize = 0;
            results.compressionIdb.zip.insert = await runAveragedScenario('IDB ZIP Compress + Insert', async () => {
                await idbDb.clear('blobs');
            }, async () => {
                for (const row of testBlobData) {
                    const zipped = zipSync({ [row.id]: new Uint8Array(row.data) });
                    zipSize += zipped.byteLength;
                    await idbDb.put('blobs', { id: row.id, data: zipped.buffer });
                }
            }, 10);
            results.compressionIdb.zip.ratio = (testBlobData.length * 512 * 1024 * 10) / zipSize;

            results.compressionIdb.zip.read = await runAveragedScenario('IDB ZIP Read + Decompress', null, async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    const tx = idbDb.transaction('blobs', 'readonly');
                    const record = await tx.store.get(`blob_${i}`);
                    await tx.done;
                    if (record && record.data) {
                        unzipSync(new Uint8Array(record.data));
                    }
                }
            }, 10);

            // 3C. Gzip (Native)
            let gzSize = 0;
            results.compressionIdb.gzip.insert = await runAveragedScenario('IDB Gzip Compress + Insert', async () => {
                await idbDb.clear('blobs');
            }, async () => {
                for (const row of testBlobData) {
                    const cs = new CompressionStream('gzip');
                    const writer = cs.writable.getWriter();
                    const writePromise = writer.write(new Uint8Array(row.data)).then(() => writer.close());
                    const readPromise = new Response(cs.readable).arrayBuffer();
                    await writePromise;
                    const compressedBuf = await readPromise;
                    gzSize += compressedBuf.byteLength;
                    await idbDb.put('blobs', { id: row.id, data: compressedBuf });
                }
            }, 10);
            results.compressionIdb.gzip.ratio = (testBlobData.length * 512 * 1024 * 10) / gzSize;

            results.compressionIdb.gzip.read = await runAveragedScenario('IDB Gzip Read + Decompress', null, async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    const tx = idbDb.transaction('blobs', 'readonly');
                    const record = await tx.store.get(`blob_${i}`);
                    await tx.done;
                    if (record && record.data) {
                        const ds = new DecompressionStream('gzip');
                        const writer = ds.writable.getWriter();
                        const writePromise = writer.write(new Uint8Array(record.data)).then(() => writer.close());
                        const readPromise = new Response(ds.readable).arrayBuffer();
                        await Promise.all([writePromise, readPromise]);
                    }
                }
            }, 10);

            // 3D. Deflate (Native)
            let dfSize = 0;
            results.compressionIdb.deflate.insert = await runAveragedScenario('IDB Deflate Compress + Insert', async () => {
                await idbDb.clear('blobs');
            }, async () => {
                for (const row of testBlobData) {
                    const cs = new CompressionStream('deflate');
                    const writer = cs.writable.getWriter();
                    const writePromise = writer.write(new Uint8Array(row.data)).then(() => writer.close());
                    const readPromise = new Response(cs.readable).arrayBuffer();
                    await writePromise;
                    const compressedBuf = await readPromise;
                    dfSize += compressedBuf.byteLength;
                    await idbDb.put('blobs', { id: row.id, data: compressedBuf });
                }
            }, 10);
            results.compressionIdb.deflate.ratio = (testBlobData.length * 512 * 1024 * 10) / dfSize;

            results.compressionIdb.deflate.read = await runAveragedScenario('IDB Deflate Read + Decompress', null, async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    const tx = idbDb.transaction('blobs', 'readonly');
                    const record = await tx.store.get(`blob_${i}`);
                    await tx.done;
                    if (record && record.data) {
                        const ds = new DecompressionStream('deflate');
                        const writer = ds.writable.getWriter();
                        const writePromise = writer.write(new Uint8Array(record.data)).then(() => writer.close());
                        const readPromise = new Response(ds.readable).arrayBuffer();
                        await Promise.all([writePromise, readPromise]);
                    }
                }
            }, 10);

            // 3E. Brotli (brotli-wasm)
            let brSize = 0;
            results.compressionIdb.brotli.insert = await runAveragedScenario('IDB Brotli Compress + Insert', async () => {
                await idbDb.clear('blobs');
            }, async () => {
                for (const row of testBlobData) {
                    const compressed = brotli.compress(new Uint8Array(row.data));
                    brSize += compressed.byteLength;
                    await idbDb.put('blobs', { id: row.id, data: compressed.buffer });
                }
            }, 10);
            results.compressionIdb.brotli.ratio = (testBlobData.length * 512 * 1024 * 10) / brSize;

            results.compressionIdb.brotli.read = await runAveragedScenario('IDB Brotli Read + Decompress', null, async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    const tx = idbDb.transaction('blobs', 'readonly');
                    const record = await tx.store.get(`blob_${i}`);
                    await tx.done;
                    if (record && record.data) {
                        brotli.decompress(new Uint8Array(record.data));
                    }
                }
            }, 10);

            // 3F. Zstd (@bokuweb/zstd-wasm)
            let zsSize = 0;
            results.compressionIdb.zstd.insert = await runAveragedScenario('IDB Zstd Compress + Insert', async () => {
                await idbDb.clear('blobs');
            }, async () => {
                for (const row of testBlobData) {
                    const compressed = zstdCompress(new Uint8Array(row.data), 10);
                    zsSize += compressed.byteLength;
                    await idbDb.put('blobs', { id: row.id, data: compressed.buffer });
                }
            }, 10);
            results.compressionIdb.zstd.ratio = (testBlobData.length * 512 * 1024 * 10) / zsSize;

            results.compressionIdb.zstd.read = await runAveragedScenario('IDB Zstd Read + Decompress', null, async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    const tx = idbDb.transaction('blobs', 'readonly');
                    const record = await tx.store.get(`blob_${i}`);
                    await tx.done;
                    if (record && record.data) {
                        zstdDecompress(new Uint8Array(record.data));
                    }
                }
            }, 10);

            // ==========================================
            // 4. COMPRESSION SUITE (OPFS Native)
            // ==========================================
            self.postMessage({ type: 'log', message: `\n--- Starting Compression Suite (OPFS) ---` });

            // 4A. None
            results.compressionOpfs.none.insert = await runAveragedScenario('OPFS None Compress + Insert', async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    try { await dir.removeEntry(`blob_none_${i}`); } catch (e) { }
                }
            }, async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    const fh = await dir.getFileHandle(`blob_none_${i}`, { create: true });
                    const ah = await (fh as any).createSyncAccessHandle();
                    ah.write(new Uint8Array(testBlobData[i].data)); ah.flush(); ah.close();
                }
            }, 10);
            results.compressionOpfs.none.read = await runAveragedScenario('OPFS None Read + Decompress', null, async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    const fh = await dir.getFileHandle(`blob_none_${i}`);
                    const ah = await (fh as any).createSyncAccessHandle();
                    const buf = new Uint8Array(ah.getSize());
                    ah.read(buf, { at: 0 }); ah.close();
                }
            }, 10);

            // 4B. ZIP (fflate)
            let zipSizeOpfs = 0;
            results.compressionOpfs.zip.insert = await runAveragedScenario('OPFS ZIP Compress + Insert', async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    try { await dir.removeEntry(`blob_zip_${i}`); } catch (e) { }
                }
            }, async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    const zipped = zipSync({ [`blob_${i}`]: new Uint8Array(testBlobData[i].data) });
                    const fh = await dir.getFileHandle(`blob_zip_${i}`, { create: true });
                    const ah = await (fh as any).createSyncAccessHandle();
                    zipSizeOpfs += zipped.byteLength;
                    ah.write(zipped); ah.flush(); ah.close();
                }
            }, 10);
            results.compressionOpfs.zip.ratio = (testBlobData.length * 512 * 1024 * 10) / zipSizeOpfs;

            results.compressionOpfs.zip.read = await runAveragedScenario('OPFS ZIP Read + Decompress', null, async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    const fh = await dir.getFileHandle(`blob_zip_${i}`);
                    const ah = await (fh as any).createSyncAccessHandle();
                    const buf = new Uint8Array(ah.getSize());
                    ah.read(buf, { at: 0 }); ah.close();
                    unzipSync(buf);
                }
            }, 10);

            // 4C. Gzip (Native)
            let gzSizeOpfs = 0;
            results.compressionOpfs.gzip.insert = await runAveragedScenario('OPFS Gzip Compress + Insert', async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    try { await dir.removeEntry(`blob_gz_${i}`); } catch (e) { }
                }
            }, async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    const cs = new CompressionStream('gzip');
                    const writer = cs.writable.getWriter();
                    const writePromise = writer.write(new Uint8Array(testBlobData[i].data)).then(() => writer.close());
                    const readPromise = new Response(cs.readable).arrayBuffer();
                    await writePromise;
                    const compressedBuf = await readPromise;
                    const fh = await dir.getFileHandle(`blob_gz_${i}`, { create: true });
                    const ah = await (fh as any).createSyncAccessHandle();
                    gzSizeOpfs += compressedBuf.byteLength;
                    ah.write(new Uint8Array(compressedBuf)); ah.flush(); ah.close();
                }
            }, 10);
            results.compressionOpfs.gzip.ratio = (testBlobData.length * 512 * 1024 * 10) / gzSizeOpfs;

            results.compressionOpfs.gzip.read = await runAveragedScenario('OPFS Gzip Read + Decompress', null, async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    const fh = await dir.getFileHandle(`blob_gz_${i}`);
                    const ah = await (fh as any).createSyncAccessHandle();
                    const buf = new Uint8Array(ah.getSize());
                    ah.read(buf, { at: 0 }); ah.close();

                    const ds = new DecompressionStream('gzip');
                    const writer = ds.writable.getWriter();
                    const writePromise = writer.write(buf).then(() => writer.close());
                    const readPromise = new Response(ds.readable).arrayBuffer();
                    await Promise.all([writePromise, readPromise]);
                }
            }, 10);

            // 4D. Deflate (Native)
            let dfSizeOpfs = 0;
            results.compressionOpfs.deflate.insert = await runAveragedScenario('OPFS Deflate Compress + Insert', async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    try { await dir.removeEntry(`blob_df_${i}`); } catch (e) { }
                }
            }, async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    const cs = new CompressionStream('deflate');
                    const writer = cs.writable.getWriter();
                    const writePromise = writer.write(new Uint8Array(testBlobData[i].data)).then(() => writer.close());
                    const readPromise = new Response(cs.readable).arrayBuffer();
                    await writePromise;
                    const compressedBuf = await readPromise;
                    const fh = await dir.getFileHandle(`blob_df_${i}`, { create: true });
                    const ah = await (fh as any).createSyncAccessHandle();
                    dfSizeOpfs += compressedBuf.byteLength;
                    ah.write(new Uint8Array(compressedBuf)); ah.flush(); ah.close();
                }
            }, 10);
            results.compressionOpfs.deflate.ratio = (testBlobData.length * 512 * 1024 * 10) / dfSizeOpfs;

            results.compressionOpfs.deflate.read = await runAveragedScenario('OPFS Deflate Read + Decompress', null, async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    const fh = await dir.getFileHandle(`blob_df_${i}`);
                    const ah = await (fh as any).createSyncAccessHandle();
                    const buf = new Uint8Array(ah.getSize());
                    ah.read(buf, { at: 0 }); ah.close();

                    const ds = new DecompressionStream('deflate');
                    const writer = ds.writable.getWriter();
                    const writePromise = writer.write(buf).then(() => writer.close());
                    const readPromise = new Response(ds.readable).arrayBuffer();
                    await Promise.all([writePromise, readPromise]);
                }
            }, 10);

            // 4E. Brotli (brotli-wasm)
            let brSizeOpfs = 0;
            results.compressionOpfs.brotli.insert = await runAveragedScenario('OPFS Brotli Compress + Insert', async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    try { await dir.removeEntry(`blob_br_${i}`); } catch (e) { }
                }
            }, async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    const compressed = brotli.compress(new Uint8Array(testBlobData[i].data));
                    const fh = await dir.getFileHandle(`blob_br_${i}`, { create: true });
                    const ah = await (fh as any).createSyncAccessHandle();
                    brSizeOpfs += compressed.byteLength;
                    ah.write(new Uint8Array(compressed.buffer)); ah.flush(); ah.close();
                }
            }, 10);
            results.compressionOpfs.brotli.ratio = (testBlobData.length * 512 * 1024 * 10) / brSizeOpfs;

            results.compressionOpfs.brotli.read = await runAveragedScenario('OPFS Brotli Read + Decompress', null, async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    const fh = await dir.getFileHandle(`blob_br_${i}`);
                    const ah = await (fh as any).createSyncAccessHandle();
                    const buf = new Uint8Array(ah.getSize());
                    ah.read(buf, { at: 0 }); ah.close();
                    brotli.decompress(buf);
                }
            }, 10);

            // 4F. Zstd (@bokuweb/zstd-wasm)
            let zsSizeOpfs = 0;
            results.compressionOpfs.zstd.insert = await runAveragedScenario('OPFS Zstd Compress + Insert', async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    try { await dir.removeEntry(`blob_zs_${i}`); } catch (e) { }
                }
            }, async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    const compressed = zstdCompress(new Uint8Array(testBlobData[i].data), 10);
                    const fh = await dir.getFileHandle(`blob_zs_${i}`, { create: true });
                    const ah = await (fh as any).createSyncAccessHandle();
                    zsSizeOpfs += compressed.byteLength;
                    ah.write(new Uint8Array(compressed.buffer)); ah.flush(); ah.close();
                }
            }, 10);
            results.compressionOpfs.zstd.ratio = (testBlobData.length * 512 * 1024 * 10) / zsSizeOpfs;

            results.compressionOpfs.zstd.read = await runAveragedScenario('OPFS Zstd Read + Decompress', null, async () => {
                for (let i = 0; i < NUM_BLOB_ROWS; i++) {
                    const fh = await dir.getFileHandle(`blob_zs_${i}`);
                    const ah = await (fh as any).createSyncAccessHandle();
                    const buf = new Uint8Array(ah.getSize());
                    ah.read(buf, { at: 0 }); ah.close();
                    zstdDecompress(buf);
                }
            }, 10);

            self.postMessage({ type: 'done', payload: results });
        } else if (e.data.type === 'start_payload') {
            const { sizeLabel, sizeBytes, webStorageRes } = e.data;
            const payloadBuffer = generateBuffer(sizeBytes);
            const payloadBlob = new Blob([payloadBuffer], { type: 'application/octet-stream' });

            const Dexie = (await import('dexie')).Dexie;
            const localforage = (await import('localforage')).default;

            const dexieDb = new Dexie('payload_dexie');
            dexieDb.version(1).stores({ data: 'id' });
            localforage.config({ name: 'payload_lf', storeName: 'data' });

            const results: any = {
                payload: {
                    native: { [sizeLabel]: {} },
                    wrapper: { [sizeLabel]: {} }
                }
            };
            results.payload.native[sizeLabel].sessionStorage = webStorageRes.sessionStorage;
            results.payload.native[sizeLabel].localStorage = webStorageRes.localStorage;

            self.postMessage({ type: 'log', message: `\n--- Starting Payload Suite (${sizeLabel}) ---` });

            results.payload.native[sizeLabel].idb = {
                insert: await runAveragedScenario(`IDB Insert (${sizeLabel})`, async () => { await idbDb.clear('blobs'); }, async () => {
                    const tx = idbDb.transaction('blobs', 'readwrite');
                    await tx.store.add({ id: 'payload_item', data: payloadBuffer });
                    await tx.done;
                }),
                read: await runAveragedScenario(`IDB Read (${sizeLabel})`, null, async () => {
                    await idbDb.transaction('blobs', 'readonly').store.get('payload_item');
                })
            };

            const dir = await navigator.storage.getDirectory().then(r => r.getDirectoryHandle('native_blobs'));
            results.payload.native[sizeLabel].opfs = {
                insert: await runAveragedScenario(`OPFS Insert (${sizeLabel})`, async () => { try { await dir.removeEntry('payload_item'); } catch { } }, async () => {
                    const fh = await dir.getFileHandle('payload_item', { create: true });
                    const ah = await (fh as any).createSyncAccessHandle();
                    ah.write(new Uint8Array(payloadBuffer)); ah.flush(); ah.close();
                }),
                read: await runAveragedScenario(`OPFS Read (${sizeLabel})`, null, async () => {
                    const fh = await dir.getFileHandle('payload_item');
                    const ah = await (fh as any).createSyncAccessHandle();
                    const buf = new Uint8Array(ah.getSize());
                    ah.read(buf, { at: 0 }); ah.close();
                })
            };

            const cache = await caches.open('payload_cache');
            results.payload.native[sizeLabel].cache = {
                insert: await runAveragedScenario(`Cache API Insert (${sizeLabel})`, async () => { await caches.delete('payload_cache'); }, async () => {
                    await cache.put('/payload', new Response(payloadBlob));
                }),
                read: await runAveragedScenario(`Cache API Read (${sizeLabel})`, null, async () => {
                    const res = await cache.match('/payload');
                    if (res) await res.arrayBuffer();
                })
            };

            results.payload.wrapper[sizeLabel].dexie = {
                insert: await runAveragedScenario(`Dexie.js Insert (${sizeLabel})`, async () => { await dexieDb.table('data').clear(); }, async () => {
                    await dexieDb.table('data').add({ id: 'payload_item', value: payloadBuffer });
                }),
                read: await runAveragedScenario(`Dexie.js Read (${sizeLabel})`, null, async () => {
                    await dexieDb.table('data').get('payload_item');
                })
            };

            results.payload.wrapper[sizeLabel].localForage = {
                insert: await runAveragedScenario(`localForage Insert (${sizeLabel})`, async () => { await localforage.clear(); }, async () => {
                    await localforage.setItem('payload_item', payloadBuffer);
                }),
                read: await runAveragedScenario(`localForage Read (${sizeLabel})`, null, async () => {
                    await localforage.getItem('payload_item');
                })
            };

            self.postMessage({ type: 'done', payload: results });
        }
    } catch (err: any) {
        self.postMessage({ type: 'error', message: err.message + '\n' + err.stack });
    }
};
