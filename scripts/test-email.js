import 'dotenv/config';
import { sendMail, fetchApprovalReply } from '../src/services/email.js';

await sendMail('[LI-Draft #0] Email pipeline test', 'Reply OK to this email, then run this script again with CHECK=1.');
console.log('Sent test email.');
if (process.env.CHECK) {
  console.log('Reply found:', await fetchApprovalReply(0, process.env.APPROVER_EMAIL));
}
