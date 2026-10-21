let csrfToken = null;
let onExpired = () => {};

export function configureSession(token, expired) {
  csrfToken = token;
  if (expired) onExpired = expired;
}

export async function request(path, { method = 'GET', data, ...options } = {}) {
  const response = await fetch(path, {
    ...options, method, credentials: 'same-origin', cache: 'no-store',
    headers: {
      ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...options.headers
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {})
  });
  if (response.status === 401) {
    onExpired();
    throw new Error('Sua sessão terminou. Entre novamente.');
  }
  if (response.status === 404 && /^\/api\/registros\/\d{4}-/.test(path)) return null;
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.erro || 'Não foi possível comunicar com o servidor. Tente novamente.');
  }
  return response.status === 204 ? null : response.json();
}
