/**
 * OpenHands Resolver MCP - Main Entry Point
 * 
 * This is the main entry point for the OpenHands Resolver Model Context Protocol.
 * It integrates all modules and establishes the flow for GitHub issue resolution.
 */

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Import core modules
import * as configModule from './modules/configuration/index.js';
import * as triggerModule from './modules/trigger_detection/index.js';
import * as githubModule from './modules/github_api/index.js';
import * as taskSetupModule from './modules/task_setup/index.js';
import * as codeGenModule from './modules/code_generation/index.js';
import * as commitPrModule from './modules/commit_pr/index.js';
import * as feedbackModule from './modules/feedback/index.js';
import * as batchModule from './modules/batch_processing/index.js';
import { logger } from './utils/logger.js';

// Track initialization state
let isInitialized = false;

/**
 * Initialize the OpenHands Resolver
 * @param {string} configPath - Optional path to configuration file
 * @returns {Promise<boolean>} - Success status
 */
async function initialize(configPath) {
  try {
    if (isInitialized) {
      logger.debug('OpenHands Resolver already initialized');
      return true;
    }

    logger.info('Initializing OpenHands Resolver MCP');
    
    // Initialize configuration
    await configModule.initialize(configPath);
    logger.debug('Configuration module initialized');
    
    // Initialize GitHub API integration
    await githubModule.initialize();
    logger.debug('GitHub API module initialized');
    
    isInitialized = true;
    logger.info('OpenHands Resolver MCP initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize OpenHands Resolver MCP:', error);
    return false;
  }
}

/**
 * Main function to process a GitHub issue resolution request
 * @param {Object} triggerData - Data from the trigger detection module
 * @returns {Promise<Object>} - Result of the resolution process
 */
async function resolveIssue(triggerData) {
  try {
    logger.info(`Starting resolution process for issue: ${triggerData.issueUrl}`);
    
    // Fetch GitHub issue data
    const issueData = await githubModule.fetchIssueData(triggerData.issueUrl);
    logger.debug(`Fetched data for issue #${issueData.number}`);
    
    // Setup task for AI resolution
    const taskConfig = await taskSetupModule.setupTask(issueData);
    logger.debug('Task setup completed');
    
    // Generate code fix
    const codeChanges = await codeGenModule.generateAndValidateCode(taskConfig);
    logger.info(`Generated ${codeChanges.codeChanges.length} code changes`);
    
    // Create commit and PR
    const prResult = await commitPrModule.createPullRequest(codeChanges, issueData);
    logger.info(`Created pull request: ${prResult.pullRequestUrl}`);
    
    // Provide feedback
    const feedbackResult = await feedbackModule.provideFeedback(prResult, issueData);
    logger.debug('Feedback provided to issue');
    
    // Create visualization
    const visualization = feedbackModule.createVisualization(prResult, issueData, codeChanges);
    
    return {
      success: true,
      issueUrl: triggerData.issueUrl,
      issueNumber: issueData.number,
      pullRequestUrl: prResult.pullRequestUrl,
      pullRequestNumber: prResult.pullRequestNumber,
      branch: prResult.branch,
      changedFiles: codeChanges.codeChanges.length,
      visualization
    };
  } catch (error) {
    logger.error(`Failed to resolve issue ${triggerData.issueUrl}:`, error);
    return {
      success: false,
      issueUrl: triggerData.issueUrl,
      error: error.message
    };
  }
}

/**
 * Process a batch of GitHub issues
 * @param {Array} issueList - List of issue URLs or identifiers
 * @returns {Promise<Array>} - Results for each issue
 */
async function resolveBatch(issueList) {
  return batchModule.processBatch(issueList, resolveIssue);
}

/**
 * Main handler for MCP invocation
 * @param {Object} input - User input from Claude Desktop
 * @returns {Promise<Object>} - Result of the operation
 */
async function handleMcpInvocation(input) {
  try {
    // Initialize if not already initialized
    if (!isInitialized) {
      const initSuccess = await initialize();
      if (!initSuccess) {
        return {
          success: false,
          message: 'Failed to initialize OpenHands Resolver MCP'
        };
      }
    }
    
    // Detect trigger from user input
    const triggerData = triggerModule.detectTrigger(input);
    
    if (!triggerData) {
      return {
        success: false,
        message: 'No valid GitHub issue detected in the input'
      };
    }
    
    // Check if trigger is valid
    if (!triggerModule.validateTrigger(triggerData)) {
      return {
        success: false,
        message: 'Invalid trigger data, missing required information'
      };
    }
    
    // Check if this is a batch request
    if (triggerData.isBatch && triggerData.issueList && triggerData.issueList.length > 0) {
      logger.info(`Processing batch request with ${triggerData.issueList.length} issues`);
      return {
        success: true,
        isBatch: true,
        results: await resolveBatch(triggerData.issueList)
      };
    }
    
    // Process single issue
    logger.info('Processing single issue resolution request');
    return await resolveIssue(triggerData);
  } catch (error) {
    logger.error('Error handling MCP invocation:', error);
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Get information about the OpenHands Resolver MCP
 * @returns {Object} - MCP information
 */
function getMcpInfo() {
  return {
    name: 'OpenHands Resolver MCP',
    version: '0.1.0',
    description: 'AI-driven GitHub issue resolution system',
    initialized: isInitialized,
    capabilities: [
      'GitHub issue resolution',
      'Code generation and validation',
      'Pull request creation',
      'Batch processing'
    ]
  };
}

export {
  initialize,
  handleMcpInvocation,
  resolveIssue,
  resolveBatch,
  getMcpInfo
};
