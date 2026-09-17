'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Clock,
  Flame,
  Leaf,
  Sun,
  Sparkles,
  Check,
  Play,
  RotateCw,
  ChevronRight,
  LoaderCircle,
  Pause,
} from 'lucide-react';
import { type CheckIn, type Energy, type Recommendation, progress } from '@/domain/schema';
import { useWorkspace } from './use-workspace';
import { api } from './api';
import { PageHeading, Empty, GoalLink } from './ui';
import { Modal } from './modal';
export function Today() {
  const { data, error, setError, reload } = useWorkspace();
  const [minutes, setMinutes] = useState(30);
  const [energy, setEnergy] = useState<Energy>('low');
  const [interest, setInterest] = useState('anything');
  const [busy, setBusy] = useState('');
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [focus, setFocus] = useState(false);
  const [dialog, setDialog] = useState<'skip' | 'postpone' | null>(null);
  const [reason, setReason] = useState('Too difficult');
  const [actual, setActual] = useState('');
  const goal = data?.goals.find((g) => g.id === rec?.goalId);
  const task = goal?.tasks.find((t) => t.id === rec?.taskId);
  const active = data?.goals.filter((g) => g.status === 'active') ?? [];
  const completed = data?.events.filter((e) => e.action === 'complete') ?? [];
  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function recommend(checkIn = true, alternative = false) {
    await run('Finding a step that fits…', async () => {
      if (checkIn) {
        await api<CheckIn>('check-ins', { availableMinutes: minutes, energy, interest });
        setExcluded([]);
      }
      const nextExcluded =
        alternative && rec ? [...excluded, `${rec.goalId}_${rec.taskId}`] : checkIn ? [] : excluded;
      const result = await api<{ recommendation: Recommendation | null; message?: string }>(
        'recommendations',
        { exclude: nextExcluded, ...(alternative && rec ? { previousId: rec.id } : {}) },
      );
      setExcluded(nextExcluded);
      setRec(result.recommendation);
      setMessage(result.message ?? '');
      setFocus(false);
      setActual('');
      await reload();
    });
  }
  async function execute(action: 'start' | 'complete' | 'skip' | 'postpone', until?: string) {
    if (!rec || !task) return;
    await run(action === 'complete' ? 'Saving your progress…' : 'Updating your plan…', async () => {
      await api('execution', {
        goalId: rec.goalId,
        taskId: rec.taskId,
        recommendationId: rec.id,
        action,
        requestId: crypto.randomUUID(),
        ...(action === 'skip' ? { reason } : {}),
        ...(action === 'complete' && actual ? { actualMinutes: Number(actual) } : {}),
        ...(until ? { postponedUntil: until } : {}),
      });
      await reload();
      setDialog(null);
      if (action === 'start') {
        setFocus(true);
      } else {
        setRec(null);
        setFocus(false);
        setMessage(
          action === 'complete'
            ? 'A little closer. Your progress is saved.'
            : action === 'skip'
              ? 'That’s useful context. Your next recommendation will take it into account.'
              : 'Saved for later. Let’s find something that fits now.',
        );
      }
    });
  }
  const needsAdapt = data?.goals.find(
    (g) =>
      g.status === 'active' &&
      g.tasks.some(
        (t) =>
          t.status === 'blocked' ||
          data.events.filter((e) => e.goalId === g.id && e.taskId === t.id && e.action === 'skip')
            .length >= 2,
      ),
  );
  if (!data)
    return (
      <div className="loading" role="status">
        {error || 'Opening your workspace…'}
      </div>
    );
  return (
    <>
      <PageHeading
        eyebrow="MAKE SPACE FOR WHAT MATTERS"
        title={focus ? 'Just this one thing.' : 'A good day for a small step.'}
        description={
          focus
            ? 'Let everything else wait. This is your focus for now.'
            : 'You don’t need to do it all. Just the right thing next.'
        }
        action={
          <Link href="/goals/new" className="button secondary">
            New goal <span>+</span>
          </Link>
        }
      />
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {needsAdapt && !focus && (
        <Link className="adapt-banner" href={`/goals/${needsAdapt.id}`}>
          <Sparkles size={19} />
          <span>
            Your plan could use a small adjustment. Review the work that’s been getting stuck.
          </span>
          <ArrowRight size={18} />
        </Link>
      )}
      {active.length === 0 ? (
        <Empty title="Give your next step a direction.">
          <p>Create a goal, review your plan, and we’ll help you find a place to begin.</p>
          <Link className="button primary" href="/goals/new">
            Create your first goal <ArrowRight size={17} />
          </Link>
        </Empty>
      ) : (
        <div className={focus ? 'today-grid focusing' : 'today-grid'}>
          {!focus && (
            <section className="checkin-panel">
              <div className="section-title">
                <span className="mini-icon">
                  <Sun size={19} />
                </span>
                <h2>Meet yourself where you are.</h2>
              </div>
              <p className="muted">A quick check-in. No perfect answers.</p>
              <fieldset>
                <legend>How much time do you have?</legend>
                <div className="time-options">
                  {[15, 30, 60, 120].map((value) => (
                    <button
                      key={value}
                      aria-pressed={minutes === value}
                      className={minutes === value ? 'option selected' : 'option'}
                      onClick={() => setMinutes(value)}
                    >
                      {value < 60 ? value : value / 60}
                      <small>{value < 60 ? 'min' : value === 60 ? 'hour' : 'hours'}</small>
                    </button>
                  ))}
                </div>
                <label className="custom-time">
                  Or choose minutes
                  <input
                    aria-label="Available minutes"
                    type="number"
                    min={5}
                    max={480}
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                  />
                </label>
              </fieldset>
              <fieldset>
                <legend>What’s your energy like?</legend>
                <div className="energy-options">
                  {(
                    [
                      { value: 'low', Icon: Leaf, caption: 'Keep it light' },
                      { value: 'medium', Icon: Sun, caption: 'A steady pace' },
                      { value: 'high', Icon: Flame, caption: 'Ready to dive in' },
                    ] as const
                  ).map(({ value, Icon, caption }) => (
                    <button
                      key={value}
                      className={energy === value ? 'energy-option selected' : 'energy-option'}
                      aria-pressed={energy === value}
                      onClick={() => setEnergy(value)}
                    >
                      <Icon size={19} />
                      <span>
                        {value}
                        <small>{caption}</small>
                      </span>
                      {energy === value && <Check size={16} />}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="interest-label">
                In the mood for
                <select value={interest} onChange={(e) => setInterest(e.target.value)}>
                  {[
                    'anything',
                    'coding',
                    'designing',
                    'writing',
                    'learning',
                    'planning',
                    'testing',
                  ].map((v) => (
                    <option key={v} value={v}>
                      {v[0].toUpperCase() + v.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button primary full"
                disabled={!!busy || minutes < 5 || minutes > 480}
                onClick={() => recommend()}
              >
                {busy ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}Find my
                next step
              </button>
            </section>
          )}
          <section
            className={rec ? 'next-panel has-recommendation' : 'next-panel'}
            aria-live="polite"
          >
            {busy && (
              <div className="busy-line" role="status">
                <LoaderCircle size={15} className="spin" />
                {busy}
              </div>
            )}
            {rec && task && goal ? (
              <>
                <div className="recommendation-top">
                  <p className="eyebrow">{focus ? 'IN FOCUS' : 'YOUR RIGHT NEXT STEP'}</p>
                  <span className="match-label">
                    <Sparkles size={14} /> Fits your moment
                  </span>
                </div>
                <GoalLink id={goal.id}>{goal.title}</GoalLink>
                <h2 className="recommended-title">{task.title}</h2>
                <div className="task-meta">
                  <span>
                    <Clock size={17} />
                    {rec.adjustedMinutes} min
                  </span>
                  <span>
                    <Leaf size={17} />
                    {task.energy} energy
                  </span>
                  <span className="category">{task.category}</span>
                </div>
                <p className="task-description">{task.description}</p>
                <div className="reason-box">
                  <Sparkles size={18} />
                  <div>
                    <h3>Why this, right now?</h3>
                    <p>{rec.reasoning}</p>
                  </div>
                </div>
                {focus ? (
                  <>
                    <label className="actual-time">
                      Time spent (optional)
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        max="1440"
                        value={actual}
                        onChange={(e) => setActual(e.target.value)}
                        placeholder="Minutes — otherwise measured from start"
                      />
                    </label>
                    <button
                      className="button primary large full"
                      disabled={!!busy}
                      onClick={() => execute('complete')}
                    >
                      <Check size={20} />
                      Mark complete
                    </button>
                    <button className="text-button" onClick={() => setFocus(false)}>
                      <Pause size={15} />
                      Back to Today
                    </button>
                  </>
                ) : (
                  <>
                    <div className="primary-task-actions">
                      <button
                        className="button primary large"
                        disabled={!!busy}
                        onClick={() =>
                          task.status === 'in_progress' ? setFocus(true) : execute('start')
                        }
                      >
                        <Play size={17} />
                        {task.status === 'in_progress' ? 'Resume task' : 'Let’s do this'}
                        <ArrowRight size={18} />
                      </button>
                      <button
                        className="button secondary"
                        disabled={!!busy}
                        onClick={() => execute('complete')}
                      >
                        <Check size={17} />
                        Already done
                      </button>
                    </div>
                    <div className="secondary-task-actions">
                      <button disabled={!!busy} onClick={() => setDialog('skip')}>
                        Skip for now
                      </button>
                      <span>·</span>
                      <button disabled={!!busy} onClick={() => setDialog('postpone')}>
                        Postpone
                      </button>
                      <button
                        disabled={!!busy}
                        onClick={() => recommend(false, true)}
                        className="alternative"
                      >
                        <RotateCw size={14} />
                        Something else
                      </button>
                    </div>
                  </>
                )}
                <details className="score-details">
                  <summary>How this step was selected</summary>
                  <p>Score {rec.score}/100 · dependencies checked before ranking</p>
                  <div>
                    {Object.entries(rec.factors).map(([key, value]) => (
                      <span key={key}>
                        {key.replace(/([A-Z])/g, ' $1')}: {Math.round(value * 100)}%
                      </span>
                    ))}
                  </div>
                </details>
              </>
            ) : (
              <div className="recommendation-empty">
                <div className="focus-symbol">
                  <CompassMark />
                </div>
                <p className="eyebrow">ONE THING AT A TIME</p>
                <h2>{message ? 'Keep your momentum.' : 'Your next step starts here.'}</h2>
                <p>
                  {message ||
                    'Tell us what you have to work with. We’ll find a meaningful action that fits your moment.'}
                </p>
                {message && (
                  <button
                    className="button primary"
                    disabled={!!busy}
                    onClick={() => recommend(false)}
                  >
                    Find another step <ArrowRight size={17} />
                  </button>
                )}
                <div className="quiet-note">A little progress is still progress.</div>
              </div>
            )}
          </section>
        </div>
      )}
      {!focus && active.length > 0 && (
        <section className="goals-strip">
          <div className="section-heading">
            <h2>The bigger picture</h2>
            <Link href="/goals">
              All goals <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="goal-strip-grid">
            {active.slice(0, 3).map((g) => {
              const p = progress(g);
              return (
                <Link key={g.id} href={`/goals/${g.id}`} className="goal-strip-item">
                  <div>
                    <span className="goal-glyph">↗</span>
                    <span>
                      <h3>{g.title}</h3>
                      <p>
                        {p.completed} of {p.total} steps complete
                      </p>
                    </span>
                    <ChevronRight size={18} />
                  </div>
                  <div className="progress-track">
                    <span style={{ width: `${p.percent}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
          <p className="recent-note">
            <Check size={15} />
            {completed.length
              ? `${completed.length} meaningful step${completed.length === 1 ? '' : 's'} completed. Every one counts.`
              : 'Your first completed step is waiting. Start small.'}
          </p>
        </section>
      )}
      {dialog && (
        <Modal titleId="dialog-title" onClose={() => setDialog(null)}>
          <h2 id="dialog-title">
            {dialog === 'skip' ? 'What got in the way?' : 'Make a little room.'}
          </h2>
          <p className="muted">
            {dialog === 'skip'
              ? 'Optional context helps your next step fit better.'
              : 'When should this action become available again?'}
          </p>
          {dialog === 'skip' ? (
            <>
              <label>
                Reason
                <select
                  aria-label="Reason"
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  {[
                    'Too difficult',
                    'Too long',
                    'Too tired',
                    'Missing something',
                    'Don’t feel like doing this',
                    'Not important anymore',
                    'Something else',
                    'Prefer not to say',
                  ].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <button
                className="button primary full"
                disabled={!!busy}
                onClick={() => execute('skip')}
              >
                Skip this step
              </button>
            </>
          ) : (
            <div className="postpone-options">
              {[
                { label: 'In one hour', hours: 1 },
                { label: 'Tomorrow', hours: 24 },
                { label: 'In a week', hours: 168 },
              ].map((o) => (
                <button
                  autoFocus={o.hours === 1}
                  className="button secondary"
                  key={o.label}
                  disabled={!!busy}
                  onClick={() =>
                    execute('postpone', new Date(Date.now() + o.hours * 3600000).toISOString())
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
          <button className="text-button" onClick={() => setDialog(null)}>
            Cancel
          </button>
        </Modal>
      )}
    </>
  );
}
function CompassMark() {
  return <span aria-hidden="true">↗</span>;
}
