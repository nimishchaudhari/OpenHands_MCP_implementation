/**
 * Batch Processing Module
 * Enables simultaneous resolution of multiple issues
 */

const logger = require('../../utils/logger');
const configModule = require('../configuration');

/**
 * Process a batch of issues
 * @param {Array<Object>} issueList - List of issues to process
 * @param {Function} resolveFunction - Function to resolve a single issue
 * @returns {Promise<Array<Object>>} - Results for each issue
 */
async function processBatch(issueList, resolveFunction) {
  try {
    logger.info(`Processing batch of ${issueList.length} issues`);
    
    const results = [];
    const resolverConfig = configModule.getSection('resolver');
    
    // Determine if we should process in parallel or sequentially
    const isParallel = resolverConfig.batchParallelProcessing === true;
    const maxConcurrent = resolverConfig.maxConcurrentBatchItems || 3;
    
    if (isParallel) {
      logger.info(`Processing batch in parallel (max ${maxConcurrent} concurrent)`);
      results.push(...await processParallel(issueList, resolveFunction, maxConcurrent));
    } else {
      logger.info('Processing batch sequentially');
      results.push(...await processSequential(issueList, resolveFunction));
    }
    
    logger.info(`Batch processing completed: ${results.filter(r => r.success).length} succeeded, ${results.filter(r => !r.success).length} failed`);
    
    return results;
  } catch (error) {
    logger.error('Batch processing failed:', error);
    throw new Error(`Batch processing failed: ${error.message}`);
  }
}

/**
 * Process issues sequentially
 * @private
 * @param {Array<Object>} issueList - List of issues to process
 * @param {Function} resolveFunction - Function to resolve a single issue
 * @returns {Promise<Array<Object>>} - Results for each issue
 */
async function processSequential(issueList, resolveFunction) {
  const results = [];
  
  for (const issue of issueList) {
    try {
      logger.info(`Processing issue: ${issue.issueUrl}`);
      const result = await resolveFunction(issue);
      results.push({
        issueUrl: issue.issueUrl,
        issueNumber: issue.issueNumber,
        owner: issue.owner,
        repo: issue.repo,
        success: true,
        result
      });
    } catch (error) {
      logger.error(`Failed to process issue ${issue.issueUrl}:`, error);
      results.push({
        issueUrl: issue.issueUrl,
        issueNumber: issue.issueNumber,
        owner: issue.owner,
        repo: issue.repo,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * Process issues in parallel
 * @private
 * @param {Array<Object>} issueList - List of issues to process
 * @param {Function} resolveFunction - Function to resolve a single issue
 * @param {number} maxConcurrent - Maximum number of concurrent processes
 * @returns {Promise<Array<Object>>} - Results for each issue
 */
async function processParallel(issueList, resolveFunction, maxConcurrent) {
  const results = [];
  const chunks = chunkArray(issueList, maxConcurrent);
  
  for (const chunk of chunks) {
    const chunkPromises = chunk.map(async issue => {
      try {
        logger.info(`Processing issue: ${issue.issueUrl}`);
        const result = await resolveFunction(issue);
        return {
          issueUrl: issue.issueUrl,
          issueNumber: issue.issueNumber,
          owner: issue.owner,
          repo: issue.repo,
          success: true,
          result
        };
      } catch (error) {
        logger.error(`Failed to process issue ${issue.issueUrl}:`, error);
        return {
          issueUrl: issue.issueUrl,
          issueNumber: issue.issueNumber,
          owner: issue.owner,
          repo: issue.repo,
          success: false,
          error: error.message
        };
      }
    });
    
    // Process this chunk in parallel
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }
  
  return results;
}

/**
 * Split an array into chunks
 * @private
 * @param {Array} array - Array to split
 * @param {number} chunkSize - Size of each chunk
 * @returns {Array<Array>} - Array of chunks
 */
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Get statistics for a batch process
 * @param {Array<Object>} results - Results from processBatch
 * @returns {Object} - Statistics about the batch process
 */
function getBatchStatistics(results) {
  const totalIssues = results.length;
  const successCount = results.filter(r => r.success).length;
  const failureCount = totalIssues - successCount;
  const successRate = totalIssues > 0 ? (successCount / totalIssues) * 100 : 0;
  
  // Group by repository
  const repositories = {};
  for (const result of results) {
    const repoKey = `${result.owner}/${result.repo}`;
    
    if (!repositories[repoKey]) {
      repositories[repoKey] = {
        total: 0,
        success: 0,
        failure: 0
      };
    }
    
    repositories[repoKey].total += 1;
    if (result.success) {
      repositories[repoKey].success += 1;
    } else {
      repositories[repoKey].failure += 1;
    }
  }
  
  // Extract common error patterns
  const errorCounts = {};
  for (const result of results) {
    if (!result.success && result.error) {
      // Simplify error messages to group similar errors
      const simplifiedError = simplifyErrorMessage(result.error);
      
      if (!errorCounts[simplifiedError]) {
        errorCounts[simplifiedError] = 0;
      }
      
      errorCounts[simplifiedError] += 1;
    }
  }
  
  // Sort errors by frequency
  const commonErrors = Object.entries(errorCounts)
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5 errors
  
  return {
    totalIssues,
    successCount,
    failureCount,
    successRate: Math.round(successRate * 100) / 100, // Round to 2 decimal places
    repositories,
    commonErrors
  };
}

/**
 * Simplify an error message for categorization
 * @private
 * @param {string} errorMessage - Original error message
 * @returns {string} - Simplified error message
 */
function simplifyErrorMessage(errorMessage) {
  if (!errorMessage) return 'Unknown error';
  
  // Remove specific values like file paths, issue numbers, etc.
  let simplified = errorMessage
    .replace(/\/[^\/\s]+\//g, '/path/') // Simplify paths
    .replace(/#\d+/g, '#XX') // Replace issue numbers
    .replace(/\d+/g, 'XX') // Replace other numbers
    .replace(/".+?"/g, '"XXX"') // Replace quoted strings
    .replace(/'.+?'/g, "'XXX'"); // Replace single-quoted strings
  
  // Truncate to keep only the beginning of the message (the most relevant part)
  if (simplified.length > 100) {
    simplified = simplified.substring(0, 100) + '...';
  }
  
  return simplified;
}

module.exports = {
  processBatch,
  getBatchStatistics
};