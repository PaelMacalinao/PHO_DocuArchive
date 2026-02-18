# PHO Document Archive

**Palawan Health Office (PHO) Document Archiving** — A web-based document management and archiving system. Data is stored in **MySQL** (via PHP and XAMPP); no Firebase or IndexedDB required.

## Features

- **Folder structure** — Create and organize folders (with optional nesting)
- **Document upload** — Upload files via button or drag-and-drop; files are stored on the server
- **Search** — Search documents by name or description
- **Download & delete** — Download or remove documents from the archive
- **Email notifications** — Notify staff by email when a document is shared with them

## MySQL backend (MySQL Workbench / XAMPP)

The app uses **MySQL** for folders, documents, and history. File contents are stored in `api/uploads/`.

**Setup:**

1. **Create the database**  
   In MySQL Workbench (or `mysql` CLI), run the script **`api/schema.sql`** to create the database `pho_docuarchive` and tables.

2. **Configure PHP**  
   Edit **`api/db-config.php`** with your MySQL credentials (host, dbname, username, password). You can copy from `api/db-config.sample.php` if needed.

3. **Run the app**  
   Serve the project with **XAMPP** (Apache + PHP + MySQL). Open **http://localhost/PHO_DocuArchive/** in the browser. To allow access from other PCs, use the server's IP or hostname (e.g. `http://192.168.1.100/PHO_DocuArchive/`).

**Login:** Admin uses **phoadmin** / **phoadmin**. Staff enter their **email** only (no Google sign-in).

## Network access: admin from any PC

The admin system is **general and accessible from any PC**. As long as the application is served over **HTTP** (e.g. via XAMPP, Apache, or any web server), users on other computers can reach it and access the same data.

- **Serve the app from a central server** (e.g. `http://your-server-ip/PHO_DocuArchive/` or `http://your-domain/PHO_DocuArchive/`). All data (folders, documents, history) comes from the server’s MySQL and `api/uploads/`, so every client sees the same data.
- **Any authorized user can log in as admin from a different computer.** Use the same admin credentials (e.g. phoadmin / phoadmin) from any device that can open the site in a browser. No need to be on the same machine as the server.
- **Staff** can also sign in from any PC (email or Google) and will see only the documents assigned to their email.

For local development you can use `http://localhost/...`. For access from other PCs on your network, use the server’s IP (e.g. `http://192.168.1.100/PHO_DocuArchive/`) and ensure Apache and MySQL are running and firewall allows HTTP.

**If admin login fails when using the server IP (e.g. http://192.168.2.39/PHO_DocuArchive/):**

1. **Credentials:** Use exactly **phoadmin** (username) and **phoadmin** (password). Both are case-sensitive; no extra spaces.
2. **Browser console:** Press F12 → Console. If you see red errors (e.g. "PHODB not loaded", or script 404), fix script paths or network so all assets load from the same server.
3. **API reachable:** In the same browser, open `http://192.168.2.39/PHO_DocuArchive/api/db.php`. You should see a short JSON message (e.g. `{"error":"..."}`). If you get "Page not found" or a blank page, the PHP API is not being served—check that Apache is running, the project is under the correct folder (e.g. `htdocs/PHO_DocuArchive`), and that PHP is enabled.
4. **Firewall:** On the server PC, allow inbound HTTP (port 80) so other machines can reach it.

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

## Email notifications (XAMPP / PHP)

When an admin uploads a file and enters the staff Gmail in the metadata form, the app can send a **real email** to that address with a link to the Document Archive so they can sign in and view the file.

**Setup:**

1. Serve the app via **XAMPP** (or any PHP server) so the `api/` folder is reachable (e.g. `http://localhost/PHO_DocuArchive/`).
2. Copy `api/email-config.sample.php` to `api/email-config.php`.
3. In `api/email-config.php` set:
   - **SITE_BASE_URL** — e.g. `http://localhost/PHO_DocuArchive` (or your production URL).
   - **SMTP_USER** / **SMTP_PASS** — Gmail address and [App Password](https://support.google.com/accounts/answer/185833) (enable 2-Step Verification first).
   - **MAIL_FROM_EMAIL** / **MAIL_FROM_NAME** — Sender shown in the email.
4. (Recommended) Install PHPMailer so sending works reliably with Gmail:
   ```bash
   cd api
   composer install
   ```
   If you don’t have Composer, the script falls back to PHP `mail()` (may not work on localhost without SMTP in `php.ini`).

After setup, each upload to a given Gmail will trigger one notification email containing the document title and a link to the site.

## Project structure

```
PHO_DocuArchive/
├── index.html      # Main page
├── api/
│   ├── schema.sql              # MySQL schema (run in MySQL Workbench)
│   ├── db-config.php           # MySQL credentials (edit; see db-config.sample.php)
│   ├── db.php                  # PHP API for folders, documents, files, history
│   ├── uploads/                # Stored file contents (created automatically)
│   ├── send-notification.php   # Email notification when admin uploads
│   └── email-config.php        # Gmail SMTP for notifications (optional)
├── css/style.css
├── js/
│   ├── db-api.js   # Calls PHP API (replaces Firebase/IndexedDB)
│   └── app.js      # UI and logic
└── README.md
```

## Where is data stored?

- **Folders**, **document metadata**, and **history** are stored in **MySQL** (database `pho_docuarchive`).
- **File contents** are stored as files in **`api/uploads/`** (one file per document, keyed by document id).

## License

MIT
