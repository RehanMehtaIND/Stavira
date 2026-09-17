import { z } from 'zod';
export const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const title = z.string().trim().min(1).max(180);
export const energySchema = z.enum(['low', 'medium', 'high']);
export const dateSchema = z.string().date();
export const taskSchema = z.object({
  id,
  phaseId: id,
  parentTaskId: id.nullable(),
  title,
  description: z.string().max(2000),
  estimatedMinutes: z.number().int().min(1).max(480),
  energy: energySchema,
  priority: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  category: z.enum(['coding', 'designing', 'writing', 'learning', 'planning', 'testing']),
  dependencies: z.array(id).max(30),
  deadline: dateSchema.nullable(),
  order: z.number().int().min(0),
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped', 'postponed', 'blocked']),
  postponedUntil: z.string().datetime().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
});
export const phaseSchema = z.object({ id, title, order: z.number().int().min(0) });
export const planSchema = z.object({
  phases: z.array(phaseSchema).min(1).max(20),
  tasks: z.array(taskSchema).min(1).max(100),
});
export type Plan = z.infer<typeof planSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Energy = z.infer<typeof energySchema>;
export const goalInputSchema = z.object({
  title,
  description: z.string().max(4000).default(''),
  deadline: dateSchema.nullable().default(null),
  priority: z.number().int().min(1).max(5).default(3),
});
export type GoalInput = z.infer<typeof goalInputSchema>;
export type Goal = GoalInput &
  Plan & {
    id: string;
    status: 'draft' | 'active' | 'completed' | 'archived';
    createdAt: string;
    updatedAt: string;
    revision: number;
  };
export const checkInSchema = z.object({
  availableMinutes: z.number().int().min(5).max(480),
  energy: energySchema,
  interest: z
    .enum(['anything', 'coding', 'designing', 'writing', 'learning', 'planning', 'testing'])
    .default('anything'),
});
export type CheckIn = z.infer<typeof checkInSchema> & { id: string; createdAt: string };
export const eventInputSchema = z.object({
  taskId: id,
  goalId: id,
  recommendationId: id.optional(),
  action: z.enum(['start', 'complete', 'skip', 'postpone']),
  reason: z.string().max(500).optional(),
  actualMinutes: z.number().min(0.1).max(1440).optional(),
  postponedUntil: z.string().datetime().optional(),
  requestId: id,
});
export type ExecutionEvent = {
  id: string;
  goalId: string;
  taskId: string;
  taskTitle: string;
  category: Task['category'];
  action: 'start' | 'complete' | 'skip' | 'postpone' | 'alternative';
  createdAt: string;
  estimatedMinutes: number;
  actualMinutes?: number;
  reason?: string;
  recommendationId?: string;
  checkIn?: CheckIn;
  postponedUntil?: string;
};
export type Factors = Record<
  | 'timeFit'
  | 'energyFit'
  | 'urgency'
  | 'priority'
  | 'impact'
  | 'dependencyValue'
  | 'contextFit'
  | 'behavior'
  | 'momentum',
  number
>;
export type Recommendation = {
  id: string;
  goalId: string;
  taskId: string;
  checkInId: string;
  createdAt: string;
  score: number;
  factors: Factors;
  evidence: string[];
  reasoning: string;
  adjustedMinutes: number;
  status: 'offered' | 'accepted' | 'completed' | 'rejected';
};
export const adaptationChangeSchema = z.object({
  taskId: id,
  estimatedMinutes: z.number().int().min(1).max(480).optional(),
  energy: energySchema.optional(),
  priority: z.number().int().min(1).max(5).optional(),
  preparation: z
    .object({
      title,
      description: z.string().min(1).max(1000),
      estimatedMinutes: z.number().int().min(5).max(30),
      category: taskSchema.shape.category,
    })
    .optional(),
});
export const adaptationProposalSchema = z.object({
  explanation: z.string().min(1).max(1000),
  changes: z.array(adaptationChangeSchema).min(1).max(8),
});
export type Adaptation = z.infer<typeof adaptationProposalSchema> & {
  id: string;
  goalId: string;
  reason: string;
  status: 'proposed' | 'accepted' | 'dismissed';
  baseRevision: number;
  createdAt: string;
  before: Plan;
  after?: Plan;
};
export type Workspace = {
  goals: Goal[];
  checkIns: CheckIn[];
  recommendations: Recommendation[];
  events: ExecutionEvent[];
  adaptations: Adaptation[];
};
export function validatePlan(input: unknown): Plan {
  const plan = planSchema.parse(input);
  if (JSON.stringify(plan).length > 120000)
    throw new Error('Plan is too large. Shorten task descriptions.');
  const nodes = new Map(plan.tasks.map((t) => [t.id, t]));
  const phases = new Set(plan.phases.map((p) => p.id));
  if (nodes.size !== plan.tasks.length || phases.size !== plan.phases.length)
    throw new Error('Plan IDs must be unique.');
  for (const t of plan.tasks) {
    if (!phases.has(t.phaseId)) throw new Error('Task phase does not exist.');
    if (t.parentTaskId) {
      const parent = nodes.get(t.parentTaskId);
      if (
        !parent ||
        parent.status === 'completed' ||
        parent.parentTaskId ||
        parent.id === t.id ||
        parent.phaseId !== t.phaseId
      )
        throw new Error('Microtasks must belong to a root task in the same phase.');
    }
    if (
      new Set(t.dependencies).size !== t.dependencies.length ||
      t.dependencies.some((d) => !nodes.has(d) || d === t.id)
    )
      throw new Error('Invalid dependency.');
  }
  const visiting = new Set<string>(),
    visited = new Set<string>();
  function visit(key: string) {
    if (visiting.has(key)) throw new Error('Dependency cycle detected.');
    if (visited.has(key)) return;
    visiting.add(key);
    const t = nodes.get(key)!;
    for (const d of [
      ...t.dependencies,
      ...(nodes.get(t.parentTaskId ?? '')?.dependencies ?? []),
      ...plan.tasks.filter((c) => c.parentTaskId === key).map((c) => c.id),
    ])
      visit(d);
    visiting.delete(key);
    visited.add(key);
  }
  plan.tasks.forEach((t) => visit(t.id));
  return plan;
}
export function leaves(plan: Plan) {
  return plan.tasks.filter((t) => !plan.tasks.some((c) => c.parentTaskId === t.id));
}
export function isDone(taskId: string, plan: Plan): boolean {
  const task = plan.tasks.find((t) => t.id === taskId);
  if (!task) return false;
  const children = plan.tasks.filter((t) => t.parentTaskId === taskId);
  return children.length ? children.every((t) => isDone(t.id, plan)) : task.status === 'completed';
}
export function progress(plan: Plan) {
  const tasks = leaves(plan);
  const completed = tasks.filter((t) => t.status === 'completed').length;
  return {
    completed,
    total: tasks.length,
    percent: tasks.length ? Math.round((100 * completed) / tasks.length) : 0,
  };
}
export function ready(task: Task, goal: Goal, now: Date) {
  const parent = goal.tasks.find((t) => t.id === task.parentTaskId);
  return (
    goal.status === 'active' &&
    !['completed', 'blocked'].includes(task.status) &&
    (!parent || !['blocked', 'postponed'].includes(parent.status)) &&
    (!task.postponedUntil || Date.parse(task.postponedUntil) <= now.getTime()) &&
    [...task.dependencies, ...(parent?.dependencies ?? [])].every((d) => isDone(d, goal))
  );
}
