/**
 * GitHub API Integration Module
 * 
 * Handles all GitHub interactions including authentication, issue retrieval,
 * repository access, and pull request creation.
 */

const axios = require('axios');
const logger = require('../../utils/logger');

// Cache to store authenticated client instances
const clientCache = new Map();

/**
 * Initialize the GitHub API module
 * 
 * @returns {Promise<boolean>} - Success status
 */
async function initialize() {
  try {
    logger.info('Initializing GitHub API module');
    
    // Check if GitHub token is configured
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GitHub token not found in environment variables');
    }
    
    // Test API connection
    const client = createApiClient(token);
    await client.get('/rate_limit');
    
    logger.info('GitHub API module initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize GitHub API module:', error);
    return false;
  }
}

/**
 * Create an authenticated GitHub API client
 * 
 * @private
 * @param {string} token - GitHub personal access token
 * @returns {Object} - Axios instance configured for GitHub API
 */
function createApiClient(token) {
  if (!token) {
    throw new Error('GitHub token is required');
  }
  
  if (clientCache.has(token)) {
    return clientCache.get(token);
  }
  
  const client = axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'OpenHands-Resolver'
    }
  });
  
  // Add response interceptor for rate limiting
  client.interceptors.response.use(
    response => response,
    async error => {
      if (error.response && error.response.status === 403 && 
          error.response.headers['x-ratelimit-remaining'] === '0') {
        const resetTime = parseInt(error.response.headers['x-ratelimit-reset']) * 1000;
        const waitTime = resetTime - Date.now();
        
        if (waitTime > 0) {
          logger.warn(`GitHub API rate limit exceeded. Waiting ${waitTime / 1000} seconds.`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          return client(error.config);
        }
      }
      return Promise.reject(error);
    }
  );
  
  clientCache.set(token, client);
  return client;
}

/**
 * Fetch data for a GitHub issue
 * 
 * @param {string} issueUrl - Full GitHub issue URL
 * @returns {Promise<Object>} - Issue data including details and comments
 */
async function fetchIssueData(issueUrl) {
  try {
    const { owner, repo, issueNumber } = parseIssueUrl(issueUrl);
    logger.debug(`Fetching data for issue ${owner}/${repo}#${issueNumber}`);
    
    const token = process.env.GITHUB_TOKEN;
    const client = createApiClient(token);
    
    // Fetch issue details
    const issueResponse = await client.get(`/repos/${owner}/${repo}/issues/${issueNumber}`);
    const issueData = issueResponse.data;
    
    // Fetch issue comments
    const commentsResponse = await client.get(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`);
    const comments = commentsResponse.data;
    
    // Get repository details
    const repoResponse = await client.get(`/repos/${owner}/${repo}`);
    const repoData = repoResponse.data;
    
    return {
      owner,
      repo,
      number: issueNumber,
      title: issueData.title,
      body: issueData.body || '',
      state: issueData.state,
      labels: issueData.labels.map(label => label.name),
      comments: comments.map(comment => ({
        id: comment.id,
        body: comment.body,
        user: comment.user.login,
        created_at: comment.created_at
      })),
      user: issueData.user.login,
      created_at: issueData.created_at,
      updated_at: issueData.updated_at,
      repository: {
        name: repoData.name,
        full_name: repoData.full_name,
        description: repoData.description,
        default_branch: repoData.default_branch,
        language: repoData.language,
        url: repoData.html_url
      }
    };
  } catch (error) {
    logger.error(`Failed to fetch issue data for ${issueUrl}:`, error);
    throw new Error(`GitHub API error: ${error.message}`);
  }
}

/**
 * Parse a GitHub issue URL to extract owner, repo, and issue number
 * 
 * @private
 * @param {string} issueUrl - Full GitHub issue URL
 * @returns {Object} - Parsed components
 */
function parseIssueUrl(issueUrl) {
  const urlRegex = /https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/;
  const match = issueUrl.match(urlRegex);
  
  if (!match) {
    throw new Error(`Invalid GitHub issue URL: ${issueUrl}`);
  }
  
  return {
    owner: match[1],
    repo: match[2],
    issueNumber: parseInt(match[3], 10)
  };
}

/**
 * Fetch repository files
 * 
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - Path within repository
 * @param {string} [branch] - Branch name, defaults to main branch
 * @returns {Promise<Array>} - Files in the repository path
 */
async function fetchRepositoryFiles(owner, repo, path, branch) {
  try {
    const token = process.env.GITHUB_TOKEN;
    const client = createApiClient(token);
    
    // If branch is not specified, get the default branch
    if (!branch) {
      const repoResponse = await client.get(`/repos/${owner}/${repo}`);
      branch = repoResponse.data.default_branch;
    }
    
    // Normalize path
    const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
    
    // Fetch contents
    const response = await client.get(`/repos/${owner}/${repo}/contents/${normalizedPath}`, {
      params: { ref: branch }
    });
    
    // Handle directory vs file
    if (Array.isArray(response.data)) {
      return response.data.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type,
        sha: item.sha,
        size: item.size,
        url: item.html_url,
        download_url: item.download_url
      }));
    } else {
      return [{
        name: response.data.name,
        path: response.data.path,
        type: response.data.type,
        sha: response.data.sha,
        size: response.data.size,
        url: response.data.html_url,
        download_url: response.data.download_url
      }];
    }
  } catch (error) {
    logger.error(`Failed to fetch repository files for ${owner}/${repo}/${path}:`, error);
    throw new Error(`GitHub API error: ${error.message}`);
  }
}

/**
 * Fetch file content from GitHub repository
 * 
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path within repository
 * @param {string} [branch] - Branch name, defaults to main branch
 * @returns {Promise<string>} - Decoded file content
 */
async function fetchFileContent(owner, repo, path, branch) {
  try {
    const token = process.env.GITHUB_TOKEN;
    const client = createApiClient(token);
    
    // If branch is not specified, get the default branch
    if (!branch) {
      const repoResponse = await client.get(`/repos/${owner}/${repo}`);
      branch = repoResponse.data.default_branch;
    }
    
    // Normalize path
    const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
    
    // Fetch file
    const response = await client.get(`/repos/${owner}/${repo}/contents/${normalizedPath}`, {
      params: { ref: branch }
    });
    
    if (response.data.type !== 'file') {
      throw new Error(`Path is not a file: ${path}`);
    }
    
    // Return decoded content
    return Buffer.from(response.data.content, 'base64').toString('utf-8');
  } catch (error) {
    logger.error(`Failed to fetch file content for ${owner}/${repo}/${path}:`, error);
    throw new Error(`GitHub API error: ${error.message}`);
  }
}

/**
 * Create a new branch in the repository
 * 
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branchName - New branch name
 * @param {string} [sourceBranch] - Source branch, defaults to default branch
 * @returns {Promise<Object>} - Branch creation result
 */
async function createBranch(owner, repo, branchName, sourceBranch) {
  try {
    const token = process.env.GITHUB_TOKEN;
    const client = createApiClient(token);
    
    // If source branch is not specified, get the default branch
    if (!sourceBranch) {
      const repoResponse = await client.get(`/repos/${owner}/${repo}`);
      sourceBranch = repoResponse.data.default_branch;
    }
    
    // Get the SHA of the latest commit on the source branch
    const refResponse = await client.get(`/repos/${owner}/${repo}/git/refs/heads/${sourceBranch}`);
    const sha = refResponse.data.object.sha;
    
    // Create new branch
    const response = await client.post(`/repos/${owner}/${repo}/git/refs`, {
      ref: `refs/heads/${branchName}`,
      sha: sha
    });
    
    logger.info(`Created branch ${branchName} in ${owner}/${repo}`);
    
    return {
      name: branchName,
      sha: sha,
      url: response.data.url
    };
  } catch (error) {
    logger.error(`Failed to create branch ${branchName} in ${owner}/${repo}:`, error);
    throw new Error(`GitHub API error: ${error.message}`);
  }
}

/**
 * Commit changes to a repository
 * 
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name
 * @param {Array} changes - Array of file changes
 * @param {string} message - Commit message
 * @returns {Promise<Object>} - Commit result
 */
async function commitChanges(owner, repo, branch, changes, message) {
  try {
    const token = process.env.GITHUB_TOKEN;
    const client = createApiClient(token);
    
    // Process each change
    const fileUpdates = await Promise.all(changes.map(async change => {
      // Check if file exists to determine if it's an update or create
      let fileSha = null;
      try {
        const fileResponse = await client.get(`/repos/${owner}/${repo}/contents/${change.path}`, {
          params: { ref: branch }
        });
        fileSha = fileResponse.data.sha;
      } catch (error) {
        // File doesn't exist, which is fine for new files
        if (error.response && error.response.status !== 404) {
          throw error; // Rethrow if it's not a 404
        }
      }
      
      // Create/update file
      const fileData = {
        message: message,
        content: Buffer.from(change.content).toString('base64'),
        branch: branch
      };
      
      // Include SHA if updating existing file
      if (fileSha) {
        fileData.sha = fileSha;
      }
      
      const response = await client.put(`/repos/${owner}/${repo}/contents/${change.path}`, fileData);
      
      return {
        path: change.path,
        sha: response.data.content.sha,
        status: fileSha ? 'updated' : 'created'
      };
    }));
    
    logger.info(`Committed ${fileUpdates.length} changes to ${owner}/${repo}/${branch}`);
    
    return {
      branch: branch,
      files: fileUpdates,
      message: message
    };
  } catch (error) {
    logger.error(`Failed to commit changes to ${owner}/${repo}/${branch}:`, error);
    throw new Error(`GitHub API error: ${error.message}`);
  }
}

/**
 * Create a pull request
 * 
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} title - PR title
 * @param {string} body - PR description
 * @param {string} head - Head branch
 * @param {string} base - Base branch
 * @param {boolean} [draft=false] - Whether to create as draft PR
 * @returns {Promise<Object>} - Pull request creation result
 */
async function createPullRequest(owner, repo, title, body, head, base, draft = false) {
  try {
    const token = process.env.GITHUB_TOKEN;
    const client = createApiClient(token);
    
    const response = await client.post(`/repos/${owner}/${repo}/pulls`, {
      title: title,
      body: body,
      head: head,
      base: base,
      draft: draft
    });
    
    logger.info(`Created pull request #${response.data.number} in ${owner}/${repo}`);
    
    return {
      number: response.data.number,
      url: response.data.html_url,
      branch: head,
      title: response.data.title
    };
  } catch (error) {
    logger.error(`Failed to create pull request in ${owner}/${repo}:`, error);
    throw new Error(`GitHub API error: ${error.message}`);
  }
}

/**
 * Add a comment to an issue
 * 
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue number
 * @param {string} body - Comment text
 * @returns {Promise<Object>} - Comment creation result
 */
async function addIssueComment(owner, repo, issueNumber, body) {
  try {
    const token = process.env.GITHUB_TOKEN;
    const client = createApiClient(token);
    
    const response = await client.post(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      body: body
    });
    
    logger.info(`Added comment to issue ${owner}/${repo}#${issueNumber}`);
    
    return {
      id: response.data.id,
      url: response.data.html_url,
      body: response.data.body
    };
  } catch (error) {
    logger.error(`Failed to add comment to issue ${owner}/${repo}#${issueNumber}:`, error);
    throw new Error(`GitHub API error: ${error.message}`);
  }
}

/**
 * Update issue labels
 * 
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue number
 * @param {Array} labels - Array of label names
 * @returns {Promise<Object>} - Label update result
 */
async function updateIssueLabels(owner, repo, issueNumber, labels) {
  try {
    const token = process.env.GITHUB_TOKEN;
    const client = createApiClient(token);
    
    const response = await client.put(`/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
      labels: labels
    });
    
    logger.info(`Updated labels for issue ${owner}/${repo}#${issueNumber}`);
    
    return {
      labels: response.data.map(label => label.name)
    };
  } catch (error) {
    logger.error(`Failed to update labels for issue ${owner}/${repo}#${issueNumber}:`, error);
    throw new Error(`GitHub API error: ${error.message}`);
  }
}

module.exports = {
  initialize,
  fetchIssueData,
  fetchRepositoryFiles,
  fetchFileContent,
  createBranch,
  commitChanges,
  createPullRequest,
  addIssueComment,
  updateIssueLabels
};