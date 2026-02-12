<?php
/**
 * Sends a notification email to the recipient when admin uploads a document.
 * Expects POST: toEmail, subject, title, fileName
 * Returns JSON: { "ok": true } or { "ok": false, "error": "message" }
 */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
  exit;
}

$configFile = __DIR__ . '/email-config.php';
if (!is_file($configFile)) {
  echo json_encode(['ok' => false, 'error' => 'Email not configured. Copy api/email-config.sample.php to api/email-config.php and set your Gmail SMTP.']);
  exit;
}
require $configFile;

// Only one recipient: the exact email entered in "Gmail (Send to)" / Mail To
$toEmail = isset($_POST['toEmail']) ? trim((string) $_POST['toEmail']) : '';
$subject = isset($_POST['subject']) ? trim((string) $_POST['subject']) : '';
$title = isset($_POST['title']) ? trim((string) $_POST['title']) : '';
$fileName = isset($_POST['fileName']) ? trim((string) $_POST['fileName']) : '';
$documentId = isset($_POST['documentId']) ? trim((string) $_POST['documentId']) : '';

if ($toEmail === '' || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
  echo json_encode(['ok' => false, 'error' => 'Invalid recipient email']);
  exit;
}

// We no longer attach the file to the email; recipient will open it via the archive link only.

$siteUrl = defined('SITE_BASE_URL') ? rtrim(SITE_BASE_URL, '/') : '';
if ($siteUrl === '') {
  echo json_encode(['ok' => false, 'error' => 'SITE_BASE_URL not set in email-config.php']);
  exit;
}

$emailSubject = 'New document shared with you: ' . ($title ?: $fileName);
$viewLink = $siteUrl . '/';
$emailBody = "Palawan Health Office – Document Archive\n\n";
$emailBody .= "A new document has been shared with you.\n\n";
$emailBody .= "Title: " . ($title ?: '—') . "\n";
$emailBody .= "File: " . ($fileName ?: '—') . "\n";
if ($subject) $emailBody .= "Subject: " . $subject . "\n";
$emailBody .= "\nView it here: " . $viewLink . "\n\n";
$emailBody .= "— PHO Document Archive\n";

$mailFromEmail = defined('MAIL_FROM_EMAIL') ? MAIL_FROM_EMAIL : (defined('SMTP_USER') ? SMTP_USER : '');
$mailFromName = defined('MAIL_FROM_NAME') ? MAIL_FROM_NAME : 'PHO Document Archive';

// Use PHPMailer if available
$autoload = __DIR__ . '/vendor/autoload.php';
if (is_file($autoload)) {
  require $autoload;

  $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
  try {
    $mail->isSMTP();
    $mail->Host       = SMTP_HOST;
    $mail->SMTPAuth   = true;
    $mail->Username   = SMTP_USER;
    $mail->Password   = SMTP_PASS;
    $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = SMTP_PORT;
    $mail->CharSet    = 'UTF-8';

    $mail->setFrom($mailFromEmail, $mailFromName);
    $mail->clearAddresses();
    $mail->addAddress($toEmail); // Only this one recipient (the Mail To address)
    $mail->Subject = $emailSubject;
    $mail->Body    = $emailBody;
    $mail->AltBody = $emailBody;

    $mail->send();
    echo json_encode(['ok' => true]);
  } catch (Exception $e) {
    echo json_encode(['ok' => false, 'error' => 'Mail failed: ' . $mail->ErrorInfo]);
  }
  exit;
}

// Fallback: PHP mail() — text only, no attachment
$headers = [
  'From: ' . ($mailFromName ? "\"$mailFromName\" <$mailFromEmail>" : $mailFromEmail),
  'Reply-To: ' . $mailFromEmail,
  'X-Mailer: PHP/' . phpversion(),
  'Content-Type: text/plain; charset=UTF-8',
];
$sent = @mail($toEmail, $emailSubject, $emailBody, implode("\r\n", $headers));
if ($sent) {
  echo json_encode(['ok' => true]);
} else {
  echo json_encode(['ok' => false, 'error' => 'Install PHPMailer for reliable delivery. Run in api folder: composer require phpmailer/phpmailer']);
}
