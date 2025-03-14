# OpenHands Resolver MCP

## Overview

The OpenHands Resolver is an AI-driven system designed to automate GitHub issue resolution by leveraging the OpenHands project's AI agents within the Claude Desktop application. As a Model Context Protocol, it utilizes Claude's advanced language understanding and code generation capabilities to interpret issues, generate solutions, and manage the resolution process.

## Architecture

The OpenHands Resolver comprises eight key modules that collaborate to detect, process, and resolve GitHub issues:

- **Trigger Detection Module**: Identifies when to start the resolution process based on GitHub events or manual commands.
- **GitHub API Integration Module**: Manages communication with GitHub for issue retrieval and pull request creation.
- **OpenHands Task Setup Module**: Prepares tasks for AI agents using issue context and custom instructions.
- **Code Generation and Validation Module**: Generates and validates code fixes using OpenHands AI agents powered by Claude.
- **Commit and PR Creation Module**: Commits changes and creates pull requests on GitHub.
- **Feedback and Visualization Module**: Provides resolution feedback and visualizes outcomes.
- **Batch Processing Module**: Enables simultaneous resolution of multiple issues.
- **Configuration Module**: Manages settings for LLM models, tokens, and custom instructions.

## Features

- **Automatic Issue Analysis**: Analyzes GitHub issues to understand the problem context
- **AI-Powered Code Generation**: Uses Claude to generate code solutions for issues
- **Pull Request Creation**: Automatically creates branches and pull requests with fixes
- **Code Validation**: Validates generated code for syntax and basic functionality
- **Batch Processing**: Resolves multiple issues concurrently with prioritization
- **Feedback System**: Posts comments on GitHub issues with resolution status
- **Visualization**: Generates visual summaries of the resolution process
- **Customizable**: Configure resolution behavior with custom instructions files

## Setup and Usage

### Prerequisites

- Node.js (v16 or higher)
- GitHub Personal Access Token with appropriate permissions
- Claude Desktop Application
- Model Context Protocol SDK

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/openhands-resolver-mcp.git
   cd openhands-resolver-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with the required configuration:
   ```
   GITHUB_TOKEN=your_github_token_here
   LOG_LEVEL=info
   AI_MODEL=claude-3-opus-20240229
   AI_TEMPERATURE=0.2
   AI_MAX_TOKENS=4000
   ```

### Configuration

OpenHands Resolver can be customized using a configuration file or environment variables:

1. Create a configuration file (config.json):
   ```json
   {
     "github": {
       "timeout": 10000,
       "maxRetries": 3,
       "maxConcurrent": 5
     },
     "ai": {
       "model": "claude-3-opus-20240229",
       "temperature": 0.2,
       "maxTokens": 4000,
       "systemMessage": "You are OpenHands, an AI agent designed to resolve GitHub issues by generating code fixes."
     },
     "pullRequest": {
       "defaultAsDraft": true,
       "titlePrefix": "OpenHands: ",
       "addLabels": ["ai-assisted"],
       "createCheckList": true
     }
   }
   ```

2. Initialize with the configuration file:
   ```javascript
   const openhandsResolver = require('./src/index');
   await openhandsResolver.initialize('./path/to/config.json');
   ```

### Repository-Specific Instructions

You can add custom instructions for your repository by creating a `.openhands_instructions` file in the root of your repository. This file can contain specific guidance for code style, testing requirements, or other project-specific conventions.

Example `.openhands_instructions`:
```json
{
  "codeStyle": "standard",
  "testRequirements": "Add tests for all changes",
  "priorityLabels": ["high-priority", "critical"],
  "ignorePaths": ["dist/", "node_modules/"]
}
```

### Usage

As a Model Context Protocol integrated into Claude Desktop, the OpenHands Resolver is activated through natural language requests to Claude. Examples include:

- "Resolve GitHub issue https://github.com/username/repo/issues/123"
- "Fix the bug described in https://github.com/username/repo/issues/456"
- "Resolve issues from https://github.com/username/repo/issues/123 and https://github.com/username/repo/issues/124"

The MCP will:
1. Detect the GitHub issue(s)
2. Analyze the issue description and context
3. Generate code changes to resolve the issue
4. Create a pull request with the proposed solution
5. Provide feedback on the resolution process

### Programmatic Usage

You can also use OpenHands Resolver programmatically:

```javascript
const openhandsResolver = require('./src/index');

// Initialize
await openhandsResolver.initialize();

// Resolve a single issue
const result = await openhandsResolver.resolveIssue({
  issueUrl: 'https://github.com/username/repo/issues/123',
  owner: 'username',
  repo: 'repo',
  issueNumber: 123,
  isBatch: false
});

// Process multiple issues
const batchResult = await openhandsResolver.resolveBatch([
  {
    issueUrl: 'https://github.com/username/repo/issues/123',
    owner: 'username',
    repo: 'repo',
    issueNumber: 123
  },
  {
    issueUrl: 'https://github.com/username/repo/issues/124',
    owner: 'username',
    repo: 'repo',
    issueNumber: 124
  }
]);
```

## Development

### Project Structure

```
openhands-resolver-mcp/
├── src/
│   ├── modules/
│   │   ├── batch_processing/       # Batch issue processing
│   │   ├── code_generation/        # AI code generation
│   │   ├── commit_pr/              # GitHub PR creation
│   │   ├── configuration/          # Settings management
│   │   ├── feedback/               # Resolution feedback
│   │   ├── github_api/             # GitHub API integration
│   │   ├── task_setup/             # AI task configuration
│   │   └── trigger_detection/      # Trigger identification
│   ├── utils/                      # Shared utilities
│   └── index.js                    # Main entry point
├── tests/
│   ├── integration/                # End-to-end tests
│   └── unit/                       # Unit tests
└── config/                         # Configuration files
```

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration
```

### Linting and Formatting

```bash
# Run linting
npm run lint

# Format code
npm run format
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
