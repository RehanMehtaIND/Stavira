'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Check, ArrowUpRight } from 'lucide-react';
import { progress } from '@/domain/schema';
import { useWorkspace } from './use-workspace';
import { PageHeading, Empty } from './ui';
import { Figure, Columns, Bars, Dumbbells, type Row, type Pair } from './charts';
const ACTIONS = [
  { key: 'complete', chip: 'Completed', label: 'Completed' },
  { key: 'start', chip: 'Started', label: 'Started' },
  { key: 'skip', chip: 'Skipped', label: 'Skipped' },
  { key: 'postpone', chip: 'Postponed', label: 'Postponed' },
  { key: 'alternative', chip: 'Another action', label: 'Requested another action' },
] as const;
const CATEGORIES = ['coding', 'designing', 'writing', 'learning', 'planning', 'testing'] as const;
const sentence = (s: string) => s[0].toUpperCase() + s.slice(1);
const hours = (m: number) => (m >= 90 ? `${(m / 60).toFixed(1)} h` : `${Math.round(m)} min`);
export function ProgressView() {
  const { data, error } = useWorkspace();
  const [selected, setSelected] = useState<string[]>([]);
  if (!data) return <p className="loading">{error || 'Gathering your progress…'}</p>;
  const complete = data.events.filter((e) => e.action === 'complete');
  const minutes = complete.reduce((sum, e) => sum + (e.actualMinutes ?? 0), 0);
  const tally: Record<string, number> = {};
  for (const e of data.events) tally[e.action] = (tally[e.action] ?? 0) + 1;
  const matching = data.events
    .filter((e) => !selected.length || selected.includes(e.action))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const shown = matching.slice(0, 30);
  const toggle = (key: string) =>
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const days: Row[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(midnight);
    d.setDate(d.getDate() - i);
    days.push({
      key: String(d.getTime()),
      label: String(d.getDate()),
      value: 0,
      display: '0 steps',
      note: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    });
  }
  const byDay = new Map(days.map((d) => [d.key, d]));
  const perCategory = new Map(CATEGORIES.map((c) => [c, { minutes: 0, est: 0, act: 0, n: 0 }]));
  for (const e of complete) {
    const d = new Date(e.createdAt);
    d.setHours(0, 0, 0, 0);
    const slot = byDay.get(String(d.getTime()));
    if (slot) {
      slot.value += 1;
      slot.display = `${slot.value} ${slot.value === 1 ? 'step' : 'steps'}`;
    }
    const cat = perCategory.get(e.category);
    if (cat && e.actualMinutes) {
      cat.minutes += e.actualMinutes;
      cat.act += e.actualMinutes;
      cat.est += e.estimatedMinutes;
      cat.n += 1;
    }
  }
  const peakDay = Math.max(...days.map((d) => d.value), 0);
  const timeRows: Row[] = [...perCategory]
    .filter(([, v]) => v.minutes > 0)
    .sort((a, b) => b[1].minutes - a[1].minutes)
    .map(([key, v]) => ({
      key,
      label: sentence(key),
      value: v.minutes,
      display: hours(v.minutes),
    }));
  const paceRows: Pair[] = [...perCategory]
    .filter(([, v]) => v.n > 0)
    .map(([key, v]) => {
      const est = v.est / v.n;
      const act = v.act / v.n;
      const ratio = Math.round((act / est) * 100);
      return {
        key,
        label: sentence(key),
        from: est,
        to: act,
        display:
          ratio === 100
            ? 'as estimated'
            : ratio > 100
              ? `${ratio - 100}% longer`
              : `${100 - ratio}% faster`,
      };
    })
    .sort((a, b) => b.to / b.from - a.to / a.from);
  const peakPace = Math.max(...paceRows.flatMap((r) => [r.from, r.to]), 1);
  return (
    <>
      <PageHeading
        eyebrow="LOOK HOW FAR YOU’VE COME"
        title="Progress, one step at a time."
        description="A record of showing up for the things that matter."
      />
      <div className="progress-summary">
        <div>
          <strong>{complete.length}</strong>
          <span>steps completed</span>
        </div>
        <div>
          <strong>{data.goals.filter((g) => g.status === 'completed').length}</strong>
          <span>goals reached</span>
        </div>
        <div>
          <strong>{Math.round(minutes)}</strong>
          <span>minutes of recorded work</span>
        </div>
      </div>
      {complete.length > 0 && (
        <section className="analytics">
          <h2>A closer look.</h2>
          <div className="analytics-grid">
            <Figure
              wide
              title="Steps completed"
              caption="The last 14 days."
              table={
                <table>
                  <caption>Steps completed per day, last 14 days</caption>
                  <thead>
                    <tr>
                      <th scope="col">Day</th>
                      <th scope="col">Steps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((d) => (
                      <tr key={d.key}>
                        <th scope="row">{d.note}</th>
                        <td>{d.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            >
              <Columns rows={days} peak={peakDay} />
            </Figure>
            {timeRows.length > 0 && (
              <Figure
                title="Where your minutes go"
                caption="Recorded work by kind of task."
                table={
                  <table>
                    <caption>Recorded minutes by category</caption>
                    <thead>
                      <tr>
                        <th scope="col">Category</th>
                        <th scope="col">Recorded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeRows.map((r) => (
                        <tr key={r.key}>
                          <th scope="row">{r.label}</th>
                          <td>{r.display}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
              >
                <Bars rows={timeRows} peak={Math.max(...timeRows.map((r) => r.value), 1)} />
              </Figure>
            )}
            {paceRows.length > 0 && (
              <Figure
                title="How your estimates land"
                caption="Average estimated against average actual, per task."
                table={
                  <table>
                    <caption>Average estimated and actual minutes by category</caption>
                    <thead>
                      <tr>
                        <th scope="col">Category</th>
                        <th scope="col">Estimated</th>
                        <th scope="col">Actual</th>
                        <th scope="col">Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paceRows.map((r) => (
                        <tr key={r.key}>
                          <th scope="row">{r.label}</th>
                          <td>{Math.round(r.from)} min</td>
                          <td>{Math.round(r.to)} min</td>
                          <td>{r.display}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
              >
                <Dumbbells rows={paceRows} peak={peakPace} />
              </Figure>
            )}
          </div>
        </section>
      )}
      <div className="progress-layout">
        <section>
          <h2>Your goals in motion</h2>
          {data.goals.length ? (
            data.goals.map((g) => {
              const p = progress(g);
              return (
                <Link href={`/goals/${g.id}`} key={g.id} className="progress-goal">
                  <div>
                    <h3>{g.title}</h3>
                    <ArrowUpRight size={18} />
                  </div>
                  <div className="progress-track">
                    <span style={{ width: `${p.percent}%` }} />
                  </div>
                  <p>
                    {p.completed} of {p.total} steps · {p.percent}% complete
                  </p>
                </Link>
              );
            })
          ) : (
            <Empty title="A fresh start.">
              <Link href="/goals/new">Create your first goal</Link>
            </Empty>
          )}
        </section>
        <section className="activity-column">
          <h2>Your recent steps</h2>
          {data.events.length > 0 && (
            <div className="activity-filters" role="group" aria-label="Filter recent steps">
              <button
                className={selected.length ? 'filter-chip' : 'filter-chip selected'}
                aria-pressed={!selected.length}
                onClick={() => setSelected([])}
              >
                All <span>{data.events.length}</span>
              </button>
              {ACTIONS.filter(({ key }) => tally[key]).map(({ key, chip }) => (
                <button
                  key={key}
                  className={selected.includes(key) ? 'filter-chip selected' : 'filter-chip'}
                  aria-pressed={selected.includes(key)}
                  onClick={() => toggle(key)}
                >
                  {chip} <span>{tally[key]}</span>
                </button>
              ))}
            </div>
          )}
          <div className="activity-scroll">
            <div className="activity-pane">
              {shown.length ? (
                <>
                  <ol className="activity-list">
                    {shown.map((e) => (
                      <li key={e.id}>
                        <span
                          className={
                            e.action === 'complete' ? 'activity-dot completed' : 'activity-dot'
                          }
                        >
                          {e.action === 'complete' ? <Check size={13} /> : null}
                        </span>
                        <div>
                          <h3>{e.taskTitle}</h3>
                          <p>
                            {ACTIONS.find((a) => a.key === e.action)?.label ?? e.action} ·{' '}
                            {new Date(e.createdAt).toLocaleDateString()}
                            {e.actualMinutes
                              ? ` · ${Math.round(e.actualMinutes)} min actual / ${e.estimatedMinutes} min estimated`
                              : ''}
                          </p>
                          {e.reason && <small>{e.reason}</small>}
                        </div>
                      </li>
                    ))}
                  </ol>
                  {matching.length > shown.length && (
                    <p className="activity-note">
                      Showing the {shown.length} most recent of {matching.length} matching steps.
                    </p>
                  )}
                </>
              ) : (
                <p className="muted">
                  {data.events.length
                    ? 'No steps match those filters yet.'
                    : 'Your first step will show up here. There’s no rush to fill the page.'}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
