import type { Repository, RecordKind } from './repositories/types';
import type { AIProvider } from './ai/provider';
import { id } from '../domain/schema';
import { AppError } from './errors';
export class ServiceContext {
  constructor(
    public repo: Repository,
    private provider?: AIProvider,
  ) {}
  get ai() {
    if (!this.provider) throw new Error('AI is not available in this domain');
    return this.provider;
  }
  async get<T>(user: string, kind: RecordKind, key: string) {
    id.parse(key);
    const row = await this.repo.get(user, kind, key);
    if (!row) throw new AppError(404, 'This item was not found.');
    return { data: row.data as T, revision: row.revision };
  }
}
export type DomainHandler = (
  context: ServiceContext,
  user: string,
  method: string,
  path: string,
  body: unknown,
) => Promise<unknown>;
