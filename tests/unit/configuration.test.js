/**
 * OpenHands Resolver MCP - Configuration Module Unit Tests
 */

import { jest } from '@jest/globals';
import * as configModule from '../../src/modules/configuration/index.js';
import fs from 'fs/promises';

// Mock the logger
jest.mock('../../src/utils/logger.js', () => ({
  getContextLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

// Mock fs.readFile
jest.mock('fs/promises');

describe('Configuration Module Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock for environment variables
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.LOG_LEVEL = 'info';
    process.env.AI_MODEL = 'test-model';
    process.env.AI_TEMPERATURE = '0.2';
    process.env.AI_MAX_TOKENS = '2000';
  });
  
  test('initialize should load default configuration', async () => {
    // Arrange
    
    // Act
    const config = await configModule.initialize();
    
    // Assert
    expect(config).toBeDefined();
    expect(config.github.token).toBe('test-token');
    expect(config.logging.level).toBe('info');
    expect(config.ai.model).toBe('test-model');
  });
  
  test('initialize should load configuration from file', async () => {
    // Arrange
    const mockConfig = {
      github: {
        timeout: 15000,
        maxRetries: 5
      },
      ai: {
        temperature: 0.5
      }
    };
    
    fs.readFile.mockResolvedValue(JSON.stringify(mockConfig));
    
    // Act
    const config = await configModule.initialize('config.json');
    
    // Assert
    expect(fs.readFile).toHaveBeenCalledWith('config.json', 'utf8');
    expect(config).toBeDefined();
    expect(config.github.token).toBe('test-token'); // From env
    expect(config.github.timeout).toBe(15000); // From file
    expect(config.github.maxRetries).toBe(5); // From file
    expect(config.ai.temperature).toBe(0.5); // From file
  });
  
  test('initialize should throw error if GitHub token is missing', async () => {
    // Arrange
    delete process.env.GITHUB_TOKEN;
    
    // Act & Assert
    await expect(configModule.initialize()).rejects.toThrow('GitHub token is required');
  });
  
  test('getConfig should return full config if no section is specified', async () => {
    // Arrange
    await configModule.initialize();
    
    // Act
    const config = configModule.getConfig();
    
    // Assert
    expect(config).toBeDefined();
    expect(config.github).toBeDefined();
    expect(config.ai).toBeDefined();
    expect(config.pullRequest).toBeDefined();
  });
  
  test('getConfig should return specific section if specified', async () => {
    // Arrange
    await configModule.initialize();
    
    // Act
    const githubConfig = configModule.getConfig('github');
    
    // Assert
    expect(githubConfig).toBeDefined();
    expect(githubConfig.token).toBe('test-token');
  });
  
  test('loadRepositoryInstructions should load and parse instructions file', async () => {
    // Arrange
    const mockInstructions = {
      codeStyle: 'standard',
      testRequirements: 'Add tests for all changes',
      priorityLabels: ['high-priority', 'critical']
    };
    
    fs.readFile.mockResolvedValue(JSON.stringify(mockInstructions));
    
    // Act
    const instructions = await configModule.loadRepositoryInstructions('/path/to/repo');
    
    // Assert
    expect(fs.readFile).toHaveBeenCalledWith('/path/to/repo/.openhands_instructions', 'utf8');
    expect(instructions).toEqual(mockInstructions);
  });
  
  test('loadRepositoryInstructions should return null if file is not found', async () => {
    // Arrange
    fs.readFile.mockRejectedValue(new Error('File not found'));
    
    // Act
    const instructions = await configModule.loadRepositoryInstructions('/path/to/repo');
    
    // Assert
    expect(instructions).toBeNull();
  });
});
