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
$priority = isset($_POST['priority']) ? trim((string) $_POST['priority']) : 'regular';

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

$emailSubject = 'Document shared with you – Palawan Health Office';
$viewLink = $siteUrl . '/';


// Plain-text fallback
$emailBody = "Palawan Health Office – Document Archive\n\n";
$emailBody .= "A new document has been shared with you.\n\n";
$priorityLabels = ['critical' => 'Critical', 'urgent' => 'Urgent', 'priority' => 'Priority', 'regular' => 'Regular'];
$priorityLabel = $priorityLabels[$priority] ?? 'Regular';
$emailBody .= "Priority: " . $priorityLabel . "\n";
$emailBody .= "Title: " . ($title ?: '—') . "\n";
$emailBody .= "File: " . ($fileName ?: '—') . "\n";
if ($subject) $emailBody .= "Subject: " . $subject . "\n";
$emailBody .= "\nOpen the link below to view the document in the Document Archive.\n";
$emailBody .= $viewLink . "\n\n";
$emailBody .= "— Palawan Health Office, Document Archive\n";

// HTML email: formal, with logo and button (link behind button only)
$titleEsc = htmlspecialchars($title ?: $fileName, ENT_QUOTES, 'UTF-8');
$fileNameEsc = htmlspecialchars($fileName ?: '—', ENT_QUOTES, 'UTF-8');
$subjectEsc = htmlspecialchars($subject ?: '—', ENT_QUOTES, 'UTF-8');
$viewLinkEsc = htmlspecialchars($viewLink, ENT_QUOTES, 'UTF-8');
$priorityColor = ['critical' => '#b91c1c', 'urgent' => '#c2410c', 'priority' => '#1d4ed8', 'regular' => '#4b5563'][$priority] ?? '#4b5563';
$priorityEsc = htmlspecialchars($priorityLabel, ENT_QUOTES, 'UTF-8');

$emailBodyHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;font-family:\'Segoe UI\',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f6f8;">';
$emailBodyHtml .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:32px 16px;">';
$emailBodyHtml .= '<tr><td align="center">';
$emailBodyHtml .= '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">';

// Header (no logos attached)
$emailBodyHtml .= '<tr><td style="padding:32px 40px 24px;text-align:center;background:linear-gradient(135deg,#1e3a5f 0%,#2c5282 100%);">';
$emailBodyHtml .= '<h1 style="margin:0;font-size:20px;font-weight:600;color:#ffffff;letter-spacing:0.5px;">Palawan Health Office</h1>';
$emailBodyHtml .= '<p style="margin:4px 0 0;font-size:14px;color:rgba(255,255,255,0.9);">Document Archive</p>';
$emailBodyHtml .= '</td></tr>';

// Content
$emailBodyHtml .= '<tr><td style="padding:36px 40px 32px;">';
$emailBodyHtml .= '<p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#2d3748;">Dear Recipient,</p>';
$emailBodyHtml .= '<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a5568;">A document has been shared with you through the Palawan Health Office Document Archive. Please review the details below and open the archive when you are ready to view or download the file.</p>';

$emailBodyHtml .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:28px;">';
$emailBodyHtml .= '<tr><td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#718096;">Priority</td><td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;"><span style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;color:#fff;background:' . $priorityColor . ';">' . $priorityEsc . '</span></td></tr>';
$emailBodyHtml .= '<tr><td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#718096;">Title</td><td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#2d3748;font-weight:500;">' . $titleEsc . '</td></tr>';
$emailBodyHtml .= '<tr><td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#718096;">File</td><td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#2d3748;">' . $fileNameEsc . '</td></tr>';
$emailBodyHtml .= '<tr><td style="padding:16px 20px;font-size:13px;color:#718096;">Subject</td><td style="padding:16px 20px;font-size:14px;color:#2d3748;">' . $subjectEsc . '</td></tr>';
$emailBodyHtml .= '</table>';

$emailBodyHtml .= '<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a5568;">To view or download this document, please click the button below. You will be taken to the Document Archive where you can sign in and access the file.</p>';

// Button only – link is behind the button
$emailBodyHtml .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 0;">';
$emailBodyHtml .= '<a href="' . $viewLinkEsc . '" target="_blank" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#2b6cb0 0%,#2c5282 100%);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;box-shadow:0 4px 14px rgba(43,108,176,0.4);">View in Document Archive</a>';
$emailBodyHtml .= '</td></tr></table>';

$emailBodyHtml .= '<p style="margin:28px 0 0;font-size:13px;line-height:1.5;color:#718096;">If you have any questions, please contact the Palawan Health Office.</p>';
$emailBodyHtml .= '<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#718096;">Respectfully,<br><strong>Palawan Health Office</strong><br>Document Archive</p>';
$emailBodyHtml .= '</td></tr>';

// Footer
$emailBodyHtml .= '<tr><td style="padding:20px 40px;background:#f7fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#718096;">— PHO Document Archive · Palawan Health Office</td></tr>';
$emailBodyHtml .= '</table></td></tr></table></body></html>';

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
    $mail->addAddress($toEmail);
    $mail->Subject = $emailSubject;
    $mail->isHTML(true);
    $mail->Body    = $emailBodyHtml;
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
