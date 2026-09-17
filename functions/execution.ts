import { executionDomain } from '../src/server/domains/execution';
import { handlerFor } from './shared';
export const handler = handlerFor(['execution'], executionDomain);
