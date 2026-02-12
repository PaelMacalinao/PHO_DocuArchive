<?php
/**
 * Email configuration for PHO Document Archive notifications.
 * Copy this file to email-config.php and fill in your values.
 * Do not commit email-config.php (add it to .gitignore).
 */

// Base URL of your Document Archive (no trailing slash)
// Local: http://localhost/PHO_DocuArchive
// Production: https://your-domain.com/PHO_DocuArchive
define('SITE_BASE_URL', 'http://localhost/PHO_DocuArchive');

// Gmail SMTP (use App Password if 2FA is enabled)
// Create App Password: Google Account → Security → 2-Step Verification → App passwords
define('SMTP_HOST', 'smtp.gmail.com');
define('SMTP_PORT', 587);
define('SMTP_USER', 'your-gmail@gmail.com');
define('SMTP_PASS', 'your-16-char-app-password');
define('MAIL_FROM_EMAIL', 'your-gmail@gmail.com');
define('MAIL_FROM_NAME', 'Palawan Health Office - Document Archive');
