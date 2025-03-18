/**
 * OpenHands Resolver MCP - Configuration Module
 * 
 * This module manages configuration settings from various sources:
 * - Environment variables (.env file)
 * - Configuration files
 * - Repository-specific instructions (.openhands_instructions)
 */

import fs from 'fs/promises';
import path from 'path';
import { getContextLogger } from '../../utils/logger.js';

const logger = getContextLogger('Configuration');

// Default configuration
const DEFAULT_CONFIG = {
  github: {
    token: process.env.GITHUB_TOKEN,
    apiBaseUrl: process.env.GITHUB_API_BASE_URL || 'https://api.github.com',
    timeout: parseInt(process.env.GITHUB_API_TIMEOUT) || 10000,
    maxRetries: parseInt(process.env.GITHUB_API_MAX_RETRIES) || 3,
    maxConcurrent: parseInt(process.env.GITHUB_API_MAX_CONCURRENT) || 5
  },
  ai: {
    model: process.env.AI_MODEL || 'claude-3-opus-20240229',
    temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.2,
    maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 4000,
    systemMessage: 'You are OpenHands, an AI agent designed to resolve GitHub issues by generating code fixes.'
  },
  pullRequest: {
    defaultAsDraft: process.env.PR_DEFAULT_AS_DRAFT === 'true',
    titlePrefix: process.env.PR_TITLE_PREFIX || 'OpenHands: ',
    addLabels: process.env.PR_ADD_LABELS ? process.env.PR_ADD_LABELS.split(',').map(l => l.trim()) : ['ai-assisted'],
    createCheckList: process.env.PR_CREATE_CHECK_LIST === 'true'
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

// Config storage
let configuration = { ...DEFAULT_CONFIG };

/**
 * Initialize the configuration module
 * @param {string} configPath - Optional path to configuration file
 * @returns {Promise<Object>} - The loaded configuration
 */
export async function initialize(configPath) {
  try {
    logger.info('Initializing configuration module');
    
    // Load from configuration file if provided
    if (configPath) {
      logger.debug(`Loading configuration from file: ${configPath}`);
      await loadConfigFile(configPath);
    }
    
    // Validate configuration
    validateConfiguration();
    
    return configuration;
  } catch (error) {
    logger.error('Failed to initialize configuration:', error);
    throw error;
  }
}

/**
 * Load configuration from a file
 * @param {string} configPath - Path to the configuration file
 * @returns {Promise<Object>} - The loaded configuration
 */
async function loadConfigFile(configPath) {
  try {
    const fileContent = await fs.readFile(configPath, 'utf8');
    const fileConfig = JSON.parse(fileContent);
    
    // Deep merge with default configuration
    configuration = deepMerge(configuration, fileConfig);
    
    logger.debug('Configuration loaded from file successfully');
    return configuration;
  } catch (error) {
    logger.error(`Failed to load configuration file ${configPath}:`, error);
    throw error;
  }
}

/**
 * Load repository-specific instructions
 * @param {string} repoPath - Path to the repository
 * @returns {Promise<Object|null>} - The loaded instructions or null if not found
 */
export async function loadRepositoryInstructions(repoPath) {
  try {
    const instructionsPath = path.join(repoPath, '.openhands_instructions');
    const fileContent = await fs.readFile(instructionsPath, 'utf8');
    const instructions = JSON.parse(fileContent);
    
    logger.info('Repository-specific instructions loaded successfully');
    return instructions;
  } catch (error) {
    logger.debug('No repository-specific instructions found or error loading them:', error);
    return null;
  }
}

/**
 * Validate the configuration
 * @throws {Error} If configuration is invalid
 */
function validateConfiguration() {
  // Check for required GitHub token
  if (!configuration.github.token) {
    throw new Error('GitHub token is required. Set GITHUB_TOKEN environment variable.');
  }
  
  // Validate other critical settings
  if (configuration.ai.temperature < 0 || configuration.ai.temperature > 1) {
    logger.warn('Invalid AI temperature. Must be between 0 and 1. Using default: 0.2');
    configuration.ai.temperature = 0.2;
  }
  
  logger.debug('Configuration validated successfully');
}

/**
 * Get the current configuration
 * @param {string} section - Optional section to retrieve
 * @returns {Object} - The current configuration or section
 */
export function getConfig(section) {
  return section ? configuration[section] : configuration;
}

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} - Merged object
 */
function deepMerge(target, source) {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        output[key] = source[key];
      }
    });
  }
  
  return output;
}

/**
 * Check if a value is an object
 * @param {*} item - The value to check
 * @returns {boolean} - True if item is an object
 */
function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}
