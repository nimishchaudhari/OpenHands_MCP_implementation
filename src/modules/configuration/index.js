/**



 * Configuration Module



 * 



 * Manages system settings and customizations for the OpenHands Resolver MCP



 */







const fs = require('fs').promises;



const path = require('path');



const logger = require('../../utils/logger');







// Default configuration values



const defaultConfig = {



  // GitHub API settings



  github: {



    timeout: 10000, // 10 seconds



    maxRetries: 3,



    maxConcurrent: 5



  },



  



  // AI model settings



  ai: {





  },



  



  // Task configuration



  task: {



    maxContextSnippets: 10,



    maxFileSize: 100000, // 100KB max per file



    prioritizeErrorContext: true



  },



  



  // PR creation settings



  pullRequest: {



    defaultAsDraft: true,



    defaultBaseBranch: '', // Will be read from repository



    titlePrefix: 'OpenHands: ',



    addLabels: ['ai-assisted'],



    createCheckList: true



  },



  



  // Security settings



  security: {



    tokenEnvName: 'GITHUB_TOKEN',



    validateCodeBeforeCommit: true,



    allowedFileTypes: ['.js', '.jsx', '.ts', '.tsx', '.py', '.rb', '.java', '.go', '.php', '.c', '.cpp', '.h', '.cs', '.md', '.txt', '.json', '.yml', '.yaml']



  },



  



  // Batch processing limits



  batch: {



    maxConcurrent: 3,



    maxIssuesPerBatch: 10



  },



  



  // Debug settings



  debug: {



    enabled: false,



    saveResponses: false,



    verboseLogging: false



  }



};







// Current configuration



let currentConfig = { ...defaultConfig };







/**



 * Initialize the configuration module



 * 



 * @param {string} [configPath] - Path to configuration file



 * @returns {Promise<boolean>} - Success status



 */



async function initialize(configPath) {



  try {



    logger.info('Initializing configuration module');



    



    // Start with default config



    currentConfig = { ...defaultConfig };



    



    // If configuration path is provided, load and merge it



    if (configPath) {



      const loadedConfig = await loadConfigFromFile(configPath);



      mergeConfig(loadedConfig);



      logger.debug('Loaded configuration from file');



    }



    



    // Load from environment



    loadFromEnvironment();



    logger.debug('Applied environment configuration');



    



    // Validate the configuration



    const validation = validateConfig(currentConfig);



    if (!validation.valid) {



      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);



    }



    



    logger.info('Configuration module initialized successfully');



    return true;



  } catch (error) {



    logger.error('Failed to initialize configuration module:', error);



    return false;



  }



}







/**



 * Load configuration from file



 * 



 * @private



 * @param {string} configPath - Path to the configuration file



 * @returns {Promise<Object>} - Loaded configuration



 */



async function loadConfigFromFile(configPath) {



  try {



    // Check if file exists



    const stats = await fs.stat(configPath);



    if (!stats.isFile()) {



      throw new Error(`Configuration path is not a file: ${configPath}`);



    }



    



    // Read the file content



    const content = await fs.readFile(configPath, 'utf-8');



    



    // Determine file type and parse accordingly



    if (configPath.endsWith('.json')) {



      return JSON.parse(content);



    } else if (configPath.endsWith('.js')) {



      // For JS files, use require (note: this is not async-safe)



      return require(path.resolve(configPath));



    } else {



      throw new Error(`Unsupported configuration file type: ${configPath}`);



    }



  } catch (error) {



    throw new Error(`Failed to load configuration from ${configPath}: ${error.message}`);



  }



}







/**



 * Load configuration from environment variables



 * 



 * @private



 */



function loadFromEnvironment() {



  // GitHub token



  if (process.env.GITHUB_TOKEN) {



    logger.debug('Found GitHub token in environment');



  } else {



    logger.warn('No GitHub token found in environment, API calls may fail');



  }



  



  // Claude Desktop handles AI model configuration, no environment loading needed



  



  if (process.env.AI_TEMPERATURE) {



    const temp = parseFloat(process.env.AI_TEMPERATURE);



    if (!isNaN(temp)) {



      currentConfig.ai.temperature = temp;



    }



  }



  



  if (process.env.AI_MAX_TOKENS) {



    const tokens = parseInt(process.env.AI_MAX_TOKENS, 10);



    if (!isNaN(tokens)) {



      currentConfig.ai.maxTokens = tokens;



    }



  }



  



  // Debug configuration



  if (process.env.DEBUG_MODE === 'true') {



    currentConfig.debug.enabled = true;



    currentConfig.debug.verboseLogging = true;



  }



  



  // PR configuration



  if (process.env.PR_AS_DRAFT === 'false') {



    currentConfig.pullRequest.defaultAsDraft = false;



  }



  



  // Batch configuration



  if (process.env.MAX_CONCURRENT_ISSUES) {



    const max = parseInt(process.env.MAX_CONCURRENT_ISSUES, 10);



    if (!isNaN(max)) {



      currentConfig.batch.maxConcurrent = max;



    }



  }



}







/**



 * Merge new configuration with existing config



 * 



 * @private



 * @param {Object} newConfig - New configuration to merge



 */



function mergeConfig(newConfig) {



  if (!newConfig) return;



  



  // Deep merge objects



  function deepMerge(target, source) {



    for (const key in source) {



      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {



        if (!target[key]) target[key] = {};



        deepMerge(target[key], source[key]);



      } else {



        target[key] = source[key];



      }



    }



  }



  



  deepMerge(currentConfig, newConfig);



}







/**



 * Validate the configuration



 * 



 * @private



 * @param {Object} config - Configuration to validate



 * @returns {Object} - Validation result with valid flag and errors



 */



function validateConfig(config) {



  const errors = [];



  



  // Validate AI model settings



  if (!config.ai || !config.ai.model) {



    errors.push('AI model not defined');



  }



  



  if (config.ai.temperature < 0 || config.ai.temperature > 1) {



    errors.push('AI temperature must be between 0 and 1');



  }



  



  if (config.ai.maxTokens < 100 || config.ai.maxTokens > 10000) {



    errors.push('AI maxTokens must be between 100 and 10000');



  }



  



  // Validate batch processing settings



  if (config.batch.maxConcurrent < 1) {



    errors.push('Batch maxConcurrent must be at least 1');



  }



  



  if (config.batch.maxIssuesPerBatch < 1) {



    errors.push('Batch maxIssuesPerBatch must be at least 1');



  }



  



  // Validate security settings



  if (!config.security.tokenEnvName) {



    errors.push('Security tokenEnvName not defined');



  }



  



  return {



    valid: errors.length === 0,



    errors



  };



}







/**



 * Get the entire current configuration



 * 



 * @returns {Object} - Current configuration



 */



function getConfig() {



  return { ...currentConfig };



}







/**



 * Get a specific configuration section



 * 



 * @param {string} section - Configuration section name



 * @returns {Object|null} - Configuration section or null if not found



 */



function getConfigSection(section) {



  return currentConfig[section] ? { ...currentConfig[section] } : null;



}







/**



 * Update a specific configuration value



 * 



 * @param {string} key - Dot-notation key to update (e.g., 'ai.temperature')



 * @param {any} value - New value



 * @returns {boolean} - Success status



 */



function updateConfig(key, value) {



  try {



    // Split key by dots to traverse the object



    const parts = key.split('.');



    let current = currentConfig;



    



    // Navigate to the right level



    for (let i = 0; i < parts.length - 1; i++) {



      const part = parts[i];



      if (!current[part]) {



        current[part] = {};



      }



      current = current[part];



    }



    



    // Set the value



    current[parts[parts.length - 1]] = value;



    



    logger.debug(`Updated configuration: ${key} = ${JSON.stringify(value)}`);



    return true;



  } catch (error) {



    logger.error(`Failed to update configuration at ${key}:`, error);



    return false;



  }



}







/**



 * Save the current configuration to a file



 * 



 * @param {string} filePath - Path to save the configuration



 * @returns {Promise<boolean>} - Success status



 */



async function saveConfigToFile(filePath) {



  try {



    // Filter out sensitive information



    const configToSave = { ...currentConfig };



    



    // Remove any sensitive security information



    if (configToSave.security) {



      delete configToSave.security.tokens;



      delete configToSave.security.credentials;



    }



    



    // Create the JSON string with pretty formatting



    const configJson = JSON.stringify(configToSave, null, 2);



    



    // Write to file



    await fs.writeFile(filePath, configJson, 'utf-8');



    



    logger.info(`Configuration saved to ${filePath}`);



    return true;



  } catch (error) {



    logger.error(`Failed to save configuration to ${filePath}:`, error);



    return false;



  }



}







/**



 * Get the GitHub token from environment



 * 



 * @returns {string|null} - GitHub token or null if not available



 */



function getGitHubToken() {



  const tokenEnvName = currentConfig.security.tokenEnvName || 'GITHUB_TOKEN';



  const token = process.env[tokenEnvName];



  



  if (!token) {



    logger.warn(`GitHub token not found in environment variable ${tokenEnvName}`);



    return null;



  }



  



  return token;



}







/**



 * Get Claude Desktop API configuration



 * 



 * @returns {Object} - Claude Desktop configuration



 */



function getClaudeConfig() {



  return {



    model: currentConfig.ai.model,



    temperature: currentConfig.ai.temperature,



    maxTokens: currentConfig.ai.maxTokens,



    systemMessage: currentConfig.ai.systemMessage



  };



}







/**



 * Check if a file type is allowed for modification



 * 



 * @param {string} filename - Name of the file to check



 * @returns {boolean} - Whether the file type is allowed



 */



function isFileTypeAllowed(filename) {



  if (!filename) return false;



  



  const extension = path.extname(filename).toLowerCase();



  const allowedTypes = currentConfig.security.allowedFileTypes || [];



  



  return allowedTypes.includes(extension);



}







/**



 * Reset configuration to defaults



 */



function resetToDefaults() {



  currentConfig = { ...defaultConfig };



  logger.info('Configuration reset to defaults');



}







module.exports = {



  initialize,



  getConfig,



  getConfigSection,



  updateConfig,



  saveConfigToFile,



  getGitHubToken,



  getClaudeConfig,



  isFileTypeAllowed,



  resetToDefaults



};

