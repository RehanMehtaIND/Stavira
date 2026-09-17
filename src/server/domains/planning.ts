import { validatePlan, type Goal } from '../../domain/schema';
import { AppError } from '../errors';
import type { DomainHandler } from '../service-context';
export const planningDomain: DomainHandler = async (ctx, user, method, path) => {
  const [domain, key] = path.split('/').filter(Boolean);
  const now = new Date().toISOString();
  if (domain === 'planning' && method === 'POST') {
    const { data: goal, revision } = await ctx.get<Goal>(user, 'goal', key);
    if (goal.status !== 'draft' || goal.tasks.some((t) => t.status !== 'pending'))
      throw new AppError(409, 'Only unstarted draft plans can be regenerated.');
    const plan = validatePlan(await ctx.ai.plan(goal));
    if (
      plan.tasks.some(
        (t) => t.status !== 'pending' || t.startedAt || t.completedAt || t.postponedUntil,
      )
    )
      throw new AppError(502, 'AI returned invalid execution state. Retry planning.');
    const updated = { ...goal, ...plan, revision: revision + 1, updatedAt: now };
    await ctx.repo.commit(user, [
      { kind: 'goal', id: key, data: updated, expectedRevision: revision },
    ]);
    return updated;
  }
  throw new AppError(404, 'Endpoint not found.');
};
