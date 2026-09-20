'use client';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Target } from 'lucide-react';
import { progress } from '@/domain/schema';
import { deadlineRisk } from '@/domain/deadline';
import { useWorkspace } from './use-workspace';
import { PageHeading, Empty } from './ui';
export function Goals() {
  const { data, error } = useWorkspace();
  return (
    <>
      <PageHeading
        eyebrow="THE BIGGER PICTURE"
        title="Good things take small steps."
        description="Your goals, at your pace."
        action={
          <Link className="button primary" href="/goals/new">
            New goal +
          </Link>
        }
      />
      {error && <p className="error">{error}</p>}
      {!data ? (
        <p className="loading">Loading your goals…</p>
      ) : data.goals.length === 0 ? (
        <Empty title="What’s on your horizon?">
          <p>Start with something that matters to you.</p>
          <Link href="/goals/new" className="button primary">
            Create a goal <ArrowRight size={17} />
          </Link>
        </Empty>
      ) : (
        <div className="goals-grid">
          {data.goals
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((g) => {
              const p = progress(g);
              const risk = deadlineRisk(g, data.events);
              return (
                <Link href={`/goals/${g.id}`} key={g.id} className="goal-card">
                  <div className="goal-card-top">
                    <span className="mini-icon">
                      <Target size={22} />
                    </span>
                    <span className={`status ${g.status}`}>{g.status}</span>
                  </div>
                  <h2>{g.title}</h2>
                  <p className="muted goal-description">
                    {g.description || 'One meaningful step at a time.'}
                  </p>
                  <div className="progress-label">
                    <span>
                      {p.completed} / {p.total} steps
                    </span>
                    <b>{p.percent}%</b>
                  </div>
                  <div className="progress-track">
                    <span style={{ width: `${p.percent}%` }} />
                  </div>
                  <div className="goal-card-footer">
                    <span>
                      {g.deadline ? `Target · ${g.deadline}` : 'At your own pace'}
                      {risk && risk.level !== 'on-track' && (
                        <b className={`risk-chip ${risk.level}`}>
                          {risk.level === 'behind' ? 'Needs a rethink' : 'Tight'}
                        </b>
                      )}
                    </span>
                    <ArrowUpRight size={20} />
                  </div>
                </Link>
              );
            })}
        </div>
      )}
    </>
  );
}
