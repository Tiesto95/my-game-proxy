export const config = {
  runtime: 'edge',
};

const PROXY_BASE = '/api/proxy';

const HOSTS = {
  '/html5api': 'html5.api.gamedistribution.com',
  '/gameapi':  'game.api.gamedistribution.com',
  '/imgapi':   'img.gamedistribution.com',
  '/pmapi':    'pm.gamedistribution.com',
};

const DEFAULT_HOST = 'html5.gamedistribution.com';

function getTarget(fullPath) {
  for (const [prefix, host] of Object.entries(HOSTS)) {
    if (fullPath.startsWith(prefix)) {
      return { host, cleanPath: fullPath.slice(prefix.length) || '/' };
    }
  }
  return { host: DEFAULT_HOST, cleanPath: fullPath || '/' };
}

function rewriteBody(body, proxyBase) {
  const replacements = [
    ['https://html5.api.gamedistribution.com', proxyBase + '/html5api'],
    ['http://html5.api.gamedistribution.com',  proxyBase + '/html5api'],
    ['//html5.api.gamedistribution.com',       proxyBase + '/html5api'],
    ['https://game.api.gamedistribution.com',  proxyBase + '/gameapi'],
    ['http://game.api.gamedistribution.com',   proxyBase + '/gameapi'],
    ['//game.api.gamedistribution.com',        proxyBase + '/gameapi'],
    ['https://img.gamedistribution.com',       proxyBase + '/imgapi'],
    ['http://img.gamedistribution.com',        proxyBase + '/imgapi'],
    ['//img.gamedistribution.com',             proxyBase + '/imgapi'],
    ['https://pm.gamedistribution.com',        proxyBase + '/pmapi'],
    ['http://pm.gamedistribution.com',         proxyBase + '/pmapi'],
    ['//pm.gamedistribution.com',              proxyBase + '/pmapi'],
    ['https://html5.gamedistribution.com',     proxyBase],
    ['http://html5.gamedistribution.com',      proxyBase],
    ['//html5.gamedistribution.com',           proxyBase],
  ];
  for (const [from, to] of replacements) {
    body = body.split(from).join(to);
  }
  return body;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const fullPath = url.pathname.replace(PROXY_BASE, '') || '/';
  const search = url.search || '';

  const { host, cleanPath } = getTarget(fullPath);
  const targetUrl = 'https://' + host + cleanPath + search;

  const response = await fetch(targetUrl, {
    method: req.method,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': '*/*',
      'Referer': 'https://' + host + '/',
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const headers = new Headers(response.headers);
  headers.delete('X-Frame-Options');
  headers.delete('x-frame-options');
  headers.delete('Content-Security-Policy');
  headers.delete('content-security-policy');
  headers.set('Access-Control-Allow-Origin', '*');

  if (contentType.includes('text/html') || contentType.includes('javascript')) {
    const body = await response.text();
    const proxyBase = url.origin + PROXY_BASE;
    const rewritten = rewriteBody(body, proxyBase);
    return new Response(rewritten, { status: response.status, headers });
  }

  return new Response(response.body, { status: response.status, headers });
}
