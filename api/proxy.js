export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const url = new URL(req.url);
  const path = url.searchParams.get('path') || '/';
  const gameId = url.searchParams.get('game') || '3790681b69584409b7f681a8e400102d';
  
  const targetUrl = `https://html5.gamedistribution.com/${gameId}/`;

  const response = await fetch(targetUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  const headers = new Headers(response.headers);
  headers.delete('X-Frame-Options');
  headers.delete('Content-Security-Policy');
  headers.set('Access-Control-Allow-Origin', '*');

  let body = await response.text();
  const origin = url.origin;
  body = body
    .replaceAll('https://html5.gamedistribution.com', origin + '/api/proxy')
    .replaceAll('//html5.gamedistribution.com', origin + '/api/proxy');

  return new Response(body, { status: response.status, headers });
}
