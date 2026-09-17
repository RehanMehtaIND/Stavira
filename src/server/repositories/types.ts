export type RecordKind = 'goal' | 'checkIn' | 'recommendation' | 'event' | 'adaptation';
export type Stored = { kind: RecordKind; id: string; revision: number; data: unknown };
export type Write = { kind: RecordKind; id: string; data: unknown; expectedRevision: number };
export interface Repository {
  list(userId: string): Promise<Stored[]>;
  get(userId: string, kind: RecordKind, id: string): Promise<Stored | null>;
  commit(userId: string, writes: Write[]): Promise<void>;
}
