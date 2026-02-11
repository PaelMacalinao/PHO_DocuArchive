# PHO Document Archive

**Palawan Health Office (PHO) Document Archiving** — A web-based document management and archiving system. No Node.js or server required: everything runs in your browser and stores data locally with **IndexedDB**.

## Features

- **Folder structure** — Create and organize folders (with optional nesting)
- **Document upload** — Upload files via button or drag-and-drop; files are stored in the browser
- **Search** — Search documents by name or description
- **Download & delete** — Download or remove documents from the archive
- **Offline / no server** — No backend; works with just HTML, CSS, and JavaScript

## How to run

1. **Option A – Open the file**  
   Double-click **`index.html`** or open it in your browser (e.g. drag `index.html` into Chrome or Edge).  
   Some browsers may block IndexedDB when the page is opened as `file://`. If upload or storage does not work, use Option B.

2. **Option B – Simple local server (recommended)**  
   Serve the folder with any static server, then open the URL in the browser. Examples:

   **Python 3:**
   ```bash
   cd PHO_DocuArchive
   python -m http.server 8080
   ```
   Then open: **http://localhost:8080**

   **PHP:**
   ```bash
   cd PHO_DocuArchive
   php -S localhost:8080
   ```
   Then open: **http://localhost:8080**

   Or use your editor’s “Live Server” (e.g. VS Code / Cursor Live Server) and open the project folder.

## Project structure

```
PHO_DocuArchive/
├── index.html      # Main page
├── css/
│   └── style.css   # Styles
├── js/
│   ├── db.js       # IndexedDB (folders, documents, file blobs)
│   └── app.js      # UI and upload/list/download/delete logic
└── README.md
```

## Where is data stored?

- **Folders** and **document metadata** (name, size, date, folder) are stored in the browser’s **IndexedDB** (database name: `PHO_DocuArchive`).
- **File contents** are stored as blobs in the same database.
- Data stays on the device and in the browser profile; clearing site data or uninstalling the browser will remove it.

## License

MIT
