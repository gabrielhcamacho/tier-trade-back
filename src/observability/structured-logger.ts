import { Injectable } from '@nestjs/common';

type LogLevel = 'info' | 'warn' | 'error';
type LogFields = Record<string, boolean | number | string | null>;

@Injectable()
export class StructuredLogger {
  private readonly service = process.env.OTEL_SERVICE_NAME ?? 'tier-trade-api';

  info(event: string, fields: LogFields = {}): void {
    this.write('info', event, fields);
  }

  warn(event: string, fields: LogFields = {}): void {
    this.write('warn', event, fields);
  }

  error(event: string, fields: LogFields = {}): void {
    this.write('error', event, fields);
  }

  private write(level: LogLevel, event: string, fields: LogFields): void {
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      event,
      ...fields,
    });
    if (level === 'error') console.error(entry);
    else if (level === 'warn') console.warn(entry);
    else console.info(entry);
  }
}

export function safeErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return 'UNKNOWN_ERROR';
  if (/^[A-Z][A-Z0-9_]{2,80}$/.test(error.message)) return error.message;
  const code = (error as Error & { code?: unknown }).code;
  if (typeof code === 'string' && /^[A-Z0-9_]{2,40}$/i.test(code)) return code.toUpperCase();
  return 'UNEXPECTED_ERROR';
}
