/**
 * OpenHands Resolver MCP - Commit and PR Creation Module
 * 
 * This module manages committing changes and creating pull requests:
 * - Creates a new branch for changes
 * - Commits generated code changes to the repository
 * - Creates a pull request for review
 * - Handles PR metadata like labels, assignees, and reviewers
 */

import { getContextLogger } from '../../utils/logger.js';
import { getConfig } from '../configuration/index.js';
import * as githubModule from '../github_api/index.js';

const logger = getContextLogger('CommitPR');

/**
 * Create a pull request with the generated code changes
 * @param {Object} codeChanges - Generated code changes from the code generation module
 * @param {Object} issueData - GitHub issue data
 * @returns {Promise<Object>} - Pull request data
 */
export async function createPullRequest(codeChanges, issueData) {
  try {
    logger.info(`Creating pull request for issue #${issueData.issueNumber} in ${issueData.owner}/${issueData.repo}`);
    
    // Get configurations
    const prConfig = getConfig('pullRequest');
    
    // Create a branch for the changes
    const branch = await createBranchForChanges(issueData);
    logger.debug(`Created branch: ${branch.name}`);
    
    // Commit the changes
    const commitResults = await commitChangesToBranch(
      codeChanges.codeChanges,
      issueData,
      branch.name
    );
    logger.debug(`Committed ${commitResults.length} files`);
    
    // Get base branch (repository's default branch)
    const baseBranch = issueData.repository.defaultBranch;
    
    // Prepare PR title and body
    const { title, body } = preparePullRequestContent(issueData, codeChanges);
    
    // Create the pull request
    const pullRequest = await githubModule.createPullRequest(
      issueData.owner,
      issueData.repo,
      title,
      body,
      branch.name,
      baseBranch,
      prConfig.defaultAsDraft
    );
    
    logger.info(`Created pull request: ${pullRequest.pullRequestUrl}`);
    
    // Return the result
    return {
      ...pullRequest,
      branch: branch.name,
      commits: commitResults.length,
      files: commitResults
    };
  } catch (error) {
    logger.error(`Failed to create pull request for issue #${issueData.issueNumber}:`, error);
    throw error;
  }
}

/**
 * Create a branch for the code changes
 * @param {Object} issueData - GitHub issue data
 * @returns {Promise<Object>} - Branch data
 */
async function createBranchForChanges(issueData) {
  try {
    // Generate a branch name based on the issue
    const branchName = generateBranchName(issueData);
    
    // Create the branch
    return await githubModule.createBranch(
      issueData.owner,
      issueData.repo,
      branchName
    );
  } catch (error) {
    logger.error(`Failed to create branch for issue #${issueData.issueNumber}:`, error);
    throw error;
  }
}

/**
 * Generate a branch name based on the issue data
 * @param {Object} issueData - GitHub issue data
 * @returns {string} - Generated branch name
 */
function generateBranchName(issueData) {
  try {
    // Extract keywords from issue title
    const titleWords = issueData.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 3);
    
    // Create slug from keywords
    const titleSlug = titleWords.join('-');
    
    // Generate branch name with issue number and timestamp
    const timestamp = Date.now().toString().slice(-6);
    return `fix-issue-${issueData.issueNumber}-${titleSlug}-${timestamp}`;
  } catch (error) {
    logger.warn('Error generating branch name:', error);
    // Fallback to a simpler name
    return `fix-issue-${issueData.issueNumber}-${Date.now().toString().slice(-6)}`;
  }
}

/**
 * Commit code changes to the branch
 * @param {Array} changes - Code changes to commit
 * @param {Object} issueData - GitHub issue data
 * @param {string} branch - Branch name
 * @returns {Promise<Array>} - Commit results
 */
async function commitChangesToBranch(changes, issueData, branch) {
  try {
    logger.debug(`Committing ${changes.length} files to branch ${branch}`);
    
    // Commit each file
    const commitResults = await Promise.all(
      changes.map(async change => {
        try {
          // Create a commit message for the change
          const message = `Fix issue #${issueData.issueNumber}: ${change.reason}`;
          
          // Commit the file
          return await githubModule.commitFile(
            issueData.owner,
            issueData.repo,
            change.filePath,
            change.modifiedContent,
            message,
            branch
          );
        } catch (error) {
          logger.error(`Failed to commit file ${change.filePath}:`, error);
          throw error;
        }
      })
    );
    
    return commitResults;
  } catch (error) {
    logger.error(`Failed to commit changes to branch ${branch}:`, error);
    throw error;
  }
}

/**
 * Prepare the pull request title and body
 * @param {Object} issueData - GitHub issue data
 * @param {Object} codeChanges - Generated code changes
 * @returns {Object} - PR title and body
 */
function preparePullRequestContent(issueData, codeChanges) {
  try {
    // Get PR configurations
    const prConfig = getConfig('pullRequest');
    
    // Prepare PR title
    const title = `${prConfig.titlePrefix}Fix #${issueData.issueNumber}: ${issueData.title}`;
    
    // Prepare PR body
    const body = `
## Issue
Fixes #${issueData.issueNumber}

## Description
This pull request addresses the issue described in #${issueData.issueNumber}.

${codeChanges.summary}

## Changes Made
${codeChanges.codeChanges.map(change => 
  `- Modified \`${change.filePath}\`: ${change.reason}`
).join('\n')}

## Validation
${codeChanges.isValid ? 
  '✅ All changes have been validated.' : 
  '⚠️ Some changes have validation issues. Please review carefully.'}

---
> This PR was automatically generated by OpenHands Resolver
`;
    
    return { title, body };
  } catch (error) {
    logger.error('Error preparing pull request content:', error);
    
    // Fallback to a simple title and body
    return {
      title: `Fix issue #${issueData.issueNumber}`,
      body: `This pull request fixes issue #${issueData.issueNumber}.`
    };
  }
}

/**
 * Get the status of a pull request
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} pullNumber - Pull request number
 * @returns {Promise<Object>} - Pull request status
 */
export async function getPullRequestStatus(owner, repo, pullNumber) {
  try {
    // This would call the GitHub API to get the PR status
    // Placeholder implementation
    return {
      state: 'open', 
      merged: false,
      reviewStatus: 'pending'
    };
  } catch (error) {
    logger.error(`Failed to get status for PR #${pullNumber}:`, error);
    throw error;
  }
}

/**
 * Update pull request metadata (labels, assignees)
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} pullNumber - Pull request number
 * @param {Object} metadata - Metadata to update
 * @returns {Promise<Object>} - Updated pull request
 */
export async function updatePullRequestMetadata(owner, repo, pullNumber, metadata) {
  try {
    logger.debug(`Updating metadata for PR #${pullNumber}`);
    
    // This would call the GitHub API to update PR metadata
    // Placeholder implementation
    return {
      pullRequestNumber: pullNumber,
      updated: true
    };
  } catch (error) {
    logger.error(`Failed to update metadata for PR #${pullNumber}:`, error);
    throw error;
  }
}

/**
 * Create a checklist in the pull request body
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} pullNumber - Pull request number
 * @param {Object} codeChanges - Generated code changes
 * @returns {Promise<boolean>} - Success status
 */
export async function createPullRequestChecklist(owner, repo, pullNumber, codeChanges) {
  try {
    logger.debug(`Creating checklist for PR #${pullNumber}`);
    
    // Get current PR details
    // Placeholder implementation
    const prDetails = {
      body: 'Existing PR body'
    };
    
    // Append checklist to PR body
    const checklist = generateChecklist(codeChanges);
    const updatedBody = `${prDetails.body}\n\n## Review Checklist\n${checklist}`;
    
    // Update PR with new body
    // Placeholder implementation
    return true;
  } catch (error) {
    logger.error(`Failed to create checklist for PR #${pullNumber}:`, error);
    return false;
  }
}

/**
 * Generate a checklist based on code changes
 * @param {Object} codeChanges - Generated code changes
 * @returns {string} - Markdown checklist
 */
function generateChecklist(codeChanges) {
  try {
    const items = [
      'Code compiles without errors',
      'Tests pass',
      'Issue is resolved',
      'No new warnings introduced',
      'Code follows repository standards'
    ];
    
    // Add file-specific checks if there are validation issues
    if (!codeChanges.isValid) {
      codeChanges.validationResults
        .filter(result => !result.valid)
        .forEach(result => {
          items.push(`Fix validation issues in \`${result.filePath}\``);
        });
    }
    
    return items.map(item => `- [ ] ${item}`).join('\n');
  } catch (error) {
    logger.error('Error generating checklist:', error);
    return '- [ ] Review the changes';
  }
}

// Export additional functions
export default {
  createPullRequest,
  getPullRequestStatus,
  updatePullRequestMetadata,
  createPullRequestChecklist
};
