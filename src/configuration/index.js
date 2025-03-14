/**
 * Configuration Module
 * 
 * This module manages system settings and customizations for the OpenHands Resolver.
 * It loads configuration from environment variables and custom config files.
 */

const fs = require('fs').promises;
const path = require('path');

class Configuration {
  constructor() {
    // Default configuration values
    this.defaults = {
      github: {
        token: process.env.GITHUB_TOKEN || '',
        apiUrl: 'https://api.github.com',
        defaultBranch: process.env.DEFAULT_BRANCH || 'main'
      },
      claude: {
        apiKey: process.env.CLAUDE_API_KEY || '',
        model: 'claude-3-opus-20240229',
        maxTokens: 4000,
        temperature: 0.7
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: './logs/openhands-resolver.log'
      },
      customInstructions: {
        filename: '.openhands_instructions'
      }
    };

    // Working configuration (will be loaded from files and env vars)
    this.config = JSON.parse(JSON.stringify(this.defaults));
  }

  /**
   * Load configuration from files and environment variables
   */
  async load() {
    try {
      // Try to load custom config file if it exists
      const configPath = path.resolve(process.cwd(), 'openhands-config.json');
      
      try {
        const configFile = await fs.readFile(configPath, 'utf8');
        const fileConfig = JSON.parse(configFile);
        this.mergeConfig(fileConfig);
        console.log(`Loaded configuration from ${configPath}`);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.warn(`Error loading config file: ${err.message}`);
        } else {
          console.log('No custom config file found, using defaults and environment variables');
        }
      }

      // Validate the configuration
      this.validate();
      
      return this.config;
    } catch (error) {
      console.error(`Failed to load configuration: ${error.message}`);
      throw error;
    }
  }

  /**
   * Deep merge custom config into the default config
   * @param {Object} customConfig - Custom configuration to merge
   */
  mergeConfig(customConfig) {
    for (const key in customConfig) {
      if (typeof customConfig[key] === 'object' && customConfig[key] !== null && this.config[key]) {
        this.mergeConfig(customConfig[key], this.config[key]);
      } else {
        this.config[key] = customConfig[key];
      }
    }
  }

  /**
   * Validate the configuration
   */
  validate() {
    const errors = [];

    // Check essential settings
    if (!this.config.github.token) {
      errors.push('GitHub token is required');
    }

    // Additional validations can be added here

    if (errors.length > 0) {
      console.warn('Configuration validation warnings:');
      errors.forEach(error => console.warn(`- ${error}`));
    }

    return errors.length === 0;
  }

  /**
   * Get a configuration value by path
   * @param {string} path - Dot notation path to the config value
   * @param {any} defaultValue - Default value if path doesn't exist
   * @returns {any} - The configuration value
   */
  get(path, defaultValue) {
    const parts = path.split('.');
    let current = this.config;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return defaultValue;
      }
      current = current[part];
    }

    return current !== undefined ? current : defaultValue;
  }

  /**
   * Set a configuration value
   * @param {string} path - Dot notation path to the config value
   * @param {any} value - Value to set
   */
  set(path, value) {
    const parts = path.split('.');
    let current = this.config;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
  }
}

module.exports = Configuration;
