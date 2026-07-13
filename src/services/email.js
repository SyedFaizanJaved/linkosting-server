import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

function transporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_ADDRESS, pass: process.env.EMAIL_APP_PASSWORD },
  });
}

const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// Wrap the plain-text body in a branded HTML shell that matches the web UI
// (accent #5B63F5, Manrope, card on canvas). URLs become links; newlines break.
export function renderEmail(subject, text) {
  const body = esc(text)
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:#5B63F5;text-decoration:none">$1</a>')
    .replace(/\n/g, '<br>');
  return `<!doctype html><html><body style="margin:0;background:#F6F3EE;font-family:'Manrope',Arial,sans-serif;color:#23222B">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">
    <div style="display:flex;align-items:center;gap:10px;padding:2px 4px 18px">
      <span style="display:inline-block;width:30px;height:30px;border-radius:9px;background:#5B63F5;color:#fff;font-weight:800;text-align:center;line-height:30px;font-size:15px">L</span>
      <span style="font-size:18px;font-weight:800;letter-spacing:-.01em">Linkosting</span>
    </div>
    <div style="background:#fff;border-radius:16px;padding:24px;box-shadow:0 4px 14px rgba(35,30,60,.06)">
      <h1 style="margin:0 0 14px;font-size:18px;font-weight:800">${esc(subject)}</h1>
      <div style="font-size:14.5px;line-height:1.6;color:#3a3846">${body}</div>
    </div>
    <p style="text-align:center;color:#9A97A6;font-size:12px;margin:18px 0 0">Sent by Linkosting · your LinkedIn assistant</p>
  </div></body></html>`;
}

export async function sendMail(subject, text, to = process.env.APPROVER_EMAIL) {
  await transporter().sendMail({
    from: process.env.EMAIL_ADDRESS,
    to,
    subject,
    text,
    html: renderEmail(subject, text),
  });
}

export async function fetchApprovalReply(draftId) {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: process.env.EMAIL_ADDRESS, pass: process.env.EMAIL_APP_PASSWORD },
    logger: false,
  });
  await client.connect();
  let latest = null;
  try {
    await client.mailboxOpen('INBOX');
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const uids = (await client.search({ since, subject: `[LI-Draft #${draftId}]` })) || [];
    for (const uid of uids) {
      const msg = await client.fetchOne(uid, { source: true });
      const parsed = await simpleParser(msg.source);
      if (!/^re:/i.test((parsed.subject || '').trim())) continue;
      const from = parsed.from?.value?.[0]?.address?.toLowerCase() || '';
      if (from !== process.env.APPROVER_EMAIL.toLowerCase()) continue;
      if (!latest || parsed.date > latest.date) latest = parsed;
    }
  } finally {
    await client.logout();
  }
  return latest?.text?.trim() || null;
}
