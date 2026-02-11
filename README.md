# PHO Document Archive

**Palawan Health Office (PHO) Document Archiving** — A web-based document management and archiving system inspired by Folderit, built for the Palawan Health Office.

## Features

- **Folder structure** — Create and organize folders (with optional nesting)
- **Document upload** — Upload files via button or drag-and-drop; store in selected folder
- **Search** — Search documents by name or description
- **Download & delete** — Download or remove documents from the archive
- **Clean UI** — PHO-branded, responsive interface with teal/health-office styling

## Requirements

- Node.js 18+ (or 16+)

## Quick start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open in browser: **http://localhost:3000**

## Project structure

```
PHO_DocuArchive/
├── server.js          # Express API + static server
├── data/
│   └── store.json     # Folders and document metadata (created on first run)
├── uploads/           # Stored document files (created on first run)
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── package.json
└── README.md
```

## API (for reference)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/folders` | List all folders |
| POST | `/api/folders` | Create folder (`name`, `parentId`) |
| PATCH | `/api/folders/:id` | Rename folder |
| DELETE | `/api/folders/:id` | Delete empty folder |
| GET | `/api/documents?folderId=&q=` | List documents (optional filter and search) |
| POST | `/api/documents/upload` | Upload file (multipart: `file`, `folderId`, `description`) |
| GET | `/api/documents/:id/download` | Download document |
| DELETE | `/api/documents/:id` | Delete document |

## License

MIT
