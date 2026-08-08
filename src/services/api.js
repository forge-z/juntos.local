export class ApiError extends Error {
  constructor(code, message, status, fields) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fields = fields;
    this.message = code;
  }
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    options.body = JSON.stringify(options.body);
  }
  const response = await fetch(`/api/v1${path}`, { credentials: 'include', ...options, headers });
  let payload = null;
  try { payload = await response.json(); } catch { /* empty response */ }
  if (!response.ok) {
    const error = payload?.error || {};
    throw new ApiError(error.code || 'request_failed', error.message || 'Falha na requisição', response.status, error.fields);
  }
  return payload;
}
