import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { Repository, RecordKind, Stored, Write } from './types';
import { required } from '../config';
import { AppError } from '../errors';
export class DynamoRepository implements Repository {
  private client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });
  private table = required('STAVIRA_TABLE');
  async list(userId: string) {
    const items: Stored[] = [];
    let cursor: Record<string, unknown> | undefined;
    do {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.table,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: { ':pk': `USER#${userId}` },
          ExclusiveStartKey: cursor,
          ConsistentRead: true,
        }),
      );
      for (const item of result.Items ?? [])
        items.push({ kind: item.kind, id: item.id, revision: item.revision, data: item.data });
      cursor = result.LastEvaluatedKey;
    } while (cursor);
    return items;
  }
  async get(userId: string, kind: RecordKind, id: string) {
    const { Item } = await this.client.send(
      new GetCommand({
        TableName: this.table,
        Key: { PK: `USER#${userId}`, SK: `${kind}#${id}` },
        ConsistentRead: true,
      }),
    );
    return Item
      ? ({ kind: Item.kind, id: Item.id, revision: Item.revision, data: Item.data } as Stored)
      : null;
  }
  async commit(userId: string, writes: Write[]) {
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: writes.map((w) => ({
            Put: {
              TableName: this.table,
              Item: {
                PK: `USER#${userId}`,
                SK: `${w.kind}#${w.id}`,
                kind: w.kind,
                id: w.id,
                revision: w.expectedRevision + 1,
                data: w.data,
              },
              ConditionExpression:
                w.expectedRevision === 0 ? 'attribute_not_exists(PK)' : 'revision = :revision',
              ...(w.expectedRevision
                ? { ExpressionAttributeValues: { ':revision': w.expectedRevision } }
                : {}),
            },
          })),
        }),
      );
    } catch (e) {
      if (e instanceof Error && e.name === 'TransactionCanceledException')
        throw new AppError(409, 'This work changed in another session. Refresh and try again.');
      throw e;
    }
  }
}
