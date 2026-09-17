import { authAction } from '@/server/auth';
import { errorResponse } from '@/server/errors';
import { checkOrigin, readBody } from '@/server/http';
export async function POST(req: Request, context: { params: Promise<{ action: string }> }) {
  try {
    checkOrigin(req);
    return Response.json(await authAction((await context.params).action, await readBody(req)));
  } catch (e) {
    const error = errorResponse(e, 'auth');
    return Response.json(error.body, { status: error.status });
  }
}
