import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

function transporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_ADDRESS, pass: process.env.EMAIL_APP_PASSWORD },
  });
}

export async function sendMail(subject, text) {
  await transporter().sendMail({
    from: process.env.EMAIL_ADDRESS,
    to: process.env.APPROVER_EMAIL,
    subject,
    text,
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
      const from = parsed.from?.value?.[0]?.address?.toLowerCase() || '';
      if (from !== process.env.APPROVER_EMAIL.toLowerCase()) continue;
      if (!latest || parsed.date > latest.date) latest = parsed;
    }
  } finally {
    await client.logout();
  }
  return latest?.text?.trim() || null;
}
