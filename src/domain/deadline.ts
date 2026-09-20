import { type Goal, type ExecutionEvent, leaves, progress } from './schema';
import { categoryRatio } from './recommendation';
export const ASSUMED_DAILY_MINUTES = 60;
export const PACE_WINDOW_DAYS = 14;
export type DeadlineRisk = {
  level: 'on-track' | 'tight' | 'behind';
  daysLeft: number;
  remainingMinutes: number;
  requiredMinutesPerDay: number;
  paceMinutesPerDay: number;
  basis: 'observed' | 'assumed';
};
export function deadlineRisk(
  goal: Goal,
  events: ExecutionEvent[],
  now = new Date(),
): DeadlineRisk | null {
  if (!goal.deadline || goal.status !== 'active' || progress(goal).percent === 100) return null;
  const remainingMinutes = Math.round(
    leaves(goal)
      .filter((t) => t.status !== 'completed')
      .reduce((sum, t) => sum + t.estimatedMinutes * categoryRatio(events, t.category), 0),
  );
  if (remainingMinutes === 0) return null;
  const daysLeft = Math.ceil((Date.parse(goal.deadline + 'T23:59:59Z') - now.getTime()) / 86400000);
  const since = now.getTime() - PACE_WINDOW_DAYS * 86400000;
  const recorded = events
    .filter((e) => e.action === 'complete' && e.actualMinutes && Date.parse(e.createdAt) >= since)
    .reduce((sum, e) => sum + (e.actualMinutes ?? 0), 0);
  const paceMinutesPerDay = recorded > 0 ? recorded / PACE_WINDOW_DAYS : ASSUMED_DAILY_MINUTES;
  const requiredMinutesPerDay = remainingMinutes / Math.max(daysLeft, 1);
  return {
    level:
      daysLeft <= 0 || requiredMinutesPerDay > paceMinutesPerDay
        ? 'behind'
        : requiredMinutesPerDay > paceMinutesPerDay * 0.7
          ? 'tight'
          : 'on-track',
    daysLeft,
    remainingMinutes,
    requiredMinutesPerDay: Math.round(requiredMinutesPerDay),
    paceMinutesPerDay: Math.round(paceMinutesPerDay),
    basis: recorded > 0 ? 'observed' : 'assumed',
  };
}
