export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const url = new URL(req.url);
  const path = url.pathname.replace('/api/proxy', '') || '/';
  const search = url.search || '';
  
  const targetUrl = `https://html5.gamedistribution.com${path}${search}`;

  const response = await fetch(targetUrl, {
    method: req.method,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const headers = new Headers(response.headers);

  // Убираем блокирующие заголовки
  headers.delete('X-Frame-Options');
  headers.delete('Content-Security-Policy');
  headers.delete('x-frame-options');
  headers.set('Access-Control-Allow-Origin', '*');

  // Если HTML или JS — переписываем ссылки
  if (contentType.includes('text/html') || contentType.includes('javascript')) {
    let body = await response.text();
    const origin = url.origin;

    body = body
      .replaceAll('https://html5.gamedistribution.com', origin + '/api/proxy')
      .replaceAll('http://html5.gamedistribution.com', origin + '/api/proxy')
      .replaceAll('//html5.gamedistribution.com', origin + '/api/proxy');

    return new Response(body, {
      status: response.status,
      headers,
    });
  }

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
