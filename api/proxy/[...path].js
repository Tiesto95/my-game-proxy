export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const url = new URL(req.url);
  const fullPath = url.pathname.replace('/api/proxy', '') || '/';
  const search = url.search || '';

  // Определяем нужный поддомен по префиксу пути
  let targetHost = 'html5.gamedistribution.com';
  let cleanPath = fullPath;

  if (fullPath.startsWith('/html5api')) {
    targetHost = 'html5.api.gamedistribution.com';
    cleanPath = fullPath.replace('/html5api', '') || '/';
  } else if (fullPath.startsWith('/gameapi')) {
    targetHost = 'game.api.gamedistribution.com';
    cleanPath = fullPath.replace('/gameapi', '') || '/';
  } else if (fullPath.startsWith('/imgapi')) {
    targetHost = 'img.gamedistribution.com';
    cleanPath = fullPath.replace('/imgapi', '') || '/';
  } else if (fullPath.startsWith('/pmapi')) {
    targetHost = 'pm.gamedistribution.com';
    cleanPath = fullPath.replace('/pmapi', '') || '/';
  }

  const targetUrl = `https://${targetHost}${cleanPath}${search}`;

  const response = await fetch(targetUrl, {
    method: req.method,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': `https://${targetHost}/`,
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
    let body = await response.text();
    const origin = url.origin;
    const proxyBase = origin + '/api/proxy';

    body = body
      .replaceAll('https://html5.api.gamedistribution.com', proxyBase + '/html5api')
      .replaceAll('http://html5.api.gamedistribution.com', proxyBase + '/html5api')
      .replaceAll('//html5.api.gamedistribution.com', proxyBase + '/html5api')
      .replaceAll('https://game.api.gamedistribution.com', proxyBase + '/gameapi')
      .replaceAll('http://game.api.gamedistribution.com', proxyBase + '/gameapi')
      .replaceAll('//game.api.gamedistribution.com', proxyBase + '/gameapi')
      .replaceAll('https://img.gamedistribution.com', proxyBase + '/imgapi')
      .replaceAll('http://img.gamedistribution.com', proxyBase + '/imgapi')
      .replaceAll('//img.gamedistribution.com', proxyBase + '/imgapi')
      .replaceAll('https://pm.gamedistribution.com', proxyBase + '/pmapi')
      .replaceAll('http://pm.gamedistribution.com', proxyBase + '/pmapi')
      .replaceAll('//pm.gamedistribution.com', proxyBase + '/pmapi')
      .replaceAll('https://html5.gamedistribution.com', proxyBase)
      .replaceAll('http://html5.gamedistri
