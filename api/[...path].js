/* eslint-disable no-process-env */

function buildTargetUrl(req) {
  const upstream = (process.env.BACKEND_ORIGIN || 'https://api.social.manoverde.com').replace(/\/+$/, '');
  const pathParam = req.query.path;
  const pathSegments = Array.isArray(pathParam) ? pathParam : [pathParam];
  const cleanPath = pathSegments.filter(Boolean).map((p) => encodeURIComponent(String(p))).join('/');

  const search = new URLSearchParams();
  Object.entries(req.query || {}).forEach(([key, value]) => {
    if (key === 'path') return;
    if (Array.isArray(value)) {
      value.forEach((v) => search.append(key, String(v)));
      return;
    }
    if (value !== undefined && value !== null) {
      search.append(key, String(value));
    }
  });

  const queryString = search.toString();
  return `${upstream}/api/${cleanPath}${queryString ? `?${queryString}` : ''}`;
}

function pickHeaders(req) {
  const headers = {};
  const source = req.headers || {};
  const allowed = [
    'authorization',
    'content-type',
    'accept',
    'x-requested-with',
    'user-agent'
  ];

  allowed.forEach((name) => {
    if (source[name]) headers[name] = source[name];
  });
  return headers;
}

function parseBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  if (req.body === undefined || req.body === null) return undefined;
  if (Buffer.isBuffer(req.body) || typeof req.body === 'string') return req.body;
  return JSON.stringify(req.body);
}

module.exports = async function handler(req, res) {
  try {
    // Temporary compatibility: upstream API currently serves self-signed TLS.
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    const targetUrl = buildTargetUrl(req);
    const upstreamResponse = await fetch(targetUrl, {
      method: req.method,
      headers: pickHeaders(req),
      body: parseBody(req),
      redirect: 'follow'
    });

    res.statusCode = upstreamResponse.status;
    const contentType = upstreamResponse.headers.get('content-type');
    const contentDisposition = upstreamResponse.headers.get('content-disposition');
    if (contentType) res.setHeader('content-type', contentType);
    if (contentDisposition) res.setHeader('content-disposition', contentDisposition);
    res.setHeader('cache-control', 'no-store');

    const buffer = Buffer.from(await upstreamResponse.arrayBuffer());
    res.end(buffer);
  } catch (error) {
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      error: 'API backend indisponible via proxy',
      detail: error.message
    }));
  }
};

