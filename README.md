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

## Development Phases

The implementation is divided into four distinct phases:

1. **Phase 1: Core Functionality (MVP)** - Essential components for basic issue resolution
2. **Phase 2: Enhanced Reliability and User Experience** - Improved robustness and user interaction
3. **Phase 3: Advanced Resolution Capabilities** - Sophisticated analysis and solution generation
4. **Phase 4: Optimization and Ecosystem Integration** - Performance tuning and broader integration

## Setup and Usage

### Prerequisites

- Node.js (v14 or higher)
- GitHub Personal Access Token with appropriate permissions
- Claude Desktop Application

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

3. Create a `.env` file with the required configuration (see `.env.example`):
   ```
   GITHUB_TOKEN=your_github_token_here
   LOG_LEVEL=info
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

## License

[License information to be determined]
