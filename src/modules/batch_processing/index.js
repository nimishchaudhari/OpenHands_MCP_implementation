/**
 * Batch Processing Module
 * 
 * Resolves multiple issues concurrently
 */

const logger = require('../../utils/logger');
const configModule = require('../configuration');

/**
 * Process a batch of GitHub issues
 * 
 * @param {Array} issueList - List of issue objects with issueUrl, owner, repo, issueNumber
 * @param {Function} resolveFn - Function to resolve a single issue
 * @returns {Promise<Array>} - Results for each issue
 */
async function processBatch(issueList, resolveFn) {
  if (!Array.isArray(issueList) || issueList.length === 0) {
    throw new Error('Invalid or empty issue list for batch processing');
  }
  
  logger.info(`Starting batch processing for ${issueList.length} issues`);
  
  // Get batch configuration
  const batchConfig = configModule.getConfigSection('batch') || {};
  const maxConcurrent = batchConfig.maxConcurrent || 3;
  const maxIssuesPerBatch = batchConfig.maxIssuesPerBatch || 10;
  
  // Limit the number of issues to process
  const limitedIssueList = issueList.slice(0, maxIssuesPerBatch);
  if (limitedIssueList.length < issueList.length) {
    logger.warn(`Limiting batch to ${maxIssuesPerBatch} issues (${issueList.length} provided)`);
  }
  
  // Process issues with concurrency limit
  const results = await processWithConcurrencyLimit(limitedIssueList, resolveFn, maxConcurrent);
  
  // Log batch processing results
  const successCount = results.filter(result => result.success).length;
  logger.info(`Batch processing completed: ${successCount}/${results.length} issues resolved successfully`);
  
  return results;
}

/**
 * Process a list of items with a concurrency limit
 * 
 * @private
 * @param {Array} items - List of items to process
 * @param {Function} processFn - Function to process a single item
 * @param {number} concurrencyLimit - Maximum number of concurrent operations
 * @returns {Promise<Array>} - Results for each item
 */
async function processWithConcurrencyLimit(items, processFn, concurrencyLimit) {
  const results = new Array(items.length);
  let currentIndex = 0;
  
  // Function to process the next item
  async function processNext() {
    const index = currentIndex++;
    if (index >= items.length) return;
    
    try {
      // Process the item and store the result
      const item = items[index];
      logger.debug(`Processing batch item ${index + 1}/${items.length}: ${JSON.stringify(item)}`);
      
      results[index] = await processFn(item);
      
      // Log success status
      const success = results[index].success;
      logger.debug(`Item ${index + 1} processed: ${success ? 'success' : 'failure'}`);
    } catch (error) {
      // Store error result
      logger.error(`Error processing batch item ${index + 1}:`, error);
      results[index] = {
        success: false,
        error: error.message,
        issueUrl: items[index].issueUrl
      };
    }
    
    // Process next item
    return processNext();
  }
  
  // Start processing with concurrency limit
  const workers = [];
  for (let i = 0; i < Math.min(concurrencyLimit, items.length); i++) {
    workers.push(processNext());
  }
  
  // Wait for all workers to complete
  await Promise.all(workers);
  
  return results;
}

/**
 * Prioritize issues in a batch
 * 
 * @param {Array} issueList - List of issues to prioritize
 * @returns {Array} - Prioritized issue list
 */
function prioritizeIssues(issueList) {
  // Create a copy of the list to avoid modifying the original
  const issues = [...issueList];
  
  // Get priority labels from configuration
  const configPriorityLabels = (configModule.getConfigSection('task') || {}).priorityLabels || [
    'critical', 'high-priority', 'priority', 'blocker'
  ];
  
  // Sort issues by priority (high to low)
  issues.sort((a, b) => {
    // Function to calculate priority score (higher = more urgent)
    const getPriorityScore = (issue) => {
      let score = 0;
      
      // Check for priority labels
      if (issue.labels && Array.isArray(issue.labels)) {
        for (const label of issue.labels) {
          // Check against configured priority labels
          const labelIndex = configPriorityLabels.findIndex(
            pl => typeof label === 'string' ? label.includes(pl) : label.name?.includes(pl)
          );
          
          if (labelIndex >= 0) {
            // Give higher score to higher priority labels (based on order in the array)
            score += configPriorityLabels.length - labelIndex;
          }
        }
      }
      
      // Age-based priority boost (older issues get higher priority, but less than labels)
      if (issue.created_at) {
        const ageInDays = (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24);
        score += Math.min(ageInDays / 10, 0.5); // Cap at 0.5 extra points for age
      }
      
      return score;
    };
    
    // Compare priority scores
    return getPriorityScore(b) - getPriorityScore(a);
  });
  
  return issues;
}

/**
 * Create a batch report
 * 
 * @param {Array} results - Batch processing results
 * @returns {Object} - Batch processing report
 */
function createBatchReport(results) {
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;
  const successRate = (successCount / results.length) * 100;
  
  // Group results by success/failure
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  // Extract pull request information
  const pullRequests = successful.map(result => ({
    issueNumber: result.issueNumber,
    pullRequestNumber: result.pullRequestNumber,
    pullRequestUrl: result.pullRequestUrl
  }));
  
  // Extract error information
  const errors = failed.map(result => ({
    issueUrl: result.issueUrl,
    error: result.error
  }));
  
  return {
    summary: {
      totalIssues: results.length,
      successful: successCount,
      failed: failureCount,
      successRate: successRate.toFixed(2) + '%'
    },
    pullRequests,
    errors,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  processBatch,
  prioritizeIssues,
  createBatchReport
};