/**
 * OpenHands Resolver MCP - Logger Utility
 * 
 * Provides consistent logging across the application using Winston.
 * Log levels: error, warn, info, debug
 */

import winston from 'winston';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    // File transport for errors
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    // File transport for all logs
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

// Add MCP-specific context to logs
export function getContextLogger(context) {
  return {
    error: (message, ...meta) => logger.error(`[${context}] ${message}`, ...meta),
    warn: (message, ...meta) => logger.warn(`[${context}] ${message}`, ...meta),
    info: (message, ...meta) => logger.info(`[${context}] ${message}`, ...meta),
    debug: (message, ...meta) => logger.debug(`[${context}] ${message}`, ...meta)
  };
}
