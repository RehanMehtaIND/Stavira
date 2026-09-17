'use client';
import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Plus, Trash2, Check, LockKeyhole } from 'lucide-react';
import { type Goal, type Task, type Plan, validatePlan, progress, isDone } from '@/domain/schema';
import { taskDefaults } from '@/domain/task';
import { Modal } from './modal';
export function PlanEditor({
  goal,
  onSave,
  busy,
  onDirtyChange,
}: {
  goal: Goal;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (plan: Plan) => Promise<void>;
  busy: boolean;
}) {
  const [plan, setPlan] = useState<Plan>({ phases: goal.phases, tasks: goal.tasks });
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const task = plan.tasks.find((t) => t.id === selected);
  const dirty = JSON.stringify(plan) !== JSON.stringify({ phases: goal.phases, tasks: goal.tasks });
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  const update = (id: string, patch: Partial<Task>) =>
    setPlan({ ...plan, tasks: plan.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  function addTask(phaseId: string, parentTaskId: string | null) {
    const id = crypto.randomUUID();
    setPlan({
      ...plan,
      tasks: [
        ...plan.tasks,
        taskDefaults(id, phaseId, parentTaskId ? 'New microtask' : 'New task', {
          parentTaskId,
          order: plan.tasks.length,
        }),
      ],
    });
    setSelected(id);
  }
  function removeTask(id: string) {
    const remove = new Set([
      id,
      ...plan.tasks.filter((t) => t.parentTaskId === id).map((t) => t.id),
    ]);
    if (plan.tasks.some((t) => remove.has(t.id) && t.status === 'completed')) {
      setError('Completed work cannot be removed.');
      return;
    }
    setPlan({
      ...plan,
      tasks: plan.tasks
        .filter((t) => !remove.has(t.id))
        .map((t) => ({ ...t, dependencies: t.dependencies.filter((d) => !remove.has(d)) })),
    });
    setSelected(null);
  }
  function reorder(id: string, direction: number) {
    const current = plan.tasks.find((t) => t.id === id)!;
    const siblings = plan.tasks
      .filter((t) => t.phaseId === current.phaseId && t.parentTaskId === current.parentTaskId)
      .sort((a, b) => a.order - b.order);
    const at = siblings.findIndex((t) => t.id === id);
    const other = siblings[at + direction];
    if (!other) return;
    if (current.status === 'completed' || other.status === 'completed') {
      setError('Completed steps keep their recorded position.');
      return;
    }
    setPlan({
      ...plan,
      tasks: plan.tasks.map((t) =>
        t.id === id
          ? { ...t, order: other.order }
          : t.id === other.id
            ? { ...t, order: current.order }
            : t,
      ),
    });
  }
  async function save() {
    try {
      validatePlan(plan);
      setError('');
      await onSave(plan);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function taskRow(t: Task, child = false) {
    const done = isDone(t.id, plan);
    return (
      <div key={t.id} className={child ? 'task-row child' : 'task-row'}>
        <button
          className={done ? 'task-state done' : 'task-state'}
          onClick={() => setSelected(t.id)}
          aria-label={`Inspect ${t.title}`}
        >
          {done ? <Check size={14} /> : t.status === 'blocked' ? <LockKeyhole size={13} /> : null}
        </button>
        <button className="task-title" onClick={() => setSelected(t.id)}>
          <span>{t.title}</span>
          {child && (
            <small>
              {t.estimatedMinutes} min · {t.energy} energy · {t.status.replace('_', ' ')}
              {t.dependencies.length
                ? ` · ${t.dependencies.length} prerequisite${t.dependencies.length > 1 ? 's' : ''}`
                : ''}
            </small>
          )}
        </button>
        {editing && t.status !== 'completed' && (
          <div className="row-actions">
            <button aria-label={`Move ${t.title} up`} onClick={() => reorder(t.id, -1)}>
              <ChevronUp size={15} />
            </button>
            <button aria-label={`Move ${t.title} down`} onClick={() => reorder(t.id, 1)}>
              <ChevronDown size={15} />
            </button>
            <button aria-label={`Delete ${t.title}`} onClick={() => removeTask(t.id)}>
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    );
  }
  return (
    <section className="plan-section">
      <div className="section-heading">
        <h2>{goal.status === 'draft' ? 'Make this plan your own' : 'Your goal map'}</h2>
        {!editing ? (
          <button className="button secondary" onClick={() => setEditing(true)}>
            Edit plan
          </button>
        ) : (
          <div className="button-row">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setPlan({ phases: goal.phases, tasks: goal.tasks });
                setEditing(false);
                setSelected(null);
              }}
            >
              Cancel edits
            </button>
            <button className="button primary" disabled={busy} onClick={save}>
              Save plan
            </button>
          </div>
        )}
      </div>
      {editing && (
        <p className="muted">
          Select a task to edit its details and prerequisites. Changes take effect when you save.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {plan.phases
        .sort((a, b) => a.order - b.order)
        .map((phase, index) => {
          const p = progress({
            phases: [phase],
            tasks: plan.tasks.filter((t) => t.phaseId === phase.id),
          });
          return (
            <div className="phase" key={phase.id}>
              <div className="phase-heading">
                <span className="phase-number">{String(index + 1).padStart(2, '0')}</span>
                {editing ? (
                  <input
                    aria-label={`Phase ${index + 1} title`}
                    value={phase.title}
                    onChange={(e) =>
                      setPlan({
                        ...plan,
                        phases: plan.phases.map((p) =>
                          p.id === phase.id ? { ...p, title: e.target.value } : p,
                        ),
                      })
                    }
                  />
                ) : (
                  <h3>{phase.title}</h3>
                )}
                <span className="phase-progress">
                  {p.completed}/{p.total}
                </span>
                {editing && (
                  <>
                    <button
                      className="icon-button"
                      aria-label={`Move ${phase.title} up`}
                      disabled={index === 0}
                      onClick={() => {
                        const phases = [...plan.phases];
                        [phases[index - 1], phases[index]] = [phases[index], phases[index - 1]];
                        setPlan({ ...plan, phases: phases.map((p, i) => ({ ...p, order: i })) });
                      }}
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Remove ${phase.title}`}
                      disabled={plan.tasks.some((t) => t.phaseId === phase.id)}
                      onClick={() =>
                        setPlan({ ...plan, phases: plan.phases.filter((p) => p.id !== phase.id) })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
              <div className="phase-tasks">
                {plan.tasks
                  .filter((t) => t.phaseId === phase.id && !t.parentTaskId)
                  .sort((a, b) => a.order - b.order)
                  .map((root) => (
                    <div key={root.id} className="task-group">
                      {taskRow(root)}
                      {plan.tasks
                        .filter((t) => t.parentTaskId === root.id)
                        .sort((a, b) => a.order - b.order)
                        .map((t) => taskRow(t, true))}
                      {editing && root.status !== 'completed' && (
                        <button className="add-step" onClick={() => addTask(phase.id, root.id)}>
                          <Plus size={14} />
                          Add microtask
                        </button>
                      )}
                    </div>
                  ))}
                {editing && (
                  <button className="add-step root-add" onClick={() => addTask(phase.id, null)}>
                    <Plus size={15} />
                    Add task
                  </button>
                )}
              </div>
            </div>
          );
        })}
      {editing && (
        <button
          className="button secondary"
          onClick={() =>
            setPlan({
              ...plan,
              phases: [
                ...plan.phases,
                { id: crypto.randomUUID(), title: 'New phase', order: plan.phases.length },
              ],
            })
          }
        >
          <Plus size={16} />
          Add phase
        </button>
      )}
      {task && (
        <Modal titleId="task-dialog-title" className="task-modal" onClose={() => setSelected(null)}>
          <div className="section-heading">
            <h2 id="task-dialog-title">{editing ? 'Edit step' : 'Step details'}</h2>
            <button
              className="icon-button"
              aria-label="Close task details"
              onClick={() => setSelected(null)}
            >
              ✕
            </button>
          </div>
          <fieldset disabled={!editing || task.status === 'completed'}>
            <label>
              Title
              <input
                autoFocus
                value={task.title}
                onChange={(e) => update(task.id, { title: e.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                rows={3}
                value={task.description}
                onChange={(e) => update(task.id, { description: e.target.value })}
              />
            </label>
            <div className="form-row">
              <label>
                Minutes
                <input
                  type="number"
                  min={1}
                  max={480}
                  value={task.estimatedMinutes}
                  onChange={(e) => update(task.id, { estimatedMinutes: Number(e.target.value) })}
                />
              </label>
              <label>
                Energy
                <select
                  value={task.energy}
                  onChange={(e) => update(task.id, { energy: e.target.value as Task['energy'] })}
                >
                  {['low', 'medium', 'high'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Category
                <select
                  value={task.category}
                  onChange={(e) =>
                    update(task.id, { category: e.target.value as Task['category'] })
                  }
                >
                  {['coding', 'designing', 'writing', 'learning', 'planning', 'testing'].map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Priority (1–5)
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={task.priority}
                  onChange={(e) => update(task.id, { priority: Number(e.target.value) })}
                />
              </label>
              <label>
                Impact (1–5)
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={task.impact}
                  onChange={(e) => update(task.id, { impact: Number(e.target.value) })}
                />
              </label>
              <label>
                Deadline
                <input
                  type="date"
                  value={task.deadline ?? ''}
                  onChange={(e) => update(task.id, { deadline: e.target.value || null })}
                />
              </label>
            </div>
            <label>
              Prerequisites
              <select
                multiple
                size={4}
                value={task.dependencies}
                onChange={(e) =>
                  update(task.id, {
                    dependencies: Array.from(e.target.selectedOptions).map((o) => o.value),
                  })
                }
              >
                {plan.tasks
                  .filter((t) => t.id !== task.id && t.id !== task.parentTaskId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </select>
              <small>Use Ctrl / Command to select or deselect multiple steps.</small>
            </label>
          </fieldset>
          {task.status === 'completed' && (
            <p className="muted">This completed step is preserved in your history.</p>
          )}
          <button className="button primary full" onClick={() => setSelected(null)}>
            {editing ? 'Done editing this step' : 'Close'}
          </button>
        </Modal>
      )}
    </section>
  );
}
