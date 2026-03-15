export const config = {
  runtime: 'edge',
};

const PROXY_BASE = '/api/proxy';

const PROXY_HOSTS = {
  '/html5api': 'html5.api.gamedistribution.com',
  '/gameapi':  'game.api.gamedistribution.com',
  '/imgapi':   'img.gamedistribution.com',
  '/pmapi':    'pm.gamedistribution.com',
  '/msert':    'msert.gamedistribution.com',
  '/tagapi':   'tag.atom.gamedistribution.com',
  '/hlapi':    'headerlift.gamedistribution.com',
};

const DEFAULT_HOST = 'html5.gamedistribution.com';

// Скрипт который патчит fetch/XHR в браузере
const INTERCEPT_SCRIPT = `
<script>
(function() {
  var BLOCKED = [
    'pub.headerlift.com',
    'cdn.fbra.io',
    'fbra.io',
    'headerlift.com',
    'googlesyndication.com',
    'doubleclick.net',
    'caeea42',
    'pagead',
  ];
  function isBlocked(url) {
    if (!url) return false;
    return BLOCKED.some(function(d) { return url.indexOf(d) !== -1; });
  }
  // Патчим fetch
  var origFetch = window.fetch;
  window.fetch = function(url, opts) {
    if (isBlocked(url)) {
      return Promise.resolve(new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
    }
    return origFetch.apply(this, arguments);
  };
  // Патчим XHR
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (isBlocked(url)) {
      this._blocked = true;
    }
    return origOpen.apply(this, arguments);
  };
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function() {
    if (this._blocked) {
      setTimeout(function() {
        Object.defineProperty(this, 'readyState', { value: 4 });
        Object.defineProperty(this, 'status', { value: 200 });
        Object.defineProperty(this, 'responseText', { value: '{}' });
        this.onreadystatechange && this.onreadystatechange();
        this.onload && this.onload();
      }.bind(this), 10);
      return;
    }
    return origSend.apply(this, arguments);
  };
  // Патчим создание script тегов для заблокированных доменов
  var origCreateElement = document.createElement.bind(document);
  document.createElement = function(tag) {
    var el = origCreateElement(tag);
    if (tag.toLowerCase() === 'script') {
      var origSetSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
      Object.defineProperty(el, 'src', {
        set: function(val) {
          if (isBlocked(val)) { return; }
          origSetSrc.set.call(this, val);
        },
        get: function() { return origSetSrc.get.call(this); }
      });
    }
    return el;
  };
})();
</script>
`;

function getTarget(fullPath) {
  for (const [prefix, host] of Object.entries(PROXY_HOSTS)) {
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
    ['https://msert.gamedistribution.com',     proxyBase + '/msert'],
    ['http://msert.gamedistribution.com',      proxyBase + '/msert'],
    ['//msert.gamedistribution.com',           proxyBase + '/msert'],
    ['https://tag.atom.gamedistribution.com',  proxyBase + '/tagapi'],
    ['http://tag.atom.gamedistribution.com',   proxyBase + '/tagapi'],
    ['//tag.atom.gamedistribution.com',        proxyBase + '/tagapi'],
    ['https://headerlift.gamedistribution.com',proxyBase + '/hlapi'],
    ['http://headerlift.gamedistribution.com', proxyBase + '/hlapi'],
    ['//headerlift.gamedistribution.com',      proxyBase + '/hlapi'],
    ['https://html5.gamedistribution.com',     proxyBase],
    ['http://html5.gamedistribution.com',      proxyBase],
    ['//html5.gamedistribution.com',           proxyBase],
  ];
  for (const [from, to] of replacements) {
    body = body.split(from).join(to);
  }
  // Вставляем скрипт-перехватчик сразу после <head>
  body = body.replace('<head>', '<head>' + INTERCEPT_SCRIPT);
  return body;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const fullPath = url.pathname.replace(PROXY_BASE, '') || '/';
  const search = url.search || '';

  if (fullPath.startsWith('/blocked')) {
    return new Response('{}', {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

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
