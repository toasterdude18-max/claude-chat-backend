export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${this.context}] ${message}`;
  }

  info(message: string, data?: unknown): void {
    console.log(this.formatMessage('INFO', message), data || '');
  }

  warn(message: string, data?: unknown): void {
    console.warn(this.formatMessage('WARN', message), data || '');
  }

  error(message: string, error?: unknown): void {
    console.error(this.formatMessage('ERROR', message));
    if (error instanceof Error) {
      console.error('  Error:', error.message);
      console.error('  Stack:', error.stack);
    } else if (error) {
      console.error('  Details:', error);
    }
  }

  debug(message: string, data?: unknown): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('DEBUG', message), data || '');
    }
  }
}
