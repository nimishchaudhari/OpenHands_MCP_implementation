/**
 * Integration tests for OpenHands Resolver MCP
 * 
 * These tests verify the end-to-end workflow from trigger to PR creation
 */

const openhandsResolver = require('../../src/index');
const githubModule = require('../../src/modules/github_api');
const configModule = require('../../src/modules/configuration');

// Mock dependencies
jest.mock('../../src/modules/github_api');
jest.mock('../../src/modules/configuration');

describe('OpenHands Resolver MCP Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up mocked configuration
    configModule.getConfig.mockReturnValue({
      github: {
        timeout: 10000,
        maxRetries: 3,
        maxConcurrent: 5
      },
      ai: {
        model: 'claude-3-opus-20240229',
        temperature: 0.2,
        maxTokens: 4000,
        systemMessage: 'You are OpenHands, an AI agent designed to resolve GitHub issues by generating code fixes.'
      },
      task: {
        maxContextSnippets: 10,
        maxFileSize: 100000,
        prioritizeErrorContext: true
      },
      pullRequest: {
        defaultAsDraft: true,
        defaultBaseBranch: 'main',
        titlePrefix: 'OpenHands: ',
        addLabels: ['ai-assisted'],
        createCheckList: true
      }
    });
    
    configModule.getGitHubToken.mockReturnValue('mock-github-token');
    configModule.getClaudeConfig.mockReturnValue({
      model: 'claude-3-opus-20240229',
      temperature: 0.2,
      maxTokens: 4000,
      systemMessage: 'You are OpenHands, an AI agent designed to resolve GitHub issues by generating code fixes.'
    });
    
    // Mock GitHub API responses
    githubModule.initialize.mockResolvedValue(true);
    githubModule.fetchIssueData.mockResolvedValue({
      owner: 'testowner',
      repo: 'testrepo',
      number: 123,
      title: 'Fix bug in user authentication',
      body: 'The login function fails when users enter special characters in their username.',
      state: 'open',
      labels: ['bug', 'high-priority'],
      comments: [
        {
          id: 1,
          body: 'I can reproduce this by entering "@" in the username field.',
          user: 'testuser',
          created_at: '2023-01-01T00:00:00Z'
        }
      ],
      user: 'reporter',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T01:00:00Z',
      repository: {
        name: 'testrepo',
        full_name: 'testowner/testrepo',
        description: 'Test repository',
        default_branch: 'main',
        language: 'JavaScript',
        url: 'https://github.com/testowner/testrepo'
      }
    });
    
    githubModule.fetchRepositoryFiles.mockResolvedValue([
      {
        name: 'src',
        path: 'src',
        type: 'dir'
      },
      {
        name: 'README.md',
        path: 'README.md',
        type: 'file',
        sha: 'abc123',
        size: 1000,
        url: 'https://github.com/testowner/testrepo/blob/main/README.md',
        download_url: 'https://raw.githubusercontent.com/testowner/testrepo/main/README.md'
      }
    ]);
    
    githubModule.fetchFileContent.mockImplementation((owner, repo, path) => {
      if (path === 'src/auth/login.js') {
        return Promise.resolve(`
function login(username, password) {
  // Validate username and password
  if (!username || !password) {
    throw new Error('Username and password are required');
  }
  
  // Bug: Special characters aren't handled properly
  if (username.includes('@')) {
    return { success: false, error: 'Invalid username' };
  }
  
  // Check credentials against database
  // ...
  
  return { success: true, token: 'jwt-token' };
}

module.exports = { login };
        `);
      }
      
      if (path === '.openhands_instructions') {
        return Promise.resolve(`{
  "codeStyle": "standard",
  "testRequirements": "Add tests for changes",
  "priorityLabels": ["high-priority", "critical"]
}`);
      }
      
      return Promise.reject(new Error(`File not found: ${path}`));
    });
    
    githubModule.createBranch.mockResolvedValue({
      name: 'fix-issue-123',
      sha: 'branch-sha',
      url: 'https://api.github.com/repos/testowner/testrepo/git/refs/heads/fix-issue-123'
    });
    
    githubModule.commitChanges.mockResolvedValue({
      branch: 'fix-issue-123',
      files: [
        {
          path: 'src/auth/login.js',
          sha: 'commit-sha',
          status: 'updated'
        }
      ],
      message: 'Fix bug in user authentication'
    });
    
    githubModule.createPullRequest.mockResolvedValue({
      number: 456,
      url: 'https://github.com/testowner/testrepo/pull/456',
      branch: 'fix-issue-123',
      title: 'OpenHands: Fix bug in user authentication'
    });
    
    githubModule.addIssueComment.mockResolvedValue({
      id: 2,
      url: 'https://github.com/testowner/testrepo/issues/123#issuecomment-2',
      body: 'I\'ve created a pull request with a fix: #456'
    });
  });
  
  test('Initializes correctly', async () => {
    expect(await openhandsResolver.initialize()).toBe(true);
    expect(configModule.initialize).toHaveBeenCalled();
    expect(githubModule.initialize).toHaveBeenCalled();
  });
  
  test('Full resolution workflow for a single issue', async () => {
    await openhandsResolver.initialize();
    
    const triggerData = {
      issueUrl: 'https://github.com/testowner/testrepo/issues/123',
      owner: 'testowner',
      repo: 'testrepo',
      issueNumber: 123,
      isBatch: false
    };
    
    const result = await openhandsResolver.resolveIssue(triggerData);
    
    // Verify complete workflow
    expect(githubModule.fetchIssueData).toHaveBeenCalledWith(triggerData.issueUrl);
    expect(result.success).toBe(true);
    expect(result.issueUrl).toBe(triggerData.issueUrl);
    expect(result.issueNumber).toBe(123);
    expect(result.pullRequestUrl).toBe('https://github.com/testowner/testrepo/pull/456');
    expect(result.pullRequestNumber).toBe(456);
    
    // Verify PR was created with the right parameters
    expect(githubModule.createPullRequest).toHaveBeenCalled();
    const prCall = githubModule.createPullRequest.mock.calls[0];
    expect(prCall[0]).toBe('testowner'); // owner
    expect(prCall[1]).toBe('testrepo'); // repo
    expect(prCall[2]).toContain('Fix bug in user authentication'); // title
    expect(prCall[3]).toContain('This PR addresses issue #123'); // body
    expect(prCall[4]).toBe('fix-issue-123'); // head
    expect(prCall[5]).toBe('main'); // base
    expect(prCall[6]).toBe(true); // draft
  });
  
  test('Batch processing handles multiple issues', async () => {
    await openhandsResolver.initialize();
    
    const issueList = [
      {
        issueUrl: 'https://github.com/testowner/testrepo/issues/123',
        owner: 'testowner',
        repo: 'testrepo',
        issueNumber: 123
      },
      {
        issueUrl: 'https://github.com/testowner/testrepo/issues/124',
        owner: 'testowner',
        repo: 'testrepo',
        issueNumber: 124
      }
    ];
    
    const result = await openhandsResolver.resolveBatch(issueList);
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result[0].success).toBe(true);
    expect(result[1].success).toBe(true);
    
    // Verify that resolution was called for each issue
    expect(githubModule.fetchIssueData).toHaveBeenCalledTimes(2);
  });
  
  test('Handles errors gracefully during resolution', async () => {
    await openhandsResolver.initialize();
    
    // Set up an error scenario
    githubModule.fetchIssueData.mockRejectedValueOnce(new Error('API rate limit exceeded'));
    
    const triggerData = {
      issueUrl: 'https://github.com/testowner/testrepo/issues/123',
      owner: 'testowner',
      repo: 'testrepo',
      issueNumber: 123,
      isBatch: false
    };
    
    const result = await openhandsResolver.resolveIssue(triggerData);
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('API rate limit exceeded');
  });
  
  test('MCP invocation detects and processes the correct trigger', async () => {
    await openhandsResolver.initialize();
    
    const input = 'Please resolve this GitHub issue: https://github.com/testowner/testrepo/issues/123';
    
    const result = await openhandsResolver.handleMcpInvocation(input);
    
    expect(result.success).toBe(true);
    expect(result.issueNumber).toBe(123);
    expect(result.pullRequestUrl).toBe('https://github.com/testowner/testrepo/pull/456');
  });
  
  test('MCP returns appropriate info when requested', () => {
    const info = openhandsResolver.getMcpInfo();
    
    expect(info.name).toBe('OpenHands Resolver MCP');
    expect(info.version).toBeDefined();
    expect(Array.isArray(info.capabilities)).toBe(true);
    expect(info.capabilities).toContain('GitHub issue resolution');
  });
});
