# OpenCode GUI (VSCode Extension)

A graphical user interface for OpenCode AI, providing a rich VSCode extension experience for AI-powered coding assistance.

## Version

Current version: **0.0.2**

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

## Features

### Core Infrastructure
- **OpenCode Client**: API wrapper for OpenCode server communication
- **SSE Event Streaming**: Real-time event handling for chat sessions
- **Configuration Management**: Persistent storage for extension settings
- **VS Code Integration**: Seamless integration with VSCode settings API

### Session Management
- Create, open, fork, delete, and export sessions
- Active session tracking with visual indicators
- Session sidebar tree view with inline actions
- Session archiving support
- Refresh session list on demand

### Chat Interface
- Main chat panel with streaming responses
- @ file/code mentions for context
- Tool execution status visualization
- Agent selector dropdown
- File attachment support
- Collapsible reasoning display with auto-collapse on completion
- Session history restoration when switching sessions

### AI Configuration
- Agent selection and management
- Provider and model configuration
- API key management
- Default agent settings

### Permission System
- Interactive permission request dialogs
- Allow once / Allow all / Deny / Deny tool options
- Tool operation risk display

### Server Management
- Auto-start local OpenCode server
- Server health monitoring
- Multiple connection modes (auto/remote/embedded)

## Installation

### Development

```bash
# Install dependencies
cd extension
bun install

# Compile in watch mode
bun run watch:esbuild

# Or build once
bun run package
```

### Extension Development

1. Open the `extension/` directory in VS Code
2. Press `F5` to launch Extension Development Host
3. Test the extension in the new VS Code window

## Usage

### Quick Start

1. Open VS Code with the extension activated
2. Use `Cmd+Escape` (macOS) or `Ctrl+Escape` (Windows/Linux) to open chat
3. Use `Cmd+Shift+Escape` to create a new session
4. Select code and use `Cmd+K Cmd+E` to explain selection

### Commands

- `opencode.chat.open` - Open chat panel
- `opencode.session.create` - Create new session (新建任务)
- `opencode.session.open` - Open existing session
- `opencode.session.delete` - Delete session
- `opencode.session.fork` - Fork session from current or historical state
- `opencode.session.export` - Export session to file
- `opencode.sessions.refresh` - Refresh session list
- `opencode.chat.explainSelection` - Explain selected code
- `opencode.chat.refactorSelection` - Refactor selected code
- `opencode.chat.generateTests` - Generate tests for selection
- `opencode.config.selectModel` - Select AI model
- `opencode.config.setApiKey` - Set API key

### Configuration

Open VS Code settings and search for "OpenCode":

- `opencode.server.mode` - Connection mode (auto/remote/embedded)
- `opencode.server.baseUrl` - OpenCode server URL
- `opencode.server.autoStart` - Auto-start local server
- `opencode.defaultAgent` - Default AI agent
- `opencode.chat.showToolOutput` - Show tool output in chat

## Architecture

The extension is organized into 8 modules:

- **Module A**: Infrastructure layer (client, config, utils)
- **Module G**: Command registration framework
- **Module B**: Session management
- **Module E**: AI configuration management
- **Module F**: Permission system
- **Module C**: Chat panel UI
- **Module D**: Session sidebar
- **Module H**: VS Code integration

See [AGENTS.md](./AGENTS.md) for detailed development guidelines.

## Known Limitations

This is v0.0.2 with active development. Some features from the TUI version may not yet be available:

- Testing infrastructure is incomplete
- No end-user documentation
- Limited diff preview for code changes
- No multi-session comparison view
- No real-time collaboration features

## Contributing

See [AGENTS.md](./AGENTS.md) for development guidelines and [docs/TODO.md](docs/TODO.md) for current tasks.

## Documentation

- [AGENTS.md](./AGENTS.md) - Development guidelines and code style
- [CHANGELOG.md](./CHANGELOG.md) - Version history
- [docs/TODO.md](./docs/TODO.md) - Development task list
- [docs/modules/](./docs/modules/) - Module-specific documentation

## License

See the original OpenCode project at [https://github.com/anomalyco/opencode](https://github.com/anomalyco/opencode)