import { mode } from './config';
import { Service } from './service';
import { LocalRepository } from './repositories/local';
import { DynamoRepository } from './repositories/dynamo';
import { LocalDevelopmentAIProvider } from './ai/provider';
import { BedrockAIProvider } from './ai/bedrock';
export function service() {
  return mode() === 'local'
    ? new Service(new LocalRepository(), new LocalDevelopmentAIProvider())
    : new Service(new DynamoRepository(), new BedrockAIProvider());
}
