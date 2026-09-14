// Couche de stockage — IndexedDB, neuf collections (docs/decisions.md « Modèle de données arrêté »).
// Un livret est une position de type espèces en euros, au même titre qu'une ligne d'ETF : même moteur.

const DB_NAME = 'patrimoine';
const DB_VERSION = 1;

const STORES = {
  comptes: { keyPath: 'id', indexes: [] },
  actifs: { keyPath: 'id', indexes: [] },
  positions: { keyPath: 'id', indexes: [['compteId', 'compteId', false]] },
  operations: { keyPath: 'id', indexes: [['positionId', 'positionId', false], ['date', 'date', false]] },
  valorisations: { keyPath: 'id', indexes: [['positionId', 'positionId', false], ['date', 'date', false]] },
  cours: { keyPath: 'id', indexes: [] },
  changes: { keyPath: 'id', indexes: [] },
  dettes: { keyPath: 'id', indexes: [] },
  strategie: { keyPath: 'id', indexes: [] },
  reglages: { keyPath: 'id', indexes: [] },
};

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, def] of Object.entries(STORES)) {
        if (db.objectStoreNames.contains(name)) continue;
        const os = db.createObjectStore(name, { keyPath: def.keyPath });
        for (const [idxName, idxKey, unique] of def.indexes) {
          os.createIndex(idxName, idxKey, { unique });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode) {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

export function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export async function getAll(store) {
  const os = await tx(store, 'readonly');
  return new Promise((resolve, reject) => {
    const req = os.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getByIndex(store, indexName, value) {
  const os = await tx(store, 'readonly');
  return new Promise((resolve, reject) => {
    const req = os.index(indexName).getAll(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function get(store, id) {
  const os = await tx(store, 'readonly');
  return new Promise((resolve, reject) => {
    const req = os.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function put(store, obj) {
  const os = await tx(store, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = os.put(obj);
    req.onsuccess = () => resolve(obj);
    req.onerror = () => reject(req.error);
  });
}

export async function del(store, id) {
  const os = await tx(store, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = os.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function ensureReglages() {
  const existing = await get('reglages', 'main');
  if (existing) return existing;
  const initial = {
    id: 'main',
    devisePrincipale: 'EUR',
    dateInstallation: new Date().toISOString().slice(0, 10),
  };
  await put('reglages', initial);
  return initial;
}

export async function exportAll() {
  const dump = {};
  for (const name of Object.keys(STORES)) {
    dump[name] = await getAll(name);
  }
  return { app: 'patrimoine', version: DB_VERSION, exporteLe: new Date().toISOString(), donnees: dump };
}

export async function importAll(payload) {
  if (!payload || typeof payload !== 'object' || !payload.donnees) {
    throw new Error("Fichier non reconnu : structure inattendue.");
  }
  const db = await openDB();
  for (const name of Object.keys(STORES)) {
    const rows = payload.donnees[name];
    if (!Array.isArray(rows)) continue;
    await new Promise((resolve, reject) => {
      const t = db.transaction(name, 'readwrite');
      const os = t.objectStore(name);
      os.clear();
      for (const row of rows) os.put(row);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }
}

export const STORE_NAMES = Object.keys(STORES);
