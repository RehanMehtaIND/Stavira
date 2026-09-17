import { adaptationDomain } from '../src/server/domains/adaptation';
import { handlerFor } from './shared';
import { BedrockAIProvider } from '../src/server/ai/bedrock';
export const handler = handlerFor(['adaptations'], adaptationDomain, new BedrockAIProvider());
