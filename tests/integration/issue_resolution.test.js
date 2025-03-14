/**
 * Integration Test for Issue Resolution
 * 
 * Tests the full flow from trigger detection to PR creation
 */

import { jest } from '@jest/globals';
import openhandsResolver from '../../src/index.js';
import githubModule from '../../src/modules/github_api/index.js';
import configModule from '../../src/modules/configuration/index.js';
import taskSetupModule from '../../src/modules/task_setup/index.js';
import codeGenModule from '../../src/modules/code_generation/index.js';

// Mock the modules
jest.mock('../../src/modules/github_api/index.js');
jest.mock('../../src/modules/configuration/index.js');
jest.mock('../../src/modules/code_generation/index.js');

describe('Issue Resolution Integration Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock configuration
    configModule.initialize.mockResolvedValue(true);
    configModule.getConfig.mockReturnValue({
      github: { timeout: 10000 },
      ai: { model: 'claude-3-opus-20240229' },
      pullRequest: { defaultAsDraft: true, titlePrefix: 'OpenHands: ' }
    });
    configModule.getGitHubToken.mockReturnValue('mock-token');
    configModule.getClaudeConfig.mockReturnValue({
      model: 'claude-3-opus-20240229',
      temperature: 0.2
    });
    
    // Mock GitHub API
    githubModule.initialize.mockResolvedValue(true);
    
    // Mock issue data
    githubModule.fetchIssueData.mockResolvedValue({
      owner: 'testuser',
      repo: 'testrepo',
      number: 123,
      title: 'Fix the login button',
      body: 'The login button does not work when clicked.',
      state: 'open',
      labels: ['bug', 'frontend'],
      comments: [
        { id: 1, body: 'I can reproduce this issue', user: 'commenter', created_at: '2023-01-01T00:00:00Z' }
      ],
      user: 'reporter',
      created_at: '2023-01-01T00:00:00Z',
      repository: {
        name: 'testrepo',
        full_name: 'testuser/testrepo',
        default_branch: 'main'
      }
    });
    
    // Mock repository files
    githubModule.fetchRepositoryFiles.mockImplementation((owner, repo, path) => {
      if (path === '') {
        return Promise.resolve([
          { name: 'src', path: 'src', type: 'dir' },
          { name: 'package.json', path: 'package.json', type: 'file' },
          { name: 'README.md', path: 'README.md', type: 'file' }
        ]);
      }
      
      if (path === 'src') {
        return Promise.resolve([
          { name: 'components', path: 'src/components', type: 'dir' },
          { name: 'index.js', path: 'src/index.js', type: 'file' }
        ]);
      }
      
      return Promise.resolve([]);
    });
    
    // Mock file content
    githubModule.fetchFileContent.mockImplementation((owner, repo, path) => {
      if (path === 'src/components/LoginButton.js') {
        return Promise.resolve(`
          function LoginButton() {
            // Bug: onClick handler is missing
            return <button className="login-button">Login</button>;
          }
          
          export default LoginButton;
        `);
      }
      
      if (path === 'package.json') {
        return Promise.resolve('{"name":"testrepo","version":"1.0.0"}');
      }
      
      throw new Error(`File not found: ${path}`);
    });
    
    // Mock branch creation
    githubModule.createBranch.mockResolvedValue({
      name: 'openhands-fix-issue-123',
      sha: 'branch-sha'
    });
    
    // Mock commit creation
    githubModule.commitChanges.mockResolvedValue({
      branch: 'openhands-fix-issue-123',
      files: [
        { path: 'src/components/LoginButton.js', sha: 'file-sha', status: 'modified' }
      ],
      message: 'fix: Fix the login button (fixes #123)'
    });
    
    // Mock PR creation
    githubModule.createPullRequest.mockResolvedValue({
      number: 456,
      url: 'https://github.com/testuser/testrepo/pull/456',
      branch: 'openhands-fix-issue-123',
      title: 'OpenHands: fix: Fix the login button (fixes #123)'
    });
    
    // Mock issue comment
    githubModule.addIssueComment.mockResolvedValue({
      id: 2,
      url: 'https://github.com/testuser/testrepo/issues/123#comment-2',
      body: 'I\'ve created a pull request with a fix'
    });
    
    // Mock code generation
    codeGenModule.generateAndValidateCode.mockResolvedValue({
      codeChanges: [
        {
          path: 'src/components/LoginButton.js',
          content: `
            function LoginButton() {
              // Fixed: Added onClick handler
              const handleLogin = () => {
                console.log('Login clicked');
                // Add authentication logic here
              };
              
              return <button className="login-button" onClick={handleLogin}>Login</button>;
            }
            
            export default LoginButton;
          `
        }
      ],
      explanation: 'Added the missing onClick handler to the login button.',
      validationResult: { valid: true }
    });
  });
  
  test('Full end-to-end issue resolution flow', async () => {
    // Initialize the resolver
    await openhandsResolver.initialize();
    
    // Trigger data for a single issue
    const triggerData = {
      issueUrl: 'https://github.com/testuser/testrepo/issues/123',
      owner: 'testuser',
      repo: 'testrepo',
      issueNumber: 123,
      isBatch: false
    };
    
    // Resolve the issue
    const result = await openhandsResolver.resolveIssue(triggerData);
    
    // Verify the result
    expect(result.success).toBe(true);
    expect(result.issueUrl).toBe(triggerData.issueUrl);
    expect(result.issueNumber).toBe(123);
    expect(result.pullRequestUrl).toBe('https://github.com/testuser/testrepo/pull/456');
    expect(result.pullRequestNumber).toBe(456);
    
    // Verify GitHub API calls
    // Issue fetch
    expect(githubModule.fetchIssueData).toHaveBeenCalledWith(triggerData.issueUrl);
    
    // Repository context fetch
    expect(githubModule.fetchRepositoryFiles).toHaveBeenCalledWith('testuser', 'testrepo', '');
    
    // Branch creation
    expect(githubModule.createBranch).toHaveBeenCalledWith(
      'testuser',
      'testrepo',
      expect.stringContaining('issue-123')
    );
    
    // PR creation
    expect(githubModule.createPullRequest).toHaveBeenCalledWith(
      'testuser',
      'testrepo',
      expect.stringContaining('Fix the login button'),
      expect.stringContaining('pull request addresses'),
      expect.any(String),
      'main',
      true
    );
    
    // Feedback comment
    expect(githubModule.addIssueComment).toHaveBeenCalledWith(
      'testuser',
      'testrepo',
      123,
      expect.stringContaining('created a pull request')
    );
  });
  
  test('MCP invocation with GitHub issue URL', async () => {
    // Initialize the resolver
    await openhandsResolver.initialize();
    
    // Input with GitHub issue URL
    const input = 'Please resolve this issue: https://github.com/testuser/testrepo/issues/123';
    
    // Handle MCP invocation
    const result = await openhandsResolver.handleMcpInvocation(input);
    
    // Verify the result
    expect(result.success).toBe(true);
    expect(result.issueNumber).toBe(123);
    expect(result.pullRequestUrl).toBe('https://github.com/testuser/testrepo/pull/456');
    
    // Verify GitHub API calls
    expect(githubModule.fetchIssueData).toHaveBeenCalledWith(
      'https://github.com/testuser/testrepo/issues/123'
    );
  });
  
  test('Error handling for invalid issue', async () => {
    // Mock fetchIssueData to throw an error
    githubModule.fetchIssueData.mockRejectedValueOnce(
      new Error('Issue not found or no access')
    );
    
    // Initialize the resolver
    await openhandsResolver.initialize();
    
    // Trigger data for a non-existent issue
    const triggerData = {
      issueUrl: 'https://github.com/testuser/testrepo/issues/999',
      owner: 'testuser',
      repo: 'testrepo',
      issueNumber: 999,
      isBatch: false
    };
    
    // Resolve the issue
    const result = await openhandsResolver.resolveIssue(triggerData);
    
    // Verify error handling
    expect(result.success).toBe(false);
    expect(result.error).toBe('Issue not found or no access');
    expect(githubModule.createPullRequest).not.toHaveBeenCalled();
  });
  
  test('Error handling for code generation failure', async () => {
    // Mock code generation to throw an error
    codeGenModule.generateAndValidateCode.mockRejectedValueOnce(
      new Error('Failed to generate code solution')
    );
    
    // Initialize the resolver
    await openhandsResolver.initialize();
    
    // Trigger data
    const triggerData = {
      issueUrl: 'https://github.com/testuser/testrepo/issues/123',
      owner: 'testuser',
      repo: 'testrepo',
      issueNumber: 123,
      isBatch: false
    };
    
    // Resolve the issue
    const result = await openhandsResolver.resolveIssue(triggerData);
    
    // Verify error handling
    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to generate code solution');
    expect(githubModule.createPullRequest).not.toHaveBeenCalled();
  });
  
  test('Batch processing of multiple issues', async () => {
    // Mock batch issue data
    githubModule.fetchIssueData.mockImplementation((issueUrl) => {
      const number = parseInt(issueUrl.split('/').pop());
      return Promise.resolve({
        owner: 'testuser',
        repo: 'testrepo',
        number,
        title: `Fix issue ${number}`,
        body: `Description for issue ${number}`,
        state: 'open',
        labels: ['bug'],
        comments: [],
        user: 'reporter',
        created_at: '2023-01-01T00:00:00Z',
        repository: {
          name: 'testrepo',
          full_name: 'testuser/testrepo',
          default_branch: 'main'
        }
      });
    });
    
    // Mock PR creation for multiple issues
    githubModule.createPullRequest.mockImplementation((owner, repo, title, body, branch) => {
      const number = 400 + parseInt(branch.split('-').pop());
      return Promise.resolve({
        number,
        url: `https://github.com/${owner}/${repo}/pull/${number}`,
        branch,
        title
      });
    });
    
    // Initialize the resolver
    await openhandsResolver.initialize();
    
    // List of issues to process
    const issueList = [
      {
        issueUrl: 'https://github.com/testuser/testrepo/issues/123',
        owner: 'testuser',
        repo: 'testrepo',
        issueNumber: 123
      },
      {
        issueUrl: 'https://github.com/testuser/testrepo/issues/124',
        owner: 'testuser',
        repo: 'testrepo',
        issueNumber: 124
      }
    ];
    
    // Process the batch
    const results = await openhandsResolver.resolveBatch(issueList);
    
    // Verify the results
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(2);
    
    // Each issue should be processed
    expect(results[0].success).toBe(true);
    expect(results[0].issueNumber).toBe(123);
    expect(results[1].success).toBe(true);
    expect(results[1].issueNumber).toBe(124);
    
    // GitHub API should be called for each issue
    expect(githubModule.fetchIssueData).toHaveBeenCalledTimes(2);
    expect(githubModule.createPullRequest).toHaveBeenCalledTimes(2);
  });
  
  test('MCP info returns correct metadata', () => {
    const mcpInfo = openhandsResolver.getMcpInfo();
    
    expect(mcpInfo.name).toBe('OpenHands Resolver MCP');
    expect(mcpInfo.version).toBeDefined();
    expect(Array.isArray(mcpInfo.capabilities)).toBe(true);
    expect(mcpInfo.capabilities).toContain('GitHub issue resolution');
  });
});
