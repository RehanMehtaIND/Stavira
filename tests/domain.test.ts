import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { LocalDevelopmentAIProvider } from '../src/server/ai/provider';
import { BedrockAIProvider } from '../src/server/ai/bedrock';
import { Service } from '../src/server/service';
import { LocalRepository } from '../src/server/repositories/local';
import { rank } from '../src/domain/recommendation';
import {
  validatePlan,
  progress,
  goalInputSchema,
  adaptationProposalSchema,
  type Goal,
  type Workspace,
  type CheckIn,
  type Adaptation,
  type Recommendation,
} from '../src/domain/schema';
import { mode } from '../src/server/config';
const directory = mkdtempSync(join(tmpdir(), 'stavira-tests-'));
process.env.STAVIRA_DATA_DIR = directory;
after(() => rmSync(directory, { recursive: true, force: true }));
const ai = new LocalDevelopmentAIProvider();
const repo = new LocalRepository();
let service: Service;
let user: string;
beforeEach(() => {
  service = new Service(repo, ai);
  user = randomUUID();
});
const context: CheckIn = {
  id: 'context',
  availableMinutes: 30,
  energy: 'low',
  interest: 'anything',
  createdAt: '2026-09-17T10:00:00.000Z',
};
async function setup() {
  let goal = (await service.handle(user, 'POST', 'goals', {
    title: 'Build my developer portfolio',
  })) as Goal;
  goal = (await service.handle(user, 'POST', `planning/${goal.id}`, {})) as Goal;
  goal = (await service.handle(user, 'PATCH', `goals/${goal.id}`, {
    revision: goal.revision,
    status: 'active',
  })) as Goal;
  return goal;
}
async function state() {
  return service.handle(user, 'GET', 'workspace', {}) as Promise<Workspace>;
}
async function event(goal: Goal, taskId: string, action: string, extra: object = {}) {
  return service.handle(user, 'POST', 'execution', {
    goalId: goal.id,
    taskId,
    action,
    requestId: randomUUID(),
    ...extra,
  });
}
test('complete plan schema rejects malformed, missing, invalid enum, dangling edges and cycles', async () => {
  const plan = await ai.plan(goalInputSchema.parse({ title: 'portfolio' }));
  assert.ok(validatePlan(plan));
  for (const bad of [
    null,
    {},
    'not json',
    { ...plan, tasks: [{ ...plan.tasks[0], energy: 'infinite' }] },
    {
      ...plan,
      tasks: plan.tasks.map((t) => (t.id === 'about' ? { ...t, dependencies: ['missing'] } : t)),
    },
    {
      ...plan,
      tasks: plan.tasks.map((t) => (t.id === 'about' ? { ...t, dependencies: ['content'] } : t)),
    },
  ])
    assert.throws(() => validatePlan(bad));
});
test('recommendation excludes completed, dependency-blocked, postponed, blocked and oversized tasks', async () => {
  const g = await setup();
  let s = await state();
  assert.ok(
    rank(s, context).every((c) => !['project-section', 'test', 'publish'].includes(c.task.id)),
  );
  await event(g, 'about', 'complete');
  await event(g, 'brief', 'postpone', { postponedUntil: '2099-01-01T00:00:00.000Z' });
  s = await state();
  assert.equal(rank(s, context).length, 0);
  assert.equal(progress(s.goals[0]).completed, 1);
});
test('energy, time and urgency produce deterministic scores and evidence', async () => {
  await setup();
  const s = await state();
  const now = new Date('2026-09-17T10:00:00Z');
  const one = rank(s, context, now),
    two = rank(s, context, now);
  assert.deepEqual(one, two);
  assert.equal(one[0].task.id, 'about');
  assert.ok(one[0].evidence.length > 1);
  s.goals[0].tasks.find((t) => t.id === 'brief')!.deadline = '2026-09-16';
  assert.equal(rank(s, context, now).find((c) => c.task.id === 'brief')!.factors.urgency, 1);
  assert.equal(rank(s, { ...context, availableMinutes: 5 }, now).length, 0);
});
test('completion unlocks dependency and changes recommendation under high energy', async () => {
  const goal = await setup();
  await event(goal, 'brief', 'complete', { actualMinutes: 15 });
  const high = { ...context, availableMinutes: 120, energy: 'high' as const };
  assert.equal(rank(await state(), high)[0].task.id, 'project-section');
  await event(goal, 'project-section', 'start');
  await event(goal, 'project-section', 'complete', { actualMinutes: 130 });
  const s = await state();
  assert.equal(progress(s.goals[0]).completed, 2);
  assert.ok(
    s.events.find((e) => e.action === 'complete' && e.taskId === 'project-section')
      ?.actualMinutes === 130,
  );
});
test('repeated skips affect score and adaptation adds a prerequisite without losing progress', async () => {
  const goal = await setup();
  await service.handle(user, 'POST', 'check-ins', context);
  await event(goal, 'about', 'complete', { actualMinutes: 20 });
  await event(goal, 'brief', 'skip', { reason: 'Too difficult' });
  await event(goal, 'brief', 'skip', { reason: 'Too difficult' });
  assert.ok(rank(await state(), context)[0].factors.behavior < 1);
  const adaptation = (await service.handle(user, 'POST', `adaptations/${goal.id}`, {
    reason: 'Repeated skips',
  })) as Adaptation;
  assert.equal(adaptation.status, 'proposed');
  const before = (await state()).goals[0].tasks.find((t) => t.id === 'about');
  await service.handle(user, 'POST', `adaptations/${adaptation.id}/accept`, {});
  const after = (await state()).goals[0];
  assert.deepEqual(
    after.tasks.find((t) => t.id === 'about'),
    before,
  );
  assert.ok(after.tasks.find((t) => t.id === 'brief')!.dependencies.length > 0);
  assert.equal(progress(after).completed, 1);
  assert.equal((await state()).adaptations[0].status, 'accepted');
});
test('missing prerequisite skip blocks execution and accepted preparation unblocks safely', async () => {
  const goal = await setup();
  await event(goal, 'brief', 'skip', { reason: 'Missing something' });
  await assert.rejects(event(goal, 'brief', 'start'), /dependencies/);
  const proposal = (await service.handle(user, 'POST', `adaptations/${goal.id}`, {
    reason: 'Missing something',
  })) as Adaptation;
  await service.handle(user, 'POST', `adaptations/${proposal.id}/accept`, {});
  const g = (await state()).goals[0];
  const prep = g.tasks.find((t) => !goal.tasks.some((old) => old.id === t.id))!;
  assert.ok(rank(await state(), context).some((r) => r.task.id === prep.id));
  await event(g, prep.id, 'complete');
  await event(g, 'brief', 'start');
});
test('cross-user reads, writes, execution and adaptation cannot access data', async () => {
  const g = await setup();
  for (const [method, path, body] of [
    ['GET', `goals/${g.id}`, {}],
    ['PATCH', `goals/${g.id}`, { revision: g.revision, status: 'archived' }],
    [
      'POST',
      'execution',
      { goalId: g.id, taskId: 'about', action: 'complete', requestId: randomUUID() },
    ],
    ['POST', `adaptations/${g.id}`, { reason: 'Change it' }],
  ] as const)
    await assert.rejects(service.handle('other-user', method, path, body), /not found/);
  assert.deepEqual(
    ((await service.handle('other-user', 'GET', 'workspace', {})) as Workspace).goals,
    [],
  );
});
test('optimistic conflicts, idempotent event requests and stale adaptation protection', async () => {
  const g = await setup();
  const request = { goalId: g.id, taskId: 'about', action: 'complete', requestId: randomUUID() };
  const first = await service.handle(user, 'POST', 'execution', request);
  assert.deepEqual(
    await service.handle(user, 'POST', 'execution', request),
    JSON.parse(JSON.stringify(first)),
  );
  assert.equal((await state()).events.length, 1);
  await assert.rejects(
    service.handle(user, 'PATCH', `goals/${g.id}`, { revision: g.revision, status: 'archived' }),
    /changed/,
  );
  const a = (await service.handle(user, 'POST', `adaptations/${g.id}`, {
    reason: 'Need a smaller step',
  })) as Adaptation;
  await event(g, 'brief', 'complete');
  await assert.rejects(service.handle(user, 'POST', `adaptations/${a.id}/accept`, {}), /changed/);
});
test('plan editing cannot erase completion or manufacture execution state', async () => {
  const g = await setup();
  await event(g, 'about', 'complete');
  const current = (await state()).goals[0];
  await assert.rejects(
    service.handle(user, 'PATCH', `goals/${g.id}`, {
      revision: current.revision,
      plan: {
        phases: current.phases,
        tasks: current.tasks.map((t) =>
          t.id === 'about' ? { ...t, title: 'Rewrite history' } : t,
        ),
      },
    }),
    /preserved/,
  );
  await assert.rejects(
    service.handle(user, 'PATCH', `goals/${g.id}`, {
      revision: current.revision,
      plan: {
        phases: current.phases,
        tasks: current.tasks.map((t) => (t.id === 'brief' ? { ...t, status: 'completed' } : t)),
      },
    }),
    /execution actions/,
  );
});
test('recommendations persist context, factors, alternatives and acceptance', async () => {
  const g = await setup();
  await service.handle(user, 'POST', 'check-ins', context);
  const { recommendation: r } = (await service.handle(user, 'POST', 'recommendations', {})) as {
    recommendation: Recommendation;
  };
  assert.ok(r.score > 0 && r.reasoning);
  await event(g, r.taskId, 'start', { recommendationId: r.id });
  assert.equal((await state()).recommendations[0].status, 'accepted');
  assert.equal((await state()).events[0].checkIn?.energy, 'low');
  const alternate = (await service.handle(user, 'POST', 'recommendations', {
    exclude: [`${r.goalId}_${r.taskId}`],
  })) as { recommendation: Recommendation };
  assert.notEqual(alternate.recommendation.taskId, r.taskId);
});
test('duration calibration learns from recorded completion by category', async () => {
  await setup();
  const s = await state();
  s.events.push({
    id: 'historical',
    goalId: s.goals[0].id,
    taskId: 'old',
    taskTitle: 'Earlier writing',
    category: 'writing',
    action: 'complete',
    createdAt: context.createdAt,
    estimatedMinutes: 20,
    actualMinutes: 40,
  });
  assert.ok(!rank(s, context).some((c) => c.task.id === 'about'));
  assert.equal(
    rank(s, { ...context, availableMinutes: 60 }).find((c) => c.task.id === 'about')
      ?.adjustedMinutes,
    40,
  );
});
test('production explicitly refuses local fallback', () => {
  const env = process.env as Record<string, string | undefined>;
  const old = env.NODE_ENV,
    oldMode = env.STAVIRA_MODE;
  env.NODE_ENV = 'production';
  env.STAVIRA_MODE = 'local';
  try {
    assert.throws(mode, /disabled/);
  } finally {
    env.NODE_ENV = old;
    env.STAVIRA_MODE = oldMode;
  }
});
test('Bedrock malformed output retries once and fails without persisting a plan', async () => {
  const bedrock = new BedrockAIProvider();
  let calls = 0;
  Object.assign(bedrock, {
    client: {
      send: async () => {
        calls++;
        return { output: { message: { content: [{ text: 'invalid json' }] } } };
      },
    },
  });
  process.env.BEDROCK_MODEL_ID = 'test';
  await assert.rejects(bedrock.structured(adaptationProposalSchema, 'test', {}), /valid response/);
  assert.equal(calls, 2);
});

test('dependency validation catches cycles through inherited parent prerequisites', async () => {
  const plan = await ai.plan(goalInputSchema.parse({ title: 'portfolio' }));
  plan.tasks.find((t) => t.id === 'scope')!.dependencies = ['about'];
  plan.tasks.find((t) => t.id === 'content')!.dependencies = ['brief'];
  assert.throws(() => validatePlan(plan), /cycle/);
});

test('identical task IDs in different goals keep skips and alternatives isolated', async () => {
  const first = await setup();
  const second = await setup();
  await service.handle(user, 'POST', 'check-ins', context);
  await event(first, 'about', 'skip', { reason: 'Too tired' });
  const ranked = rank(await state(), context, new Date(), [`${first.id}_about`]);
  assert.ok(!ranked.some((c) => c.goal.id === first.id && c.task.id === 'about'));
  const other = ranked.find((c) => c.goal.id === second.id && c.task.id === 'about')!;
  assert.equal(other.factors.behavior, 1);
});

test('a completed executable root cannot be converted into a parent to hide its progress', async () => {
  const plan = await ai.plan(goalInputSchema.parse({ title: 'portfolio' }));
  const root = plan.tasks.find((t) => t.id === 'scope')!;
  root.status = 'completed';
  assert.throws(() => validatePlan(plan), /Microtasks/);
});
