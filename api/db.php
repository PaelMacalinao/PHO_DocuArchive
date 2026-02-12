<?php
/**
 * PHP API for PHO Document Archive - replaces Firebase.
 * Expects POST JSON: { "action": "getFolders" } etc.
 * For saveBlob: POST multipart with action=saveBlob, id=..., and file= (the file).
 * For getBlob: GET db.php?action=getBlob&id=... returns raw file.
 */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$configPath = __DIR__ . '/db-config.php';
if (!is_file($configPath)) {
  echo json_encode(['error' => 'Database not configured. Copy api/db-config.sample.php to api/db-config.php.']);
  exit;
}
$dbConfig = require $configPath;

$uploadDir = __DIR__ . '/uploads';
if (!is_dir($uploadDir)) {
  @mkdir($uploadDir, 0755, true);
}

function getPdo($config) {
  $dsn = 'mysql:host=' . $config['host'] . ';port=' . ($config['port'] ?? 3306) . ';dbname=' . $config['dbname'] . ';charset=' . ($config['charset'] ?? 'utf8mb4');
  return new PDO($dsn, $config['username'], $config['password'] ?? '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
}

function rowToFolder($row) {
  return [
    'id' => $row['id'] ?? null,
    'name' => $row['name'] ?? null,
    'parentId' => $row['parent_id'] ?? null,
    'createdAt' => $row['created_at'] ?? null,
  ];
}

function rowToDocument($row) {
  return [
    'id' => $row['id'] ?? null,
    'folderId' => $row['folder_id'] ?? null,
    'originalName' => $row['original_name'] ?? null,
    'mimeType' => $row['mime_type'] ?? null,
    'size' => isset($row['size']) ? (int) $row['size'] : null,
    'title' => $row['title'] ?? null,
    'from' => $row['from'] ?? null,
    'toEmail' => $row['to_email'] ?? null,
    'subject' => $row['subject'] ?? null,
    'description' => $row['description'] ?? null,
    'status' => $row['status'] ?? null,
    'viewedAt' => $row['viewed_at'] ?? null,
    'comment' => $row['comment'] ?? null,
    'createdByEmail' => $row['created_by_email'] ?? null,
    'createdAt' => $row['created_at'] ?? null,
  ];
}

function rowToHistory($row) {
  return [
    'id' => $row['id'] ?? null,
    'type' => $row['type'] ?? null,
    'documentId' => $row['document_id'] ?? null,
    'documentName' => $row['document_name'] ?? null,
    'folderName' => $row['folder_name'] ?? null,
    'size' => isset($row['size']) ? (int) $row['size'] : null,
    'timestamp' => $row['timestamp'] ?? null,
  ];
}

function rowToUser($row) {
  return [
    'email' => $row['email'] ?? null,
    'name' => $row['name'] ?? null,
    'role' => $row['role'] ?? null,
    'picture' => $row['picture'] ?? null,
    'lastLoginAt' => $row['last_login_at'] ?? null,
  ];
}

// getBlob: return raw file (different response type)
if (isset($_GET['action']) && $_GET['action'] === 'getBlob' && isset($_GET['id'])) {
  $id = preg_replace('/[^a-zA-Z0-9\-_]/', '', $_GET['id']);
  if ($id === '') {
    http_response_code(400);
    exit;
  }
  try {
    $pdo = getPdo($dbConfig);
    $st = $pdo->prepare('SELECT mime_type FROM documents WHERE id = ?');
    $st->execute([$id]);
    $doc = $st->fetch(PDO::FETCH_ASSOC);
    $path = $uploadDir . '/' . $id;
    if (!$doc || !is_file($path)) {
      http_response_code(404);
      exit;
    }
    $mime = $doc['mime_type'] ?: 'application/octet-stream';
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($path));
    readfile($path);
  } catch (Exception $e) {
    http_response_code(500);
  }
  exit;
}

$input = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $ct = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '';
  if (strpos($ct, 'application/json') !== false) {
    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true) ?: [];
  } else {
    $input = $_POST;
  }
} else {
  echo json_encode(['error' => 'Method not allowed']);
  exit;
}

$action = isset($input['action']) ? trim((string) $input['action']) : '';
if ($action === '') {
  echo json_encode(['error' => 'Missing action']);
  exit;
}

try {
  $pdo = getPdo($dbConfig);
} catch (Exception $e) {
  echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
  exit;
}

try {
  switch ($action) {
    case 'getFolders': {
      $st = $pdo->query('SELECT * FROM folders ORDER BY name');
      $rows = $st->fetchAll(PDO::FETCH_ASSOC);
      echo json_encode(array_map('rowToFolder', $rows));
      break;
    }

    case 'saveFolder': {
      $folder = $input['folder'] ?? [];
      $id = isset($folder['id']) ? $folder['id'] : ('f-' . bin2hex(random_bytes(8)));
      $name = $folder['name'] ?? '';
      $parentId = $folder['parentId'] ?? null;
      $createdAt = $folder['createdAt'] ?? date('c');
      $st = $pdo->prepare('INSERT INTO folders (id, name, parent_id, created_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), parent_id = VALUES(parent_id)');
      $st->execute([$id, $name, $parentId, $createdAt]);
      echo json_encode(['ok' => true, 'id' => $id]);
      break;
    }

    case 'deleteFolder': {
      $id = $input['id'] ?? '';
      $st = $pdo->prepare('DELETE FROM folders WHERE id = ?');
      $st->execute([$id]);
      echo json_encode(['ok' => true]);
      break;
    }

    case 'getDocuments': {
      $st = $pdo->query('SELECT * FROM documents ORDER BY created_at DESC');
      $rows = $st->fetchAll(PDO::FETCH_ASSOC);
      echo json_encode(array_map('rowToDocument', $rows));
      break;
    }

    case 'getDocument': {
      $id = $input['id'] ?? '';
      $st = $pdo->prepare('SELECT * FROM documents WHERE id = ?');
      $st->execute([$id]);
      $row = $st->fetch(PDO::FETCH_ASSOC);
      echo json_encode($row ? rowToDocument($row) : null);
      break;
    }

    case 'saveDocument': {
      $doc = $input['document'] ?? [];
      $id = $doc['id'] ?? '';
      if ($id === '') {
        echo json_encode(['error' => 'Document id required']);
        break;
      }
      $st = $pdo->prepare('
        INSERT INTO documents (id, folder_id, original_name, mime_type, size, title, `from`, to_email, subject, description, status, viewed_at, comment, created_by_email, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        folder_id = VALUES(folder_id), original_name = VALUES(original_name), mime_type = VALUES(mime_type), size = VALUES(size),
        title = VALUES(title), `from` = VALUES(`from`), to_email = VALUES(to_email), subject = VALUES(subject), description = VALUES(description),
        status = VALUES(status), viewed_at = VALUES(viewed_at), comment = VALUES(comment), created_by_email = VALUES(created_by_email), created_at = VALUES(created_at)
      ');
      $st->execute([
        $id,
        $doc['folderId'] ?? null,
        $doc['originalName'] ?? null,
        $doc['mimeType'] ?? 'application/octet-stream',
        isset($doc['size']) ? (int) $doc['size'] : null,
        $doc['title'] ?? null,
        $doc['from'] ?? null,
        $doc['toEmail'] ?? null,
        $doc['subject'] ?? null,
        $doc['description'] ?? null,
        $doc['status'] ?? 'not_viewed',
        $doc['viewedAt'] ?? null,
        $doc['comment'] ?? null,
        $doc['createdByEmail'] ?? null,
        $doc['createdAt'] ?? date('c'),
      ]);
      echo json_encode(['ok' => true]);
      break;
    }

    case 'deleteDocument': {
      $id = $input['id'] ?? '';
      $pdo->prepare('DELETE FROM documents WHERE id = ?')->execute([$id]);
      $path = $uploadDir . '/' . preg_replace('/[^a-zA-Z0-9\-_]/', '', $id);
      if (is_file($path)) {
        @unlink($path);
      }
      echo json_encode(['ok' => true]);
      break;
    }

    case 'saveBlob': {
      $id = $input['id'] ?? '';
      if ($id === '') {
        echo json_encode(['error' => 'id required']);
        break;
      }
      $path = $uploadDir . '/' . preg_replace('/[^a-zA-Z0-9\-_]/', '', $id);
      if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
        if (move_uploaded_file($_FILES['file']['tmp_name'], $path)) {
          echo json_encode(['ok' => true]);
        } else {
          echo json_encode(['error' => 'Failed to save file']);
        }
      } else {
        echo json_encode(['error' => 'No file uploaded']);
      }
      break;
    }

    case 'addHistory': {
      $entry = $input['entry'] ?? [];
      $id = $entry['id'] ?? ('h-' . time() . '-' . bin2hex(random_bytes(4)));
      $st = $pdo->prepare('INSERT INTO history (id, type, document_id, document_name, folder_name, size, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)');
      $st->execute([
        $id,
        $entry['type'] ?? '',
        $entry['documentId'] ?? null,
        $entry['documentName'] ?? null,
        $entry['folderName'] ?? null,
        isset($entry['size']) ? (int) $entry['size'] : null,
        $entry['timestamp'] ?? date('c'),
      ]);
      echo json_encode(['ok' => true]);
      break;
    }

    case 'getHistory': {
      $st = $pdo->query('SELECT * FROM history ORDER BY timestamp DESC');
      $rows = $st->fetchAll(PDO::FETCH_ASSOC);
      echo json_encode(array_map('rowToHistory', $rows));
      break;
    }

    case 'clearHistory': {
      $pdo->exec('DELETE FROM history');
      echo json_encode(['ok' => true]);
      break;
    }

    case 'deleteHistoryByDocumentId': {
      $docId = $input['documentId'] ?? '';
      $st = $pdo->prepare('DELETE FROM history WHERE document_id = ?');
      $st->execute([$docId]);
      echo json_encode(['ok' => true]);
      break;
    }

    case 'saveUser': {
      $user = $input['user'] ?? [];
      $email = strtolower(trim($user['email'] ?? ''));
      if ($email === '') {
        echo json_encode(['error' => 'User email required']);
        break;
      }
      $name = $user['name'] ?? null;
      $role = $user['role'] ?? 'staff';
      $picture = $user['picture'] ?? null;
      $lastLoginAt = $user['lastLoginAt'] ?? date('c');
      $st = $pdo->prepare('
        INSERT INTO users (email, name, role, picture, last_login_at)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          role = VALUES(role),
          picture = VALUES(picture),
          last_login_at = VALUES(last_login_at)
      ');
      $st->execute([$email, $name, $role, $picture, $lastLoginAt]);
      echo json_encode(['ok' => true]);
      break;
    }

    case 'getUsers': {
      $st = $pdo->query('SELECT * FROM users ORDER BY email');
      $rows = $st->fetchAll(PDO::FETCH_ASSOC);
      echo json_encode(array_map('rowToUser', $rows));
      break;
    }

    default:
      echo json_encode(['error' => 'Unknown action: ' . $action]);
  }
} catch (Exception $e) {
  echo json_encode(['error' => $e->getMessage()]);
}
