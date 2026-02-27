// Library / Wrapper Worker
import localforage from 'localforage';
import Dexie from 'dexie';
// @ts-ignore
import PouchDB from 'pouchdb-browser';

self.onmessage = async (e) => {
    const { type, sizeName, payloadStr } = e.data;

    if (type === 'start_wrapper') {
        const results: Record<string, any> = {};

        // localForage
        try {
            localforage.config({ name: 'bench-lf' });
            await localforage.clear();
            const iStart = performance.now(); await localforage.setItem('k', payloadStr); const i = performance.now() - iStart;
            const rStart = performance.now(); await localforage.getItem('k'); const r = performance.now() - rStart;
            const uStart = performance.now(); await localforage.setItem('k', payloadStr + 'm'); const u = performance.now() - uStart;
            const dStart = performance.now(); await localforage.removeItem('k'); const d = performance.now() - dStart;
            results['localForage'] = { insert: i, read: r, update: u, delete: d };
        } catch (err) { results['localForage'] = { insert: -1, read: -1, update: -1, delete: -1 }; }

        // Dexie
        try {
            const db = new Dexie('bench-dexie');
            db.version(1).stores({ data: 'id' });
            await db.table('data').clear();
            const iStart = performance.now(); await db.table('data').add({ id: 'k', val: payloadStr }); const i = performance.now() - iStart;
            const rStart = performance.now(); await db.table('data').get('k'); const r = performance.now() - rStart;
            const uStart = performance.now(); await db.table('data').put({ id: 'k', val: payloadStr + 'm' }); const u = performance.now() - uStart;
            const dStart = performance.now(); await db.table('data').delete('k'); const d = performance.now() - dStart;
            results['Dexie'] = { insert: i, read: r, update: u, delete: d };
            db.close();
        } catch (err) { results['Dexie'] = { insert: -1, read: -1, update: -1, delete: -1 }; }

        // PouchDB
        try {
            const db = new PouchDB('bench-pouch');
            await db.destroy().catch(() => { });
            const pdb = new PouchDB('bench-pouch');
            const iStart = performance.now(); await pdb.put({ _id: 'k', val: payloadStr }); const i = performance.now() - iStart;
            const rStart = performance.now(); const doc: any = await pdb.get('k'); const r = performance.now() - rStart;
            const uStart = performance.now(); await pdb.put({ ...doc, val: payloadStr + 'm' }); const u = performance.now() - uStart;
            const dStart = performance.now(); const doc2: any = await pdb.get('k'); await pdb.remove(doc2); const d = performance.now() - dStart;
            results['PouchDB'] = { insert: i, read: r, update: u, delete: d };
        } catch (err) { results['PouchDB'] = { insert: -1, read: -1, update: -1, delete: -1 }; }

        // SQLite
        results['SQLite'] = { insert: -1, read: -1, update: -1, delete: -1 };

        self.postMessage({ type: 'done_wrapper', sizeName, payload: results });
    }
};
