import { Injectable } from '@nestjs/common';

export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  source: string;
}

const MAX_ENTRIES = 2000;

@Injectable()
export class LogService {
  private entries: LogEntry[] = [];
  private counter = 0;

  log(level: LogLevel, message: string, source = 'Scraper') {
    const entry: LogEntry = {
      id: `${Date.now()}-${++this.counter}`,
      timestamp: new Date().toISOString(),
      level,
      message,
      source,
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.shift();
    }
    return entry;
  }

  info(message: string, source?: string)    { return this.log('info',    message, source); }
  warn(message: string, source?: string)    { return this.log('warn',    message, source); }
  error(message: string, source?: string)   { return this.log('error',   message, source); }
  success(message: string, source?: string) { return this.log('success', message, source); }

  getSince(since?: string): LogEntry[] {
    if (!since) return [...this.entries];
    return this.entries.filter((e) => e.timestamp > since);
  }

  clear() {
    this.entries = [];
  }
}
