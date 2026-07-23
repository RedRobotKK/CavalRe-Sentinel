/**
 * TRANSACTIONAL OUTBOX
 *
 * Business state and "must publish" rows commit together. A publisher drains
 * pending rows and marks them done. At-least-once on the wire; consumers must
 * still be idempotent.
 *
 * In-process implementation: one synchronous mutation path is the "transaction."
 * Swap the store for SQLite/Postgres later without changing the API.
 */

export type OutboxStatus = 'pending' | 'publishing' | 'done' | 'failed';

export interface OutboxRow {
  id: string;
  topic: string;
  idempotencyKey: string;
  payload: string;
  status: OutboxStatus;
  attempts: number;
  createdAtMs: number;
  publishedAtMs: number | null;
  lastError: string | null;
}

export type OutboxPublishResult =
  | { ok: true }
  | { ok: false; error: string; permanent?: boolean };

export interface OutboxOptions {
  now?: () => number;
  /** Max attempts before status=failed. */
  maxAttempts?: number;
  idFactory?: () => string;
}

let seq = 0;
function defaultId(): string {
  seq += 1;
  return `obx_${Date.now()}_${seq}`;
}

export class Outbox {
  private readonly rows = new Map<string, OutboxRow>();
  private readonly byKey = new Map<string, string>(); // topic\0key → id
  private readonly now: () => number;
  private readonly maxAttempts: number;
  private readonly idFactory: () => string;

  constructor(opts: OutboxOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.maxAttempts = opts.maxAttempts ?? 8;
    this.idFactory = opts.idFactory ?? defaultId;
  }

  /**
   * Enqueue a payload. Same (topic, idempotencyKey) with same payload → noop.
   * Same key, different payload → conflict throw.
   */
  enqueue(topic: string, idempotencyKey: string, payload: string): OutboxRow {
    const k = keyOf(topic, idempotencyKey);
    const existingId = this.byKey.get(k);
    if (existingId !== undefined) {
      const row = this.rows.get(existingId)!;
      if (row.payload === payload) return row;
      throw new Error(`outbox_conflict:${topic}:${idempotencyKey}`);
    }
    const row: OutboxRow = {
      id: this.idFactory(),
      topic,
      idempotencyKey,
      payload,
      status: 'pending',
      attempts: 0,
      createdAtMs: this.now(),
      publishedAtMs: null,
      lastError: null,
    };
    this.rows.set(row.id, row);
    this.byKey.set(k, row.id);
    return row;
  }

  /** Claim up to `limit` pending rows (SKIP LOCKED analogue). */
  claim(limit: number): OutboxRow[] {
    const out: OutboxRow[] = [];
    for (const row of this.rows.values()) {
      if (row.status !== 'pending') continue;
      row.status = 'publishing';
      row.attempts += 1;
      out.push(row);
      if (out.length >= limit) break;
    }
    return out;
  }

  complete(id: string): void {
    const row = this.rows.get(id);
    if (!row) return;
    if (row.status === 'done') return;
    row.status = 'done';
    row.publishedAtMs = this.now();
    row.lastError = null;
  }

  /**
   * Release a publishing row after failure.
   * permanent or attempts >= max → failed; else back to pending.
   */
  fail(id: string, error: string, permanent = false): void {
    const row = this.rows.get(id);
    if (!row) return;
    if (row.status === 'done') return;
    row.lastError = error;
    if (permanent || row.attempts >= this.maxAttempts) {
      row.status = 'failed';
    } else {
      row.status = 'pending';
    }
  }

  /** Drain: claim → publishFn → complete/fail. */
  async drain(
    publishFn: (row: OutboxRow) => Promise<OutboxPublishResult> | OutboxPublishResult,
    limit = 32
  ): Promise<{ sent: number; failed: number; deferred: number }> {
    const batch = this.claim(limit);
    let sent = 0;
    let failed = 0;
    let deferred = 0;
    for (const row of batch) {
      try {
        const result = await publishFn(row);
        if (result.ok) {
          this.complete(row.id);
          sent += 1;
        } else {
          this.fail(row.id, result.error, result.permanent === true);
          if (this.rows.get(row.id)?.status === 'failed') failed += 1;
          else deferred += 1;
        }
      } catch (e) {
        this.fail(row.id, e instanceof Error ? e.message : String(e), false);
        deferred += 1;
      }
    }
    return { sent, failed, deferred };
  }

  pendingCount(): number {
    let n = 0;
    for (const r of this.rows.values()) if (r.status === 'pending') n += 1;
    return n;
  }

  failedCount(): number {
    let n = 0;
    for (const r of this.rows.values()) if (r.status === 'failed') n += 1;
    return n;
  }

  get(id: string): OutboxRow | undefined {
    return this.rows.get(id);
  }

  /** Test / ops snapshot */
  snapshot(): OutboxRow[] {
    return [...this.rows.values()].map((r) => ({ ...r }));
  }
}

function keyOf(topic: string, idempotencyKey: string): string {
  return `${topic}\0${idempotencyKey}`;
}
