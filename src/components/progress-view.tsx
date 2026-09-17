'use client';
import Link from 'next/link';
import { Check, ArrowUpRight } from 'lucide-react';
import { progress } from '@/domain/schema';
import { useWorkspace } from './use-workspace';
import { PageHeading, Empty } from './ui';
export function ProgressView() {
  const { data, error } = useWorkspace();
  if (!data) return <p className="loading">{error || 'Gathering your progress…'}</p>;
  const complete = data.events.filter((e) => e.action === 'complete');
  const minutes = complete.reduce((sum, e) => sum + (e.actualMinutes ?? 0), 0);
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
        <section>
          <h2>Your recent steps</h2>
          {data.events.length ? (
            <ol className="activity-list">
              {[...data.events]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .slice(0, 30)
                .map((e) => (
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
                        {e.action === 'complete'
                          ? 'Completed'
                          : e.action === 'start'
                            ? 'Started'
                            : e.action === 'alternative'
                              ? 'Requested another action'
                              : e.action === 'skip'
                                ? 'Skipped'
                                : 'Postponed'}{' '}
                        · {new Date(e.createdAt).toLocaleDateString()}
                        {e.actualMinutes
                          ? ` · ${Math.round(e.actualMinutes)} min actual / ${e.estimatedMinutes} min estimated`
                          : ''}
                      </p>
                      {e.reason && <small>{e.reason}</small>}
                    </div>
                  </li>
                ))}
            </ol>
          ) : (
            <p className="muted">
              Your first step will show up here. There’s no rush to fill the page.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
