import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

export const query = (text, params) => pool.query(text, params);

export async function getSetting(key) {
  const { rows: [r] } = await query('SELECT value FROM settings WHERE key=$1', [key]);
  return r?.value ?? null;
}

export async function setSetting(key, value) {
  await query(
    'INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2',
    [key, value]
  );
}

export async function getAllSettings() {
  const { rows } = await query('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}
