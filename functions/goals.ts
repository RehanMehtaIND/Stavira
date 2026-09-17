import { goalsDomain } from '../src/server/domains/goals';
import { handlerFor } from './shared';
export const handler = handlerFor(['goals'], goalsDomain);
