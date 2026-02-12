<?php
/**
 * SENDER (built-in): This Gmail is always the sender of notification emails.
 * RECEIVER: Whoever you type in "Gmail (Send to)" when uploading — they get the email.
 */

// Base URL of your Document Archive (no trailing slash)
define('SITE_BASE_URL', 'http://localhost/PHO_DocuArchive');

// ——— SENDER: Your Gmail (built-in). All emails are sent FROM this address. ———
define('SMTP_HOST', 'smtp.gmail.com');
define('SMTP_PORT', 587);
define('SMTP_USER', 'johnrafaelmacalinao5183@gmail.com');
define('SMTP_PASS', 'xppohjxcmmmxvbzm');  // Use App Password if 2FA is on: Google Account → Security → App passwords
define('MAIL_FROM_EMAIL', 'johnrafaelmacalinao5183@gmail.com');  // Same as SMTP_USER = sender
define('MAIL_FROM_NAME', 'Palawan Health Office - Document Archive');  // Name shown as sender
