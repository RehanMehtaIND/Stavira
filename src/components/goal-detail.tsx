'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Sparkles, LoaderCircle, Check } from 'lucide-react';
import { type Plan, type Goal, type Adaptation, progress } from '@/domain/schema';
import { useWorkspace } from './use-workspace';
import { api } from './api';
import { PageHeading } from './ui';
import { PlanEditor } from './plan-editor';
export function GoalDetail({ id }: { id: string }) {
  const { data, error, setError, reload } = useWorkspace();
  const [busy, setBusy] = useState('');
  const [reason, setReason] = useState('');
  const [editDetails, setEditDetails] = useState(false);
  const [dirty, setDirty] = useState(false);
  const goal = data?.goals.find((g) => g.id === id);
  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError('');
    try {
      await fn();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function save(plan: Plan) {
    if (!goal) return;
    setBusy('Saving plan…');
    try {
      await api(`goals/${id}`, { revision: goal.revision, plan }, 'PATCH');
      await reload();
    } finally {
      setBusy('');
    }
  }
  if (!data) return <p className="loading">{error || 'Opening your plan…'}</p>;
  if (!goal)
    return (
      <p className="error">
        Goal not found. <Link href="/goals">Back to your goals</Link>
      </p>
    );
  const p = progress(goal);
  const history = data.adaptations
    .filter((a) => a.goalId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const blocked = goal.tasks.filter((t) => t.status === 'blocked').length;
  const skips = data.events.filter((e) => e.goalId === id && e.action === 'skip').length;
  const overdue =
    !!goal.deadline && goal.deadline < new Date().toISOString().slice(0, 10) && p.percent < 100;
  return (
    <>
      <Link className="back-link" href="/goals">
        <ArrowLeft size={16} />
        My goals
      </Link>
      <PageHeading
        eyebrow={
          goal.status === 'draft'
            ? 'YOUR PLAN, BEFORE YOU BEGIN'
            : `${goal.status.toUpperCase()} GOAL`
        }
        title={goal.title}
        description={goal.description}
      />
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      {busy && (
        <div role="status" className="busy-line">
          <LoaderCircle size={16} className="spin" />
          {busy}
        </div>
      )}
      <div className="goal-overview">
        <div>
          <span className="eyebrow">SMALL STEPS ADD UP</span>
          <strong>
            {p.percent}
            <small>%</small>
          </strong>
          <p>
            {p.completed} of {p.total} steps completed
          </p>
          <div className="progress-track">
            <span style={{ width: `${p.percent}%` }} />
          </div>
        </div>
        <div>
          <p className="muted">
            {goal.deadline ? `Aiming for ${goal.deadline}` : 'Progress at your own pace'}
          </p>
          <div className="button-row">
            <button className="button secondary" onClick={() => setEditDetails(!editDetails)}>
              Edit goal
            </button>
            {goal.status === 'draft' ? (
              <button
                disabled={!!busy || !goal.tasks.length || dirty}
                title={dirty ? 'Save your plan edits before accepting' : undefined}
                className="button primary"
                onClick={() =>
                  run('Activating your plan…', () =>
                    api(`goals/${id}`, { revision: goal.revision, status: 'active' }, 'PATCH'),
                  )
                }
              >
                Accept & start <ArrowRight size={16} />
              </button>
            ) : goal.status === 'active' ? (
              <Link className="button primary" href="/today">
                Find my next step <ArrowRight size={16} />
              </Link>
            ) : goal.status === 'archived' ? (
              <button
                className="button primary"
                disabled={!!busy}
                onClick={() =>
                  run('Restoring goal…', () =>
                    api(`goals/${id}`, { revision: goal.revision, status: 'active' }, 'PATCH'),
                  )
                }
              >
                Restore goal
              </button>
            ) : (
              <span className="complete-label">
                <Check size={18} />
                You made it.
              </span>
            )}
          </div>
          {goal.status !== 'archived' && (
            <button
              className="text-button"
              disabled={!!busy}
              onClick={() =>
                run('Archiving goal…', () =>
                  api(`goals/${id}`, { revision: goal.revision, status: 'archived' }, 'PATCH'),
                )
              }
            >
              Archive goal
            </button>
          )}
        </div>
      </div>
      {editDetails && (
        <form
          className="surface details-form"
          onSubmit={(e) => {
            e.preventDefault();
            const values = new FormData(e.currentTarget);
            void run('Saving goal…', async () => {
              await api(
                `goals/${id}`,
                {
                  revision: goal.revision,
                  details: {
                    title: values.get('title'),
                    description: values.get('description'),
                    deadline: values.get('deadline') || null,
                    priority: Number(values.get('priority')),
                  },
                },
                'PATCH',
              );
              setEditDetails(false);
            });
          }}
        >
          <label>
            Goal title
            <input name="title" defaultValue={goal.title} required maxLength={180} />
          </label>
          <label>
            Context
            <textarea name="description" defaultValue={goal.description} maxLength={4000} />
          </label>
          <div className="form-row">
            <label>
              Deadline
              <input name="deadline" type="date" defaultValue={goal.deadline ?? ''} />
            </label>
            <label>
              Priority
              <input name="priority" type="number" min={1} max={5} defaultValue={goal.priority} />
            </label>
          </div>
          <button className="button primary" disabled={!!busy}>
            Save goal details
          </button>
        </form>
      )}
      {!goal.tasks.length ? (
        <div className="empty">
          <Sparkles size={32} />
          <h2>Your goal is saved. Let’s find the steps.</h2>
          <button
            className="button primary"
            disabled={!!busy}
            onClick={() => run('Building your plan…', () => api(`planning/${id}`, {}))}
          >
            Generate plan
          </button>
        </div>
      ) : (
        <PlanEditor
          key={`${goal.id}-${goal.revision}`}
          goal={goal}
          onDirtyChange={setDirty}
          onSave={save}
          busy={!!busy}
        />
      )}
      {goal.status === 'active' && (
        <section className="adaptation-section">
          <div>
            <p className="eyebrow">A PLAN THAT MOVES WITH YOU</p>
            <h2>Things change. Your plan can, too.</h2>
            <p className="muted">
              {overdue
                ? 'Your target date has passed. Review the remaining scope and choose a new deadline.'
                : blocked
                  ? `${blocked} step${blocked === 1 ? ' is' : 's are'} blocked. A small preparation step can help you move again.`
                  : skips >= 2
                    ? 'Some steps have been skipped more than once. Let’s make the next attempt easier.'
                    : 'If your time, priorities, or progress have changed, make a small adjustment.'}
            </p>
          </div>
          <div>
            <label>
              What needs to change?
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="e.g. I don’t know what my project cards should look like."
              />
            </label>
            <button
              className="button secondary"
              disabled={!!busy}
              onClick={() =>
                run('Preparing a change for your review…', () =>
                  api(`adaptations/${id}`, {
                    reason:
                      reason ||
                      (blocked
                        ? 'Missing prerequisites are blocking execution.'
                        : skips >= 2
                          ? 'Repeated skips suggest the next action needs to be smaller.'
                          : overdue
                            ? 'The goal deadline has passed. Make remaining work easier to start.'
                            : 'I have less time. Help me take a smaller first step.'),
                  }),
                )
              }
            >
              <Sparkles size={16} />
              Suggest an adjustment
            </button>
          </div>
        </section>
      )}
      {history.length > 0 && (
        <section className="adaptation-history">
          <h2>How your plan is evolving</h2>
          {history.map((a) => (
            <AdaptationCard
              key={a.id}
              adaptation={a}
              goal={goal}
              busy={!!busy}
              onAction={(action) =>
                run('Updating your plan…', () => api(`adaptations/${a.id}/${action}`, {}))
              }
            />
          ))}
        </section>
      )}
    </>
  );
}
function AdaptationCard({
  adaptation: a,
  goal,
  busy,
  onAction,
}: {
  adaptation: Adaptation;
  goal: Goal;
  busy: boolean;
  onAction: (action: string) => void;
}) {
  return (
    <article className="adaptation-card">
      <div className="section-heading">
        <span className="status">{a.status}</span>
        <time>{new Date(a.createdAt).toLocaleDateString()}</time>
      </div>
      <h3>{a.explanation}</h3>
      <p className="muted">Because: {a.reason}</p>
      <ul>
        {a.changes.map((c) => (
          <li key={c.taskId}>
            <b>{a.before.tasks.find((t) => t.id === c.taskId)?.title}</b>
            {c.preparation ? (
              <p>
                Add “{c.preparation.title}” ({c.preparation.estimatedMinutes} min) as a
                prerequisite. The original work is retained.
              </p>
            ) : (
              <p>
                {c.estimatedMinutes
                  ? `Estimate: ${a.before.tasks.find((t) => t.id === c.taskId)?.estimatedMinutes} → ${c.estimatedMinutes} min. `
                  : ''}
                {c.energy ? `Energy: ${c.energy}. ` : ''}
                {c.priority ? `Priority: ${c.priority}.` : ''}
              </p>
            )}
          </li>
        ))}
      </ul>
      {a.status === 'proposed' && (
        <>
          {a.baseRevision !== goal.revision && (
            <p className="error">
              This proposal is out of date. Dismiss it and request a fresh adjustment.
            </p>
          )}
          <div className="button-row">
            <button
              className="button primary"
              disabled={busy || a.baseRevision !== goal.revision}
              onClick={() => onAction('accept')}
            >
              Accept adjustment
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => onAction('dismiss')}
            >
              Keep current plan
            </button>
          </div>
        </>
      )}
    </article>
  );
}
