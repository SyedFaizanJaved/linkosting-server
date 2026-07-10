import { Router } from 'express';
import { query } from '../db/index.js';
import { requireJwt } from '../middleware/auth.js';
import { ah } from '../util.js';
import { weekSeries } from '../services/analytics.js';

const router = Router();
router.use(requireJwt);

router.get('/', ah(async (req, res) => {
  const [statuses, topics, weeks, metrics] = await Promise.all([
    query(`SELECT status, count(*)::int AS count FROM drafts GROUP BY status`),
    query(`SELECT COALESCE(topic,'(none)') AS topic, count(*)::int AS count FROM drafts GROUP BY 1 ORDER BY 2 DESC`),
    query(`SELECT date_trunc('week', posted_at) AS week, count(*)::int AS count
           FROM drafts WHERE status='posted' AND posted_at > now() - interval '8 weeks' GROUP BY 1`),
    query(`SELECT COALESCE(SUM(impressions),0)::int AS impressions,
                  COALESCE(SUM(reactions),0)::int AS reactions,
                  COALESCE(SUM(comments),0)::int AS comments,
                  count(*) FILTER (WHERE impressions IS NOT NULL)::int AS tracked_posts
           FROM drafts WHERE status='posted'`),
  ]);
  const byStatus = Object.fromEntries(statuses.rows.map(r => [r.status, r.count]));
  const posted = byStatus.posted || 0;
  const skipped = byStatus.skipped || 0;
  res.json({
    byStatus,
    perTopic: topics.rows,
    postsPerWeek: weekSeries(weeks.rows),
    metrics: metrics.rows[0],
    approvalRate: posted + skipped ? posted / (posted + skipped) : null,
  });
}));

export default router;
