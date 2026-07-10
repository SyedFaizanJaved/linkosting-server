function mondayOf(d) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7; // Mon=0
  x.setUTCDate(x.getUTCDate() - day);
  return x;
}

export function weekSeries(rows, weeks = 8, now = new Date()) {
  const byWeek = new Map(rows.map(r => [new Date(r.week).toISOString().slice(0, 10), Number(r.count)]));
  const out = [];
  const start = mondayOf(now);
  for (let i = weeks - 1; i >= 0; i--) {
    const w = new Date(start);
    w.setUTCDate(w.getUTCDate() - i * 7);
    const key = w.toISOString().slice(0, 10);
    out.push({ weekStart: key, count: byWeek.get(key) || 0 });
  }
  return out;
}
