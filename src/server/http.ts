import { AppError } from './errors';
import { required } from './config';
export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected =
    process.env.APP_ORIGIN ??
    (process.env.NODE_ENV === 'production' ? required('APP_ORIGIN') : 'http://127.0.0.1:3000');
  if (!origin || origin !== expected) throw new AppError(403, 'Request origin is not allowed.');
}
export async function readBody(request: Request) {
  const text = await request.text();
  if (text.length > 250000) throw new AppError(413, 'The request is too large.');
  try {
    return JSON.parse(text || '{}') as unknown;
  } catch {
    throw new AppError(400, 'Invalid JSON request.');
  }
}
