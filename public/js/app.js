(function () {
  const API = '/api';
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

  function buildTree(parentId, depth = 0) {
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
          ${sub ? `<div class="folder-children">${sub}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
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
      const res = await fetch(`${API}/folders`);
      if (!res.ok) throw new Error('Failed to load folders');
      folders = await res.json();
      renderFolderTree();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function loadDocuments() {
    try {
      const params = new URLSearchParams();
      if (currentFolderId) params.set('folderId', currentFolderId);
      const q = (el.searchInput && el.searchInput.value || '').trim();
      if (q) params.set('q', q);
      const url = `${API}/documents?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load documents');
      documents = await res.json();
      renderDocuments();
    } catch (e) {
      showToast(e.message, 'error');
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
    } catch {
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
            <a href="${API}/documents/${doc.id}/download" download>${escapeHtml(doc.originalName)}</a>
          </div>
        </td>
        <td><span class="doc-desc">${escapeHtml(doc.description || '—')}</span></td>
        <td class="doc-size">${formatSize(doc.size)}</td>
        <td class="doc-date">${formatDate(doc.createdAt)}</td>
        <td>
          <div class="doc-actions">
            <a href="${API}/documents/${doc.id}/download" class="btn btn-ghost btn-danger" download title="Download">↓</a>
            <button type="button" class="btn btn-danger" data-doc-id="${doc.id}" title="Delete">✕</button>
          </div>
        </td>
      </tr>
    `).join('');
    el.docTableBody.querySelectorAll('[data-doc-id]').forEach(btn => {
      btn.addEventListener('click', () => deleteDocument(btn.dataset.docId));
    });
  }

  async function deleteDocument(id) {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API}/documents/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      showToast('Document deleted.');
      loadDocuments();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  function showToast(message, type = 'success') {
    el.toast.textContent = message;
    el.toast.className = 'toast show ' + (type || '');
    clearTimeout(el.toast._tid);
    el.toast._tid = setTimeout(() => {
      el.toast.classList.remove('show');
    }, 3000);
  }

  // Upload: send one file per request so server receives field name "file"
  function uploadFiles(files, folderId) {
    const fileList = files ? Array.from(files) : [];
    if (!fileList.length) {
      showToast('Please select one or more files.', 'error');
      return;
    }
    const targetFolderId = folderId !== undefined ? folderId : (currentFolderId || '');
    let completed = 0;
    let failed = 0;
    fileList.forEach(file => {
      const form = new FormData();
      form.append('file', file);
      form.append('folderId', targetFolderId);
      form.append('description', '');
      fetch(`${API}/documents/upload`, { method: 'POST', body: form })
        .then(res => {
          return res.json().then(data => ({ ok: res.ok, data }));
        })
        .then(({ ok, data }) => {
          if (ok) {
            completed++;
            showToast(`"${file.name}" uploaded.`);
            loadDocuments();
          } else {
            failed++;
            showToast(data.error || 'Upload failed', 'error');
          }
        })
        .catch(e => {
          failed++;
          showToast(e.message || 'Upload failed', 'error');
        });
    });
  }

  el.fileInput.addEventListener('change', function () {
    uploadFiles(this.files);
    this.value = '';
  });

  // Clicking the upload zone also opens file picker
  el.uploadZone.addEventListener('click', function (e) {
    if (e.target === el.uploadZone || e.target.closest('.upload-zone p')) el.fileInput.click();
  });

  el.uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.uploadZone.classList.add('dragover');
  });
  el.uploadZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.uploadZone.classList.remove('dragover');
  });
  el.uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.uploadZone.classList.remove('dragover');
    uploadFiles(e.dataTransfer.files);
  });

  if (el.searchInput) {
    let searchDebounce;
    el.searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(loadDocuments, 250);
    });
  }

  el.refreshBtn.addEventListener('click', () => { loadFolders(); loadDocuments(); });

  // Folder modal
  el.newFolderBtn.addEventListener('click', () => {
    el.folderId.value = '';
    el.folderName.value = '';
    el.folderModal.querySelector('h3').textContent = 'New folder';
    el.folderModal.hidden = false;
    el.folderName.focus();
  });

  el.folderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = el.folderId.value;
    const name = el.folderName.value.trim();
    if (!name) return;
    try {
      const url = id ? `${API}/folders/${id}` : `${API}/folders`;
      const opts = {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: id ? JSON.stringify({ name }) : JSON.stringify({ name, parentId: currentFolderId || null })
      };
      const res = await fetch(url, opts);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      showToast(id ? 'Folder updated.' : 'Folder created.');
      el.folderModal.hidden = true;
      loadFolders();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  el.folderModal.querySelectorAll('[data-close]').forEach(node => {
    node.addEventListener('click', () => { el.folderModal.hidden = true; });
  });

  el.folderModal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') el.folderModal.hidden = true;
  });

  // Init
  loadFolders().then(() => loadDocuments());
})();
