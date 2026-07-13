const redirectUri = () => `${process.env.SERVER_URL}/api/linkedin/callback`;

export function authUrl(state) {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: redirectUri(),
    scope: 'openid profile w_member_social',
    state,
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

export function buildShareContent({ text, assetUrn }) {
  const share = { shareCommentary: { text }, shareMediaCategory: assetUrn ? 'IMAGE' : 'NONE' };
  if (assetUrn) share.media = [{ status: 'READY', media: assetUrn }];
  return { 'com.linkedin.ugc.ShareContent': share };
}

export async function uploadImage(bytes, mime, token, memberUrn) {
  const reg = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: memberUrn,
        serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
      },
    }),
  });
  if (!reg.ok) throw new Error(`LinkedIn registerUpload failed ${reg.status}: ${await reg.text()}`);
  const j = await reg.json();
  const uploadUrl = j.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
  const assetUrn = j.value.asset;

  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': mime || 'image/png' },
    body: bytes,
  });
  if (!put.ok) throw new Error(`LinkedIn image upload failed ${put.status}: ${await put.text()}`);
  return assetUrn;
}

export async function createPost(text, token, memberUrn, image = null) {
  const assetUrn = image ? await uploadImage(image.bytes, image.mime, token, memberUrn) : null;
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
      specificContent: buildShareContent({ text, assetUrn }),
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });
  if (!res.ok) throw new Error(`LinkedIn post failed ${res.status}: ${await res.text()}`);
  return res.headers.get('x-restli-id') || (await res.json()).id;
}
