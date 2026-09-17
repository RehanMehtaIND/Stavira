import { taskDefaults } from '../../domain/task';
import { z } from 'zod';
import {
  type Goal,
  type GoalInput,
  type Plan,
  type Task,
  type Workspace,
  type Adaptation,
  planSchema,
  validatePlan,
  adaptationProposalSchema,
} from '../../domain/schema';
export const explanationSchema = z.object({
  evidenceIndices: z.array(z.number().int().min(0)).min(1).max(3),
});
export interface AIProvider {
  plan(goal: GoalInput): Promise<Plan>;
  explain(evidence: string[]): Promise<string>;
  adapt(
    goal: Goal,
    reason: string,
    workspace: Workspace,
  ): Promise<Pick<Adaptation, 'explanation' | 'changes'>>;
}
export const generatedPlanSchema = planSchema;
export const parseGeneratedPlan = (input: unknown) => validatePlan(input);
export class LocalDevelopmentAIProvider implements AIProvider {
  async plan(goal: GoalInput): Promise<Plan> {
    const portfolio = /portfolio/i.test(goal.title);
    const phases = [
      { id: 'planning', title: 'Find your direction', order: 0 },
      { id: 'make', title: portfolio ? 'Make it yours' : 'Build the first version', order: 1 },
      { id: 'launch', title: 'Bring it to life', order: 2 },
    ];
    const tasks: Task[] = [
      taskDefaults('scope', 'planning', 'Define the outcome', { order: 0 }),
      taskDefaults(
        'brief',
        'planning',
        portfolio ? 'Choose the projects you want to share' : 'Write a one-paragraph success brief',
        { parentTaskId: 'scope', estimatedMinutes: 15, order: 0 },
      ),
      taskDefaults(
        'content',
        'make',
        portfolio ? 'Tell your story' : 'Prepare the essential material',
        { category: 'writing', order: 1 },
      ),
      taskDefaults(
        'about',
        'make',
        portfolio
          ? 'Write your About section draft'
          : `Draft the key ideas for ${goal.title}`.slice(0, 180),
        {
          parentTaskId: 'content',
          description: portfolio
            ? 'Write 3–5 sentences about who you are, what you build, and the kind of work you want to do. Start with a rough draft; your voice matters more than perfect wording.'
            : 'Capture the most important ideas in a short draft. Aim for a useful starting point that you can improve later.',
          category: 'writing',
          priority: 4,
          impact: 4,
          order: 1,
        },
      ),
      taskDefaults(
        'build',
        'make',
        portfolio ? 'Build your portfolio' : 'Create your first deliverable',
        { energy: 'high', category: 'coding', estimatedMinutes: 90, order: 2 },
      ),
      taskDefaults(
        'project-section',
        'make',
        portfolio ? 'Implement the portfolio project section' : 'Build the first working version',
        {
          parentTaskId: 'build',
          description: portfolio
            ? 'Create a project section with a title, preview, short description, and link for each selected project. Make the section work on mobile and desktop.'
            : 'Turn your success brief into a tangible first version. Work through the most important requirement first.',
          energy: 'high',
          estimatedMinutes: 90,
          priority: 5,
          impact: 5,
          category: 'coding',
          dependencies: ['brief'],
          order: 2,
        },
      ),
      taskDefaults('review', 'launch', 'Review and publish', { category: 'testing', order: 3 }),
      taskDefaults('test', 'launch', 'Check the result against your success brief', {
        parentTaskId: 'review',
        category: 'testing',
        energy: 'medium',
        estimatedMinutes: 30,
        dependencies: ['project-section', 'about'],
        order: 3,
      }),
      taskDefaults(
        'publish',
        'launch',
        portfolio ? 'Publish your portfolio and share the link' : 'Share the finished result',
        {
          parentTaskId: 'review',
          category: 'planning',
          estimatedMinutes: 15,
          dependencies: ['test'],
          order: 4,
        },
      ),
    ];
    return validatePlan({ phases, tasks });
  }
  async explain(evidence: string[]) {
    return evidence.slice(0, 2).join(' ');
  }
  async adapt(goal: Goal, reason: string, workspace: Workspace) {
    const target =
      goal.tasks.find(
        (t) =>
          t.status !== 'completed' &&
          !goal.tasks.some((c) => c.parentTaskId === t.id) &&
          (t.status === 'blocked' ||
            workspace.events.filter(
              (e) => e.taskId === t.id && e.goalId === goal.id && e.action === 'skip',
            ).length >= 2),
      ) ??
      goal.tasks.find(
        (t) => t.status !== 'completed' && !goal.tasks.some((c) => c.parentTaskId === t.id),
      );
    if (!target) throw new Error('No remaining tasks.');
    return adaptationProposalSchema.parse({
      explanation: `Add a small preparation step before “${target.title}” so you can resolve the obstacle before returning to the original work. Your completed work stays intact.`,
      changes: [
        {
          taskId: target.id,
          preparation: {
            title: /project/i.test(target.title)
              ? 'Create a rough project-card wireframe'
              : `Clarify the next step for ${target.title}`.slice(0, 180),
            description:
              `Identify what is missing, sketch a rough approach, and write down the first concrete step. Context: ${reason}`.slice(
                0,
                1000,
              ),
            estimatedMinutes: 15,
            category: target.category === 'coding' ? 'designing' : 'planning',
          },
        },
      ],
    });
  }
}
