import { API_BASE } from '../lib/constants';

function getAuthToken(): string {
  // Prefer JWT from GitHub OAuth
  const token = localStorage.getItem('agent-pool-token');
  if (token) return token;
  // Fall back to API key (configured by user, not hardcoded)
  const apiKey = localStorage.getItem('agent-pool-api-key');
  if (apiKey) return apiKey;
  // No auth available — requests will be rejected with 401
  return '';
}

function headers(): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) {
    h.Authorization = `Bearer ${token}`;
  }
  return h;
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

async function requestFormData<T>(method: string, path: string, formData: FormData): Promise<T> {
  const token = getAuthToken();
  const requestHeaders: HeadersInit = {};
  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }
  // Don't set Content-Type for FormData - browser will set it with boundary

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: requestHeaders,
    body: formData,
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
  postFormData: <T>(path: string, formData: FormData) => requestFormData<T>('POST', path, formData),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
