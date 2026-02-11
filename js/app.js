(function () {
  const db = window.PHODB;
  if (!db) {
    console.error('PHODB not loaded. Ensure js/db.js is included before app.js.');
    return;
  }

  let currentFolderId = '';
  let folders = [];
  let documents = [];

  const el = {
    folderTreeList: document.getElementById('folderTreeList'),
    folderTree: document.getElementById('folderTree'),
    breadcrumb: document.getElementById('breadcrumb'),
    docTableBody: document.getElementById('docTableBody'),
    searchInput: document.getElementById('searchInput'),
    fileInput: document.getElementById('fileInput'),
    uploadZone: document.getElementById('uploadZone'),
    refreshBtn: document.getElementById('refreshBtn'),
    newFolderBtn: document.getElementById('newFolderBtn'),
    folderModal: document.getElementById('folderModal'),
    folderForm: document.getElementById('folderForm'),
    folderId: document.getElementById('folderId'),
    folderName: document.getElementById('folderName'),
    toast: document.getElementById('toast')
  };

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function buildTree(parentId, depth) {
    depth = depth || 0;
    const children = folders.filter(f => (f.parentId || '') === (parentId || ''));
    if (!children.length) return '';
    return children.map(f => {
      const sub = buildTree(f.id, depth + 1);
      return `
        <div class="folder-item" data-id="${f.id}" data-depth="${depth}">
          <button type="button" class="folder-link" data-id="${f.id}">
            <span class="folder-icon">📁</span>
            <span>${escapeHtml(f.name)}</span>
          </button>
          ${sub ? '<div class="folder-children">' + sub + '</div>' : ''}
        </div>
      `;
    }).join('');
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s == null ? '' : s;
    return div.innerHTML;
  }

  function renderFolderTree() {
    const html = buildTree('');
    el.folderTreeList.innerHTML = html;
    el.folderTree.querySelectorAll('.folder-link').forEach(btn => {
      btn.addEventListener('click', () => selectFolder(btn.dataset.id));
    });
  }

  function selectFolder(id) {
    currentFolderId = id || '';
    el.folderTree.querySelectorAll('.folder-link').forEach(link => {
      link.classList.toggle('active', (link.dataset.id || '') === currentFolderId);
    });
    const folder = currentFolderId ? folders.find(f => f.id === currentFolderId) : null;
    el.breadcrumb.textContent = folder ? folder.name : 'All Documents';
    loadDocuments();
  }

  async function loadFolders() {
    try {
      folders = await db.getFolders();
      renderFolderTree();
    } catch (e) {
      showToast(e.message || 'Failed to load folders', 'error');
    }
  }

  async function loadDocuments() {
    try {
      let list = await db.getDocuments();
      if (currentFolderId) list = list.filter(d => (d.folderId || '') === currentFolderId);
      const q = (el.searchInput && el.searchInput.value || '').trim().toLowerCase();
      if (q) list = list.filter(d =>
        (d.originalName || '').toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q)
      );
      documents = list;
      renderDocuments();
    } catch (e) {
      showToast(e.message || 'Failed to load documents', 'error');
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
    } catch (_) {
      return iso || '—';
    }
  }

  function fileIcon(name) {
    const ext = (name || '').split('.').pop().toLowerCase();
    const icons = { pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', jpg: '🖼', jpeg: '🖼', png: '🖼', gif: '🖼' };
    return icons[ext] || '📎';
  }

  function renderDocuments() {
    if (!documents.length) {
      el.docTableBody.innerHTML = '<tr class="empty-row"><td colspan="5">No documents in this folder. Upload files to get started.</td></tr>';
      return;
    }
    el.docTableBody.innerHTML = documents.map(doc => `
      <tr>
        <td>
          <div class="doc-name">
            <span class="doc-name-icon">${fileIcon(doc.originalName)}</span>
            <a href="#" class="doc-download" data-doc-id="${doc.id}">${escapeHtml(doc.originalName)}</a>
          </div>
        </td>
        <td><span class="doc-desc">${escapeHtml(doc.description || '—')}</span></td>
        <td class="doc-size">${formatSize(doc.size)}</td>
        <td class="doc-date">${formatDate(doc.createdAt)}</td>
        <td>
          <div class="doc-actions">
            <button type="button" class="btn btn-ghost btn-danger doc-download" data-doc-id="${doc.id}" title="Download">↓</button>
            <button type="button" class="btn btn-danger" data-doc-id="${doc.id}" data-delete title="Delete">✕</button>
          </div>
        </td>
      </tr>
    `).join('');

    el.docTableBody.querySelectorAll('.doc-download').forEach(btn => {
      btn.addEventListener('click', (e) => { e.preventDefault(); downloadDocument(btn.dataset.docId); });
    });
    el.docTableBody.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => deleteDocument(btn.dataset.docId));
    });
  }

  async function downloadDocument(id) {
    const doc = documents.find(d => d.id === id);
    if (!doc) return;
    try {
      const blob = await db.getBlob(id);
      if (!blob) {
        showToast('File not found.', 'error');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.originalName || 'download';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast(e.message || 'Download failed', 'error');
    }
  }

  async function deleteDocument(id) {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    try {
      await db.deleteDocument(id);
      showToast('Document deleted.');
      loadDocuments();
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error');
    }
  }

  function showToast(message, type) {
    type = type || 'success';
    el.toast.textContent = message;
    el.toast.className = 'toast show ' + type;
    clearTimeout(el.toast._tid);
    el.toast._tid = setTimeout(function () {
      el.toast.classList.remove('show');
    }, 3000);
  }

  function uploadFiles(files, folderId) {
    const fileList = files ? Array.from(files) : [];
    if (!fileList.length) {
      showToast('Please select one or more files.', 'error');
      return;
    }
    const targetFolderId = folderId !== undefined ? folderId : (currentFolderId || null);
    fileList.forEach(function (file) {
      const id = uuid();
      const doc = {
        id: id,
        folderId: targetFolderId,
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        description: null,
        createdAt: new Date().toISOString()
      };
      db.saveDocument(doc)
        .then(function () { return db.saveBlob(id, file); })
        .then(function () {
          showToast('"' + file.name + '" uploaded.');
          loadDocuments();
        })
        .catch(function (e) {
          showToast(e.message || 'Upload failed', 'error');
        });
    });
  }

  el.fileInput.addEventListener('change', function () {
    uploadFiles(this.files);
    this.value = '';
  });

  el.uploadZone.addEventListener('click', function (e) {
    if (e.target === el.uploadZone || (e.target.closest && e.target.closest('.upload-zone p'))) el.fileInput.click();
  });

  el.uploadZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
    el.uploadZone.classList.add('dragover');
  });
  el.uploadZone.addEventListener('dragleave', function (e) {
    e.preventDefault();
    e.stopPropagation();
    el.uploadZone.classList.remove('dragover');
  });
  el.uploadZone.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    el.uploadZone.classList.remove('dragover');
    uploadFiles(e.dataTransfer.files);
  });

  if (el.searchInput) {
    var searchDebounce;
    el.searchInput.addEventListener('input', function () {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(loadDocuments, 250);
    });
  }

  el.refreshBtn.addEventListener('click', function () {
    loadFolders().then(loadDocuments);
  });

  el.newFolderBtn.addEventListener('click', function () {
    el.folderId.value = '';
    el.folderName.value = '';
    el.folderModal.querySelector('h3').textContent = 'New folder';
    el.folderModal.hidden = false;
    el.folderName.focus();
  });

  el.folderForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const id = el.folderId.value;
    const name = el.folderName.value.trim();
    if (!name) return;
    try {
      if (id) {
        const folder = folders.find(f => f.id === id);
        if (folder) {
          folder.name = name;
          await db.saveFolder(folder);
          showToast('Folder updated.');
        }
      } else {
        await db.saveFolder({
          id: uuid(),
          name: name,
          parentId: currentFolderId || null,
          createdAt: new Date().toISOString()
        });
        showToast('Folder created.');
      }
      el.folderModal.hidden = true;
      loadFolders();
    } catch (err) {
      showToast(err.message || 'Request failed', 'error');
    }
  });

  el.folderModal.querySelectorAll('[data-close]').forEach(function (node) {
    node.addEventListener('click', function () { el.folderModal.hidden = true; });
  });

  el.folderModal.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') el.folderModal.hidden = true;
  });

  loadFolders().then(loadDocuments);
})();
