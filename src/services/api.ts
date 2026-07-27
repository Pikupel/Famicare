import { useAuthStore } from '../stores/useAuthStore';

export const BASE_URL = 'https://famicare-production-f63d.up.railway.app/api/v1';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal,
    });
    if (res.status === 401) { useAuthStore.getState().logout(); throw new Error('Oturum süresi doldu'); }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Sunucu yanıt vermiyor' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  } catch (e: any) {
    if (e.name === 'AbortError') throw new Error('Sunucu zaman aşımı. Bağlantınızı kontrol edin.');
    if (e.message?.includes('Network request failed')) throw new Error('API sunucusuna bağlanılamıyor.');
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};
