#!/usr/bin/env node
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const argv = process.argv.slice(2);
const base = argv.find((arg) => arg.startsWith('http://') || arg.startsWith('https://'));
if (!base) {
  console.error(
    '用法: node scripts/deploy/smoke.mjs <baseUrl> [--insecure] [--redirect <httpUrl>]',
  );
  process.exit(2);
}

const insecure = argv.includes('--insecure');
const redirectIndex = argv.indexOf('--redirect');
const redirectBase = redirectIndex >= 0 ? argv[redirectIndex + 1] : '';
const baseUrl = base.replace(/\/$/, '');
const isHttps = baseUrl.startsWith('https://');

function fetchUrl(url, options = {}) {
  const target = new URL(url);
  const requester = target.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const request = requester(
      target,
      {
        method: options.method ?? 'GET',
        headers: options.headers,
        rejectUnauthorized: target.protocol === 'https:' ? !insecure : undefined,
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    request.on('error', reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}

const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass: Boolean(pass), detail });
}

const home = await fetchUrl(`${baseUrl}/`);
check(
  '首页返回 200 HTML',
  home.status === 200 && /text\/html/.test(home.headers['content-type'] ?? ''),
);
check('首页包含 SPA 挂载点', home.body.includes('id="root"') || home.body.includes('/assets/'));
check('X-Content-Type-Options: nosniff', home.headers['x-content-type-options'] === 'nosniff');
check(
  'CSP 包含 default-src self',
  /default-src 'self'/.test(home.headers['content-security-policy'] ?? ''),
);
check(
  'CSP 禁止被嵌入',
  /frame-ancestors 'none'/.test(home.headers['content-security-policy'] ?? ''),
);
if (isHttps) {
  check('HSTS 已开启', /max-age=\d+/.test(home.headers['strict-transport-security'] ?? ''));
  check(
    'HSTS 包含 includeSubDomains',
    /includeSubDomains/i.test(home.headers['strict-transport-security'] ?? ''),
  );
}
check('首页缓存策略 no-cache', (home.headers['cache-control'] ?? '').includes('no-cache'));

const health = await fetchUrl(`${baseUrl}/api/v1/health`);
check('健康检查 200', health.status === 200);
check('健康检查返回 ok', /"ok"\s*:\s*true/.test(health.body));

const session = await fetchUrl(`${baseUrl}/api/v1/session`);
const sessionBody = (() => {
  try {
    return JSON.parse(session.body);
  } catch {
    return {};
  }
})();
const setCookie = String(session.headers['set-cookie'] ?? '');
check('会话接口 200 且返回 CSRF', session.status === 200 && sessionBody.csrfToken?.length === 64);
check('会话 Cookie HttpOnly', /HttpOnly/i.test(setCookie));
check('会话 Cookie SameSite=Lax', /SameSite=Lax/i.test(setCookie));
if (isHttps) check('会话 Cookie Secure', /Secure/i.test(setCookie));

const relay = await fetchUrl(`${baseUrl}/api/v1/ai/relay`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    baseUrl: 'https://example.com/v1/chat/completions',
    apiKey: 'sk-smoke',
    model: 'smoke',
    messages: [{ role: 'user', content: 'ping' }],
  }),
});
check('AI 中转无会话返回 401', relay.status === 401 && relay.body.includes('UNAUTHORIZED'));

const missingApi = await fetchUrl(`${baseUrl}/api/v1/does-not-exist`);
check(
  '未知 API 返回 JSON 404',
  missingApi.status === 404 && /application\/json/.test(missingApi.headers['content-type'] ?? ''),
);

const spa = await fetchUrl(`${baseUrl}/board/pre-setup?step=2`);
check('SPA fallback 返回首页 HTML', spa.status === 200 && spa.body.includes('id="root"'));

const assetPath = home.body.match(/\/assets\/[^"']+\.js/)?.[0];
if (assetPath) {
  const asset = await fetchUrl(`${baseUrl}${assetPath}`, {
    headers: { 'accept-encoding': 'gzip' },
  });
  check('静态资源 200', asset.status === 200);
  check('静态资源长缓存', (asset.headers['cache-control'] ?? '').includes('immutable'));
  check('静态资源 gzip', (asset.headers['content-encoding'] ?? '').includes('gzip'));
}

if (redirectBase) {
  const target = `${redirectBase.replace(/\/$/, '')}/board/pre-setup?step=2`;
  const redirect = await fetchUrl(target);
  check('HTTP 301 跳转 HTTPS', redirect.status === 301);
  check(
    '跳转保留路径与查询',
    (redirect.headers.location ?? '').startsWith('https://') &&
      (redirect.headers.location ?? '').endsWith('/board/pre-setup?step=2'),
  );
}

const passed = results.filter((item) => item.pass).length;
for (const item of results) {
  console.log(
    `${item.pass ? 'PASS' : 'FAIL'}  ${item.name}${item.detail ? `  (${item.detail})` : ''}`,
  );
}
console.log(`SUMMARY ${passed}/${results.length} passed`);
console.log(
  JSON.stringify({ base: baseUrl, https: isHttps, passed, total: results.length, results }),
);
process.exit(passed === results.length ? 0 : 1);
