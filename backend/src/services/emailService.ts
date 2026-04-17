const nodemailer = require('nodemailer');

let transporter;

function hasEmailConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (transporter) return transporter;

  if (!hasEmailConfig()) {
    throw Object.assign(new Error('SMTP configuration is missing'), { code: 'SMTP_CONFIG_MISSING' });
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

async function sendUserWelcomePasswordEmail({ to, userName, ownerName, agencyName, password }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const subject = `Your TravelBot account for ${agencyName}`;

  const text = [
    `Hi ${userName},`,
    '',
    `${ownerName || 'Your owner'} created your TravelBot account for ${agencyName}.`,
    '',
    `Login email: ${to}`,
    `Temporary password: ${password}`,
    '',
    'Please log in and change your password after first sign in.',
    '',
    'Thanks,',
    'TravelBot Team',
  ].join('\n');

  await getTransporter().sendMail({
    from,
    to,
    subject,
    text,
  });
}

module.exports = {
  sendUserWelcomePasswordEmail,
};
