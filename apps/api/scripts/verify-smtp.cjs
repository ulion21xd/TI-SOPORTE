const nodemailer = require('nodemailer');

const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error(`SMTP verification not run. Missing local variables: ${missing.join(', ')}`);
  process.exitCode = 1;
} else {
  const port = Number(process.env.SMTP_PORT);
  const secure = process.env.SMTP_SECURE.trim().toLowerCase();
  if (!Number.isInteger(port) || port <= 0 || !['true', 'false'].includes(secure)) {
    console.error('SMTP verification not run. SMTP_PORT or SMTP_SECURE has an invalid format.');
    process.exitCode = 1;
  } else {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST.trim(),
      port,
      secure: secure === 'true',
      auth: { user: process.env.SMTP_USER.trim(), pass: process.env.SMTP_PASS },
    });
    transporter.verify().then(() => {
      console.log('SMTP connection and authentication verified. No email was sent.');
    }).catch((error) => {
      if (error.code === 'EAUTH') {
        console.error('SMTP server rejected authentication. Check SMTP_USER and the password for this mailbox in local .env. No email was sent.');
      } else {
        console.error(`SMTP verification failed; error code: ${error.code || 'unknown'}. No email was sent.`);
      }
      process.exitCode = 1;
    }).finally(() => transporter.close());
  }
}
