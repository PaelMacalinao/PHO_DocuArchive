/**
 * IndexedDB helper for PHO Document Archive (no Node.js – runs in browser only)
 */
const DB_NAME = 'PHO_DocuArchive';
const DB_VERSION = 2;
const STORE_FOLDERS = 'folders';
const STORE_DOCUMENTS = 'documents';
const STORE_BLOBS = 'blobs';
const STORE_HISTORY = 'history';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_FOLDERS)) {
        db.createObjectStore(STORE_FOLDERS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_DOCUMENTS)) {
        db.createObjectStore(STORE_DOCUMENTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        db.createObjectStore(STORE_HISTORY, { keyPath: 'id' });
      }
    };
  });
}

async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function put(storeName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function get(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(id);
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function remove(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(id);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

// Folders
async function dbGetFolders() {
  return getAll(STORE_FOLDERS);
}

async function dbSaveFolder(folder) {
  return put(STORE_FOLDERS, folder);
}

async function dbDeleteFolder(id) {
  return remove(STORE_FOLDERS, id);
}

// Documents (metadata only in documents store)
async function dbGetDocuments() {
  return getAll(STORE_DOCUMENTS);
}

async function dbSaveDocument(doc) {
  return put(STORE_DOCUMENTS, doc);
}

async function dbGetDocument(id) {
  return get(STORE_DOCUMENTS, id);
}

async function dbDeleteDocument(id) {
  await remove(STORE_DOCUMENTS, id);
  await remove(STORE_BLOBS, id);
}

// File blobs (key = document id)
async function dbSaveBlob(id, blob) {
  return put(STORE_BLOBS, { id, blob });
}

async function dbGetBlob(id) {
  const row = await get(STORE_BLOBS, id);
  if (!row || row.blob == null) return null;
  const b = row.blob;
  if (!(b instanceof Blob)) return null;
  // Some browsers need a fresh Blob from IndexedDB data for createObjectURL to work
  try {
    return b.slice(0, b.size, b.type || 'application/octet-stream');
  } catch (_) {
    return new Blob([b], { type: b.type || 'application/octet-stream' });
  }
}

// Activity history (upload, view, download, delete)
async function dbAddHistory(entry) {
  const record = {
    id: entry.id || 'h-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9),
    type: entry.type,
    documentId: entry.documentId || null,
    documentName: entry.documentName || null,
    folderName: entry.folderName || null,
    size: entry.size != null ? entry.size : null,
    timestamp: entry.timestamp || new Date().toISOString()
  };
  return put(STORE_HISTORY, record);
}

async function dbGetHistory() {
  const list = await getAll(STORE_HISTORY);
  return list.sort(function (a, b) {
    return (b.timestamp || '').localeCompare(a.timestamp || '');
  });
}

async function dbClearHistory() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_HISTORY, 'readwrite');
    const store = tx.objectStore(STORE_HISTORY);
    const req = store.clear();
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function dbDeleteHistoryByDocumentId(documentId) {
  const list = await getAll(STORE_HISTORY);
  const toDelete = list.filter(function (h) { return h.documentId === documentId; });
  if (!toDelete.length) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_HISTORY, 'readwrite');
    const store = tx.objectStore(STORE_HISTORY);
    toDelete.forEach(function (h) { store.delete(h.id); });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

window.PHODB = {
  getFolders: dbGetFolders,
  saveFolder: dbSaveFolder,
  deleteFolder: dbDeleteFolder,
  getDocuments: dbGetDocuments,
  saveDocument: dbSaveDocument,
  getDocument: dbGetDocument,
  deleteDocument: dbDeleteDocument,
  saveBlob: dbSaveBlob,
  getBlob: dbGetBlob,
  addHistory: dbAddHistory,
  getHistory: dbGetHistory,
  clearHistory: dbClearHistory,
  deleteHistoryByDocumentId: dbDeleteHistoryByDocumentId
};
