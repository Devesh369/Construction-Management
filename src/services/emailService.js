/**
 * BuildSphere — Email Dispatch Service
 * Handles credentials delivery for new team members and invitation links.
 * Supports Resend API integration, mailto client fallback, and local outbox delivery logging.
 */

export const getResendApiKey = () => {
  return (
    localStorage.getItem('cmp_resend_api_key') ||
    import.meta.env?.VITE_RESEND_API_KEY ||
    ''
  );
};

export const setResendApiKey = (key) => {
  if (key) localStorage.setItem('cmp_resend_api_key', key.trim());
  else localStorage.removeItem('cmp_resend_api_key');
};

export const getFromEmail = () => {
  return (
    localStorage.getItem('cmp_resend_from_email') ||
    'BuildSphere <onboarding@resend.dev>'
  );
};

export const setFromEmail = (email) => {
  if (email) localStorage.setItem('cmp_resend_from_email', email.trim());
  else localStorage.removeItem('cmp_resend_from_email');
};

/**
 * Generate formatted HTML template for credential dispatch
 */
export const buildCredentialsEmailHtml = ({
  name,
  email,
  role,
  password,
  loginUrl,
  organizationName = 'BuildSphere org.',
}) => {
  const currentYear = new Date().getFullYear();
  const roleName = role ? role.replace(/_/g, ' ') : 'Team Member';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your BuildSphere Login Credentials</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #1e293b, #0f172a); padding: 32px 28px; text-align: center; color: #ffffff; }
    .logo { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; color: #38bdf8; margin-bottom: 4px; }
    .subtitle { font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; }
    .content { padding: 32px 28px; }
    .greeting { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 12px; }
    .text { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .credentials-box { background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .cred-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #166534; margin-bottom: 14px; }
    .cred-item { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 13px; }
    .cred-label { font-weight: 600; color: #475569; }
    .cred-value { font-family: monospace; font-size: 14px; font-weight: 700; color: #0f172a; background: #ffffff; padding: 4px 10px; border-radius: 6px; border: 1px solid #cbd5e1; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; font-weight: 800; font-size: 14px; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 14px rgba(37,99,235,0.3); }
    .security-notice { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; font-size: 12px; color: #991b1b; line-height: 1.5; margin-bottom: 24px; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">BuildSphere</div>
      <div class="subtitle">Construction Management Platform</div>
    </div>
    <div class="content">
      <div class="greeting">Welcome aboard, ${name || 'Team Member'}!</div>
      <p class="text">
        You have been registered as an authorized <strong>${roleName}</strong> in <strong>${organizationName}</strong> on the BuildSphere Construction Management Platform.
      </p>

      <div class="credentials-box">
        <div class="cred-title">Your Secure Login Credentials</div>
        <div class="cred-item">
          <span class="cred-label">Login Email:</span>
          <span class="cred-value">${email}</span>
        </div>
        <div class="cred-item">
          <span class="cred-label">Temporary Password:</span>
          <span class="cred-value">${password}</span>
        </div>
        <div class="cred-item">
          <span class="cred-label">Assigned Role:</span>
          <span class="cred-value" style="color: #2563eb;">${roleName}</span>
        </div>
      </div>

      <div class="btn-container">
        <a href="${loginUrl}" target="_blank" class="btn">Sign In to BuildSphere &rarr;</a>
      </div>

      <div class="security-notice">
        <strong>Security Recommendation:</strong> Please sign in using the password above and change your password upon first login under Account Settings. Do not share these credentials with unauthorized individuals.
      </div>
    </div>
    <div class="footer">
      This is an automated administrative notification dispatched by ${organizationName}.<br>&copy; ${currentYear} BuildSphere Technologies. All rights reserved.
    </div>
  </div>
</body>
</html>
  `.trim();
};

/**
 * Dispatch credentials email.
 * Attempts Resend API call if key is available, and logs to local outbox in all cases.
 */
export const dispatchMemberCredentialsEmail = async ({
  name,
  email,
  role,
  password,
  notification_email,
  organizationName = 'BuildSphere org.',
}) => {
  const targetEmail = (notification_email || email || '').trim();
  const loginUrl = window.location.origin;
  const apiKey = getResendApiKey();
  const fromEmail = getFromEmail();

  const html = buildCredentialsEmailHtml({
    name,
    email,
    role,
    password,
    loginUrl,
    organizationName,
  });

  const subject = `Welcome to BuildSphere — Your Login Credentials (${name || email})`;

  let deliveryStatus = 'LOGGED_IN_OUTBOX';
  let apiResponse = null;
  let deliveryError = null;

  // Try real Resend API call if key is configured
  if (apiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [targetEmail],
          subject,
          html,
        }),
      });

      const data = await res.json();
      if (res.ok && data.id) {
        deliveryStatus = 'DELIVERED_RESEND';
        apiResponse = data;
      } else {
        deliveryStatus = 'RESEND_API_ERROR';
        deliveryError = data.message || 'Resend API returned an error';
      }
    } catch (err) {
      deliveryStatus = 'NETWORK_ERROR';
      deliveryError = err.message || 'Network request to Resend failed';
    }
  }

  // Create delivery log record
  const record = {
    id: `email_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
    recipient: targetEmail,
    member_name: name || 'Team Member',
    member_email: email,
    role,
    password,
    subject,
    status: deliveryStatus,
    delivery_provider: apiKey ? 'Resend' : 'Local Outbox / Client Mail',
    api_response: apiResponse,
    error_message: deliveryError,
    login_url: loginUrl,
  };

  // Save to localStorage outbox
  try {
    const existing = JSON.parse(localStorage.getItem('cmp_dispatched_emails') || '[]');
    existing.unshift(record);
    // Keep last 100 emails
    localStorage.setItem('cmp_dispatched_emails', JSON.stringify(existing.slice(0, 100)));
  } catch (e) {
    console.warn('Could not save email log:', e);
  }

  return record;
};

/**
 * Generate a mailto link with prefilled subject and body
 * so the administrator can send it directly from their native mail client with 1 click.
 */
export const generateMailtoLink = ({ name, email, role, password, loginUrl }) => {
  const subject = encodeURIComponent(`Your BuildSphere Login Credentials`);
  const body = encodeURIComponent(
    `Hello ${name || 'Team Member'},\n\n` +
      `Your account has been set up on the BuildSphere Construction Management Platform.\n\n` +
      `-----------------------------------------\n` +
      `LOGIN CREDENTIALS:\n` +
      `Portal URL: ${loginUrl || window.location.origin}\n` +
      `Login Email: ${email}\n` +
      `Temporary Password: ${password}\n` +
      `Assigned Role: ${role ? role.replace(/_/g, ' ') : 'Member'}\n` +
      `-----------------------------------------\n\n` +
      `Please sign in and change your password upon first login.\n\n` +
      `Best regards,\nBuildSphere Administration`
  );

  return `mailto:${email}?subject=${subject}&body=${body}`;
};
