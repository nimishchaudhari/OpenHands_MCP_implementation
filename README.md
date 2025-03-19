# OpenHands Resolver MCP

## Overview

The OpenHands Resolver is an AI-driven system designed to automate GitHub issue resolution by leveraging Claude's advanced AI capabilities within the Claude Desktop application. As a Model Context Protocol (MCP) implementation, it utilizes Claude's language understanding and code generation abilities to interpret issues, generate solutions, and manage the resolution process end-to-end.

## Architecture

The OpenHands Resolver comprises nine key modules that collaborate to detect, process, and resolve GitHub issues:

- **Trigger Detection Module**: Identifies when to start the resolution process based on natural language requests, GitHub events, or manual commands.
- **GitHub API Integration Module**: Manages all GitHub interactions for issue retrieval and pull request creation.
- **OpenHands Task Setup Module**: Prepares tasks for AI agents using issue context and custom instructions.
- **Code Generation and Validation Module**: Generates and validates code fixes using Claude's AI capabilities.
- **Commit and PR Creation Module**: Commits changes and creates pull requests on GitHub.
- **Feedback and Visualization Module**: Provides resolution feedback and visualizes outcomes.
- **Batch Processing Module**: Enables simultaneous resolution of multiple issues.
- **Configuration Module**: Manages settings for AI models, tokens, and custom instructions.
- **Tracking Models Module**: Implements hand tracking models including SignedPnp for improved accuracy.

## Features

- **Natural Language Trigger Detection**: Understand user requests to resolve GitHub issues
- **Automatic Issue Analysis**: Analyzes GitHub issues to understand the problem context
- **AI-Powered Code Generation**: Uses Claude to generate code solutions for issues
- **Pull Request Creation**: Automatically creates branches and pull requests with fixes
- **Code Validation**: Validates generated code for syntax and basic functionality
- **Batch Processing**: Resolves multiple issues concurrently with prioritization
- **Feedback System**: Posts comments on GitHub issues with resolution status
- **Visualization**: Generates visual summaries of the resolution process
- **Customizable**: Configure resolution behavior with custom instructions files
- **SignedPnp Tracking**: Enhanced hand tracking with signed point-to-plane measurements

## SignedPnp Tracking Model

The SignedPnp tracking model provides enhanced hand tracking capabilities using signed point-to-plane measurements for improved accuracy. It is designed for use in applications that require precise hand pose estimation.

### Features of SignedPnp Tracking

- **High Accuracy**: Improved hand pose estimation with signed point-to-plane measurements
- **Robust Initialization**: Optional robust initialization for better tracking stability
- **Adaptive Weights**: Support for adaptive weighting of measurements based on confidence
- **Configurable Parameters**: Highly customizable tracking parameters
- **Visualization**: Built-in tools for visualizing tracking results

### Configuration

The SignedPnp tracking model can be configured through environment variables:

```
# Tracking Model Settings
TRACKING_MODEL_TYPE=signed-pnp
TRACKING_USE_ROBUST_INIT=true
TRACKING_MAX_ITERATIONS=100
TRACKING_CONVERGENCE_THRESHOLD=1e-5
TRACKING_USE_ADAPTIVE_WEIGHTS=true
TRACKING_MODEL_VARIANT=standard
```

## Setup and Usage

### Prerequisites

- Node.js (v16 or higher)
- GitHub Personal Access Token with appropriate permissions
- Claude Desktop Application
- Model Context Protocol SDK

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/nimishchaudhari/OpenHands_MCP_implementation.git
   cd OpenHands_MCP_implementation
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with the required configuration (use `.env.example` as a template):
   ```bash
   cp .env.example .env
   # Edit .env with your specific values
   ```

### Configuration

OpenHands Resolver can be customized using environment variables, a configuration file, or repository-specific instructions:

1. **Environment Variables** (via `.env` file) for basic settings:
   ```
   GITHUB_TOKEN=your_github_token_here
   LOG_LEVEL=info
   AI_MODEL=claude-3-opus-20240229
   TRACKING_MODEL_TYPE=signed-pnp
   ```

2. **Configuration File** (JSON) for more detailed settings:
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
       "maxTokens": 4000
     },
     "pullRequest": {
       "defaultAsDraft": true,
       "titlePrefix": "OpenHands: ",
       "addLabels": ["ai-assisted"]
     },
     "trackingModel": {
       "type": "signed-pnp",
       "config": {
         "useRobustInitialization": true,
         "maxIterations": 100,
         "convergenceThreshold": 1e-5,
         "useAdaptiveWeights": true
       }
     }
   }
   ```

3. **Repository-Specific Instructions** via `.openhands_instructions` file in target repositories.

### Usage

As a Model Context Protocol integrated into Claude Desktop, the OpenHands Resolver is activated through natural language requests:

- "Resolve GitHub issue https://github.com/username/repo/issues/123"
- "Fix the bug described in https://github.com/username/repo/issues/456"
- "Resolve all issues labeled 'fix-me' in https://github.com/username/repo"

The system will:
1. Detect the GitHub issue(s)
2. Analyze the issue and repository context
3. Generate code changes to resolve the issue
4. Create a pull request with the solution
5. Provide feedback on the resolution process

### Programmatic Usage

```javascript
import * as openhandsResolver from './src/index.js';

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
  { issueUrl: 'https://github.com/username/repo/issues/123' },
  { issueUrl: 'https://github.com/username/repo/issues/124' }
]);

// Use the SignedPnp tracking model
const trackingModel = openhandsResolver.getTrackingModel();
const points = [...]; // 3D point data
const trackingResult = trackingModel.track(points);
console.log(trackingResult.pose);
```

## Development

### Project Structure

```
OpenHands_MCP_implementation/
├── src/
│   ├── modules/
│   │   ├── batch_processing/       # Batch issue processing
│   │   ├── code_generation/        # AI code generation
│   │   ├── commit_pr/              # GitHub PR creation
│   │   ├── configuration/          # Settings management
│   │   ├── feedback/               # Resolution feedback
│   │   ├── github_api/             # GitHub API integration
│   │   ├── task_setup/             # AI task configuration
│   │   ├── tracking_models/        # Hand tracking models
│   │   └── trigger_detection/      # Trigger identification
│   ├── utils/                      # Shared utilities
│   └── index.js                    # Main entry point
├── tests/
│   ├── integration/                # End-to-end tests
│   └── unit/                       # Unit tests
├── .env.example                    # Example environment variables
├── package.json                    # Project dependencies
└── README.md                       # This file
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

## Integration with Claude Desktop

The OpenHands Resolver integrates with Claude Desktop through the Model Context Protocol (MCP). This allows:

1. Natural language interaction for issue resolution
2. AI-powered code generation and validation
3. Visualization of resolution results 
4. Batch processing of multiple issues
5. Hand tracking with the SignedPnp model

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
