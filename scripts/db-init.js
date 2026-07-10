import 'dotenv/config';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { pool, query, setSetting, getSetting } from '../src/db/index.js';

const schema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
await query(schema);

const defaults = {
  topics: 'Artificial Intelligence, Machine Learning',
  tone: 'Professional and insightful, first person, practical takeaways, no hype, no emojis.',
  hashtags: '#AI #MachineLearning',
  feeds: JSON.stringify([
    'https://www.technologyreview.com/feed/',
    'https://venturebeat.com/category/ai/feed/',
  ]),
  default_post_time: '12:00',
};
for (const [k, v] of Object.entries(defaults)) {
  if ((await getSetting(k)) === null) await setSetting(k, v);
}

if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
  await query(
    'INSERT INTO users (email, password_hash) VALUES ($1,$2) ON CONFLICT (email) DO UPDATE SET password_hash=$2',
    [process.env.ADMIN_EMAIL, hash]
  );
  console.log(`Admin user ready: ${process.env.ADMIN_EMAIL}`);
}
console.log('DB initialized');
await pool.end();
