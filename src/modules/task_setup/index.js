/**
 * OpenHands Task Setup Module
 * 
 * Configures tasks for OpenHands AI agents based on GitHub issue context.
 */

const githubModule = require('../github_api');
const logger = require('../../utils/logger');

/**
 * Setup a task for AI resolution based on GitHub issue data
 * 
 * @param {Object} issueData - Data from GitHub issue
 * @returns {Promise<Object>} - Task configuration for AI
 */
async function setupTask(issueData) {
  try {
    logger.info(`Setting up task for issue #${issueData.number} in ${issueData.owner}/${issueData.repo}`);
    
    // Extract key information from the issue
    const issueInfo = extractIssueInfo(issueData);
    
    // Get custom instructions if available
    const instructions = await getCustomInstructions(issueData.owner, issueData.repo);
    
    // Collect relevant context
    const context = await collectContext(issueData, issueInfo);
    
    // Format the task for AI processing
    const taskConfig = formatTask(issueInfo, context, instructions);
    
    logger.debug('Task setup completed successfully');
    
    return taskConfig;
  } catch (error) {
    logger.error(`Failed to setup task for issue #${issueData.number}:`, error);
    throw new Error(`Task setup failed: ${error.message}`);
  }
}

/**
 * Extract key information from GitHub issue
 * 
 * @private
 * @param {Object} issueData - GitHub issue data
 * @returns {Object} - Extracted issue information
 */
function extractIssueInfo(issueData) {
  // Determine issue type based on labels or content
  const issueType = determineIssueType(issueData);
  
  // Determine issue severity
  const severity = determineSeverity(issueData);
  
  // Extract requirements from issue body
  const requirements = extractRequirements(issueData.body);
  
  // Extract error messages if present
  const errorMessages = extractErrorMessages(issueData.body);
  
  return {
    id: issueData.number,
    title: issueData.title,
    type: issueType,
    severity,
    requirements,
    errorMessages,
    createdBy: issueData.user,
    repository: issueData.repository.full_name,
    repositoryUrl: issueData.repository.url,
    createdAt: issueData.created_at,
    updatedAt: issueData.updated_at,
    hasComments: issueData.comments.length > 0
  };
}

/**
 * Determine issue type based on labels and content
 * 
 * @private
 * @param {Object} issueData - GitHub issue data
 * @returns {string} - Issue type
 */
function determineIssueType(issueData) {
  const labels = issueData.labels || [];
  const body = issueData.body || '';
  const title = issueData.title || '';
  
  // Check for bug label
  if (labels.some(label => /bug|fix|defect/i.test(label))) {
    return 'bug';
  }
  
  // Check for feature label
  if (labels.some(label => /feature|enhancement|improvement/i.test(label))) {
    return 'feature';
  }
  
  // Check for documentation label
  if (labels.some(label => /docs|documentation/i.test(label))) {
    return 'documentation';
  }
  
  // If no specific label, try to infer from content
  if (/fix|bug|issue|error|fail|crash/i.test(title) || /fix|bug|issue|error|fail|crash/i.test(body)) {
    return 'bug';
  }
  
  if (/feature|add|enhance|implement|support/i.test(title)) {
    return 'feature';
  }
  
  if (/document|docs|explain|clarify/i.test(title)) {
    return 'documentation';
  }
  
  // Default
  return 'task';
}

/**
 * Determine issue severity based on labels and content
 * 
 * @private
 * @param {Object} issueData - GitHub issue data
 * @returns {string} - Issue severity
 */
function determineSeverity(issueData) {
  const labels = issueData.labels || [];
  const body = issueData.body || '';
  
  // Check for severity/priority labels
  if (labels.some(label => /critical|p0|blocker/i.test(label))) {
    return 'critical';
  }
  
  if (labels.some(label => /high|p1|major/i.test(label))) {
    return 'high';
  }
  
  if (labels.some(label => /medium|p2|normal/i.test(label))) {
    return 'medium';
  }
  
  if (labels.some(label => /low|p3|minor|trivial/i.test(label))) {
    return 'low';
  }
  
  // Check for keywords in content
  if (/urgent|critical|emergency|severe|blocking/i.test(body)) {
    return 'high';
  }
  
  // Default
  return 'medium';
}

/**
 * Extract requirements from issue body
 * 
 * @private
 * @param {string} body - Issue body text
 * @returns {Array} - List of requirements
 */
function extractRequirements(body) {
  if (!body) return [];
  
  const requirements = [];
  
  // Look for checklist items
  const checklistRegex = /- \[([ x])\] (.+?)(?=\n|$)/g;
  let match;
  while ((match = checklistRegex.exec(body)) !== null) {
    requirements.push(match[2].trim());
  }
  
  // If no checklist, look for bullet points
  if (requirements.length === 0) {
    const bulletRegex = /[-*] (.+?)(?=\n|$)/g;
    while ((match = bulletRegex.exec(body)) !== null) {
      requirements.push(match[1].trim());
    }
  }
  
  // If still no requirements, try to split by newlines
  if (requirements.length === 0) {
    const lines = body.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 10 && !line.startsWith('#') && !line.startsWith('<!--'));
    
    requirements.push(...lines);
  }
  
  return requirements;
}

/**
 * Extract error messages from issue body
 * 
 * @private
 * @param {string} body - Issue body text
 * @returns {Array} - List of error messages
 */
function extractErrorMessages(body) {
  if (!body) return [];
  
  const errorMessages = [];
  
  // Look for code blocks that might contain errors
  const codeBlockRegex = /```(?:\w+)?\n([\s\S]+?)\n```/g;
  let match;
  while ((match = codeBlockRegex.exec(body)) !== null) {
    const codeBlock = match[1];
    
    // Check if code block contains error keywords
    if (/error|exception|fail|traceback|stack trace/i.test(codeBlock)) {
      errorMessages.push(codeBlock.trim());
    }
  }
  
  // Look for lines that look like error messages
  const errorRegex = /(error|exception|failure|warning):?\s+(.+?)(?=\n|$)/gi;
  while ((match = errorRegex.exec(body)) !== null) {
    errorMessages.push(match[0].trim());
  }
  
  return errorMessages;
}

/**
 * Get custom instructions from repository
 * 
 * @private
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Object>} - Custom instructions if available
 */
async function getCustomInstructions(owner, repo) {
  try {
    // Check for .openhands_instructions file
    const instructionsContent = await githubModule.fetchFileContent(
      owner, 
      repo, 
      '.openhands_instructions'
    );
    
    // Parse JSON or YAML instructions
    try {
      return JSON.parse(instructionsContent);
    } catch (e) {
      // Not valid JSON, return as string
      return { rawInstructions: instructionsContent };
    }
  } catch (error) {
    // File doesn't exist or can't be accessed, which is okay
    logger.debug(`No custom instructions found for ${owner}/${repo}`);
    return {};
  }
}

/**
 * Collect context for task resolution
 * 
 * @private
 * @param {Object} issueData - GitHub issue data
 * @param {Object} issueInfo - Extracted issue information
 * @returns {Promise<Object>} - Collected context
 */
async function collectContext(issueData, issueInfo) {
  // For bugs, collect relevant code snippets
  const codeSnippets = await collectCodeSnippets(issueData);
  
  // Collect comments that might provide additional context
  const relevantComments = filterRelevantComments(issueData.comments);
  
  // For bugs, try to find similar issues
  const similarIssues = issueInfo.type === 'bug' 
    ? await findSimilarIssues(issueData)
    : [];
  
  // Get repository structure to understand the codebase
  const repoStructure = await getRepositoryStructure(issueData.owner, issueData.repo);
  
  return {
    codeSnippets,
    relevantComments,
    similarIssues,
    repoStructure
  };
}

/**
 * Collect code snippets from issue and referenced files
 * 
 * @private
 * @param {Object} issueData - GitHub issue data
 * @returns {Promise<Array>} - Collected code snippets
 */
async function collectCodeSnippets(issueData) {
  const snippets = [];
  
  // Extract code blocks from issue body
  const codeBlockRegex = /```(?:(\w+))?\n([\s\S]+?)\n```/g;
  const body = issueData.body || '';
  
  let match;
  while ((match = codeBlockRegex.exec(body)) !== null) {
    const language = match[1] || 'unknown';
    const code = match[2];
    
    snippets.push({
      source: 'issue_body',
      language,
      code,
      lineCount: code.split('\n').length
    });
  }
  
  // Extract file paths mentioned in the issue
  const filePathRegex = /(?:in|at|file|path):\s*['"]([\w\-\/\.]+)['"]|['"]([\w\-\/\.]+\.\w+)['"]/g;
  const filePaths = new Set();
  
  while ((match = filePathRegex.exec(body)) !== null) {
    const path = match[1] || match[2];
    if (path && /\.\w+$/.test(path)) { // Ensure it looks like a file path with extension
      filePaths.add(path);
    }
  }
  
  // Extract code from mentioned files
  for (const path of filePaths) {
    try {
      const fileContent = await githubModule.fetchFileContent(
        issueData.owner,
        issueData.repo,
        path
      );
      
      // Guess language from file extension
      const extensionMatch = path.match(/\.(\w+)$/);
      const language = extensionMatch ? extensionMatch[1] : 'unknown';
      
      snippets.push({
        source: 'referenced_file',
        path,
        language,
        code: fileContent,
        lineCount: fileContent.split('\n').length
      });
    } catch (error) {
      logger.debug(`Could not fetch referenced file: ${path}`);
    }
  }
  
  return snippets;
}

/**
 * Filter comments that provide relevant context
 * 
 * @private
 * @param {Array} comments - Issue comments
 * @returns {Array} - Relevant comments
 */
function filterRelevantComments(comments) {
  if (!comments || comments.length === 0) return [];
  
  return comments
    .filter(comment => {
      const body = comment.body || '';
      
      // Check for keywords that might indicate useful information
      return (
        /repro|steps|here's what|this happens|i tried|error|fail|does not work/i.test(body) ||
        body.includes('```') // Contains code block
      );
    })
    .map(comment => ({
      id: comment.id,
      user: comment.user,
      body: comment.body,
      created_at: comment.created_at,
      has_code: comment.body.includes('```')
    }));
}

/**
 * Find similar issues that might provide insight
 * 
 * @private
 * @param {Object} issueData - GitHub issue data
 * @returns {Promise<Array>} - Similar issues
 */
async function findSimilarIssues(issueData) {
  // This is a simplified implementation
  // In a full implementation, this would search for similar issues using GitHub API
  
  return []; // Placeholder for future implementation
}

/**
 * Get repository structure to understand the codebase context
 * 
 * @private
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Object>} - Repository structure
 */
async function getRepositoryStructure(owner, repo) {
  try {
    // Get top-level directories to understand project structure
    const files = await githubModule.fetchRepositoryFiles(owner, repo, '');
    
    // Process directories to get a summary of the project structure
    const directories = files.filter(file => file.type === 'dir');
    const structure = {
      name: repo,
      top_level_dirs: directories.map(dir => dir.name),
      files_count: files.length
    };
    
    // Try to get package configuration files for more context
    try {
      // Check for package.json (Node.js)
      const packageJson = await githubModule.fetchFileContent(owner, repo, 'package.json');
      structure.packageJson = JSON.parse(packageJson);
    } catch (e) {
      // No package.json or error parsing it, which is fine
    }
    
    try {
      // Check for README.md
      const readme = await githubModule.fetchFileContent(owner, repo, 'README.md');
      structure.readme = readme;
    } catch (e) {
      // No README.md, which is fine
    }
    
    return structure;
  } catch (error) {
    logger.warn(`Could not fetch repository structure for ${owner}/${repo}:`, error);
    return {
      name: repo,
      error: true
    };
  }
}

/**
 * Format task for AI processing
 * 
 * @private
 * @param {Object} issueInfo - Extracted issue information
 * @param {Object} context - Collected context
 * @param {Object} instructions - Custom instructions
 * @returns {Object} - Formatted task
 */
function formatTask(issueInfo, context, instructions) {
  // Generate a title for the task
  const taskTitle = `[${issueInfo.type.toUpperCase()}] ${issueInfo.title}`;
  
  // Create a structured description with all available information
  const taskDescription = createTaskDescription(issueInfo, context);
  
  // Apply any custom instructions
  const customInstructions = instructions.rawInstructions || '';
  
  // Prepare file snippets in a format that's easy for AI to parse
  const codeContext = prepareCodeContext(context.codeSnippets);
  
  // Prioritize the task based on severity and age
  const priority = calculatePriority(issueInfo);
  
  return {
    title: taskTitle,
    description: taskDescription,
    type: issueInfo.type,
    priority,
    issueNumber: issueInfo.id,
    repository: issueInfo.repository,
    codeContext,
    customInstructions,
    similarIssues: context.similarIssues,
    repositoryStructure: context.repoStructure
  };
}

/**
 * Create a detailed task description
 * 
 * @private
 * @param {Object} issueInfo - Extracted issue information
 * @param {Object} context - Collected context
 * @returns {string} - Formatted task description
 */
function createTaskDescription(issueInfo, context) {
  let description = `# ${issueInfo.title}\n\n`;
  
  // Add issue details
  description += `**Issue Type:** ${issueInfo.type}\n`;
  description += `**Severity:** ${issueInfo.severity}\n`;
  description += `**Created By:** ${issueInfo.createdBy}\n`;
  description += `**Issue Number:** #${issueInfo.id}\n`;
  description += `**Repository:** ${issueInfo.repository}\n\n`;
  
  // Add requirements if available
  if (issueInfo.requirements && issueInfo.requirements.length > 0) {
    description += `## Requirements\n`;
    issueInfo.requirements.forEach(req => {
      description += `- ${req}\n`;
    });
    description += '\n';
  }
  
  // Add error messages if available
  if (issueInfo.errorMessages && issueInfo.errorMessages.length > 0) {
    description += `## Error Messages\n`;
    issueInfo.errorMessages.forEach(err => {
      description += `\`\`\`\n${err}\n\`\`\`\n`;
    });
    description += '\n';
  }
  
  // Add relevant comments if available
  if (context.relevantComments && context.relevantComments.length > 0) {
    description += `## Additional Context from Comments\n`;
    context.relevantComments.forEach(comment => {
      description += `**${comment.user} commented:**\n`;
      description += `${comment.body}\n\n`;
    });
  }
  
  return description;
}

/**
 * Prepare code context for AI processing
 * 
 * @private
 * @param {Array} snippets - Code snippets
 * @returns {Object} - Prepared code context
 */
function prepareCodeContext(snippets) {
  if (!snippets || snippets.length === 0) {
    return { hasCode: false };
  }
  
  // Organize snippets by source
  const issueSnippets = snippets.filter(s => s.source === 'issue_body');
  const fileSnippets = snippets.filter(s => s.source === 'referenced_file');
  
  return {
    hasCode: true,
    issueSnippets,
    fileSnippets,
    totalSnippets: snippets.length
  };
}

/**
 * Calculate task priority
 * 
 * @private
 * @param {Object} issueInfo - Issue information
 * @returns {number} - Priority score (1-10)
 */
function calculatePriority(issueInfo) {
  let score = 5; // Default medium priority
  
  // Adjust based on severity
  if (issueInfo.severity === 'critical') score += 3;
  else if (issueInfo.severity === 'high') score += 2;
  else if (issueInfo.severity === 'low') score -= 2;
  
  // Adjust based on age (newer issues might be more urgent)
  const ageInDays = (new Date() - new Date(issueInfo.createdAt)) / (1000 * 60 * 60 * 24);
  if (ageInDays < 1) score += 1; // Very recent issues
  else if (ageInDays > 30) score -= 1; // Older issues
  
  // Adjust based on type
  if (issueInfo.type === 'bug') score += 1;
  
  // Ensure score is within bounds
  return Math.max(1, Math.min(10, Math.round(score)));
}

module.exports = {
  setupTask
};