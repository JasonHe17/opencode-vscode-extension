# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2026-01-20

### Added
- Initial release of opencode-gui (VSCode Extension)
- Core infrastructure layer (Module A)
  - OpenCode client wrapper for API communication
  - SSE event streaming handler
  - Extension configuration management
  - VS Code settings integration
  - URI/Path utilities
  - Selection utilities for code mentions
- Command registration framework (Module G)
  - Command registration system
  - Session commands (create, open, fork, delete, export, share, archive)
  - Chat commands (explain selection, refactor selection, generate tests)
  - Configuration commands (select model, set API key)
  - VSCode integration in package.json
- Session management (Module B)
  - Session lifecycle management
  - Active session tracking
  - Session storage persistence
- AI configuration management (Module E)
  - Agent selector implementation
  - Agent manager for agent configuration
  - Provider/model selector
  - Model configuration management
- Permission system (Module F)
  - Permission request dialog UI
  - Four permission operations (Allow once, Allow all, Deny, Deny tool)
  - Tool, operation, and risk level display
- Chat panel UI (Module C)
  - Main chat panel webview
  - Message input with @ file mentions
  - Tool execution status rendering
  - Real-time event streaming
- Session sidebar tree view (Module D)
  - Session tree provider
  - Session tree items
  - Right-click context menus
- VS Code integration (Module H)
  - Extension activation/deactivation
  - Status bar indicators (session, agent, server)
  - Icon definitions
  - Auto server start management
- Server management
  - Local OpenCode server auto-start
  - Server health checking
  - Server mode selection (auto/remote/embedded)

### Structure
```
extension/
├── src/
│   ├── main.ts                    # Extension entry point
│   ├── client/                    # API client layer
│   ├── config/                    # Configuration management
│   ├── commands/                  # Command registration
│   ├── session/                   # Session operations
│   ├── chat/                      # Chat features
│   ├── agent/                     # Agent management
│   ├── provider/                  # Provider/Model configuration
│   ├── server/                    # Server management
│   ├── settings/                  # Settings panel
│   ├── ui/                        # UI icons/theme
│   └── utils/                     # Utility functions
├── webviews/
│   ├── chat/                      # Chat webview UI
│   └── settings/                  # Settings webview UI
└── package.json                   # Extension manifest
```

### Known Limitations
- Some features from the TUI version may not be fully implemented in GUI yet
- Testing infrastructure is incomplete (some test files exist but not fully utilized)
- Documentation is development-focused, not user-facing
- No end-user documentation or user guides yet

### Technical Notes
- Uses TypeScript with ES2020 target
- Built with esbuild for fast compilation
- Integrates with @opencode-ai/sdk for API communication
- Supports VS Code 1.94.0+
- Bun for package management

### Documentation
- Development guides for all 8 modules (A-H)
- TODO.md tracking parallel development progress
- AGENTS.md describing OpenCode agent guidelines
- Module-specific documentation in docs/modules/