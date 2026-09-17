import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { ServiceContext, type DomainHandler } from '../src/server/service-context';
import type { AIProvider } from '../src/server/ai/provider';
import { DynamoRepository } from '../src/server/repositories/dynamo';
import { errorResponse, AppError } from '../src/server/errors';
export function handlerFor(domains: string[], handler: DomainHandler, ai?: AIProvider) {
  return async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
    const path = event.rawPath.replace(/^\//, '');
    const operation = path.split('/')[0];
    try {
      const user = event.requestContext.authorizer?.jwt?.claims?.sub;
      if (typeof user !== 'string') throw new AppError(401, 'Authentication required.');
      if (!domains.includes(operation)) throw new AppError(404, 'Endpoint not found.');
      const raw = event.isBase64Encoded
        ? Buffer.from(event.body ?? '', 'base64').toString()
        : (event.body ?? '{}');
      if (raw.length > 250000) throw new AppError(413, 'Request too large.');
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        throw new AppError(400, 'Invalid JSON.');
      }
      const result = await handler(
        new ServiceContext(new DynamoRepository(), ai),
        user,
        event.requestContext.http.method,
        path,
        body,
      );
      console.info(
        JSON.stringify({ requestId: event.requestContext.requestId, operation, status: 200 }),
      );
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify(result),
      };
    } catch (e) {
      const error = errorResponse(e, operation);
      return {
        statusCode: error.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(error.body),
      };
    }
  };
}
