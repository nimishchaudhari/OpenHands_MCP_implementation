/**
 * OpenHands Resolver MCP - Integration Tests
 * 
 * These tests verify that the entire resolver workflow functions correctly,
 * from issue detection to pull request creation.
 */

import { jest } from '@jest/globals';
import * as openhandsResolver from '../../src/index.js';
import * as githubModule from '../../src/modules/github_api/index.js';
import * as codeGenModule from '../../src/modules/code_generation/index.js';

// Mock all modules to avoid actual API calls
jest.mock('../../src/modules/github_api/index.js');
jest.mock('../../src/modules/code_generation/index.js');
jest.mock('../../src/modules/configuration/index.js', () => ({
  initialize: jest.fn(() => Promise.resolve()),
  getConfig: jest.fn((section) => {
    const config = {
      github: {
        token: 'test-token',
        maxConcurrent: 3
      },
      ai: {
        model: 'test-model',
        temperature: 0.2,
        systemMessage: 'Test System Message'
      },
      pullRequest: {
        defaultAsDraft: true,
        titlePrefix: 'OpenHands: ',
        addLabels: ['ai-assisted']
      }
    };
    return section ? config[section] : config;
  })
}));

// Mock the logger
jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  },
  getContextLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('OpenHands Resolver Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup basic mocks for GitHub API
    githubModule.initialize.mockResolvedValue();
    githubModule.fetchIssueData.mockResolvedValue({
      issueUrl: 'https://github.com/owner/repo/issues/123',
      owner: 'owner',
      repo: 'repo',
      issueNumber: 123,
      title: 'Test Issue',
      body: 'This is a test issue body',
      labels: ['bug'],
      comments: [],
      repository: {
        defaultBranch: 'main',
        name: 'repo',
        fullName: 'owner/repo'
      }
    });
    
    githubModule.createBranch.mockResolvedValue({
      name: 'fix-issue-123-test-issue',
      sha: 'test-sha'
    });
    
    githubModule.commitFile.mockResolvedValue({
      path: 'src/test.js',
      sha: 'test-file-sha'
    });
    
    githubModule.createPullRequest.mockResolvedValue({
      pullRequestUrl: 'https://github.com/owner/repo/pull/456',
      pullRequestNumber: 456,
      state: 'open',
      title: 'Test PR'
    });
    
    githubModule.addIssueComment.mockResolvedValue({
      id: 'comment-id',
      url: 'comment-url'
    });
    
    // Setup code generation mocks
    codeGenModule.generateAndValidateCode.mockResolvedValue({
      codeChanges: [
        {
          filePath: 'src/test.js',
          originalContent: 'Original content',
          modifiedContent: 'Modified content with fix',
          diff: '@@ -1 +1 @@\n-Original content\n+Modified content with fix',
          reason: 'Fixed bug in test.js'
        }
      ],
      isValid: true,
      validationResults: [
        {
          filePath: 'src/test.js',
          valid: true,
          messages: ['Validation passed']
        }
      ],
      summary: '# Code Changes Summary\n\nTotal files modified: 1'
    });
  });
  
  test('should initialize the resolver successfully', async () => {
    // Act
    const result = await openhandsResolver.initialize();
    
    // Assert
    expect(result).toBe(true);
    expect(githubModule.initialize).toHaveBeenCalled();
  });
  
  test('should resolve a single issue successfully', async () => {
    // Arrange
    await openhandsResolver.initialize();
    
    const triggerData = {
      issueUrl: 'https://github.com/owner/repo/issues/123',
      owner: 'owner',
      repo: 'repo',
      issueNumber: 123,
      isBatch: false
    };
    
    // Act
    const result = await openhandsResolver.resolveIssue(triggerData);
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.pullRequestUrl).toBe('https://github.com/owner/repo/pull/456');
    expect(result.issueNumber).toBe(123);
    expect(githubModule.fetchIssueData).toHaveBeenCalledWith(triggerData.issueUrl);
    expect(codeGenModule.generateAndValidateCode).toHaveBeenCalled();
    expect(githubModule.createPullRequest).toHaveBeenCalled();
    expect(githubModule.addIssueComment).toHaveBeenCalled();
  });
  
  test('should handle errors during issue resolution', async () => {
    // Arrange
    await openhandsResolver.initialize();
    
    const triggerData = {
      issueUrl: 'https://github.com/owner/repo/issues/123',
      owner: 'owner',
      repo: 'repo',
      issueNumber: 123,
      isBatch: false
    };
    
    // Simulate an error during code generation
    codeGenModule.generateAndValidateCode.mockRejectedValue(
      new Error('Failed to generate code')
    );
    
    // Act
    const result = await openhandsResolver.resolveIssue(triggerData);
    
    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to generate code');
    expect(githubModule.fetchIssueData).toHaveBeenCalledWith(triggerData.issueUrl);
    expect(codeGenModule.generateAndValidateCode).toHaveBeenCalled();
    expect(githubModule.createPullRequest).not.toHaveBeenCalled();
  });
  
  test('should detect and validate triggers from user input', async () => {
    // Arrange
    await openhandsResolver.initialize();
    
    const userInput = 'Please resolve this GitHub issue: https://github.com/owner/repo/issues/123';
    
    // Act
    const result = await openhandsResolver.handleMcpInvocation(userInput);
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.pullRequestUrl).toBeDefined();
    expect(githubModule.fetchIssueData).toHaveBeenCalled();
    expect(codeGenModule.generateAndValidateCode).toHaveBeenCalled();
    expect(githubModule.createPullRequest).toHaveBeenCalled();
  });
  
  test('should handle batch processing of multiple issues', async () => {
    // Arrange
    await openhandsResolver.initialize();
    
    const userInput = 'Resolve these GitHub issues: https://github.com/owner/repo/issues/123 and https://github.com/owner/repo/issues/124';
    
    // Mock batch processing behavior
    githubModule.fetchIssueData.mockImplementation((url) => {
      const issueNumber = url.endsWith('123') ? 123 : 124;
      return Promise.resolve({
        issueUrl: url,
        owner: 'owner',
        repo: 'repo',
        issueNumber,
        title: `Test Issue ${issueNumber}`,
        body: `This is test issue ${issueNumber}`,
        labels: ['bug'],
        comments: [],
        repository: {
          defaultBranch: 'main',
          name: 'repo',
          fullName: 'owner/repo'
        }
      });
    });
    
    // Act
    const result = await openhandsResolver.handleMcpInvocation(userInput);
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.isBatch).toBe(true);
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.results.length).toBeGreaterThan(0);
    expect(githubModule.fetchIssueData).toHaveBeenCalled();
  });
});
