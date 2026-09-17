import { planningDomain } from '../src/server/domains/planning';
import { handlerFor } from './shared';
import { BedrockAIProvider } from '../src/server/ai/bedrock';
export const handler = handlerFor(['planning'], planningDomain, new BedrockAIProvider());
