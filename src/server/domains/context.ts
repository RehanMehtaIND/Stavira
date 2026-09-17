import { randomUUID } from 'node:crypto';
import { checkInSchema, type CheckIn } from '../../domain/schema';
import { workspace } from '../workspace';
import { AppError } from '../errors';
import type { DomainHandler } from '../service-context';
export const contextDomain: DomainHandler = async (ctx, user, method, path, body) => {
  const [domain] = path.split('/').filter(Boolean);
  const now = new Date().toISOString();
  if (domain === 'workspace' && method === 'GET') return workspace(ctx.repo, user);
  if (domain === 'check-ins' && method === 'POST') {
    const checkIn: CheckIn = { ...checkInSchema.parse(body), id: randomUUID(), createdAt: now };
    await ctx.repo.commit(user, [
      { kind: 'checkIn', id: checkIn.id, data: checkIn, expectedRevision: 0 },
    ]);
    return checkIn;
  }
  throw new AppError(404, 'Endpoint not found.');
};
