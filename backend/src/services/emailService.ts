const nodemailer = require('nodemailer');

let transporter;
const BRAND_NAME = 'WAYON';

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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildLoginUrl() {
  const baseUrl = String(process.env.BASE_URL || 'https://travelbot.wayon.in').replace(/\/+$/, '');
  return `${baseUrl}/login`;
}

async function sendUserWelcomePasswordEmail({ to, userName, ownerName, agencyName, password }) {
  const from = process.env.SMTP_FROM || `"${BRAND_NAME}" <${process.env.SMTP_USER}>`;
  const loginUrl = buildLoginUrl();
  const safeUserName = escapeHtml(userName || 'there');
  const safeOwnerName = escapeHtml(ownerName || 'Your administrator');
  const safeAgencyName = escapeHtml(agencyName || 'your agency');
  const safeEmail = escapeHtml(to);
  const safePassword = escapeHtml(password);
  const safeLoginUrl = escapeHtml(loginUrl);
  const subject = `Your ${BRAND_NAME} access for ${agencyName}`;

  const text = [
    `Hi ${userName || 'there'},`,
    '',
    `${ownerName || 'Your administrator'} created your ${BRAND_NAME} account for ${agencyName}.`,
    '',
    `Login email: ${to}`,
    `Temporary password: ${password}`,
    `Login: ${loginUrl}`,
    '',
    'Please log in and change your password after first sign in.',
    '',
    'Thanks,',
    `${BRAND_NAME} Team`,
  ].join('\n');

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f1eb;color:#17202a;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1eb;margin:0;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5ded2;border-radius:22px;overflow:hidden;box-shadow:0 18px 45px rgba(39,37,31,0.10);">
            <tr>
              <td style="background:#141414;padding:28px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-size:24px;font-weight:800;letter-spacing:3px;color:#ffffff;">${BRAND_NAME}</td>
                    <td align="right" style="font-size:12px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#c7a56a;">Travel Workspace</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:38px 32px 26px;">
                <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#b48745;">Account Access</p>
                <h1 style="margin:0;color:#141414;font-size:30px;line-height:1.18;font-weight:800;">Your ${BRAND_NAME} workspace is ready</h1>
                <p style="margin:18px 0 0;color:#59616d;font-size:16px;line-height:1.65;">Hi ${safeUserName}, ${safeOwnerName} created your account for <strong style="color:#252525;">${safeAgencyName}</strong>. Use the secure temporary credentials below to sign in.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 10px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #eee3d4;border-radius:18px;background:#fbf8f3;">
                  <tr>
                    <td style="padding:22px 24px;border-bottom:1px solid #eee3d4;">
                      <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#9d7a44;">Login Email</p>
                      <p style="margin:0;font-size:17px;font-weight:700;color:#141414;word-break:break-word;">${safeEmail}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:22px 24px;">
                      <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#9d7a44;">Temporary Password</p>
                      <p style="margin:0;display:inline-block;padding:12px 14px;border-radius:12px;background:#141414;color:#ffffff;font-family:Consolas,'Courier New',monospace;font-size:18px;font-weight:800;letter-spacing:.5px;word-break:break-all;">${safePassword}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 32px 12px;">
                <a href="${safeLoginUrl}" style="display:inline-block;background:#141414;color:#ffffff;text-decoration:none;border-radius:999px;padding:15px 28px;font-size:15px;font-weight:800;letter-spacing:.3px;">Sign in to ${BRAND_NAME}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 32px 36px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:16px;background:#f7efe3;">
                  <tr>
                    <td style="padding:16px 18px;color:#6b5b45;font-size:13px;line-height:1.6;">
                      For your security, change this temporary password after your first sign in. If you did not expect this invite, please contact your administrator.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px;background:#fbfaf8;border-top:1px solid #eee8dd;">
                <p style="margin:0;color:#8a8176;font-size:12px;line-height:1.6;">This email was sent by ${BRAND_NAME} for ${safeAgencyName}. Please do not share your temporary password with anyone except the intended account owner.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  await getTransporter().sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

module.exports = {
  sendUserWelcomePasswordEmail,
};
