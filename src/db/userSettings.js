import { query } from './index.js';

const DEFAULTS = {
  topics: '', tone: '', hashtags: '', feeds: '[]', default_post_time: '12:00',
  onboarded: false, daily_draft_enabled: false,
  linkedin_token: null, linkedin_member_urn: null, linkedin_token_expires_at: null,
  linkedin_oauth_state: null, gen_count: 0, image_count: 0, usage_date: null,
  notif_read: '[]', notif_dismissed: '[]',
};

const COLS = Object.keys(DEFAULTS);

export async function getUserSettings(userId) {
  const { rows: [r] } = await query('SELECT * FROM user_settings WHERE user_id=$1', [userId]);
  return r ? { ...DEFAULTS, ...r } : { ...DEFAULTS, user_id: userId };
}

export async function updateUserSettings(userId, patch) {
  const keys = Object.keys(patch).filter(k => COLS.includes(k));
  if (!keys.length) return;
  const setList = keys.map((k, i) => `${k}=$${i + 2}`).join(', ');
  const insertCols = ['user_id', ...keys].join(', ');
  const insertVals = ['$1', ...keys.map((_, i) => `$${i + 2}`)].join(', ');
  await query(
    `INSERT INTO user_settings (${insertCols}) VALUES (${insertVals})
     ON CONFLICT (user_id) DO UPDATE SET ${setList}`,
    [userId, ...keys.map(k => patch[k])]
  );
}

export function nextUsage(row, today, kind) {
  const cap = kind === 'image' ? Number(process.env.DAILY_IMAGE_CAP || 5) : Number(process.env.DAILY_TEXT_CAP || 10);
  const pad = n => String(n).padStart(2, '0');
  const usageDay = row.usage_date == null ? null
    : (row.usage_date instanceof Date
        ? `${row.usage_date.getFullYear()}-${pad(row.usage_date.getMonth() + 1)}-${pad(row.usage_date.getDate())}`
        : String(row.usage_date).slice(0, 10));
  const stale = usageDay == null || usageDay !== today;
  const gen = stale ? 0 : row.gen_count;
  const img = stale ? 0 : row.image_count;
  const current = kind === 'image' ? img : gen;
  if (current >= cap) return { gen_count: gen, image_count: img, usage_date: today, overCap: true };
  return {
    gen_count: kind === 'image' ? gen : gen + 1,
    image_count: kind === 'image' ? img + 1 : img,
    usage_date: today,
    overCap: false,
  };
}

export async function bumpUsage(userId, kind) {
  const today = new Date().toISOString().slice(0, 10);
  const s = await getUserSettings(userId);
  const u = nextUsage(s, today, kind);
  if (u.overCap) return false;
  await updateUserSettings(userId, { gen_count: u.gen_count, image_count: u.image_count, usage_date: u.usage_date });
  return true;
}
