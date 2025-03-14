/**
 * Trigger Detection Module
 * Identifies when to start the resolution process
 */

const logger = require('../../utils/logger');

/**
 * Detect triggers from user input
 * @param {Object|string} input - User input from Claude Desktop
 * @returns {Object|null} - Trigger data or null if no trigger detected
 */
function detectTrigger(input) {
  try {
    // Extract the text content from the input
    const text = typeof input === 'string' ? input : (input.text || '');
    
    if (!text) {
      logger.debug('No text content in input');
      return null;
    }

    // Extract potential GitHub issue URL
    const urlRegex = /https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/g;
    const matches = [...text.matchAll(urlRegex)];
    
    if (matches.length > 0) {
      // Single issue
      const [url, owner, repo, issueNumber] = matches[0];
      logger.info(`Detected GitHub issue: ${owner}/${repo}#${issueNumber}`);
      return {
        issueUrl: url,
        owner,
        repo,
        issueNumber: parseInt(issueNumber, 10),
        isBatch: false
      };
    }
    
    // Check for batch resolution request
    const batchRegex = /resolve\s+issues?\s+from\s+(.*)/i;
    const batchMatch = text.match(batchRegex);
    
    if (batchMatch) {
      // Extract issue URLs or references
      const issueList = extractIssueList(batchMatch[1]);
      
      if (issueList.length > 0) {
        logger.info(`Detected batch resolution request with ${issueList.length} issues`);
        return {
          isBatch: true,
          issueList
        };
      }
    }
    
    // Check for repository-wide request
    const repoRegex = /resolve\s+issues?\s+in\s+([^\/]+)\/([^\/\s]+)/i;
    const repoMatch = text.match(repoRegex);
    
    if (repoMatch) {
      const [, owner, repo] = repoMatch;
      logger.info(`Detected repository-wide resolution request: ${owner}/${repo}`);
      return {
        isRepoWide: true,
        owner,
        repo,
        isBatch: false
      };
    }

    logger.debug('No resolution trigger detected in input');
    return null;
  } catch (error) {
    logger.error('Error in trigger detection:', error);
    return null;
  }
}

/**
 * Extract a list of issue references from text
 * @private
 * @param {string} text - Text to extract issues from
 * @returns {Array} - List of issue objects
 */
function extractIssueList(text) {
  const urlRegex = /https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/g;
  const matches = [...text.matchAll(urlRegex)];
  
  return matches.map(match => ({
    issueUrl: match[0],
    owner: match[1],
    repo: match[2],
    issueNumber: parseInt(match[3], 10)
  }));
}

/**
 * Validate that a trigger contains all necessary information
 * @param {Object} triggerData - Data returned from detectTrigger
 * @returns {boolean} - Whether the trigger is valid
 */
function validateTrigger(triggerData) {
  if (!triggerData) return false;
  
  if (triggerData.isBatch) {
    return Array.isArray(triggerData.issueList) && 
           triggerData.issueList.length > 0 &&
           triggerData.issueList.every(issue => 
             issue.owner && issue.repo && issue.issueNumber
           );
  }
  
  if (triggerData.isRepoWide) {
    return Boolean(triggerData.owner && triggerData.repo);
  }
  
  return Boolean(
    triggerData.owner && 
    triggerData.repo && 
    triggerData.issueNumber
  );
}

module.exports = {
  detectTrigger,
  validateTrigger
};