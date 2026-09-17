import { recommendationsDomain } from '../src/server/domains/recommendations';
import { handlerFor } from './shared';
import { BedrockAIProvider } from '../src/server/ai/bedrock';
export const handler = handlerFor(
  ['recommendations'],
  recommendationsDomain,
  new BedrockAIProvider(),
);
