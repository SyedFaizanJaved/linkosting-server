import test from 'node:test';
import assert from 'node:assert';
import { renderEmail } from '../src/services/email.js';

test('renderEmail brands, escapes, links, and preserves line breaks', () => {
  const html = renderEmail('Today\'s draft', 'Line one <b>\nRead more: https://x.com/a');
  assert.ok(html.includes('Linkosting'), 'brand missing');
  assert.ok(html.includes('&lt;b&gt;'), 'html not escaped');
  assert.ok(html.includes('<a href="https://x.com/a"'), 'url not linkified');
  assert.ok(html.includes('<br>'), 'newline not preserved');
});
