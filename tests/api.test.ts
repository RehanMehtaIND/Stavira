import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkOrigin, readBody } from '../src/server/http';
import { handlerFor } from '../functions/shared';
import { goalsDomain } from '../src/server/domains/goals';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
test('mutations require exact same origin', () => {
  assert.throws(
    () =>
      checkOrigin(
        new Request('http://127.0.0.1:3000/api/goals', {
          method: 'POST',
          headers: { origin: 'https://evil.example' },
        }),
      ),
    /not allowed/,
  );
  assert.throws(
    () => checkOrigin(new Request('http://127.0.0.1:3000/api/goals', { method: 'POST' })),
    /not allowed/,
  );
  assert.doesNotThrow(() =>
    checkOrigin(
      new Request('http://127.0.0.1:3000/api/goals', {
        method: 'POST',
        headers: { origin: 'http://127.0.0.1:3000' },
      }),
    ),
  );
});
test('invalid JSON becomes a safe client error', async () => {
  await assert.rejects(
    readBody(new Request('http://localhost', { method: 'POST', body: '{broken' })),
    /Invalid JSON/,
  );
});
test('Lambda never trusts user IDs in request payload', async () => {
  const response = await handlerFor(
    ['goals'],
    goalsDomain,
  )({
    rawPath: '/goals',
    body: '{"userId":"victim"}',
    requestContext: { requestId: 'test', http: { method: 'GET' } },
  } as APIGatewayProxyEventV2WithJWTAuthorizer);
  assert.equal(response.statusCode, 401);
});
