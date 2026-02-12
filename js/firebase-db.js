/**
 * Firebase backend for PHO Document Archive (Firestore + Storage + Auth)
 * Replaces PHODB when firebaseConfig is valid. Uses same API as js/db.js.
 */
(function () {
  if (typeof firebaseConfig === 'undefined' || !firebaseConfig.projectId || firebaseConfig.projectId === 'YOUR_PROJECT_ID') {
    return;
  }
  try {
    if (typeof firebase === 'undefined') {
      console.error('Firebase SDK not loaded. Check script order and network.');
      return;
    }
  } catch (e) {
    console.error('Firebase init check failed', e);
    return;
  }

  var app, auth, db, storage;
  try {
    app = firebase.initializeApp(firebaseConfig);
    auth = app.auth();
    db = app.firestore();
    storage = app.storage();
  } catch (e) {
    console.error('Firebase initializeApp failed', e);
    return;
  }

  const COL_FOLDERS = 'folders';
  const COL_DOCUMENTS = 'documents';
  const COL_HISTORY = 'history';
  const COL_USERS = 'users';
  const STORAGE_FILES = 'files';

  function toPlain(o) {
    if (o && typeof o.toDate === 'function') return o.toDate().toISOString();
    if (Array.isArray(o)) return o.map(toPlain);
    if (o && typeof o === 'object') {
      const out = {};
      for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) out[k] = toPlain(o[k]);
      return out;
    }
    return o;
  }

  function stripUndefined(obj) {
    const out = {};
    for (const k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      const v = obj[k];
      if (v === undefined) continue;
      out[k] = (v && typeof v === 'object' && !(v instanceof Blob) && !(v instanceof File)) ? stripUndefined(v) : v;
    }
    return out;
  }

  async function dbGetFolders() {
    const snap = await db.collection(COL_FOLDERS).get();
    return snap.docs.map(function (d) {
      const data = d.data();
      return toPlain({ id: d.id, ...data });
    });
  }

  async function dbSaveFolder(folder) {
    const id = folder.id || db.collection(COL_FOLDERS).doc().id;
    await db.collection(COL_FOLDERS).doc(id).set(stripUndefined({ ...folder, id }));
  }

  async function dbDeleteFolder(id) {
    await db.collection(COL_FOLDERS).doc(id).delete();
  }

  async function dbGetDocuments() {
    const snap = await db.collection(COL_DOCUMENTS).get();
    return snap.docs.map(function (d) {
      return toPlain({ id: d.id, ...d.data() });
    });
  }

  async function dbSaveDocument(doc) {
    const id = doc.id;
    await db.collection(COL_DOCUMENTS).doc(id).set(stripUndefined(doc));
  }

  async function dbGetDocument(id) {
    const snap = await db.collection(COL_DOCUMENTS).doc(id).get();
    if (!snap.exists) return null;
    return toPlain({ id: snap.id, ...snap.data() });
  }

  async function dbDeleteDocument(id) {
    await db.collection(COL_DOCUMENTS).doc(id).delete();
    try {
      await storage.ref(STORAGE_FILES + '/' + id).delete();
    } catch (_) {}
  }

  async function dbSaveBlob(id, blob) {
    const ref = storage.ref(STORAGE_FILES + '/' + id);
    await ref.put(blob);
  }

  async function dbGetBlob(id) {
    try {
      const ref = storage.ref(STORAGE_FILES + '/' + id);
      const url = await ref.getDownloadURL();
      const res = await fetch(url);
      return await res.blob();
    } catch (_) {
      return null;
    }
  }

  async function dbAddHistory(entry) {
    const id = entry.id || 'h-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    const record = {
      id,
      type: entry.type,
      documentId: entry.documentId || null,
      documentName: entry.documentName || null,
      folderName: entry.folderName || null,
      size: entry.size != null ? entry.size : null,
      timestamp: entry.timestamp || new Date().toISOString()
    };
    await db.collection(COL_HISTORY).doc(id).set(record);
  }

  async function dbGetHistory() {
    const snap = await db.collection(COL_HISTORY).get();
    const list = snap.docs.map(function (d) {
      return toPlain({ id: d.id, ...d.data() });
    });
    list.sort(function (a, b) {
      return (b.timestamp || '').localeCompare(a.timestamp || '');
    });
    return list;
  }

  async function dbClearHistory() {
    const snap = await db.collection(COL_HISTORY).get();
    const batch = db.batch();
    snap.docs.forEach(function (d) { batch.delete(d.ref); });
    await batch.commit();
  }

  async function dbDeleteHistoryByDocumentId(documentId) {
    const snap = await db.collection(COL_HISTORY).where('documentId', '==', documentId).get();
    const batch = db.batch();
    snap.docs.forEach(function (d) { batch.delete(d.ref); });
    await batch.commit();
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

  async function getUserRole(uid) {
    const snap = await db.collection(COL_USERS).doc(uid).get();
    const data = snap.exists ? snap.data() : null;
    return (data && data.role === 'admin') ? 'admin' : 'staff';
  }

  async function setUserRole(uid, email, role) {
    await db.collection(COL_USERS).doc(uid).set({ email: email || '', role: role || 'staff' });
  }

  function signInWithGoogle() {
    var provider = new firebase.auth.GoogleAuthProvider();
    return auth.signInWithPopup(provider).catch(function (err) {
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
        auth.signInWithRedirect(provider);
        return new Promise(function () {});
      }
      throw err;
    });
  }

  function getRedirectResult() {
    return auth.getRedirectResult();
  }

  window.FirebaseAuth = {
    auth: auth,
    signInWithGoogle: signInWithGoogle,
    getRedirectResult: getRedirectResult,
    signIn: function (email, password) {
      return auth.signInWithEmailAndPassword(email, password);
    },
    signUp: function (email, password) {
      return auth.createUserWithEmailAndPassword(email, password);
    },
    signOut: function () {
      return auth.signOut();
    },
    onAuthStateChanged: function (cb) {
      return auth.onAuthStateChanged(cb);
    },
    getCurrentUser: function () {
      return auth.currentUser;
    },
    getUserRole: getUserRole,
    setUserRole: setUserRole
  };
})();
