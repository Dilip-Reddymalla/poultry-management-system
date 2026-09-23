import pino, { type LoggerOptions } from "pino";
import { env, logLevel } from "./env.js";

const isDev = env.NODE_ENV !== "production";

const options: LoggerOptions = {
  level: logLevel,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.refreshToken",
      "*.secret",
    ],
    remove: true,
  },
};

if (isDev) {
  options.transport = {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
      ignore: "pid,hostname",
    },
  };
} else {
  options.base = { env: env.NODE_ENV };
}

export const logger = pino(options);

export const createChildLogger = (bindings: pino.Bindings) => {
  return logger.child(bindings);
};
