import pino from "pino";

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
