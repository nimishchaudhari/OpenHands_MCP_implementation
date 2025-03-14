/**
 * OpenHands Resolver MCP - Main Entry Point
 * 
 * This is the main entry point for the OpenHands Resolver MCP.
 * It integrates all modules and provides the interface for Claude Desktop.
 */

// Load environment variables
require('dotenv').config();

// Import core modules
const TriggerDetection = require('./trigger_detection');
const GitHubAPI = require('./github_api');
const TaskSetup = require('./task_setup');
const CodeGeneration = require('./code_generation');
const CommitPR = require('./commit_pr');
const Feedback = require('./feedback');
const BatchProcessing = require('./batch_processing');
const Configuration = require('./configuration');

/**
 * Main class for the OpenHands Resolver MCP
 */
class OpenHandsResolver {
  constructor() {
    this.config = new Configuration();
    this.github = new GitHubAPI(this.config);
    this.triggerDetection = new TriggerDetection(this.config);
    this.taskSetup = new TaskSetup(this.config, this.github);
    this.codeGeneration = new CodeGeneration(this.config);
    this.commitPR = new CommitPR(this.config, this.github);
    this.feedback = new Feedback(this.config, this.github);
    this.batchProcessing = new BatchProcessing(this.config);
  }

  /**
   * Initialize the resolver
   */
  async initialize() {
    await this.config.load();
    console.log('OpenHands Resolver MCP initialized');
  }

  /**
   * Handle a trigger event to start the resolution process
   * @param {Object} trigger - The trigger event data
   */
  async handleTrigger(trigger) {
    try {
      console.log(`Processing trigger: ${JSON.stringify(trigger)}`);
      
      // Get issue data from GitHub
      const issueData = await this.github.getIssueData(trigger.repository, trigger.issueNumber);
      
      // Set up task for OpenHands agents
      const task = await this.taskSetup.createTask(issueData);
      
      // Generate code solution
      const solution = await this.codeGeneration.generateSolution(task);
      
      // Validate the solution
      const validationResult = await this.codeGeneration.validateSolution(solution);
      
      if (!validationResult.success) {
        console.error(`Validation failed: ${validationResult.message}`);
        await this.feedback.provideFeedback(issueData, null, validationResult);
        return;
      }
      
      // Create commit and PR
      const prResult = await this.commitPR.createPullRequest(
        issueData,
        solution,
        trigger.branch || `fix-${trigger.issueNumber}`
      );
      
      // Provide feedback
      await this.feedback.provideFeedback(issueData, prResult, validationResult);
      
      console.log(`Successfully processed issue #${trigger.issueNumber}`);
      return { success: true, prUrl: prResult.url };
    } catch (error) {
      console.error(`Error in resolution process: ${error.message}`);
      console.error(error.stack);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process multiple issues in batch
   * @param {Array} issues - Array of issue identifiers
   */
  async processBatch(issues) {
    return await this.batchProcessing.process(issues, this.handleTrigger.bind(this));
  }
}

// Export the main class
module.exports = OpenHandsResolver;

// If this file is run directly, initialize and export the instance
if (require.main === module) {
  const resolver = new OpenHandsResolver();
  resolver.initialize().catch(console.error);
  
  // Export for Claude Desktop MCP integration
  global.openHandsResolver = resolver;
}
