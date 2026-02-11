type LogLevel = "debug" | "info" | "warn" | "error";

const severity: Record<LogLevel, number> = {
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
};

const configuredLevel = (process.env.LOG_LEVEL as LogLevel | undefined) ??
  (process.env.NODE_ENV === "production" ? "info" : "debug");

function normalizeError(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  return value;
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (severity[level] < severity[configuredLevel]) {
    return;
  }

  const payload = {
    level,
    time: new Date().toISOString(),
    message,
    ...(context ? Object.fromEntries(Object.entries(context).map(([k, v]) => [k, normalizeError(v)])) : {}),
  };

  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

export const logger = {
  debug(context: Record<string, unknown> | undefined, message: string) {
    log("debug", message, context);
  },
  info(context: Record<string, unknown> | undefined, message: string) {
    log("info", message, context);
  },
  warn(context: Record<string, unknown> | undefined, message: string) {
    log("warn", message, context);
  },
  error(context: Record<string, unknown> | undefined, message: string) {
    log("error", message, context);
  },
};
