import pino from "pino";
import { getRequestId } from "../context/request-context.js";

const logLevel = process.env.LOG_LEVEL || "info";

export const logger = pino({
  name: "agent-service",
  level: logLevel,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function loggerWithRequestContext() {
  const requestId = getRequestId();
  return requestId ? logger.child({ requestId }) : logger;
}
