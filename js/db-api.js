/**
 * MySQL backend for PHO Document Archive (via PHP API).
 * Replaces Firebase/IndexedDB when using MySQL. Same PHODB interface.
 */
(function () {
  var API = 'api/db.php';

  function post(data) {
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) {
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    });
  }

  function postFormData(formData) {
    return fetch(API, {
      method: 'POST',
      body: formData
    }).then(function (r) {
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    });
  }

  function checkError(data) {
    if (data && data.error) throw new Error(data.error);
    return data;
  }

  async function dbGetFolders() {
    var data = await post({ action: 'getFolders' });
    checkError(data);
    return Array.isArray(data) ? data : [];
  }

  async function dbSaveFolder(folder) {
    var data = await post({ action: 'saveFolder', folder: folder });
    checkError(data);
  }

  async function dbDeleteFolder(id) {
    var data = await post({ action: 'deleteFolder', id: id });
    checkError(data);
  }

  async function dbGetDocuments() {
    var data = await post({ action: 'getDocuments' });
    checkError(data);
    return Array.isArray(data) ? data : [];
  }

  async function dbGetDocument(id) {
    var data = await post({ action: 'getDocument', id: id });
    checkError(data);
    return data;
  }

  async function dbSaveDocument(doc) {
    var data = await post({ action: 'saveDocument', document: doc });
    checkError(data);
  }

  async function dbDeleteDocument(id) {
    var data = await post({ action: 'deleteDocument', id: id });
    checkError(data);
  }

  async function dbSaveBlob(id, blob) {
    var form = new FormData();
    form.append('action', 'saveBlob');
    form.append('id', id);
    form.append('file', blob instanceof File ? blob : new File([blob], 'file', { type: blob.type || 'application/octet-stream' }));
    var data = await postFormData(form);
    checkError(data);
  }

  async function dbGetBlob(id) {
    var url = API + '?action=getBlob&id=' + encodeURIComponent(id);
    var r = await fetch(url);
    if (!r.ok) return null;
    return await r.blob();
  }

  async function dbAddHistory(entry) {
    var payload = {
      action: 'addHistory',
      entry: {
        id: entry.id || 'h-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9),
        type: entry.type || null,
        documentId: entry.documentId || null,
        documentName: entry.documentName || null,
        folderName: entry.folderName || null,
        size: entry.size != null ? entry.size : null,
        timestamp: entry.timestamp || new Date().toISOString()
      }
    };
    var data = await post(payload);
    checkError(data);
  }

  async function dbGetHistory() {
    var data = await post({ action: 'getHistory' });
    checkError(data);
    return Array.isArray(data) ? data : [];
  }

  async function dbClearHistory() {
    var data = await post({ action: 'clearHistory' });
    checkError(data);
  }

  async function dbDeleteHistoryByDocumentId(documentId) {
    var data = await post({ action: 'deleteHistoryByDocumentId', documentId: documentId });
    checkError(data);
  }

  async function dbSaveUser(user) {
    var data = await post({ action: 'saveUser', user: user });
    checkError(data);
  }

  async function dbGetUsers() {
    var data = await post({ action: 'getUsers' });
    checkError(data);
    return Array.isArray(data) ? data : [];
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
    deleteHistoryByDocumentId: dbDeleteHistoryByDocumentId,
    saveUser: dbSaveUser,
    getUsers: dbGetUsers
  };
})();
