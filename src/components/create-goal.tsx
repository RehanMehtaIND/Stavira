'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Sparkles, LoaderCircle, Check } from 'lucide-react';
import { type Goal, type GoalInput, goalInputSchema } from '@/domain/schema';
import { api } from './api';
import { PageHeading } from './ui';
export function CreateGoal() {
  const router = useRouter();
  const [input, setInput] = useState<GoalInput>({
    title: '',
    description: '',
    deadline: null,
    priority: 3,
  });
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<Goal | null>(null);
  async function generate() {
    setError('');
    setBusy('Saving your goal…');
    try {
      const goal = saved ?? (await api<Goal>('goals', input));
      setSaved(goal);
      setBusy('Finding the phases, actions, and little steps…');
      await api(`planning/${goal.id}`, {});
      router.push(`/goals/${goal.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="START WITH A LITTLE AMBITION"
        title="What do you want to move toward?"
        description="Give us the big picture. We’ll help you find the small steps."
      />
      <div className="create-grid">
        <section className="surface create-form">
          {!confirm ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const parsed = goalInputSchema.safeParse(input);
                if (parsed.success) {
                  setConfirm(true);
                  setError('');
                } else setError('Add a goal title to continue.');
              }}
            >
              <label>
                Your goal
                <input
                  autoFocus
                  value={input.title}
                  onChange={(e) => setInput({ ...input, title: e.target.value })}
                  required
                  maxLength={180}
                  placeholder="e.g. Build and publish my developer portfolio"
                />
              </label>
              <label>
                A little context <span className="optional">optional</span>
                <textarea
                  rows={5}
                  maxLength={4000}
                  value={input.description}
                  onChange={(e) => setInput({ ...input, description: e.target.value })}
                  placeholder="Where are you starting? What does done look like? Any constraints or work you’ve already finished?"
                />
              </label>
              <div className="form-row">
                <label>
                  Aim to finish by <span className="optional">optional</span>
                  <input
                    type="date"
                    value={input.deadline ?? ''}
                    onChange={(e) => setInput({ ...input, deadline: e.target.value || null })}
                  />
                </label>
                <label>
                  Priority
                  <select
                    value={input.priority}
                    onChange={(e) => setInput({ ...input, priority: Number(e.target.value) })}
                  >
                    <option value={1}>Someday, steadily</option>
                    <option value={3}>Important to me</option>
                    <option value={5}>A top priority</option>
                  </select>
                </label>
              </div>
              <button className="button primary large" type="submit">
                Review my goal <ArrowRight size={18} />
              </button>
            </form>
          ) : (
            <>
              <p className="eyebrow">HERE’S THE DIRECTION</p>
              <h2>{input.title}</h2>
              <p className="muted">
                {input.description || 'A practical plan with small, executable actions.'}
              </p>
              <p>
                {input.deadline
                  ? `Aiming for ${input.deadline}`
                  : 'A steady pace, without a fixed deadline.'}
              </p>
              <div className="reason-box">
                <Check size={19} />
                <p>You’ll review and edit every part of the plan before making it active.</p>
              </div>
              <button className="button primary large" disabled={!!busy} onClick={generate}>
                {busy ? <LoaderCircle size={18} className="spin" /> : <Sparkles size={18} />}{' '}
                {busy || 'Build my plan'}
              </button>
              <button
                className="text-button"
                disabled={!!busy || !!saved}
                onClick={() => setConfirm(false)}
              >
                Edit goal
              </button>
              {saved && error && (
                <p>
                  <a href={`/goals/${saved.id}`}>Your draft is saved. Open it here.</a>
                </p>
              )}
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>
        <aside className="creation-aside">
          <span className="large-index">01 / 03</span>
          <h2>
            A direction,
            <br />
            not a perfect plan.
          </h2>
          <p>
            Stavira breaks your goal into phases, tasks, and doable microtasks. Then it adapts as
            you learn what works for you.
          </p>
          <ol>
            <li>
              <b>Tell us where you want to go.</b>
              <span>A sentence is enough to start.</span>
            </li>
            <li>
              <b>Make the plan your own.</b>
              <span>Review, edit, and approve.</span>
            </li>
            <li>
              <b>Take a step that fits today.</b>
              <span>Your time. Your energy. Your pace.</span>
            </li>
          </ol>
          {!confirm && (
            <button
              className="example-button"
              onClick={() =>
                setInput({
                  title: 'Build and publish my developer portfolio',
                  description:
                    'I have two projects ready to showcase. I want a clean responsive website with an About section, project cards, and contact links.',
                  deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
                  priority: 3,
                })
              }
            >
              Try the portfolio demo <ArrowUp />
            </button>
          )}
        </aside>
      </div>
    </>
  );
}
function ArrowUp() {
  return <ArrowRight size={17} />;
}
