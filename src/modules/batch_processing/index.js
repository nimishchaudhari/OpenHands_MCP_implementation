/**
 * OpenHands Resolver MCP - Batch Processing Module
 * 
 * This module enables concurrent resolution of multiple GitHub issues:
 * - Processes batches of issues with prioritization
 * - Manages parallelism and throttling to respect API limits
 * - Tracks and reports on batch processing status
 */

import { getContextLogger } from '../../utils/logger.js';
import { getConfig } from '../configuration/index.js';

const logger = getContextLogger('BatchProcessing');

/**
 * Process a batch of GitHub issues
 * @param {Array} issueList - List of issue URLs or identifiers
a * @param {Function} resolveFunction - Function for resolving individual issues
 * @returns {Promise<Array>} - Results for each issue
 */
export async function processBatch(issueList, resolveFunction) {
  try {
    logger.info(`Processing batch of ${issueList.length} issues`);
    
    // Validate inputs
    if (!Array.isArray(issueList) || issueList.length === 0) {
      throw new Error('Invalid issue list: must be a non-empty array');
    }
    
    if (typeof resolveFunction !== 'function') {
      throw new Error('Invalid resolve function: must be a function');
    }
    
    // Prioritize issues
    const prioritizedIssues = prioritizeIssues(issueList);
    logger.debug(`Prioritized ${prioritizedIssues.length} issues for batch processing`);
    
    // Get batch processing configuration
    const maxConcurrent = getConfig('github').maxConcurrent || 3;
    logger.debug(`Using max concurrent limit of ${maxConcurrent}`);
    
    // Process issues with throttling
    const results = await processIssuesWithThrottling(
      prioritizedIssues,
      resolveFunction,
      maxConcurrent
    );
    
    // Generate batch summary
    const summary = generateBatchSummary(results);
    logger.info(`Batch processing completed: ${summary.succeeded} succeeded, ${summary.failed} failed`);
    
    return results;
  } catch (error) {
    logger.error('Error processing issue batch:', error);
    throw error;
  }
}

/**
 * Prioritize issues based on labels, age, or other factors
 * @param {Array} issueList - List of issue identifiers
 * @returns {Array} - Prioritized list of issues
 */
function prioritizeIssues(issueList) {
  try {
    // Create a copy of the issues for prioritization
    const issues = [...issueList];
    
    // Score issues for priority (higher score = higher priority)
    const scoredIssues = issues.map(issue => {
      let score = 0;
      
      // Priority based on labels
      if (issue.labels && Array.isArray(issue.labels)) {
        // Higher score for priority labels
        const priorityLabels = ['high-priority', 'priority', 'critical', 'urgent'];
        for (const label of issue.labels) {
          if (priorityLabels.includes(label)) {
            score += 10;
          }
        }
        
        // Higher score for bug labels
        if (issue.labels.includes('bug')) {
          score += 5;
        }
      }
      
      // Add some randomness for equal-priority items
      score += Math.random();
      
      return {
        ...issue,
        priorityScore: score
      };
    });
    
    // Sort by priority score (descending)
    scoredIssues.sort((a, b) => b.priorityScore - a.priorityScore);
    
    return scoredIssues;
  } catch (error) {
    logger.error('Error prioritizing issues:', error);
    return issueList;
  }
}

/**
 * Process issues with throttling to respect API limits
 * @param {Array} issues - Prioritized list of issues
 * @param {Function} resolveFunction - Function for resolving individual issues
 * @param {number} maxConcurrent - Maximum number of concurrent operations
 * @returns {Promise<Array>} - Results for each issue
 */
async function processIssuesWithThrottling(issues, resolveFunction, maxConcurrent) {
  try {
    logger.debug(`Processing ${issues.length} issues with max concurrency of ${maxConcurrent}`);
    
    const results = [];
    let activePromises = [];
    let index = 0;
    
    // Process issues in batches based on max concurrency
    while (index < issues.length) {
      // Fill up to max concurrent
      while (activePromises.length < maxConcurrent && index < issues.length) {
        const issue = issues[index];
        
        // Create a promise that includes the issue index for tracking
        const promise = (async () => {
          try {
            logger.debug(`Starting resolution for issue at index ${index}`);
            const result = await resolveFunction(issue);
            return {
              originalIndex: index,
              issue,
              result,
              success: true
            };
          } catch (error) {
            logger.error(`Error resolving issue at index ${index}:`, error);
            return {
              originalIndex: index,
              issue,
              error: error.message,
              success: false
            };
          }
        })();
        
        activePromises.push(promise);
        index++;
      }
      
      // Wait for any promise to complete
      if (activePromises.length > 0) {
        const completedPromise = await Promise.race(
          activePromises.map((promise, i) => 
            promise.then(result => ({ result, index: i }))
          )
        );
        
        // Store the result
        results.push(completedPromise.result);
        
        // Remove the completed promise
        activePromises.splice(completedPromise.index, 1);
        
        // Add a small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Wait for any remaining promises
    if (activePromises.length > 0) {
      logger.debug(`Waiting for ${activePromises.length} remaining promises`);
      const remainingResults = await Promise.all(activePromises);
      results.push(...remainingResults);
    }
    
    // Sort results back into original order
    results.sort((a, b) => a.originalIndex - b.originalIndex);
    
    return results;
  } catch (error) {
    logger.error('Error in batch processing with throttling:', error);
    throw error;
  }
}

/**
 * Generate a summary of batch processing results
 * @param {Array} results - Batch processing results
 * @returns {Object} - Summary statistics
 */
function generateBatchSummary(results) {
  try {
    // Count successes and failures
    const succeeded = results.filter(result => result.success).length;
    const failed = results.length - succeeded;
    
    // Group failures by error message
    const errorGroups = {};
    for (const result of results) {
      if (!result.success && result.error) {
        errorGroups[result.error] = (errorGroups[result.error] || 0) + 1;
      }
    }
    
    // Sort error groups by frequency (descending)
    const sortedErrorGroups = Object.entries(errorGroups)
      .sort((a, b) => b[1] - a[1])
      .map(([message, count]) => ({ message, count }));
    
    return {
      total: results.length,
      succeeded,
      failed,
      successRate: `${Math.round((succeeded / results.length) * 100)}%`,
      errorGroups: sortedErrorGroups
    };
  } catch (error) {
    logger.error('Error generating batch summary:', error);
    return {
      total: results.length,
      succeeded: 0,
      failed: results.length,
      successRate: '0%',
      errorGroups: [{ message: 'Error generating summary', count: 1 }]
    };
  }
}

/**
 * Create a visualization for batch processing results
 * @param {Array} results - Batch processing results
 * @returns {Object} - Visualization data
 */
export function createBatchVisualization(results) {
  try {
    logger.debug('Creating batch processing visualization');
    
    // Generate batch summary
    const summary = generateBatchSummary(results);
    
    // Create JSON visualization
    const jsonVisualization = {
      batch: {
        totalIssues: results.length,
        succeeded: summary.succeeded,
        failed: summary.failed,
        successRate: summary.successRate
      },
      results: results.map(result => ({
        issue: {
          issueUrl: result.issue.issueUrl,
          issueNumber: result.issue.issueNumber,
          owner: result.issue.owner,
          repo: result.issue.repo
        },
        success: result.success,
        error: result.error || null,
        pullRequest: result.success ? {
          url: result.result.pullRequestUrl,
          number: result.result.pullRequestNumber
        } : null
      })),
      errors: summary.errorGroups
    };
    
    // Create Markdown visualization
    const markdownVisualization = createBatchMarkdownVisualization(results, summary);
    
    return {
      json: jsonVisualization,
      markdown: markdownVisualization
    };
  } catch (error) {
    logger.error('Error creating batch visualization:', error);
    
    // Return minimal visualization on error
    return {
      json: {
        error: error.message,
        batch: { totalIssues: results.length }
      },
      markdown: `## ⚠️ Error creating batch visualization\n\n${error.message}`
    };
  }
}

/**
 * Create a Markdown visualization for batch results
 * @param {Array} results - Batch processing results
 * @param {Object} summary - Batch summary
 * @returns {string} - Markdown text
 */
function createBatchMarkdownVisualization(results, summary) {
  return `
# 🤖 OpenHands Resolver Batch Summary

## Overview
- **Total Issues**: ${summary.total}
- **Succeeded**: ${summary.succeeded} (${summary.successRate})
- **Failed**: ${summary.failed}

## Results

| Issue | Status | Pull Request |
|-------|--------|-------------|
${results.map(result => 
  `| ${result.issue.issueUrl ? `[#${result.issue.issueNumber}](${result.issue.issueUrl})` : `#${result.issue.issueNumber}`} | ${result.success ? '✅ Success' : '❌ Failed'} | ${result.success ? `[#${result.result.pullRequestNumber}](${result.result.pullRequestUrl})` : 'N/A'} |`
).join('\n')}

${summary.failed > 0 ? `
## Error Summary

${summary.errorGroups.map(group => 
  `- **${group.message}**: ${group.count} issue${group.count !== 1 ? 's' : ''}`
).join('\n')}
` : ''}

---
Generated at ${new Date().toISOString()}
`;
}

/**
 * Check if an issue is currently being processed in a batch
 * @param {string} issueUrl - Issue URL to check
 * @returns {boolean} - Whether the issue is being processed
 */
export function isIssueInProcess(issueUrl) {
  // In a full implementation, this would track in-process issues
  // This is a placeholder implementation
  return false;
}

// Export additional functions
export default {
  processBatch,
  createBatchVisualization,
  isIssueInProcess
};
