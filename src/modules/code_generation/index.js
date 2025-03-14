/**
 * Code Generation and Validation Module
 * Generates and validates code fixes using Claude
 */

const logger = require('../../utils/logger');
const configModule = require('../configuration');

/**
 * Generate and validate code changes
 * @param {Object} taskConfig - Task configuration
 * @returns {Promise<Object>} - Generated code changes
 */
async function generateAndValidateCode(taskConfig) {
  try {
    logger.info(`Generating code for issue #${taskConfig.issueData.number}`);
    
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
 * @private
 * @param {Object} taskConfig - Task configuration
 * @returns {string} - Prompt for Claude
 */
function generatePrompt(taskConfig) {
  const { issueData, issueType, requirements, customInstructions, repoInstructions, relevantFiles } = taskConfig;
  const claudeConfig = configModule.getSection('claude_desktop');
  
  let prompt = `
You are OpenHands, an AI agent that resolves GitHub issues by generating code changes.

Issue URL: ${issueData.url}
Repository: ${issueData.owner}/${issueData.repo}
Issue Title: ${issueData.title}
Issue Type: ${issueType}

Issue Description:
${issueData.body}

`;

  if (requirements && requirements.length > 0) {
    prompt += `
Requirements:
${requirements.map(req => `- ${req}`).join('\n')}

`;
  }

  if (customInstructions) {
    prompt += `
Custom Instructions:
${customInstructions}

`;
  }

  if (repoInstructions) {
    prompt += `
Repository Instructions:
${repoInstructions}

`;
  }

  // Include relevant files
  if (relevantFiles && relevantFiles.length > 0) {
    prompt += `
Relevant files from the repository:

`;

    for (const file of relevantFiles) {
      if (file.content) {
        prompt += `
File: ${file.path}
\`\`\`
${file.content.length > 1000 ? file.content.substring(0, 1000) + '...' : file.content}
\`\`\`

`;
      } else {
        prompt += `
File: ${file.path} (${file.large ? 'Large file, content omitted' : 'Content unavailable'})

`;
      }
    }
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
 * @private
 * @param {string} prompt - Prompt for Claude
 * @param {Object} taskConfig - Task configuration
 * @returns {Promise<string>} - Generated code and explanation
 */
async function generateCodeWithClaudeDesktop(prompt, taskConfig) {
  // In a real implementation, this would interface with Claude Desktop
  // For this MVP, we'll simulate a response
  
  logger.info('Sending prompt to Claude Desktop');
  
  // Simulate Claude's response based on issue type
  return new Promise(resolve => {
    // Add a small delay to simulate thinking time
    setTimeout(() => {
      const { issueType } = taskConfig;
      let response = '';
      
      if (issueType === 'bug') {
        response = simulateBugFixResponse(taskConfig);
      } else if (issueType === 'feature') {
        response = simulateFeatureImplementationResponse(taskConfig);
      } else if (issueType === 'documentation') {
        response = simulateDocumentationResponse(taskConfig);
      } else {
        response = simulateGenericResponse(taskConfig);
      }
      
      logger.info('Received response from Claude Desktop');
      resolve(response);
    }, 1000);
  });
}

/**
 * Extract code changes from Claude's response
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
  
  return changes;
}

/**
 * Extract explanation from Claude's response
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
 * @private
 * @param {Array<Object>} codeChanges - List of code changes
 * @param {Object} taskConfig - Task configuration
 * @returns {Promise<Object>} - Validation result
 */
async function validateCode(codeChanges, taskConfig) {
  logger.info('Validating generated code changes');
  
  // In a real implementation, this would run actual validation
  // For this MVP, we'll perform basic validation
  
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
    
    // Check for syntax errors (in a real implementation, this would be a proper parser)
    const hasSyntaxError = basicSyntaxCheck(change.path, change.content);
    if (hasSyntaxError) {
      validationIssues.push({
        severity: 'error',
        message: `Syntax error in file: ${hasSyntaxError}`,
        change
      });
    }
  }
  
  // In a real implementation, we would also check:
  // - If the changes actually fix the issue
  // - If the changes introduce new bugs
  // - If the changes follow project coding standards
  
  return {
    valid: validationIssues.length === 0,
    issues: validationIssues
  };
}

/**
 * Basic syntax check for common file types
 * @private
 * @param {string} filePath - Path to the file
 * @param {string} content - File content
 * @returns {string|null} - Error message or null if valid
 */
function basicSyntaxCheck(filePath, content) {
  // This is a very simplified syntax check
  // In a real implementation, we would use proper parsers
  
  const extension = filePath.split('.').pop().toLowerCase();
  
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
          return `Mismatched ${char} in JavaScript/TypeScript file`;
        }
      }
    }
    
    if (stack.length > 0) {
      return `Unclosed ${stack[stack.length - 1]} in JavaScript/TypeScript file`;
    }
  }
  
  return null;
}

/**
 * Refine code based on validation issues
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
  if (!refinedValidationResult.valid && taskConfig.refinementAttempts < 3) {
    logger.warn('Refined code still has validation issues, attempting another refinement');
    
    // Update task config with incremented refinement attempts
    const updatedTaskConfig = {
      ...taskConfig,
      refinementAttempts: (taskConfig.refinementAttempts || 0) + 1
    };
    
    return await refineCode(refinedChanges, refinedValidationResult, updatedTaskConfig);
  }
  
  return {
    codeChanges: refinedChanges,
    explanation: extractExplanation(refinedResponse),
    validationResult: refinedValidationResult,
    refinementAttempts: (taskConfig.refinementAttempts || 0) + 1
  };
}

/**
 * Generate a refinement prompt
 * @private
 * @param {Array<Object>} codeChanges - List of code changes
 * @param {Object} validationResult - Validation result
 * @param {Object} taskConfig - Task configuration
 * @returns {string} - Refinement prompt
 */
function generateRefinementPrompt(codeChanges, validationResult, taskConfig) {
  const { issueData } = taskConfig;
  
  let prompt = `
You are OpenHands, an AI agent that resolves GitHub issues by generating code changes.

You previously generated code changes to fix the following issue:
Issue URL: ${issueData.url}
Repository: ${issueData.owner}/${issueData.repo}
Issue Title: ${issueData.title}

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

/**
 * Simulate a bug fix response for testing
 * @private
 * @param {Object} taskConfig - Task configuration
 * @returns {string} - Simulated response
 */
function simulateBugFixResponse(taskConfig) {
  return `
I've analyzed the issue and found the root cause of the bug. Here's my solution:

\`\`\`filename: src/components/UserProfile.js
import React from 'react';

function UserProfile({ user }) {
  // Fixed the null user bug by adding a null check
  if (!user) {
    return <div>Loading user data...</div>;
  }
  
  return (
    <div className="user-profile">
      <h2>{user.name}</h2>
      <p>{user.bio}</p>
    </div>
  );
}

export default UserProfile;
\`\`\`

Explanation:
The bug was occurring because the component wasn't handling the case where \`user\` is null during initial loading. I've added a null check that returns a loading indicator when the user data isn't available yet, which prevents the null reference error.
`;
}

/**
 * Simulate a feature implementation response for testing
 * @private
 * @param {Object} taskConfig - Task configuration
 * @returns {string} - Simulated response
 */
function simulateFeatureImplementationResponse(taskConfig) {
  return `
I've implemented the requested feature. Here are the changes:

\`\`\`filename: src/components/SearchBar.js
import React, { useState } from 'react';

function SearchBar({ onSearch }) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    showClosed: false,
    sortBy: 'newest'
  });
  
  const handleQueryChange = (e) => {
    setQuery(e.target.value);
  };
  
  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(query, filters);
  };
  
  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        value={query}
        onChange={handleQueryChange}
        placeholder="Search issues..."
      />
      <div className="filters">
        <label>
          <input
            type="checkbox"
            name="showClosed"
            checked={filters.showClosed}
            onChange={(e) => setFilters({
              ...filters,
              showClosed: e.target.checked
            })}
          />
          Show closed issues
        </label>
        <select
          name="sortBy"
          value={filters.sortBy}
          onChange={handleFilterChange}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="most-commented">Most commented</option>
          <option value="least-commented">Least commented</option>
        </select>
      </div>
      <button type="submit">Search</button>
    </form>
  );
}

export default SearchBar;
\`\`\`

Explanation:
I've implemented the advanced search feature with filtering options as requested. The component now includes:
1. A text input for the search query
2. A checkbox to toggle showing closed issues
3. A dropdown to select sorting options
4. A submit button to trigger the search

The component maintains its state using React hooks and calls the provided onSearch callback with the query and filters when submitted.
`;
}

/**
 * Simulate a documentation response for testing
 * @private
 * @param {Object} taskConfig - Task configuration
 * @returns {string} - Simulated response
 */
function simulateDocumentationResponse(taskConfig) {
  return `
I've updated the documentation as requested:

\`\`\`filename: docs/api.md
# API Documentation

## Overview

This document provides comprehensive information about the API endpoints available in this application.

## Authentication

All API endpoints require authentication using a JSON Web Token (JWT).

### Obtaining a Token

To obtain a token, send a POST request to the \`/api/auth/login\` endpoint with your credentials:

\`\`\`
POST /api/auth/login
Content-Type: application/json

{
  "username": "your_username",
  "password": "your_password"
}
\`\`\`

The response will include a token that should be included in all subsequent requests:

\`\`\`
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
\`\`\`

### Using the Token

Include the token in the Authorization header of all API requests:

\`\`\`
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
\`\`\`

## Endpoints

### User Endpoints

#### GET /api/users

Retrieves a list of all users.

**Query Parameters:**
- \`page\` (optional): Page number for pagination (default: 1)
- \`limit\` (optional): Number of items per page (default: 10)

**Response:**
\`\`\`
{
  "users": [
    {
      "id": 1,
      "username": "user1",
      "email": "user1@example.com",
      "created_at": "2023-01-01T00:00:00Z"
    },
    ...
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "pages": 10
  }
}
\`\`\`

#### GET /api/users/:id

Retrieves a specific user by ID.

**Response:**
\`\`\`
{
  "id": 1,
  "username": "user1",
  "email": "user1@example.com",
  "created_at": "2023-01-01T00:00:00Z",
  "profile": {
    "full_name": "User One",
    "bio": "This is my bio",
    "avatar_url": "https://example.com/avatar.jpg"
  }
}
\`\`\`
\`\`\`

Explanation:
I've created comprehensive API documentation that includes:
1. An overview of the API
2. Authentication instructions
3. Detailed endpoint documentation with examples
4. Query parameter and response format explanations

This documentation follows best practices with clear structure, code examples, and consistent formatting.
`;
}

/**
 * Simulate a generic response for testing
 * @private
 * @param {Object} taskConfig - Task configuration
 * @returns {string} - Simulated response
 */
function simulateGenericResponse(taskConfig) {
  return `
I've analyzed the issue and implemented a solution:

\`\`\`filename: src/utils/helpers.js
/**
 * Format a date string according to user locale and preferences
 * @param {string|Date} date - Date to format
 * @param {Object} options - Formatting options
 * @param {string} options.format - Format style ('short', 'medium', 'long')
 * @param {string} options.locale - Locale for formatting (default: user's locale)
 * @returns {string} - Formatted date string
 */
export function formatDate(date, options = {}) {
  const {
    format = 'medium',
    locale = navigator.language || 'en-US'
  } = options;
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (!(dateObj instanceof Date) || isNaN(dateObj)) {
    console.error('Invalid date provided to formatDate:', date);
    return '';
  }
  
  try {
    switch (format) {
      case 'short':
        return dateObj.toLocaleDateString(locale);
      case 'long':
        return dateObj.toLocaleDateString(locale, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      case 'medium':
      default:
        return dateObj.toLocaleDateString(locale, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateObj.toDateString();
  }
}
\`\`\`

Explanation:
I've implemented a flexible date formatting utility that:
1. Accepts both string and Date object inputs
2. Supports different formatting styles (short, medium, long)
3. Uses the user's locale by default but allows overriding
4. Includes proper error handling for invalid inputs
5. Has comprehensive JSDoc documentation for good developer experience

This implementation follows best practices and will help standardize date formatting across the application.
`;
}

module.exports = {
  generateAndValidateCode
};