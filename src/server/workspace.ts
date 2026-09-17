import type { Workspace } from '../domain/schema';
import type { Repository } from './repositories/types';
export async function workspace(repo: Repository, userId: string): Promise<Workspace> {
  const rows = await repo.list(userId);
  return {
    goals: rows.filter((r) => r.kind === 'goal').map((r) => r.data) as Workspace['goals'],
    checkIns: rows.filter((r) => r.kind === 'checkIn').map((r) => r.data) as Workspace['checkIns'],
    recommendations: rows
      .filter((r) => r.kind === 'recommendation')
      .map((r) => r.data) as Workspace['recommendations'],
    events: rows.filter((r) => r.kind === 'event').map((r) => r.data) as Workspace['events'],
    adaptations: rows
      .filter((r) => r.kind === 'adaptation')
      .map((r) => r.data) as Workspace['adaptations'],
  };
}
