/**
 * OpenHands Resolver MCP - Task Setup Module
 * 
 * This module prepares tasks for OpenHands AI agents by:
 * - Combining GitHub issue data and repository context
 * - Incorporating custom instructions if available
 * - Formatting the task for optimal AI processing
 */

import { getContextLogger } from '../../utils/logger.js';
import { getConfig } from '../configuration/index.js';
import * as githubModule from '../github_api/index.js';

const logger = getContextLogger('TaskSetup');

/**
 * Setup a task for AI resolution
 * @param {Object} issueData - GitHub issue data
 * @returns {Promise<Object>} - Task configuration
 */
export async function setupTask(issueData) {
  try {
    logger.info(`Setting up task for issue #${issueData.issueNumber} in ${issueData.owner}/${issueData.repo}`);
    
    // Get AI configurations
    const aiConfig = getConfig('ai');
    
    // Get repository context for additional information
    const repoContext = await githubModule.getRepositoryContext(
      issueData.owner, 
      issueData.repo
    );
    
    // Extract custom instructions if available
    const customInstructions = repoContext.instructions || {};
    
    // Prepare the task context
    const taskContext = prepareTaskContext(issueData, repoContext, customInstructions);
    
    // Create the AI task configuration
    const taskConfig = {
      issueData,
      repoContext,
      customInstructions,
      taskContext,
      aiConfig: {
        model: aiConfig.model,
        temperature: aiConfig.temperature,
        maxTokens: aiConfig.maxTokens,
        systemMessage: createSystemMessage(issueData, repoContext, customInstructions)
      }
    };
    
    logger.debug('Task setup completed successfully');
    return taskConfig;
  } catch (error) {
    logger.error(`Failed to setup task for issue #${issueData.issueNumber}:`, error);
    throw error;
  }
}

/**
 * Prepare the task context by combining issue and repository data
 * @param {Object} issueData - GitHub issue data
 * @param {Object} repoContext - Repository context data
 * @param {Object} customInstructions - Custom instructions from repository
 * @returns {Object} - Prepared task context
 */
function prepareTaskContext(issueData, repoContext, customInstructions) {
  try {
    // Extract relevant information from issue
    const { title, body, comments, labels } = issueData;
    
    // Determine primary programming language
    const primaryLanguage = repoContext.languages[0] || 'Unknown';
    
    // Check for additional context in comments
    const relevantComments = comments.filter(comment => {
      // Filter comments that might contain important context
      return comment.body.includes('reproducing') ||
             comment.body.includes('steps to reproduce') ||
             comment.body.includes('error message') ||
             comment.body.includes('expected behavior') ||
             comment.body.includes('additional context');
    });
    
    // Check for priority indicators
    const priorityLabels = customInstructions.priorityLabels || ['high-priority', 'priority', 'critical', 'urgent'];
    const isPriority = labels.some(label => priorityLabels.includes(label));
    
    // Determine complexity
    const complexityIndicators = {
      low: ['simple', 'easy', 'trivial', 'typo', 'minor'],
      medium: ['moderate', 'enhancement', 'improvement'],
      high: ['complex', 'difficult', 'major', 'refactor']
    };
    
    let complexity = 'medium';
    for (const [level, indicators] of Object.entries(complexityIndicators)) {
      if (title.toLowerCase().split(' ').some(word => indicators.includes(word)) ||
          body.toLowerCase().split(' ').some(word => indicators.includes(word)) ||
          labels.some(label => indicators.includes(label.toLowerCase()))) {
        complexity = level;
        break;
      }
    }
    
    // Create the task context
    return {
      issueTitle: title,
      issueBody: body,
      relevantComments: relevantComments.map(comment => comment.body),
      primaryLanguage,
      languages: repoContext.languages,
      isPriority,
      complexity,
      hasCustomInstructions: Object.keys(customInstructions).length > 0,
      codeStyle: customInstructions.codeStyle || 'standard',
      testRequirements: customInstructions.testRequirements || null,
      ignorePaths: customInstructions.ignorePaths || []
    };
  } catch (error) {
    logger.error('Error preparing task context:', error);
    throw error;
  }
}

/**
 * Create a system message for the AI based on the task
 * @param {Object} issueData - GitHub issue data
 * @param {Object} repoContext - Repository context data
 * @param {Object} customInstructions - Custom instructions from repository
 * @returns {string} - Formatted system message
 */
function createSystemMessage(issueData, repoContext, customInstructions) {
  try {
    // Get base system message from config
    const baseMessage = getConfig('ai').systemMessage;
    
    // Add custom instructions if available
    let customInstructionsText = '';
    if (Object.keys(customInstructions).length > 0) {
      customInstructionsText = `
Repository-specific instructions:
- Code Style: ${customInstructions.codeStyle || 'standard'}
${customInstructions.testRequirements ? `- Test Requirements: ${customInstructions.testRequirements}` : ''}
${customInstructions.ignorePaths && customInstructions.ignorePaths.length > 0 ? 
  `- Ignore Paths: ${customInstructions.ignorePaths.join(', ')}` : ''}
`;
    }
    
    // Add repository context
    const repoContextText = `
You are working on the repository ${repoContext.owner}/${repoContext.repo}
Primary language: ${repoContext.languages[0] || 'Unknown'}
${repoContext.description ? `Repository description: ${repoContext.description}` : ''}
`;
    
    // Combine everything
    return `${baseMessage}

${repoContextText}
${customInstructionsText}

Your task is to analyze and resolve GitHub issue #${issueData.issueNumber}: "${issueData.title}"

Follow these steps:
1. Analyze the issue description and context
2. Identify the root cause of the problem
3. Generate appropriate code changes to resolve the issue
4. Validate your solution against the repository's requirements
5. Prepare a clear explanation of your changes

Ensure your solution is:
- Focused on the specific issue
- Compatible with the repository's coding style
- Well-documented with appropriate comments
- Accompanied by tests if required
- Ready to be submitted as a pull request
`;
  } catch (error) {
    logger.error('Error creating system message:', error);
    return getConfig('ai').systemMessage;
  }
}

/**
 * Validate the prepared task
 * @param {Object} taskConfig - Task configuration to validate
 * @returns {boolean} - Whether the task is valid
 */
export function validateTask(taskConfig) {
  try {
    // Check for required fields
    if (!taskConfig.issueData || !taskConfig.taskContext) {
      logger.warn('Invalid task configuration: missing required fields');
      return false;
    }
    
    // Validate specific fields
    const requiredFields = {
      'issueData.issueNumber': taskConfig.issueData.issueNumber,
      'issueData.owner': taskConfig.issueData.owner,
      'issueData.repo': taskConfig.issueData.repo,
      'issueData.title': taskConfig.issueData.title,
      'taskContext.issueTitle': taskConfig.taskContext.issueTitle,
      'taskContext.primaryLanguage': taskConfig.taskContext.primaryLanguage,
      'aiConfig.model': taskConfig.aiConfig.model
    };
    
    for (const [field, value] of Object.entries(requiredFields)) {
      if (!value) {
        logger.warn(`Invalid task configuration: missing ${field}`);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    logger.error('Error validating task:', error);
    return false;
  }
}

// Export additional functions
export default {
  setupTask,
  validateTask
};
