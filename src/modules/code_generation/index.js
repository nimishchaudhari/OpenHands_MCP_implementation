/**
 * Code Generation and Validation Module
 * 
 * Generates and validates code fixes using Claude
 */

const logger = require('../../utils/logger');
const configModule = require('../configuration');
const { ModelContextProtocol } = require('@modelcontextprotocol/sdk');

/**
 * Generate and validate code changes
 * 
 * @param {Object} taskConfig - Task configuration
 * @returns {Promise<Object>} - Generated code changes
 */
async function generateAndValidateCode(taskConfig) {
  try {
    logger.info(`Generating code for issue #${taskConfig.issueNumber}`);

    // Generate prompt for Claude
    const prompt = generatePrompt(taskConfig);

    // Generate code using Claude Desktop
    const generatedCode = await generateCodeWithClaudeDesktop(prompt, taskConfig);

    // Extract code changes
    const codeChanges = extractCodeChanges(generatedCode);

    if (codeChanges.length === 0) {
      throw new Error('No valid code changes were generated');
    }

    logger.info(`Generated ${codeChanges.length} code changes`);

    // Validate the generated code
    const validationResult = await validateCode(codeChanges, taskConfig);

    // If validation failed, refine the code
    if (!validationResult.valid) {
      logger.warn('Code validation failed, attempting refinement');
      return await refineCode(codeChanges, validationResult, taskConfig);
    }

    return {
      codeChanges,
      explanation: extractExplanation(generatedCode),
      validationResult
    };
  } catch (error) {
    logger.error('Failed to generate and validate code:', error);
    throw new Error(`Code generation failed: ${error.message}`);
  }
}

/**
 * Generate a prompt for Claude Desktop
 * 
 * @private
 * @param {Object} taskConfig - Task configuration
 * @returns {string} - Prompt for Claude
 */
function generatePrompt(taskConfig) {
  const { issueInfo, codeContext, customInstructions } = taskConfig;
  const claudeConfig = configModule.getClaudeConfig();

  let prompt = `
You are OpenHands, an AI agent that resolves GitHub issues by generating code changes.

Issue Details:
Repository: ${issueInfo.repository}
Issue Title: ${issueInfo.title}
Issue Type: ${issueInfo.type}
Issue Severity: ${issueInfo.severity}

Issue Description:
${taskConfig.description || 'No description provided'}

`;

  if (issueInfo.requirements && issueInfo.requirements.length > 0) {
    prompt += `
Requirements:
${issueInfo.requirements.map(req => `- ${req}`).join('\n')}

`;
  }

  if (issueInfo.errorMessages && issueInfo.errorMessages.length > 0) {
    prompt += `
Error Messages:
${issueInfo.errorMessages.map(err => `- ${err}`).join('\n')}

`;
  }

  if (customInstructions) {
    prompt += `
Custom Instructions:
${customInstructions}

`;
  }

  // Include relevant code snippets
  if (codeContext && codeContext.hasCode) {
    prompt += `
Relevant code snippets:

`;

    if (codeContext.fileSnippets && codeContext.fileSnippets.length > 0) {
      codeContext.fileSnippets.forEach(file => {
        prompt += `
File: ${file.path}
\`\`\`${file.language || ''}
${file.code}
\`\`\`

`;
      });
    }

    if (codeContext.issueSnippets && codeContext.issueSnippets.length > 0) {
      prompt += `
Code from the issue description:
`;
      codeContext.issueSnippets.forEach(snippet => {
        prompt += `
\`\`\`${snippet.language || ''}
${snippet.code}
\`\`\`

`;
      });
    }
  }

  // Add repository structure information if available
  if (taskConfig.repositoryStructure) {
    prompt += `
Repository Structure:
- Top level directories: ${taskConfig.repositoryStructure.top_level_dirs?.join(', ') || 'unknown'}
- Main language: ${taskConfig.repositoryStructure.packageJson?.main || 'unknown'}

`;
  }

  prompt += `
Based on this issue, please:
1. Analyze the problem carefully
2. Generate code changes to resolve the issue
3. Include explanations for your changes
4. Format each file change as:

\`\`\`filename: path/to/file.ext
// code with changes
\`\`\`

Be specific about exactly which files need to be modified and what changes need to be made.
Focus on minimal, targeted changes that address the issue while maintaining the project's coding style.
Explain your thought process and why your solution addresses the issue.
`;

  // Trim to max prompt length if needed
  const maxLength = claudeConfig.maxPromptLength || 8000;
  if (prompt.length > maxLength) {
    logger.warn(`Prompt exceeds maximum length (${prompt.length} > ${maxLength}), trimming`);
    prompt = prompt.substring(0, maxLength);
  }

  return prompt;
}

/**
 * Generate code using Claude Desktop
 * 
 * @private
 * @param {string} prompt - Prompt for Claude
 * @param {Object} taskConfig - Task configuration
 * @returns {Promise<string>} - Generated code and explanation
 */
async function generateCodeWithClaudeDesktop(prompt, taskConfig) {
  logger.info('Sending prompt to Claude Desktop');

  try {
    // Get Claude configuration
    const claudeConfig = configModule.getClaudeConfig();
    
    // Initialize the MCP client
    const mcp = new ModelContextProtocol();
    
    // Prepare the request
    const requestPayload = {
      model: claudeConfig.model,
      prompt: prompt,
      temperature: claudeConfig.temperature,
      maxTokens: claudeConfig.maxTokens,
      systemMessage: claudeConfig.systemMessage
    };
    
    logger.debug('Claude request payload:', JSON.stringify({
      model: requestPayload.model,
      temperature: requestPayload.temperature,
      maxTokens: requestPayload.maxTokens,
      promptLength: prompt.length
    }));
    
    // Send the request to Claude Desktop
    const response = await mcp.generate(requestPayload);
    
    if (!response || !response.text) {
      throw new Error('Empty response received from Claude Desktop');
    }
    
    logger.info('Received response from Claude Desktop');
    return response.text;
  } catch (error) {
    logger.error('Error generating code with Claude Desktop:', error);
    throw new Error(`Claude Desktop error: ${error.message}`);
  }
}

/**
 * Extract code changes from Claude's response
 * 
 * @private
 * @param {string} response - Claude's response
 * @returns {Array<Object>} - List of code changes
 */
function extractCodeChanges(response) {
  const changes = [];

  // Pattern to extract code blocks with filenames
  const codeBlockPattern = /```filename:\s*([^\n]+)\n([\s\S]+?)```/g;

  let match;
  while ((match = codeBlockPattern.exec(response)) !== null) {
    const filePath = match[1].trim();
    const code = match[2].trim();

    changes.push({
      path: filePath,
      content: code
    });
  }

  // Also try to extract code blocks with a different format
  const alternatePattern = /```(?:([a-zA-Z0-9_]+))?\s*\n([\s\S]+?)```\s*(?:File path:|Path:)\s*([^\n]+)/g;
  while ((match = alternatePattern.exec(response)) !== null) {
    const language = match[1] || '';
    const code = match[2].trim();
    const filePath = match[3].trim();

    // Only add if we didn't already capture this file
    if (!changes.some(change => change.path === filePath)) {
      changes.push({
        path: filePath,
        content: code,
        language
      });
    }
  }

  return changes;
}

/**
 * Extract explanation from Claude's response
 * 
 * @private
 * @param {string} response - Claude's response
 * @returns {string} - Extracted explanation
 */
function extractExplanation(response) {
  // Remove code blocks
  const withoutCodeBlocks = response.replace(/```[\s\S]+?```/g, '');

  // Look for explanation sections
  const explanationPattern = /(?:explanation|thought process|reasoning|analysis):\s*([\s\S]+?)(?=\n\n|$)/i;
  const explanationMatch = withoutCodeBlocks.match(explanationPattern);

  if (explanationMatch) {
    return explanationMatch[1].trim();
  }

  // If no specific explanation section, return the text without code blocks
  return withoutCodeBlocks.trim();
}

/**
 * Validate generated code changes
 * 
 * @private
 * @param {Array<Object>} codeChanges - List of code changes
 * @param {Object} taskConfig - Task configuration
 * @returns {Promise<Object>} - Validation result
 */
async function validateCode(codeChanges, taskConfig) {
  logger.info('Validating generated code changes');

  const validationIssues = [];

  // Check each file change
  for (const change of codeChanges) {
    // Check if the file path is specified
    if (!change.path) {
      validationIssues.push({
        severity: 'error',
        message: 'File path not specified',
        change
      });
      continue;
    }

    // Check if the content is empty
    if (!change.content || change.content.trim() === '') {
      validationIssues.push({
        severity: 'error',
        message: 'File content is empty',
        change
      });
      continue;
    }

    // Check for syntax errors
    const hasSyntaxError = await validateSyntax(change.path, change.content);
    if (hasSyntaxError) {
      validationIssues.push({
        severity: 'error',
        message: `Syntax error in file: ${hasSyntaxError}`,
        change
      });
    }
    
    // Check file type is allowed
    if (!configModule.isFileTypeAllowed(change.path)) {
      validationIssues.push({
        severity: 'error',
        message: `File type not allowed for modification: ${change.path}`,
        change
      });
    }
  }

  return {
    valid: validationIssues.length === 0,
    issues: validationIssues
  };
}

/**
 * Validate syntax for code
 * 
 * @private
 * @param {string} filePath - Path to the file
 * @param {string} content - File content
 * @returns {Promise<string|null>} - Error message or null if valid
 */
async function validateSyntax(filePath, content) {
  // Get file extension
  const extension = filePath.split('.').pop().toLowerCase();
  
  try {
    // For JavaScript/TypeScript files, we can use actual syntax validation
    if (['js', 'jsx', 'ts', 'tsx'].includes(extension)) {
      // Check for mismatched braces/parentheses/brackets
      const pairs = {
        '{': '}',
        '(': ')',
        '[': ']'
      };

      const stack = [];

      for (const char of content) {
        if ('{(['.includes(char)) {
          stack.push(char);
        } else if ('})]'.includes(char)) {
          const last = stack.pop();
          if (!last || pairs[last] !== char) {
            return `Mismatched ${char} in ${extension.toUpperCase()} file`;
          }
        }
      }

      if (stack.length > 0) {
        return `Unclosed ${stack[stack.length - 1]} in ${extension.toUpperCase()} file`;
      }
      
      // Optional: For more thorough validation, could use tools like ESLint or TypeScript compiler
    }
    
    // For now, return success for other file types
    return null;
  } catch (error) {
    logger.error(`Error validating syntax for ${filePath}:`, error);
    return `Validation error: ${error.message}`;
  }
}

/**
 * Refine code based on validation issues
 * 
 * @private
 * @param {Array<Object>} codeChanges - List of code changes
 * @param {Object} validationResult - Validation result
 * @param {Object} taskConfig - Task configuration
 * @returns {Promise<Object>} - Refined code changes
 */
async function refineCode(codeChanges, validationResult, taskConfig) {
  logger.info('Refining code based on validation issues');

  // Generate a refinement prompt
  const refinementPrompt = generateRefinementPrompt(codeChanges, validationResult, taskConfig);

  // Generate refined code
  const refinedResponse = await generateCodeWithClaudeDesktop(refinementPrompt, taskConfig);

  // Extract refined code changes
  const refinedChanges = extractCodeChanges(refinedResponse);

  // Validate the refined code
  const refinedValidationResult = await validateCode(refinedChanges, taskConfig);

  // If still invalid and we haven't reached the maximum refinement attempts, try again
  const refinementAttempts = (taskConfig.refinementAttempts || 0) + 1;
  if (!refinedValidationResult.valid && refinementAttempts < 3) {
    logger.warn('Refined code still has validation issues, attempting another refinement');

    // Update task config with incremented refinement attempts
    const updatedTaskConfig = {
      ...taskConfig,
      refinementAttempts
    };

    return await refineCode(refinedChanges, refinedValidationResult, updatedTaskConfig);
  }

  return {
    codeChanges: refinedChanges,
    explanation: extractExplanation(refinedResponse),
    validationResult: refinedValidationResult,
    refinementAttempts
  };
}

/**
 * Generate a refinement prompt
 * 
 * @private
 * @param {Array<Object>} codeChanges - List of code changes
 * @param {Object} validationResult - Validation result
 * @param {Object} taskConfig - Task configuration
 * @returns {string} - Refinement prompt
 */
function generateRefinementPrompt(codeChanges, validationResult, taskConfig) {
  let prompt = `
You are OpenHands, an AI agent that resolves GitHub issues by generating code changes.

You previously generated code changes to fix the following issue:
Repository: ${taskConfig.issueInfo.repository}
Issue Title: ${taskConfig.issueInfo.title}

However, there were some issues with your generated code:

`;

  // Add validation issues
  for (const issue of validationResult.issues) {
    prompt += `- ${issue.message} for file: ${issue.change.path}\n`;
  }

  prompt += `
Here are the code changes you previously generated:

`;

  // Add code changes
  for (const change of codeChanges) {
    prompt += `
\`\`\`filename: ${change.path}
${change.content}
\`\`\`

`;
  }

  prompt += `
Please fix the issues with your generated code and provide a revised solution.
Format each file change as:

\`\`\`filename: path/to/file.ext
// code with changes
\`\`\`

Ensure your solution addresses all the validation issues mentioned above.
`;

  return prompt;
}

module.exports = {
  generateAndValidateCode
};