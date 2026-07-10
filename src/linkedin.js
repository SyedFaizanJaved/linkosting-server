const redirectUri = () => `${process.env.SERVER_URL}/api/linkedin/callback`;

export function authUrl() {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: redirectUri(),
    scope: 'openid profile w_member_social',
    state: 'li-connect',
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${p}`;
}

export async function exchangeCode(code) {
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`LinkedIn token exchange failed: ${await res.text()}`);
  const { access_token, expires_in } = await res.json();

  const ures = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { authorization: `Bearer ${access_token}` },
  });
  if (!ures.ok) throw new Error(`LinkedIn userinfo failed: ${await ures.text()}`);
  const { sub } = await ures.json();

  return {
    token: access_token,
    expiresAt: new Date(Date.now() + expires_in * 1000).toISOString(),
    memberUrn: `urn:li:person:${sub}`,
  };
}

export async function createPost(text, token, memberUrn) {
  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: memberUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });
  if (!res.ok) throw new Error(`LinkedIn post failed ${res.status}: ${await res.text()}`);
  return res.headers.get('x-restli-id') || (await res.json()).id;
}
