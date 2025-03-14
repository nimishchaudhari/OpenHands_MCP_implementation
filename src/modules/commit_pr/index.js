/**
 * Commit and PR Creation Module
 * Manages committing changes and creating pull requests on GitHub
 */

const logger = require('../../utils/logger');
const githubApi = require('../github_api');
const configModule = require('../configuration');

/**
 * Create a pull request for a code solution
 * @param {Object} codeChanges - The generated code changes 
 * @param {Object} issueData - Data about the GitHub issue
 * @returns {Promise<Object>} - Result of the pull request creation
 */
async function createPullRequest(codeChanges, issueData) {
  try {
    logger.info(`Creating pull request for issue #${issueData.number}`);
    
    // Create a branch for the changes
    const branchName = await githubApi.createBranch(issueData);
    logger.info(`Created branch: ${branchName}`);
    
    // Commit each file change
    const commitResults = await commitChanges(codeChanges.codeChanges, branchName, issueData);
    logger.info(`Committed ${commitResults.length} changes to branch: ${branchName}`);
    
    // Generate PR title and body
    const prTitle = generatePrTitle(issueData, codeChanges);
    const prBody = generatePrBody(issueData, codeChanges);
    
    // Create the pull request
    const prResult = await githubApi.createPullRequest(issueData, branchName, prTitle, prBody);
    logger.info(`Created pull request #${prResult.number}: ${prResult.url}`);
    
    return {
      pullRequestNumber: prResult.number,
      pullRequestUrl: prResult.url,
      branch: branchName,
      commits: commitResults
    };
  } catch (error) {
    logger.error(`Failed to create pull request for issue #${issueData.number}:`, error);
    throw new Error(`Pull request creation failed: ${error.message}`);
  }
}

/**
 * Commit code changes to the repository
 * @private
 * @param {Array<Object>} changes - List of code changes
 * @param {string} branchName - Name of the branch to commit to
 * @param {Object} issueData - Data about the GitHub issue
 * @returns {Promise<Array<Object>>} - Results of the commits
 */
async function commitChanges(changes, branchName, issueData) {
  const commitResults = [];
  
  // Fetch existing file content and SHA for each changed file
  const fileInfoMap = new Map();
  for (const change of changes) {
    try {
      const fileInfo = await githubApi.getFileContent(issueData, change.path);
      fileInfoMap.set(change.path, fileInfo);
    } catch (error) {
      // File doesn't exist yet, which is fine for new files
      logger.debug(`File does not exist yet (will be created): ${change.path}`);
    }
  }
  
  // Commit each file change
  for (const change of changes) {
    try {
      const fileInfo = fileInfoMap.get(change.path);
      const sha = fileInfo ? fileInfo.sha : null;
      
      // Create commit message
      const commitMessage = generateCommitMessage(change, issueData);
      
      // Commit the file
      const result = await githubApi.commitFile(
        issueData,
        branchName,
        change.path,
        change.content,
        commitMessage,
        sha
      );
      
      commitResults.push({
        path: change.path,
        sha: result.content.sha,
        commitSha: result.commit.sha
      });
    } catch (error) {
      logger.error(`Failed to commit file ${change.path}:`, error);
      throw new Error(`Failed to commit file ${change.path}: ${error.message}`);
    }
  }
  
  return commitResults;
}

/**
 * Generate a commit message for a code change
 * @private
 * @param {Object} change - Code change
 * @param {Object} issueData - Data about the GitHub issue
 * @returns {string} - Commit message
 */
function generateCommitMessage(change, issueData) {
  const resolverConfig = configModule.getSection('resolver');
  const prefix = resolverConfig.commitMessagePrefix || 'fix';
  const fileName = change.path.split('/').pop();
  
  return `${prefix}: update ${fileName} for issue #${issueData.number}
  
This commit addresses the issue described in #${issueData.number}.
${issueData.title}`;
}

/**
 * Generate a PR title
 * @private
 * @param {Object} issueData - Data about the GitHub issue
 * @param {Object} codeChanges - The generated code changes
 * @returns {string} - PR title
 */
function generatePrTitle(issueData, codeChanges) {
  const issueType = codeChanges.issueType || determineIssueType(issueData);
  
  let prefix;
  switch (issueType) {
    case 'bug':
      prefix = 'fix';
      break;
    case 'feature':
      prefix = 'feat';
      break;
    case 'documentation':
      prefix = 'docs';
      break;
    case 'performance':
      prefix = 'perf';
      break;
    case 'security':
      prefix = 'security';
      break;
    default:
      prefix = 'chore';
  }
  
  return `${prefix}: ${issueData.title} (fixes #${issueData.number})`;
}

/**
 * Determine issue type from issue data
 * @private
 * @param {Object} issueData - Data about the GitHub issue
 * @returns {string} - Issue type
 */
function determineIssueType(issueData) {
  const { labels } = issueData;
  
  if (labels.includes('bug')) return 'bug';
  if (labels.includes('enhancement')) return 'feature';
  if (labels.includes('documentation')) return 'documentation';
  if (labels.includes('performance')) return 'performance';
  if (labels.includes('security')) return 'security';
  
  // Look at issue title for clues
  const lowerTitle = issueData.title.toLowerCase();
  if (lowerTitle.includes('bug') || lowerTitle.includes('fix')) return 'bug';
  if (lowerTitle.includes('feature') || lowerTitle.includes('add')) return 'feature';
  if (lowerTitle.includes('doc')) return 'documentation';
  if (lowerTitle.includes('performance') || lowerTitle.includes('speed')) return 'performance';
  if (lowerTitle.includes('security') || lowerTitle.includes('vulnerability')) return 'security';
  
  return 'chore';
}

/**
 * Generate a PR body
 * @private
 * @param {Object} issueData - Data about the GitHub issue
 * @param {Object} codeChanges - The generated code changes
 * @returns {string} - PR body
 */
function generatePrBody(issueData, codeChanges) {
  let body = `## Fix for Issue #${issueData.number}

This pull request addresses the issue described in [#${issueData.number}](${issueData.url}).

### Issue Description
${issueData.title}

${issueData.body ? '> ' + issueData.body.replace(/\n/g, '\n> ') : ''}

### Changes Made
`;

  // List the files modified
  if (codeChanges.codeChanges && codeChanges.codeChanges.length > 0) {
    body += '\nModified files:\n';
    
    for (const change of codeChanges.codeChanges) {
      body += `- \`${change.path}\`\n`;
    }
  }

  // Add explanation if available
  if (codeChanges.explanation) {
    body += `\n### Explanation\n${codeChanges.explanation}\n`;
  }

  body += `
### Test Plan
This change has been automatically validated for basic syntax correctness.
Please review the changes and test the functionality to ensure the issue is resolved.

---
*This pull request was generated automatically by the OpenHands Resolver MCP.*
`;

  return body;
}

module.exports = {
  createPullRequest
};