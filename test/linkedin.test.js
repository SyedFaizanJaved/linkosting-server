import test from 'node:test';
import assert from 'node:assert';

process.env.LINKEDIN_CLIENT_ID = 'cid';
process.env.SERVER_URL = 'https://srv.example';

const { authUrl } = await import('../src/services/linkedin.js');

test('authUrl embeds state, client id, redirect uri, scope', () => {
  const u = new URL(authUrl('my-state'));
  assert.equal(u.origin + u.pathname, 'https://www.linkedin.com/oauth/v2/authorization');
  assert.equal(u.searchParams.get('state'), 'my-state');
  assert.equal(u.searchParams.get('client_id'), 'cid');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://srv.example/api/linkedin/callback');
  assert.equal(u.searchParams.get('scope'), 'openid profile w_member_social');
});

import { buildShareContent } from '../src/services/linkedin.js';

test('buildShareContent NONE branch has no media when no asset', () => {
  const c = buildShareContent({ text: 'hi', assetUrn: null });
  const share = c['com.linkedin.ugc.ShareContent'];
  assert.equal(share.shareMediaCategory, 'NONE');
  assert.equal(share.shareCommentary.text, 'hi');
  assert.ok(!('media' in share));
});

test('buildShareContent IMAGE branch references the asset', () => {
  const c = buildShareContent({ text: 'hi', assetUrn: 'urn:li:digitalmediaAsset:ABC' });
  const share = c['com.linkedin.ugc.ShareContent'];
  assert.equal(share.shareMediaCategory, 'IMAGE');
  assert.deepEqual(share.media, [{ status: 'READY', media: 'urn:li:digitalmediaAsset:ABC' }]);
});
