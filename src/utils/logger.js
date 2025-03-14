/**
 * Logger utility for the OpenHands Resolver MCP
 * Provides consistent logging across all modules
 */

const winston = require('winston');

// Get log level from environment or default to 'info'
const logLevel = process.env.LOG_LEVEL || 'info';

// Define custom format
const customFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: logLevel,
  format: customFormat,
  defaultMeta: { service: 'openhands-resolver' },
  transports: [
    // Write to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // Write to file (only in production)
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({ filename: 'error.log', level: 'error' }),
      new winston.transports.File({ filename: 'combined.log' })
    ] : [])
  ]
});

// Log format for development environment
if (process.env.NODE_ENV !== 'production') {
  logger.debug('Logging initialized in development mode');
}

module.exports = logger;