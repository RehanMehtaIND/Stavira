import type { Repository } from './repositories/types';
import type { AIProvider } from './ai/provider';
import { ServiceContext, type DomainHandler } from './service-context';
import { goalsDomain } from './domains/goals';
import { planningDomain } from './domains/planning';
import { contextDomain } from './domains/context';
import { recommendationsDomain } from './domains/recommendations';
import { executionDomain } from './domains/execution';
import { adaptationDomain } from './domains/adaptation';
import { AppError } from './errors';
const handlers: Record<string, DomainHandler> = {
  goals: goalsDomain,
  planning: planningDomain,
  'check-ins': contextDomain,
  workspace: contextDomain,
  recommendations: recommendationsDomain,
  execution: executionDomain,
  adaptations: adaptationDomain,
};
export class Service {
  private context: ServiceContext;
  constructor(repo: Repository, ai: AIProvider) {
    this.context = new ServiceContext(repo, ai);
  }
  async handle(user: string, method: string, path: string, body: unknown) {
    const handler = handlers[path.split('/').filter(Boolean)[0]];
    if (!handler) throw new AppError(404, 'Endpoint not found.');
    return handler(this.context, user, method, path, body);
  }
}
