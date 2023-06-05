import { createLogger, transports, format } from 'winston';

const level =
  process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'debug'
    ? 'debug'
    : 'info';

export const logger = createLogger({
  transports: [new transports.Console()],
  format: format.combine(
    format.colorize(),
    format.timestamp(),
    format.printf(({ timestamp, level, message, service }) => {
      return `[${timestamp}] ${service} ${level}: ${message}`;
    })
  ),
  defaultMeta: {
    service: 'Milvus-sdk-node',
  },
  level,
});
