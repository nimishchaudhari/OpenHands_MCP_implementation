/**
 * OpenHands Resolver MCP - GitHub API Integration Module
 * 
 * This module handles all GitHub interactions, including:
 * - Fetching issue details
 * - Getting repository context
 * - Creating branches and commits
 * - Submitting pull requests
 */

import axios from 'axios';
import { getContextLogger } from '../../utils/logger.js';
import { getConfig } from '../configuration/index.js';

const logger = getContextLogger('GitHubAPI');

// GitHub API client
let apiClient = null;

/**
 * Initialize the GitHub API module
 * @returns {Promise<void>}
 */
export async function initialize() {
  try {
    logger.info('Initializing GitHub API module');
    
    const config = getConfig('github');
    
    if (!config.token) {
      throw new Error('GitHub token is required for API initialization');
    }
    
    // Create Axios instance for GitHub API
    apiClient = axios.create({
      baseURL: config.apiBaseUrl,
      timeout: config.timeout,
      headers: {
        'Authorization': `token ${config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'OpenHands-Resolver-MCP'
      }
    });
    
    // Test the API connection
    await testApiConnection();
    
    logger.info('GitHub API module initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize GitHub API module:', error);
    throw error;
  }
}

/**
 * Test the GitHub API connection
 * @returns {Promise<boolean>}
 */
async function testApiConnection() {
  try {
    const response = await apiClient.get('/rate_limit');
    
    if (response.status === 200) {
      const { rate } = response.data;
      logger.info(`GitHub API connection successful. Rate limit: ${rate.remaining}/${rate.limit}`);
      return true;
    }
    
    logger.warn('GitHub API connection test: Unexpected response status', response.status);
    return false;
  } catch (error) {
    logger.error('GitHub API connection test failed:', error);
    throw error;
  }
}

/**
 * Fetch data for a GitHub issue
 * @param {string} issueUrl - Full URL to the GitHub issue
 * @returns {Promise<Object>} - Issue data
 */
export async function fetchIssueData(issueUrl) {
  try {
    logger.debug(`Fetching data for issue: ${issueUrl}`);
    
    // Extract owner, repo, and issue number from URL
    const urlRegex = /github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/i;
    const match = urlRegex.exec(issueUrl);
    
    if (!match) {
      throw new Error(`Invalid GitHub issue URL: ${issueUrl}`);
    }
    
    const [, owner, repo, issueNumber] = match;
    
    // Get issue details
    const issueResponse = await apiClient.get(`/repos/${owner}/${repo}/issues/${issueNumber}`);
    const issueData = issueResponse.data;
    
    // Get issue comments
    const commentsResponse = await apiClient.get(issueData.comments_url);
    const comments = commentsResponse.data;
    
    // Get repository details for context
    const repoResponse = await apiClient.get(`/repos/${owner}/${repo}`);
    const repoData = repoResponse.data;
    
    // Combine the data
    const result = {
      issueUrl,
      owner,
      repo,
      issueNumber: parseInt(issueNumber, 10),
      title: issueData.title,
      body: issueData.body,
      labels: issueData.labels.map(label => label.name),
      state: issueData.state,
      comments: comments.map(comment => ({
        id: comment.id,
        user: comment.user.login,
        body: comment.body,
        createdAt: comment.created_at
      })),
      repository: {
        name: repoData.name,
        fullName: repoData.full_name,
        description: repoData.description,
        defaultBranch: repoData.default_branch,
        language: repoData.language,
        isPrivate: repoData.private
      }
    };
    
    logger.info(`Successfully fetched data for issue #${issueNumber} in ${owner}/${repo}`);
    return result;
  } catch (error) {
    logger.error(`Failed to fetch issue data for ${issueUrl}:`, error);
    throw error;
  }
}

/**
 * Get repository context for analysis
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Object>} - Repository context
 */
export async function getRepositoryContext(owner, repo) {
  try {
    logger.debug(`Getting repository context for ${owner}/${repo}`);
    
    // Get repository details
    const repoResponse = await apiClient.get(`/repos/${owner}/${repo}`);
    const repoData = repoResponse.data;
    
    // Get default branch
    const defaultBranch = repoData.default_branch;
    
    // Get repository content (top-level files)
    const contentResponse = await apiClient.get(`/repos/${owner}/${repo}/contents`);
    const contents = contentResponse.data;
    
    // Check for custom instructions file
    let instructions = null;
    const instructionsFile = contents.find(item => item.name === '.openhands_instructions');
    
    if (instructionsFile) {
      const instructionsResponse = await apiClient.get(instructionsFile.download_url);
      instructions = instructionsResponse.data;
    }
    
    // Get languages used in the repository
    const languagesResponse = await apiClient.get(`/repos/${owner}/${repo}/languages`);
    const languages = languagesResponse.data;
    
    // Combine the data
    const result = {
      owner,
      repo,
      defaultBranch,
      description: repoData.description,
      languages: Object.keys(languages),
      files: contents.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type
      })),
      instructions
    };
    
    logger.info(`Successfully retrieved repository context for ${owner}/${repo}`);
    return result;
  } catch (error) {
    logger.error(`Failed to get repository context for ${owner}/${repo}:`, error);
    throw error;
  }
}

/**
 * Create a new branch in the repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branchName - Name for the new branch
 * @param {string} fromBranch - Branch to create from (defaults to repository's default branch)
 * @returns {Promise<Object>} - Branch creation result
 */
export async function createBranch(owner, repo, branchName, fromBranch = null) {
  try {
    logger.debug(`Creating branch ${branchName} in ${owner}/${repo}`);
    
    // Get the base branch if not specified
    if (!fromBranch) {
      const repoResponse = await apiClient.get(`/repos/${owner}/${repo}`);
      fromBranch = repoResponse.data.default_branch;
    }
    
    // Get the SHA of the latest commit on the base branch
    const refResponse = await apiClient.get(`/repos/${owner}/${repo}/git/refs/heads/${fromBranch}`);
    const sha = refResponse.data.object.sha;
    
    // Create the new branch
    const response = await apiClient.post(`/repos/${owner}/${repo}/git/refs`, {
      ref: `refs/heads/${branchName}`,
      sha
    });
    
    logger.info(`Successfully created branch ${branchName} in ${owner}/${repo}`);
    return {
      name: branchName,
      sha: response.data.object.sha,
      url: response.data.url
    };
  } catch (error) {
    logger.error(`Failed to create branch ${branchName} in ${owner}/${repo}:`, error);
    throw error;
  }
}

/**
 * Commit a file to a repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path
 * @param {string} content - File content
 * @param {string} message - Commit message
 * @param {string} branch - Branch to commit to
 * @returns {Promise<Object>} - Commit result
 */
export async function commitFile(owner, repo, path, content, message, branch) {
  try {
    logger.debug(`Committing file ${path} to ${owner}/${repo}/${branch}`);
    
    // Check if file already exists to get its SHA
    let fileSha = null;
    try {
      const fileResponse = await apiClient.get(`/repos/${owner}/${repo}/contents/${path}?ref=${branch}`);
      fileSha = fileResponse.data.sha;
    } catch (error) {
      // File doesn't exist yet, which is fine
      logger.debug(`File ${path} doesn't exist yet, creating new file`);
    }
    
    // Create or update the file
    const response = await apiClient.put(`/repos/${owner}/${repo}/contents/${path}`, {
      message,
      content: Buffer.from(content).toString('base64'),
      branch,
      sha: fileSha
    });
    
    logger.info(`Successfully committed file ${path} to ${owner}/${repo}/${branch}`);
    return {
      path,
      sha: response.data.content.sha,
      url: response.data.content.html_url
    };
  } catch (error) {
    logger.error(`Failed to commit file ${path} to ${owner}/${repo}/${branch}:`, error);
    throw error;
  }
}

/**
 * Create a pull request
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} title - PR title
 * @param {string} body - PR description
 * @param {string} head - Source branch
 * @param {string} base - Target branch
 * @param {boolean} draft - Whether to create as draft PR
 * @returns {Promise<Object>} - Pull request data
 */
export async function createPullRequest(owner, repo, title, body, head, base, draft = false) {
  try {
    logger.debug(`Creating pull request from ${head} to ${base} in ${owner}/${repo}`);
    
    const response = await apiClient.post(`/repos/${owner}/${repo}/pulls`, {
      title,
      body,
      head,
      base,
      draft
    });
    
    const prData = response.data;
    
    logger.info(`Successfully created pull request #${prData.number} in ${owner}/${repo}`);
    return {
      pullRequestUrl: prData.html_url,
      pullRequestNumber: prData.number,
      state: prData.state,
      title: prData.title,
      body: prData.body
    };
  } catch (error) {
    logger.error(`Failed to create pull request in ${owner}/${repo}:`, error);
    throw error;
  }
}

/**
 * Add a comment to an issue
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue number
 * @param {string} body - Comment body
 * @returns {Promise<Object>} - Comment data
 */
export async function addIssueComment(owner, repo, issueNumber, body) {
  try {
    logger.debug(`Adding comment to issue #${issueNumber} in ${owner}/${repo}`);
    
    const response = await apiClient.post(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      body
    });
    
    logger.info(`Successfully added comment to issue #${issueNumber}`);
    return {
      id: response.data.id,
      url: response.data.html_url
    };
  } catch (error) {
    logger.error(`Failed to add comment to issue #${issueNumber} in ${owner}/${repo}:`, error);
    throw error;
  }
}

/**
 * Update issue labels
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue number
 * @param {Array} labels - Array of label names
 * @returns {Promise<Object>} - Updated issue data
 */
export async function updateIssueLabels(owner, repo, issueNumber, labels) {
  try {
    logger.debug(`Updating labels for issue #${issueNumber} in ${owner}/${repo}`);
    
    const response = await apiClient.patch(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
      labels
    });
    
    logger.info(`Successfully updated labels for issue #${issueNumber}`);
    return {
      issueNumber,
      labels: response.data.labels.map(label => label.name)
    };
  } catch (error) {
    logger.error(`Failed to update labels for issue #${issueNumber} in ${owner}/${repo}:`, error);
    throw error;
  }
}

// Export additional functions
export default {
  initialize,
  fetchIssueData,
  getRepositoryContext,
  createBranch,
  commitFile,
  createPullRequest,
  addIssueComment,
  updateIssueLabels
};
