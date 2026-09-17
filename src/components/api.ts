import { redirect } from 'next/navigation';
export async function api<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
  retry = true,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(35000),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 401 && retry && !path.startsWith('auth/')) {
    const refresh = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(35000),
      body: '{}',
    });
    if (refresh.ok) return api(path, body, method, false);
    redirect('/signin');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? 'Request failed. Please try again.');
  return data as T;
}
