# OpenCode GUI Project

This repository contains the VSCode extension (opencode-gui) for OpenCode AI.

## Version

**Current Version: 0.0.1** (Initial Release)

## Project Structure

```
vscode-opencode/
├── extension/              # VSCode extension (opencode-gui)
│   ├── src/               # TypeScript source code
│   ├── webviews/          # Webview HTML/JS/CSS
│   ├── dist/              # Compiled output
│   ├── package.json       # Extension manifest (v0.0.1)
│   └── README.md          # Extension-specific README
├── packages/              # Shared packages
│   └── opencode-sdk/      # OpenCode SDK
├── docs/                  # Development documentation
│   ├── modules/           # Module-specific guides
│   ├── TODO.md            # Development task list
│   └── VERIFICATION_*.md  # Verification guides
├── AGENTS.md              # Development guidelines (agent instructions)
├── CHANGELOG.md           # Version history
└── .gitignore             # Git ignore rules
```

## Quick Start

### Install Extension

```bash
cd extension
bun install
bun run watch:esbuild
```

Then open `extension/` in VS Code and press `F5`.

### Documentation

- **Extension README**: See [extension/README.md](./extension/README.md) for extension-specific documentation
- **Development**: See [AGENTS.md](./AGENTS.md) for development guidelines
- **Tasks**: See [docs/TODO.md](./docs/TODO.md) for current development tasks
- **Changelog**: See [CHANGELOG.md](./CHANGELOG.md) for version history

## Version 0.0.1 Features

This is the initial release with core functionality:

- ✅ Infrastructure layer (client, config, utils)
- ✅ Command registration framework
- ✅ Session management
- ✅ AI configuration management
- ✅ Permission system
- ✅ Chat panel UI
- ✅ Session sidebar
- ✅ VS Code integration
- ✅ Server management (auto-start)

## Known Limitations

Some features from the TUI version may not be fully implemented yet:
- Testing infrastructure incomplete
- No end-user documentation
- Limited diff preview
- No multi-session comparison
- No real-time collaboration

## Contributing

See [AGENTS.md](./AGENTS.md) for development guidelines and module documentation.