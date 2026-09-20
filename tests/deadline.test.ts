import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deadlineRisk, ASSUMED_DAILY_MINUTES } from '../src/domain/deadline';
import { taskDefaults } from '../src/domain/task';
import type { Goal, ExecutionEvent } from '../src/domain/schema';
const NOW = new Date('2026-09-19T12:00:00Z');
const day = (offset: number) =>
  new Date(NOW.getTime() + offset * 86400000).toISOString().slice(0, 10);
function goalWith(deadline: string | null, minutes: number[], done = 0): Goal {
  return {
    id: 'g1',
    title: 'Ship it',
    description: '',
    deadline,
    priority: 3,
    status: 'active',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    revision: 1,
    phases: [{ id: 'p1', title: 'Phase', order: 0 }],
    tasks: minutes.map((m, i) =>
      taskDefaults(`t${i}`, 'p1', `Task ${i}`, {
        estimatedMinutes: m,
        category: 'writing',
        order: i,
        status: i < done ? 'completed' : 'pending',
      }),
    ),
  };
}
const completion = (minutes: number, estimated: number, daysAgo: number): ExecutionEvent => ({
  id: `e${daysAgo}-${minutes}`,
  goalId: 'g1',
  taskId: 't0',
  taskTitle: 'Task',
  category: 'writing',
  action: 'complete',
  createdAt: new Date(NOW.getTime() - daysAgo * 86400000).toISOString(),
  estimatedMinutes: estimated,
  actualMinutes: minutes,
});
test('a goal with no deadline is never at risk', () => {
  assert.equal(deadlineRisk(goalWith(null, [60, 60]), [], NOW), null);
});
test('a finished goal is never at risk', () => {
  assert.equal(deadlineRisk(goalWith(day(3), [60, 60], 2), [], NOW), null);
});
test('a comfortable deadline reads as on-track', () => {
  // 120 min left over 30 days = 4 min/day against an assumed 60
  const risk = deadlineRisk(goalWith(day(30), [60, 60]), [], NOW)!;
  assert.equal(risk.level, 'on-track');
  assert.equal(risk.remainingMinutes, 120);
  assert.equal(risk.paceMinutesPerDay, ASSUMED_DAILY_MINUTES);
  assert.equal(risk.basis, 'assumed');
});
test('work that exceeds the observed pace reads as behind', () => {
  // the deadline runs to end of day, so day(5) leaves 6 days: 600 min / 6 = 100 a day,
  // against an observed 140 min logged over the 14-day window = 10 a day
  const events = [completion(70, 70, 1), completion(70, 70, 2)];
  const risk = deadlineRisk(goalWith(day(5), [300, 300]), events, NOW)!;
  assert.equal(risk.level, 'behind');
  assert.equal(risk.basis, 'observed');
  assert.equal(risk.daysLeft, 6);
  assert.equal(risk.paceMinutesPerDay, 10);
  assert.equal(risk.requiredMinutesPerDay, 100);
});
test('a passed deadline with work left reads as behind', () => {
  const risk = deadlineRisk(goalWith(day(-2), [30]), [], NOW)!;
  assert.equal(risk.level, 'behind');
  assert.ok(risk.daysLeft <= 0, 'days left is zero or negative');
});
test('the estimate is calibrated by the user’s own pace in that category', () => {
  // two writing tasks logged at double their estimate → remaining work doubles
  const slow = [completion(40, 20, 1), completion(40, 20, 3)];
  const plain = deadlineRisk(goalWith(day(10), [100]), [], NOW)!;
  const calibrated = deadlineRisk(goalWith(day(10), [100]), slow, NOW)!;
  assert.equal(plain.remainingMinutes, 100);
  assert.equal(calibrated.remainingMinutes, 200, 'a 2x category ratio doubles remaining work');
});
test('pace only counts completions inside the rolling window', () => {
  const stale = [completion(280, 280, 40)];
  const risk = deadlineRisk(goalWith(day(10), [100]), stale, NOW)!;
  assert.equal(risk.basis, 'assumed', 'a completion outside the window does not set a pace');
  assert.equal(risk.paceMinutesPerDay, ASSUMED_DAILY_MINUTES);
});
test('skipped work still counts as remaining', () => {
  const goal = goalWith(day(10), [60, 60]);
  goal.tasks[0].status = 'skipped';
  assert.equal(deadlineRisk(goal, [], NOW)!.remainingMinutes, 120);
});
