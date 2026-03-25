import { API_BASE } from '../lib/constants';

function getAuthToken(): string {
  // Prefer JWT from GitHub OAuth
  const token = localStorage.getItem('agent-pool-token');
  if (token) return token;
  // Fall back to API key for backward compat
  return localStorage.getItem('agent-pool-api-key') || 'dev-key';
}

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getAuthToken()}`,
  };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('agent-pool-token');
    window.location.reload();
    throw new Error('Unauthorized');
  }

  const json = await res.json();

  if (!res.ok) {
    const message = json?.error?.message || json?.message || `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return json.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
