import { cookies } from 'next/headers';
import { authenticate } from '@/server/auth';
import { service } from '@/server/runtime';
import { mode, required } from '@/server/config';
import { errorResponse } from '@/server/errors';
import { checkOrigin, readBody } from '@/server/http';
async function handle(req: Request, context: { params: Promise<{ path: string[] }> }) {
  const path = (await context.params).path.join('/');
  try {
    if (req.method !== 'GET') checkOrigin(req);
    const user = await authenticate();
    const body = req.method === 'GET' ? undefined : await readBody(req);
    if (mode() === 'aws') {
      const token = (await cookies()).get('stavira_session')!.value;
      const response = await fetch(`${required('STAVIRA_API_URL').replace(/\/$/, '')}/${path}`, {
        method: req.method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
        signal: AbortSignal.timeout(29000),
      });
      return new Response(await response.text(), {
        status: response.status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }
    return Response.json(await service().handle(user.id, req.method, path, body), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    const error = errorResponse(e, path);
    return Response.json(error.body, { status: error.status });
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
