/**
 * JOURNAL SINKS (X15)
 *
 * The operator reviews the tape as files. dailyFileSink writes JSONL into
 * one date-stamped file per UTC day — natural rotation, natural review unit,
 * and the M0 analytics job consumes exactly these files.
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { JournalSink } from './journal.js';

export interface DailyFileSinkOptions {
  directory: string;
  /** Injected in tests; default appends to the real filesystem. */
  appendLine?: (path: string, line: string) => void;
  now?: () => number;
}

export function dailyFileSink(opts: DailyFileSinkOptions): JournalSink {
  const now = opts.now ?? Date.now;
  const appendLine =
    opts.appendLine ??
    ((path: string, line: string) => {
      mkdirSync(opts.directory, { recursive: true });
      appendFileSync(path, line + '\n');
    });

  return (line: string) => {
    const date = new Date(now()).toISOString().slice(0, 10); // UTC YYYY-MM-DD
    appendLine(join(opts.directory, `decisions-${date}.jsonl`), line);
  };
}

/**
 * In-memory ring of the most recent N journal lines — feeds the dashboard's
 * decision stream without ever touching disk on the read path.
 */
export function ringSink(capacity: number): { sink: JournalSink; entries: () => string[] } {
  const buffer: string[] = [];
  return {
    sink: (line: string) => {
      buffer.push(line);
      if (buffer.length > capacity) buffer.splice(0, buffer.length - capacity);
    },
    entries: () => [...buffer],
  };
}

/** Fan out one journal line to several sinks; one failure never starves the rest. */
export function teeSink(...sinks: JournalSink[]): JournalSink {
  return (line: string) => {
    for (const sink of sinks) {
      try {
        sink(line);
      } catch {
        // the DecisionJournal counts drops at its level; a tee leg failing
        // must not take the other legs down with it
      }
    }
  };
}
