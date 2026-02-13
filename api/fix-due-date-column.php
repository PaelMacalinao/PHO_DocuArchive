<?php
/**
 * Auto-fix: Add due_date column to documents table if it doesn't exist
 * Run this file once in your browser: http://localhost/PHO_DocuArchive/api/fix-due-date-column.php
 */

header('Content-Type: text/html; charset=utf-8');

$configPath = __DIR__ . '/db-config.php';
if (!is_file($configPath)) {
    die('<h2>Error</h2><p>Database not configured. Copy api/db-config.sample.php to api/db-config.php</p>');
}

$dbConfig = require $configPath;

try {
    $dsn = 'mysql:host=' . $dbConfig['host'] . ';port=' . ($dbConfig['port'] ?? 3306) . ';dbname=' . $dbConfig['dbname'] . ';charset=' . ($dbConfig['charset'] ?? 'utf8mb4');
    $pdo = new PDO($dsn, $dbConfig['username'], $dbConfig['password'] ?? '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    // Check if column exists
    $stmt = $pdo->query("
        SELECT COUNT(*) as count 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'documents' 
        AND COLUMN_NAME = 'due_date'
    ");
    $result = $stmt->fetch();
    
    if ($result['count'] > 0) {
        echo '<h2>✓ Success</h2>';
        echo '<p>The <code>due_date</code> column already exists in the documents table.</p>';
        echo '<p><a href="../index.html">Go back to the application</a></p>';
    } else {
        // Add the column
        $pdo->exec("ALTER TABLE documents ADD COLUMN due_date VARCHAR(32) DEFAULT NULL AFTER to_email");
        echo '<h2>✓ Success</h2>';
        echo '<p>The <code>due_date</code> column has been added to the documents table.</p>';
        echo '<p><a href="../index.html">Go back to the application</a></p>';
    }
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'Duplicate column name') !== false) {
        echo '<h2>✓ Success</h2>';
        echo '<p>The <code>due_date</code> column already exists (duplicate column error).</p>';
        echo '<p><a href="../index.html">Go back to the application</a></p>';
    } else {
        echo '<h2>✗ Error</h2>';
        echo '<p>Failed to add column: ' . htmlspecialchars($e->getMessage()) . '</p>';
        echo '<p>Try running this SQL manually in MySQL:</p>';
        echo '<pre>ALTER TABLE documents ADD COLUMN due_date VARCHAR(32) DEFAULT NULL AFTER to_email;</pre>';
    }
}
?>
