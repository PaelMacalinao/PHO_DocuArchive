  const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

// Ensure directories exist
async function ensureDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  try {
    await fs.access(STORE_FILE);
  } catch {
    await fs.writeFile(STORE_FILE, JSON.stringify({ folders: [], documents: [] }, null, 2));
  }
}

async function readStore() {
  const raw = await fs.readFile(STORE_FILE, 'utf-8');
  return JSON.parse(raw);
}

async function writeStore(store) {
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

// Multer: store files in uploads/ with safe names (no double extension)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const base = path.basename(file.originalname || 'file', ext);
    const safe = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'file';
    cb(null, `${uuidv4()}_${safe}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Folders API ---
app.get('/api/folders', async (req, res) => {
  try {
    const store = await readStore();
    res.json(store.folders);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/folders', async (req, res) => {
  try {
    const { name, parentId = null } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Folder name required' });
    const store = await readStore();
    const folder = {
      id: uuidv4(),
      name: name.trim(),
      parentId,
      createdAt: new Date().toISOString()
    };
    store.folders.push(folder);
    await writeStore(store);
    res.status(201).json(folder);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/folders/:id', async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Folder name required' });
    const store = await readStore();
    const f = store.folders.find(x => x.id === req.params.id);
    if (!f) return res.status(404).json({ error: 'Folder not found' });
    f.name = name.trim();
    await writeStore(store);
    res.json(f);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/folders/:id', async (req, res) => {
  try {
    const store = await readStore();
    const idx = store.folders.findIndex(x => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Folder not found' });
    const hasChildren = store.folders.some(x => x.parentId === req.params.id);
    const hasDocs = store.documents.some(x => x.folderId === req.params.id);
    if (hasChildren || hasDocs) return res.status(400).json({ error: 'Remove or move contents first' });
    store.folders.splice(idx, 1);
    await writeStore(store);
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Documents API ---
app.get('/api/documents', async (req, res) => {
  try {
    const folderId = req.query.folderId;
    const q = (req.query.q || '').trim().toLowerCase();
    const store = await readStore();
    let list = store.documents;
    if (folderId) list = list.filter(d => d.folderId === folderId);
    if (q) list = list.filter(d => (d.originalName || '').toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q));
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded. Please choose a file.' });
    const rawFolderId = req.body && req.body.folderId;
    const folderId = (rawFolderId === '' || rawFolderId === undefined || rawFolderId === null) ? null : String(rawFolderId).trim() || null;
    const description = (req.body && req.body.description ? req.body.description : '').trim();
    const store = await readStore();
    const doc = {
      id: uuidv4(),
      folderId,
      originalName: req.file.originalname,
      storedName: path.basename(req.file.filename),
      mimeType: req.file.mimetype,
      size: req.file.size,
      description: description || null,
      createdAt: new Date().toISOString()
    };
    store.documents.push(doc);
    await writeStore(store);
    res.status(201).json(doc);
  } catch (e) {
    console.error('Upload error:', e);
    res.status(500).json({ error: e.message || 'Upload failed' });
  }
});

app.get('/api/documents/:id/download', async (req, res) => {
  try {
    const store = await readStore();
    const doc = store.documents.find(x => x.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const filePath = path.join(UPLOADS_DIR, doc.storedName);
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'File not found on disk' });
    }
    res.download(filePath, doc.originalName);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/documents/:id', async (req, res) => {
  try {
    const store = await readStore();
    const idx = store.documents.findIndex(x => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Document not found' });
    const doc = store.documents[idx];
    const filePath = path.join(UPLOADS_DIR, doc.storedName);
    try { await fs.unlink(filePath); } catch (_) {}
    store.documents.splice(idx, 1);
    await writeStore(store);
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

ensureDirs().then(() => {
  app.listen(PORT, () => console.log(`PHO Document Archive running at http://localhost:${PORT}`));
}).catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
