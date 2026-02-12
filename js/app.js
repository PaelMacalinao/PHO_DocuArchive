(function () {
  const db = window.PHODB;
  if (!db) {
    console.error('PHODB not loaded. Ensure js/db.js is included before app.js.');
    return;
  }

  var USER_STORAGE_KEY = 'PHO_DocuArchive_User';
  var useFirebase = !!(window.FirebaseAuth && window.FirebaseAuth.auth);
  var ADMIN_EMAIL = 'phoadmin';
  var ADMIN_PASSWORD = 'phoadmin';

  // Predefined provincial offices (folder names only — Gmail is entered manually per upload)
  var OFFICES = [
    { name: 'Office of the Provincial Governor' },
    { name: 'Office of the Vice Governor' },
    { name: 'Provincial Planning and Development Office (PPDO)' },
    { name: "Provincial Treasurer's Office" },
    { name: 'Provincial Human Resource Management Office (PHRMO)' },
    { name: 'Provincial Environment and Natural Resources Office (PGEnro)' },
    { name: 'Provincial Health Office' },
    { name: 'Provincial Social Welfare and Development Office' },
    { name: 'Provincial Agriculture Office' },
    { name: 'Provincial Engineering Office' },
    { name: 'Provincial Budget Office' },
    { name: 'Provincial Accounting Office' },
    { name: "Provincial Assessor's Office" },
    { name: 'Provincial General Services Office' },
    { name: 'Provincial Legal Office' },
    { name: 'Provincial Information Office' },
    { name: 'Provincial Disaster Risk Reduction and Management Office (PDRRMO)' },
    { name: 'Provincial Tourism Office' },
    { name: 'Provincial Veterinary Office' },
    { name: 'Provincial Cooperative Development Office' }
  ];

  let currentFolderId = '';
  let currentView = 'dashboard';
  let folders = [];
  let documents = [];
  let historyList = [];
  let uploadQueue = [];
  let pendingUpload = null;
  let currentViewerDocId = null;
  let currentCommentDocId = null;
  let currentUser = { email: '', role: 'staff', name: '', picture: '' };

  let viewerObjectUrl = null;

  const el = {
    loginScreen: document.getElementById('loginScreen'),
    loginForm: document.getElementById('loginForm'),
    loginEmail: document.getElementById('loginEmail'),
    loginPassword: document.getElementById('loginPassword'),
    loginRole: document.getElementById('loginRole'),
    signOutBtn: document.getElementById('signOutBtn'),
    dashboard: document.querySelector('.dashboard'),
    profileAvatar: document.getElementById('profileAvatar'),
    profileAvatarFallback: document.getElementById('profileAvatarFallback'),
    profileName: document.getElementById('profileName'),
    profileEmail: document.getElementById('profileEmail'),
    profileRole: document.getElementById('profileRole'),
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
    viewerModal: document.getElementById('viewerModal'),
    viewerModalTitle: document.getElementById('viewerModalTitle'),
    viewerContent: document.getElementById('viewerContent'),
    viewerStatusBadge: document.getElementById('viewerStatusBadge'),
    viewerViewedAt: document.getElementById('viewerViewedAt'),
    commentModal: document.getElementById('commentModal'),
    commentForm: document.getElementById('commentForm'),
    commentFileName: document.getElementById('commentFileName'),
    commentText: document.getElementById('commentText'),
    sidebarFolders: document.getElementById('sidebarFolders'),
    panelDashboard: document.getElementById('panelDashboard'),
    panelHistory: document.getElementById('panelHistory'),
    panelSettings: document.getElementById('panelSettings'),
    panelProfile: document.getElementById('panelProfile'),
    historyTableBody: document.getElementById('historyTableBody'),
    refreshHistoryBtn: document.getElementById('refreshHistoryBtn'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    metaModal: document.getElementById('metaModal'),
    metaForm: document.getElementById('metaForm'),
    metaFileName: document.getElementById('metaFileName'),
    metaTitle: document.getElementById('metaTitle'),
    metaFrom: document.getElementById('metaFrom'),
    metaGmail: document.getElementById('metaGmail'),
    metaSubject: document.getElementById('metaSubject'),
    userRoleLabel: document.getElementById('userRoleLabel'),
    userEmailLabel: document.getElementById('userEmailLabel'),
    toast: document.getElementById('toast')
  };

  // Populate the office dropdown in the metadata modal
  (function populateOfficeDropdown() {
    if (!el.metaFrom) return;
    OFFICES.forEach(function (office, idx) {
      var opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = office.name;
      el.metaFrom.appendChild(opt);
    });
  })();

  function normalizeEmail(s) {
    return String(s || '').trim().toLowerCase();
  }

  function isValidEmail(email) {
    var e = normalizeEmail(email);
    return !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  function gmailComposeUrl(toEmail, subject, body) {
    const params = new URLSearchParams();
    params.set('view', 'cm');
    params.set('fs', '1');
    params.set('to', toEmail || '');
    if (subject) params.set('su', subject);
    if (body) params.set('body', body);
    return 'https://mail.google.com/mail/?' + params.toString();
  }

  async function sendToGmail(file, doc) {
    const toEmail = normalizeEmail(doc && doc.toEmail);
    if (!toEmail) throw new Error('Recipient Gmail is missing.');

    const subject = (doc && (doc.subject || doc.title || doc.originalName)) || 'Document';
    const body =
      'Title: ' + (doc.title || '—') + '\n' +
      'To: ' + (doc.toEmail || doc.to || '—') + '\n' +
      'Subject: ' + (doc.subject || '—') + '\n' +
      '\n' +
      'Sent from PHO Document Archive.';

    // Best UX: Web Share API (can attach file on supported devices)
    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: doc.title || doc.originalName || 'Document',
          text: body,
          files: [file]
        });
        showToast('Ready to send (share opened).');
        return;
      }
    } catch (_) {
      // user may cancel share; fall back below
    }

    // Fallback: open Gmail compose (attachments cannot be auto-added by browsers)
    window.open(gmailComposeUrl(toEmail, subject, body), '_blank', 'noopener');
    showToast('Gmail opened. Please attach the file manually.', 'success');
  }

  /**
   * Send a real email to the recipient with a link to the Document Archive.
   * Calls api/send-notification.php (requires PHP email config on server).
   */
  function sendUploadNotification(payload) {
    var toEmail = normalizeEmail(payload && payload.toEmail);
    if (!toEmail) return Promise.resolve();
    var form = new FormData();
    form.append('toEmail', toEmail);
    form.append('subject', (payload.subject || '').trim());
    form.append('title', (payload.title || '').trim());
    form.append('fileName', (payload.fileName || '').trim());
    return fetch('api/send-notification.php', {
      method: 'POST',
      body: form
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.ok) {
          showToast('Notification email sent to ' + toEmail + '.', 'success');
        } else if (data && data.error) {
          showToast('Email notification: ' + data.error, 'error');
        }
      })
      .catch(function () {
        showToast('Could not send notification email. Check api/email-config.php.', 'error');
      });
  }

  function loadUser() {
    try {
      var raw = localStorage.getItem(USER_STORAGE_KEY);
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      var email = normalizeEmail(parsed && parsed.email);
      if (!email) return false;
      currentUser = {
        email: email,
        role: (parsed.role === 'admin') ? 'admin' : 'staff',
        name: parsed.name || '',
        picture: parsed.picture || ''
      };
      return true;
    } catch (_) { return false; }
  }

  function saveUser(info) {
    currentUser = {
      email: normalizeEmail(info.email),
      role: (info.role === 'admin') ? 'admin' : 'staff',
      name: info.name || '',
      picture: info.picture || ''
    };
    try { localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser)); } catch (_) {}
  }

  function signOut() {
    currentUser = { email: '', role: 'staff', name: '', picture: '' };
    try { localStorage.removeItem(USER_STORAGE_KEY); } catch (_) {}
    if (useFirebase && window.FirebaseAuth) {
      window.FirebaseAuth.signOut().then(showLoginScreen).catch(showLoginScreen);
    } else {
      showLoginScreen();
    }
  }

  function showLoginScreen() {
    if (el.loginScreen) el.loginScreen.hidden = false;
    if (el.dashboard) el.dashboard.style.display = 'none';
    var badgeWrap = document.getElementById('userBadgeWrap');
    if (badgeWrap) badgeWrap.style.display = 'none';
    if (el.loginEmail) el.loginEmail.value = '';
    if (el.loginPassword) el.loginPassword.value = '';
    if (useFirebase) {
      var loginSubmitBtn = document.getElementById('loginSubmitBtn');
      if (loginSubmitBtn) loginSubmitBtn.textContent = 'Admin sign in';
    }
  }

  function hideLoginScreen() {
    if (el.loginScreen) el.loginScreen.hidden = true;
    if (el.dashboard) el.dashboard.style.display = '';
    var badgeWrap = document.getElementById('userBadgeWrap');
    if (badgeWrap) badgeWrap.style.display = '';
    renderUserPill();
    renderProfile();
    applyRoleUI();
    loadFolders().then(loadDocuments);
  }

  function renderUserPill() {
    var roleText = currentUser.role === 'admin' ? 'Admin' : 'Staff';
    if (el.userRoleLabel) el.userRoleLabel.textContent = roleText;
    if (el.userEmailLabel) el.userEmailLabel.textContent = currentUser.email || 'Not signed in';
    var dropdownRole = document.getElementById('userDropdownRole');
    if (dropdownRole) dropdownRole.textContent = roleText;
  }

  // Toggle user dropdown
  (function () {
    var badge = document.getElementById('userBadge');
    var dropdown = document.getElementById('userDropdown');
    if (!badge || !dropdown) return;
    badge.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.hidden = !dropdown.hidden;
    });
    document.addEventListener('click', function () {
      dropdown.hidden = true;
    });
    dropdown.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  })();

  function renderProfile() {
    if (el.profileName) el.profileName.textContent = currentUser.name || currentUser.email || '—';
    if (el.profileEmail) el.profileEmail.textContent = currentUser.email || '—';
    if (el.profileRole) el.profileRole.textContent = currentUser.role === 'admin' ? 'Administrator (full access)' : 'Staff (limited access)';
    if (currentUser.picture && el.profileAvatar) {
      el.profileAvatar.src = currentUser.picture;
      el.profileAvatar.hidden = false;
      if (el.profileAvatarFallback) el.profileAvatarFallback.hidden = true;
    } else {
      if (el.profileAvatar) el.profileAvatar.hidden = true;
      if (el.profileAvatarFallback) el.profileAvatarFallback.hidden = false;
    }
  }

  function isAdmin() {
    return currentUser.role === 'admin';
  }

  function canAccessDoc(doc) {
    if (isAdmin()) return true;
    // Staff only sees docs sent to their email
    const my = normalizeEmail(currentUser.email);
    const toEmail = normalizeEmail(doc && doc.toEmail);
    return !!my && toEmail === my;
  }

  function canCommentDoc(doc) {
    return canAccessDoc(doc);
  }

  function applyRoleUI() {
    var admin = isAdmin();

    // Upload button, refresh button, and upload zone: admin only
    var toolbarActions = document.querySelector('#panelDashboard .toolbar-actions');
    if (toolbarActions) toolbarActions.style.display = admin ? '' : 'none';
    if (el.uploadZone) el.uploadZone.style.display = admin ? '' : 'none';

    // Sidebar folders: admin only
    if (el.sidebarFolders) el.sidebarFolders.style.display = admin ? '' : 'none';

    // Nav links: hide History and Settings for staff
    document.querySelectorAll('.nav-link').forEach(function (link) {
      var view = link.dataset.view;
      if (view === 'history' || view === 'settings') {
        link.style.display = admin ? '' : 'none';
      }
    });

    // Card subtitle
    var subtitle = document.querySelector('#panelDashboard .card-subtitle');
    if (subtitle) subtitle.textContent = admin ? 'View and manage your archived files' : 'Documents sent to you';
  }

  function getCurrentFolderName() {
    if (!currentFolderId) return null;
    const f = folders.find(function (x) { return x.id === currentFolderId; });
    return f ? f.name : null;
  }

  function getFolderNameById(id) {
    if (!id) return null;
    const f = folders.find(function (x) { return x.id === id; });
    return f ? f.name : null;
  }

  function addHistory(entry) {
    const payload = {
      type: entry.type,
      documentId: entry.documentId || null,
      documentName: entry.documentName || null,
      folderName: entry.folderName != null ? entry.folderName : getCurrentFolderName(),
      size: entry.size != null ? entry.size : null,
      timestamp: new Date().toISOString()
    };
    db.addHistory(payload).catch(function () {});
  }

  function switchView(view) {
    // Staff can only access dashboard and profile
    if (!isAdmin() && (view === 'history' || view === 'settings')) {
      view = 'dashboard';
    }
    currentView = view;
    document.querySelectorAll('.nav-link').forEach(function (link) {
      link.classList.toggle('active', (link.dataset.view || '') === view);
    });
    if (el.sidebarFolders) {
      el.sidebarFolders.style.display = (view === 'dashboard' && isAdmin()) ? '' : 'none';
    }
    if (el.panelDashboard) el.panelDashboard.hidden = view !== 'dashboard';
    if (el.panelHistory) el.panelHistory.hidden = view !== 'history';
    if (el.panelSettings) el.panelSettings.hidden = view !== 'settings';
    if (el.panelProfile) el.panelProfile.hidden = view !== 'profile';
    if (view === 'history' && isAdmin()) loadHistory();
  }

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
          <button type="button" class="folder-delete-btn" data-folder-id="${f.id}" title="Delete folder">✕</button>
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
    el.folderTree.querySelectorAll('.folder-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFolder(btn.dataset.folderId);
      });
    });
  }

  async function deleteFolder(id) {
    if (!isAdmin()) return;
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    if (!confirm('Delete folder "' + folder.name + '"? Documents inside will not be deleted but will move to All Documents.')) return;
    try {
      // Move documents in this folder to root
      var docs = await db.getDocuments();
      for (var i = 0; i < docs.length; i++) {
        if (docs[i].folderId === id) {
          docs[i].folderId = null;
          await db.saveDocument(docs[i]);
        }
      }
      await db.deleteFolder(id);
      if (currentFolderId === id) currentFolderId = '';
      showToast('Folder "' + folder.name + '" deleted.');
      await loadFolders();
      loadDocuments();
    } catch (e) {
      showToast(e.message || 'Failed to delete folder', 'error');
    }
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

  async function seedOfficeFolders() {
    // Ensure every office has a matching folder in IndexedDB
    var existing = await db.getFolders();
    var nameSet = {};
    existing.forEach(function (f) { nameSet[f.name] = true; });
    for (var i = 0; i < OFFICES.length; i++) {
      if (!nameSet[OFFICES[i].name]) {
        await db.saveFolder({
          id: 'office-' + i,
          name: OFFICES[i].name,
          parentId: null,
          createdAt: new Date().toISOString()
        });
      }
    }
  }

  async function loadFolders() {
    try {
      await seedOfficeFolders();
      folders = await db.getFolders();
      renderFolderTree();
    } catch (e) {
      showToast(e.message || 'Failed to load folders', 'error');
    }
  }

  function getOfficeFolderId(officeName) {
    var f = folders.find(function (x) { return x.name === officeName; });
    return f ? f.id : null;
  }

  async function loadDocuments() {
    try {
      let list = await db.getDocuments();
      list = list.filter(function (d) { return canAccessDoc(d); });
      // Only filter by folder for admins (staff sees all docs sent to them)
      if (isAdmin() && currentFolderId) list = list.filter(d => (d.folderId || '') === currentFolderId);
      const q = (el.searchInput && el.searchInput.value || '').trim().toLowerCase();
      if (q) list = list.filter(d =>
        (d.originalName || '').toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q) ||
        (d.title || '').toLowerCase().includes(q) ||
        (d.from || '').toLowerCase().includes(q) ||
        (d.toEmail || '').toLowerCase().includes(q) ||
        (d.subject || '').toLowerCase().includes(q)
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

  function formatDateTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
    } catch (_) {
      return iso || '—';
    }
  }

  function historyTypeLabel(type) {
    const labels = { upload: 'Upload', view: 'View', download: 'Download', delete: 'Delete' };
    return labels[type] || type;
  }

  function historyTypeClass(type) {
    const classes = { upload: 'history-upload', view: 'history-view', download: 'history-download', delete: 'history-delete' };
    return classes[type] || '';
  }

  function fileIcon(name) {
    const ext = (name || '').split('.').pop().toLowerCase();
    const icons = { pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', jpg: '🖼', jpeg: '🖼', png: '🖼', gif: '🖼' };
    return icons[ext] || '📎';
  }

  function renderDocuments() {
    var admin = isAdmin();
    var emptyMsg = admin
      ? 'No documents in this folder. Upload files to get started.'
      : 'No documents sent to you yet.';

    if (!documents.length) {
      el.docTableBody.innerHTML = '<tr class="empty-row"><td colspan="10">' + emptyMsg + '</td></tr>';
      return;
    }
    el.docTableBody.innerHTML = documents.map(doc => `
      <tr>
        <td>
          <div class="doc-name">
            <span class="doc-name-icon">${fileIcon(doc.originalName)}</span>
            <a href="#" class="doc-view" data-doc-id="${doc.id}">${escapeHtml(doc.originalName)}</a>
          </div>
        </td>
        <td><span class="doc-desc">${escapeHtml(doc.title || '—')}</span></td>
        <td><span class="doc-desc">${escapeHtml(doc.from || '—')}</span></td>
        <td><span class="doc-email">${escapeHtml(doc.toEmail || '—')}</span></td>
        <td><span class="doc-desc">${escapeHtml(doc.subject || '—')}</span></td>
        <td>
          <span class="status-badge ${doc.viewedAt ? 'viewed' : 'not-viewed'}">
            ${doc.viewedAt ? 'Viewed' : 'Not viewed'}
          </span>
        </td>
        <td class="doc-date">${doc.viewedAt ? escapeHtml(formatDateTime(doc.viewedAt)) : '—'}</td>
        <td class="doc-size">${formatSize(doc.size)}</td>
        <td class="doc-date">${formatDate(doc.createdAt)}</td>
        <td>
          <div class="doc-actions">
            <button type="button" class="btn btn-ghost doc-comment" data-doc-id="${doc.id}" title="Comment">💬</button>
            ${admin ? '<button type="button" class="btn btn-ghost btn-danger doc-download" data-doc-id="' + doc.id + '" title="Download">↓</button>' : ''}
            ${admin ? '<button type="button" class="btn btn-danger" data-doc-id="' + doc.id + '" data-delete title="Delete">✕</button>' : ''}
          </div>
        </td>
      </tr>
    `).join('');

    el.docTableBody.querySelectorAll('.doc-view').forEach(link => {
      link.addEventListener('click', (e) => { e.preventDefault(); viewDocument(link.dataset.docId); });
    });
    el.docTableBody.querySelectorAll('.doc-download').forEach(btn => {
      btn.addEventListener('click', (e) => { e.preventDefault(); downloadDocument(btn.dataset.docId); });
    });
    el.docTableBody.querySelectorAll('.doc-comment').forEach(btn => {
      btn.addEventListener('click', () => openCommentModal(btn.dataset.docId));
    });
    el.docTableBody.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => deleteDocument(btn.dataset.docId));
    });
  }

  function closeViewer() {
    if (viewerObjectUrl) {
      URL.revokeObjectURL(viewerObjectUrl);
      viewerObjectUrl = null;
    }
    var viewerDownload = document.getElementById('viewerDownloadLink');
    var viewerOpenNewTab = document.getElementById('viewerOpenNewTab');
    if (viewerDownload) { viewerDownload.removeAttribute('href'); viewerDownload.style.display = 'none'; }
    if (viewerOpenNewTab) { viewerOpenNewTab.removeAttribute('href'); viewerOpenNewTab.style.display = 'none'; }
    currentViewerDocId = null;
    el.viewerContent.innerHTML = '';
    el.viewerModal.hidden = true;
  }

  async function markViewed(doc) {
    const now = new Date().toISOString();
    doc.viewedAt = now;
    doc.status = 'viewed';
    try {
      await db.saveDocument(doc);
    } catch (_) {}
  }

  function renderViewerMeta(doc) {
    if (el.viewerStatusBadge) {
      const viewed = !!doc.viewedAt;
      el.viewerStatusBadge.textContent = viewed ? 'Viewed' : 'Not viewed';
      el.viewerStatusBadge.classList.toggle('viewed', viewed);
      el.viewerStatusBadge.classList.toggle('not-viewed', !viewed);
    }
    if (el.viewerViewedAt) {
      el.viewerViewedAt.textContent = 'Viewed at: ' + (doc.viewedAt ? formatDateTime(doc.viewedAt) : '—');
    }
  }

  function closeCommentModal() {
    if (!el.commentModal) return;
    el.commentModal.hidden = true;
    currentCommentDocId = null;
    if (el.commentForm) el.commentForm.reset();
  }

  function openCommentModal(id) {
    if (!el.commentModal || !el.commentText) return;
    const doc = documents.find(function (d) { return d.id === id; });
    if (doc && !canCommentDoc(doc)) {
      showToast('You are not allowed to comment on this document.', 'error');
      return;
    }
    currentCommentDocId = id;
    if (el.commentFileName) el.commentFileName.textContent = doc ? (doc.originalName || 'Document') : 'Document';
    el.commentText.value = (doc && doc.comment) ? doc.comment : '';

    // Admin can only view comments, not type
    var adminView = isAdmin();
    el.commentText.readOnly = adminView;
    el.commentText.style.opacity = adminView ? '.75' : '';
    var saveBtn = el.commentModal.querySelector('button[type="submit"]');
    if (saveBtn) saveBtn.style.display = adminView ? 'none' : '';

    el.commentModal.hidden = false;
    if (!adminView) el.commentText.focus();
  }

  async function viewDocument(id) {
    var docId = id != null ? String(id).trim() : '';
    if (!docId) return;
    var doc = documents.find(function (d) { return String(d && d.id) === docId; });
    if (!doc) {
      showToast('Document not found.', 'error');
      return;
    }
    if (!canAccessDoc(doc)) {
      showToast('Access denied for this document.', 'error');
      return;
    }

    currentViewerDocId = doc.id;
    el.viewerModalTitle.textContent = doc.originalName || 'Document';
    el.viewerContent.innerHTML = '<div class="viewer-loading">Loading…</div>';
    renderViewerMeta(doc);
    var viewerDownload = document.getElementById('viewerDownloadLink');
    var viewerOpenNewTab = document.getElementById('viewerOpenNewTab');
    if (viewerDownload) { viewerDownload.style.display = 'none'; }
    if (viewerOpenNewTab) { viewerOpenNewTab.style.display = 'none'; }
    el.viewerModal.hidden = false;

    try {
      var blob = await db.getBlob(doc.id);
      if (!blob || !(blob instanceof Blob)) {
        el.viewerContent.innerHTML = '<div class="viewer-loading viewer-loading-error">File not found.</div>';
        return;
      }
      if (!blob.size && blob.size !== 0) {
        el.viewerContent.innerHTML = '<div class="viewer-loading viewer-loading-error">File is empty.</div>';
        return;
      }
      if (viewerObjectUrl) URL.revokeObjectURL(viewerObjectUrl);
      viewerObjectUrl = URL.createObjectURL(blob);
      var mime = (doc.mimeType || blob.type || '').toLowerCase();
      var isImage = mime.indexOf('image/') === 0;
      var isPdf = mime.indexOf('application/pdf') === 0;

      if (!isAdmin()) {
        addHistory({
          type: 'view',
          documentId: doc.id,
          documentName: doc.originalName,
          folderName: getFolderNameById(doc.folderId)
        });
        await markViewed(doc);
        renderDocuments();
      }

      el.viewerContent.innerHTML = '';
      var wrap = document.createElement('div');
      wrap.className = 'viewer-preview-wrap';
      var previewUrl = viewerObjectUrl + (isPdf ? '#toolbar=1' : '');

      if (isImage) {
        var img = document.createElement('img');
        img.className = 'viewer-preview-img';
        img.alt = doc.originalName || '';
        img.src = viewerObjectUrl;
        wrap.appendChild(img);
      } else {
        var iframe = document.createElement('iframe');
        iframe.className = 'viewer-preview-frame';
        iframe.title = doc.originalName || 'Document';
        iframe.src = previewUrl;
        wrap.appendChild(iframe);
      }

      el.viewerContent.appendChild(wrap);
      if (viewerDownload) {
        viewerDownload.href = viewerObjectUrl;
        viewerDownload.download = doc.originalName || 'download';
        viewerDownload.style.display = '';
      }
      if (viewerOpenNewTab) {
        viewerOpenNewTab.href = viewerObjectUrl;
        viewerOpenNewTab.style.display = '';
      }
    } catch (e) {
      el.viewerContent.innerHTML = '<div class="viewer-loading viewer-loading-error">' + (e.message || 'Could not open file') + '</div>';
    }
  }

  async function downloadDocument(id) {
    if (!isAdmin()) {
      showToast('Only admins can download files.', 'error');
      return;
    }
    const doc = documents.find(d => d.id === id);
    if (!doc) return;
    try {
      const blob = await db.getBlob(id);
      if (!blob) {
        showToast('File not found.', 'error');
        return;
      }
      addHistory({
        type: 'download',
        documentId: doc.id,
        documentName: doc.originalName,
        folderName: getFolderNameById(doc.folderId)
      });
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
    if (!isAdmin()) {
      showToast('Only admins can delete files.', 'error');
      return;
    }
    if (!confirm('Delete this document? This cannot be undone.')) return;
    try {
      await db.deleteDocument(id);
      await db.deleteHistoryByDocumentId(id);
      showToast('Document deleted.');
      loadDocuments();
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error');
    }
  }

  var historyFilter = 'all';
  var historyDateFrom = '';
  var historyDateTo = '';

  async function loadHistory() {
    try {
      historyList = await db.getHistory();
      renderHistoryFilterCounts();
      renderHistory();
    } catch (e) {
      showToast(e.message || 'Failed to load history', 'error');
    }
  }

  function renderHistoryFilterCounts() {
    var counts = { all: 0, upload: 0, view: 0, download: 0 };
    var fromMs = historyDateFrom ? new Date(historyDateFrom).getTime() : 0;
    var toMs = historyDateTo ? new Date(historyDateTo).getTime() + 86400000 : Infinity;
    historyList.forEach(function (h) {
      if (h.type === 'delete') return;
      var ts = new Date(h.timestamp).getTime();
      if (ts < fromMs || ts >= toMs) return;
      counts.all++;
      if (counts.hasOwnProperty(h.type)) counts[h.type]++;
    });
    var elAll = document.getElementById('hfCountAll');
    var elUpload = document.getElementById('hfCountUpload');
    var elView = document.getElementById('hfCountView');
    var elDownload = document.getElementById('hfCountDownload');
    if (elAll) elAll.textContent = counts.all;
    if (elUpload) elUpload.textContent = counts.upload;
    if (elView) elView.textContent = counts.view;
    if (elDownload) elDownload.textContent = counts.download;
  }

  function setHistoryFilter(filter) {
    historyFilter = filter;
    document.querySelectorAll('.history-filter-card').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderHistory();
  }

  function renderHistory() {
    if (!el.historyTableBody) return;
    // Always exclude delete entries from history
    var base = historyList.filter(function (h) { return h.type !== 'delete'; });
    var filtered = historyFilter === 'all'
      ? base
      : base.filter(function (h) { return h.type === historyFilter; });

    // Apply date range filter
    if (historyDateFrom) {
      var fromMs = new Date(historyDateFrom).getTime();
      filtered = filtered.filter(function (h) {
        return new Date(h.timestamp).getTime() >= fromMs;
      });
    }
    if (historyDateTo) {
      var toMs = new Date(historyDateTo).getTime() + 86400000; // end of day
      filtered = filtered.filter(function (h) {
        return new Date(h.timestamp).getTime() < toMs;
      });
    }

    if (!filtered.length) {
      var label = historyFilter === 'all' ? 'No activity yet.' : 'No ' + historyTypeLabel(historyFilter).toLowerCase() + ' activity yet.';
      if (historyDateFrom || historyDateTo) label = 'No activity found for the selected date range.';
      el.historyTableBody.innerHTML = '<tr class="empty-row"><td colspan="5">' + label + '</td></tr>';
      return;
    }
    el.historyTableBody.innerHTML = filtered.map(function (h) {
      const sizeStr = h.size != null ? formatSize(h.size) : '—';
      return (
        '<tr>' +
        '<td class="history-date">' + escapeHtml(formatDateTime(h.timestamp)) + '</td>' +
        '<td><span class="history-badge ' + historyTypeClass(h.type) + '">' + escapeHtml(historyTypeLabel(h.type)) + '</span></td>' +
        '<td>' + escapeHtml(h.documentName || '—') + '</td>' +
        '<td class="history-folder">' + escapeHtml(h.folderName || '—') + '</td>' +
        '<td class="history-size">' + sizeStr + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  // Wire up filter card clicks
  (function () {
    var filtersWrap = document.getElementById('historyFilters');
    if (filtersWrap) {
      filtersWrap.addEventListener('click', function (e) {
        var btn = e.target.closest('.history-filter-card');
        if (btn && btn.dataset.filter) setHistoryFilter(btn.dataset.filter);
      });
    }
  })();

  // Wire up date filter
  (function () {
    var dateFrom = document.getElementById('historyDateFrom');
    var dateTo = document.getElementById('historyDateTo');
    var applyBtn = document.getElementById('historyDateApply');
    var clearBtn = document.getElementById('historyDateClear');
    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        historyDateFrom = dateFrom ? dateFrom.value : '';
        historyDateTo = dateTo ? dateTo.value : '';
        renderHistoryFilterCounts();
        renderHistory();
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';
        historyDateFrom = '';
        historyDateTo = '';
        renderHistoryFilterCounts();
        renderHistory();
      });
    }
  })();

  // Real-time clock
  (function initClock() {
    var clockDate = document.getElementById('clockDate');
    var clockTime = document.getElementById('clockTime');
    if (!clockDate || !clockTime) return;
    function tick() {
      var now = new Date();
      clockDate.textContent = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      clockTime.textContent = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    tick();
    setInterval(tick, 1000);
  })();

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
    if (!isAdmin()) {
      showToast('Only admins can upload files.', 'error');
      return;
    }
    const fileList = files ? Array.from(files) : [];
    if (!fileList.length) {
      showToast('Please select one or more files.', 'error');
      return;
    }
    const targetFolderId = folderId !== undefined ? folderId : (currentFolderId || null);
    // queue uploads and collect metadata per file
    uploadQueue = uploadQueue.concat(fileList.map(function (file) {
      return { file: file, folderId: targetFolderId };
    }));
    processNextUpload();
  }

  function closeMetaModal() {
    if (!el.metaModal) return;
    el.metaModal.hidden = true;
    if (el.metaForm) el.metaForm.reset();
    pendingUpload = null;
  }

  function processNextUpload() {
    if (!el.metaModal || !el.metaForm) {
      // fallback: if modal missing, do nothing
      return;
    }
    if (pendingUpload) return; // already collecting details
    const next = uploadQueue.shift();
    if (!next) return;
    pendingUpload = next;
    el.metaFileName.textContent = next.file.name;
    el.metaTitle.value = '';
    el.metaFrom.selectedIndex = 0; // reset to "Select office…"
    if (el.metaGmail) el.metaGmail.value = '';
    el.metaSubject.value = '';
    el.metaModal.hidden = false;
    el.metaTitle.focus();
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
      searchDebounce = setTimeout(loadDocuments, 150);
    });
  }

  el.refreshBtn.addEventListener('click', function () {
    loadFolders().then(loadDocuments);
  });

  el.newFolderBtn.addEventListener('click', function () {
    if (!isAdmin()) return;
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

  document.querySelectorAll('[data-close="meta"]').forEach(function (node) {
    node.addEventListener('click', function () {
      // cancel this file upload, continue to next
      closeMetaModal();
      processNextUpload();
    });
  });

  if (el.metaModal) {
    el.metaModal.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeMetaModal();
        processNextUpload();
      }
    });
  }

  if (el.metaForm) {
    el.metaForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!pendingUpload) return;

      var selectedIdx = el.metaFrom.value;
      if (selectedIdx === '' || selectedIdx == null) {
        showToast('Please select an office.', 'error');
        el.metaFrom.focus();
        return;
      }
      var office = OFFICES[parseInt(selectedIdx, 10)];
      if (!office) {
        showToast('Invalid office selection.', 'error');
        return;
      }

      var gmailValue = (el.metaGmail ? el.metaGmail.value : '').trim();
      if (!isValidEmail(gmailValue)) {
        showToast('Please enter a valid Gmail address.', 'error');
        if (el.metaGmail) el.metaGmail.focus();
        return;
      }

      const file = pendingUpload.file;
      const id = uuid();
      const title = (el.metaTitle.value || '').trim();
      const subject = (el.metaSubject.value || '').trim();
      const toEmail = normalizeEmail(gmailValue);
      const fromOffice = office.name;

      // Auto-assign to the matching office folder
      var targetFolderId = getOfficeFolderId(fromOffice) || currentFolderId || null;

      const doc = {
        id: id,
        folderId: targetFolderId,
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        title: title || null,
        from: fromOffice,
        to: null,
        toEmail: toEmail,
        subject: subject || null,
        description: subject || null,
        status: 'not_viewed',
        viewedAt: null,
        comment: null,
        createdByEmail: currentUser.email || null,
        createdAt: new Date().toISOString()
      };

      // Notification email is sent only to the address in "Gmail (Send to)" — no Gmail compose popup.
      closeMetaModal();

      db.saveDocument(doc)
        .then(function () { return db.saveBlob(id, file); })
        .then(function () {
          addHistory({
            type: 'upload',
            documentId: id,
            documentName: file.name,
            folderName: getFolderNameById(targetFolderId),
            size: file.size
          });
          showToast('"' + file.name + '" uploaded.');
          loadDocuments();
          // Send real email notification to staff with link to view the document
          sendUploadNotification({
            toEmail: toEmail,
            subject: subject,
            title: title || file.name,
            fileName: file.name
          }).catch(function () {});
        })
        .catch(function (err) {
          showToast(err.message || 'Upload failed', 'error');
        })
        .finally(function () {
          processNextUpload();
        });
    });
  }

  document.querySelectorAll('[data-close="viewer"]').forEach(function (node) {
    node.addEventListener('click', closeViewer);
  });

  el.viewerModal.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeViewer();
  });

  document.querySelectorAll('[data-close="comment"]').forEach(function (node) {
    node.addEventListener('click', closeCommentModal);
  });

  if (el.commentModal) {
    el.commentModal.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeCommentModal();
    });
  }

  if (el.commentForm) {
    el.commentForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!currentCommentDocId) return;
      const value = (el.commentText && el.commentText.value ? el.commentText.value : '').trim();
      try {
        let doc = documents.find(function (d) { return d.id === currentCommentDocId; });
        if (!doc) doc = await db.getDocument(currentCommentDocId);
        if (!doc) throw new Error('Document not found');
        if (!canCommentDoc(doc)) throw new Error('You are not allowed to comment on this document.');
        doc.comment = value || null;
        await db.saveDocument(doc);
        const inList = documents.find(function (d) { return d.id === currentCommentDocId; });
        if (inList) inList.comment = doc.comment;
        showToast('Comment saved.');
        closeCommentModal();
      } catch (err) {
        showToast(err.message || 'Failed to save comment', 'error');
      }
    });
  }

  document.querySelectorAll('.nav-link').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var view = link.getAttribute('data-view');
      if (view) switchView(view);
    });
  });

  if (el.refreshHistoryBtn) {
    el.refreshHistoryBtn.addEventListener('click', loadHistory);
  }
  if (el.clearHistoryBtn) {
    el.clearHistoryBtn.addEventListener('click', function () {
      if (!confirm('Clear all activity history? This cannot be undone.')) return;
      db.clearHistory()
        .then(function () {
          loadHistory();
          showToast('History cleared.');
        })
        .catch(function (e) {
          showToast(e.message || 'Failed to clear history', 'error');
        });
    });
  }

  if (el.signOutBtn) {
    el.signOutBtn.addEventListener('click', function () {
      if (!confirm('Sign out?')) return;
      signOut();
    });
  }

  if (el.loginForm) {
    el.loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var emailRaw = (el.loginEmail && el.loginEmail.value) ? el.loginEmail.value.trim() : '';
      var email = normalizeEmail(emailRaw);
      var password = el.loginPassword ? el.loginPassword.value : '';

      // Admin: single hardcoded account (phoadmin / phoadmin)
      if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        currentUser = { email: ADMIN_EMAIL, role: 'admin', name: '', picture: '' };
        try { localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser)); } catch (_) {}
        hideLoginScreen();
        showToast('Signed in as Admin.');
        return;
      }

      if (useFirebase) {
        if (email && email !== ADMIN_EMAIL) {
          showToast('Staff must sign in with Google.', 'error');
        } else if (email === ADMIN_EMAIL) {
          showToast('Wrong admin password.', 'error');
        }
        return;
      }

      // No Firebase: allow local staff with email only
      if (!email) return;
      if (email === ADMIN_EMAIL) {
        showToast('Wrong admin password.', 'error');
        return;
      }
      saveUser({ email: email, role: 'staff', name: '', picture: '' });
      hideLoginScreen();
      showToast('Signed in as staff.');
    });
  }

  if (useFirebase) {
    var googleBtn = document.getElementById('googleSignInBtn');
    if (googleBtn) {
      googleBtn.addEventListener('click', function () {
        var auth = window.FirebaseAuth;
        if (!auth || !auth.signInWithGoogle) {
          showToast('Google sign-in not available.', 'error');
          return;
        }
        googleBtn.disabled = true;
        googleBtn.textContent = 'Opening Google…';
        var p = auth.signInWithGoogle();
        if (p && typeof p.then === 'function') {
          p.then(function (cred) {
            if (cred && cred.user) {
              var user = cred.user;
              auth.setUserRole(user.uid, user.email || '', 'staff').catch(function () {});
              currentUser = {
                email: user.email || '',
                role: 'staff',
                name: user.displayName || '',
                picture: user.photoURL || ''
              };
              hideLoginScreen();
              showToast('Signed in as staff with Google.');
            }
          }).catch(function (err) {
            googleBtn.disabled = false;
            googleBtn.innerHTML = '<span class="btn-google-icon">G</span> Sign in with Google';
            var msg = 'Google sign-in failed.';
            if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
              msg = 'Sign-in cancelled.';
            } else if (err.code === 'auth/popup-blocked') {
              msg = 'Popup blocked. Use your browser settings to allow popups, or try again.';
            } else if (err.code === 'auth/operation-not-allowed') {
              msg = 'Enable Google in Firebase Console → Authentication → Sign-in method.';
            } else if (err.message) msg = err.message;
            showToast(msg, 'error');
          });
        } else {
          showToast('Redirecting to Google…');
          googleBtn.disabled = false;
          googleBtn.innerHTML = '<span class="btn-google-icon">G</span> Sign in with Google';
        }
      });
    }
  }

  // --- Startup ---
  if (useFirebase) {
    var loginDivider = document.getElementById('loginDivider');
    var googleSignInBtn = document.getElementById('googleSignInBtn');
    if (loginDivider) loginDivider.style.display = '';
    if (googleSignInBtn) googleSignInBtn.style.display = '';
    if (el.loginPassword) el.loginPassword.required = false;
    if (loadUser() && currentUser.email === ADMIN_EMAIL && currentUser.role === 'admin') {
      hideLoginScreen();
      return;
    }
    var auth = window.FirebaseAuth;
    auth.getRedirectResult()
      .then(function (result) {
        if (result.user) {
          var user = result.user;
          auth.setUserRole(user.uid, user.email || '', 'staff').catch(function () {});
          currentUser = {
            email: user.email || '',
            role: 'staff',
            name: user.displayName || '',
            picture: user.photoURL || ''
          };
          hideLoginScreen();
          showToast('Signed in as staff with Google.');
        }
      })
      .catch(function (err) {
        if (err.code && err.code !== 'auth/popup-closed-by-user') {
          showToast(err.message || 'Sign-in failed', 'error');
        }
      })
      .finally(function () {
        auth.onAuthStateChanged(function (user) {
          if (user) {
            if (!currentUser.email) {
              auth.getUserRole(user.uid).then(function (role) {
                currentUser = {
                  email: user.email || '',
                  role: role || 'staff',
                  name: user.displayName || '',
                  picture: user.photoURL || ''
                };
                hideLoginScreen();
              }).catch(function () {
                currentUser = { email: user.email || '', role: 'staff', name: '', picture: user.photoURL || '' };
                hideLoginScreen();
              });
            }
          } else {
            if (currentUser.email !== ADMIN_EMAIL) {
              currentUser = { email: '', role: 'staff', name: '', picture: '' };
            }
            showLoginScreen();
          }
        });
      });
  } else {
    var loginDivider = document.getElementById('loginDivider');
    var googleSignInBtn = document.getElementById('googleSignInBtn');
    if (loginDivider) loginDivider.style.display = 'none';
    if (googleSignInBtn) googleSignInBtn.style.display = 'none';
    var loggedIn = loadUser();
    if (loggedIn && currentUser.email) {
      hideLoginScreen();
    } else {
      showLoginScreen();
    }
  }
})();
