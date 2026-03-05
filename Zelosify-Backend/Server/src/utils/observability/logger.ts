type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  [key: string]: unknown;
}

function log(level: LogLevel, service: string, message: string, meta: Record<string, unknown> = {}): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    ...meta,
  };
  // Always structured JSON — no interpolated strings
  const output = JSON.stringify(entry);
  if (level === "error") {
    console.error(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  info: (service: string, message: string, meta?: Record<string, unknown>) =>
    log("info", service, message, meta),
  warn: (service: string, message: string, meta?: Record<string, unknown>) =>
    log("warn", service, message, meta),
  error: (service: string, message: string, meta?: Record<string, unknown>) =>
    log("error", service, message, meta),
  debug: (service: string, message: string, meta?: Record<string, unknown>) =>
    log("debug", service, message, meta),
};
