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
