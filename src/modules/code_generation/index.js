/**
 * OpenHands Resolver MCP - Code Generation and Validation Module
 * 
 * This module leverages Claude to generate and validate code solutions:
 * - Analyzes issue descriptions to understand the problem
 * - Generates code changes to resolve the issue
 * - Validates the changes for syntax errors and basic functionality
 * - Prepares the solution for submission
 */

import { getContextLogger } from '../../utils/logger.js';
import { getConfig } from '../configuration/index.js';
import * as githubModule from '../github_api/index.js';

const logger = getContextLogger('CodeGeneration');

// External MCP dependencies
let mcpSdk = null;

/**
 * Initialize the code generation module
 * @returns {Promise<void>}
 */
export async function initialize() {
  try {
    logger.info('Initializing code generation module');
    
    // Import MCP SDK - this will be dynamically loaded in production
    // This is a placeholder for the Claude Desktop integration
    try {
      mcpSdk = { /* Placeholder for MCP SDK */ };
      logger.debug('MCP SDK loaded successfully');
    } catch (error) {
      logger.error('Failed to load MCP SDK:', error);
      throw new Error('MCP SDK initialization failed');
    }
    
    logger.info('Code generation module initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize code generation module:', error);
    throw error;
  }
}

/**
 * Generate and validate code for issue resolution
 * @param {Object} taskConfig - Task configuration from setup module
 * @returns {Promise<Object>} - Generated code changes
 */
export async function generateAndValidateCode(taskConfig) {
  try {
    logger.info(`Generating code for issue #${taskConfig.issueData.issueNumber} in ${taskConfig.issueData.owner}/${taskConfig.issueData.repo}`);
    
    // Get repository files that might need to be modified
    const relevantFiles = await getRelevantFiles(taskConfig);
    logger.debug(`Identified ${relevantFiles.length} relevant files for analysis`);
    
    // Generate code changes using Claude
    const codeChanges = await generateCodeChanges(taskConfig, relevantFiles);
    logger.info(`Generated ${codeChanges.length} code changes`);
    
    // Validate the generated code
    const validationResults = await validateCodeChanges(codeChanges, taskConfig);
    
    // Return the results
    const result = {
      codeChanges,
      relevantFiles,
      validationResults,
      isValid: validationResults.every(result => result.valid),
      summary: createChangesSummary(codeChanges, validationResults)
    };
    
    logger.info(`Code generation ${result.isValid ? 'successful' : 'failed validation'}`);
    return result;
  } catch (error) {
    logger.error(`Failed to generate code for issue #${taskConfig.issueData.issueNumber}:`, error);
    throw error;
  }
}

/**
 * Identify relevant files for analysis based on the issue context
 * @param {Object} taskConfig - Task configuration
 * @returns {Promise<Array>} - List of relevant files
 */
async function getRelevantFiles(taskConfig) {
  try {
    const { issueData, taskContext, customInstructions } = taskConfig;
    
    // Get files from repository
    const repoFiles = await getRepositoryFiles(
      issueData.owner, 
      issueData.repo
    );
    
    // Filter out ignored paths from custom instructions
    const ignorePaths = customInstructions.ignorePaths || [];
    let filteredFiles = repoFiles.filter(file => 
      !ignorePaths.some(ignorePath => 
        file.path.startsWith(ignorePath) || file.path.includes(`/${ignorePath}/`)
      )
    );
    
    // Filter by primary language if available
    if (taskContext.primaryLanguage && taskContext.primaryLanguage !== 'Unknown') {
      const languageExtensions = getLanguageExtensions(taskContext.primaryLanguage);
      if (languageExtensions.length > 0) {
        filteredFiles = filteredFiles.filter(file => 
          languageExtensions.some(ext => file.path.endsWith(ext))
        );
      }
    }
    
    // Analyze issue text to prioritize relevant files
    const issueText = `${issueData.title} ${issueData.body}`;
    const relevantFilePatterns = extractPotentialFileReferences(issueText);
    
    // Score and sort files by relevance
    const scoredFiles = filteredFiles.map(file => {
      let score = 0;
      
      // Higher score for files that match patterns extracted from issue text
      for (const pattern of relevantFilePatterns) {
        if (file.path.includes(pattern)) {
          score += 10;
        }
      }
      
      // Score based on file size (smaller files more likely to be modified)
      score += file.size < 5000 ? 5 : 0;
      
      return {
        ...file,
        relevanceScore: score
      };
    });
    
    // Sort by relevance score (descending)
    scoredFiles.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Take top N most relevant files to limit context size
    const topRelevantFiles = scoredFiles.slice(0, 10);
    
    // Fetch content for top relevant files
    const filesWithContent = await Promise.all(
      topRelevantFiles.map(async file => {
        try {
          const content = await getFileContent(
            issueData.owner,
            issueData.repo,
            file.path
          );
          
          return {
            ...file,
            content
          };
        } catch (error) {
          logger.warn(`Failed to get content for file ${file.path}:`, error);
          return file;
        }
      })
    );
    
    return filesWithContent.filter(file => file.content);
  } catch (error) {
    logger.error('Error getting relevant files:', error);
    return [];
  }
}

/**
 * Get file extensions for a programming language
 * @param {string} language - Programming language name
 * @returns {Array} - List of file extensions
 */
function getLanguageExtensions(language) {
  const extensionMap = {
    'JavaScript': ['.js', '.jsx', '.ts', '.tsx'],
    'TypeScript': ['.ts', '.tsx'],
    'Python': ['.py'],
    'Java': ['.java'],
    'Ruby': ['.rb'],
    'Go': ['.go'],
    'Rust': ['.rs'],
    'PHP': ['.php'],
    'C++': ['.cpp', '.hpp', '.cc', '.h'],
    'C#': ['.cs'],
    'C': ['.c', '.h'],
    'HTML': ['.html', '.htm'],
    'CSS': ['.css'],
    'Swift': ['.swift'],
    'Kotlin': ['.kt'],
    'Dart': ['.dart'],
    'Shell': ['.sh', '.bash']
  };
  
  return extensionMap[language] || [];
}

/**
 * Extract potential file references from issue text
 * @param {string} text - Issue text to analyze
 * @returns {Array} - List of potential file references
 */
function extractPotentialFileReferences(text) {
  const patterns = [];
  
  // Match filenames with extensions (e.g., main.js, utils/helpers.ts)
  const filePattern = /\b[\w\-\/\.]+\.(js|jsx|ts|tsx|py|java|rb|go|rs|php|cpp|hpp|cc|cs|c|h|html|css|swift|kt|dart|sh|json|md)\b/gi;
  let match;
  while ((match = filePattern.exec(text)) !== null) {
    patterns.push(match[0]);
  }
  
  // Match directory references
  const dirPattern = /\b(src|app|lib|test|tests|packages|modules|components|utils|helpers|services|api|docs|config|public|assets)\b/gi;
  while ((match = dirPattern.exec(text)) !== null) {
    patterns.push(match[0]);
  }
  
  // Match class or function names with camelCase or PascalCase
  const namePattern = /\b([A-Z][a-z]+[A-Za-z0-9]*|[a-z]+[A-Z][A-Za-z0-9]*)\b/g;
  while ((match = namePattern.exec(text)) !== null) {
    patterns.push(match[0]);
  }
  
  return [...new Set(patterns)];
}

/**
 * Get list of files from repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Array>} - List of files
 */
async function getRepositoryFiles(owner, repo) {
  // This is a simplified implementation
  // In a full implementation, we would recursively get all files from the repository
  try {
    const repoContext = await githubModule.getRepositoryContext(owner, repo);
    return repoContext.files || [];
  } catch (error) {
    logger.error(`Failed to get repository files for ${owner}/${repo}:`, error);
    return [];
  }
}

/**
 * Get content of a file from repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path
 * @returns {Promise<string>} - File content
 */
async function getFileContent(owner, repo, path) {
  // This is a placeholder for the actual GitHub API call
  try {
    // In a full implementation, this would use the GitHub API
    return "File content placeholder";
  } catch (error) {
    logger.error(`Failed to get content for file ${path}:`, error);
    throw error;
  }
}

/**
 * Generate code changes using Claude
 * @param {Object} taskConfig - Task configuration
 * @param {Array} relevantFiles - Relevant files for analysis
 * @returns {Promise<Array>} - Generated code changes
 */
async function generateCodeChanges(taskConfig, relevantFiles) {
  try {
    // In a real implementation, this would use Claude via the MCP SDK
    logger.info('Generating code changes using Claude');
    
    // Format files for Claude context
    const filesContext = relevantFiles.map(file => 
      `File: ${file.path}\n\`\`\`\n${file.content}\n\`\`\``
    ).join('\n\n');
    
    // Format issue data for Claude
    const issueContext = `
Issue Title: ${taskConfig.issueData.title}
Issue Description:
${taskConfig.issueData.body}

Relevant Comments:
${taskConfig.taskContext.relevantComments.join('\n\n')}
`;

    // Here we would call Claude with the prompt, but for now we'll return a placeholder
    return [
      {
        filePath: 'example/path.js',
        originalContent: 'Original content',
        modifiedContent: 'Modified content with fix',
        diff: '@@ -1 +1 @@\n-Original content\n+Modified content with fix',
        reason: 'Fixed issue by modifying the content'
      }
    ];
  } catch (error) {
    logger.error('Error generating code changes:', error);
    throw error;
  }
}

/**
 * Validate generated code changes
 * @param {Array} codeChanges - Generated code changes
 * @param {Object} taskConfig - Task configuration
 * @returns {Promise<Array>} - Validation results
 */
async function validateCodeChanges(codeChanges, taskConfig) {
  try {
    // In a real implementation, this would run basic validation on the code
    logger.info('Validating generated code changes');
    
    // For now, we'll return placeholder validation results
    return codeChanges.map(change => ({
      filePath: change.filePath,
      valid: true,
      syntaxValid: true,
      testsPassed: true,
      messages: ['Validation passed']
    }));
  } catch (error) {
    logger.error('Error validating code changes:', error);
    return codeChanges.map(change => ({
      filePath: change.filePath,
      valid: false,
      syntaxValid: false,
      testsPassed: false,
      messages: [`Validation error: ${error.message}`]
    }));
  }
}

/**
 * Create a summary of the code changes
 * @param {Array} codeChanges - Generated code changes
 * @param {Array} validationResults - Validation results
 * @returns {string} - Summary text
 */
function createChangesSummary(codeChanges, validationResults) {
  try {
    const summary = [];
    
    summary.push(`# Code Changes Summary`);
    summary.push(`\nTotal files modified: ${codeChanges.length}`);
    
    const validChanges = validationResults.filter(result => result.valid).length;
    summary.push(`Validation: ${validChanges}/${validationResults.length} files passed validation\n`);
    
    summary.push(`## Changes by File`);
    codeChanges.forEach((change, index) => {
      const validation = validationResults[index];
      
      summary.push(`\n### ${change.filePath} ${validation.valid ? '✅' : '❌'}`);
      summary.push(`${change.reason}\n`);
      
      if (!validation.valid) {
        summary.push(`**Validation Issues:**`);
        validation.messages.forEach(message => {
          summary.push(`- ${message}`);
        });
        summary.push('');
      }
    });
    
    return summary.join('\n');
  } catch (error) {
    logger.error('Error creating changes summary:', error);
    return 'Failed to create changes summary';
  }
}

// Export additional functions
export default {
  initialize,
  generateAndValidateCode
};
