import { env } from '../config/env.js'

/**
 * Transactional email via Resend's HTTPS API (no SDK dependency).
 *
 * Delivery is deliberately not allowed to break the core flow: sign-up and
 * resend callers decide whether a failure is fatal. When RESEND_API_KEY is not
 * configured the server logs and reports that nothing was delivered, and
 * sign-up auto-verifies the account so students are never locked out.
 */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

type Mail = { to: string; subject: string; text: string; html: string }

async function sendMail(mail: Mail): Promise<boolean> {
  if (!env.mail.resendApiKey) {
    console.warn(`[mail] RESEND_API_KEY is not set; "${mail.subject}" was not delivered to ${mail.to}.`)
    return false
  }

  let response: Response
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.mail.resendApiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.mail.from,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
    })
  } catch (reason) {
    console.error('[mail] could not reach Resend:', reason)
    throw new Error('MAIL_DELIVERY_FAILED')
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error(`[mail] Resend rejected "${mail.subject}" (${response.status}): ${detail.slice(0, 400)}`)
    throw new Error('MAIL_DELIVERY_FAILED')
  }
  return true
}

function layout(heading: string, body: string, actionLabel: string, actionUrl: string) {
  return `<div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;color:#1f2937">
  <p style="margin:0 0 18px;font-size:13px;font-weight:700;color:#2563eb">RecappEdu</p>
  <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3">${escapeHtml(heading)}</h1>
  <p style="margin:0 0 22px;font-size:14px;line-height:1.65;color:#4b5563">${body}</p>
  <a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 18px;border-radius:8px">${escapeHtml(actionLabel)}</a>
  <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#6b7280">If the button does not work, paste this link into your browser:<br><span style="color:#2563eb;word-break:break-all">${escapeHtml(actionUrl)}</span></p>
  <p style="margin:18px 0 0;font-size:12px;color:#9ca3af">If you did not request this email, you can ignore it.</p>
</div>`
}

export async function sendVerificationEmail(input: { email: string; displayName: string | null; token: string }) {
  const url = `${env.mail.publicAppUrl}/#verify-email/${encodeURIComponent(input.token)}`
  const name = escapeHtml(input.displayName || 'there')
  return sendMail({
    to: input.email,
    subject: 'Verify your RecappEdu email',
    text: `Hi ${input.displayName || 'there'},\n\nConfirm your email to unlock AI practice sets and Learn with AI:\n${url}\n\nThis link expires in 24 hours.`,
    html: layout(
      'Confirm your email',
      `Hi ${name}, confirm this address to unlock AI practice sets and your AI tutor. The link expires in 24 hours.`,
      'Verify my email',
      url,
    ),
  })
}

export async function sendPasswordResetEmail(input: { email: string; displayName: string | null; token: string }) {
  const url = `${env.mail.publicAppUrl}/#reset/${encodeURIComponent(input.token)}`
  const name = escapeHtml(input.displayName || 'there')
  return sendMail({
    to: input.email,
    subject: 'Reset your RecappEdu password',
    text: `Hi ${input.displayName || 'there'},\n\nUse this link to choose a new password:\n${url}\n\nThis link expires in 30 minutes. Signing in elsewhere will require the new password.`,
    html: layout(
      'Choose a new password',
      `Hi ${name}, we received a request to reset your password. The link expires in 30 minutes and can be used once.`,
      'Reset my password',
      url,
    ),
  })
}
