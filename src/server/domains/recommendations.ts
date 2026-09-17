import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { id, type Recommendation, type ExecutionEvent } from '../../domain/schema';
import { rank } from '../../domain/recommendation';
import type { Write } from '../repositories/types';
import { workspace } from '../workspace';
import { AppError } from '../errors';
import type { DomainHandler } from '../service-context';
export const recommendationsDomain: DomainHandler = async (ctx, user, method, path, body) => {
  const [domain] = path.split('/').filter(Boolean);
  const now = new Date().toISOString();
  if (domain === 'recommendations' && method === 'POST') {
    const input = z
      .object({
        exclude: z.array(z.string().min(1).max(170)).max(100).default([]),
        previousId: id.optional(),
      })
      .parse(body);
    const state = await workspace(ctx.repo, user);
    const context = state.checkIns.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!context) throw new AppError(400, 'Check in with your time and energy first.');
    const chosen = rank(state, context, new Date(now), input.exclude)[0];
    const writes: Write[] = [];
    if (input.previousId) {
      const row = await ctx.get<Recommendation>(user, 'recommendation', input.previousId);
      if (row.data.status === 'offered') {
        const task = state.goals
          .find((g) => g.id === row.data.goalId)
          ?.tasks.find((t) => t.id === row.data.taskId);
        if (task) {
          const event: ExecutionEvent = {
            id: randomUUID(),
            goalId: row.data.goalId,
            taskId: task.id,
            taskTitle: task.title,
            category: task.category,
            action: 'alternative',
            createdAt: now,
            estimatedMinutes: task.estimatedMinutes,
            recommendationId: row.data.id,
            checkIn: context,
          };
          writes.push(
            { kind: 'event', id: event.id, data: event, expectedRevision: 0 },
            {
              kind: 'recommendation',
              id: row.data.id,
              data: { ...row.data, status: 'rejected' },
              expectedRevision: row.revision,
            },
          );
        }
      }
    }
    if (!chosen) {
      if (writes.length) await ctx.repo.commit(user, writes);
      return {
        recommendation: null,
        message: !state.goals.some((g) => g.status === 'active')
          ? 'Activate a goal to find your next step.'
          : 'No remaining action fits this check-in. Try more time, review blocked dependencies in your goal map, or adapt an oversized task.',
      };
    }
    const recommendation: Recommendation = {
      id: randomUUID(),
      goalId: chosen.goal.id,
      taskId: chosen.task.id,
      checkInId: context.id,
      createdAt: now,
      score: chosen.score,
      factors: chosen.factors,
      evidence: chosen.evidence,
      reasoning: await ctx.ai.explain(chosen.evidence),
      adjustedMinutes: chosen.adjustedMinutes,
      status: 'offered',
    };
    writes.push({
      kind: 'recommendation',
      id: recommendation.id,
      data: recommendation,
      expectedRevision: 0,
    });
    await ctx.repo.commit(user, writes);
    return { recommendation };
  }
  throw new AppError(404, 'Endpoint not found.');
};
