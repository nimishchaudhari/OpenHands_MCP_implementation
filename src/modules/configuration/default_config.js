/**
 * OpenHands Resolver MCP - Default Configuration
 * 
 * This module defines the default configuration for the OpenHands Resolver MCP.
 */

import * as trackingModels from '../tracking_models/index.js';

/**
 * Default configuration settings
 */
export const DEFAULT_CONFIG = {
  // GitHub API configuration
  github: {
    apiBaseUrl: process.env.GITHUB_API_BASE_URL || 'https://api.github.com',
    apiTimeout: parseInt(process.env.GITHUB_API_TIMEOUT || '10000', 10),
    apiMaxRetries: parseInt(process.env.GITHUB_API_MAX_RETRIES || '3', 10),
    apiMaxConcurrent: parseInt(process.env.GITHUB_API_MAX_CONCURRENT || '5', 10)
  },
  
  // AI model settings
  ai: {
    model: process.env.AI_MODEL || 'claude-3-opus-20240229',
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.2'),
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '4000', 10)
  },
  
  // Pull request settings
  pullRequest: {
    defaultAsDraft: process.env.PR_DEFAULT_AS_DRAFT === 'true',
    titlePrefix: process.env.PR_TITLE_PREFIX || 'OpenHands: ',
    addLabels: (process.env.PR_ADD_LABELS || 'ai-assisted').split(',').map(l => l.trim()),
    createCheckList: process.env.PR_CREATE_CHECK_LIST === 'true'
  },
  
  // Tracking model settings
  trackingModel: {
    type: process.env.TRACKING_MODEL_TYPE || trackingModels.MODEL_TYPES.SIGNED_PNP,
    config: {
      useRobustInitialization: process.env.TRACKING_USE_ROBUST_INIT !== 'false',
      maxIterations: parseInt(process.env.TRACKING_MAX_ITERATIONS || '100', 10),
      convergenceThreshold: parseFloat(process.env.TRACKING_CONVERGENCE_THRESHOLD || '1e-5'),
      useAdaptiveWeights: process.env.TRACKING_USE_ADAPTIVE_WEIGHTS !== 'false',
      modelVariant: process.env.TRACKING_MODEL_VARIANT || 'standard'
    }
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableFileLogging: process.env.ENABLE_FILE_LOGGING !== 'false',
    logDirectory: process.env.LOG_DIRECTORY || 'logs'
  }
};

export default DEFAULT_CONFIG;