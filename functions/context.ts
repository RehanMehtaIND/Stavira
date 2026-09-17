import { contextDomain } from '../src/server/domains/context';
import { handlerFor } from './shared';
export const handler = handlerFor(['workspace', 'check-ins'], contextDomain);
