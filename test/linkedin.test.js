import test from 'node:test';
import assert from 'node:assert';

process.env.LINKEDIN_CLIENT_ID = 'cid';
process.env.SERVER_URL = 'https://srv.example';

const { authUrl } = await import('../src/linkedin.js');

test('authUrl embeds state, client id, redirect uri, scope', () => {
  const u = new URL(authUrl('my-state'));
  assert.equal(u.origin + u.pathname, 'https://www.linkedin.com/oauth/v2/authorization');
  assert.equal(u.searchParams.get('state'), 'my-state');
  assert.equal(u.searchParams.get('client_id'), 'cid');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://srv.example/api/linkedin/callback');
  assert.equal(u.searchParams.get('scope'), 'openid profile w_member_social');
});
