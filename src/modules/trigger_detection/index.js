/**
 * OpenHands Resolver MCP - Trigger Detection Module
 * 
 * This module identifies when to start the resolution process based on:
 * - Natural language requests in Claude Desktop
 * - GitHub issue URLs or identifiers
 * - Batch processing requests
 */

import { getContextLogger } from '../../utils/logger.js';

const logger = getContextLogger('TriggerDetection');

// Regex patterns for identifying GitHub issues
const GITHUB_ISSUE_REGEX = /github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/gi;
const ISSUE_MENTION_REGEX = /(fix|resolve|solve)\s+(issue|#)?\s*(\d+)/gi;
const BATCH_REQUEST_REGEX = /(fix|resolve|solve)\s+(issues|multiple issues|several issues)/i;

/**
 * Detect resolution trigger from user input
 * @param {Object} input - User input from Claude Desktop
 * @returns {Object|null} - Trigger data or null if no trigger detected
 */
export function detectTrigger(input) {
  try {
    logger.debug('Analyzing input for trigger detection');
    
    // Handle case where input is a string
    const text = typeof input === 'string' ? input : input.text || JSON.stringify(input);
    
    // Check for batch request
    const isBatchRequest = BATCH_REQUEST_REGEX.test(text);
    
    // Extract GitHub issue URLs
    const issueUrls = extractGitHubIssueUrls(text);
    
    // Extract issue mentions like "fix #123"
    const issueMentions = extractIssueMentions(text);
    
    // Handle different cases
    if (isBatchRequest && (issueUrls.length > 0 || issueMentions.length > 0)) {
      // Batch processing with multiple issues
      logger.info(`Detected batch request with ${issueUrls.length + issueMentions.length} issues`);
      return {
        isBatch: true,
        issueList: [...issueUrls, ...issueMentions]
      };
    } else if (issueUrls.length === 1) {
      // Single GitHub issue URL
      logger.info(`Detected single GitHub issue: ${issueUrls[0].issueUrl}`);
      return issueUrls[0];
    } else if (issueMentions.length === 1) {
      // Single issue mention
      logger.info(`Detected issue mention: ${issueMentions[0].issueNumber}`);
      return issueMentions[0];
    } else if (issueUrls.length > 0 || issueMentions.length > 0) {
      // Multiple issues detected but not explicitly a batch request
      // We'll treat it as a batch anyway
      logger.info(`Treating ${issueUrls.length + issueMentions.length} issues as batch`);
      return {
        isBatch: true,
        issueList: [...issueUrls, ...issueMentions]
      };
    }
    
    logger.debug('No GitHub issue trigger detected in input');
    return null;
  } catch (error) {
    logger.error('Error detecting trigger:', error);
    return null;
  }
}

/**
 * Extract GitHub issue URLs from text
 * @param {string} text - The text to analyze
 * @returns {Array} - Array of issue data objects
 */
function extractGitHubIssueUrls(text) {
  const issues = [];
  let match;
  
  // Reset regex to start from beginning
  GITHUB_ISSUE_REGEX.lastIndex = 0;
  
  while ((match = GITHUB_ISSUE_REGEX.exec(text)) !== null) {
    const [issueUrl, owner, repo, issueNumber] = match;
    
    issues.push({
      issueUrl,
      owner,
      repo,
      issueNumber: parseInt(issueNumber, 10),
      isBatch: false
    });
  }
  
  return issues;
}

/**
 * Extract issue mentions (e.g., "fix issue #123") from text
 * @param {string} text - The text to analyze
 * @returns {Array} - Array of issue data objects
 */
function extractIssueMentions(text) {
  const issues = [];
  let match;
  
  // Reset regex to start from beginning
  ISSUE_MENTION_REGEX.lastIndex = 0;
  
  while ((match = ISSUE_MENTION_REGEX.exec(text)) !== null) {
    const issueNumber = match[3];
    
    issues.push({
      issueNumber: parseInt(issueNumber, 10),
      isBatch: false
    });
  }
  
  return issues;
}

/**
 * Validate the trigger data
 * @param {Object} triggerData - The trigger data to validate
 * @returns {boolean} - True if valid
 */
export function validateTrigger(triggerData) {
  if (!triggerData) {
    return false;
  }
  
  // Batch requests need an issueList
  if (triggerData.isBatch && (!triggerData.issueList || triggerData.issueList.length === 0)) {
    logger.warn('Invalid batch trigger: missing issueList');
    return false;
  }
  
  // Single issue requests need either issueUrl or both owner/repo/issueNumber
  if (!triggerData.isBatch) {
    const hasUrl = !!triggerData.issueUrl;
    const hasFullIssueInfo = !!(triggerData.owner && triggerData.repo && triggerData.issueNumber);
    const hasIssueNumber = triggerData.issueNumber > 0;
    
    if (!hasUrl && !hasFullIssueInfo && !hasIssueNumber) {
      logger.warn('Invalid trigger: missing issue information');
      return false;
    }
  }
  
  logger.debug('Trigger data validated successfully');
  return true;
}

/**
 * Normalize trigger data to ensure consistent format
 * @param {Object} triggerData - The trigger data to normalize
 * @returns {Object} - Normalized trigger data
 */
export function normalizeTriggerData(triggerData) {
  if (!triggerData) {
    return null;
  }
  
  // Already normalized
  if (triggerData.normalized) {
    return triggerData;
  }
  
  try {
    if (triggerData.isBatch) {
      // Normalize each issue in the batch
      triggerData.issueList = triggerData.issueList.map(issue => normalizeTriggerData(issue));
    } else {
      // Extract owner/repo from URL if available
      if (triggerData.issueUrl && !triggerData.owner) {
        const match = GITHUB_ISSUE_REGEX.exec(triggerData.issueUrl);
        if (match) {
          triggerData.owner = match[1];
          triggerData.repo = match[2];
          triggerData.issueNumber = parseInt(match[3], 10);
        }
      }
      
      // Generate URL if not available
      if (!triggerData.issueUrl && triggerData.owner && triggerData.repo && triggerData.issueNumber) {
        triggerData.issueUrl = `https://github.com/${triggerData.owner}/${triggerData.repo}/issues/${triggerData.issueNumber}`;
      }
    }
    
    // Mark as normalized
    triggerData.normalized = true;
    
    return triggerData;
  } catch (error) {
    logger.error('Error normalizing trigger data:', error);
    return triggerData;
  }
}

// Export the module functions
export default {
  detectTrigger,
  validateTrigger,
  normalizeTriggerData
};
